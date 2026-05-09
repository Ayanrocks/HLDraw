package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

// Default configuration values used when environment variables are unset.
const (
	DefaultPort    = "8080"
	DefaultDBHost  = "localhost"
	DefaultDBPort  = "5432"
	DefaultSSLMode = "disable"
)

// DatabaseConfig holds database connection parameters.
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// Config holds all application configuration.
type Config struct {
	Port    string
	DB      DatabaseConfig
	GinMode string
}

func getEnvOrDefault(key, defaultValue string) string {
	val := os.Getenv(key)
	if val == "" {
		return defaultValue
	}
	return val
}

// Validate checks that required configuration fields are populated
// and returns an error describing all missing values.
func (c *Config) Validate() error {
	var missing []string

	if c.DB.User == "" {
		missing = append(missing, "DB_USER")
	}
	if c.DB.Password == "" {
		missing = append(missing, "DB_PASSWORD")
	}
	if c.DB.DBName == "" {
		missing = append(missing, "DB_NAME")
	}

	if len(missing) > 0 {
		return fmt.Errorf("required environment variables are not set: %v", missing)
	}

	return nil
}

// Load reads configuration from environment variables (.env file or system).
// Returns an error when required DB credentials are missing, letting the
// caller decide how to handle the failure.
func Load() (*Config, error) {
	err := godotenv.Load()
	if err != nil {
		log.Warn().Msg("No .env file found, relying on system environment variables")
	}

	cfg := &Config{
		Port: getEnvOrDefault("PORT", DefaultPort),
		DB: DatabaseConfig{
			Host:     getEnvOrDefault("DB_HOST", DefaultDBHost),
			Port:     getEnvOrDefault("DB_PORT", DefaultDBPort),
			User:     getEnvOrDefault("DB_USER", ""),
			Password: getEnvOrDefault("DB_PASSWORD", ""),
			DBName:   getEnvOrDefault("DB_NAME", ""),
			SSLMode:  getEnvOrDefault("DB_SSLMODE", DefaultSSLMode),
		},
		GinMode: os.Getenv("GIN_MODE"),
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}
