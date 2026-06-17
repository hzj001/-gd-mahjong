package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"gdMahjong/server/internal/config"
	"gdMahjong/server/internal/model"

	"github.com/redis/go-redis/v9"
)

const (
	keySession   = "session:%s"
	keyRoom      = "room:%s"
	keyMatchQueue = "match:queue"
	keyUserRoom  = "user:room:%d"
	roomTTL      = 24 * time.Hour
	sessionTTL   = 7 * 24 * time.Hour
)

type RedisCache struct {
	rdb *redis.Client
}

func NewRedis(cfg config.RedisConfig) (*RedisCache, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
	})
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	return &RedisCache{rdb: rdb}, nil
}

func (c *RedisCache) Close() error { return c.rdb.Close() }

func (c *RedisCache) SetSession(ctx context.Context, token string, userID uint64) error {
	return c.rdb.Set(ctx, fmt.Sprintf(keySession, token), userID, sessionTTL).Err()
}

func (c *RedisCache) GetSessionUserID(ctx context.Context, token string) (uint64, error) {
	val, err := c.rdb.Get(ctx, fmt.Sprintf(keySession, token)).Uint64()
	if err == redis.Nil {
		return 0, nil
	}
	return val, err
}

func (c *RedisCache) DelSession(ctx context.Context, token string) error {
	return c.rdb.Del(ctx, fmt.Sprintf(keySession, token)).Err()
}

func (c *RedisCache) CacheRoom(ctx context.Context, room model.RoomDTO) error {
	b, err := json.Marshal(room)
	if err != nil {
		return err
	}
	pipe := c.rdb.Pipeline()
	pipe.Set(ctx, fmt.Sprintf(keyRoom, room.RoomID), b, roomTTL)
	for _, p := range room.Players {
		if p.IsHuman {
			pipe.Set(ctx, fmt.Sprintf(keyUserRoom, p.UserID), room.RoomID, roomTTL)
		}
	}
	_, err = pipe.Exec(ctx)
	return err
}

func (c *RedisCache) GetRoom(ctx context.Context, roomID string) (*model.RoomDTO, error) {
	b, err := c.rdb.Get(ctx, fmt.Sprintf(keyRoom, roomID)).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var room model.RoomDTO
	if err := json.Unmarshal(b, &room); err != nil {
		return nil, err
	}
	return &room, nil
}

func (c *RedisCache) DelRoom(ctx context.Context, roomID string) error {
	return c.rdb.Del(ctx, fmt.Sprintf(keyRoom, roomID)).Err()
}

func (c *RedisCache) GetUserRoomID(ctx context.Context, userID uint64) (string, error) {
	val, err := c.rdb.Get(ctx, fmt.Sprintf(keyUserRoom, userID)).Result()
	if err == redis.Nil {
		return "", nil
	}
	return val, err
}

func (c *RedisCache) SetUserRoom(ctx context.Context, userID uint64, roomID string) error {
	return c.rdb.Set(ctx, fmt.Sprintf(keyUserRoom, userID), roomID, roomTTL).Err()
}

func (c *RedisCache) DelUserRoom(ctx context.Context, userID uint64) error {
	return c.rdb.Del(ctx, fmt.Sprintf(keyUserRoom, userID)).Err()
}

func (c *RedisCache) EnqueueMatch(ctx context.Context, userID uint64) error {
	return c.rdb.LPush(ctx, keyMatchQueue, userID).Err()
}

func (c *RedisCache) DequeueMatch(ctx context.Context) (uint64, error) {
	val, err := c.rdb.RPop(ctx, keyMatchQueue).Uint64()
	if err == redis.Nil {
		return 0, nil
	}
	return val, err
}

func (c *RedisCache) MatchQueueLen(ctx context.Context) (int64, error) {
	return c.rdb.LLen(ctx, keyMatchQueue).Result()
}
