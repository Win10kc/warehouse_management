package repository

import (
	"warehouse-backend/internal/domain"
	"gorm.io/gorm"
)

type ProductRepository interface {
	List(filter ProductFilter) ([]domain.Product, int64, error)
	FindByID(id string) (*domain.Product, error)
	FindByCode(code string) (*domain.Product, error)
	Create(p *domain.Product) error
	Update(p *domain.Product) error
	Delete(id string) error
}

type ProductFilter struct {
	Search     string
	Category   string
	SupplierID string
	IsActive   *bool
	Page       int
	Limit      int
}

type productRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) List(f ProductFilter) ([]domain.Product, int64, error) {
	query := r.db.Model(&domain.Product{}).Preload("Supplier")

	if f.Search != "" {
		query = query.Where("name ILIKE ? OR sku ILIKE ?", "%"+f.Search+"%", "%"+f.Search+"%")
	}
	if f.Category != "" {
		query = query.Where("category = ?", f.Category)
	}
	if f.SupplierID != "" {
		query = query.Where("supplier_id = ?", f.SupplierID)
	}
	if f.IsActive != nil {
		query = query.Where("is_active = ?", *f.IsActive)
	}

	var total int64
	query.Count(&total)

	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	offset := (f.Page - 1) * f.Limit

	var products []domain.Product
	err := query.Offset(offset).Limit(f.Limit).Order("created_at DESC").Find(&products).Error
	return products, total, err
}

func (r *productRepository) FindByID(id string) (*domain.Product, error) {
	var p domain.Product
	err := r.db.Preload("Supplier").Where("id = ?", id).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *productRepository) FindByCode(code string) (*domain.Product, error) {
	var p domain.Product
	err := r.db.Preload("Supplier").Where("qr_code = ? OR rfid_uid = ?", code, code).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *productRepository) Create(p *domain.Product) error {
	return r.db.Create(p).Error
}

func (r *productRepository) Update(p *domain.Product) error {
	return r.db.Save(p).Error
}

func (r *productRepository) Delete(id string) error {
	return r.db.Model(&domain.Product{}).Where("id = ?", id).Update("is_active", false).Error
}