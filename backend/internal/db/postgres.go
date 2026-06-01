package db

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ContextKey string
const CorrelationIDKey ContextKey = "correlation_id"

// LogJSON prints a structured log in JSON format, capturing the correlation ID from context.
func LogJSON(ctx context.Context, level, msg string, extra map[string]interface{}) {
	logMap := map[string]interface{}{
		"time":    time.Now().Format(time.RFC3339),
		"level":   level,
		"message": msg,
	}
	if correlationID, ok := ctx.Value(CorrelationIDKey).(string); ok {
		logMap["correlation_id"] = correlationID
	}
	for k, v := range extra {
		logMap[k] = v
	}
	bytes, _ := json.Marshal(logMap)
	fmt.Println(string(bytes))
}

// NewPostgresPool parses configuration and constructs a connection pool with size caps.
func NewPostgresPool() (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		return nil, err
	}

	// Safe connection caps to stay within Supabase limits
	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnIdleTime = 5 * time.Minute

	return pgxpool.NewWithConfig(context.Background(), config)
}
