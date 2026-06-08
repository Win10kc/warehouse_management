package com.minh.warehouse.ui.transaction

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.minh.warehouse.R
import com.minh.warehouse.data.api.ApiClient
import com.minh.warehouse.data.model.ProductItem
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class ProductSearchActivity : AppCompatActivity() {

    private lateinit var etSearch: EditText
    private lateinit var recyclerView: RecyclerView
    private lateinit var tvEmpty: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var adapter: ProductSearchAdapter

    private var searchJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_product_search)

        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        etSearch     = findViewById(R.id.etSearch)
        recyclerView = findViewById(R.id.recyclerView)
        tvEmpty      = findViewById(R.id.tvEmpty)
        progressBar  = findViewById(R.id.progressBar)

        adapter = ProductSearchAdapter { product ->
            val intent = Intent(this, TransactionFormActivity::class.java).apply {
                putExtra(TransactionFormActivity.EXTRA_PRODUCT_ID,   product.id)
                putExtra(TransactionFormActivity.EXTRA_PRODUCT_NAME, product.name)
                putExtra(TransactionFormActivity.EXTRA_PRODUCT_SKU,  product.sku)
                putExtra(TransactionFormActivity.EXTRA_SCAN_METHOD,  "manual")
            }
            startActivity(intent)
        }

        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                searchJob?.cancel()
                searchJob = lifecycleScope.launch {
                    delay(400)
                    search(s.toString().trim())
                }
            }
        })

        search("")
    }

    private fun search(query: String) {
        lifecycleScope.launch {
            progressBar.visibility  = View.VISIBLE
            tvEmpty.visibility      = View.GONE
            recyclerView.visibility = View.GONE

            try {
                val res = ApiClient.service.searchProducts(search = query, limit = 50)
                if (res.isSuccessful) {
                    val items = res.body()?.data?.items ?: emptyList()
                    if (items.isEmpty()) {
                        tvEmpty.visibility = View.VISIBLE
                        tvEmpty.text = if (query.isEmpty()) "Chưa có sản phẩm nào"
                        else "Không tìm thấy \"$query\""
                    } else {
                        recyclerView.visibility = View.VISIBLE
                        adapter.update(items)
                    }
                } else {
                    tvEmpty.visibility = View.VISIBLE
                    tvEmpty.text = "Lỗi tải danh sách (${res.code()})"
                }
            } catch (e: Exception) {
                tvEmpty.visibility = View.VISIBLE
                tvEmpty.text = "Không thể kết nối server"
            }

            progressBar.visibility = View.GONE
        }
    }
}

// ── Adapter ────────────────────────────────────────────────────

class ProductSearchAdapter(
    private val onSelect: (ProductItem) -> Unit
) : RecyclerView.Adapter<ProductSearchAdapter.VH>() {

    private var items: List<ProductItem> = emptyList()

    inner class VH(v: View) : RecyclerView.ViewHolder(v) {
        val tvName     : TextView = v.findViewById(R.id.tvName)
        val tvSku      : TextView = v.findViewById(R.id.tvSku)
        val tvUnit     : TextView = v.findViewById(R.id.tvUnit)
        val tvSupplier : TextView = v.findViewById(R.id.tvSupplier)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = VH(
        LayoutInflater.from(parent.context)
            .inflate(R.layout.item_product_search, parent, false)
    )

    override fun getItemCount() = items.size

    override fun onBindViewHolder(h: VH, pos: Int) {
        val p = items[pos]
        h.tvName.text = p.name
        h.tvSku.text  = "SKU: ${p.sku}"
        h.tvUnit.text = p.unit
        h.tvSupplier.text       = p.supplier?.name ?: ""
        h.tvSupplier.visibility = if (p.supplier != null) View.VISIBLE else View.GONE
        h.itemView.setOnClickListener { onSelect(p) }
    }

    fun update(newItems: List<ProductItem>) {
        items = newItems
        notifyDataSetChanged()
    }
}