package domain

import (
	"time"
	"github.com/google/uuid"
)

type Role string

const (
	RoleAdmin     Role = "admin"
	RoleManager   Role = "manager"
	RoleWarehouse Role = "warehouse"
)

type User struct {
	ID           uuid.UUID `json:"id"            gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Username     string    `json:"username"      gorm:"uniqueIndex;not null"`
	PasswordHash string    `json:"-"             gorm:"not null"`
	FullName     string    `json:"full_name"     gorm:"not null"`
	Role         Role      `json:"role"          gorm:"type:varchar(20);not null;default:'warehouse'"`
	IsActive     bool      `json:"is_active"     gorm:"default:true"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}