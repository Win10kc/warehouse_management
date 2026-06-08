package handler

import (
	"net/http"

	"warehouse-backend/internal/repository"
	"warehouse-backend/internal/service"
	"warehouse-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type StockHandler struct {
	repo  repository.StockRepository
	txSvc service.TransactionService
}

func NewStockHandler(repo repository.StockRepository, txSvc service.TransactionService) *StockHandler {
	return &StockHandler{repo: repo, txSvc: txSvc}
}

// GET /api/v1/stock
func (h *StockHandler) ListSummaries(c *gin.Context) {
	list, err := h.repo.ListSummaries()
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, list)
}

// GET /api/v1/stock/:productId
func (h *StockHandler) GetByProduct(c *gin.Context) {
	productID := c.Param("productId")

	summary, err := h.repo.GetSummary(productID)
	if err != nil {
		response.NotFound(c, "stock summary not found")
		return
	}

	items, err := h.repo.ListByProduct(productID)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"summary": summary,
		"items":   items,
	})
}

// GET /api/v1/stock/locations?search=xxx
func (h *StockHandler) ListByBin(c *gin.Context) {
	search := c.Query("search")
	rows, err := h.repo.ListByBin(search)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, rows)
}

// POST /api/v1/stock/count
func (h *StockHandler) StockCount(c *gin.Context) {
	userID := c.GetString("user_id")

	var req service.StockCountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	tx, err := h.txSvc.CreateCount(userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	response.OK(c, tx)
}