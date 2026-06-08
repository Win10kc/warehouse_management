package handler

import (
	"warehouse-backend/internal/service"
	"warehouse-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

// ─── Handler struct ───────────────────────────────────────────

type WarehouseHandler struct {
	warehouseSvc service.WarehouseService
	zoneSvc      service.ZoneService
	rackSvc      service.RackService
	binSvc       service.BinService
}

func NewWarehouseHandler(
	warehouseSvc service.WarehouseService,
	zoneSvc service.ZoneService,
	rackSvc service.RackService,
	binSvc service.BinService,
) *WarehouseHandler {
	return &WarehouseHandler{warehouseSvc, zoneSvc, rackSvc, binSvc}
}

// ─── Warehouse ───────────────────────────────────────────────

func (h *WarehouseHandler) List(c *gin.Context) {
	list, err := h.warehouseSvc.List()
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, list)
}

func (h *WarehouseHandler) GetByID(c *gin.Context) {
	w, err := h.warehouseSvc.GetByID(c.Param("id"))
	if err != nil {
		response.NotFound(c, "warehouse not found")
		return
	}
	response.OK(c, w)
}

func (h *WarehouseHandler) Create(c *gin.Context) {
	var req service.CreateWarehouseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	w, err := h.warehouseSvc.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, w)
}

func (h *WarehouseHandler) Update(c *gin.Context) {
	var req service.UpdateWarehouseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	w, err := h.warehouseSvc.Update(c.Param("id"), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, w)
}

func (h *WarehouseHandler) Delete(c *gin.Context) {
	if err := h.warehouseSvc.Delete(c.Param("id")); err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "deleted"})
}

// ─── Zone ────────────────────────────────────────────────────

func (h *WarehouseHandler) ListZones(c *gin.Context) {
	list, err := h.zoneSvc.ListByWarehouse(c.Param("id"))
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, list)
}

func (h *WarehouseHandler) CreateZone(c *gin.Context) {
	var req service.CreateZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	req.WarehouseID = c.Param("id") // inject từ URL path
	z, err := h.zoneSvc.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, z)
}

func (h *WarehouseHandler) UpdateZone(c *gin.Context) {
	var req service.UpdateZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	z, err := h.zoneSvc.Update(c.Param("zoneId"), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, z)
}

func (h *WarehouseHandler) DeleteZone(c *gin.Context) {
	if err := h.zoneSvc.Delete(c.Param("zoneId")); err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "deleted"})
}

// ─── Rack ────────────────────────────────────────────────────

func (h *WarehouseHandler) ListRacks(c *gin.Context) {
	list, err := h.rackSvc.ListByZone(c.Param("zoneId"))
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, list)
}

func (h *WarehouseHandler) CreateRack(c *gin.Context) {
	var req service.CreateRackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	req.ZoneID = c.Param("zoneId") // inject từ URL path
	rack, err := h.rackSvc.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, rack)
}

func (h *WarehouseHandler) UpdateRack(c *gin.Context) {
	var req service.UpdateRackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	rack, err := h.rackSvc.Update(c.Param("rackId"), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, rack)
}

func (h *WarehouseHandler) DeleteRack(c *gin.Context) {
	if err := h.rackSvc.Delete(c.Param("rackId")); err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "deleted"})
}

// ─── Bin ─────────────────────────────────────────────────────

func (h *WarehouseHandler) ListBins(c *gin.Context) {
	list, err := h.binSvc.ListByRack(c.Param("rackId"))
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.OK(c, list)
}

func (h *WarehouseHandler) CreateBin(c *gin.Context) {
	var req service.CreateBinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	req.RackID = c.Param("rackId") // inject từ URL path
	bin, err := h.binSvc.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, bin)
}

func (h *WarehouseHandler) UpdateBin(c *gin.Context) {
	var req service.UpdateBinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	bin, err := h.binSvc.Update(c.Param("binId"), req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, bin)
}

func (h *WarehouseHandler) DeleteBin(c *gin.Context) {
	if err := h.binSvc.Delete(c.Param("binId")); err != nil {
		response.NotFound(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "deleted"})
}