package server

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ayanrocks/hlDraw/backend/internal/config"
	"github.com/ayanrocks/hlDraw/backend/internal/db"
	"github.com/ayanrocks/hlDraw/backend/internal/handler"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// Server defines the interface for the HTTP server
type Server interface {
	Start()
}

type server struct {
	httpServer *http.Server
	db         db.Database
}

// NewServer creates a new configured server instance
func NewServer(cfg *config.Config, database db.Database) Server {
	if cfg.GinMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(loggerMiddleware())

	// Initialize handlers
	healthHandler := handler.NewHealthHandler(database)

	// Register routes
	router.GET("/health", healthHandler.Check)

	httpSrv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	return &server{
		httpServer: httpSrv,
		db:         database,
	}
}

// Start runs the server and handles graceful shutdown
func (s *server) Start() {
	go func() {
		log.Info().Msgf("Server listening on port %s", s.httpServer.Addr)
		if err := s.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal().Err(err).Msg("Listen error")
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info().Msg("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.httpServer.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exiting")
}

func loggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		duration := time.Since(start)

		log.Info().
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Int("status", c.Writer.Status()).
			Dur("duration", duration).
			Msg("HTTP request")
	}
}
