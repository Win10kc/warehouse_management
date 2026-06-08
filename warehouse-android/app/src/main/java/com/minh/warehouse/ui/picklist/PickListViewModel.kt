package com.minh.warehouse.ui.picklist

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.minh.warehouse.data.api.ApiClient
import com.minh.warehouse.data.model.CompleteItemInput
import com.minh.warehouse.data.model.CompleteTransactionRequest
import com.minh.warehouse.data.model.TransactionItemDetail
import kotlinx.coroutines.launch

// ════════════════════════════════════════════════════════════════
// ui/picklist/PickListViewModel.kt
// ════════════════════════════════════════════════════════════════

sealed class PickListUiState {
    object Loading   : PickListUiState()
    object Submitting: PickListUiState()
    object Done      : PickListUiState()

    data class Error(val message: String)       : PickListUiState()
    data class SubmitError(val message: String) : PickListUiState()

    data class Ready(
        val transactionId: String,
        val code:          String,
        val status:        String,
        val items:         List<TransactionItemDetail>
    ) : PickListUiState()
}

class PickListViewModel : ViewModel() {

    private val _uiState = MutableLiveData<PickListUiState>(PickListUiState.Loading)
    val uiState: LiveData<PickListUiState> = _uiState

    // Bản sao mutable của items để theo dõi isConfirmed
    private var currentItems: MutableList<TransactionItemDetail> = mutableListOf()
    private var currentCode  = ""
    private var currentStatus= ""
    private var currentTxId  = ""

    fun loadTransaction(txId: String) {
        currentTxId = txId
        _uiState.value = PickListUiState.Loading
        viewModelScope.launch {
            try {
                val response = ApiClient.service.getTransactionById(txId)
                if (response.isSuccessful) {
                    val detail = response.body()?.data
                    if (detail == null) {
                        _uiState.value = PickListUiState.Error("Không tìm thấy phiếu")
                        return@launch
                    }
                    // Chỉ load phiếu xuất đang processing
                    if (detail.type != "export") {
                        _uiState.value = PickListUiState.Error("Phiếu không phải lệnh xuất kho")
                        return@launch
                    }
                    if (detail.status != "processing") {
                        _uiState.value = PickListUiState.Error("Phiếu chưa được duyệt (trạng thái: ${detail.status})")
                        return@launch
                    }

                    currentCode   = detail.code
                    currentStatus = detail.status
                    currentItems  = (detail.items ?: emptyList()).toMutableList()

                    // Reset confirmed state
                    currentItems.forEach { it.isConfirmed = false; it.actualQty = it.quantity_requested }

                    emitReady()
                } else {
                    _uiState.value = PickListUiState.Error("Lỗi ${response.code()}: không thể tải phiếu")
                }
            } catch (e: Exception) {
                _uiState.value = PickListUiState.Error("Mất kết nối — kiểm tra WiFi")
            }
        }
    }

    fun confirmItem(itemId: String) {
        val idx = currentItems.indexOfFirst { it.id == itemId }
        if (idx == -1) return
        currentItems[idx] = currentItems[idx].copy().also {
            it.isConfirmed = true
            it.actualQty   = currentItems[idx].actualQty
        }
        emitReady()
    }

    fun undoItem(itemId: String) {
        val idx = currentItems.indexOfFirst { it.id == itemId }
        if (idx == -1) return
        currentItems[idx] = currentItems[idx].copy().also {
            it.isConfirmed = false
        }
        emitReady()
    }

    fun updateActualQty(itemId: String, qty: Int) {
        val idx = currentItems.indexOfFirst { it.id == itemId }
        if (idx == -1) return
        currentItems[idx] = currentItems[idx].copy().also {
            it.actualQty = qty
        }
        emitReady()
    }

    fun submitPickList(txId: String) {
        if (currentItems.any { !it.isConfirmed }) return

        _uiState.value = PickListUiState.Submitting
        viewModelScope.launch {
            try {
                val completeItems = currentItems.map { item ->
                    CompleteItemInput(
                        product_id      = item.product_id,
                        // from_bin_id = suggested_bin_id (staff đã xác nhận lấy từ bin đó)
                        from_bin_id     = item.suggested_bin?.id ?: item.from_bin?.id,
                        to_bin_id       = item.to_bin?.id,
                        quantity_actual = item.actualQty
                    )
                }
                val req      = CompleteTransactionRequest(items = completeItems)
                val response = ApiClient.service.completeTransaction(txId, req)

                if (response.isSuccessful) {
                    _uiState.value = PickListUiState.Done
                } else {
                    val errBody = response.errorBody()?.string() ?: ""
                    _uiState.value = PickListUiState.SubmitError("Lỗi ${response.code()}: $errBody")
                }
            } catch (e: Exception) {
                _uiState.value = PickListUiState.SubmitError("Mất kết nối — thử lại")
            }
        }
    }

    private fun emitReady() {
        _uiState.value = PickListUiState.Ready(
            transactionId = currentTxId,
            code          = currentCode,
            status        = currentStatus,
            items         = currentItems.toList()
        )
    }
}