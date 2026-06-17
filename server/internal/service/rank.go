package service

import (
	"context"
	"encoding/json"

	"gdMahjong/server/internal/game"
	"gdMahjong/server/internal/model"
	"gdMahjong/server/internal/repository"
)

// RankService 战绩与段位持久化
type RankService struct {
	repos *repository.Repositories
}

func NewRankService(repos *repository.Repositories) *RankService {
	return &RankService{repos: repos}
}

var rankTiers = []struct {
	min  int
	name string
}{
	{0, "青铜III"},
	{100, "青铜II"},
	{200, "青铜I"},
	{350, "白银III"},
	{500, "白银II"},
	{650, "白银I"},
	{850, "黄金III"},
	{1100, "黄金II"},
	{1400, "黄金I"},
	{1800, "铂金"},
	{2300, "钻石"},
	{3000, "大师"},
}

func TierFromScore(score int) string {
	tier := rankTiers[0].name
	for _, t := range rankTiers {
		if score >= t.min {
			tier = t.name
		}
	}
	return tier
}

type SettleContext struct {
	RoomID string
	Round  int
	RuleID string
}

// PersistSettle 保存对局记录并更新真人玩家段位/金币
func (s *RankService) PersistSettle(ctx context.Context, sc SettleContext, payload game.SettlePayload, players []*game.PlayerState) error {
	winnerUserID := uint64(0)
	if payload.Winner >= 0 && payload.Winner < len(players) {
		winnerUserID = players[payload.Winner].UserID
	}

	settleJSON, _ := json.Marshal(payload)
	rec := &model.GameRecord{
		RoomID:     sc.RoomID,
		Round:      sc.Round,
		RuleID:     sc.RuleID,
		WinnerID:   winnerUserID,
		TotalFan:   payload.TotalFan,
		SettleJSON: string(settleJSON),
	}
	if err := s.repos.Record.Save(rec); err != nil {
		return err
	}

	for _, p := range players {
		if p.IsBot || p.UserID >= 900000 {
			continue
		}
		u, err := s.repos.User.FindByID(p.UserID)
		if err != nil || u == nil {
			continue
		}
		isWinner := p.Seat == payload.Winner
		s.repos.Stats.Ensure(p.UserID)

		if isWinner {
			u.Wins++
			gain := int64(payload.Score * 100)
			u.Coin += gain
			u.RankScore += payload.TotalFan * 10
			if payload.TotalFan >= 7 {
				u.RankScore += 5
			}
		} else {
			u.Losses++
			loss := int64(payload.Score * 30)
			if u.Coin > loss {
				u.Coin -= loss
			}
			if u.RankScore > 3 {
				u.RankScore -= 3
			}
		}
		u.RankTier = TierFromScore(u.RankScore)
		_ = s.repos.User.Save(u)

		stats, _ := s.repos.Stats.Get(p.UserID)
		if stats != nil {
			stats.TotalGames++
			if isWinner {
				stats.WinCount++
			}
			if payload.TotalFan > stats.MaxFan {
				stats.MaxFan = payload.TotalFan
			}
			_ = s.repos.Stats.Save(stats)
		}
	}
	return nil
}
