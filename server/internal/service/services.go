package service

import (
	"context"
	"errors"

	"gdMahjong/server/internal/auth"
	"gdMahjong/server/internal/cache"
	"gdMahjong/server/internal/model"
	"gdMahjong/server/internal/repository"
)

type AuthService struct {
	repos  *repository.Repositories
	cache  *cache.RedisCache
	jwt    *auth.JWTService
	wechat *auth.WeChatAuth
}

func NewAuthService(repos *repository.Repositories, c *cache.RedisCache, jwt *auth.JWTService, wx *auth.WeChatAuth) *AuthService {
	return &AuthService{repos: repos, cache: c, jwt: jwt, wechat: wx}
}

type LoginResult struct {
	Token string               `json:"token"`
	User  model.UserProfileDTO `json:"user"`
}

func (s *AuthService) WxLogin(ctx context.Context, code, nickName, avatarURL string) (*LoginResult, error) {
	sess, err := s.wechat.Code2Session(code)
	if err != nil {
		return nil, err
	}
	u, err := s.repos.User.FindByOpenID(sess.OpenID)
	if err != nil {
		return nil, err
	}
	if u == nil {
		u = &model.User{
			OpenID:   sess.OpenID,
			NickName: "玩家",
			Coin:     10000,
			RankTier: "青铜III",
		}
		if nickName != "" {
			u.NickName = nickName
		}
		if avatarURL != "" {
			u.AvatarURL = avatarURL
		}
		if err := s.repos.User.Create(u); err != nil {
			return nil, err
		}
		s.repos.Stats.Ensure(u.ID)
	} else {
		updated := false
		if nickName != "" && u.NickName != nickName {
			u.NickName = nickName
			updated = true
		}
		if avatarURL != "" && u.AvatarURL != avatarURL {
			u.AvatarURL = avatarURL
			updated = true
		}
		if updated {
			_ = s.repos.User.Save(u)
		}
	}
	token, err := s.jwt.Sign(u.ID)
	if err != nil {
		return nil, err
	}
	_ = s.cache.SetSession(ctx, token, u.ID)
	return &LoginResult{Token: token, User: repository.ToUserProfile(u)}, nil
}

func (s *AuthService) UserStats(userID uint64) (*model.UserStatsDTO, error) {
	u, err := s.repos.User.FindByID(userID)
	if err != nil || u == nil {
		return nil, errors.New("user not found")
	}
	stats, _ := s.repos.Stats.Get(userID)
	dto := &model.UserStatsDTO{
		UserID: userID, Rank: u.RankTier, RankScore: u.RankScore, Coin: u.Coin,
	}
	if stats != nil {
		dto.TotalGames = stats.TotalGames
		dto.WinCount = stats.WinCount
		dto.MaxFan = stats.MaxFan
	}
	return dto, nil
}

func (s *AuthService) Profile(userID uint64) (*model.UserProfileDTO, error) {
	u, err := s.repos.User.FindByID(userID)
	if err != nil || u == nil {
		return nil, errors.New("user not found")
	}
	p := repository.ToUserProfile(u)
	return &p, nil
}

type RoomService struct {
	repos *repository.Repositories
	cache *cache.RedisCache
	rm    *RoomManager
}

func NewRoomService(repos *repository.Repositories, c *cache.RedisCache, rm *RoomManager) *RoomService {
	return &RoomService{repos: repos, cache: c, rm: rm}
}

func (s *RoomService) Create(ctx context.Context, userID uint64, ruleID string, baseScore int) (*model.RoomDTO, error) {
	if ruleID == "" {
		ruleID = "gd_tuidaohu_v1"
	}
	if baseScore <= 0 {
		baseScore = 1
	}
	u, err := s.repos.User.FindByID(userID)
	if err != nil || u == nil {
		return nil, errors.New("user not found")
	}
	roomID := s.repos.Room.GenRoomID()
	room := &model.Room{
		RoomID: roomID, OwnerID: userID, RuleID: ruleID,
		BaseScore: baseScore, Status: "waiting", MaxPlayers: 4,
	}
	players := []model.RoomPlayer{{
		RoomID: roomID, UserID: userID, Seat: 0, NickName: u.NickName,
	}}
	if err := s.repos.Room.Create(room, players); err != nil {
		return nil, err
	}
	dto := repository.ToRoomDTO(room, players)
	_ = s.cache.CacheRoom(ctx, dto)
	_ = s.cache.SetUserRoom(ctx, userID, roomID)
	s.rm.RegisterLiveRoom(roomID, &LiveRoom{
		RoomID: roomID, UserIDs: []uint64{userID}, Status: "waiting",
		BaseScore: baseScore, RuleID: ruleID,
	})
	// 确保用户->房间映射
	_ = s.cache.CacheRoom(ctx, dto)
	return &dto, nil
}

