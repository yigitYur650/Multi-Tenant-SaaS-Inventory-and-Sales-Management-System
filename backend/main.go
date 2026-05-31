package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"runtime"
	"strings"
	"time"

	"multi-tenant-saas-inventory/internal/db"
	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type BatchRequest struct {
	Items []SyncItem `json:"items"`
}

type SyncItem struct {
	Table         string                 `json:"table"`
	Action        string                 `json:"action"`
	Payload       map[string]interface{} `json:"payload"`
	RequestID     string                 `json:"request_id"`
	CorrelationID string                 `json:"correlation_id"`
}

// Custom Prometheus Metrikleri
var (
	dbConnectionsGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "erp_db_connections_active",
		Help: "Aktif veritabanı bağlantı sayısı",
	})
	dlqCountGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "erp_dlq_failed_syncs_total",
		Help: "DLQ (failed_syncs) tablosunda bekleyen kayıt sayısı",
	})
)

func main() {
	godotenv.Load()

	// 1. Veritabanı Bağlantıları
	pool, err := db.NewPostgresPool()
	if err != nil {
		log.Fatal("DB Pool Error:", err)
	}
	defer pool.Close()

	redisCli := db.NewRedisClient()

	// 2. Worker Pool & DLQ Retry
	batchQueue := make(chan []SyncItem, 500)
	for i := 0; i < runtime.NumCPU()*2; i++ {
		go worker(i, pool, batchQueue)
	}
	go startRetryWorker(pool, batchQueue)

	// Metrikleri periyodik güncelleme
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		for range ticker.C {
			stats := pool.Stat()
			dbConnectionsGauge.Set(float64(stats.TotalConns()))

			var count int
			_ = pool.QueryRow(context.Background(), "SELECT count(*) FROM failed_syncs").Scan(&count)
			dlqCountGauge.Set(float64(count))
		}
	}()

	// 3. Fiber Framework Setup
	app := fiber.New(fiber.Config{
		AppName: "Textile ERP Batch Ingest API",
	})

	// CORS Middleware
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Correlation-ID",
		AllowMethods: "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
	}))

	// Correlation ID Middleware
	app.Use(func(c *fiber.Ctx) error {
		correlationID := c.Get("X-Correlation-ID")
		if correlationID == "" {
			correlationID = c.Get("x-correlation-id")
		}
		if correlationID == "" {
			correlationID = uuid.NewString()
		}

		c.Set("X-Correlation-ID", correlationID)
		c.Locals("correlation_id", correlationID)

		ctx := context.WithValue(c.UserContext(), db.CorrelationIDKey, correlationID)
		c.SetUserContext(ctx)

		return c.Next()
	})

	// Logger Middleware using structured JSON
	app.Use(logger.New(logger.Config{
		Format: `{"time":"${time}","status":${status},"latency":"${latency}","method":"${method}","path":"${path}","correlation_id":"${respHeader:X-Correlation-ID}"}` + "\n",
		Output: os.Stdout,
	}))

	// Prometheus Middleware Entegrasyonu
	prometheusHandler := fiberprometheus.New("textile-erp-backend")
	
	// Senior Security: /metrics endpoint'ini koruma altına al
	app.Use("/metrics", func(c *fiber.Ctx) error {
		// Basit bir Token kontrolü (Gerçek senaryoda IP kısıtlaması da eklenebilir)
		token := c.Get("X-Metrics-Token")
		expectedToken := os.Getenv("METRICS_TOKEN")
		if expectedToken != "" && token != expectedToken {
			return c.Status(403).JSON(fiber.Map{"error": "Unauthorized metrics access"})
		}
		return c.Next()
	})
	
	prometheusHandler.RegisterAt(app, "/metrics")
	app.Use(prometheusHandler.Middleware)

	// API Endpoints for DLQ (Admin Review Queue)
	app.Get("/api/v1/sync/dlq", func(c *fiber.Ctx) error {
		rows, err := pool.Query(c.UserContext(), "SELECT id, payload, error_message, retry_count, created_at, correlation_id FROM failed_syncs ORDER BY created_at DESC")
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		defer rows.Close()

		type DLQItem struct {
			ID            int         `json:"id"`
			Payload       interface{} `json:"payload"`
			ErrorMessage  string      `json:"error_message"`
			RetryCount    int         `json:"retry_count"`
			CreatedAt     time.Time   `json:"created_at"`
			CorrelationID string      `json:"correlation_id"`
		}

		var items []DLQItem
		for rows.Next() {
			var item DLQItem
			var payloadJSON []byte
			var correlationID *string
			var errMsg *string
			err := rows.Scan(&item.ID, &payloadJSON, &errMsg, &item.RetryCount, &item.CreatedAt, &correlationID)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": err.Error()})
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
		return c.JSON(items)
	})

	app.Post("/api/v1/sync/dlq/:id/retry", func(c *fiber.Ctx) error {
		id := c.Params("id")
		var payloadJSON []byte
		err := pool.QueryRow(c.UserContext(), "SELECT payload FROM failed_syncs WHERE id = $1", id).Scan(&payloadJSON)
		if err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Item not found"})
		}

		var batch []SyncItem
		if err := json.Unmarshal(payloadJSON, &batch); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Invalid payload format"})
		}

		select {
		case batchQueue <- batch:
			_, err = pool.Exec(c.UserContext(), "DELETE FROM failed_syncs WHERE id = $1", id)
			if err != nil {
				return c.Status(500).JSON(fiber.Map{"error": err.Error()})
			}
			return c.Status(200).JSON(fiber.Map{"status": "retrying"})
		default:
			return c.Status(503).JSON(fiber.Map{"error": "Server busy"})
		}
	})

	app.Delete("/api/v1/sync/dlq/:id", func(c *fiber.Ctx) error {
		id := c.Params("id")
		_, err := pool.Exec(c.UserContext(), "DELETE FROM failed_syncs WHERE id = $1", id)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(200).JSON(fiber.Map{"status": "dismissed"})
	})

	app.Post("/api/v1/sync/batch", func(c *fiber.Ctx) error {
		var req BatchRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON payload"})
		}

		validItems := make([]SyncItem, 0, len(req.Items))
		for _, item := range req.Items {
			key := "idempotency:" + item.RequestID
			ok, err := redisCli.SetNX(context.Background(), key, "processing", 24*time.Hour).Result()
			if err == nil && ok {
				if item.CorrelationID == "" {
					item.CorrelationID = c.Locals("correlation_id").(string)
				}
				validItems = append(validItems, item)
			}
		}

		if len(validItems) == 0 {
			return c.Status(200).JSON(fiber.Map{"message": "Already processed"})
		}

		select {
		case batchQueue <- validItems:
			db.LogJSON(c.UserContext(), "INFO", "Enqueued batch into worker queue", map[string]interface{}{
				"items_count": len(validItems),
			})
			return c.Status(202).JSON(fiber.Map{"status": "accepted", "count": len(validItems)})
		default:
			return c.Status(503).JSON(fiber.Map{"error": "Server busy"})
		}
	})

	log.Fatal(app.Listen(":3001"))
}

