package repository

import (
	"warehouse-backend/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TransactionFilter struct {
	Type        string
	Status      string
	CreatedByID string
	Page        int
	Limit       int
}

type SKUReportRow struct {
	ProductID     string `json:"product_id"`
	SKU           string `json:"sku"`
	ProductName   string `json:"product_name"`
	Unit          string `json:"unit"`
	TotalImport   int    `json:"total_import"`
	TotalExport   int    `json:"total_export"`
	TotalTransfer int    `json:"total_transfer"`
	NetChange     int    `json:"net_change"`
}



type TransactionRepository interface {
	List(filter TransactionFilter) ([]domain.Transaction, int64, error)
	FindByID(id string) (*domain.Transaction, error)
	Create(tx *gorm.DB, t *domain.Transaction) error
	UpdateStatus(tx *gorm.DB, id string, status domain.TransactionStatus) error
	UpdateFields(tx *gorm.DB, id string, fields map[string]any) error
	AddItems(tx *gorm.DB, items []domain.TransactionItem) error
	UpdateItemActual(tx *gorm.DB, transactionID, productID string, qty int) error
	GetDB() *gorm.DB
	GetSKUReport(fromDate, toDate string) ([]SKUReportRow, error)
	UpdateItemSuggestedBin(itemID uuid.UUID, suggestedBinID uuid.UUID) error
	ApplyBin(itemID uuid.UUID, binID uuid.UUID) error
}

type transactionRepository struct{ db *gorm.DB }

func NewTransactionRepository(db *gorm.DB) TransactionRepository {
	return &transactionRepository{db: db}
}

func (r *transactionRepository) GetDB() *gorm.DB { return r.db }

func (r *transactionRepository) List(f TransactionFilter) ([]domain.Transaction, int64, error) {
	query := r.db.Model(&domain.Transaction{}).
		Preload("Items").
		Preload("Items.Product").
		Preload("Items.FromBin").
		Preload("Items.ToBin").
		Preload("CreatedBy").
		Preload("ApprovedBy")

	if f.Type != "" {
		query = query.Where("type = ?", f.Type)
	}
	if f.Status != "" {
		query = query.Where("status = ?", f.Status)
	}
	if f.CreatedByID != "" {
		query = query.Where("created_by_id = ?", f.CreatedByID)
	}

	var total int64
	query.Count(&total)

	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}

	var list []domain.Transaction
	err := query.
		Offset((f.Page - 1) * f.Limit).
		Limit(f.Limit).
		Order("created_at DESC").
		Find(&list).Error
	if err != nil {
		return nil, 0, err
	}

	// Enrich bin location (FromBin, ToBin, SuggestedBin)
	binIDSet := map[string]bool{}
	for _, t := range list {
		for _, item := range t.Items {
			if item.FromBinID != nil {
				binIDSet[item.FromBinID.String()] = true
			}
			if item.ToBinID != nil {
				binIDSet[item.ToBinID.String()] = true
			}
			if item.SuggestedBinID != nil {
				binIDSet[item.SuggestedBinID.String()] = true
			}
		}
	}

	locMap := map[string]binLocationRow{}
	if len(binIDSet) > 0 {
		binIDs := make([]string, 0, len(binIDSet))
		for id := range binIDSet {
			binIDs = append(binIDs, id)
		}
		var locs []binLocationRow
		r.db.Raw(`
			SELECT b.id AS bin_id, b.code AS bin_code,
				rk.code AS rack_code,
				z.code  AS zone_code, z.name AS zone_name,
				w.name  AS warehouse_name
			FROM bins b
			JOIN racks      rk ON rk.id = b.rack_id
			JOIN zones      z  ON z.id  = rk.zone_id
			JOIN warehouses w  ON w.id  = z.warehouse_id
			WHERE b.id IN ?
		`, binIDs).Scan(&locs)
		for _, loc := range locs {
			locMap[loc.BinID] = loc
		}
	}

	for i := range list {
		for j := range list[i].Items {
			if list[i].Items[j].FromBin != nil {
				if loc, ok := locMap[list[i].Items[j].FromBin.ID.String()]; ok {
					list[i].Items[j].FromBin.RackCode      = loc.RackCode
					list[i].Items[j].FromBin.ZoneCode      = loc.ZoneCode
					list[i].Items[j].FromBin.ZoneName      = loc.ZoneName
					list[i].Items[j].FromBin.WarehouseName = loc.WarehouseName
				}
			}
			if list[i].Items[j].ToBin != nil {
				if loc, ok := locMap[list[i].Items[j].ToBin.ID.String()]; ok {
					list[i].Items[j].ToBin.RackCode      = loc.RackCode
					list[i].Items[j].ToBin.ZoneCode      = loc.ZoneCode
					list[i].Items[j].ToBin.ZoneName      = loc.ZoneName
					list[i].Items[j].ToBin.WarehouseName = loc.WarehouseName
				}
			}
			// Enrich SuggestedBin
			if list[i].Items[j].SuggestedBinID != nil {
				if loc, ok := locMap[list[i].Items[j].SuggestedBinID.String()]; ok {
					sugBinID := *list[i].Items[j].SuggestedBinID
					list[i].Items[j].SuggestedBin = &domain.Bin{
						ID:            sugBinID,
						Code:          loc.BinCode,
						RackCode:      loc.RackCode,
						ZoneCode:      loc.ZoneCode,
						ZoneName:      loc.ZoneName,
						WarehouseName: loc.WarehouseName,
					}
				}
			}
		}
	}

	return list, total, err
}

