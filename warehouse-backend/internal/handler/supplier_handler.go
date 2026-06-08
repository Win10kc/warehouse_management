package handler

import (
	"warehouse-backend/internal/service"
	"warehouse-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type SupplierHandler struct {
	svc service.SupplierService
}

func NewSupplierHandler(svc service.SupplierService) *SupplierHandler {
	return &SupplierHandler{svc: svc}
}

func (h *SupplierHandler) List(c *gin.Context) {
	items, err := h.svc.List()
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, items)
}

func (h *SupplierHandler) GetByID(c *gin.Context) {
	s, err := h.svc.GetByID(c.Param("id"))
	if err != nil {
		response.NotFound(c, "supplier not found")
		return
	}
	response.OK(c, s)
}

func (h *SupplierHandler) Create(c *gin.Context) {
	var req service.CreateSupplierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	s, err := h.svc.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, s)
}

func (h *SupplierHandler) Update(c *gin.Context) {
	var req service.UpdateSupplierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	s, err := h.svc.Update(c.Param("id"), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, s)
}

func (h *SupplierHandler) Delete(c *gin.Context) {
	if err := h.svc.Delete(c.Param("id")); err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "deleted"})
}