func (s *RoomService) Join(ctx context.Context, userID uint64, roomID string) (*model.RoomDTO, error) {
	room, err := s.repos.Room.FindByRoomID(roomID)
	if err != nil || room == nil {
		return nil, errors.New("room not found")
	}
	if room.Status == "playing" {
		return nil, errors.New("room is playing")
	}
	players, _ := s.repos.Room.ListPlayers(roomID)
	for _, p := range players {
		if p.UserID == userID {
			dto := repository.ToRoomDTO(room, players)
			return &dto, nil
		}
	}
	cnt, _ := s.repos.Room.CountPlayers(roomID)
	if int(cnt) >= room.MaxPlayers {
		return nil, errors.New("room full")
	}
	u, _ := s.repos.User.FindByID(userID)
	nick := "玩家"
	if u != nil {
		nick = u.NickName
	}
	np := &model.RoomPlayer{
		RoomID: roomID, UserID: userID, Seat: int(cnt), NickName: nick,
	}
	if err := s.repos.Room.AddPlayer(np); err != nil {
		return nil, err
	}
	players = append(players, *np)
	dto := repository.ToRoomDTO(room, players)
	_ = s.cache.CacheRoom(ctx, dto)
	_ = s.cache.SetUserRoom(ctx, userID, roomID)
	uids := make([]uint64, 0, len(players))
	for _, p := range players {
		if !p.IsBot {
			uids = append(uids, p.UserID)
		}
	}
	s.rm.RegisterLiveRoom(roomID, &LiveRoom{
		RoomID: roomID, UserIDs: uids, Status: room.Status,
		BaseScore: room.BaseScore, RuleID: room.RuleID,
	})
	return &dto, nil
}

func (s *RoomService) Info(ctx context.Context, roomID string) (*model.RoomDTO, error) {
	if cached, _ := s.cache.GetRoom(ctx, roomID); cached != nil {
		return cached, nil
	}
	room, err := s.repos.Room.FindByRoomID(roomID)
	if err != nil || room == nil {
		return nil, errors.New("room not found")
	}
	players, _ := s.repos.Room.ListPlayers(roomID)
	dto := repository.ToRoomDTO(room, players)
	_ = s.cache.CacheRoom(ctx, dto)
	return &dto, nil
}

func (s *RoomService) Ready(ctx context.Context, userID uint64, ready bool) (*model.RoomDTO, error) {
	roomID, err := s.resolveRoomID(ctx, userID)
	if err != nil || roomID == "" {
		return nil, errors.New("not in room")
	}
	_ = s.repos.Room.SetPlayerReady(roomID, userID, ready)
	return s.Info(ctx, roomID)
}

func (s *RoomService) resolveRoomID(ctx context.Context, userID uint64) (string, error) {
	roomID, _ := s.cache.GetUserRoomID(ctx, userID)
	if roomID != "" {
		return roomID, nil
	}
	return s.repos.Room.FindRoomByUserID(userID)
}

func (s *RoomService) QuickMatch(ctx context.Context, userID uint64) (*model.RoomDTO, error) {
	dto, err := s.Create(ctx, userID, "gd_tuidaohu_v1", 1)
	if err != nil {
		return nil, err
	}
	room, _ := s.repos.Room.FindByRoomID(dto.RoomID)
	players, _ := s.repos.Room.ListPlayers(dto.RoomID)
	players, _ = s.rm.FillBots(ctx, room, players)
	for i := range players {
		if players[i].UserID == userID {
			players[i].Ready = true
			_ = s.repos.Room.SetPlayerReady(dto.RoomID, userID, true)
		}
	}
	roomDTO := repository.ToRoomDTO(room, players)
	_ = s.cache.CacheRoom(ctx, roomDTO)
	uids := []uint64{userID}
	s.rm.RegisterLiveRoom(roomDTO.RoomID, &LiveRoom{
		RoomID: roomDTO.RoomID, UserIDs: uids, Status: "waiting",
		BaseScore: room.BaseScore, RuleID: room.RuleID,
	})
	return &roomDTO, nil
}

func (s *RoomService) Leave(ctx context.Context, userID uint64, abort bool) error {
	roomID, err := s.resolveRoomID(ctx, userID)
	if err != nil || roomID == "" {
		return nil
	}
	if abort {
		s.rm.AbortGame(roomID)
		return nil
	}
	_ = s.repos.Room.RemovePlayer(roomID, userID)
	_ = s.cache.DelUserRoom(ctx, userID)
	_ = s.cache.DelRoom(ctx, roomID)
	return nil
}

func (s *RoomService) Start(ctx context.Context, userID uint64) error {
	roomID, err := s.resolveRoomID(ctx, userID)
	if err != nil || roomID == "" {
		return errors.New("not in room")
	}
	room, err := s.repos.Room.FindByRoomID(roomID)
	if err != nil || room == nil {
		return errors.New("room not found")
	}
	players, _ := s.repos.Room.ListPlayers(roomID)
	if len(players) < 4 {
		players, _ = s.rm.FillBots(ctx, room, players)
	}
	uids := make([]uint64, 0, len(players))
	for _, p := range players {
		if !p.IsBot {
			uids = append(uids, p.UserID)
		}
	}
	s.rm.RegisterLiveRoom(roomID, &LiveRoom{
		RoomID: roomID, UserIDs: uids, Status: room.Status,
		BaseScore: room.BaseScore, RuleID: room.RuleID,
	})
	return s.rm.StartGame(roomID)
}

func (s *RoomService) RankList(limit int) ([]model.UserProfileDTO, error) {
	if limit <= 0 {
		limit = 20
	}
	users, err := s.repos.User.TopRank(limit)
	if err != nil {
		return nil, err
	}
	out := make([]model.UserProfileDTO, len(users))
	for i, u := range users {
		out[i] = repository.ToUserProfile(&u)
	}
	return out, nil
}

func (s *RoomService) GameRecords(roomID string, limit int) ([]model.GameRecord, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repos.Record.ListByRoom(roomID, limit)
}
