package com.minh.warehouse.ui.scan

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.minh.warehouse.data.api.ApiClient
import com.minh.warehouse.data.model.CreateProductRequestBody
import com.minh.warehouse.data.model.ScanResponse
import kotlinx.coroutines.launch

sealed class ScanState {
    object Idle : ScanState()
    object Scanning : ScanState()
    data class Success(val data: ScanResponse) : ScanState()
    data class Error(val message: String) : ScanState()
    data class NotFound(val rawCode: String) : ScanState()
}

class ScanViewModel : ViewModel() {

    private val _scanState = MutableLiveData<ScanState>(ScanState.Idle)
    val scanState: LiveData<ScanState> = _scanState

    private var lastScannedCode: String? = null

    fun scanCode(code: String) {
        if (code == lastScannedCode) return
        lastScannedCode = code
        _scanState.value = ScanState.Scanning
        viewModelScope.launch {
            try {
                val response = ApiClient.service.scanProduct(code)
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null) {
                        _scanState.value = ScanState.Success(body)
                    } else {
                        _scanState.value = ScanState.Error("Không có dữ liệu")
                    }
                } else if (response.code() == 404) {
                    _scanState.value = ScanState.NotFound(code)
                } else {
                    _scanState.value = ScanState.Error("Lỗi server: ${response.code()}")
                }
            } catch (e: Exception) {
                _scanState.value = ScanState.Error("Lỗi kết nối: ${e.message}")
            }
        }
    }

    fun reset() {
        lastScannedCode = null
        _scanState.value = ScanState.Idle
    }

    fun reportNewProduct(
        rawCode: String,
        suggestedName: String,
        supplierName: String,   // ← thêm
        note: String
    ) {
        viewModelScope.launch {
            try {
                val response = ApiClient.service.createProductRequest(
                    CreateProductRequestBody(
                        raw_code       = rawCode,
                        suggested_name = suggestedName,
                        supplier_name  = supplierName,  // ← thêm
                        note           = note
                    )
                )
                if (response.isSuccessful) {
                    _scanState.value = ScanState.Error("✅ Đã gửi báo cáo cho admin")
                } else {
                    _scanState.value = ScanState.Error("Gửi thất bại: ${response.code()}")
                }
            } catch (e: Exception) {
                _scanState.value = ScanState.Error("Lỗi: ${e.message}")
            }
        }
    }
}