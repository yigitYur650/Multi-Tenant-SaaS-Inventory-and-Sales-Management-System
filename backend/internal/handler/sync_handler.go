package handler

import (
	"os"

	"multi-tenant-saas-inventory/internal/db"
	"multi-tenant-saas-inventory/internal/model"
	"multi-tenant-saas-inventory/internal/service"
	"github.com/ansrivas/fiberprometheus/v2"
	"github.com/gofiber/fiber/v2"
)

// SyncHandler handles HTTP requests for batch sync and DLQ management.
type SyncHandler struct {
	syncService service.SyncService
}

// NewSyncHandler creates a new SyncHandler instance.
func NewSyncHandler(syncService service.SyncService) *SyncHandler {
	return &SyncHandler{syncService: syncService}
}

// RegisterRoutes registers the handlers onto the Fiber app.
func (h *SyncHandler) RegisterRoutes(app *fiber.App) {
	// 1. Prometheus Telemetry & Metrics Security Middleware
	prometheusHandler := fiberprometheus.New("textile-erp-backend")
	
	app.Use("/metrics", func(c *fiber.Ctx) error {
		token := c.Get("X-Metrics-Token")
		expectedToken := os.Getenv("METRICS_TOKEN")
		if expectedToken != "" && token != expectedToken {
			return c.Status(403).JSON(fiber.Map{"error": "Unauthorized metrics access"})
		}
		return c.Next()
	})
	
	prometheusHandler.RegisterAt(app, "/metrics")
	app.Use(prometheusHandler.Middleware)

	// 2. Core API Endpoints
	api := app.Group("/api/v1/sync")

	api.Get("/dlq", h.GetDLQ)
	api.Post("/dlq/:id/retry", h.RetryDLQ)
	api.Delete("/dlq/:id", h.DismissDLQ)
	api.Post("/batch", h.ProcessBatch)
}

// GetDLQ retrieves all failed sync batches in DLQ.
func (h *SyncHandler) GetDLQ(c *fiber.Ctx) error {
	items, err := h.syncService.GetDLQItems(c.UserContext())
	if err != nil {
		db.LogJSON(c.UserContext(), "ERROR", "Failed to query failed_syncs table", map[string]interface{}{"error": err.Error()})
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(items)
}

// RetryDLQ retries a specific failed sync batch from DLQ.
func (h *SyncHandler) RetryDLQ(c *fiber.Ctx) error {
	id := c.Params("id")
	err := h.syncService.RetryDLQItem(c.UserContext(), id)
	if err != nil {
		if err.Error() == "item not found" {
			return c.Status(404).JSON(fiber.Map{"error": "Item not found"})
		}
		if err.Error() == "server busy" {
			return c.Status(503).JSON(fiber.Map{"error": "Server busy"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(200).JSON(fiber.Map{"status": "retrying"})
}

// DismissDLQ deletes a failed sync batch from DLQ.
func (h *SyncHandler) DismissDLQ(c *fiber.Ctx) error {
	id := c.Params("id")
	err := h.syncService.DismissDLQItem(c.UserContext(), id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(200).JSON(fiber.Map{"status": "dismissed"})
}

// ProcessBatch ingests a sync batch payload.
func (h *SyncHandler) ProcessBatch(c *fiber.Ctx) error {
	var req model.BatchRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid JSON payload"})
	}

	count, err := h.syncService.ProcessBatch(c.UserContext(), req.Items)
	if err != nil {
		if err.Error() == "server busy" {
			return c.Status(503).JSON(fiber.Map{"error": "Server busy"})
		}
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if count == 0 {
		return c.Status(200).JSON(fiber.Map{"message": "Already processed"})
	}

	return c.Status(202).JSON(fiber.Map{"status": "accepted", "count": count})
}
