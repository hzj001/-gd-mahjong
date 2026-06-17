package repository

import (
	"errors"

	"gdMahjong/server/internal/model"

	"gorm.io/gorm"
)

type StatsRepo struct{ db *gorm.DB }

func (r *StatsRepo) Ensure(userID uint64) {
	var s model.UserStats
	err := r.db.First(&s, userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		_ = r.db.Create(&model.UserStats{UserID: userID}).Error
	}
}

func (r *StatsRepo) Get(userID uint64) (*model.UserStats, error) {
	var s model.UserStats
	err := r.db.First(&s, userID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &s, err
}

func (r *StatsRepo) Save(s *model.UserStats) error {
	return r.db.Save(s).Error
}

func (r *RecordRepo) ListByUser(userID uint64, limit int) ([]model.GameRecord, error) {
	var list []model.GameRecord
	err := r.db.Where("winner_id = ?", userID).Order("id desc").Limit(limit).Find(&list).Error
	return list, err
}
