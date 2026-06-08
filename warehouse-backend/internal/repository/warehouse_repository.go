package repository

import (
    "warehouse-backend/internal/domain"
    "gorm.io/gorm"
)

// ─── Warehouse ───────────────────────────────────────────────

type WarehouseRepository interface {
    List() ([]domain.Warehouse, error)
    FindByID(id string) (*domain.Warehouse, error)
    Create(w *domain.Warehouse) error
    Update(w *domain.Warehouse) error
    Delete(id string) error
}

type warehouseRepository struct{ db *gorm.DB }

func NewWarehouseRepository(db *gorm.DB) WarehouseRepository {
    return &warehouseRepository{db: db}
}

func (r *warehouseRepository) List() ([]domain.Warehouse, error) {
    var list []domain.Warehouse
    err := r.db.Preload("Zones.Racks.Bins").Find(&list).Error
    return list, err
}

func (r *warehouseRepository) FindByID(id string) (*domain.Warehouse, error) {
    var w domain.Warehouse
    err := r.db.Preload("Zones.Racks.Bins").Where("id = ?", id).First(&w).Error
    if err != nil {
        return nil, err
    }
    return &w, nil
}

func (r *warehouseRepository) Create(w *domain.Warehouse) error {
    return r.db.Create(w).Error
}

func (r *warehouseRepository) Update(w *domain.Warehouse) error {
    return r.db.Save(w).Error
}

func (r *warehouseRepository) Delete(id string) error {
    return r.db.Model(&domain.Warehouse{}).Where("id = ?", id).Update("is_active", false).Error
}

// ─── Zone ────────────────────────────────────────────────────

type ZoneRepository interface {
    ListByWarehouse(warehouseID string) ([]domain.Zone, error)
    FindByID(id string) (*domain.Zone, error)
    Create(z *domain.Zone) error
    Update(z *domain.Zone) error
    Delete(id string) error
}

type zoneRepository struct{ db *gorm.DB }

func NewZoneRepository(db *gorm.DB) ZoneRepository {
    return &zoneRepository{db: db}
}

func (r *zoneRepository) ListByWarehouse(warehouseID string) ([]domain.Zone, error) {
    var list []domain.Zone
    err := r.db.Where("warehouse_id = ?", warehouseID).Find(&list).Error
    return list, err
}

func (r *zoneRepository) FindByID(id string) (*domain.Zone, error) {
    var z domain.Zone
    err := r.db.Where("id = ?", id).First(&z).Error
    if err != nil {
        return nil, err
    }
    return &z, nil
}

func (r *zoneRepository) Create(z *domain.Zone) error  { return r.db.Create(z).Error }
func (r *zoneRepository) Update(z *domain.Zone) error  { return r.db.Save(z).Error }
func (r *zoneRepository) Delete(id string) error {
    return r.db.Where("id = ?", id).Delete(&domain.Zone{}).Error
}

// ─── Rack ────────────────────────────────────────────────────

type RackRepository interface {
    ListByZone(zoneID string) ([]domain.Rack, error)
    FindByID(id string) (*domain.Rack, error)
    Create(rack *domain.Rack) error
    Update(rack *domain.Rack) error
    Delete(id string) error
}

type rackRepository struct{ db *gorm.DB }

func NewRackRepository(db *gorm.DB) RackRepository {
    return &rackRepository{db: db}
}

func (r *rackRepository) ListByZone(zoneID string) ([]domain.Rack, error) {
    var list []domain.Rack
    err := r.db.Where("zone_id = ?", zoneID).Find(&list).Error
    return list, err
}

func (r *rackRepository) FindByID(id string) (*domain.Rack, error) {
    var rack domain.Rack
    err := r.db.Where("id = ?", id).First(&rack).Error
    if err != nil {
        return nil, err
    }
    return &rack, nil
}

func (r *rackRepository) Create(rack *domain.Rack) error { return r.db.Create(rack).Error }
func (r *rackRepository) Update(rack *domain.Rack) error { return r.db.Save(rack).Error }
func (r *rackRepository) Delete(id string) error {
    return r.db.Where("id = ?", id).Delete(&domain.Rack{}).Error
}

// ─── Bin ─────────────────────────────────────────────────────

type BinRepository interface {
    ListByRack(rackID string) ([]domain.Bin, error)
    FindByID(id string) (*domain.Bin, error)
    FindBinByIDEnriched(id string) (*domain.Bin, error)
    Create(bin *domain.Bin) error
    Update(bin *domain.Bin) error
    Delete(id string) error
}

type binRepository struct{ db *gorm.DB }

func NewBinRepository(db *gorm.DB) BinRepository {
    return &binRepository{db: db}
}

func (r *binRepository) ListByRack(rackID string) ([]domain.Bin, error) {
    var list []domain.Bin
    err := r.db.Where("rack_id = ? AND is_active = true", rackID).Find(&list).Error
    return list, err
}

func (r *binRepository) FindByID(id string) (*domain.Bin, error) {
    var bin domain.Bin
    err := r.db.Where("id = ? AND is_active = true", id).First(&bin).Error
    if err != nil {
        return nil, err
    }
    return &bin, nil
}
// Thêm method implementation (sau hàm FindByID hiện tại)
func (r *binRepository) FindBinByIDEnriched(id string) (*domain.Bin, error) {
    var bin domain.Bin
    err := r.db.
        Table("bins").
        Select(`bins.*, 
            racks.code  AS rack_code,
            zones.code  AS zone_code,
            zones.name  AS zone_name,
            warehouses.name AS warehouse_name`).
        Joins("JOIN racks ON racks.id = bins.rack_id").
        Joins("JOIN zones ON zones.id = racks.zone_id").
        Joins("JOIN warehouses ON warehouses.id = zones.warehouse_id").
        Where("bins.id = ? AND bins.is_active = true", id).
        First(&bin).Error
    if err != nil {
        return nil, err
    }
    return &bin, nil
}

func (r *binRepository) Create(bin *domain.Bin) error {
    // Nếu rfid_uid rỗng thì set nil → insert NULL thay vì ''
    if bin.RFIDuid != nil && *bin.RFIDuid == "" {
        bin.RFIDuid = nil
    }
    return r.db.Create(bin).Error
}
func (r *binRepository) Update(bin *domain.Bin) error { return r.db.Save(bin).Error }
func (r *binRepository) Delete(id string) error {
    return r.db.Where("id = ?", id).Delete(&domain.Bin{}).Error
}