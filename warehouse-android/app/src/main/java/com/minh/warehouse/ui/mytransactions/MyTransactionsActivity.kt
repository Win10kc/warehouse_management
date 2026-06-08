package com.minh.warehouse.ui.mytransactions

import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.minh.warehouse.R
import kotlinx.coroutines.launch

class MyTransactionsActivity : AppCompatActivity() {

    private val vm: MyTransactionsViewModel by viewModels()
    private lateinit var adapter: TransactionAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_my_transactions)

        // Toolbar back button
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        // RecyclerView
        adapter = TransactionAdapter(emptyList())
        findViewById<RecyclerView>(R.id.recyclerView).apply {
            layoutManager = LinearLayoutManager(this@MyTransactionsActivity)
            adapter = this@MyTransactionsActivity.adapter
        }

        // Observe state
        lifecycleScope.launch {
            vm.state.collect { state ->
                val pb     = findViewById<ProgressBar>(R.id.progressBar)
                val tvErr  = findViewById<TextView>(R.id.tvError)
                val tvEmp  = findViewById<TextView>(R.id.tvEmpty)
                val rv     = findViewById<RecyclerView>(R.id.recyclerView)

                pb.visibility    = View.GONE
                tvErr.visibility = View.GONE
                tvEmp.visibility = View.GONE
                rv.visibility    = View.GONE

                when (state) {
                    is MyTxState.Loading -> pb.visibility = View.VISIBLE
                    is MyTxState.Error   -> {
                        tvErr.visibility = View.VISIBLE
                        tvErr.text = state.msg
                    }
                    is MyTxState.Success -> {
                        if (state.items.isEmpty()) {
                            tvEmp.visibility = View.VISIBLE
                        } else {
                            rv.visibility = View.VISIBLE
                            adapter.update(state.items)
                        }
                    }
                }
            }
        }
        // Lắng nghe sự kiện bin suggestion từ WebSocket
        lifecycleScope.launch {
            vm.binSuggestionEvent.collect { event ->
                android.app.AlertDialog.Builder(this@MyTransactionsActivity)
                    .setTitle("📦 Manager đề xuất bin mới")
                    .setMessage(
                        "Phiếu: ${event.transactionCode}\n" +
                                "Sản phẩm: ${event.productName}\n" +
                                "Bin đề xuất: ${event.suggestedBinDisplay}"
                    )
                    .setPositiveButton("OK", null)
                    .show()
            }
        }

        vm.load()
    }
}