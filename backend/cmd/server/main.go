package main

import (
	"context"
	"log"
	"os"
	"runtime"
	"time"

	"multi-tenant-saas-inventory/internal/db"
	"multi-tenant-saas-inventory/internal/handler"
	"multi-tenant-saas-inventory/internal/middleware"
	"multi-tenant-saas-inventory/internal/repository"
	"multi-tenant-saas-inventory/internal/service"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Custom Prometheus Telemetry Metrics
var (
	dbConnectionsGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "erp_db_connections_active",
		Help: "Number of active database connections",
	})
	dlqCountGauge = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "erp_dlq_failed_syncs_total",
		Help: "Total pending logs in DLQ (failed_syncs) table",
	})
)

func main() {
	// Load environment variables
	_ = godotenv.Load()

	// 1. Establish database pools
	pool, err := db.NewPostgresPool()
	if err != nil {
		log.Fatal("Postgres Pool Error:", err)
	}
	defer pool.Close()

	redisClient := db.NewRedisClient()
	defer redisClient.Close()

	// 2. Initialize Layered Clean Architecture Components
	syncRepo := repository.NewPostgresSyncRepository(pool)
	idempotencyRepo := repository.NewRedisIdempotencyRepository(redisClient)
	syncService := service.NewSyncService(syncRepo, idempotencyRepo, 500)
	syncHandler := handler.NewSyncHandler(syncService)

	// 3. Start Asynchronous Worker Goroutines
	ctx := context.Background()
	syncService.StartWorkers(ctx, runtime.NumCPU()*2)
	syncService.StartRetryWorker(ctx, 5*time.Second)

	// Update telemetry gauges in the background
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		for range ticker.C {
			dbConnectionsGauge.Set(float64(syncService.GetActiveConnections()))
			if count, err := syncService.GetDLQCount(ctx); err == nil {
				dlqCountGauge.Set(float64(count))
			}
		}
	}()

	// 4. Fiber Web Server initialization
	app := fiber.New(fiber.Config{
		AppName: "Textile ERP Batch Ingest BFF API Gateway",
	})

	// CORS Setup
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Correlation-ID, X-Tenant-ID, X-Shop-ID",
		AllowMethods: "GET, POST, HEAD, PUT, DELETE, PATCH, OPTIONS",
	}))

	// Logging & Context Middleware stack
	app.Use(middleware.CorrelationID())
	app.Use(middleware.TenantIdentifier())

	// JSON structured logging
	app.Use(logger.New(logger.Config{
		Format: `{"time":"${time}","status":${status},"latency":"${latency}","method":"${method}","path":"${path}","correlation_id":"${respHeader:X-Correlation-ID}","tenant_id":"${locals:tenant_id}"}` + "\n",
		Output: os.Stdout,
	}))

	// 5. Register Handler Endpoints
	syncHandler.RegisterRoutes(app)

	// 6. Listen and Serve API Gateway
	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}
	log.Fatal(app.Listen(":" + port))
}
