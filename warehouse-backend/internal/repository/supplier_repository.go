package repository

import (
	"warehouse-backend/internal/domain"

	"gorm.io/gorm"
)

type SupplierRepository interface {
	List() ([]domain.Supplier, error)
	FindByID(id string) (*domain.Supplier, error)
	Create(s *domain.Supplier) error
	Update(s *domain.Supplier) error
	Delete(id string) error
}

type supplierRepository struct {
	db *gorm.DB
}

func NewSupplierRepository(db *gorm.DB) SupplierRepository {
	return &supplierRepository{db: db}
}

func (r *supplierRepository) List() ([]domain.Supplier, error) {
	var items []domain.Supplier
	err := r.db.Where("is_active = true").Order("name ASC").Find(&items).Error
	return items, err
}

func (r *supplierRepository) FindByID(id string) (*domain.Supplier, error) {
	var s domain.Supplier
	err := r.db.Where("id = ?", id).First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *supplierRepository) Create(s *domain.Supplier) error {
	return r.db.Create(s).Error
}

func (r *supplierRepository) Update(s *domain.Supplier) error {
	return r.db.Save(s).Error
}

func (r *supplierRepository) Delete(id string) error {
	return r.db.Model(&domain.Supplier{}).Where("id = ?", id).Update("is_active", false).Error
}