package com.minh.warehouse.data.websocket

sealed class WebSocketEvent {

    data class StockUpdate(
        val productId: String,
        val productName: String,
        val quantity: Int,
        val warehouseName: String
    ) : WebSocketEvent()

    data class Alert(
        val message: String,
        val level: String
    ) : WebSocketEvent()

    data class TransactionUpdate(
        val transactionId: String,
        val transactionCode: String,
        val status: String,
        val createdById: String
    ) : WebSocketEvent()

    // ── Sprint 6.2: Manager đề xuất bin ─────────────────────
    data class BinSuggestion(
        val transactionId: String,
        val transactionCode: String,
        val itemId: String,
        val productName: String,
        val suggestedBinId: String,
        val suggestedBinDisplay: String,   // "Kho HN › Khu A › RACK-01 › BIN-03"
        val createdById: String
    ) : WebSocketEvent()

    object Connected : WebSocketEvent()
    object Disconnected : WebSocketEvent()
}
