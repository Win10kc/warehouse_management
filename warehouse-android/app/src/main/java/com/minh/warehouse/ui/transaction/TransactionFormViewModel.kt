package com.minh.warehouse.ui.transaction

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.minh.warehouse.data.api.ApiClient
import com.minh.warehouse.data.model.*
import kotlinx.coroutines.launch
import android.content.Context
import com.google.gson.Gson


sealed class FormState {
    object Idle    : FormState()
    object Loading : FormState()
    data class Success(val code: String) : FormState()
    data class Error(val message: String) : FormState()
}

class TransactionFormViewModel : ViewModel() {

    // Raw data từ API
    private var allWarehouses: List<WarehouseItem> = emptyList()

    // Cascade LiveData
    private val _warehouses = MutableLiveData<List<WarehouseItem>>(emptyList())
    val warehouses: LiveData<List<WarehouseItem>> = _warehouses

    private val _zones = MutableLiveData<List<ZoneItem>>(emptyList())
    val zones: LiveData<List<ZoneItem>> = _zones

    private val _racks = MutableLiveData<List<RackItem>>(emptyList())
    val racks: LiveData<List<RackItem>> = _racks

    private val _bins = MutableLiveData<List<BinItem>>(emptyList())
    val bins: LiveData<List<BinItem>> = _bins

    private val _formState = MutableLiveData<FormState>(FormState.Idle)
    val formState: LiveData<FormState> = _formState

    fun loadWarehouses() {
        viewModelScope.launch {
            try {
                val response = ApiClient.service.getWarehouses()
                if (response.isSuccessful) {
                    allWarehouses = response.body()?.data ?: emptyList()
                    _warehouses.value = allWarehouses
                } else {
                    _warehouses.value = emptyList()
                }
            } catch (e: Exception) {
                _warehouses.value = emptyList()
            }
        }
    }

    fun onWarehouseSelected(index: Int) {
        val warehouse = allWarehouses.getOrNull(index) ?: return
        val zoneList = warehouse.zones ?: emptyList()
        _zones.value = zoneList
        _racks.value = emptyList()
        _bins.value = emptyList()
        // Tự động chọn zone đầu tiên nếu có
        if (zoneList.isNotEmpty()) onZoneSelected(0)
    }

    fun onZoneSelected(index: Int) {
        val zone = (_zones.value ?: emptyList()).getOrNull(index) ?: return
        val rackList = zone.racks ?: emptyList()
        _racks.value = rackList
        _bins.value = emptyList()
        if (rackList.isNotEmpty()) onRackSelected(0)
    }

    fun onRackSelected(index: Int) {
        val rack = (_racks.value ?: emptyList()).getOrNull(index) ?: return
        _bins.value = rack.bins ?: emptyList()
    }

    fun createTransaction(
        productId: String,
        type: String,
        binId: String,
        isImport: Boolean,
        quantity: Int,
        note: String,
        scanMethod: String
    ) {
        _formState.value = FormState.Loading
        viewModelScope.launch {
            try {
                val item = TransactionItemInput(
                    product_id         = productId,
                    from_bin_id        = if (!isImport) binId else null,
                    to_bin_id          = if (isImport)  binId else null,
                    quantity_requested = quantity,
                    scan_method        = scanMethod
                )
                val req = CreateTransactionRequest(type = type, note = note, items = listOf(item))
                val response = ApiClient.service.createTransaction(req)
                if (response.isSuccessful) {
                    _formState.value = FormState.Success(response.body()?.data?.code ?: "?")
                } else {
                    _formState.value = FormState.Error("Lỗi ${response.code()}")
                }
            } catch (e: Exception) {
                _formState.value = FormState.Error("Không thể kết nối server — kiểm tra WiFi")
            }
        }
    }
}