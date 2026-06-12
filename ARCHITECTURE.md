# 🏗️ Kiến trúc Hệ thống — Warehouse Management System

---

## Tổng quan kiến trúc

Hệ thống áp dụng **Clean Architecture** (Layered Architecture) cho backend, **MVVM** cho Android, và **Feature-based structure** cho React Frontend.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
│                                                                 │
│   ┌──────────────────┐         ┌──────────────────────────┐    │
│   │  React Web App   │         │   Android (Kotlin/MVVM)  │    │
│   │  (Vite + TS)     │         │   Retrofit + DataStore   │    │
│   │  Port 5173       │         │   Camera / NFC Scan      │    │
│   └────────┬─────────┘         └───────────┬──────────────┘    │
│            │ HTTP/REST + JWT               │ HTTP/REST + JWT   │
│            │ WebSocket                     │ WebSocket         │
└────────────┼───────────────────────────────┼───────────────────┘
             │                               │
┌────────────▼───────────────────────────────▼───────────────────┐
│                     BACKEND LAYER (Go / Gin)                    │
│                       Port 8080                                 │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    CORS Middleware                        │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                JWT Auth Middleware                        │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                 RBAC Middleware                           │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │   HANDLER LAYER (Controllers)                            │  │
│  │   auth | product | warehouse | stock | transaction       │  │
│  │   supplier | admin | product_request | report            │  │
│  │                                                          │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │   SERVICE LAYER (Business Logic)                         │  │
│  │   AuthSvc | ProductSvc | WarehouseSvc | TransactionSvc   │  │
│  │   AdminSvc | SupplierSvc | AlertSvc                      │  │
│  │                                                          │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │   REPOSITORY LAYER (Data Access)                         │  │
│  │   UserRepo | ProductRepo | StockRepo | TransactionRepo   │  │
│  │   WarehouseRepo | ZoneRepo | RackRepo | BinRepo          │  │
│  │   SupplierRepo | ProductRequestRepo                      │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────┐   ┌─────────────────────────────┐   │
│  │   WebSocket Hub      │   │      Domain Layer            │   │
│  │   (Gorilla WS)       │   │  (Entities / Models)         │   │
│  │   Broadcast Events   │   │  User | Product | Stock      │   │
│  └──────────────────────┘   │  Transaction | Warehouse     │   │
│                             └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
             │                               │
┌────────────▼───────────────────────────────▼───────────────────┐
│                     INFRASTRUCTURE LAYER                        │
│                                                                 │
│   ┌───────────────────────────┐   ┌──────────────────────────┐ │
│   │   PostgreSQL 14+          │   │   Redis 6+               │ │
│   │   (Primary Data Store)    │   │   (Session / JWT Cache)  │ │
│   │   GORM ORM                │   │   Refresh Token Store    │ │
│   └───────────────────────────┘   └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phân tầng Backend (Clean Architecture)

### Layer 1: Domain
- Đặt tại: `internal/domain/`
- Chứa: Go structs thuần — `User`, `Product`, `Transaction`, `Warehouse`, `Bin`, `StockItem`...
- Không phụ thuộc vào bất kỳ layer nào khác.
- GORM tags được để trong domain để đơn giản hóa (trade-off với pure DDD).

### Layer 2: Repository (Data Access)
- Đặt tại: `internal/repository/`
- Chứa: Interfaces + implementations dùng GORM.
- Chỉ biết về Domain.
- Trả về Domain objects hoặc custom DTO rows.

### Layer 3: Service (Business Logic)
- Đặt tại: `internal/service/`
- Chứa: Interfaces + implementations chứa business rules.
- Phụ thuộc vào Repository interfaces (Dependency Inversion).
- Không biết về HTTP/Gin.

### Layer 4: Handler (HTTP Controllers)
- Đặt tại: `internal/handler/`
- Bind HTTP request → gọi Service → trả HTTP response.
- Dùng `pkg/response` để chuẩn hóa output.

### Layer 5: Middleware
- `internal/middleware/jwt.go`: Parse JWT → ghi context.
- `RequireRole(...)`: Check role, trả 403 nếu không đủ quyền.

---

## Frontend Architecture (React)

