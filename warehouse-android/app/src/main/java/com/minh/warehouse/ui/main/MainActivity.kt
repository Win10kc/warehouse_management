package com.minh.warehouse.ui.main

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.minh.warehouse.R
import com.minh.warehouse.data.websocket.WebSocketEvent
import com.minh.warehouse.data.websocket.WebSocketManager
import com.minh.warehouse.util.TokenManager
import kotlinx.coroutines.launch
import com.minh.warehouse.ui.login.LoginActivity
import com.minh.warehouse.ui.mytransactions.MyTransactionsActivity
import com.minh.warehouse.ui.scan.ScanActivity
import com.minh.warehouse.ui.stockcount.StockCountActivity
import com.minh.warehouse.ui.transaction.ProductSearchActivity
import com.minh.warehouse.ui.transaction.TransactionFormActivity
import com.minh.warehouse.ui.picklist.PickListActivity

class MainActivity : AppCompatActivity() {

    companion object {
        // Phải khớp với VITE_WS_URL trong backend — chỉ đổi scheme ws://
        private const val WS_URL = "ws://192.168.110.179:8080/ws"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val tvWelcome = findViewById<TextView>(R.id.tvWelcome)
        val btnLogout = findViewById<Button>(R.id.btnLogout)
        val btnScan = findViewById<Button>(R.id.btnScan)
        val btnCreateTransaction = findViewById<Button>(R.id.btnCreateTransaction)
        val btnMyTransactions = findViewById<Button>(R.id.btnMyTransactions)
        val btnStockCount = findViewById<Button>(R.id.btnStockCount)
        val btnPickList = findViewById<Button>(R.id.btnPickList)

        tvWelcome.text = "Warehouse App — Đã đăng nhập"

        // --- Kết nối WebSocket ---
        lifecycleScope.launch {
            val token = TokenManager.get(this@MainActivity)
            if (token != null) {
                WebSocketManager.connect(WS_URL, token)
            }
        }

        // --- Lắng nghe events ---
        lifecycleScope.launch {
            WebSocketManager.events.collect { event ->
                when (event) {
                    is WebSocketEvent.Connected -> {
                        Toast.makeText(
                            this@MainActivity,
                            "🟢 Kết nối real-time",
                            Toast.LENGTH_SHORT
                        ).show()
                    }

                    is WebSocketEvent.Disconnected -> {
                        Toast.makeText(
                            this@MainActivity,
                            "🔴 Mất kết nối real-time",
                            Toast.LENGTH_SHORT
                        ).show()
                    }

                    is WebSocketEvent.StockUpdate -> {
                        Toast.makeText(
                            this@MainActivity,
                            "📦 ${event.productName}: tồn kho → ${event.quantity}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }

                    is WebSocketEvent.Alert -> {
                        val icon = if (event.level == "critical") "🚨" else "⚠️"
                        Toast.makeText(
                            this@MainActivity,
                            "$icon ${event.message}",
                            Toast.LENGTH_LONG
                        ).show()
                    }

                    is WebSocketEvent.TransactionUpdate -> {
                        // 1. Map status tiếng Anh → tiếng Việt để hiển thị
                        val statusText = when (event.status) {
                            "processing" -> "Đang xử lý"
                            "done" -> "Đã hoàn tất"
                            "rejected" -> "Đã từ chối"
                            else -> event.status
                        }

                        // 2. Hiển thị Toast thông báo cho người dùng
                        Toast.makeText(
                            this@MainActivity,
                            "📋 Phiếu ${event.transactionCode}: $statusText",
                            Toast.LENGTH_LONG
                        ).show()

                        // 3. Log debug để theo dõi (có thể xem qua Logcat)
                        Log.d(
                            "WS_DEBUG",
                            "Transaction update received: code=${event.transactionCode}, status=${event.status}, id=${event.transactionId}"
                        )
                    }

                    is WebSocketEvent.BinSuggestion -> {
                        // Hiện ở MainActivity như một thông báo nhẹ
                        // Dialog chi tiết sẽ hiện trong MyTransactionsActivity
                        Toast.makeText(
                            this@MainActivity,
                            "📦 Bin đề xuất cho phiếu ${event.transactionCode}: ${event.suggestedBinDisplay}",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
        }

        // --- Buttons ---
        btnLogout.setOnClickListener {
            lifecycleScope.launch {
                WebSocketManager.disconnect()          // ngắt WS trước khi logout
                TokenManager.clear(this@MainActivity)
                startActivity(Intent(this@MainActivity, LoginActivity::class.java))
                finish()
            }
        }

        btnScan.setOnClickListener {
            startActivity(Intent(this, ScanActivity::class.java))
        }

        btnCreateTransaction.setOnClickListener {
            startActivity(Intent(this, ProductSearchActivity::class.java))
        }

        btnMyTransactions.setOnClickListener {
            startActivity(Intent(this, MyTransactionsActivity::class.java))
        }
        btnStockCount.setOnClickListener {
            startActivity(Intent(this, StockCountActivity::class.java))

        }
        btnPickList.setOnClickListener {
            val intent = Intent(this, PickListActivity::class.java)

            // truyền transaction id nếu cần
            intent.putExtra("transaction_id", "YOUR_TX_ID")

            startActivity(intent)
        }
    }
    override fun onDestroy() {
        super.onDestroy()
        // Không disconnect ở đây — Activity có thể bị recreate (xoay màn hình)
        // Chỉ disconnect khi logout hoặc app bị kill
    }
}