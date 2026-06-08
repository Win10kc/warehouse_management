package com.minh.warehouse.ui.login

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.minh.warehouse.data.api.ApiClient
import com.minh.warehouse.data.model.LoginRequest
import kotlinx.coroutines.launch

sealed class LoginState {
    object Loading : LoginState()
    data class Success(val token: String) : LoginState()
    data class Error(val message: String) : LoginState()
}

class LoginViewModel : ViewModel() {

    private val _loginState = MutableLiveData<LoginState>()
    val loginState: LiveData<LoginState> = _loginState

    fun login(username: String, password: String) {
        _loginState.value = LoginState.Loading
        viewModelScope.launch {
            try {
                val response = ApiClient.service.login(LoginRequest(username, password))
                if (response.isSuccessful) {
                    val token = response.body()?.data?.access_token
                    if (!token.isNullOrEmpty()) {
                        _loginState.value = LoginState.Success(token)
                    } else {
                        _loginState.value = LoginState.Error("Token rỗng")
                    }
                } else {
                    _loginState.value = LoginState.Error("Sai tài khoản hoặc mật khẩu")
                }
            } catch (e: Exception) {
                _loginState.value = LoginState.Error("Lỗi kết nối: ${e.message}")
            }
        }
    }
}