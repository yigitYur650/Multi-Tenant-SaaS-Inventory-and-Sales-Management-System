package middleware

import (
	"context"

	"multi-tenant-saas-inventory/internal/db"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// CorrelationID is a Fiber middleware that extracts or generates a correlation ID.
// It sets the ID in Response headers, local storage, and the Fiber user context.
func CorrelationID() fiber.Handler {
	return func(c *fiber.Ctx) error {
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
	}
}
