package handler

import (
    "strconv"
    "warehouse-backend/internal/service"
    "warehouse-backend/pkg/response"

    "github.com/gin-gonic/gin"
)

type AdminHandler struct {
    svc service.AdminService
}

func NewAdminHandler(svc service.AdminService) *AdminHandler {
    return &AdminHandler{svc: svc}
}

// GET /api/v1/admin/users?page=1&limit=20
func (h *AdminHandler) ListUsers(c *gin.Context) {
    page,  _ := strconv.Atoi(c.DefaultQuery("page",  "1"))
    limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
    users, total, err := h.svc.ListUsers(page, limit)
    if err != nil {
        response.InternalError(c, err.Error())
        return
    }
    response.OK(c, gin.H{"items": users, "total": total, "page": page, "limit": limit})
}

// POST /api/v1/admin/users
func (h *AdminHandler) CreateUser(c *gin.Context) {
    var req service.CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, err.Error())
        return
    }
    user, err := h.svc.CreateUser(req)
    if err != nil {
        response.BadRequest(c, err.Error())
        return
    }
    response.Created(c, user)
}

// PUT /api/v1/admin/users/:id
func (h *AdminHandler) UpdateUser(c *gin.Context) {
    var req service.UpdateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, err.Error())
        return
    }
    user, err := h.svc.UpdateUser(c.Param("id"), req)
    if err != nil {
        response.NotFound(c, err.Error())
        return
    }
    response.OK(c, user)
}

// PUT /api/v1/admin/users/:id/disable
func (h *AdminHandler) DisableUser(c *gin.Context) {
    // Không cho phép admin tự disable chính mình
    selfID, _ := c.Get("user_id")
    if c.Param("id") == selfID.(string) {
        response.BadRequest(c, "cannot disable your own account")
        return
    }
    if err := h.svc.DisableUser(c.Param("id")); err != nil {
        response.NotFound(c, err.Error())
        return
    }
    response.OK(c, gin.H{"message": "user disabled"})
}

// PUT /api/v1/admin/users/:id/enable
func (h *AdminHandler) EnableUser(c *gin.Context) {
    if err := h.svc.EnableUser(c.Param("id")); err != nil {
        response.NotFound(c, err.Error())
        return
    }
    response.OK(c, gin.H{"message": "user enabled"})
}