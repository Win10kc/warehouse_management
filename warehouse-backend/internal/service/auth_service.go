package service

import (
    "context"
    "errors"
    "fmt"
    "time"
    "warehouse-backend/config"
    "warehouse-backend/internal/domain"
    "warehouse-backend/internal/repository"

    "github.com/golang-jwt/jwt/v5"
    "github.com/redis/go-redis/v9"
    "golang.org/x/crypto/bcrypt"
)

type AuthService interface {
    Login(username, password string) (*LoginResult, error)
    RefreshAccessToken(refreshToken string) (string, error)
    Logout(refreshToken string) error
    GetUserByID(id string) (*domain.User, error)
}

type LoginResult struct {
    AccessToken  string      `json:"access_token"`
    RefreshToken string      `json:"refresh_token"`
    User         *UserDTO    `json:"user"`
}

type UserDTO struct {
    ID       string `json:"id"`
    Username string `json:"username"`
    FullName string `json:"full_name"`
    Role     string `json:"role"`
}

type Claims struct {
    UserID   string `json:"user_id"`
    Username string `json:"username"`
    Role     string `json:"role"`
    jwt.RegisteredClaims
}

type authService struct {
    userRepo repository.UserRepository
    rdb      *redis.Client
    cfg      *config.Config
}

func NewAuthService(userRepo repository.UserRepository, rdb *redis.Client, cfg *config.Config) AuthService {
    return &authService{userRepo: userRepo, rdb: rdb, cfg: cfg}
}

func (s *authService) Login(username, password string) (*LoginResult, error) {
    user, err := s.userRepo.FindByUsername(username)
    if err != nil {
        return nil, errors.New("invalid credentials")
    }

    if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
        return nil, errors.New("invalid credentials")
    }

    accessToken, err := s.generateAccessToken(user)
    if err != nil {
        return nil, err
    }

    refreshToken, err := s.generateRefreshToken(user)
    if err != nil {
        return nil, err
    }

    // Lưu refresh token vào Redis, TTL 7 ngày
    ctx := context.Background()
    key := fmt.Sprintf("refresh:%s:%s", user.ID.String(), refreshToken[:16])
    s.rdb.Set(ctx, key, user.ID.String(), 7*24*time.Hour)

    return &LoginResult{
        AccessToken:  accessToken,
        RefreshToken: refreshToken,
        User: &UserDTO{
            ID:       user.ID.String(),
            Username: user.Username,
            FullName: user.FullName,
            Role:     string(user.Role),
        },
    }, nil
}

func (s *authService) GetUserByID(id string) (*domain.User, error) {
    return s.userRepo.FindByID(id)
}

func (s *authService) RefreshAccessToken(refreshToken string) (string, error) {
    claims, err := s.parseToken(refreshToken)
    if err != nil {
        return "", errors.New("invalid refresh token")
    }
    user, err := s.userRepo.FindByID(claims.UserID)
    if err != nil {
        return "", errors.New("user not found")
    }
    return s.generateAccessToken(user)
}

func (s *authService) Logout(refreshToken string) error {
    // Đơn giản: client xóa token phía client là đủ cho MVP
    // Production: blacklist token trong Redis
    return nil
}

func (s *authService) generateAccessToken(user *domain.User) (string, error) {
    claims := Claims{
        UserID:   user.ID.String(),
        Username: user.Username,
        Role:     string(user.Role),
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(8 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(s.cfg.JWT.Secret))
}

func (s *authService) generateRefreshToken(user *domain.User) (string, error) {
    claims := Claims{
        UserID:   user.ID.String(),
        Username: user.Username,
        Role:     string(user.Role),
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
        },
    }
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(s.cfg.JWT.Secret))
}

func (s *authService) parseToken(tokenStr string) (*Claims, error) {
    token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
        if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("unexpected signing method")
        }
        return []byte(s.cfg.JWT.Secret), nil
    })
    if err != nil || !token.Valid {
        return nil, errors.New("invalid token")
    }
    claims, ok := token.Claims.(*Claims)
    if !ok {
        return nil, errors.New("invalid claims")
    }
    return claims, nil
}