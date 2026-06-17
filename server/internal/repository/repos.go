package repository

import (
	"errors"
	"fmt"
	"math/rand"
	"time"

	"gdMahjong/server/internal/model"

	"gorm.io/gorm"
)

type Repositories struct {
	User   *UserRepo
	Room   *RoomRepo
	Record *RecordRepo
	Stats  *StatsRepo
}

func NewRepositories(db *gorm.DB) *Repositories {
	return &Repositories{
		User:   &UserRepo{db: db},
		Room:   &RoomRepo{db: db},
		Record: &RecordRepo{db: db},
		Stats:  &StatsRepo{db: db},
	}
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.User{},
		&model.Room{},
		&model.RoomPlayer{},
		&model.GameRecord{},
		&model.UserStats{},
	)
}

type UserRepo struct{ db *gorm.DB }

func (r *UserRepo) FindByOpenID(openID string) (*model.User, error) {
	var u model.User
	err := r.db.Where("open_id = ?", openID).First(&u).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &u, err
}

func (r *UserRepo) FindByID(id uint64) (*model.User, error) {
	var u model.User
	err := r.db.First(&u, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &u, err
}

func (r *UserRepo) Create(u *model.User) error {
	return r.db.Create(u).Error
}

func (r *UserRepo) Save(u *model.User) error {
	return r.db.Save(u).Error
}

func (r *UserRepo) TopRank(limit int) ([]model.User, error) {
	var list []model.User
	err := r.db.Order("rank_score desc").Limit(limit).Find(&list).Error
	return list, err
}

type RoomRepo struct{ db *gorm.DB }

func (r *RoomRepo) Create(room *model.Room, players []model.RoomPlayer) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(room).Error; err != nil {
			return err
		}
		for i := range players {
			players[i].RoomID = room.RoomID
			if err := tx.Create(&players[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *RoomRepo) FindByRoomID(roomID string) (*model.Room, error) {
	var room model.Room
	err := r.db.Where("room_id = ?", roomID).First(&room).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &room, err
}

func (r *RoomRepo) ListPlayers(roomID string) ([]model.RoomPlayer, error) {
	var list []model.RoomPlayer
	err := r.db.Where("room_id = ?", roomID).Order("seat asc").Find(&list).Error
	return list, err
}

func (r *RoomRepo) UpdateStatus(roomID, status string) error {
	return r.db.Model(&model.Room{}).Where("room_id = ?", roomID).Update("status", status).Error
}

func (r *RoomRepo) SetPlayerReady(roomID string, userID uint64, ready bool) error {
	return r.db.Model(&model.RoomPlayer{}).
		Where("room_id = ? AND user_id = ?", roomID, userID).
		Update("ready", ready).Error
}

func (r *RoomRepo) AddPlayer(p *model.RoomPlayer) error {
	return r.db.Create(p).Error
}

func (r *RoomRepo) RemovePlayer(roomID string, userID uint64) error {
	return r.db.Where("room_id = ? AND user_id = ?", roomID, userID).Delete(&model.RoomPlayer{}).Error
}

func (r *RoomRepo) CountPlayers(roomID string) (int64, error) {
	var n int64
	err := r.db.Model(&model.RoomPlayer{}).Where("room_id = ?", roomID).Count(&n).Error
	return n, err
}

func (r *RoomRepo) FindRoomByUserID(userID uint64) (string, error) {
	var p model.RoomPlayer
	err := r.db.Where("user_id = ?", userID).Order("id desc").First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	return p.RoomID, err
}

func (r *RoomRepo) GenRoomID() string {
	rnd := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("R%d", 100000+rnd.Intn(899999))
}

type RecordRepo struct{ db *gorm.DB }

func (r *RecordRepo) Save(rec *model.GameRecord) error {
	return r.db.Create(rec).Error
}

func (r *RecordRepo) ListByRoom(roomID string, limit int) ([]model.GameRecord, error) {
	var list []model.GameRecord
	err := r.db.Where("room_id = ?", roomID).Order("id desc").Limit(limit).Find(&list).Error
	return list, err
}

func ToRoomDTO(room *model.Room, players []model.RoomPlayer) model.RoomDTO {
	dto := model.RoomDTO{
		RoomID:     room.RoomID,
		RuleID:     room.RuleID,
		BaseScore:  room.BaseScore,
		OwnerID:    room.OwnerID,
		MaxPlayers: room.MaxPlayers,
		Status:     room.Status,
		Players:    make([]model.RoomPlayerDTO, 0, len(players)),
	}
	for _, p := range players {
		dto.Players = append(dto.Players, model.RoomPlayerDTO{
			ID:       p.UserID,
			UserID:   p.UserID,
			NickName: p.NickName,
			Ready:    p.Ready,
			IsHuman:  !p.IsBot,
			Seat:     p.Seat,
		})
	}
	return dto
}

func ToUserProfile(u *model.User) model.UserProfileDTO {
	return model.UserProfileDTO{
		ID:        u.ID,
		NickName:  u.NickName,
		AvatarURL: u.AvatarURL,
		Coin:      u.Coin,
		Rank:      u.RankTier,
		RankScore: u.RankScore,
		Wins:      u.Wins,
		Losses:    u.Losses,
	}
}
