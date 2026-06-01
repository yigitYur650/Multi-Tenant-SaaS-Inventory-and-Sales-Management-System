package repository

import (
	"context"
	"time"
)

// DLQItem represents a failed synchronization item stored in the Dead Letter Queue.
type DLQItem struct {
	ID            int         `json:"id"`
	Payload       interface{} `json:"payload"`
	ErrorMessage  string      `json:"error_message"`
	RetryCount    int         `json:"retry_count"`
	CreatedAt     time.Time   `json:"created_at"`
	CorrelationID string      `json:"correlation_id"`
}

// PendingRetry holds minimal details needed to retry a batch from DLQ.
type PendingRetry struct {
	ID      int
	Payload []byte
}

// SyncRepository abstracts database write operations and DLQ management.
type SyncRepository interface {
	BulkInsertSalesAndMovements(ctx context.Context, sales []interface{}, movements []interface{}, stockUpdates []interface{}) error
	SaveToDLQ(ctx context.Context, payload interface{}, errMsg string) error
	GetDLQItems(ctx context.Context) ([]DLQItem, error)
	GetDLQPayload(ctx context.Context, id string) ([]byte, error)
	DeleteDLQItem(ctx context.Context, id string) error
	GetPendingRetries(ctx context.Context, limit int, maxRetries int) ([]PendingRetry, error)
	IncrementRetryCount(ctx context.Context, id int) error
	GetDLQCount(ctx context.Context) (int, error)
	GetActiveConnections() int
}
