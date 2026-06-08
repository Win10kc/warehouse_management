package service

import (
	"errors"
	"fmt"
	"time"

	"warehouse-backend/internal/domain"
	"warehouse-backend/internal/repository"
	ws "warehouse-backend/internal/websocket"

	"github.com/google/uuid"
)

// ─── Request types ────────────────────────────────────────────

type TransactionItemInput struct {
	ProductID         string `json:"product_id"         binding:"required"`
	FromBinID         string `json:"from_bin_id"`
	ToBinID           string `json:"to_bin_id"`
	QuantityRequested int    `json:"quantity_requested" binding:"required,min=1"`
	ScanMethod        string `json:"scan_method"`
}

type CreateTransactionRequest struct {
	Type  domain.TransactionType `json:"type"  binding:"required,oneof=import export transfer"`
	Note  string                 `json:"note"`
	Items []TransactionItemInput `json:"items" binding:"required,min=1"`
}

type CompleteItemInput struct {
	ProductID      string `json:"product_id"      binding:"required"`
	FromBinID      string `json:"from_bin_id"`
	ToBinID        string `json:"to_bin_id"`
	QuantityActual int    `json:"quantity_actual" binding:"min=0"`
}

type CompleteTransactionRequest struct {
	Items []CompleteItemInput `json:"items" binding:"required,min=1"`
}

type StockCountItem struct {
	ProductID string `json:"product_id" binding:"required"`
	ActualQty int    `json:"actual_qty" binding:"min=0"`
}

type StockCountRequest struct {
	BinID string           `json:"bin_id" binding:"required"`
	Note  string           `json:"note"`
	Items []StockCountItem `json:"items"  binding:"required,min=1"`
}

// ─── Interface ────────────────────────────────────────────────

type TransactionService interface {
	List(filter repository.TransactionFilter) ([]domain.Transaction, int64, error)
	GetByID(id string) (*domain.Transaction, error)
	Create(createdByID string, req CreateTransactionRequest) (*domain.Transaction, error)
	Approve(id string, approvedByID string) (*domain.Transaction, error)
	Complete(id string, req CompleteTransactionRequest) (*domain.Transaction, error)
	Reject(id string) error
	SuggestBin(txID uuid.UUID, itemID uuid.UUID, binID uuid.UUID, managerID string) error
	CreateCount(createdByID string, req StockCountRequest) (*domain.Transaction, error)
}

// ─── Implementation ───────────────────────────────────────────

type transactionService struct {
	txRepo      repository.TransactionRepository
	stockRepo   repository.StockRepository
	productRepo repository.ProductRepository
	binRepo     repository.BinRepository
	hub         *ws.Hub
	alertSvc    AlertService
}

func NewTransactionService(
	txRepo repository.TransactionRepository,
	stockRepo repository.StockRepository,
	productRepo repository.ProductRepository,
	binRepo repository.BinRepository,
	hub *ws.Hub,
	alertSvc AlertService,
) TransactionService {
	return &transactionService{
		txRepo:      txRepo,
		stockRepo:   stockRepo,
		productRepo: productRepo,
		binRepo:     binRepo,
		hub:         hub,
		alertSvc:    alertSvc,
	}
}

func (s *transactionService) List(filter repository.TransactionFilter) ([]domain.Transaction, int64, error) {
	return s.txRepo.List(filter)
}

func (s *transactionService) GetByID(id string) (*domain.Transaction, error) {
	return s.txRepo.FindByID(id)
}

