package repository

import (
	"warehouse-backend/internal/domain"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type StockRepository interface {
	GetSummary(productID string) (*domain.StockSummary, error)
	ListSummaries() ([]domain.StockSummary, error)
	UpsertSummary(tx *gorm.DB, productID uuid.UUID, delta int) error
	GetItem(productID, binID string) (*domain.StockItem, error)
	ListByProduct(productID string) ([]domain.StockItem, error)
	UpsertItem(tx *gorm.DB, productID uuid.UUID, binID uuid.UUID, delta int) error
	ListByBin(search string) ([]BinStockRow, error)
	GetItemsByProduct(productID string) ([]StockItemRow, error)
}

type stockRepository struct{ db *gorm.DB }
type stockRepositoryExtra struct{ db *gorm.DB }

type BinStockRow struct {
    WarehouseID   string `json:"warehouse_id"`
    WarehouseName string `json:"warehouse_name"`
    ZoneCode      string `json:"zone_code"`
    ZoneName      string `json:"zone_name"`
    RackCode      string `json:"rack_code"`
    BinID         string `json:"bin_id"`
    BinCode       string `json:"bin_code"`
    ProductID     string `json:"product_id"`
    ProductName   string `json:"product_name"`
    SKU           string `json:"sku"`
    Unit          string `json:"unit"`
    Quantity      int    `json:"quantity"`
}

type StockItemRow struct {
	BinID    string
	Quantity int
}


func (r *stockRepository) GetItemsByProduct(productID string) ([]StockItemRow, error) {
	 	var rows []StockItemRow
	 	err := r.db.Raw(`
	 		SELECT bin_id, quantity
	 		FROM stock_items
	 		WHERE product_id = ? AND quantity > 0
	 		ORDER BY quantity DESC
	 	`, productID).Scan(&rows).Error
	 	return rows, err
}
func (r *stockRepositoryExtra) GetItemsByProduct(productID string) ([]StockItemRow, error) {
	var rows []StockItemRow
	err := r.db.Raw(`
		SELECT
			bin_id   AS bin_id,
			quantity AS quantity
		FROM stock_items
		WHERE product_id = ?
		  AND quantity   > 0
		ORDER BY quantity DESC
	`, productID).Scan(&rows).Error
	return rows, err
}

	
func NewStockRepository(db *gorm.DB) StockRepository {
	return &stockRepository{db: db}
}

func (r *stockRepository) GetSummary(productID string) (*domain.StockSummary, error) {
	var s domain.StockSummary
	err := r.db.Preload("Product").Where("product_id = ?", productID).First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *stockRepository) ListSummaries() ([]domain.StockSummary, error) {
	var list []domain.StockSummary
	err := r.db.Preload("Product").Order("updated_at DESC").Find(&list).Error
	return list, err
}

// UpsertSummary cộng/trừ total_quantity, gọi trong DB transaction
func (r *stockRepository) UpsertSummary(tx *gorm.DB, productID uuid.UUID, delta int) error {
	return tx.Exec(`
		INSERT INTO stock_summary (id, product_id, total_quantity, reserved_quantity, updated_at)
		VALUES (gen_random_uuid(), ?, GREATEST(0, ?), 0, NOW())
		ON CONFLICT (product_id) DO UPDATE
		SET total_quantity = GREATEST(0, stock_summary.total_quantity + ?),
		    updated_at = NOW()
	`, productID, delta, delta).Error
}

func (r *stockRepository) GetItem(productID, binID string) (*domain.StockItem, error) {
	var item domain.StockItem
	err := r.db.Where("product_id = ? AND bin_id = ?", productID, binID).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *stockRepository) ListByProduct(productID string) ([]domain.StockItem, error) {
	var list []domain.StockItem
	err := r.db.Preload("Bin").Where("product_id = ?", productID).Find(&list).Error
	return list, err
}

// UpsertItem cộng/trừ quantity tại bin cụ thể, gọi trong DB transaction
func (r *stockRepository) UpsertItem(tx *gorm.DB, productID uuid.UUID, binID uuid.UUID, delta int) error {
	return tx.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "product_id"}, {Name: "bin_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"quantity":   gorm.Expr("GREATEST(0, stock_items.quantity + ?)", delta),
			"updated_at": gorm.Expr("NOW()"),
		}),
	}).Create(&domain.StockItem{
		ProductID: productID,
		BinID:     binID,
		Quantity:  delta,
	}).Error
}
func (r *stockRepository) ListByBin(search string) ([]BinStockRow, error) {
    var rows []BinStockRow
    q := r.db.Raw(`
        SELECT
            w.id   AS warehouse_id,
            w.name AS warehouse_name,
            z.code AS zone_code,
            z.name AS zone_name,
            rk.code AS rack_code,
            b.id   AS bin_id,
            b.code AS bin_code,
            COALESCE(p.id::text, '')  AS product_id,
            COALESCE(p.name, '')      AS product_name,
            COALESCE(p.sku, '')       AS sku,
            COALESCE(p.unit, '')      AS unit,
            COALESCE(si.quantity, 0)  AS quantity
        FROM bins b
        JOIN racks      rk ON rk.id = b.rack_id
        JOIN zones      z  ON z.id  = rk.zone_id
        JOIN warehouses w  ON w.id  = z.warehouse_id
        LEFT JOIN stock_items si ON si.bin_id = b.id AND si.quantity > 0
        LEFT JOIN products    p  ON p.id = si.product_id
        WHERE (? = '' OR
               COALESCE(p.name, '') ILIKE '%' || ? || '%' OR
               COALESCE(p.sku,  '') ILIKE '%' || ? || '%' OR
               b.code ILIKE '%' || ? || '%' OR
			   b.id::text ILIKE '%' || ? || '%' OR
               z.code ILIKE '%' || ? || '%' OR
               w.name ILIKE '%' || ? || '%')
        ORDER BY w.name, z.code, rk.code, b.code, COALESCE(p.sku, '')
    `, search, search, search, search, search, search, search)
    return rows, q.Scan(&rows).Error
}