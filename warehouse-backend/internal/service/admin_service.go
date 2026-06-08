package service

import (
    "errors"
    "warehouse-backend/internal/domain"
    "warehouse-backend/internal/repository"

    "golang.org/x/crypto/bcrypt"
)

type CreateUserRequest struct {
    Username string `json:"username" binding:"required,min=3,max=50"`
    Password string `json:"password" binding:"required,min=6"`
    FullName string `json:"full_name" binding:"required"`
    Role     string `json:"role"     binding:"required,oneof=admin manager warehouse"`
}

type UpdateUserRequest struct {
    FullName string `json:"full_name"`
    Role     string `json:"role" binding:"omitempty,oneof=admin manager warehouse"`
    Password string `json:"password"`  // optional — hashed nếu có
}

type AdminService interface {
    ListUsers(page, limit int) ([]domain.User, int64, error)
    CreateUser(req CreateUserRequest) (*domain.User, error)
    UpdateUser(id string, req UpdateUserRequest) (*domain.User, error)
    DisableUser(id string) error
    EnableUser(id string) error
}

type adminService struct {
    userRepo repository.UserRepository
}

func NewAdminService(userRepo repository.UserRepository) AdminService {
    return &adminService{userRepo: userRepo}
}

func (s *adminService) ListUsers(page, limit int) ([]domain.User, int64, error) {
    return s.userRepo.List(page, limit)
}

func (s *adminService) CreateUser(req CreateUserRequest) (*domain.User, error) {
    hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        return nil, err
    }
    user := &domain.User{
        Username:     req.Username,
        PasswordHash: string(hash),
        FullName:     req.FullName,
        Role:         domain.Role(req.Role),
        IsActive:     true,
    }
    if err := s.userRepo.Create(user); err != nil {
        return nil, errors.New("username already exists")
    }
    user.PasswordHash = "" // không trả về hash
    return user, nil
}

func (s *adminService) UpdateUser(id string, req UpdateUserRequest) (*domain.User, error) {
    user, err := s.userRepo.FindByIDAny(id)
    if err != nil {
        return nil, errors.New("user not found")
    }
    if req.FullName != "" {
        user.FullName = req.FullName
    }
    if req.Role != "" {
        user.Role = domain.Role(req.Role)
    }
    if req.Password != "" {
        hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
        if err != nil {
            return nil, err
        }
        user.PasswordHash = string(hash)
    }
    if err := s.userRepo.Update(user); err != nil {
        return nil, err
    }
    user.PasswordHash = ""
    return user, nil
}

func (s *adminService) DisableUser(id string) error {
    user, err := s.userRepo.FindByIDAny(id)
    if err != nil {
        return errors.New("user not found")
    }
    user.IsActive = false
    return s.userRepo.Update(user)
}

func (s *adminService) EnableUser(id string) error {
    user, err := s.userRepo.FindByIDAny(id)
    if err != nil {
        return errors.New("user not found")
    }
    user.IsActive = true
    return s.userRepo.Update(user)
}