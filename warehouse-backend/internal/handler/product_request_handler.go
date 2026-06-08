package handler

import (
    "warehouse-backend/internal/domain"
    "warehouse-backend/internal/repository"
    "warehouse-backend/pkg/response"
    ws "warehouse-backend/internal/websocket"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

type ProductRequestHandler struct {
    repo repository.ProductRequestRepository
    hub  *ws.Hub
}

func NewProductRequestHandler(repo repository.ProductRequestRepository, hub *ws.Hub) *ProductRequestHandler {
    return &ProductRequestHandler{repo: repo, hub: hub}
}

type createProductRequestBody struct {
    RawCode       string `json:"raw_code"       binding:"required"`
    SuggestedName string `json:"suggested_name" binding:"required"`
    SupplierName  string `json:"supplier_name"`
    Note          string `json:"note"`
}

// POST /api/v1/product-requests
func (h *ProductRequestHandler) Create(c *gin.Context) {
    var body createProductRequestBody
    if err := c.ShouldBindJSON(&body); err != nil {
        response.BadRequest(c, err.Error())
        return
    }

    userIDStr, _ := c.Get("user_id")
    userID, err := uuid.Parse(userIDStr.(string))
    if err != nil {
        response.Unauthorized(c, "invalid user")
        return
    }

    req := &domain.ProductRequest{
        RawCode:       body.RawCode,
        SuggestedName: body.SuggestedName,
        SupplierName:  body.SupplierName, 
        Note:          body.Note,
        ReportedByID:  userID,
        Status:        domain.ProductRequestPending,
    }

    if err := h.repo.Create(req); err != nil {
        response.InternalError(c, err.Error())
        return
    }

    // Notify admin real-time qua WebSocket
    h.hub.Publish(ws.EventAlert, ws.AlertPayload{
        Message: "📋 Nhân viên báo cáo sản phẩm mới: " + body.SuggestedName,
        Level:   "warning",
    })

    response.Created(c, req)
}

// GET /api/v1/product-requests?status=pending
func (h *ProductRequestHandler) List(c *gin.Context) {
    status := c.Query("status")
    list, err := h.repo.List(status)
    if err != nil {
        response.InternalError(c, err.Error())
        return
    }
    response.OK(c, list)
}

// PUT /api/v1/product-requests/:id/resolve
func (h *ProductRequestHandler) Resolve(c *gin.Context) {
    if err := h.repo.UpdateStatus(c.Param("id"), domain.ProductRequestResolved); err != nil {
        response.NotFound(c, err.Error())
        return
    }
    response.OK(c, gin.H{"message": "resolved"})
}

// PUT /api/v1/product-requests/:id/reject
func (h *ProductRequestHandler) Reject(c *gin.Context) {
    if err := h.repo.UpdateStatus(c.Param("id"), domain.ProductRequestRejected); err != nil {
        response.NotFound(c, err.Error())
        return
    }
    response.OK(c, gin.H{"message": "rejected"})
}