func worker(id int, pool *pgxpool.Pool, queue <-chan []SyncItem) {
	for batch := range queue {
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

			err := db.BulkInsertSalesAndMovements(ctx, pool, sales, movements, stockUpdates)
			if err != nil {
				// SQLState 23514 is CHECK constraint violation (negative stock). Do not retry in DLQ as it's a validation failure.
				if !strings.Contains(err.Error(), "P0001") && !strings.Contains(err.Error(), "Conflict") && !strings.Contains(err.Error(), "23514") {
					db.SaveToDLQ(ctx, pool, batch, err.Error())
				}
			}
		}
	}
}

func startRetryWorker(pool *pgxpool.Pool, queue chan<- []SyncItem) {
	ticker := time.NewTicker(5 * time.Second)
	for range ticker.C {
		rows, err := pool.Query(context.Background(), "SELECT id, payload FROM failed_syncs WHERE retry_count < 5 LIMIT 10")
		if err != nil {
			continue
		}

		for rows.Next() {
			var id int
			var payloadJSON []byte
			if err := rows.Scan(&id, &payloadJSON); err == nil {
				var batch []SyncItem
				if err := json.Unmarshal(payloadJSON, &batch); err == nil {
					queue <- batch
					pool.Exec(context.Background(), "UPDATE failed_syncs SET retry_count = retry_count + 1 WHERE id = $1", id)
				}
			}
		}
		rows.Close()
	}
}
