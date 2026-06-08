package domain

import (
	"time"

	"github.com/google/uuid"
)

type Supplier struct {
	ID        uuid.UUID `json:"id"         gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name      string    `json:"name"       gorm:"not null"`
	Contact   string    `json:"contact"`
	Note      string    `json:"note"`
	IsActive  bool      `json:"is_active"  gorm:"default:true"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}