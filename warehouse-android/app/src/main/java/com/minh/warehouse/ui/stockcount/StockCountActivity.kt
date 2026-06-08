package com.minh.warehouse.ui.stockcount

import android.content.pm.PackageManager
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModelProvider
import com.google.android.material.card.MaterialCardView
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.minh.warehouse.R
import com.minh.warehouse.data.model.BinStockRow
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class StockCountActivity : AppCompatActivity() {

    companion object {
        private const val REQUEST_CAMERA = 2001
    }

    private lateinit var viewModel: StockCountViewModel
    private lateinit var cameraExecutor: ExecutorService

    // Views — scan state
    private lateinit var layoutScan: FrameLayout
    private lateinit var previewView: PreviewView
    private lateinit var tvScanHint: TextView

    // Views — count state
    private lateinit var layoutCount: ScrollView
    private lateinit var tvBinCode: TextView
    private lateinit var tvBinId: TextView
    private lateinit var btnScanOtherBin: Button
    private lateinit var progressProducts: ProgressBar
    private lateinit var tvEmptyBin: TextView
    private lateinit var tvProductsLabel: TextView
    private lateinit var containerItems: LinearLayout
    private lateinit var etNote: EditText
    private lateinit var tvSubmitError: TextView
    private lateinit var progressSubmit: ProgressBar
    private lateinit var btnSubmitCount: Button

    // Map productId → EditText để đọc giá trị khi submit
    private val editTextMap = mutableMapOf<String, EditText>()

    // Track nếu camera đã pause để tránh scan lại khi quay về
    private var isScanPaused = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_stock_count)

        viewModel    = ViewModelProvider(this)[StockCountViewModel::class.java]
        cameraExecutor = Executors.newSingleThreadExecutor()

        // Toolbar
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationOnClickListener { finish() }

        // Bind views
        layoutScan       = findViewById(R.id.layoutScan)
        previewView      = findViewById(R.id.previewView)
        tvScanHint       = findViewById(R.id.tvScanHint)
        layoutCount      = findViewById(R.id.layoutCount)
        tvBinCode        = findViewById(R.id.tvBinCode)
        tvBinId          = findViewById(R.id.tvBinId)
        btnScanOtherBin  = findViewById(R.id.btnScanOtherBin)
        progressProducts = findViewById(R.id.progressProducts)
        tvEmptyBin       = findViewById(R.id.tvEmptyBin)
        tvProductsLabel  = findViewById(R.id.tvProductsLabel)
        containerItems   = findViewById(R.id.containerItems)
        etNote           = findViewById(R.id.etNote)
        tvSubmitError    = findViewById(R.id.tvSubmitError)
        progressSubmit   = findViewById(R.id.progressSubmit)
        btnSubmitCount   = findViewById(R.id.btnSubmitCount)

        btnScanOtherBin.setOnClickListener {
            viewModel.resetScan()
            isScanPaused = false
            showScanState()
        }

        btnSubmitCount.setOnClickListener { submitCount() }

        observeViewModel()
        requestCameraPermission()
    }

    // ── Camera ────────────────────────────────────────────────

    private fun requestCameraPermission() {
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(
                this, arrayOf(android.Manifest.permission.CAMERA), REQUEST_CAMERA
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int, permissions: Array<out String>, grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA &&
            grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            tvScanHint.text = "Cần cấp quyền Camera để quét QR bin"
        }
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()
            val preview  = Preview.Builder().build()
                .also { it.setSurfaceProvider(previewView.surfaceProvider) }

            val analyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor, BinQrAnalyzer { binId ->
                        runOnUiThread {
                            if (!isScanPaused) {
                                isScanPaused = true
                                tvScanHint.text = "Đang tải dữ liệu bin..."
                                viewModel.loadBinProducts(binId)
                            }
                        }
                    })
                }

            try {
                provider.unbindAll()
                provider.bindToLifecycle(
                    this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analyzer
                )
            } catch (e: Exception) {
                tvScanHint.text = "Lỗi camera: ${e.message}"
            }
        }, ContextCompat.getMainExecutor(this))
    }

    // ── Observers ─────────────────────────────────────────────

    private fun observeViewModel() {
        viewModel.binLoadState.observe(this) { state ->
            when (state) {
                is BinLoadState.Idle -> showScanState()

                is BinLoadState.Loading -> {
                    showCountState()
                    progressProducts.visibility = View.VISIBLE
                    tvEmptyBin.visibility       = View.GONE
                    tvProductsLabel.visibility  = View.GONE
                    containerItems.removeAllViews()
                    editTextMap.clear()
                }

                is BinLoadState.Success -> {
                    progressProducts.visibility = View.GONE
                    tvBinCode.text = state.binCode
                    tvBinId.text   = state.binId
                    showCountState()
                    populateItems(state.items)
                }

                is BinLoadState.Error -> {
                    progressProducts.visibility = View.GONE
                    tvEmptyBin.text       = state.message
                    tvEmptyBin.visibility = View.VISIBLE
                    showCountState()
                }
            }
        }

        viewModel.submitState.observe(this) { state ->
            when (state) {
                is CountSubmitState.Idle -> {
                    progressSubmit.visibility = View.GONE
                    btnSubmitCount.isEnabled  = true
                    tvSubmitError.visibility  = View.GONE
                }

                is CountSubmitState.Loading -> {
                    progressSubmit.visibility = View.VISIBLE
                    btnSubmitCount.isEnabled  = false
                    tvSubmitError.visibility  = View.GONE
                }

                is CountSubmitState.Success -> {
                    progressSubmit.visibility = View.GONE
                    Toast.makeText(
                        this,
                        "✅ Tạo phiếu kiểm kê thành công: ${state.txCode}",
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                }

                is CountSubmitState.Error -> {
                    progressSubmit.visibility = View.GONE
                    btnSubmitCount.isEnabled  = true
                    tvSubmitError.visibility  = View.VISIBLE
                    tvSubmitError.text        = state.message
                }
            }
        }
    }

    // ── UI helpers ────────────────────────────────────────────

    private fun showScanState() {
        layoutScan.visibility  = View.VISIBLE
        layoutCount.visibility = View.GONE
    }

    private fun showCountState() {
        layoutScan.visibility  = View.GONE
        layoutCount.visibility = View.VISIBLE
    }

    /**
     * Tạo dynamic view cho từng sản phẩm trong bin.
     * Nếu bin rỗng (DB không có sản phẩm nào), hiện empty state
     * nhưng vẫn cho phép tạo phiếu (Phương án A — bỏ qua sp chưa được liệt kê).
     */
    private fun populateItems(rows: List<BinStockRow>) {
        containerItems.removeAllViews()
        editTextMap.clear()

        if (rows.isEmpty()) {
            tvEmptyBin.visibility      = View.VISIBLE
            tvProductsLabel.visibility = View.GONE
            // Với bin rỗng trong DB, không có items để nhập → ẩn nút submit
            btnSubmitCount.visibility  = View.GONE
            return
        }

        tvEmptyBin.visibility      = View.GONE
        tvProductsLabel.visibility = View.VISIBLE
        btnSubmitCount.visibility  = View.VISIBLE

        val inflater = layoutInflater
        for (row in rows) {
            if (row.product_id.isBlank()) continue  // skip rows không có sản phẩm

            val itemView = inflater.inflate(R.layout.item_count_product, containerItems, false)

            val tvName    = itemView.findViewById<TextView>(R.id.tvItemProductName)
            val tvSku     = itemView.findViewById<TextView>(R.id.tvItemSku)
            val tvDbQty   = itemView.findViewById<TextView>(R.id.tvDbQty)
            val etActual  = itemView.findViewById<EditText>(R.id.etActualQty)
            val tvDelta   = itemView.findViewById<TextView>(R.id.tvDelta)

            tvName.text   = row.product_name
            tvSku.text    = "SKU: ${row.sku}  ·  ĐVT: ${row.unit}"
            tvDbQty.text  = row.quantity.toString()

            // Prefill với DB qty để tiện chỉnh
            etActual.setText(row.quantity.toString())

            // Hiện delta hint khi nhập
            etActual.addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
                override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    val actual = s?.toString()?.toIntOrNull()
                    if (actual == null) {
                        tvDelta.visibility = View.GONE
                        return
                    }
                    val delta = actual - row.quantity
                    tvDelta.visibility = View.VISIBLE
                    when {
                        delta > 0 -> {
                            tvDelta.text      = "▲ Thừa $delta so với DB"
                            tvDelta.setTextColor(0xFF1B5E20.toInt())
                        }
                        delta < 0 -> {
                            tvDelta.text      = "▼ Thiếu ${-delta} so với DB"
                            tvDelta.setTextColor(0xFFB71C1C.toInt())
                        }
                        else -> {
                            tvDelta.text      = "✓ Khớp với DB"
                            tvDelta.setTextColor(0xFF555555.toInt())
                        }
                    }
                }
            })

            editTextMap[row.product_id] = etActual
            containerItems.addView(itemView)
        }
    }

    private fun submitCount() {
        val actualMap = mutableMapOf<String, Int>()
        for ((productId, et) in editTextMap) {
            val qty = et.text.toString().toIntOrNull()
            if (qty == null || qty < 0) {
                tvSubmitError.visibility = View.VISIBLE
                tvSubmitError.text = "Số lượng không hợp lệ — kiểm tra lại"
                return
            }
            actualMap[productId] = qty
        }
        viewModel.submitCount(
            actualMap = actualMap,
            note      = etNote.text.toString().trim()
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}

// ── QR Analyzer cho bin ──────────────────────────────────────

private class BinQrAnalyzer(private val onResult: (String) -> Unit) : ImageAnalysis.Analyzer {
    private val scanner    = BarcodeScanning.getClient()
    private var processing = false

    @androidx.camera.core.ExperimentalGetImage
    override fun analyze(imageProxy: ImageProxy) {
        if (processing) { imageProxy.close(); return }
        val mediaImage = imageProxy.image ?: run { imageProxy.close(); return }
        processing = true
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                barcodes.firstOrNull { it.rawValue != null }
                    ?.rawValue?.let { onResult(it) }
            }
            .addOnCompleteListener {
                imageProxy.close()
                processing = false
            }
    }
}