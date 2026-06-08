package service

import (
	"encoding/base64"
	"errors"

	"warehouse-backend/internal/domain"
	"warehouse-backend/internal/repository"

	qrcode "github.com/skip2/go-qrcode"
	"github.com/google/uuid"
)

type ProductService interface {
	List(filter repository.ProductFilter) ([]domain.Product, int64, error)
	GetByID(id string) (*domain.Product, error)
	GetByCode(code string) (*domain.Product, string, error)
	GenerateQR(id string) (*domain.Product, string, error)
	Create(req CreateProductRequest) (*domain.Product, error)
	Update(id string, req UpdateProductRequest) (*domain.Product, error)
	Delete(id string) error
}

type CreateProductRequest struct {
	SKU         string `json:"sku"          binding:"required"`
	Name        string `json:"name"         binding:"required"`
	Unit        string `json:"unit"         binding:"required"`
	Description string `json:"description"`
	Category    string `json:"category"`
	QRCode      string `json:"qr_code"`
	RFIDuid     string `json:"rfid_uid"`
	MinStock    int    `json:"min_stock"`
	MaxStock    int    `json:"max_stock"`
	SupplierID  string `json:"supplier_id"` // UUID string, optional
}

type UpdateProductRequest struct {
	Name        string `json:"name"`
	Unit        string `json:"unit"`
	Description string `json:"description"`
	Category    string `json:"category"`
	QRCode      string `json:"qr_code"`
	RFIDuid     string `json:"rfid_uid"`
	MinStock    int    `json:"min_stock"`
	MaxStock    int    `json:"max_stock"`
	IsActive    *bool  `json:"is_active"`
	SupplierID  string `json:"supplier_id"` // "" = không đổi, "clear" = xóa NCC
}

type productService struct {
	repo repository.ProductRepository
}

func NewProductService(repo repository.ProductRepository) ProductService {
	return &productService{repo: repo}
}

func (s *productService) List(filter repository.ProductFilter) ([]domain.Product, int64, error) {
	return s.repo.List(filter)
}

func (s *productService) GetByID(id string) (*domain.Product, error) {
	return s.repo.FindByID(id)
}

func (s *productService) GetByCode(code string) (*domain.Product, string, error) {
	p, err := s.repo.FindByCode(code)
	if err != nil {
		return nil, "", err
	}
	scanType := "rfid"
	if p.QRCode != nil && *p.QRCode == code {
		scanType = "qr"
	}
	return p, scanType, nil
}

func (s *productService) GenerateQR(id string) (*domain.Product, string, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, "", errors.New("product not found")
	}
	qrPayload := p.SKU
	png, err := qrcode.Encode(qrPayload, qrcode.Medium, 256)
	if err != nil {
		return nil, "", errors.New("failed to generate QR code")
	}
	b64 := base64.StdEncoding.EncodeToString(png)
	if p.QRCode == nil {
		p.QRCode = &qrPayload
		if err := s.repo.Update(p); err != nil {
			return nil, "", errors.New("failed to save qr_code")
		}
	}
	return p, b64, nil
}

func (s *productService) Create(req CreateProductRequest) (*domain.Product, error) {
	if req.MinStock < 0 || req.MaxStock < 0 {
		return nil, errors.New("min_stock and max_stock must be >= 0")
	}
	if req.MaxStock > 0 && req.MinStock >= req.MaxStock {
		return nil, errors.New("min_stock must be less than max_stock")
	}

	p := &domain.Product{
		ID:          uuid.New(),
		SKU:         req.SKU,
		Name:        req.Name,
		Unit:        req.Unit,
		Description: req.Description,
		Category:    req.Category,
		QRCode:      emptyToNil(req.QRCode),
		RFIDuid:     emptyToNil(req.RFIDuid),
		MinStock:    req.MinStock,
		MaxStock:    req.MaxStock,
		IsActive:    true,
	}

	if req.SupplierID != "" {
		uid, err := uuid.Parse(req.SupplierID)
		if err == nil {
			p.SupplierID = &uid
		}
	}

	if err := s.repo.Create(p); err != nil {
		return nil, errors.New("sku already exists or database error")
	}
	return p, nil
}

func (s *productService) Update(id string, req UpdateProductRequest) (*domain.Product, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("product not found")
	}

	if req.Name != ""        { p.Name = req.Name }
	if req.Unit != ""        { p.Unit = req.Unit }
	if req.Description != "" { p.Description = req.Description }
	if req.Category != ""    { p.Category = req.Category }
	if req.QRCode != ""      { p.QRCode = emptyToNil(req.QRCode) }
	if req.RFIDuid != ""     { p.RFIDuid = emptyToNil(req.RFIDuid) }
	if req.MinStock >= 0     { p.MinStock = req.MinStock }
	if req.MaxStock >= 0     { p.MaxStock = req.MaxStock }
	if req.IsActive != nil   { p.IsActive = *req.IsActive }

	// "clear" → xóa NCC; UUID hợp lệ → gán; "" → giữ nguyên
	if req.SupplierID == "clear" {
		p.SupplierID = nil
	} else if req.SupplierID != "" {
		uid, err := uuid.Parse(req.SupplierID)
		if err == nil {
			p.SupplierID = &uid
		}
	}

	if err := s.repo.Update(p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *productService) Delete(id string) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return errors.New("product not found")
	}
	return s.repo.Delete(id)
}

func emptyToNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}