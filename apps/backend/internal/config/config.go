package config

import (
	"os"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

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

func Load() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Warn().Msg("No .env file found, relying on system environment variables")
	}

	return &Config{
		Port: getEnvOrDefault("PORT", "8080"),
		DB: DatabaseConfig{
			Host:     getEnvOrDefault("DB_HOST", "localhost"),
			Port:     getEnvOrDefault("DB_PORT", "5432"),
			User:     getEnvOrDefault("DB_USER", "postgres"),
			Password: getEnvOrDefault("DB_PASSWORD", "postgres"),
			DBName:   getEnvOrDefault("DB_NAME", "postgres"),
			SSLMode:  getEnvOrDefault("DB_SSLMODE", "disable"),
		},
		GinMode: os.Getenv("GIN_MODE"),
	}
}
