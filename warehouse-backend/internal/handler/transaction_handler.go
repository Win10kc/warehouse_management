package handler

import (
	"strconv"

	"warehouse-backend/internal/repository"
	"warehouse-backend/internal/service"
	"warehouse-backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TransactionHandler struct {
	svc service.TransactionService
}

func NewTransactionHandler(svc service.TransactionService) *TransactionHandler {
	return &TransactionHandler{svc: svc}
}

// GET /api/v1/transactions?type=import&status=pending&page=1&limit=20
func (h *TransactionHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	var createdByID string
    if c.Query("created_by_me") == "true" {
        if uid, exists := c.Get("user_id"); exists {
            createdByID = uid.(string)
        }
    }

	filter := repository.TransactionFilter{
		Type:   c.Query("type"),
		Status: c.Query("status"),
		CreatedByID: createdByID,
		Page:   page,
		Limit:  limit,
	}

	list, total, err := h.svc.List(filter)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, gin.H{
		"items": list,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GET /api/v1/transactions/:id
func (h *TransactionHandler) GetByID(c *gin.Context) {
	t, err := h.svc.GetByID(c.Param("id"))
	if err != nil {
		response.NotFound(c, "transaction not found")
		return
	}
	response.OK(c, t)
}

// POST /api/v1/transactions
func (h *TransactionHandler) Create(c *gin.Context) {
	var req service.CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	// user_id được set bởi ValidateJWT middleware với key "user_id"
	userID, _ := c.Get("user_id")
	t, err := h.svc.Create(userID.(string), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, t)
}

// PUT /api/v1/transactions/:id/approve
func (h *TransactionHandler) Approve(c *gin.Context) {
	userID, _ := c.Get("user_id")
	t, err := h.svc.Approve(c.Param("id"), userID.(string))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, t)
}

// PUT /api/v1/transactions/:id/complete
func (h *TransactionHandler) Complete(c *gin.Context) {
	var req service.CompleteTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	t, err := h.svc.Complete(c.Param("id"), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, t)
}

// PUT /api/v1/transactions/:id/reject
func (h *TransactionHandler) Reject(c *gin.Context) {
	if err := h.svc.Reject(c.Param("id")); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "rejected"})
}

// Handler
func (h *TransactionHandler) SuggestBin(c *gin.Context) {
    txID, err := uuid.Parse(c.Param("id"))
    if err != nil { response.BadRequest(c, "transaction id không hợp lệ"); return }

    var req struct {
        ItemID uuid.UUID `json:"item_id" binding:"required"`
        BinID  uuid.UUID `json:"bin_id"  binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, "thiếu item_id hoặc bin_id")
        return
    }

    managerID, _ := c.Get("user_id")
    if err := h.svc.SuggestBin(txID, req.ItemID, req.BinID, managerID.(string)); err != nil {
        response.BadRequest(c, err.Error())
        return
    }
    response.OK(c, gin.H{"message": "đã đề xuất bin"})
}

func (h *TransactionHandler) ApplyBin(c *gin.Context) {
    txID, err := uuid.Parse(c.Param("id"))
    if err != nil {
        response.BadRequest(c, "transaction id không hợp lệ")
        return
    }

    var req struct {
        ItemID uuid.UUID `json:"item_id" binding:"required"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        response.BadRequest(c, "thiếu item_id")
        return
    }

    if err := h.svc.ApplyBin(txID, req.ItemID); err != nil {
        response.BadRequest(c, err.Error())
        return
    }
    response.OK(c, gin.H{"message": "đã áp dụng bin đề xuất thành from_bin"})
}