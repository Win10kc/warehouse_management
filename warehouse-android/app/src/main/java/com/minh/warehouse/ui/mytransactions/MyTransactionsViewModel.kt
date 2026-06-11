package com.minh.warehouse.ui.mytransactions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.minh.warehouse.data.api.ApiClient
import com.minh.warehouse.data.model.CompleteItemInput
import com.minh.warehouse.data.model.CompleteTransactionRequest
import com.minh.warehouse.data.model.TransactionSummary
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import com.minh.warehouse.data.websocket.WebSocketEvent
import com.minh.warehouse.data.websocket.WebSocketManager
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

sealed class MyTxState {
    object Loading : MyTxState()
    data class Success(val items: List<TransactionSummary>) : MyTxState()
    data class Error(val msg: String) : MyTxState()
}

class MyTransactionsViewModel : ViewModel() {

    private val _state = MutableStateFlow<MyTxState>(MyTxState.Loading)
    private val _binSuggestionEvent = MutableSharedFlow<WebSocketEvent.BinSuggestion>(extraBufferCapacity = 1)
    val state: StateFlow<MyTxState> = _state
    val binSuggestionEvent: SharedFlow<WebSocketEvent.BinSuggestion> = _binSuggestionEvent

    init {
        WebSocketManager.events
            .onEach { event ->
                when (event) {
                    is WebSocketEvent.TransactionUpdate -> load()
                    is WebSocketEvent.BinSuggestion -> {
                        // Reload để hiện suggested_bin mới nhất
                        load()
                        _binSuggestionEvent.tryEmit(event)
                    }
                    else -> {}
                }
            }
            .launchIn(viewModelScope)
    }

    fun load() {
        viewModelScope.launch {
            _state.value = MyTxState.Loading
            try {
                val res = ApiClient.service.getMyTransactions(
                    page = 1, limit = 50, createdByMe = true
                )
                if (res.isSuccessful) {
                    _state.value = MyTxState.Success(
                        res.body()?.data?.items ?: emptyList()
                    )
                } else {
                    _state.value = MyTxState.Error("Lỗi ${res.code()}")
                }
            } catch (e: Exception) {
                _state.value = MyTxState.Error(e.message ?: "Lỗi kết nối")
            }
        }
    }
    suspend fun completeTransaction(
        tx: TransactionSummary
    ): Result<Unit> {
        return try {

            val items = tx.items?.map {
                CompleteItemInput(
                    product_id = it.product_id,
                    from_bin_id = it.from_bin?.id,
                    to_bin_id = it.to_bin?.id,
                    quantity_actual = if (tx.type == "count")
                        it.quantity_actual
                    else
                        it.quantity_requested
                )
            } ?: emptyList()

            val req = CompleteTransactionRequest(items)

            val res =
                ApiClient.service.completeTransaction(
                    tx.id,
                    req
                )

            if (res.isSuccessful) {
                load()
                Result.success(Unit)
            } else {
                Result.failure(
                    Exception("HTTP ${res.code()}")
                )
            }

        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}