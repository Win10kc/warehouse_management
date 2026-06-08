package com.minh.warehouse.ui.picklist

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.minh.warehouse.R
import com.minh.warehouse.data.model.TransactionItemDetail

// ════════════════════════════════════════════════════════════════
// ui/picklist/PickListActivity.kt
// Sprint 6.3: Staff xem lệnh xuất kho, thấy bin gợi ý,
//             scan hoặc tap xác nhận từng dòng, rồi submit.
// ════════════════════════════════════════════════════════════════

class PickListActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_TRANSACTION_ID   = "transaction_id"
        const val EXTRA_TRANSACTION_CODE = "transaction_code"
    }

    private lateinit var viewModel: PickListViewModel
    private lateinit var adapter: PickListAdapter

    private lateinit var tvCode:        TextView
    private lateinit var tvStatus:      TextView
    private lateinit var tvProgress:    TextView
    private lateinit var progressBar:   ProgressBar
    private lateinit var recyclerView:  RecyclerView
    private lateinit var btnSubmit:     Button
    private lateinit var tvError:       TextView
    private lateinit var layoutLoading: View
    private lateinit var layoutContent: View

    private var transactionId   = ""
    private var transactionCode = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_pick_list)

        transactionId   = intent.getStringExtra(EXTRA_TRANSACTION_ID)   ?: ""
        transactionCode = intent.getStringExtra(EXTRA_TRANSACTION_CODE) ?: ""

        if (transactionId.isEmpty()) {
            finish(); return
        }

        viewModel = ViewModelProvider(this)[PickListViewModel::class.java]

        tvCode       = findViewById(R.id.tvPickListCode)
        tvStatus     = findViewById(R.id.tvPickListStatus)
        tvProgress   = findViewById(R.id.tvPickListProgress)
        progressBar  = findViewById(R.id.progressBarPickList)
        recyclerView = findViewById(R.id.rvPickList)
        btnSubmit    = findViewById(R.id.btnPickListSubmit)
        tvError      = findViewById(R.id.tvPickListError)
        layoutLoading = findViewById(R.id.layoutPickListLoading)
        layoutContent = findViewById(R.id.layoutPickListContent)

        tvCode.text = transactionCode

        setupRecycler()
        observeViewModel()

        viewModel.loadTransaction(transactionId)

        btnSubmit.setOnClickListener { confirmAndSubmit() }
        findViewById<View>(R.id.btnPickListBack)?.setOnClickListener { finish() }
    }

    private fun setupRecycler() {
        adapter = PickListAdapter(
            onConfirmItem = { item -> viewModel.confirmItem(item.id) },
            onUndoItem    = { item -> viewModel.undoItem(item.id)    }
        )
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
    }

    private fun observeViewModel() {
        viewModel.uiState.observe(this) { state ->
            when (state) {
                is PickListUiState.Loading -> {
                    layoutLoading.visibility = View.VISIBLE
                    layoutContent.visibility = View.GONE
                    tvError.visibility       = View.GONE
                }
                is PickListUiState.Error -> {
                    layoutLoading.visibility = View.GONE
                    layoutContent.visibility = View.GONE
                    tvError.visibility       = View.VISIBLE
                    tvError.text             = state.message
                }
                is PickListUiState.Ready -> {
                    layoutLoading.visibility = View.GONE
                    layoutContent.visibility = View.VISIBLE
                    tvError.visibility       = View.GONE

                    val confirmed = state.items.count { it.isConfirmed }
                    val total     = state.items.size
                    tvProgress.text = "Đã xác nhận: $confirmed / $total"
                    tvStatus.text   = state.status.uppercase()

                    adapter.submitList(state.items.toList())

                    // Enable submit khi tất cả đã xác nhận
                    val allDone = confirmed == total && total > 0
                    btnSubmit.isEnabled  = allDone
                    btnSubmit.alpha      = if (allDone) 1f else 0.5f
                    btnSubmit.text       = if (allDone) "✓ Hoàn tất phiếu xuất" else "Xác nhận hết ($confirmed/$total) để hoàn tất"
                }
                is PickListUiState.Submitting -> {
                    btnSubmit.isEnabled = false
                    btnSubmit.text      = "Đang gửi..."
                    progressBar.visibility = View.VISIBLE
                }
                is PickListUiState.Done -> {
                    Toast.makeText(this, "✓ Phiếu hoàn tất: $transactionCode", Toast.LENGTH_LONG).show()
                    finish()
                }
                is PickListUiState.SubmitError -> {
                    progressBar.visibility = View.GONE
                    btnSubmit.isEnabled    = true
                    tvError.visibility     = View.VISIBLE
                    tvError.text           = state.message
                }
            }
        }
    }

    private fun confirmAndSubmit() {
        AlertDialog.Builder(this)
            .setTitle("Xác nhận hoàn tất phiếu?")
            .setMessage("Tất cả sản phẩm đã được lấy. Hệ thống sẽ trừ tồn kho và đóng phiếu.")
            .setPositiveButton("Hoàn tất") { _, _ -> viewModel.submitPickList(transactionId) }
            .setNegativeButton("Huỷ", null)
            .show()
    }
}