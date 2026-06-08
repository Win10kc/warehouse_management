package repository

import (
    "warehouse-backend/internal/domain"
    "gorm.io/gorm"
)

type ProductRequestRepository interface {
    Create(req *domain.ProductRequest) error
    List(status string) ([]domain.ProductRequest, error)
    UpdateStatus(id string, status domain.ProductRequestStatus) error
}

type productRequestRepository struct{ db *gorm.DB }

func NewProductRequestRepository(db *gorm.DB) ProductRequestRepository {
    return &productRequestRepository{db}
}

func (r *productRequestRepository) Create(req *domain.ProductRequest) error {
    return r.db.Create(req).Error
}

func (r *productRequestRepository) List(status string) ([]domain.ProductRequest, error) {
    var list []domain.ProductRequest
    q := r.db.Preload("ReportedBy").Order("created_at desc")
    if status != "" {
        q = q.Where("status = ?", status)
    }
    return list, q.Find(&list).Error
}

func (r *productRequestRepository) UpdateStatus(id string, status domain.ProductRequestStatus) error {
    return r.db.Model(&domain.ProductRequest{}).
        Where("id = ?", id).
        Update("status", status).Error
}