// binLocationRow là struct trung gian để nhận kết quả raw query bin location
type binLocationRow struct {
	BinID         string `gorm:"column:bin_id"`
	BinCode       string `gorm:"column:bin_code"`
	RackCode      string `gorm:"column:rack_code"`
	ZoneCode      string `gorm:"column:zone_code"`
	ZoneName      string `gorm:"column:zone_name"`
	WarehouseName string `gorm:"column:warehouse_name"`
}

// FindByID load đầy đủ thông tin phiếu kèm bin location cho từng item,
// bao gồm SuggestedBin.
func (r *transactionRepository) FindByID(id string) (*domain.Transaction, error) {
	var t domain.Transaction
	err := r.db.
		Preload("Items").
		Preload("Items.Product").
		Preload("Items.FromBin").
		Preload("Items.ToBin").
		Preload("CreatedBy").
		Preload("ApprovedBy").
		Where("id = ?", id).
		First(&t).Error
	if err != nil {
		return nil, err
	}

	// Thu thập bin_id cần enrich (from + to + suggested)
	binIDSet := map[string]bool{}
	for _, item := range t.Items {
		if item.FromBinID != nil {
			binIDSet[item.FromBinID.String()] = true
		}
		if item.ToBinID != nil {
			binIDSet[item.ToBinID.String()] = true
		}
		if item.SuggestedBinID != nil {
			binIDSet[item.SuggestedBinID.String()] = true
		}
	}

	if len(binIDSet) == 0 {
		return &t, nil
	}

	binIDs := make([]string, 0, len(binIDSet))
	for id := range binIDSet {
		binIDs = append(binIDs, id)
	}

	var locs []binLocationRow
	r.db.Raw(`
		SELECT
			b.id   AS bin_id,
			b.code AS bin_code,
			rk.code AS rack_code,
			z.code  AS zone_code,
			z.name  AS zone_name,
			w.name  AS warehouse_name
		FROM bins b
		JOIN racks      rk ON rk.id = b.rack_id
		JOIN zones      z  ON z.id  = rk.zone_id
		JOIN warehouses w  ON w.id  = z.warehouse_id
		WHERE b.id IN ?
	`, binIDs).Scan(&locs)

	locMap := map[string]binLocationRow{}
	for _, loc := range locs {
		locMap[loc.BinID] = loc
	}

	for i := range t.Items {
		if t.Items[i].FromBin != nil {
			if loc, ok := locMap[t.Items[i].FromBin.ID.String()]; ok {
				t.Items[i].FromBin.RackCode      = loc.RackCode
				t.Items[i].FromBin.ZoneCode      = loc.ZoneCode
				t.Items[i].FromBin.ZoneName      = loc.ZoneName
				t.Items[i].FromBin.WarehouseName = loc.WarehouseName
			}
		}
		if t.Items[i].ToBin != nil {
			if loc, ok := locMap[t.Items[i].ToBin.ID.String()]; ok {
				t.Items[i].ToBin.RackCode      = loc.RackCode
				t.Items[i].ToBin.ZoneCode      = loc.ZoneCode
				t.Items[i].ToBin.ZoneName      = loc.ZoneName
				t.Items[i].ToBin.WarehouseName = loc.WarehouseName
			}
		}
		// ── Enrich SuggestedBin ──────────────────────────────
		if t.Items[i].SuggestedBinID != nil {
			sugID := t.Items[i].SuggestedBinID.String()
			if loc, ok := locMap[sugID]; ok {
				binUUID := *t.Items[i].SuggestedBinID
				t.Items[i].SuggestedBin = &domain.Bin{
					ID:            binUUID,
					Code:          loc.BinCode,
					RackCode:      loc.RackCode,
					ZoneCode:      loc.ZoneCode,
					ZoneName:      loc.ZoneName,
					WarehouseName: loc.WarehouseName,
				}
			}
		}
	}

	return &t, nil
}

