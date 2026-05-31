package db

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type contextKey string
const CorrelationIDKey contextKey = "correlation_id"

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

func NewPostgresPool() (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		return nil, err
	}

	// Supabase ücretsiz paket sınırlarını (genelde 60) zorlamamak için güvenli bir sınır.
	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnIdleTime = 5 * time.Minute

	return pgxpool.NewWithConfig(context.Background(), config)
}

// BulkInsertSalesAndMovements, sales ve stock_movements tablolarına toplu yazma yapar, ayrıca stok delta güncellemelerini işler.
func BulkInsertSalesAndMovements(ctx context.Context, pool *pgxpool.Pool, sales []interface{}, movements []interface{}, stockUpdates []interface{}) error {
	LogJSON(ctx, "INFO", "Executing bulk insert of sales and movements", map[string]interface{}{
		"sales_count":       len(sales),
		"movements_count":   len(movements),
		"stock_updates_cnt": len(stockUpdates),
	})

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Sales Bulk Insert (pgx.CopyFrom)
	// sales slice'ını rows'a çevir
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
			return fmt.Errorf("sales copyfrom error: %v", err)
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
			return fmt.Errorf("movements copyfrom error: %v", err)
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

		// Update the SQL execution to use relative updates:
		// UPDATE products SET stock = stock + $1
		_, err = tx.Exec(ctx, "UPDATE product_variants SET stock_quantity = stock_quantity + $1 WHERE id = $2", deltaVal, variantID)
		if err != nil {
			return fmt.Errorf("relative stock update error (SQLState 23514 check): %v", err)
		}
	}

	return tx.Commit(ctx)
}

// SaveToDLQ, Hatalı paketleri DLQ tablosuna kaydeder.
func SaveToDLQ(ctx context.Context, pool *pgxpool.Pool, payload interface{}, errMsg string) error {
	payloadJSON, _ := json.Marshal(payload)
	correlationID, _ := ctx.Value(CorrelationIDKey).(string)

	LogJSON(ctx, "ERROR", "Saving failed sync batch to DLQ", map[string]interface{}{
		"error_message": errMsg,
	})

	_, err := pool.Exec(ctx, 
		"INSERT INTO failed_syncs (payload, error_message, correlation_id) VALUES ($1, $2, $3)", 
		payloadJSON, errMsg, correlationID,
	)
	return err
}
