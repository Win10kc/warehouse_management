package handler

import (
    "warehouse-backend/internal/service"
    "warehouse-backend/pkg/response"

    "github.com/gin-gonic/gin"
)

type AuthHandler struct {
    authService service.AuthService
}

func NewAuthHandler(authService service.AuthService) *AuthHandler {
    return &AuthHandler{authService: authService}
}

type loginRequest struct {
    Username string `json:"username" binding:"required"`
    Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
    var req loginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, "username and password are required")
        return
    }

    result, err := h.authService.Login(req.Username, req.Password)
    if err != nil {
        response.Unauthorized(c, err.Error())
        return
    }

    response.OK(c, result)
}

func (h *AuthHandler) Me(c *gin.Context) {
    userID, _ := c.Get("user_id")

    user, err := h.authService.GetUserByID(userID.(string))
    if err != nil {
        response.NotFound(c, "user not found")
        return
    }

    response.OK(c, gin.H{
        "id":        user.ID,
        "username":  user.Username,
        "full_name": user.FullName,
        "role":      user.Role,
        "is_active": user.IsActive,
    })
}