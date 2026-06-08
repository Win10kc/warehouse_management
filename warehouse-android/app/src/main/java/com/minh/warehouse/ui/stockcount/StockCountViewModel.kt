package com.minh.warehouse.ui.stockcount

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.minh.warehouse.data.api.ApiClient
import com.minh.warehouse.data.model.BinStockRow
import com.minh.warehouse.data.model.StockCountItem
import com.minh.warehouse.data.model.StockCountRequest
import kotlinx.coroutines.launch

// ── State classes ─────────────────────────────────────────────

sealed class BinLoadState {
    object Idle    : BinLoadState()
    object Loading : BinLoadState()
    data class Success(val binId: String, val binCode: String, val items: List<BinStockRow>) : BinLoadState()
    data class Error(val message: String) : BinLoadState()
}

sealed class CountSubmitState {
    object Idle    : CountSubmitState()
    object Loading : CountSubmitState()
    data class Success(val txCode: String) : CountSubmitState()
    data class Error(val message: String)  : CountSubmitState()
}

// ── ViewModel ─────────────────────────────────────────────────

class StockCountViewModel : ViewModel() {

    private val _binLoadState = MutableLiveData<BinLoadState>(BinLoadState.Idle)
    val binLoadState: LiveData<BinLoadState> = _binLoadState

    private val _submitState = MutableLiveData<CountSubmitState>(CountSubmitState.Idle)
    val submitState: LiveData<CountSubmitState> = _submitState

    // Lưu binId hiện tại để dùng khi submit
    private var currentBinId: String = ""

    /**
     * Gọi sau khi scan QR bin thành công — binId là UUID của bin.
     * Gọi GET /stock/locations?search=<binCode hoặc binId> để lấy
     * danh sách sản phẩm đang có trong bin đó.
     *
     * Lưu ý: API trả về BinStockRow[] lọc theo bin_code/search.
     * Ta dùng bin_id để filter chính xác phía client.
     */
    fun loadBinProducts(binId: String) {
        if (binId.isBlank()) return
        currentBinId = binId
        _binLoadState.value = BinLoadState.Loading

        viewModelScope.launch {
            try {
                // Gọi endpoint locations với search = binId
                // Backend sẽ match bin_id/bin_code/sku/product_name
                val response = ApiClient.service.getStockLocations(search = binId)
                if (response.isSuccessful) {
                    val allRows = response.body()?.data ?: emptyList()
                    // Filter chính xác theo bin_id
                    val binRows = allRows.filter { it.bin_id == binId }

                    // Lấy bin_code từ row đầu tiên (nếu có)
                    val binCode = binRows.firstOrNull()?.bin_code ?: binId.take(8) + "..."

                    _binLoadState.value = BinLoadState.Success(
                        binId   = binId,
                        binCode = binCode,
                        items   = binRows
                    )
                } else {
                    _binLoadState.value = BinLoadState.Error("Lỗi tải dữ liệu: ${response.code()}")
                }
            } catch (e: Exception) {
                _binLoadState.value = BinLoadState.Error("Không thể kết nối server")
            }
        }
    }

    /**
     * Submit phiếu kiểm kê.
     * actualMap: Map<productId, actualQty> — chỉ gửi những sản phẩm đã nhập.
     */
    fun submitCount(actualMap: Map<String, Int>, note: String) {
        if (currentBinId.isBlank()) return

        // Phải có ít nhất 1 item
        if (actualMap.isEmpty()) {
            _submitState.value = CountSubmitState.Error("Vui lòng nhập số lượng thực tế")
            return
        }

        _submitState.value = CountSubmitState.Loading

        viewModelScope.launch {
            try {
                val items = actualMap.map { (productId, qty) ->
                    StockCountItem(product_id = productId, actual_qty = qty)
                }
                val req = StockCountRequest(
                    bin_id = currentBinId,
                    note   = note,
                    items  = items
                )
                val response = ApiClient.service.createStockCount(req)
                if (response.isSuccessful) {
                    val code = response.body()?.data?.code ?: "?"
                    _submitState.value = CountSubmitState.Success(code)
                } else {
                    _submitState.value = CountSubmitState.Error("Lỗi: ${response.code()}")
                }
            } catch (e: Exception) {
                _submitState.value = CountSubmitState.Error("Không thể kết nối server")
            }
        }
    }

    fun resetScan() {
        currentBinId = ""
        _binLoadState.value = BinLoadState.Idle
        _submitState.value  = CountSubmitState.Idle
    }

    fun resetSubmit() {
        _submitState.value = CountSubmitState.Idle
    }
}