// Create — tạo phiếu ở trạng thái pending
func (s *transactionService) Create(createdByID string, req CreateTransactionRequest) (*domain.Transaction, error) {
	userID, err := uuid.Parse(createdByID)
	if err != nil {
		return nil, errors.New("invalid user_id")
	}

	t := &domain.Transaction{
		ID:          uuid.New(),
		Code:        generateTxCode(req.Type),
		Type:        req.Type,
		Status:      domain.StatusPending,
		CreatedByID: userID,
		Note:        req.Note,
	}

	items := make([]domain.TransactionItem, 0, len(req.Items))
	for _, i := range req.Items {
		productID, err := uuid.Parse(i.ProductID)
		if err != nil {
			return nil, fmt.Errorf("invalid product_id: %s", i.ProductID)
		}

		if (req.Type == domain.TypeExport || req.Type == domain.TypeTransfer) && i.FromBinID == "" {
			return nil, fmt.Errorf("from_bin_id required for %s", req.Type)
		}
		if (req.Type == domain.TypeImport || req.Type == domain.TypeTransfer) && i.ToBinID == "" {
			return nil, fmt.Errorf("to_bin_id required for %s", req.Type)
		}

		item := domain.TransactionItem{
			ID:                uuid.New(),
			TransactionID:     t.ID,
			ProductID:         productID,
			QuantityRequested: i.QuantityRequested,
			ScanMethod:        i.ScanMethod,
		}

		if i.FromBinID != "" {
			id, err := uuid.Parse(i.FromBinID)
			if err != nil {
				return nil, fmt.Errorf("invalid from_bin_id: %s", i.FromBinID)
			}
			item.FromBinID = &id
		}
		if i.ToBinID != "" {
			id, err := uuid.Parse(i.ToBinID)
			if err != nil {
				return nil, fmt.Errorf("invalid to_bin_id: %s", i.ToBinID)
			}
			item.ToBinID = &id
		}

		items = append(items, item)
	}

	db := s.txRepo.GetDB()
	dbTx := db.Begin()
	if dbTx.Error != nil {
		return nil, dbTx.Error
	}

	if err := s.txRepo.Create(dbTx, t); err != nil {
		dbTx.Rollback()
		return nil, err
	}
	if err := s.txRepo.AddItems(dbTx, items); err != nil {
		dbTx.Rollback()
		return nil, err
	}
	if err := dbTx.Commit().Error; err != nil {
		return nil, err
	}

	result, err := s.txRepo.FindByID(t.ID.String())
	if err != nil {
		return nil, err
	}

	s.hub.Publish(ws.EventTransactionUpdate, ws.TransactionUpdatePayload{
		TransactionID:   result.ID.String(),
		TransactionCode: result.Code,
		Status:          string(result.Status),
		CreatedByID:     result.CreatedByID.String(),
	})

	return result, nil
}

// CreateCount — tạo phiếu kiểm kê (type="count") từ 1 bin
// QuantityRequested = tồn kho DB hiện tại (baseline)
// QuantityActual    = số thực tế staff đếm được (set ngay lúc tạo)
// Khi Complete: delta = actual - requested → cộng/trừ vào stock
func (s *transactionService) CreateCount(createdByID string, req StockCountRequest) (*domain.Transaction, error) {
	userID, err := uuid.Parse(createdByID)
	if err != nil {
		return nil, errors.New("invalid user_id")
	}

	binID, err := uuid.Parse(req.BinID)
	if err != nil {
		return nil, errors.New("invalid bin_id")
	}

	t := &domain.Transaction{
		ID:          uuid.New(),
		Code:        generateTxCode(domain.TypeCount),
		Type:        domain.TypeCount,
		Status:      domain.StatusPending,
		CreatedByID: userID,
		Note:        req.Note,
	}

	items := make([]domain.TransactionItem, 0, len(req.Items))
	for _, i := range req.Items {
		productID, err := uuid.Parse(i.ProductID)
		if err != nil {
			return nil, fmt.Errorf("invalid product_id: %s", i.ProductID)
		}

		// Lấy tồn kho hiện tại trong bin làm baseline
		dbQty := 0
		stockItem, err := s.stockRepo.GetItem(i.ProductID, req.BinID)
		if err == nil && stockItem != nil {
			dbQty = stockItem.Quantity
		}

		item := domain.TransactionItem{
			ID:                uuid.New(),
			TransactionID:     t.ID,
			ProductID:         productID,
			ToBinID:           &binID,  // bin đang được kiểm kê
			QuantityRequested: dbQty,   // baseline = DB qty lúc tạo phiếu
			QuantityActual:    i.ActualQty,
			ScanMethod:        "count",
		}
		items = append(items, item)
	}

	db := s.txRepo.GetDB()
	dbTx := db.Begin()
	if dbTx.Error != nil {
		return nil, dbTx.Error
	}

	if err := s.txRepo.Create(dbTx, t); err != nil {
		dbTx.Rollback()
		return nil, err
	}
	if err := s.txRepo.AddItems(dbTx, items); err != nil {
		dbTx.Rollback()
		return nil, err
	}
	if err := dbTx.Commit().Error; err != nil {
		return nil, err
	}

	result, err := s.txRepo.FindByID(t.ID.String())
	if err != nil {
		return nil, err
	}

	s.hub.Publish(ws.EventTransactionUpdate, ws.TransactionUpdatePayload{
		TransactionID:   result.ID.String(),
		TransactionCode: result.Code,
		Status:          string(result.Status),
		CreatedByID:     result.CreatedByID.String(),
	})

	return result, nil
}

