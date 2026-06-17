package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"gdMahjong/server/internal/cache"
	"gdMahjong/server/internal/game"
	"gdMahjong/server/internal/model"
	"gdMahjong/server/internal/repository"
)

type WSSender interface {
	Send(msg interface{})
}

type RoomManager struct {
	mu          sync.RWMutex
	rooms       map[string]*LiveRoom
	userRoom    map[uint64]string
	userConn    map[uint64]WSSender
	repos       *repository.Repositories
	cache       *cache.RedisCache
	rankService *RankService
}

type LiveRoom struct {
	RoomID   string
	Engine   *game.Engine
	UserIDs  []uint64
	BotIDs   []uint64
	Status   string
	BaseScore int
	RuleID   string
}

func NewRoomManager(repos *repository.Repositories, c *cache.RedisCache, rank *RankService) *RoomManager {
	return &RoomManager{
		rooms:       map[string]*LiveRoom{},
		userRoom:    map[uint64]string{},
		userConn:    map[uint64]WSSender{},
		repos:       repos,
		cache:       c,
		rankService: rank,
	}
}

func (m *RoomManager) BindUser(userID uint64, sender WSSender) {
	m.mu.Lock()
	m.userConn[userID] = sender
	roomID := m.userRoom[userID]
	m.mu.Unlock()
	if roomID != "" {
		m.sendSync(userID, roomID)
	}
}

func (m *RoomManager) UnbindUser(userID uint64) {
	m.mu.Lock()
	delete(m.userConn, userID)
	m.mu.Unlock()
}

func (m *RoomManager) RegisterLiveRoom(roomID string, lr *LiveRoom) {
	m.mu.Lock()
	m.rooms[roomID] = lr
	for _, uid := range lr.UserIDs {
		m.userRoom[uid] = roomID
	}
	m.mu.Unlock()
}

func (m *RoomManager) GetLiveRoom(roomID string) *LiveRoom {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.rooms[roomID]
}

func (m *RoomManager) StartGame(roomID string) error {
	m.mu.Lock()
	lr, ok := m.rooms[roomID]
	if !ok {
		m.mu.Unlock()
		return errors.New("room not in memory")
	}
	m.mu.Unlock()

	eng := game.NewEngine(game.RuleConfig{
		RuleID: lr.RuleID, BaseScore: lr.BaseScore, GhostCount: 1, MaxFan: 64,
	})
	players := make([]*game.PlayerState, 0, 4)
	dbPlayers, _ := m.repos.Room.ListPlayers(roomID)
	for _, dp := range dbPlayers {
		players = append(players, &game.PlayerState{
			UserID: dp.UserID, Name: dp.NickName, Seat: dp.Seat, IsBot: dp.IsBot, Score: dp.Score,
		})
	}
	eng.InitPlayers(players)
	eng.OnBroadcast = func(eventType string, payload interface{}) {
		m.broadcastRoom(roomID, eventType, payload)
	}
	eng.OnEvent = func(userID uint64, eventType string, payload interface{}) {
		m.sendToUser(userID, payload)
	}
	eng.OnSettle = func(payload game.SettlePayload, round int, players []*game.PlayerState) {
		_ = m.rankService.PersistSettle(context.Background(), SettleContext{
			RoomID: roomID, Round: round, RuleID: lr.RuleID,
		}, payload, players)
	}
	lr.Engine = eng
	lr.Status = "playing"
	_ = m.repos.Room.UpdateStatus(roomID, "playing")
	eng.StartRound()
	return nil
}

func (m *RoomManager) HandleAction(userID uint64, action, tile string) {
	m.mu.RLock()
	roomID := m.userRoom[userID]
	lr := m.rooms[roomID]
	m.mu.RUnlock()
	if lr == nil {
		return
	}
	if action == "next_round" {
		if lr.Engine != nil {
			m.NextRound(roomID)
		}
		return
	}
	if lr.Engine == nil {
		return
	}
	ok, reason := lr.Engine.Action(userID, action, tile)
	if !ok && reason != "" {
		m.sendToUser(userID, map[string]interface{}{"type": "error", "message": reason})
	}
}

func (m *RoomManager) AbortGame(roomID string) {
	m.mu.Lock()
	lr := m.rooms[roomID]
	m.mu.Unlock()
	if lr != nil && lr.Engine != nil {
		lr.Engine.Reset()
		lr.Status = "waiting"
	}
	_ = m.repos.Room.UpdateStatus(roomID, "waiting")
	m.broadcastRoom(roomID, "game_aborted", nil)
}

func (m *RoomManager) broadcastRoom(roomID, eventType string, payload interface{}) {
	m.mu.RLock()
	lr := m.rooms[roomID]
	if lr == nil {
		m.mu.RUnlock()
		return
	}
	uids := append([]uint64{}, lr.UserIDs...)
	eng := lr.Engine
	m.mu.RUnlock()

	for _, uid := range uids {
		msg := buildWSMessage(eventType, payload)
		if eventType == "sync" && eng != nil {
			snap := eng.SnapshotFor(uid)
			msg = map[string]interface{}{"type": "sync", "snapshot": snap}
		}
		m.sendToUser(uid, msg)
	}
}

func buildWSMessage(eventType string, payload interface{}) map[string]interface{} {
	if payload == nil {
		return map[string]interface{}{"type": eventType}
	}
	if mp, ok := payload.(map[string]interface{}); ok {
		out := map[string]interface{}{"type": eventType}
		for k, v := range mp {
			out[k] = v
		}
		return out
	}
	b, _ := json.Marshal(payload)
	out := map[string]interface{}{"type": eventType}
	_ = json.Unmarshal(b, &out)
	out["type"] = eventType
	return out
}

func (m *RoomManager) sendSync(userID uint64, roomID string) {
	m.mu.RLock()
	lr := m.rooms[roomID]
	m.mu.RUnlock()
	if lr == nil || lr.Engine == nil {
		return
	}
	snap := lr.Engine.SnapshotFor(userID)
	m.sendToUser(userID, map[string]interface{}{"type": "sync", "snapshot": snap})
}

func (m *RoomManager) sendToUser(userID uint64, msg interface{}) {
	m.mu.RLock()
	sender := m.userConn[userID]
	m.mu.RUnlock()
	if sender != nil {
		sender.Send(msg)
	}
}

func (m *RoomManager) NextRound(roomID string) {
	m.mu.RLock()
	lr := m.rooms[roomID]
	m.mu.RUnlock()
	if lr != nil && lr.Engine != nil {
		lr.Engine.StartRound()
	}
}

func (m *RoomManager) SaveSettleRecord(roomID string, round int, payload game.SettlePayload, logJSON string) {
	rec := &model.GameRecord{
		RoomID: roomID, Round: round, RuleID: "gd_tuidaohu_v1",
		TotalFan: payload.TotalFan, ActionLog: logJSON,
	}
	b, _ := json.Marshal(payload)
	rec.SettleJSON = string(b)
	_ = m.repos.Record.Save(rec)
}

func (m *RoomManager) FillBots(ctx context.Context, room *model.Room, players []model.RoomPlayer) ([]model.RoomPlayer, error) {
	out := append([]model.RoomPlayer{}, players...)
	for len(out) < room.MaxPlayers {
		n := len(out)
		bp := model.RoomPlayer{
			RoomID: room.RoomID, UserID: uint64(900000 + n), Seat: n,
			Ready: true, IsBot: true, NickName: fmt.Sprintf("电脑%d", n),
		}
		if err := m.repos.Room.AddPlayer(&bp); err != nil {
			return out, err
		}
		out = append(out, bp)
	}
	return out, nil
}
