package db

import (
	"context"
	"net/url"
	"time"

	"github.com/ayanrocks/hlDraw/backend/internal/config"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// pingTimeout is the maximum time to wait for the initial database ping.
const pingTimeout = 5 * time.Second

// Database defines the interface for database operations
type Database interface {
	Close()
	Ping(ctx context.Context) error
	GetPool() *pgxpool.Pool
}

type postgresDB struct {
	pool *pgxpool.Pool
}

// BuildConnectionURL constructs a PostgreSQL connection string from the
// provided configuration using net/url to safely encode credentials.
func BuildConnectionURL(cfg *config.Config) string {
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(cfg.DB.User, cfg.DB.Password),
		Host:   cfg.DB.Host + ":" + cfg.DB.Port,
		Path:   "/" + cfg.DB.DBName,
	}

	query := url.Values{}
	query.Set("sslmode", cfg.DB.SSLMode)
	u.RawQuery = query.Encode()

	return u.String()
}

// NewPostgresDB creates a new PostgreSQL database connection.
// The initial ping uses a bounded timeout to avoid blocking indefinitely.
func NewPostgresDB(ctx context.Context, cfg *config.Config) (Database, error) {
	dbURL := BuildConnectionURL(cfg)
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return nil, err
	}

	pingCtx, cancel := context.WithTimeout(ctx, pingTimeout)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
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
