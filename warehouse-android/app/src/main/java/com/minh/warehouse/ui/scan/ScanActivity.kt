package com.minh.warehouse.ui.scan

import android.content.Intent
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModelProvider
import androidx.cardview.widget.CardView
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.minh.warehouse.R
import com.minh.warehouse.data.model.ScanData
import com.minh.warehouse.ui.transaction.TransactionFormActivity
import com.minh.warehouse.util.NfcScanHelper
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class ScanActivity : AppCompatActivity() {

    companion object {
        private const val REQUEST_CAMERA = 1001
    }

    private lateinit var viewModel: ScanViewModel
    private lateinit var cameraExecutor: ExecutorService
    private var nfcAdapter: NfcAdapter? = null

    private lateinit var previewView: PreviewView
    private lateinit var tvHint: TextView
    private lateinit var cardResult: CardView
    private lateinit var tvScanType: TextView
    private lateinit var tvProductName: TextView
    private lateinit var tvSku: TextView
    private lateinit var btnCreateTransaction: Button
    private lateinit var btnScanAgain: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scan)

        viewModel       = ViewModelProvider(this)[ScanViewModel::class.java]
        cameraExecutor  = Executors.newSingleThreadExecutor()
        nfcAdapter      = NfcScanHelper.getAdapter(this)

        previewView         = findViewById(R.id.previewView)
        tvHint              = findViewById(R.id.tvHint)
        cardResult          = findViewById(R.id.cardResult)
        tvScanType          = findViewById(R.id.tvScanType)
        tvProductName       = findViewById(R.id.tvProductName)
        tvSku               = findViewById(R.id.tvSku)
        btnCreateTransaction = findViewById(R.id.btnCreateTransaction)
        btnScanAgain        = findViewById(R.id.btnScanAgain)

        // Cập nhật hint theo NFC availability
        tvHint.text = when {
            nfcAdapter == null        -> "Đưa mã QR vào khung"
            !nfcAdapter!!.isEnabled   -> "Đưa mã QR vào khung (NFC đang tắt)"
            else                      -> "Đưa mã QR vào khung hoặc chạm thẻ NFC"
        }

        // Xin CAMERA permission trước khi khởi động camera
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(android.Manifest.permission.CAMERA),
                REQUEST_CAMERA
            )
        }

        observeState()
        btnScanAgain.setOnClickListener { viewModel.reset() }
        btnCreateTransaction.setOnClickListener {
            val product = (viewModel.scanState.value as? ScanState.Success)?.data?.data?.product
                ?: return@setOnClickListener
            val scanType = (viewModel.scanState.value as? ScanState.Success)?.data?.data?.scan_type
                ?: "manual"
            val intent = Intent(this, TransactionFormActivity::class.java).apply {
                putExtra(TransactionFormActivity.EXTRA_PRODUCT_ID,   product.id.toString())
                putExtra(TransactionFormActivity.EXTRA_PRODUCT_NAME, product.name)
                putExtra(TransactionFormActivity.EXTRA_PRODUCT_SKU,  product.sku)
                putExtra(TransactionFormActivity.EXTRA_SCAN_METHOD,  scanType)
            }
            startActivity(intent)
        }
    }

    // ── Permission result ────────────────────────────────────────────────────

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA &&
            grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            tvHint.text = "Cần cấp quyền Camera để quét QR"
        }
    }

    // ── NFC lifecycle ────────────────────────────────────────────────────────

    override fun onResume() {
        super.onResume()
        nfcAdapter?.let { NfcScanHelper.enableForegroundDispatch(this, it) }
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.let { NfcScanHelper.disableForegroundDispatch(this, it) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.action == NfcAdapter.ACTION_NDEF_DISCOVERED ||
            intent.action == NfcAdapter.ACTION_TAG_DISCOVERED ||
            intent.action == NfcAdapter.ACTION_TECH_DISCOVERED
        ) {
            val tag: Tag? = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG)
            tag?.let { handleNfcTag(it) }
        }
    }

    private fun handleNfcTag(tag: Tag) {
        val ndefText = NfcScanHelper.readNdefText(tag)
        val code = if (!ndefText.isNullOrBlank()) ndefText
        else NfcScanHelper.readUid(tag)
        tvHint.text = "NFC detected: $code"
        viewModel.scanCode(code)
    }

    // ── Camera / QR ──────────────────────────────────────────────────────────

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()
            val preview = Preview.Builder().build()
                .also { it.setSurfaceProvider(previewView.surfaceProvider) }

            val analyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor, QrAnalyzer { code ->
                        runOnUiThread {
                            if (viewModel.scanState.value is ScanState.Idle) {
                                tvHint.text = "QR detected: $code"
                                viewModel.scanCode(code)
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
                tvHint.text = "Lỗi camera: ${e.message}"
            }
        }, ContextCompat.getMainExecutor(this))
    }

    // ── Observer ─────────────────────────────────────────────────────────────

    private fun observeState() {
        viewModel.scanState.observe(this) { state ->
            when (state) {
                is ScanState.Idle -> {
                    cardResult.visibility = View.GONE
                    tvHint.text = when {
                        nfcAdapter?.isEnabled == true -> "Đưa mã QR vào khung hoặc chạm thẻ NFC"
                        else -> "Đưa mã QR vào khung"
                    }
                }
                is ScanState.Scanning -> {
                    tvHint.text = "Đang tra cứu..."
                    cardResult.visibility = View.GONE
                }
                is ScanState.Success -> showResult(state.data.data)
                is ScanState.NotFound -> showNotFoundDialog(state.rawCode)
                is ScanState.Error   -> {
                    tvHint.text = state.message
                    cardResult.visibility = View.GONE
                }
            }
        }
    }

    private fun showNotFoundDialog(rawCode: String) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_report_product, null)
        val etName = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etSuggestedName)
        val etSupplier = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etSupplierName)
        val etNote = dialogView.findViewById<com.google.android.material.textfield.TextInputEditText>(R.id.etNote)

        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Sản phẩm chưa có trong hệ thống")
            .setMessage("Mã quét: $rawCode\nNhập thông tin để báo cáo cho admin:")
            .setView(dialogView)
            .setPositiveButton("Gửi báo cáo") { _, _ ->
                val name = etName.text?.toString()?.trim() ?: ""
                if (name.isEmpty()) {
                    Toast.makeText(this, "Vui lòng nhập tên sản phẩm", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                viewModel.reportNewProduct(
                    rawCode       = rawCode,
                    suggestedName = name,
                    supplierName  = etSupplier.text?.toString()?.trim() ?: "",
                    note          = etNote.text?.toString()?.trim() ?: ""
                )
            }
            .setNegativeButton("Bỏ qua") { _, _ -> viewModel.reset() }
            .setCancelable(false)
            .show()
    }

    private fun showResult(data: ScanData?) {
        if (data == null) return
        tvScanType.text    = "Scan type: ${data.scan_type.uppercase()}"
        tvProductName.text = data.product.name
        tvSku.text         = "SKU: ${data.product.sku}  |  ĐVT: ${data.product.unit}"
        cardResult.visibility = View.VISIBLE
        tvHint.text = "Tìm thấy sản phẩm ✅"
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}

// ── QR Analyzer ──────────────────────────────────────────────────────────────

private class QrAnalyzer(private val onResult: (String) -> Unit) : ImageAnalysis.Analyzer {
    private val scanner = BarcodeScanning.getClient()
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