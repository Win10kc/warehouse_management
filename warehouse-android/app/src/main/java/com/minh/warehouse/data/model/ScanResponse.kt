package com.minh.warehouse.data.model

data class ScanResponse(
    val data: ScanData?
)
data class ScanData(
    val product: Product,
    val scan_type: String
)
data class Product(
    val id: String,      // ← ĐỔI Int → String (UUID)
    val name: String,
    val sku: String,
    val unit: String,
    val qr_code: String?,
    val rfid_uid: String?
)