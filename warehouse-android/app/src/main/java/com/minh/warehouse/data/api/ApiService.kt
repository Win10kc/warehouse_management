package com.minh.warehouse.data.api

import com.minh.warehouse.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    @POST("api/v1/auth/login")
    suspend fun login(@Body req: LoginRequest): Response<LoginResponse>

    @GET("api/v1/products/scan/{code}")
    suspend fun scanProduct(@Path("code") code: String): Response<ScanResponse>
    @GET("api/v1/products")

    suspend fun searchProducts(
        @Query("search") search: String,
        @Query("limit")  limit: Int = 20
    ): Response<ProductListResponse>

    @GET("api/v1/warehouses")
    suspend fun getWarehouses(): Response<WarehouseListResponse>

    @POST("api/v1/transactions")
    suspend fun createTransaction(
        @Body req: CreateTransactionRequest
    ): Response<TransactionResponse>

    @GET("api/v1/transactions")
    suspend fun getMyTransactions(
        @Query("page")  page: Int  = 1,
        @Query("limit") limit: Int = 20,
        @Query("created_by_me")   createdByMe: Boolean = false
    ): Response<TransactionListResponse>

    @POST("api/v1/product-requests")
    suspend fun createProductRequest(
        @Body req: CreateProductRequestBody
    ): Response<ProductRequestResponse>

    @GET("api/v1/stock/locations")
    suspend fun getStockLocations(
        @Query("search") search: String = ""
    ): Response<BinStockResponse>

    @POST("api/v1/stock/count")
    suspend fun createStockCount(
        @Body req: StockCountRequest
    ): Response<TransactionResponse>


}