```
src/
├── api/               # Axios instances + typed API functions
│   ├── axios.ts       # Cấu hình base URL, auth interceptor
│   ├── productApi.ts  # Product + Supplier API calls
│   └── transactionApi.ts
│
├── components/        # Shared components
│   ├── AlertBadge.tsx # Hiển thị cảnh báo tồn kho thấp
│   └── ExportPanel.tsx # Export CSV/Excel
│
├── hooks/
│   └── useSocket.ts   # WebSocket singleton + pub/sub
│
├── pages/             # Feature pages (1 file/feature)
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx    # Charts, KPIs
│   ├── ProductsPage.tsx     # CRUD + QR modal
│   ├── TransactionListPage.tsx
│   ├── TransactionCreatePage.tsx
│   ├── TransactionDetailPage.tsx
│   ├── StockLocationsPage.tsx
│   ├── ProductRequestsPage.tsx
│   ├── SKUReportPage.tsx
│   ├── WarehouseManagerPage.tsx
│   └── AdminUsersPage.tsx
│
└── store/             # Zustand global state
    ├── authStore.ts   # Token, user info
    └── stockStore.ts  # Real-time stock data
```

**State Management:** Zustand (lightweight, no boilerplate)
**HTTP Client:** Axios với interceptor tự gắn JWT header
**Real-time:** `useSocket` hook — singleton WebSocket, pub/sub pattern, auto-reconnect

---

## Android Architecture (MVVM)

```
app/
├── data/
│   ├── api/
│   │   ├── ApiClient.kt        # Retrofit + OkHttp setup
│   │   ├── ApiService.kt       # Interface của tất cả API
│   │   └── AuthInterceptor.kt  # Tự gắn JWT token
│   ├── model/                  # Data classes (Kotlin)
│   └── websocket/
│       ├── WebSocketManager.kt # Gorilla WS client
│       └── WebSocketEvent.kt   # Sealed class events
│
├── ui/
│   ├── login/     # LoginActivity + LoginViewModel
│   ├── main/      # MainActivity (menu)
│   ├── scan/      # ScanActivity + ViewModel (Camera/NFC)
│   ├── transaction/
│   │   ├── TransactionFormActivity + ViewModel
│   │   └── ProductSearchActivity
│   ├── picklist/  # PickListActivity (phiếu cần thực hiện)
│   ├── stockcount/ # StockCountActivity
│   └── mytransactions/ # Lịch sử phiếu
│
└── util/
    ├── NfcScanHelper.kt   # Đọc RFID qua NFC
    └── TokenManager.kt    # Lưu/xóa token (DataStore)
```

**Pattern:** MVVM (ViewModel + LiveData/StateFlow)
**HTTP:** Retrofit2 + Kotlin Coroutines
**Auth Storage:** Jetpack DataStore
**Real-time:** WebSocket qua `WebSocketManager`

---

## Cơ chế Real-time

```
Backend                         Frontend / Android
   │                                   │
   │  TransactionService.Complete()    │
   │  └── hub.Publish("stock_update") │
   │          │                        │
   │          ▼                        │
   │    [broadcast channel]            │
   │          │                        │
   │    ┌─────▼─────┐                 │
   │    │  Hub.Run()│ ──── WS msg ───►│ useSocket / WebSocketManager
   │    └───────────┘                 │     │
   │                                  │     ▼
   │                                  │ stockStore.update()
   │                                  │ UI re-renders
```

---

## Bảo mật

| Cơ chế | Mô tả |
|---|---|
| **JWT Access Token** | Expire 24h, ký HMAC-SHA256 |
| **JWT Refresh Token** | Expire 7 ngày, lưu Redis |
| **bcrypt** | Hash mật khẩu (cost 10) |
| **RBAC** | Middleware kiểm tra role per-endpoint |
| **CORS** | Whitelist origin cố định |
| **HTTPS** | Nên thêm reverse proxy (Nginx) ở production |
| **Redis Invalidation** | Logout xóa refresh token, không thể reuse |

---

## Tech Stack tổng hợp

| Thành phần | Công nghệ | Version |
|---|---|---|
| Backend Language | Go | 1.26.3 |
| HTTP Framework | Gin | 1.12.0 |
| ORM | GORM | latest |
| JWT | golang-jwt/jwt | v5.3.1 |
| WebSocket | Gorilla WS | latest |
| Database | PostgreSQL | 14+ |
| Cache | Redis | 6+ (go-redis v9) |
| UUID | google/uuid | 1.6.0 |
| Frontend Framework | React | 18 |
| Frontend Build | Vite | latest |
| Language | TypeScript | latest |
| State | Zustand | latest |
| Charts | Recharts | latest |
| HTTP Client | Axios | latest |
| Android Language | Kotlin | 1.9.0 |
| Android UI | Jetpack Compose + XML | BOM 2024.04 |
| Android HTTP | Retrofit2 | latest |
| Android Storage | DataStore | 1.1.1 |
| Android Gradle | AGP | 8.6.1 |