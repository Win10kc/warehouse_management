package com.minh.warehouse.data.model

data class WarehouseListResponse(
    val success: Boolean,
    val data: List<WarehouseItem>?
)
data class WarehouseItem(
    val id: String,
    val name: String,
    val zones: List<ZoneItem>?
)
data class ZoneItem(
    val id: String,
    val code: String,
    val name: String,
    val racks: List<RackItem>?
)
data class RackItem(
    val id: String,
    val code: String,
    val name: String,
    val bins: List<BinItem>?
)
data class BinItem(
    val id: String,
    val code: String,
    val qr_code: String?,
    val rfid_uid: String?
)

data class CreateTransactionRequest(
    val type: String,
    val note: String,
    val items: List<TransactionItemInput>
)
data class TransactionItemInput(
    val product_id: String,
    val from_bin_id: String?,
    val to_bin_id: String?,
    val quantity_requested: Int,
    val scan_method: String
)

data class TransactionResponse(
    val data: TransactionDetail?
)
data class TransactionDetail(
    val id: String,
    val code: String,
    val type: String,
    val status: String,
    val note: String,
    val items: List<TransactionItemDetail>?
)
data class BinInfo(
    val id: String,
    val code: String,
    val rack_code: String?,
    val zone_code: String?,
    val zone_name: String?,
    val warehouse_name: String?
) {
    fun displayName(): String {
        return listOfNotNull(warehouse_name, zone_name, rack_code, code)
            .joinToString(" › ")
            .ifBlank { code }
    }
}
data class ProductSummary(
    val id: String,
    val sku: String,
    val name: String,
    val unit: String?
)
data class TransactionItemDetail(
    val id: String,
    val product_id: String,
    val product: ProductSummary?,
    val from_bin: BinInfo?,
    val to_bin: BinInfo?,
    val quantity_requested: Int,
    val quantity_actual: Int,
    val scan_method: String?
)

// ── Sprint 4.3: Phiếu của tôi ──────────────────────────────────

data class TransactionListResponse(
    val success: Boolean,
    val data: TransactionListData?
)

data class TransactionListData(
    val items: List<TransactionSummary>?,
    val total: Int
)

data class UserSummary(
    val id: String,
    val username: String,
    val full_name: String,
    val role: String,
)

data class TransactionSummary(
    val id: String,
    val code: String,
    val type: String,           // "import" / "export" / "transfer" / "count"
    val status: String,         // "pending" / "processing" / "done" / "rejected"
    val note: String?,
    val created_at: String,
    val approved_at: String?,   // thêm mới
    val completed_at: String?,  // thêm mới
    val created_by: UserSummary,
    val approved_by: UserSummary?,
    val items: List<TransactionItemDetail>?
)

// ── Sprint 4.4: Tìm sản phẩm ──────────────────────────────────

data class ProductListResponse(
    val success: Boolean,
    val data: ProductListData?
)

data class ProductListData(
    val items: List<ProductItem>?,
    val total: Int
)

data class ProductItem(
    val id: String,
    val sku: String,
    val name: String,
    val unit: String,
    val category: String?,
    val supplier: SupplierInfo?
)
data class SupplierInfo(
    val id: String,
    val name: String,
    val contact: String?
)

// ── Request models ────────────────────────────────────────────

data class StockCountItem(
    val product_id: String,
    val actual_qty: Int
)

data class StockCountRequest(
    val bin_id: String,
    val note:   String,
    val items:  List<StockCountItem>
)

// ── BinStockRow — response từ GET /stock/locations ───────────

data class BinStockRow(
    val warehouse_id:   String,
    val warehouse_name: String,
    val zone_code:      String,
    val zone_name:      String,
    val rack_code:      String,
    val bin_id:         String,
    val bin_code:       String,
    val product_id:     String,
    val product_name:   String,
    val sku:            String,
    val unit:           String,
    val quantity:       Int
)

data class BinStockResponse(
    val data: List<BinStockRow>
)