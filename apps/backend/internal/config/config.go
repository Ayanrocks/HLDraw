package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
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
// It fails fast with a fatal log if required DB credentials are missing.
func Load() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Warn().Msg("No .env file found, relying on system environment variables")
	}

	cfg := &Config{
		Port: getEnvOrDefault("PORT", "8080"),
		DB: DatabaseConfig{
			Host:     getEnvOrDefault("DB_HOST", "localhost"),
			Port:     getEnvOrDefault("DB_PORT", "5432"),
			User:     getEnvOrDefault("DB_USER", ""),
			Password: getEnvOrDefault("DB_PASSWORD", ""),
			DBName:   getEnvOrDefault("DB_NAME", ""),
			SSLMode:  getEnvOrDefault("DB_SSLMODE", "disable"),
		},
		GinMode: os.Getenv("GIN_MODE"),
	}

	if err := cfg.Validate(); err != nil {
		log.Fatal().Err(err).Msg("Invalid configuration — refusing to start with missing DB credentials")
	}

	return cfg
}
