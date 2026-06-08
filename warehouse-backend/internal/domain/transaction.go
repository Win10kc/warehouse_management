package domain

import (
	"time"

	"github.com/google/uuid"
)

type TransactionType   string
type TransactionStatus string

const (
	TypeImport   TransactionType = "import"
	TypeExport   TransactionType = "export"
	TypeTransfer TransactionType = "transfer"
	TypeCount    TransactionType = "count"

	StatusDraft      TransactionStatus = "draft"
	StatusPending    TransactionStatus = "pending"
	StatusProcessing TransactionStatus = "processing"
	StatusDone       TransactionStatus = "done"
	StatusRejected   TransactionStatus = "rejected"
)

type Transaction struct {
	ID           uuid.UUID         `json:"id"            gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Code         string            `json:"code"          gorm:"uniqueIndex;not null"`
	Type         TransactionType   `json:"type"          gorm:"type:varchar(20);not null"`
	Status       TransactionStatus `json:"status"        gorm:"type:varchar(20);default:'draft'"`
	CreatedByID  uuid.UUID         `json:"created_by_id" gorm:"type:uuid;not null"`
	CreatedBy    User              `json:"created_by"    gorm:"foreignKey:CreatedByID"`
	Note         string            `json:"note"`
	CreatedAt    time.Time         `json:"created_at"`
	ApprovedAt   *time.Time        `json:"approved_at"`
	CompletedAt  *time.Time        `json:"completed_at"`
	ApprovedByID *uuid.UUID        `json:"approved_by_id" gorm:"type:uuid"`
	ApprovedBy   *User             `json:"approved_by"    gorm:"foreignKey:ApprovedByID"`
	Items        []TransactionItem `json:"items"          gorm:"foreignKey:TransactionID"`
}

type TransactionItem struct {
	ID                uuid.UUID  `json:"id"                 gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	TransactionID     uuid.UUID  `json:"transaction_id"     gorm:"type:uuid;not null"`
	ProductID         uuid.UUID  `json:"product_id"         gorm:"type:uuid;not null"`
	Product           Product    `json:"product"            gorm:"foreignKey:ProductID"`
	FromBinID         *uuid.UUID `json:"from_bin_id"        gorm:"type:uuid"`
	ToBinID           *uuid.UUID `json:"to_bin_id"          gorm:"type:uuid"`

	// Preload trong FindByID — dùng *Bin (có thêm location fields gorm:"-" trong warehouse.go)
	FromBin           *Bin       `json:"from_bin,omitempty" gorm:"foreignKey:FromBinID;references:ID"`
	ToBin             *Bin       `json:"to_bin,omitempty"   gorm:"foreignKey:ToBinID;references:ID"`
	SuggestedBinID *uuid.UUID `json:"suggested_bin_id,omitempty" gorm:"type:uuid"`
	SuggestedBin   *Bin       `json:"suggested_bin,omitempty" gorm:"-"`

	QuantityRequested int        `json:"quantity_requested" gorm:"not null"`
	QuantityActual    int        `json:"quantity_actual"    gorm:"default:0"`
	ScanMethod        string     `json:"scan_method"        gorm:"default:'manual'"`
}