package middleware

import (
    "fmt"
    "strings"
    "warehouse-backend/internal/service"
    "warehouse-backend/pkg/response"

    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
)

func ValidateJWT(jwtSecret string) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
            response.Unauthorized(c, "missing token")
            c.Abort()
            return
        }

        tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
        claims := &service.Claims{}

        token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
            if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fmt.Errorf("unexpected signing method")
            }
            return []byte(jwtSecret), nil
        })

        if err != nil || !token.Valid {
            response.Unauthorized(c, "invalid or expired token")
            c.Abort()
            return
        }

        // Gắn thông tin user vào context để handler dùng
        c.Set("user_id", claims.UserID)
        c.Set("username", claims.Username)
        c.Set("role", claims.Role)
        c.Next()
    }
}

// RequireRole kiểm tra role, truyền vào danh sách role được phép
// Ví dụ: RequireRole("admin", "manager")
func RequireRole(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userRole, exists := c.Get("role")
        if !exists {
            response.Unauthorized(c, "missing role")
            c.Abort()
            return
        }

        for _, r := range roles {
            if r == userRole.(string) {
                c.Next()
                return
            }
        }

        response.Forbidden(c)
        c.Abort()
    }
}