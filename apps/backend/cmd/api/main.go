package main

import (
	"context"
	"os"
	"time"

	"github.com/ayanrocks/hlDraw/backend/internal/config"
	"github.com/ayanrocks/hlDraw/backend/internal/db"
	"github.com/ayanrocks/hlDraw/backend/internal/server"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Initialize structured logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	log.Info().Msg("Starting hlDraw backend service...")

	// Load configuration
	cfg := config.Load()

	// Initialize database
	ctx := context.Background()
	database, err := db.NewPostgresDB(ctx, cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize database")
	}
	defer database.Close()

	// Initialize and start server
	srv := server.NewServer(cfg, database)
	srv.Start()
}
