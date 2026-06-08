package com.minh.warehouse.data.model

data class CreateProductRequestBody(
    val raw_code: String,
    val suggested_name: String,
    val supplier_name: String,  // ← THÊM
    val note: String
)

data class ProductRequestResponse(
    val id: String,
    val raw_code: String,
    val suggested_name: String,
    val supplier_name: String,  // ← THÊM
    val status: String,
    val created_at: String
)