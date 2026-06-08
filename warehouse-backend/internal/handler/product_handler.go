package handler

import (
	"strconv"

	"warehouse-backend/internal/repository"
	"warehouse-backend/internal/service"
	"warehouse-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type ProductHandler struct {
	productService service.ProductService
}

func NewProductHandler(productService service.ProductService) *ProductHandler {
	return &ProductHandler{productService: productService}
}

func (h *ProductHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	isActiveStr := c.Query("is_active")

	filter := repository.ProductFilter{
		Search:     c.Query("search"),
		Category:   c.Query("category"),
		SupplierID: c.Query("supplier_id"), // filter theo NCC
		Page:       page,
		Limit:      limit,
	}

	if isActiveStr == "true" {
		t := true
		filter.IsActive = &t
	} else if isActiveStr == "false" {
		f := false
		filter.IsActive = &f
	}

	products, total, err := h.productService.List(filter)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"items": products,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *ProductHandler) GetByID(c *gin.Context) {
	p, err := h.productService.GetByID(c.Param("id"))
	if err != nil {
		response.NotFound(c, "product not found")
		return
	}
	response.OK(c, p)
}

func (h *ProductHandler) GetByCode(c *gin.Context) {
	p, scanType, err := h.productService.GetByCode(c.Param("code"))
	if err != nil {
		response.NotFound(c, "not found")
		return
	}
	response.OK(c, gin.H{
		"product":   p,
		"scan_type": scanType,
	})
}

func (h *ProductHandler) GenerateQR(c *gin.Context) {
	p, b64, err := h.productService.GenerateQR(c.Param("id"))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, gin.H{
		"product":  p,
		"qr_image": "data:image/png;base64," + b64,
		"qr_value": *p.QRCode,
	})
}

func (h *ProductHandler) Create(c *gin.Context) {
	var req service.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	p, err := h.productService.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, p)
}

func (h *ProductHandler) Update(c *gin.Context) {
	var req service.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	p, err := h.productService.Update(c.Param("id"), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, p)
}

func (h *ProductHandler) Delete(c *gin.Context) {
	if err := h.productService.Delete(c.Param("id")); err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "deleted"})
}