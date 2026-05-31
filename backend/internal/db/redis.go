package db

import (
	"os"
	"strings"

	"github.com/redis/go-redis/v9"
)

func NewRedisClient() *redis.Client {
	addr := os.Getenv("REDIS_URL")
	// redis://host:port formatını host:port'a çevir
	addr = strings.TrimPrefix(addr, "redis://")
	if addr == "" {
		addr = "localhost:6379"
	}
	return redis.NewClient(&redis.Options{
		Addr: addr,
	})
}
