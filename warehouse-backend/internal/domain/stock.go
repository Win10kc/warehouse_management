package domain

import (
	"time"

	"github.com/google/uuid"
)

type StockItem struct {
	ID         uuid.UUID  `json:"id"          gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ProductID  uuid.UUID  `json:"product_id"  gorm:"type:uuid;not null"`
	Product    Product    `json:"product"     gorm:"foreignKey:ProductID"`
	BinID      uuid.UUID  `json:"bin_id"      gorm:"type:uuid;not null"`
	Bin        Bin        `json:"bin"         gorm:"foreignKey:BinID"`
	Quantity   int        `json:"quantity"    gorm:"default:0"`
	Status     string     `json:"status"      gorm:"default:'good'"`
	ExpireDate *time.Time `json:"expire_date"`
	UpdatedAt  time.Time  `json:"updated_at"`
}