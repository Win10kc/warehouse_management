package com.minh.warehouse.ui.transaction

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.ViewModelProvider
import com.minh.warehouse.R
import com.minh.warehouse.data.model.BinItem

class TransactionFormActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_PRODUCT_ID   = "product_id"
        const val EXTRA_PRODUCT_NAME = "product_name"
        const val EXTRA_PRODUCT_SKU  = "product_sku"
        const val EXTRA_SCAN_METHOD  = "scan_method"
    }

    private lateinit var viewModel: TransactionFormViewModel

    private lateinit var tvProductName: TextView
    private lateinit var rgType: RadioGroup
    private lateinit var rbImport: RadioButton
    private lateinit var spinnerWarehouse: Spinner
    private lateinit var spinnerZone: Spinner
    private lateinit var spinnerRack: Spinner
    private lateinit var spinnerBin: Spinner
    private lateinit var etQuantity: EditText
    private lateinit var etNote: EditText
    private lateinit var btnSubmit: Button
    private lateinit var tvError: TextView
    private lateinit var progressBar: ProgressBar

    private var bins: List<BinItem> = emptyList()
    private var productId  = ""
    private var scanMethod = "manual"

    // Flag tránh trigger cascade khi code tự set selection
    private var suppressWarehouseListener = false
    private var suppressZoneListener = false
    private var suppressRackListener = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_transaction_form)

        productId       = intent.getStringExtra(EXTRA_PRODUCT_ID)   ?: ""
        val productName = intent.getStringExtra(EXTRA_PRODUCT_NAME) ?: ""
        val productSku  = intent.getStringExtra(EXTRA_PRODUCT_SKU)  ?: ""
        scanMethod      = intent.getStringExtra(EXTRA_SCAN_METHOD)  ?: "manual"

        viewModel = ViewModelProvider(this)[TransactionFormViewModel::class.java]

        tvProductName   = findViewById(R.id.tvProductName)
        rgType          = findViewById(R.id.rgType)
        rbImport        = findViewById(R.id.rbImport)
        spinnerWarehouse= findViewById(R.id.spinnerWarehouse)
        spinnerZone     = findViewById(R.id.spinnerZone)
        spinnerRack     = findViewById(R.id.spinnerRack)
        spinnerBin      = findViewById(R.id.spinnerBin)
        etQuantity      = findViewById(R.id.etQuantity)
        etNote          = findViewById(R.id.etNote)
        btnSubmit       = findViewById(R.id.btnSubmit)
        tvError         = findViewById(R.id.tvError)
        progressBar     = findViewById(R.id.progressBar)

        tvProductName.text = "$productName (SKU: $productSku)"

        setupSpinnerListeners()
        observeViewModel()
        viewModel.loadWarehouses()

        btnSubmit.setOnClickListener { submitForm() }
    }

    private fun setupSpinnerListeners() {
        spinnerWarehouse.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                if (!suppressWarehouseListener) viewModel.onWarehouseSelected(pos)
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
        spinnerZone.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                if (!suppressZoneListener) viewModel.onZoneSelected(pos)
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
        spinnerRack.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                if (!suppressRackListener) viewModel.onRackSelected(pos)
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
    }

    private fun observeViewModel() {
        viewModel.warehouses.observe(this) { list ->
            val labels = if (list.isEmpty()) listOf("— Chưa có kho —")
            else list.map { it.name }
            spinnerWarehouse.adapter = ArrayAdapter(
                this, android.R.layout.simple_spinner_dropdown_item, labels
            )
        }

        viewModel.zones.observe(this) { list ->
            val labels = if (list.isEmpty()) listOf("— Chưa có zone —")
            else list.map { "${it.code} – ${it.name}" }
            suppressZoneListener = true
            spinnerZone.adapter = ArrayAdapter(
                this, android.R.layout.simple_spinner_dropdown_item, labels
            )
            suppressZoneListener = false
        }

        viewModel.racks.observe(this) { list ->
            val labels = if (list.isEmpty()) listOf("— Chưa có rack —")
            else list.map { "${it.code} – ${it.name}" }
            suppressRackListener = true
            spinnerRack.adapter = ArrayAdapter(
                this, android.R.layout.simple_spinner_dropdown_item, labels
            )
            suppressRackListener = false
        }

        viewModel.bins.observe(this) { binList ->
            bins = binList
            val labels = if (binList.isEmpty()) listOf("— Chưa có bin —")
            else binList.map { it.code }
            spinnerBin.adapter = ArrayAdapter(
                this, android.R.layout.simple_spinner_dropdown_item, labels
            )
        }

        viewModel.formState.observe(this) { state ->
            when (state) {
                is FormState.Loading -> {
                    progressBar.visibility = View.VISIBLE
                    btnSubmit.isEnabled = false
                    tvError.visibility = View.GONE
                }
                is FormState.Success -> {
                    Toast.makeText(this,
                        "Tạo phiếu thành công: ${state.code}", Toast.LENGTH_LONG).show()
                    finish()
                }
                is FormState.Error -> {
                    progressBar.visibility = View.GONE
                    btnSubmit.isEnabled = true
                    tvError.visibility = View.VISIBLE
                    tvError.text = state.message
                }

                else -> {
                    progressBar.visibility = View.GONE
                    btnSubmit.isEnabled = true
                }
            }
        }
    }

    private fun submitForm() {
        val qty = etQuantity.text.toString().toIntOrNull()
        if (qty == null || qty <= 0) {
            tvError.visibility = View.VISIBLE
            tvError.text = "Số lượng không hợp lệ"
            return
        }
        val selectedBin = bins.getOrNull(spinnerBin.selectedItemPosition)
        if (selectedBin == null) {
            tvError.visibility = View.VISIBLE
            tvError.text = "Chưa chọn bin — kiểm tra lại kho"
            return
        }
        val isImport = rbImport.isChecked
        viewModel.createTransaction(
            productId  = productId,
            type       = if (isImport) "import" else "export",
            binId      = selectedBin.id,
            isImport   = isImport,
            quantity   = qty,
            note       = etNote.text.toString().trim(),
            scanMethod = scanMethod
        )
    }
}