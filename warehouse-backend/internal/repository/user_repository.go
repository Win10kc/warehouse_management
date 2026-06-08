package repository

import (
    "warehouse-backend/internal/domain"
    "gorm.io/gorm"
)

type UserRepository interface {
    FindByUsername(username string) (*domain.User, error)
    FindByID(id string) (*domain.User, error)
    FindByIDAny(id string) (*domain.User, error)   // ← THÊM: không filter is_active
    List(page, limit int) ([]domain.User, int64, error)
    Create(user *domain.User) error
    Update(user *domain.User) error
}

type userRepository struct {
    db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
    return &userRepository{db: db}
}

func (r *userRepository) FindByUsername(username string) (*domain.User, error) {
    var user domain.User
    err := r.db.Where("username = ? AND is_active = true", username).First(&user).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *userRepository) FindByID(id string) (*domain.User, error) {
    var user domain.User
    err := r.db.Where("id = ? AND is_active = true", id).First(&user).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *userRepository) FindByIDAny(id string) (*domain.User, error) {
    var user domain.User
    err := r.db.Where("id = ?", id).First(&user).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *userRepository) List(page, limit int) ([]domain.User, int64, error) {
    var users []domain.User
    var total int64
    r.db.Model(&domain.User{}).Count(&total)
    if page < 1 { page = 1 }
    if limit < 1 || limit > 100 { limit = 20 }
    err := r.db.
        Order("created_at DESC").
        Offset((page - 1) * limit).
        Limit(limit).
        Find(&users).Error
    return users, total, err
}

func (r *userRepository) Create(user *domain.User) error {
    return r.db.Create(user).Error
}

func (r *userRepository) Update(user *domain.User) error {
    return r.db.Save(user).Error
}