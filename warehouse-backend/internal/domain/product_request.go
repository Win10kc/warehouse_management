package domain

import (
    "time"
    "github.com/google/uuid"
)

type ProductRequestStatus string

const (
    ProductRequestPending  ProductRequestStatus = "pending"
    ProductRequestResolved ProductRequestStatus = "resolved"
    ProductRequestRejected ProductRequestStatus = "rejected"
)

type ProductRequest struct {
    ID            uuid.UUID            `json:"id"             gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
    RawCode       string               `json:"raw_code"       gorm:"not null"`        // QR/RFID code quét được
    SuggestedName string               `json:"suggested_name" gorm:"not null"`        // nhân viên nhập
    SupplierName  string               `json:"supplier_name"`
    Note          string               `json:"note"`                                  // ghi chú thêm
    ReportedByID  uuid.UUID            `json:"reported_by_id" gorm:"type:uuid;not null"`
    ReportedBy    User                 `json:"reported_by"    gorm:"foreignKey:ReportedByID"`
    Status        ProductRequestStatus `json:"status"         gorm:"type:varchar(20);default:'pending'"`
    CreatedAt     time.Time            `json:"created_at"`
    UpdatedAt     time.Time            `json:"updated_at"`
}