package com.minh.warehouse.ui.picklist

import android.util.Log
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

private const val TAG = "PickListVM"

sealed class PickListUiState {
    object Loading    : PickListUiState()
    object Submitting : PickListUiState()
    object Done       : PickListUiState()

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

    // Dùng Map để track trạng thái confirm/qty riêng — tránh phụ thuộc @Transient sau copy()
    // Key = item.id
    private val confirmedSet  = mutableSetOf<String>()
    private val actualQtyMap  = mutableMapOf<String, Int>()

    private var rawItems:      List<TransactionItemDetail> = emptyList()
    private var currentCode   = ""
    private var currentStatus = ""
    private var currentTxId   = ""

    fun loadTransaction(txId: String) {
        currentTxId = txId
        _uiState.value = PickListUiState.Loading
        viewModelScope.launch {
            try {
                val response = ApiClient.service.getTransactionById(txId)
                Log.d(TAG, "loadTransaction: HTTP ${response.code()}")

                if (response.isSuccessful) {
                    val body   = response.body()
                    val detail = body?.data

                    Log.d(TAG, "body=${body != null}, detail=${detail != null}")

                    if (detail == null) {
                        _uiState.value = PickListUiState.Error("Không tìm thấy phiếu")
                        return@launch
                    }

                    Log.d(TAG, "type=${detail.type}, status=${detail.status}, items=${detail.items?.size}")

                    if (detail.type != "export") {
                        _uiState.value = PickListUiState.Error("Phiếu không phải lệnh xuất kho")
                        return@launch
                    }
                    if (detail.status != "processing") {
                        _uiState.value = PickListUiState.Error(
                            "Phiếu chưa được duyệt (trạng thái: ${detail.status})"
                        )
                        return@launch
                    }

                    val items = detail.items
                    if (items.isNullOrEmpty()) {
                        // items null hoặc rỗng từ API — hiển thị lỗi thay vì list trống im lặng
                        Log.w(TAG, "items null or empty from API!")
                        _uiState.value = PickListUiState.Error(
                            "Phiếu không có sản phẩm nào (items=null). Kiểm tra lại API."
                        )
                        return@launch
                    }

                    currentCode   = detail.code
                    currentStatus = detail.status
                    rawItems      = items

                    // Reset state
                    confirmedSet.clear()
                    actualQtyMap.clear()
                    items.forEach { actualQtyMap[it.id] = it.quantity_requested }

                    Log.d(TAG, "Loaded ${items.size} items OK")
                    items.forEach { item ->
                        Log.d(TAG, "  item id=${item.id} product=${item.product?.name} " +
                                "suggested_bin=${item.suggested_bin?.code} from_bin=${item.from_bin?.code}")
                    }

                    emitReady()
                } else {
                    val errBody = response.errorBody()?.string() ?: ""
                    Log.e(TAG, "Error response: ${response.code()} $errBody")
                    _uiState.value = PickListUiState.Error("Lỗi ${response.code()}: không thể tải phiếu")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception loading transaction", e)
                _uiState.value = PickListUiState.Error("Mất kết nối — kiểm tra WiFi\n${e.message}")
            }
        }
    }

    fun confirmItem(itemId: String) {
        if (rawItems.none { it.id == itemId }) return
        confirmedSet.add(itemId)
        emitReady()
    }

    fun undoItem(itemId: String) {
        confirmedSet.remove(itemId)
        emitReady()
    }

    fun updateActualQty(itemId: String, qty: Int) {
        if (rawItems.none { it.id == itemId }) return
        actualQtyMap[itemId] = qty
        emitReady()
    }

    fun submitPickList(txId: String) {
        if (rawItems.any { it.id !in confirmedSet }) return

        _uiState.value = PickListUiState.Submitting
        viewModelScope.launch {
            try {
                val completeItems = rawItems.map { item ->
                    CompleteItemInput(
                        product_id      = item.product_id,
                        // Ưu tiên suggested_bin (đã apply thành from_bin), fallback from_bin
                        from_bin_id     = item.suggested_bin?.id ?: item.from_bin?.id,
                        to_bin_id       = item.to_bin?.id,
                        quantity_actual = actualQtyMap[item.id] ?: item.quantity_requested
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
                _uiState.value = PickListUiState.SubmitError("Mất kết nối — thử lại\n${e.message}")
            }
        }
    }

    // Tạo snapshot items với trạng thái confirm/qty từ Map — không phụ thuộc @Transient
    private fun emitReady() {
        val snapshot = rawItems.map { item ->
            item.also {
                it.isConfirmed = item.id in confirmedSet
                it.actualQty   = actualQtyMap[item.id] ?: item.quantity_requested
            }
        }
        _uiState.value = PickListUiState.Ready(
            transactionId = currentTxId,
            code          = currentCode,
            status        = currentStatus,
            items         = snapshot
        )
    }
}