// Approve — pending → processing
func (s *transactionService) Approve(id string, approvedByID string) (*domain.Transaction, error) {
	t, err := s.txRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("transaction not found")
	}
	if t.Status != domain.StatusPending {
		return nil, fmt.Errorf("cannot approve: status is '%s'", t.Status)
	}

	// Kiểm tra tồn kho cho phiếu xuất/chuyển (không áp dụng cho count)
	if t.Type == domain.TypeExport || t.Type == domain.TypeTransfer {
		for _, item := range t.Items {
			summary, err := s.stockRepo.GetSummary(item.ProductID.String())
			if err != nil || summary == nil {
				return nil, fmt.Errorf("không tìm thấy tồn kho cho sản phẩm %s", item.ProductID)
			}
			if summary.TotalQuantity < item.QuantityRequested {
				return nil, fmt.Errorf(
					"sản phẩm '%s' không đủ tồn kho: cần %d, hiện có %d",
					item.Product.Name,
					item.QuantityRequested,
					summary.TotalQuantity,
				)
			}
		}
	}

	approverID, err := uuid.Parse(approvedByID)
	if err != nil {
		return nil, errors.New("invalid approver id")
	}

	now := time.Now()
	fields := map[string]any{
		"status":         domain.StatusProcessing,
		"approved_by_id": approverID,
		"approved_at":    now,
	}

	if err := s.txRepo.UpdateFields(s.txRepo.GetDB(), id, fields); err != nil {
		return nil, err
	}

	t.Status = domain.StatusProcessing
	t.ApprovedByID = &approverID
	t.ApprovedAt = &now
	s.hub.Publish(ws.EventTransactionUpdate, ws.TransactionUpdatePayload{
		TransactionID:   t.ID.String(),
		TransactionCode: t.Code,
		Status:          "processing",
		CreatedByID:     t.CreatedByID.String(),
	})
	return t, nil
}

// Complete — processing → done, ghi stock, broadcast WS
func (s *transactionService) Complete(id string, req CompleteTransactionRequest) (*domain.Transaction, error) {
	t, err := s.txRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("transaction not found")
	}
	if t.Status != domain.StatusProcessing {
		return nil, fmt.Errorf("cannot complete: status is '%s'", t.Status)
	}

	db := s.txRepo.GetDB()
	dbTx := db.Begin()
	if dbTx.Error != nil {
		return nil, dbTx.Error
	}

	for _, actual := range req.Items {
		productID, err := uuid.Parse(actual.ProductID)
		if err != nil {
			dbTx.Rollback()
			return nil, fmt.Errorf("invalid product_id: %s", actual.ProductID)
		}

		if err := s.txRepo.UpdateItemActual(dbTx, id, actual.ProductID, actual.QuantityActual); err != nil {
			dbTx.Rollback()
			return nil, err
		}

		// ── Tính delta theo loại phiếu ──────────────────────
		var delta int
		switch t.Type {
		case domain.TypeCount:
			// Lấy baseline từ QuantityRequested của item gốc
			// (được set = DB qty lúc tạo phiếu trong CreateCount)
			baseline := 0
			for _, orig := range t.Items {
				if orig.ProductID.String() == actual.ProductID {
					baseline = orig.QuantityRequested
					break
				}
			}
			delta = actual.QuantityActual - baseline
			// delta > 0 → thực tế nhiều hơn DB → cộng thêm
			// delta < 0 → thực tế ít hơn DB   → trừ đi
			// delta = 0 → khớp, không cần update stock

		case domain.TypeExport:
			delta = -actual.QuantityActual

		default: // import, transfer
			delta = actual.QuantityActual
		}

		// Bỏ qua nếu không có chênh lệch (tối ưu cho count)
		if delta == 0 {
			continue
		}

		if err := s.stockRepo.UpsertSummary(dbTx, productID, delta); err != nil {
			dbTx.Rollback()
			return nil, err
		}

		// Xác định binID cần cập nhật
		var binIDStr string
		switch t.Type {
		case domain.TypeCount:
			// bin đang kiểm kê được lưu ở ToBinID trong CreateCount
			for _, orig := range t.Items {
				if orig.ProductID.String() == actual.ProductID && orig.ToBinID != nil {
					binIDStr = orig.ToBinID.String()
					break
				}
			}
		case domain.TypeExport:
			binIDStr = actual.FromBinID
		default:
			binIDStr = actual.ToBinID
		}

		if binIDStr != "" {
			binID, err := uuid.Parse(binIDStr)
			if err != nil {
				dbTx.Rollback()
				return nil, fmt.Errorf("invalid bin_id: %s", binIDStr)
			}
			if err := s.stockRepo.UpsertItem(dbTx, productID, binID, delta); err != nil {
				dbTx.Rollback()
				return nil, err
			}
		}
	}

	now := time.Now()
	if err := s.txRepo.UpdateFields(dbTx, id, map[string]any{
		"status":       domain.StatusDone,
		"completed_at": now,
	}); err != nil {
		dbTx.Rollback()
		return nil, err
	}

	if err := dbTx.Commit().Error; err != nil {
		return nil, err
	}

	// Broadcast và alert — ngoài DB transaction
	for _, actual := range req.Items {
		product, err := s.productRepo.FindByID(actual.ProductID)
		if err != nil {
			continue
		}
		summary, err := s.stockRepo.GetSummary(actual.ProductID)
		if err != nil {
			continue
		}

		// Tính lại delta cho broadcast (giống logic trên)
		var delta int
		switch t.Type {
		case domain.TypeCount:
			baseline := 0
			for _, orig := range t.Items {
				if orig.ProductID.String() == actual.ProductID {
					baseline = orig.QuantityRequested
					break
				}
			}
			delta = actual.QuantityActual - baseline
		case domain.TypeExport:
			delta = -actual.QuantityActual
		default:
			delta = actual.QuantityActual
		}

		if delta == 0 {
			continue // không broadcast nếu không có chênh lệch
		}

		s.hub.Publish(ws.EventStockUpdate, ws.StockUpdatePayload{
			ProductID:   product.ID.String(),
			ProductName: product.Name,
			TotalQty:    summary.TotalQuantity,
			Delta:       delta,
			TxCode:      t.Code,
		})
		s.alertSvc.CheckAndAlert(product, summary)
	}

	s.hub.Publish(ws.EventTransactionUpdate, ws.TransactionUpdatePayload{
		TransactionID:   t.ID.String(),
		TransactionCode: t.Code,
		Status:          "done",
		CreatedByID:     t.CreatedByID.String(),
	})

	return s.txRepo.FindByID(id)
}

