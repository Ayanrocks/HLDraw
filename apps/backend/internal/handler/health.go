package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/ayanrocks/hlDraw/backend/internal/db"
	"github.com/gin-gonic/gin"
)

// Health check constants.
const (
	healthPingTimeout = 3 * time.Second

	healthStatusUp   = "up"
	healthStatusDown = "down"
	dbConnected      = "connected"
	dbDisconnected   = "disconnected"
	keyStatus        = "status"
	keyDB            = "db"
)

// HealthHandler defines the interface for health check endpoints
type HealthHandler interface {
	Check(c *gin.Context)
}

type healthHandler struct {
	db db.Database
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(database db.Database) HealthHandler {
	return &healthHandler{
		db: database,
	}
}

// Check returns the health status of the application.
// Uses a request-scoped context with a timeout for the DB ping.
// Returns 503 when the database is unreachable.
func (h *healthHandler) Check(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), healthPingTimeout)
	defer cancel()

	dbStatus := dbConnected
	statusCode := http.StatusOK
	healthStatus := healthStatusUp

	if err := h.db.Ping(ctx); err != nil {
		dbStatus = dbDisconnected
		statusCode = http.StatusServiceUnavailable
		healthStatus = healthStatusDown
	}

	c.JSON(statusCode, gin.H{
		keyStatus: healthStatus,
		keyDB:     dbStatus,
	})
}
