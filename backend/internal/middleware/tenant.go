package middleware

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"multi-tenant-saas-inventory/internal/db"
	"github.com/gofiber/fiber/v2"
)

type contextKey string
const TenantIDKey contextKey = "tenant_id"

// TenantIdentifier extracts the tenant ID (shop_id) from headers or Supabase JWT claims.
// It sets the tenant ID in Fiber locals and user context.
func TenantIdentifier() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 1. Try to extract from custom headers
		tenantID := c.Get("X-Tenant-ID")
		if tenantID == "" {
			tenantID = c.Get("X-Shop-ID")
		}

		// 2. Fallback: Parse Supabase JWT AppMetadata claims from Authorization header
		if tenantID == "" {
			authHeader := c.Get("Authorization")
			if authHeader != "" {
				if shopID, err := decodeJWTClaims(authHeader); err == nil && shopID != "" {
					tenantID = shopID
				}
			}
		}

		// 3. Save to request context & locals
		if tenantID != "" {
			c.Locals("tenant_id", tenantID)
			ctx := context.WithValue(c.UserContext(), TenantIDKey, tenantID)
			ctx = context.WithValue(ctx, db.ContextKey("tenant_id"), tenantID) // fallback compatibility
			c.SetUserContext(ctx)
		}

		return c.Next()
	}
}

// decodeJWTClaims base64url decodes the Supabase JWT claims to extract the shop_id.
func decodeJWTClaims(authHeader string) (string, error) {
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", fmt.Errorf("invalid auth header format")
	}
	token := parts[1]
	tokenParts := strings.Split(token, ".")
	if len(tokenParts) != 3 {
		return "", fmt.Errorf("invalid jwt format")
	}
	payloadSegment := tokenParts[1]
	
	// Normalize base64url padding & alphabet
	payloadSegment = strings.ReplaceAll(payloadSegment, "-", "+")
	payloadSegment = strings.ReplaceAll(payloadSegment, "_", "/")
	switch len(payloadSegment) % 4 {
	case 2:
		payloadSegment += "=="
	case 3:
		payloadSegment += "="
	}

	payloadBytes, err := base64.StdEncoding.DecodeString(payloadSegment)
	if err != nil {
		return "", err
	}

	var claims struct {
		AppMetadata struct {
			ShopID string `json:"shop_id"`
		} `json:"app_metadata"`
		UserMetadata struct {
			ShopID string `json:"shop_id"`
		} `json:"user_metadata"`
	}

	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return "", err
	}

	if claims.AppMetadata.ShopID != "" {
		return claims.AppMetadata.ShopID, nil
	}
	return claims.UserMetadata.ShopID, nil
}