// Reject — pending/processing → rejected
func (s *transactionService) Reject(id string) error {
	t, err := s.txRepo.FindByID(id)
	if err != nil {
		return errors.New("transaction not found")
	}
	if t.Status != domain.StatusPending && t.Status != domain.StatusProcessing {
		return fmt.Errorf("cannot reject: status is '%s'", t.Status)
	}
	if err := s.txRepo.UpdateStatus(s.txRepo.GetDB(), id, domain.StatusRejected); err != nil {
		return err
	}
	s.hub.Publish(ws.EventTransactionUpdate, ws.TransactionUpdatePayload{
		TransactionID:   t.ID.String(),
		TransactionCode: t.Code,
		Status:          "rejected",
		CreatedByID:     t.CreatedByID.String(),
	})
	return nil
}

// ─── Helper ───────────────────────────────────────────────────

func generateTxCode(txType domain.TransactionType) string {
	prefix := map[domain.TransactionType]string{
		domain.TypeImport:   "IMP",
		domain.TypeExport:   "EXP",
		domain.TypeTransfer: "TRF",
		domain.TypeCount:    "CNT",
	}[txType]
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixMilli())
}

// ─── SuggestBin ───────────────────────────────────────────────

func (s *transactionService) SuggestBin(txID uuid.UUID, itemID uuid.UUID, binID uuid.UUID, managerID string) error {
	t, err := s.txRepo.FindByID(txID.String())
	if err != nil {
		return err
	}
	if t.Status != domain.StatusProcessing {
		return fmt.Errorf("chỉ có thể đề xuất bin khi phiếu đang ở trạng thái processing")
	}

	var item *domain.TransactionItem
	for i := range t.Items {
		if t.Items[i].ID == itemID {
			item = &t.Items[i]
			break
		}
	}
	if item == nil {
		return fmt.Errorf("item không thuộc phiếu này")
	}

	bin, err := s.binRepo.FindBinByIDEnriched(binID.String())
	if err != nil {
		return fmt.Errorf("bin không tồn tại")
	}

	if err := s.txRepo.UpdateItemSuggestedBin(itemID, binID); err != nil {
		return err
	}

	s.hub.Publish(ws.EventBinSuggestion, ws.BinSuggestionPayload{
		TransactionID:       t.ID.String(),
		TransactionCode:     t.Code,
		ItemID:              itemID.String(),
		ProductName:         item.Product.Name,
		SuggestedBinID:      binID.String(),
		SuggestedBinDisplay: bin.DisplayName(),
		CreatedByID:         t.CreatedByID.String(),
	})
	return nil
}