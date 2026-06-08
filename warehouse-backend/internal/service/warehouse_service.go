package service

import (
	"errors"
	"warehouse-backend/internal/domain"
	"warehouse-backend/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ─── Warehouse ───────────────────────────────────────────────

type WarehouseService interface {
	List() ([]domain.Warehouse, error)
	GetByID(id string) (*domain.Warehouse, error)
	Create(req CreateWarehouseRequest) (*domain.Warehouse, error)
	Update(id string, req UpdateWarehouseRequest) (*domain.Warehouse, error)
	Delete(id string) error
}

type CreateWarehouseRequest struct {
	Name        string `json:"name"        binding:"required"`
	Address     string `json:"address"`
	Description string `json:"description"`
}

type UpdateWarehouseRequest struct {
	Name        string `json:"name"`
	Address     string `json:"address"`
	Description string `json:"description"`
	IsActive    *bool  `json:"is_active"`
}

type warehouseService struct{ repo repository.WarehouseRepository }

func NewWarehouseService(repo repository.WarehouseRepository) WarehouseService {
	return &warehouseService{repo: repo}
}

func (s *warehouseService) List() ([]domain.Warehouse, error) {
	return s.repo.List()
}

func (s *warehouseService) GetByID(id string) (*domain.Warehouse, error) {
	return s.repo.FindByID(id)
}

func (s *warehouseService) Create(req CreateWarehouseRequest) (*domain.Warehouse, error) {
	w := &domain.Warehouse{
		ID:          uuid.New(),
		Name:        req.Name,
		Address:     req.Address,
		Description: req.Description,
		IsActive:    true,
	}
	if err := s.repo.Create(w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *warehouseService) Update(id string, req UpdateWarehouseRequest) (*domain.Warehouse, error) {
	w, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("warehouse not found")
	}
	if req.Name != ""        { w.Name = req.Name }
	if req.Address != ""     { w.Address = req.Address }
	if req.Description != "" { w.Description = req.Description }
	if req.IsActive != nil   { w.IsActive = *req.IsActive }
	if err := s.repo.Update(w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *warehouseService) Delete(id string) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return errors.New("warehouse not found")
	}
	return s.repo.Delete(id)
}

// ─── Zone ────────────────────────────────────────────────────

type ZoneService interface {
	ListByWarehouse(warehouseID string) ([]domain.Zone, error)
	GetByID(id string) (*domain.Zone, error)
	Create(req CreateZoneRequest) (*domain.Zone, error)
	Update(id string, req UpdateZoneRequest) (*domain.Zone, error)
	Delete(id string) error
}

