package repository

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type redisIdempotencyRepository struct {
	client *redis.Client
}

// NewRedisIdempotencyRepository creates an IdempotencyRepository implementation using redis.Client.
func NewRedisIdempotencyRepository(client *redis.Client) IdempotencyRepository {
	return &redisIdempotencyRepository{client: client}
}

func (r *redisIdempotencyRepository) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error) {
	return r.client.SetNX(ctx, key, value, expiration).Result()
}
