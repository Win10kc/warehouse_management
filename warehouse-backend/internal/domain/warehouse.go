package domain

import "github.com/google/uuid"
import "fmt"

type Warehouse struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name        string    `json:"name" gorm:"not null"`
	Address     string    `json:"address"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`

	Zones []Zone `json:"zones" gorm:"foreignKey:WarehouseID"`
}

type Zone struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	WarehouseID uuid.UUID `json:"warehouse_id" gorm:"type:uuid;not null"`

	Code        string `json:"code" gorm:"not null"`
	Name        string `json:"name" gorm:"not null"`
	Description string `json:"description"`

	Racks []Rack `json:"racks" gorm:"foreignKey:ZoneID"`
}

type Rack struct {
	ID     uuid.UUID `json:"id" gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	ZoneID uuid.UUID `json:"zone_id" gorm:"type:uuid;not null"`

	Code string `json:"code" gorm:"not null"`
	Name string `json:"name" gorm:"not null"`

	MaxWeightKg int `json:"max_weight_kg"`

	Bins []Bin `json:"bins" gorm:"foreignKey:RackID"`
}

type Bin struct {
	ID       uuid.UUID `json:"id" gorm:"column:id;type:uuid;primaryKey;default:gen_random_uuid()"`
	RackID   uuid.UUID `json:"rack_id" gorm:"column:rack_id;type:uuid;not null"`

	Code    string  `json:"code" gorm:"column:code;not null"`
	QRCode  string  `json:"qr_code" gorm:"column:qr_code;uniqueIndex"`
	RFIDuid *string `json:"rfid_uid" gorm:"column:rfid_uid;uniqueIndex"`

	Capacity int  `json:"capacity" gorm:"column:capacity"`
	IsActive bool `json:"is_active" gorm:"column:is_active;default:true"`

	// Location fields — không map DB, được fill thủ công sau raw query
	// dùng gorm:"-" để GORM bỏ qua khi insert/update
	RackCode      string `json:"rack_code,omitempty"      gorm:"-"`
	ZoneCode      string `json:"zone_code,omitempty"      gorm:"-"`
	ZoneName      string `json:"zone_name,omitempty"      gorm:"-"`
	WarehouseName string `json:"warehouse_name,omitempty" gorm:"-"`
}


func (b *Bin) DisplayName() string {
    if b.WarehouseName != "" {
        return fmt.Sprintf("%s › %s › %s › %s",
            b.WarehouseName,
            b.ZoneName,
            b.RackCode,
            b.Code,
        )
    }
    return b.Code
}