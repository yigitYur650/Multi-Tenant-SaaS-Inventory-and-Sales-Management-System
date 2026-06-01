package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"multi-tenant-saas-inventory/internal/db"
	"multi-tenant-saas-inventory/internal/model"
	"multi-tenant-saas-inventory/internal/repository"
)

// SyncService encapsulates the business logic for batch processing, worker pools, and DLQ retries.
type SyncService interface {
	ProcessBatch(ctx context.Context, items []model.SyncItem) (int, error)
	StartWorkers(ctx context.Context, count int)
	StartRetryWorker(ctx context.Context, interval time.Duration)
	GetDLQItems(ctx context.Context) ([]repository.DLQItem, error)
	RetryDLQItem(ctx context.Context, id string) error
	DismissDLQItem(ctx context.Context, id string) error
	GetDLQCount(ctx context.Context) (int, error)
	GetActiveConnections() int
}

type syncServiceImpl struct {
	syncRepo        repository.SyncRepository
	idempotencyRepo repository.IdempotencyRepository
	batchQueue      chan []model.SyncItem
}

// NewSyncService creates a new SyncService instance.
func NewSyncService(syncRepo repository.SyncRepository, idempotencyRepo repository.IdempotencyRepository, queueSize int) SyncService {
	return &syncServiceImpl{
		syncRepo:        syncRepo,
		idempotencyRepo: idempotencyRepo,
		batchQueue:      make(chan []model.SyncItem, queueSize),
	}
}

func (s *syncServiceImpl) ProcessBatch(ctx context.Context, items []model.SyncItem) (int, error) {
	validItems := make([]model.SyncItem, 0, len(items))
	correlationID, _ := ctx.Value(db.CorrelationIDKey).(string)

	for _, item := range items {
		key := "idempotency:" + item.RequestID
		ok, err := s.idempotencyRepo.SetNX(ctx, key, "processing", 24*time.Hour)
		if err == nil && ok {
			if item.CorrelationID == "" {
				item.CorrelationID = correlationID
			}
			validItems = append(validItems, item)
		}
	}

	if len(validItems) == 0 {
		return 0, nil // Already processed
	}

	select {
	case s.batchQueue <- validItems:
		db.LogJSON(ctx, "INFO", "Enqueued batch into worker queue", map[string]interface{}{
			"items_count": len(validItems),
		})
		return len(validItems), nil
	default:
		return 0, fmt.Errorf("server busy")
	}
}

func (s *syncServiceImpl) StartWorkers(ctx context.Context, count int) {
	for i := 0; i < count; i++ {
		go s.worker(i)
	}
}

func (s *syncServiceImpl) worker(id int) {
	for batch := range s.batchQueue {
		var sales []interface{}
		var movements []interface{}
		var stockUpdates []interface{}

		for _, item := range batch {
			if item.Table == "sales" {
				sales = append(sales, item.Payload)
			} else if item.Table == "stock_movements" {
				movements = append(movements, item.Payload)
			} else if item.Table == "product_variants" || item.Table == "stock_updates" {
				stockUpdates = append(stockUpdates, item.Payload)
			}
		}

		if len(sales) > 0 || len(movements) > 0 || len(stockUpdates) > 0 {
			correlationID := ""
			if len(batch) > 0 {
				correlationID = batch[0].CorrelationID
			}
			ctx := context.WithValue(context.Background(), db.CorrelationIDKey, correlationID)

			err := s.syncRepo.BulkInsertSalesAndMovements(ctx, sales, movements, stockUpdates)
			if err != nil {
				// SQLState 23514 is CHECK constraint violation (negative stock). Do not retry in DLQ as it's a validation failure.
				if !strings.Contains(err.Error(), "P0001") && !strings.Contains(err.Error(), "Conflict") && !strings.Contains(err.Error(), "23514") {
					_ = s.syncRepo.SaveToDLQ(ctx, batch, err.Error())
				}
			}
		}
	}
}

func (s *syncServiceImpl) StartRetryWorker(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		for range ticker.C {
			items, err := s.syncRepo.GetPendingRetries(ctx, 10, 5)
			if err != nil {
				continue
			}

			for _, item := range items {
				var batch []model.SyncItem
				if err := json.Unmarshal(item.Payload, &batch); err == nil {
					select {
					case s.batchQueue <- batch:
						_ = s.syncRepo.IncrementRetryCount(ctx, item.ID)
					default:
						// Queue full, try next time
					}
				}
			}
		}
	}()
}

func (s *syncServiceImpl) GetDLQItems(ctx context.Context) ([]repository.DLQItem, error) {
	return s.syncRepo.GetDLQItems(ctx)
}

func (s *syncServiceImpl) RetryDLQItem(ctx context.Context, id string) error {
	payloadJSON, err := s.syncRepo.GetDLQPayload(ctx, id)
	if err != nil {
		return fmt.Errorf("item not found")
	}

	var batch []model.SyncItem
	if err := json.Unmarshal(payloadJSON, &batch); err != nil {
		return fmt.Errorf("invalid payload format")
	}

	select {
	case s.batchQueue <- batch:
		return s.syncRepo.DeleteDLQItem(ctx, id)
	default:
		return fmt.Errorf("server busy")
	}
}

func (s *syncServiceImpl) DismissDLQItem(ctx context.Context, id string) error {
	return s.syncRepo.DeleteDLQItem(ctx, id)
}

func (s *syncServiceImpl) GetDLQCount(ctx context.Context) (int, error) {
	return s.syncRepo.GetDLQCount(ctx)
}

func (s *syncServiceImpl) GetActiveConnections() int {
	return s.syncRepo.GetActiveConnections()
}
