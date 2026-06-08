package com.minh.warehouse.data.model

data class LoginResponse(
    val data: LoginData?
)
data class LoginData(
    val access_token: String,
    val user: UserInfo
)
data class UserInfo(
    val id: String,   // ← đổi Int thành String
    val username: String,
    val role: String
)