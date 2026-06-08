package com.minh.warehouse.data.websocket

import android.util.Log
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import okhttp3.*
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object WebSocketManager {
    private const val TAG = "WebSocketManager"
    private const val NORMAL_CLOSURE = 1000

    private var client: OkHttpClient? = null
    private var webSocket: WebSocket? = null
    private var token: String? = null
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 5

    private val _events = MutableSharedFlow<WebSocketEvent>(extraBufferCapacity = 16)
    val events: SharedFlow<WebSocketEvent> = _events

    fun connect(wsUrl: String, jwtToken: String) {
        token = jwtToken
        reconnectAttempts = 0
        client = OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .pingInterval(20, TimeUnit.SECONDS)
            .build()
        doConnect(wsUrl)
    }

    private fun doConnect(wsUrl: String) {
        val t = token ?: return
        val request = Request.Builder()
            .url("$wsUrl?token=$t")
            .build()

        webSocket = client?.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.d(TAG, "WebSocket connected")
                reconnectAttempts = 0
                _events.tryEmit(WebSocketEvent.Connected)
            }

            override fun onMessage(ws: WebSocket, text: String) {
                Log.d(TAG, "WS message: $text")
                parseMessage(text)
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                ws.close(NORMAL_CLOSURE, null)
                _events.tryEmit(WebSocketEvent.Disconnected)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WS failure: ${t.message}")
                _events.tryEmit(WebSocketEvent.Disconnected)
                scheduleReconnect(wsUrl)
            }
        })
    }

    private fun parseMessage(text: String) {
        try {
            val json = JSONObject(text)
            // Backend dùng key "event" + "data"
            when (val event = json.optString("event")) {

                "stock_update" -> {
                    val payload = json.getJSONObject("data")
                    _events.tryEmit(
                        WebSocketEvent.StockUpdate(
                            productId     = payload.optString("product_id"),
                            productName   = payload.optString("product_name"),
                            quantity      = payload.optInt("total_quantity"),
                            warehouseName = payload.optString("warehouse_name", "")
                        )
                    )
                }

                "alert" -> {
                    val payload = json.getJSONObject("data")
                    _events.tryEmit(
                        WebSocketEvent.Alert(
                            message = payload.optString("message"),
                            level   = payload.optString("level", "warning")
                        )
                    )
                }

                "transaction_update" -> {
                    val payload = json.getJSONObject("data")
                    _events.tryEmit(
                        WebSocketEvent.TransactionUpdate(
                            transactionId   = payload.optString("transaction_id"),
                            transactionCode = payload.optString("transaction_code"),
                            status          = payload.optString("status"),
                            createdById     = payload.optString("created_by_id")
                        )
                    )
                }

                // ── Sprint 6.2 ────────────────────────────────────────
                "bin_suggestion" -> {
                    val payload = json.getJSONObject("data")
                    _events.tryEmit(
                        WebSocketEvent.BinSuggestion(
                            transactionId       = payload.optString("transaction_id"),
                            transactionCode     = payload.optString("transaction_code"),
                            itemId              = payload.optString("item_id"),
                            productName         = payload.optString("product_name"),
                            suggestedBinId      = payload.optString("suggested_bin_id"),
                            suggestedBinDisplay = payload.optString("suggested_bin_display"),
                            createdById         = payload.optString("created_by_id")
                        )
                    )
                }

                else -> Log.d(TAG, "Unknown WS event: $event")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse WS message: ${e.message}")
        }
    }

    private fun scheduleReconnect(wsUrl: String) {
        if (reconnectAttempts >= maxReconnectAttempts) {
            Log.w(TAG, "Max reconnect attempts reached")
            return
        }
        reconnectAttempts++
        val delayMs = (reconnectAttempts * 3000L).coerceAtMost(15_000L)
        Log.d(TAG, "Reconnecting in ${delayMs}ms (attempt $reconnectAttempts)")
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            doConnect(wsUrl)
        }, delayMs)
    }

    fun disconnect() {
        webSocket?.close(NORMAL_CLOSURE, "User logout")
        webSocket = null
        client?.dispatcher?.executorService?.shutdown()
        client = null
        reconnectAttempts = maxReconnectAttempts
    }
}
