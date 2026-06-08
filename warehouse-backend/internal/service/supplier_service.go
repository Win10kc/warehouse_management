package service

import (
	"errors"

	"warehouse-backend/internal/domain"
	"warehouse-backend/internal/repository"

	"github.com/google/uuid"
)

type SupplierService interface {
	List() ([]domain.Supplier, error)
	GetByID(id string) (*domain.Supplier, error)
	Create(req CreateSupplierRequest) (*domain.Supplier, error)
	Update(id string, req UpdateSupplierRequest) (*domain.Supplier, error)
	Delete(id string) error
}

type CreateSupplierRequest struct {
	Name    string `json:"name"    binding:"required"`
	Contact string `json:"contact"`
	Note    string `json:"note"`
}

type UpdateSupplierRequest struct {
	Name     string `json:"name"`
	Contact  string `json:"contact"`
	Note     string `json:"note"`
	IsActive *bool  `json:"is_active"`
}

type supplierService struct {
	repo repository.SupplierRepository
}

func NewSupplierService(repo repository.SupplierRepository) SupplierService {
	return &supplierService{repo: repo}
}

func (s *supplierService) List() ([]domain.Supplier, error) {
	return s.repo.List()
}

func (s *supplierService) GetByID(id string) (*domain.Supplier, error) {
	sup, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("supplier not found")
	}
	return sup, nil
}

func (s *supplierService) Create(req CreateSupplierRequest) (*domain.Supplier, error) {
	sup := &domain.Supplier{
		ID:       uuid.New(),
		Name:     req.Name,
		Contact:  req.Contact,
		Note:     req.Note,
		IsActive: true,
	}
	if err := s.repo.Create(sup); err != nil {
		return nil, errors.New("failed to create supplier")
	}
	return sup, nil
}

func (s *supplierService) Update(id string, req UpdateSupplierRequest) (*domain.Supplier, error) {
	sup, err := s.repo.FindByID(id)
	if err != nil {
		return nil, errors.New("supplier not found")
	}
	if req.Name != ""     { sup.Name = req.Name }
	if req.Contact != ""  { sup.Contact = req.Contact }
	if req.Note != ""     { sup.Note = req.Note }
	if req.IsActive != nil { sup.IsActive = *req.IsActive }

	if err := s.repo.Update(sup); err != nil {
		return nil, err
	}
	return sup, nil
}

func (s *supplierService) Delete(id string) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return errors.New("supplier not found")
	}
	return s.repo.Delete(id)
}