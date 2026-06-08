package service

import (
	"warehouse-backend/internal/domain"
	ws "warehouse-backend/internal/websocket"
)

type AlertService interface {
	CheckAndAlert(product *domain.Product, summary *domain.StockSummary)
}

type alertService struct {
	hub *ws.Hub
}

func NewAlertService(hub *ws.Hub) AlertService {
	return &alertService{hub: hub}
}

func (s *alertService) CheckAndAlert(product *domain.Product, summary *domain.StockSummary) {
	if product == nil || summary == nil || product.MinStock <= 0 {
		return
	}

	qty := summary.TotalQuantity
	min := product.MinStock

	var level string
	switch {
	case qty == 0:
		level = "critical"
	case qty <= min/2:
		level = "critical"
	case qty <= min:
		level = "warning"
	default:
		return // tồn kho ổn, không alert
	}

	s.hub.Publish(ws.EventAlert, ws.AlertPayload{
		ProductID:   product.ID.String(),
		ProductName: product.Name,
		CurrentQty:  qty,
		MinStock:    min,
		Level:       level,
	})
}