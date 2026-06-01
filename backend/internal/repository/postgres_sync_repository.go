package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"multi-tenant-saas-inventory/internal/db"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type postgresSyncRepository struct {
	pool *pgxpool.Pool
}

// NewPostgresSyncRepository creates a new SyncRepository backed by PostgreSQL pgxpool.
func NewPostgresSyncRepository(pool *pgxpool.Pool) SyncRepository {
	return &postgresSyncRepository{pool: pool}
}

func (r *postgresSyncRepository) BulkInsertSalesAndMovements(ctx context.Context, sales []interface{}, movements []interface{}, stockUpdates []interface{}) error {
	db.LogJSON(ctx, "INFO", "Executing bulk insert of sales and movements", map[string]interface{}{
		"sales_count":       len(sales),
		"movements_count":   len(movements),
		"stock_updates_cnt": len(stockUpdates),
	})

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Sales Bulk Insert (pgx.CopyFrom)
	var salesRows [][]interface{}
	for _, s := range sales {
		m := s.(map[string]interface{})
		salesRows = append(salesRows, []interface{}{
			m["id"], m["shop_id"], m["total_amount"], m["discount_amount"], 
			m["status"], m["created_at"], m["version"], m["request_id"],
		})
	}

	if len(salesRows) > 0 {
		_, err = tx.CopyFrom(
			ctx,
			pgx.Identifier{"sales"},
			[]string{"id", "shop_id", "total_amount", "discount_amount", "status", "created_at", "version", "request_id"},
			pgx.CopyFromRows(salesRows),
		)
		if err != nil {
			tx.Rollback(ctx)
			return r.executeFallbackRowByRow(ctx, sales, movements, stockUpdates, fmt.Errorf("sales copyfrom error: %v", err))
		}
	}

	// 2. Stock Movements Bulk Insert
	var moveRows [][]interface{}
	for _, mv := range movements {
		m := mv.(map[string]interface{})
		moveRows = append(moveRows, []interface{}{
			m["id"], m["shop_id"], m["variant_id"], m["quantity"], 
			m["type"], m["reason"], m["created_at"], m["version"], m["request_id"],
		})
	}

	if len(moveRows) > 0 {
		_, err = tx.CopyFrom(
			ctx,
			pgx.Identifier{"stock_movements"},
			[]string{"id", "shop_id", "variant_id", "quantity", "type", "reason", "created_at", "version", "request_id"},
			pgx.CopyFromRows(moveRows),
		)
		if err != nil {
			tx.Rollback(ctx)
			return r.executeFallbackRowByRow(ctx, sales, movements, stockUpdates, fmt.Errorf("movements copyfrom error: %v", err))
		}
	}

	// 3. Relative Stock Delta Updates
	for _, su := range stockUpdates {
		m := su.(map[string]interface{})
		variantID, ok := m["id"].(string)
		if !ok {
			variantID, _ = m["variant_id"].(string)
		}

		deltaVal := 0
		if d, exists := m["delta"]; exists {
			switch val := d.(type) {
			case float64:
				deltaVal = int(val)
			case int:
				deltaVal = val
			case int64:
				deltaVal = int(val)
			}
		}

		_, err = tx.Exec(ctx, "UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2", deltaVal, variantID)
		if err != nil {
			tx.Rollback(ctx)
			return r.executeFallbackRowByRow(ctx, sales, movements, stockUpdates, fmt.Errorf("relative stock update error (SQLState 23514 check): %v", err))
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		return r.executeFallbackRowByRow(ctx, sales, movements, stockUpdates, fmt.Errorf("commit error: %v", err))
	}

	return nil
}

func (r *postgresSyncRepository) executeFallbackRowByRow(ctx context.Context, sales []interface{}, movements []interface{}, stockUpdates []interface{}, originalErr error) error {
	db.LogJSON(ctx, "WARNING", "Bulk insert transaction failed, running row-by-row fallback logic to isolate failures", map[string]interface{}{
		"original_error": originalErr.Error(),
		"sales_count":    len(sales),
		"movements_cnt":  len(movements),
		"stock_upd_cnt":  len(stockUpdates),
	})

	// 1. Sales - Satır bazlı
	for _, s := range sales {
		m := s.(map[string]interface{})
		err := r.insertSaleRow(ctx, m)
		if err != nil {
			db.LogJSON(ctx, "ERROR", "Failed to insert sale row, saving to DLQ", map[string]interface{}{
				"sale_id": m["id"],
				"error":   err.Error(),
			})
			_ = r.SaveToDLQ(ctx, s, fmt.Sprintf("Sale insertion fallback error: %v", err))
		}
	}

	// 2. Movements - Satır bazlı
	for _, mv := range movements {
		m := mv.(map[string]interface{})
		err := r.insertMovementRow(ctx, m)
		if err != nil {
			db.LogJSON(ctx, "ERROR", "Failed to insert movement row, saving to DLQ", map[string]interface{}{
				"movement_id": m["id"],
				"error":       err.Error(),
			})
			_ = r.SaveToDLQ(ctx, mv, fmt.Sprintf("Movement insertion fallback error: %v", err))
		}
	}

	// 3. Stock updates - Satır bazlı
	for _, su := range stockUpdates {
		m := su.(map[string]interface{})
		err := r.updateStockRow(ctx, m)
		if err != nil {
			db.LogJSON(ctx, "ERROR", "Failed to update stock delta, saving to DLQ", map[string]interface{}{
				"variant_id": m["id"],
				"error":      err.Error(),
			})
			_ = r.SaveToDLQ(ctx, su, fmt.Sprintf("Stock update fallback error: %v", err))
		}
	}

	return nil
}

func (r *postgresSyncRepository) insertSaleRow(ctx context.Context, m map[string]interface{}) error {
	_, err := r.pool.Exec(ctx, 
		`INSERT INTO sales (id, shop_id, total_amount, discount_amount, status, created_at, version, request_id) 
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT (id) DO NOTHING`,
		m["id"], m["shop_id"], m["total_amount"], m["discount_amount"], 
		m["status"], m["created_at"], m["version"], m["request_id"],
	)
	return err
}

func (r *postgresSyncRepository) insertMovementRow(ctx context.Context, m map[string]interface{}) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO stock_movements (id, shop_id, variant_id, quantity, type, reason, created_at, version, request_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (id) DO NOTHING`,
		m["id"], m["shop_id"], m["variant_id"], m["quantity"], 
		m["type"], m["reason"], m["created_at"], m["version"], m["request_id"],
	)
	return err
}

func (r *postgresSyncRepository) updateStockRow(ctx context.Context, m map[string]interface{}) error {
	variantID, ok := m["id"].(string)
	if !ok {
		variantID, _ = m["variant_id"].(string)
	}

	deltaVal := 0
	if d, exists := m["delta"]; exists {
		switch val := d.(type) {
		case float64:
			deltaVal = int(val)
		case int:
			deltaVal = val
		case int64:
			deltaVal = int(val)
		}
	}

	_, err := r.pool.Exec(ctx, "UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2", deltaVal, variantID)
	return err
}

func (r *postgresSyncRepository) SaveToDLQ(ctx context.Context, payload interface{}, errMsg string) error {
	payloadJSON, _ := json.Marshal(payload)
	correlationID, _ := ctx.Value(db.CorrelationIDKey).(string)

	db.LogJSON(ctx, "ERROR", "Saving failed sync batch to DLQ", map[string]interface{}{
		"error_message": errMsg,
	})

	_, err := r.pool.Exec(ctx, 
		"INSERT INTO failed_syncs (payload, error_message, correlation_id) VALUES ($1, $2, $3)", 
		payloadJSON, errMsg, correlationID,
	)
	return err
}

func (r *postgresSyncRepository) GetDLQItems(ctx context.Context) ([]DLQItem, error) {
	rows, err := r.pool.Query(ctx, "SELECT id, payload, error_message, COALESCE(retry_count, 0), created_at, correlation_id FROM failed_syncs ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []DLQItem
	for rows.Next() {
		var item DLQItem
		var payloadJSON []byte
		var correlationID *string
		var errMsg *string
		err := rows.Scan(&item.ID, &payloadJSON, &errMsg, &item.RetryCount, &item.CreatedAt, &correlationID)
		if err != nil {
			return nil, err
		}
		if errMsg != nil {
			item.ErrorMessage = *errMsg
		}
		if correlationID != nil {
			item.CorrelationID = *correlationID
		}
		_ = json.Unmarshal(payloadJSON, &item.Payload)
		items = append(items, item)
	}
	return items, nil
}

func (r *postgresSyncRepository) GetDLQPayload(ctx context.Context, id string) ([]byte, error) {
	var payloadJSON []byte
	err := r.pool.QueryRow(ctx, "SELECT payload FROM failed_syncs WHERE id = $1", id).Scan(&payloadJSON)
	return payloadJSON, err
}

func (r *postgresSyncRepository) DeleteDLQItem(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM failed_syncs WHERE id = $1", id)
	return err
}

func (r *postgresSyncRepository) GetPendingRetries(ctx context.Context, limit int, maxRetries int) ([]PendingRetry, error) {
	rows, err := r.pool.Query(ctx, "SELECT id, payload FROM failed_syncs WHERE retry_count < $1 LIMIT $2", maxRetries, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []PendingRetry
	for rows.Next() {
		var item PendingRetry
		if err := rows.Scan(&item.ID, &item.Payload); err == nil {
			items = append(items, item)
		}
	}
	return items, nil
}

func (r *postgresSyncRepository) IncrementRetryCount(ctx context.Context, id int) error {
	_, err := r.pool.Exec(ctx, "UPDATE failed_syncs SET retry_count = retry_count + 1 WHERE id = $1", id)
	return err
}

func (r *postgresSyncRepository) GetDLQCount(ctx context.Context) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT count(*) FROM failed_syncs").Scan(&count)
	return count, err
}

func (r *postgresSyncRepository) GetActiveConnections() int {
	return int(r.pool.Stat().TotalConns())
}
