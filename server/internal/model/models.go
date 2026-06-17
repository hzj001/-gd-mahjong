package model

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID        uint64         `gorm:"primaryKey" json:"id"`
	OpenID    string         `gorm:"size:64;uniqueIndex;not null" json:"-"`
	NickName  string         `gorm:"size:64" json:"nickName"`
	AvatarURL string         `gorm:"size:512" json:"avatarUrl"`
	Coin      int64          `gorm:"default:10000" json:"coin"`
	RankTier  string         `gorm:"size:32;default:青铜III" json:"rank"`
	RankScore int            `gorm:"default:0" json:"rankScore"`
	Wins      int            `gorm:"default:0" json:"wins"`
	Losses    int            `gorm:"default:0" json:"losses"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (User) TableName() string { return "users" }

type Room struct {
	ID        uint64         `gorm:"primaryKey" json:"-"`
	RoomID    string         `gorm:"size:16;uniqueIndex;not null" json:"roomId"`
	OwnerID   uint64         `gorm:"index" json:"ownerId"`
	RuleID    string         `gorm:"size:32;default:gd_tuidaohu_v1" json:"ruleId"`
	BaseScore int            `gorm:"default:1" json:"baseScore"`
	Status    string         `gorm:"size:16;default:waiting" json:"status"` // waiting | playing | closed
	MaxPlayers int           `gorm:"default:4" json:"maxPlayers"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (Room) TableName() string { return "rooms" }

type RoomPlayer struct {
	ID       uint64 `gorm:"primaryKey" json:"-"`
	RoomID   string `gorm:"size:16;index;not null" json:"-"`
	UserID   uint64 `gorm:"index" json:"userId"`
	Seat     int    `gorm:"default:0" json:"seat"`
	Ready    bool   `gorm:"default:false" json:"ready"`
	IsBot    bool   `gorm:"default:false" json:"isBot"`
	NickName string `gorm:"size:64" json:"nickName"`
	Score    int    `gorm:"default:0" json:"score"`
}

func (RoomPlayer) TableName() string { return "room_players" }

type GameRecord struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	RoomID    string    `gorm:"size:16;index" json:"roomId"`
	Round     int       `json:"round"`
	RuleID    string    `gorm:"size:32" json:"ruleId"`
	WinnerID  uint64    `json:"winnerId"`
	TotalFan  int       `json:"totalFan"`
	SettleJSON string   `gorm:"type:text" json:"settleJson"`
	ActionLog string   `gorm:"type:longtext" json:"actionLog"`
	CreatedAt time.Time `json:"createdAt"`
}

func (GameRecord) TableName() string { return "game_records" }

type UserStats struct {
	UserID    uint64 `gorm:"primaryKey" json:"userId"`
	TotalGames int   `gorm:"default:0" json:"totalGames"`
	WinCount   int   `gorm:"default:0" json:"winCount"`
	MaxFan     int   `gorm:"default:0" json:"maxFan"`
}

func (UserStats) TableName() string { return "user_stats" }

// API DTOs

type RoomDTO struct {
	RoomID     string          `json:"roomId"`
	RuleID     string          `json:"ruleId"`
	BaseScore  int             `json:"baseScore"`
	OwnerID    uint64          `json:"ownerId"`
	MaxPlayers int             `json:"maxPlayers"`
	Status     string          `json:"status"`
	Players    []RoomPlayerDTO `json:"players"`
}

type RoomPlayerDTO struct {
	ID       uint64 `json:"id"`
	UserID   uint64 `json:"userId"`
	NickName string `json:"nickName"`
	Ready    bool   `json:"ready"`
	IsHuman  bool   `json:"isHuman"`
	Seat     int    `json:"seat"`
}

type UserProfileDTO struct {
	ID        uint64 `json:"id"`
	NickName  string `json:"nickName"`
	AvatarURL string `json:"avatarUrl"`
	Coin      int64  `json:"coin"`
	Rank      string `json:"rank"`
	RankScore int    `json:"rankScore"`
	Wins      int    `json:"wins"`
	Losses    int    `json:"losses"`
}

type UserStatsDTO struct {
	UserID     uint64 `json:"userId"`
	TotalGames int    `json:"totalGames"`
	WinCount   int    `json:"winCount"`
	MaxFan     int    `json:"maxFan"`
	Rank       string `json:"rank"`
	RankScore  int    `json:"rankScore"`
	Coin       int64  `json:"coin"`
}