type CreateZoneRequest struct {
	WarehouseID string `json:"-"`

	Code        string `json:"code" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type UpdateZoneRequest struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type zoneService struct{ repo repository.ZoneRepository }

func NewZoneService(repo repository.ZoneRepository) ZoneService {
	return &zoneService{repo: repo}
}

func (s *zoneService) ListByWarehouse(warehouseID string) ([]domain.Zone, error) {
	return s.repo.ListByWarehouse(warehouseID)
}

func (s *zoneService) GetByID(id string) (*domain.Zone, error) {
	return s.repo.FindByID(id)
}

func (s *zoneService) Create(req CreateZoneRequest) (*domain.Zone, error) {
	wID, err := uuid.Parse(req.WarehouseID)
	if err != nil {
		return nil, errors.New("invalid warehouse_id")
	}
	z := &domain.Zone{
		ID:          uuid.New(),
		WarehouseID: wID,
		Code:        req.Code,
		Name:        req.Name,
		Description: req.Description,
	}
	if err := s.repo.Create(z); err != nil {
		return nil, err
	}
	return z, nil
}

func (s *zoneService) Update(id string, req UpdateZoneRequest) (*domain.Zone, error) {
	z, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("zone not found")
	}
	if req.Code != ""        { z.Code = req.Code }
	if req.Name != ""        { z.Name = req.Name }
	if req.Description != "" { z.Description = req.Description }
	if err := s.repo.Update(z); err != nil {
		return nil, err
	}
	return z, nil
}

func (s *zoneService) Delete(id string) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return errors.New("zone not found")
	}
	return s.repo.Delete(id)
}

// ─── Rack ────────────────────────────────────────────────────

type RackService interface {
	ListByZone(zoneID string) ([]domain.Rack, error)
	GetByID(id string) (*domain.Rack, error)
	Create(req CreateRackRequest) (*domain.Rack, error)
	Update(id string, req UpdateRackRequest) (*domain.Rack, error)
	Delete(id string) error
}

type CreateRackRequest struct {
	ZoneID string `json:"-"`

	Code        string `json:"code" binding:"required"`
	Name        string `json:"name" binding:"required"`
	MaxWeightKg int    `json:"max_weight_kg"`
}

type UpdateRackRequest struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	MaxWeightKg *int   `json:"max_weight_kg"`
}

type rackService struct{ repo repository.RackRepository }

func NewRackService(repo repository.RackRepository) RackService {
	return &rackService{repo: repo}
}

func (s *rackService) ListByZone(zoneID string) ([]domain.Rack, error) {
	return s.repo.ListByZone(zoneID)
}

func (s *rackService) GetByID(id string) (*domain.Rack, error) {
	return s.repo.FindByID(id)
}

func (s *rackService) Create(req CreateRackRequest) (*domain.Rack, error) {
	zID, err := uuid.Parse(req.ZoneID)
	if err != nil {
		return nil, errors.New("invalid zone_id")
	}
	rack := &domain.Rack{
		ID:          uuid.New(),
		ZoneID:      zID,
		Code:        req.Code,
		Name:        req.Name,
		MaxWeightKg: req.MaxWeightKg,
	}
	if err := s.repo.Create(rack); err != nil {
		return nil, err
	}
	return rack, nil
}

func (s *rackService) Update(id string, req UpdateRackRequest) (*domain.Rack, error) {
	rack, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("rack not found")
	}
	if req.Code != ""         { rack.Code = req.Code }
	if req.Name != ""         { rack.Name = req.Name }
	if req.MaxWeightKg != nil { rack.MaxWeightKg = *req.MaxWeightKg }
	if err := s.repo.Update(rack); err != nil {
		return nil, err
	}
	return rack, nil
}

func (s *rackService) Delete(id string) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return errors.New("rack not found")
	}
	return s.repo.Delete(id)
}

// ─── Bin ─────────────────────────────────────────────────────

type BinService interface {
	ListByRack(rackID string) ([]domain.Bin, error)
	GetByID(id string) (*domain.Bin, error)
	Create(req CreateBinRequest) (*domain.Bin, error)
	Update(id string, req UpdateBinRequest) (*domain.Bin, error)
	Delete(id string) error
}

type CreateBinRequest struct {
	RackID string `json:"-"`

	Code     string `json:"code" binding:"required"`
	QRCode   string `json:"qr_code"`
	RFIDuid  string `json:"rfid_uid"` // vẫn nhận string từ JSON, xử lý nil bên dưới
	Capacity int    `json:"capacity"`
}

type UpdateBinRequest struct {
	Code     string `json:"code"`
	QRCode   string `json:"qr_code"`
	RFIDuid  string `json:"rfid_uid"`
	Capacity *int   `json:"capacity"`
	IsActive *bool  `json:"is_active"`
}

type binService struct {
	repo repository.BinRepository
	db   *gorm.DB
}

func NewBinService(repo repository.BinRepository, db *gorm.DB) BinService {
	return &binService{repo: repo, db: db}
}

func (s *binService) ListByRack(rackID string) ([]domain.Bin, error) {
	return s.repo.ListByRack(rackID)
}

func (s *binService) GetByID(id string) (*domain.Bin, error) {
	return s.repo.FindByID(id)
}

// strToNilIfEmpty: chuyển "" thành nil để tránh unique constraint lỗi.
// PostgreSQL: unique constraint cho phép nhiều NULL, nhưng coi '' là duplicate.
func strToNilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (s *binService) Create(req CreateBinRequest) (*domain.Bin, error) {
	rID, err := uuid.Parse(req.RackID)
	if err != nil {
		return nil, errors.New("invalid rack_id")
	}
	bin := &domain.Bin{
		ID:       uuid.New(),
		RackID:   rID,
		Code:     req.Code,
		QRCode:   req.QRCode,
		RFIDuid:  strToNilIfEmpty(req.RFIDuid),  // "" → nil → NULL trong DB
		Capacity: req.Capacity,
		IsActive: true,
	}
	if err := s.repo.Create(bin); err != nil {
		return nil, err
	}
	return bin, nil
}

func (s *binService) Update(id string, req UpdateBinRequest) (*domain.Bin, error) {
	bin, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("bin not found")
	}
	if req.Code != ""      { bin.Code = req.Code }
	if req.QRCode != ""    { bin.QRCode = req.QRCode }
	// RFIDuid: chỉ update nếu field được gửi lên (không phân biệt "" hay có giá trị)
	// Dùng pointer để biết "có gửi" hay "không gửi" — hiện tại đơn giản: nếu != "" thì update
	if req.RFIDuid != ""   { bin.RFIDuid = strToNilIfEmpty(req.RFIDuid) }
	if req.Capacity != nil { bin.Capacity = *req.Capacity }
	if req.IsActive != nil { bin.IsActive = *req.IsActive }
	if err := s.repo.Update(bin); err != nil {
		return nil, err
	}
	return bin, nil
}

func (s *binService) Delete(id string) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return errors.New("bin not found")
	}
	var count int64
	s.db.Model(&domain.StockItem{}).
		Where("bin_id = ? AND quantity > 0", id).
		Count(&count)
	if count > 0 {
		return errors.New("bin còn hàng, không thể xóa")
	}
	return s.repo.Delete(id)
}