func (r *transactionRepository) Create(tx *gorm.DB, t *domain.Transaction) error {
	return tx.Omit("Items", "CreatedBy").Create(t).Error
}

func (r *transactionRepository) UpdateStatus(tx *gorm.DB, id string, status domain.TransactionStatus) error {
	return tx.Model(&domain.Transaction{}).
		Where("id = ?", id).
		Update("status", status).Error
}

func (r *transactionRepository) UpdateFields(tx *gorm.DB, id string, fields map[string]any) error {
	return tx.Model(&domain.Transaction{}).
		Where("id = ?", id).
		Updates(fields).Error
}

func (r *transactionRepository) AddItems(tx *gorm.DB, items []domain.TransactionItem) error {
	return tx.Omit("Product", "FromBin", "ToBin", "SuggestedBin").Create(&items).Error
}

func (r *transactionRepository) UpdateItemActual(tx *gorm.DB, transactionID, productID string, qty int) error {
	return tx.Model(&domain.TransactionItem{}).
		Where("transaction_id = ? AND product_id = ?", transactionID, productID).
		Updates(map[string]any{"quantity_actual": qty}).Error
}

func (r *transactionRepository) GetSKUReport(fromDate, toDate string) ([]SKUReportRow, error) {
	var rows []SKUReportRow
	err := r.db.Raw(`
		SELECT
			p.id                                                        AS product_id,
			p.sku                                                       AS sku,
			p.name                                                      AS product_name,
			p.unit                                                      AS unit,
			COALESCE(SUM(CASE WHEN t.type = 'import'   THEN ti.quantity_actual ELSE 0 END), 0) AS total_import,
			COALESCE(SUM(CASE WHEN t.type = 'export'   THEN ti.quantity_actual ELSE 0 END), 0) AS total_export,
			COALESCE(SUM(CASE WHEN t.type = 'transfer' THEN ti.quantity_actual ELSE 0 END), 0) AS total_transfer,
			COALESCE(SUM(CASE WHEN t.type = 'import'   THEN  ti.quantity_actual
			                  WHEN t.type = 'export'   THEN -ti.quantity_actual
			                  ELSE 0 END), 0)                           AS net_change
		FROM transaction_items ti
		JOIN transactions t ON t.id  = ti.transaction_id
		JOIN products     p ON p.id  = ti.product_id
		WHERE t.status    = 'done'
		  AND t.created_at >= ?
		  AND t.created_at <  ?
		GROUP BY p.id, p.sku, p.name, p.unit
		ORDER BY p.sku
	`, fromDate, toDate).Scan(&rows).Error
	return rows, err
}

func (r *transactionRepository) UpdateItemSuggestedBin(itemID uuid.UUID, binID uuid.UUID) error {
	return r.db.Model(&domain.TransactionItem{}).
		Where("id = ?", itemID).
		Update("suggested_bin_id", binID).Error
}

func (r *transactionRepository) ApplyBin(itemID uuid.UUID, binID uuid.UUID) error {
    return r.db.Model(&domain.TransactionItem{}).
        Where("id = ?", itemID).
        Updates(map[string]any{
            "from_bin_id":      binID,
            "suggested_bin_id": nil,
        }).Error
}