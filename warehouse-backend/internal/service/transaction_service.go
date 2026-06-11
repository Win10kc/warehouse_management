package service

import (
	"errors"
	"fmt"
	"time"
	"log"

	"warehouse-backend/internal/domain"
	"warehouse-backend/internal/repository"
	ws "warehouse-backend/internal/websocket"

	"github.com/google/uuid"
	"gorm.io/gorm"
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
	ApplyBin(txID uuid.UUID, itemID uuid.UUID) error
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

// ─── Create ───────────────────────────────────────────────────

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

		// Export: KHÔNG bắt buộc from_bin_id — sẽ auto-suggest sau
		// Transfer: vẫn yêu cầu cả hai
		if req.Type == domain.TypeTransfer && i.FromBinID == "" {
			return nil, fmt.Errorf("from_bin_id required for transfer")
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

	if req.Type == domain.TypeExport {
		if err := s.autoSuggestBins(dbTx, items); err != nil {
			dbTx.Rollback()
			return nil, fmt.Errorf("không thể tự động gợi ý bin: %w", err)
		}
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

// ─── autoSuggestBins ──────────────────────────────────────────

func (s *transactionService) autoSuggestBins(
	dbTx *gorm.DB,
	items []domain.TransactionItem,
) error {
	// Dùng stockRepo để lấy stock_items theo product
	// interface dbTx không expose đủ method, nên dùng GetDB() và update trực tiếp
	// (đây vẫn nằm trong DB transaction vì dùng chung connection)


	for _, item := range items {
		// Lấy tất cả bin có sản phẩm này, sắp xếp: đủ số lượng trước, rồi theo qty desc
		stockItems, err := s.stockRepo.GetItemsByProduct(item.ProductID.String())
		if err != nil || len(stockItems) == 0 {
			// Không có tồn kho → bỏ qua, không set suggested_bin_id
			// (Approve sẽ kiểm tra và báo lỗi nếu thiếu hàng)
			continue
		}

		// Tìm bin tốt nhất
		bestBinID := chooseBestBin(stockItems, item.QuantityRequested)
		if bestBinID == uuid.Nil {
			continue
		}

		// Update suggested_bin_id
		if err := dbTx.Model(&domain.TransactionItem{}).
			Where("id = ?", item.ID).
			Update("suggested_bin_id", bestBinID).
			Error; err != nil {
			return err
		}
	}
	return nil
}

// chooseBestBin — chọn bin tối ưu từ danh sách stock_items của 1 sản phẩm.
// Ưu tiên: bin có đủ số lượng & qty nhỏ nhất (dùng hết trước, giảm phân mảnh).
// Fallback: bin có qty lớn nhất.
func chooseBestBin(stockItems []repository.StockItemRow, needed int) uuid.UUID {
	var bestSufficient *repository.StockItemRow
	var bestFallback   *repository.StockItemRow

	for i := range stockItems {
		si := &stockItems[i]
		if si.Quantity <= 0 {
			continue
		}
		if si.Quantity >= needed {
			if bestSufficient == nil || si.Quantity < bestSufficient.Quantity {
				bestSufficient = si
			}
		} else {
			if bestFallback == nil || si.Quantity > bestFallback.Quantity {
				bestFallback = si
			}
		}
	}

	if bestSufficient != nil {
		id, _ := uuid.Parse(bestSufficient.BinID)
		return id
	}
	if bestFallback != nil {
		id, _ := uuid.Parse(bestFallback.BinID)
		return id
	}
	return uuid.Nil
}

// ─── CreateCount ──────────────────────────────────────────────

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

		dbQty := 0
		stockItem, err := s.stockRepo.GetItem(i.ProductID, req.BinID)
		if err == nil && stockItem != nil {
			dbQty = stockItem.Quantity
		}

		item := domain.TransactionItem{
			ID:                uuid.New(),
			TransactionID:     t.ID,
			ProductID:         productID,
			ToBinID:           &binID,
			QuantityRequested: dbQty,
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

// ─── Approve ──────────────────────────────────────────────────
// BUG 1 FIX: Thêm validate from_bin_id và stock theo bin cụ thể.

func (s *transactionService) Approve(id string, approvedByID string) (*domain.Transaction, error) {
	t, err := s.txRepo.FindByID(id)
	if err != nil {
		return nil, errors.New("transaction not found")
	}
	if t.Status != domain.StatusPending {
		return nil, fmt.Errorf("cannot approve: status is '%s'", t.Status)
	}

	if t.Type == domain.TypeExport || t.Type == domain.TypeTransfer {
		for _, item := range t.Items {
			// ── [BUG 1 FIX] Bước 1: phải có from_bin_id ──────────────────
			if item.FromBinID == nil {
				return nil, fmt.Errorf(
					"sản phẩm '%s' chưa có bin xuất — vui lòng áp dụng bin đề xuất trước khi duyệt",
					item.Product.Name,
				)
			}

			// ── [BUG 1 FIX] Bước 2: bin đó phải đủ số lượng ─────────────
			stockItem, err := s.stockRepo.GetItem(item.ProductID.String(), item.FromBinID.String())
			if err != nil || stockItem == nil || stockItem.Quantity < item.QuantityRequested {
				have := 0
				if stockItem != nil {
					have = stockItem.Quantity
				}
				return nil, fmt.Errorf(
					"bin '%s' không đủ hàng cho '%s': cần %d, hiện có %d",
					item.FromBinID, item.Product.Name, item.QuantityRequested, have,
				)
			}
			// ─────────────────────────────────────────────────────────────
			// Bỏ check summary.TotalQuantity — check bin cụ thể đã đủ chặt.
			// (Nếu muốn giữ cả 2 lớp check, có thể thêm lại bên dưới.)
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

// ─── Complete ─────────────────────────────────────────────────
// BUG 2 FIX: Lấy from_bin_id từ DB (orig item), không từ request client.

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
			continue
		}

		if err := s.stockRepo.UpsertSummary(dbTx, productID, delta); err != nil {
			dbTx.Rollback()
			return nil, err
		}

		// Xác định binID: export dùng suggested_bin_id nếu from_bin_id không có
		var binIDStr string
		switch t.Type {
		case domain.TypeCount:
			for _, orig := range t.Items {
				if orig.ProductID.String() == actual.ProductID && orig.ToBinID != nil {
					binIDStr = orig.ToBinID.String()
					break
				}
			}
		case domain.TypeExport:
			// ── [BUG 2 FIX] Luôn lấy from_bin_id từ DB (orig item) ───────
			// KHÔNG dùng actual.FromBinID — client có thể gửi giá trị cũ
			// trước khi apply-bin được gọi.
			for _, orig := range t.Items {
				if orig.ProductID.String() == actual.ProductID && orig.FromBinID != nil {
					binIDStr = orig.FromBinID.String()
					break
				}
			}
			// ─────────────────────────────────────────────────────────────
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

	for _, actual := range req.Items {
		product, err := s.productRepo.FindByID(actual.ProductID)
		if err != nil {
			continue
		}
		summary, err := s.stockRepo.GetSummary(actual.ProductID)
		if err != nil {
			continue
		}

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
			continue
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

// ─── Reject ───────────────────────────────────────────────────

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

// ─── SuggestBin (manual — manager chọn thủ công) ─────────────

func (s *transactionService) SuggestBin(txID uuid.UUID, itemID uuid.UUID, binID uuid.UUID, managerID string) error {
	log.Printf(
		"SuggestBin: tx=%s item=%s newBin=%s",
		txID,
		itemID,
		binID,
	)
	t, err := s.txRepo.FindByID(txID.String())
	if err != nil {
		return err
	}
	if t.Status != domain.StatusPending {
		return fmt.Errorf(
			"chỉ có thể đề xuất bin khi phiếu đang ở trạng thái pending",
		)
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
	log.Printf(
		"Update suggested_bin_id success: item=%s bin=%s",
		itemID,
		binID,
	)

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

func (s *transactionService) ApplyBin(txID uuid.UUID, itemID uuid.UUID) error {
	t, err := s.txRepo.FindByID(txID.String())
	if err != nil {
		return err
	}
	if t.Status != domain.StatusPending && t.Status != domain.StatusProcessing {
		return fmt.Errorf("chỉ áp dụng bin khi phiếu đang pending hoặc processing")
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
	if item.SuggestedBinID == nil {
		return fmt.Errorf("item chưa có bin đề xuất")
	}

	return s.txRepo.ApplyBin(itemID, *item.SuggestedBinID)
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