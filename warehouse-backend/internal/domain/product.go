package domain

import (
	"time"

	"github.com/google/uuid"
)

type Product struct {
	ID          uuid.UUID  `json:"id"           gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	SKU         string     `json:"sku"          gorm:"uniqueIndex;not null"`
	Name        string     `json:"name"         gorm:"not null"`
	Unit        string     `json:"unit"         gorm:"not null"`
	Description string     `json:"description"`
	Category    string     `json:"category"`
	QRCode      *string    `json:"qr_code,omitempty"  gorm:"uniqueIndex"`
	RFIDuid     *string    `json:"rfid_uid,omitempty" gorm:"column:rfid_uid;uniqueIndex"`
	ImageURL    string     `json:"image_url"`
	MinStock    int        `json:"min_stock"    gorm:"default:0"`
	MaxStock    int        `json:"max_stock"    gorm:"default:0"`
	SupplierID  *uuid.UUID `json:"supplier_id"  gorm:"type:uuid"`
	Supplier    *Supplier  `json:"supplier,omitempty" gorm:"foreignKey:SupplierID"`
	IsActive    bool       `json:"is_active"    gorm:"default:true"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type StockSummary struct {
	ID               uuid.UUID `json:"id"                gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ProductID        uuid.UUID `json:"product_id"        gorm:"type:uuid;uniqueIndex;not null"`
	Product          Product   `json:"product"           gorm:"foreignKey:ProductID"`
	TotalQuantity    int       `json:"total_quantity"    gorm:"default:0"`
	ReservedQuantity int       `json:"reserved_quantity" gorm:"default:0"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (StockSummary) TableName() string { return "stock_summary" }