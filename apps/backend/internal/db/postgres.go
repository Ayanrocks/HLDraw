package db

import (
	"context"
	"fmt"

	"github.com/ayanrocks/hlDraw/backend/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// Database defines the interface for database operations
type Database interface {
	Close()
	Ping(ctx context.Context) error
	GetPool() *pgxpool.Pool
}

type postgresDB struct {
	pool *pgxpool.Pool
}

// BuildConnectionURL constructs a PostgreSQL connection string from the provided configuration
func BuildConnectionURL(cfg *config.Config) string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		cfg.DB.User,
		cfg.DB.Password,
		cfg.DB.Host,
		cfg.DB.Port,
		cfg.DB.DBName,
		cfg.DB.SSLMode,
	)
}

// NewPostgresDB creates a new PostgreSQL database connection
func NewPostgresDB(ctx context.Context, cfg *config.Config) (Database, error) {
	dbURL := BuildConnectionURL(cfg)
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	log.Info().Msg("Successfully connected to PostgreSQL")

	return &postgresDB{
		pool: pool,
	}, nil
}

func (db *postgresDB) Close() {
	if db.pool != nil {
		db.pool.Close()
		log.Info().Msg("PostgreSQL connection closed")
	}
}

func (db *postgresDB) Ping(ctx context.Context) error {
	return db.pool.Ping(ctx)
}

func (db *postgresDB) GetPool() *pgxpool.Pool {
	return db.pool
}
