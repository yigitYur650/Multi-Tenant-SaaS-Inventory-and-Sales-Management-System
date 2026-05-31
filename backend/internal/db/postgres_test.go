package db

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func TestBulkInsertSalesAndMovementsFallback(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set. Skipping integration test.")
	}

	pool, err := NewPostgresPool()
	if err != nil {
		t.Fatalf("Failed to initialize connection pool: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	// 1. Create a mock shop for foreign key constraints
	shopID := uuid.New().String()
	_, err = pool.Exec(ctx, "INSERT INTO shops (id, name, type) VALUES ($1, $2, $3)", shopID, "Go Fallback Test Shop", "Retail")
	if err != nil {
		t.Fatalf("Failed to insert mock shop: %v", err)
	}
	defer func() {
		_, _ = pool.Exec(ctx, "DELETE FROM shops WHERE id = $1", shopID)
	}()

	// 2. Prepare sales: 1 valid, 1 invalid (invalid UUID for id)
	validSaleID := uuid.New().String()
	invalidSaleID := "invalid-uuid-value"

	sales := []interface{}{
		map[string]interface{}{
			"id":              validSaleID,
			"shop_id":         shopID,
			"total_amount":    250.00,
			"discount_amount": 10.00,
			"status":          "completed",
			"created_at":      time.Now().Format(time.RFC3339),
			"version":         1,
			"request_id":      uuid.New().String(),
		},
		map[string]interface{}{
			"id":              invalidSaleID,
			"shop_id":         shopID,
			"total_amount":    100.00,
			"discount_amount": 0.00,
			"status":          "completed",
			"created_at":      time.Now().Format(time.RFC3339),
			"version":         1,
			"request_id":      uuid.New().String(),
		},
	}

	// Run the bulk insert
	err = BulkInsertSalesAndMovements(ctx, pool, sales, []interface{}{}, []interface{}{})
	if err != nil {
		t.Fatalf("BulkInsertSalesAndMovements returned an error; expected nil because fallback handles failures: %v", err)
	}

	// 3. Verify valid sale exists
	var count int
	err = pool.QueryRow(ctx, "SELECT count(*) FROM sales WHERE id = $1", validSaleID).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query valid sale: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected valid sale to be inserted, count = %d", count)
	}

	// 4. Verify invalid sale was routed to DLQ (failed_syncs)
	var dlqCount int
	err = pool.QueryRow(ctx, "SELECT count(*) FROM failed_syncs WHERE payload::jsonb->>'id' = $1", invalidSaleID).Scan(&dlqCount)
	if err != nil {
		t.Fatalf("Failed to query failed_syncs table: %v", err)
	}
	if dlqCount != 1 {
		t.Errorf("Expected invalid sale payload to be routed to DLQ (failed_syncs), got %d", dlqCount)
	}

	// Cleanup
	_, _ = pool.Exec(ctx, "DELETE FROM sales WHERE id = $1", validSaleID)
	_, _ = pool.Exec(ctx, "DELETE FROM failed_syncs WHERE payload::jsonb->>'id' = $1", invalidSaleID)
}

func TestTenantRLSLeakage(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set. Skipping RLS isolation tests.")
	}

	pool, err := NewPostgresPool()
	if err != nil {
		t.Fatalf("Failed to initialize connection pool: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	// 1. Create two tenants (Tenant A and Tenant B)
	tenantA := uuid.New().String()
	tenantB := uuid.New().String()

	_, err = pool.Exec(ctx, "INSERT INTO shops (id, name, type) VALUES ($1, $2, $3)", tenantA, "Tenant A", "TypeA")
	if err != nil {
		t.Fatalf("Failed to insert Tenant A: %v", err)
	}
	defer func() { _, _ = pool.Exec(ctx, "DELETE FROM shops WHERE id = $1", tenantA) }()

	_, err = pool.Exec(ctx, "INSERT INTO shops (id, name, type) VALUES ($1, $2, $3)", tenantB, "Tenant B", "TypeB")
	if err != nil {
		t.Fatalf("Failed to insert Tenant B: %v", err)
	}
	defer func() { _, _ = pool.Exec(ctx, "DELETE FROM shops WHERE id = $1", tenantB) }()

	// 2. Create products belonging to Tenant B (bypass RLS by inserting directly as admin/pool)
	prodB := uuid.New().String()
	_, err = pool.Exec(ctx, "INSERT INTO products (id, name, shop_id) VALUES ($1, $2, $3)", prodB, "Tenant B Secret Product", tenantB)
	if err != nil {
		t.Fatalf("Failed to insert Tenant B's product: %v", err)
	}
	defer func() { _, _ = pool.Exec(ctx, "DELETE FROM products WHERE id = $1", prodB) }()

	// Start RLS simulation transaction
	conn, err := pool.Acquire(ctx)
	if err != nil {
		t.Fatalf("Failed to acquire connection: %v", err)
	}
	defer conn.Release()

	tx, err := conn.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		t.Fatalf("Failed to start transaction: %v", err)
	}
	defer tx.Rollback(ctx)

	// Simulate Tenant A Authenticated context using Supabase claims
	claimsJSON := `{"app_metadata": {"shop_id": "` + tenantA + `"}, "user_metadata": {"role": "ADMIN"}}`
	_, err = tx.Exec(ctx, "SELECT set_config('request.jwt.claims', $1, true)", claimsJSON)
	if err != nil {
		t.Fatalf("Failed to mock JWT claims session config: %v", err)
	}

	// A. SELECT TEST: Tenant A must NOT be able to see Tenant B's product
	var count int
	err = tx.QueryRow(ctx, "SELECT count(*) FROM products WHERE id = $1", prodB).Scan(&count)
	if err != nil {
		t.Fatalf("SELECT products query failed: %v", err)
	}
	if count != 0 {
		t.Errorf("RLS LEAKAGE: Tenant A was able to SELECT Tenant B's product! count = %d", count)
	}

	// B. UPDATE TEST: Tenant A must NOT be able to update Tenant B's product
	tag, err := tx.Exec(ctx, "UPDATE products SET name = 'Hacked by Tenant A' WHERE id = $1", prodB)
	if err != nil {
		// PostgreSQL may reject with error or return 0 rows affected. Either is fine.
	}
	if tag.RowsAffected() > 0 {
		t.Errorf("RLS LEAKAGE: Tenant A updated Tenant B's product! Affected rows = %d", tag.RowsAffected())
	}

	// C. DELETE TEST: Tenant A must NOT be able to delete Tenant B's product
	tag, err = tx.Exec(ctx, "DELETE FROM products WHERE id = $1", prodB)
	if err != nil {
		// PostgreSQL may reject with error or return 0 rows affected. Either is fine.
	}
	if tag.RowsAffected() > 0 {
		t.Errorf("RLS LEAKAGE: Tenant A deleted Tenant B's product! Affected rows = %d", tag.RowsAffected())
	}

	// D. INSERT TEST: Tenant A must NOT be able to insert a product for Tenant B
	invalidProd := uuid.New().String()
	_, err = tx.Exec(ctx, "INSERT INTO products (id, name, shop_id) VALUES ($1, $2, $3)", invalidProd, "Cross-Tenant Insert", tenantB)
	if err == nil {
		t.Errorf("RLS LEAKAGE: Tenant A successfully inserted a product belonging to Tenant B!")
		_, _ = tx.Exec(ctx, "DELETE FROM products WHERE id = $1", invalidProd)
	} else {
		t.Logf("Success: Database rejected unauthorized cross-tenant insert as expected: %v", err)
	}
}
