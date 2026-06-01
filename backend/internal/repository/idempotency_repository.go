package repository

import (
	"context"
	"time"
)

// IdempotencyRepository defines actions for validating and writing idempotency keys.
type IdempotencyRepository interface {
	SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) (bool, error)
}
