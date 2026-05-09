package handler

import (
	"context"
	"net/http"

	"github.com/ayanrocks/hlDraw/backend/internal/db"
	"github.com/gin-gonic/gin"
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

// Check returns the health status of the application
func (h *healthHandler) Check(c *gin.Context) {
	dbStatus := "connected"
	if err := h.db.Ping(context.Background()); err != nil {
		dbStatus = "disconnected"
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "up",
		"db":     dbStatus,
	})
}
