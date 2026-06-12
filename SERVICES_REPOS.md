# 🔧 Mô tả Service & Repository — Warehouse Management System

---

## I. SERVICES

### 1. AuthService (`internal/service/auth_service.go`)

**Interface:**
```go
type AuthService interface {
    Login(username, password string) (*LoginResult, error)
    GetUserByID(id string) (*domain.User, error)
    RefreshAccessToken(refreshToken string) (string, error)
    Logout(refreshToken string) error
}
```

| Method | Mô tả |
|---|---|
| `Login` | Xác thực user, verify bcrypt, sinh Access Token (JWT 24h) + Refresh Token (JWT 7 ngày). Refresh Token được lưu vào Redis với key `refresh:<token>`. |
| `GetUserByID` | Lấy thông tin user từ DB theo ID, dùng cho middleware `/auth/me`. |
| `RefreshAccessToken` | Parse refresh token → lấy user_id → verify còn trong Redis → sinh access token mới. |
| `Logout` | Xóa refresh token khỏi Redis. |
| `generateAccessToken` | Private — ký JWT với claims: user_id, role, expire. |
| `generateRefreshToken` | Private — tương tự nhưng expire dài hơn (7 ngày). |

**Phụ thuộc:** `UserRepository`, `*redis.Client`, `*config.Config`

---

### 2. AdminService (`internal/service/admin_service.go`)

**Interface:**
```go
type AdminService interface {
    ListUsers(page, limit int) ([]domain.User, int64, error)
    CreateUser(req CreateUserRequest) (*domain.User, error)
    UpdateUser(id string, req UpdateUserRequest) (*domain.User, error)
    DisableUser(id string) error
    EnableUser(id string) error
}
```

| Method | Mô tả |
|---|---|
| `ListUsers` | Phân trang danh sách user, không trả `password_hash`. |
| `CreateUser` | Hash bcrypt password, tạo user với role được chỉ định. |
| `UpdateUser` | Cập nhật `full_name`, `role`, hash mật khẩu mới nếu có. |
| `DisableUser` | Set `is_active = false`. |
| `EnableUser` | Set `is_active = true`. |

**Phụ thuộc:** `UserRepository`

---

### 3. ProductService (`internal/service/product_service.go`)

**Interface:**
```go
type ProductService interface {
    List(filter ProductFilter) ([]domain.Product, int64, error)
    GetByID(id string) (*domain.Product, error)
    GetByCode(code string) (*domain.Product, string, error)
    GenerateQR(id string) (*domain.Product, string, error)
    Create(req CreateProductRequest) (*domain.Product, error)
    Update(id string, req UpdateProductRequest) (*domain.Product, error)
    Delete(id string) error
}
```

| Method | Mô tả |
|---|---|
| `List` | Lọc theo search, category, is_active + phân trang. |
| `GetByCode` | Tìm sản phẩm theo QR hoặc RFID, trả thêm `scan_method`. |
| `GenerateQR` | Sinh `qr_code` = `"QR-" + sku`, lưu DB. |
| `Create` | Tạo sản phẩm mới, chuyển string rỗng → nil cho qr_code/rfid. |
| `Delete` | Soft delete: `is_active = false`. |

**Phụ thuộc:** `ProductRepository`

---

### 4. SupplierService (`internal/service/supplier_service.go`)

**Interface:**
```go
type SupplierService interface {
    List() ([]domain.Supplier, error)
    GetByID(id string) (*domain.Supplier, error)
    Create(req CreateSupplierRequest) (*domain.Supplier, error)
    Update(id string, req UpdateSupplierRequest) (*domain.Supplier, error)
    Delete(id string) error
}
```

Quản lý CRUD nhà cung cấp. Delete chỉ xóa record supplier, sản phẩm liên kết sẽ có `supplier_id = NULL` do ON DELETE SET NULL.

**Phụ thuộc:** `SupplierRepository`

---

### 5. WarehouseService / ZoneService / RackService / BinService

Bốn service riêng cho 4 cấp kho vật lý:

```go
type WarehouseService interface {
    List() ([]domain.Warehouse, error)
    GetByID(id string) (*domain.Warehouse, error)
    Create(req CreateWarehouseRequest) (*domain.Warehouse, error)
    Update(id string, req UpdateWarehouseRequest) (*domain.Warehouse, error)
    Delete(id string) error
}
// ZoneService, RackService tương tự
```

**BinService** đặc biệt hơn: nhận `*gorm.DB` trực tiếp để thực hiện raw SQL query lấy đầy đủ location path (warehouse › zone › rack › bin).

---

### 6. TransactionService (`internal/service/transaction_service.go`)

**Interface:**
```go
type TransactionService interface {
    List(filter TransactionFilter) ([]domain.Transaction, int64, error)
    GetByID(id string) (*domain.Transaction, error)
    Create(createdByID string, req CreateTransactionRequest) (*domain.Transaction, error)
    CreateCount(createdByID string, req StockCountRequest) (*domain.Transaction, error)
    Approve(id string, approvedByID string) (*domain.Transaction, error)
    Complete(id string, req CompleteTransactionRequest) (*domain.Transaction, error)
    Reject(id string) error
    SuggestBin(txID, itemID, binID uuid.UUID, managerID string) error
    ApplyBin(txID, itemID uuid.UUID) error
}
```

Đây là service phức tạp nhất, điều phối luồng giao dịch:

| Method | Chi tiết |
|---|---|
| `Create` | Tạo transaction + items, sinh code (VD: `IMP-20260612-001`), auto-suggest bins cho export/transfer bằng `autoSuggestBins()`. |
| `autoSuggestBins` | Dùng `chooseBestBin()` — chọn bin có nhiều hàng nhất (greedy) cho loại xuất/chuyển. |
| `Complete` | Wrap DB transaction (GORM `db.Transaction`): cập nhật `quantity_actual`, gọi `UpsertItem` + `UpsertSummary`, trigger `CheckAndAlert`, broadcast WS events. |
| `SuggestBin` | Manager chỉ định bin cụ thể cho 1 item, broadcast `bin_suggestion` qua WS. |
| `ApplyBin` | Áp dụng `suggested_bin_id → to_bin_id` (hoặc from_bin_id tùy loại). |

**Phụ thuộc:** `TransactionRepository`, `StockRepository`, `ProductRepository`, `BinRepository`, `*ws.Hub`, `AlertService`

---

### 7. AlertService (`internal/service/alert_service.go`)

**Interface:**
```go
type AlertService interface {
    CheckAndAlert(product *domain.Product, summary *domain.StockSummary)
}
```

| Method | Mô tả |
|---|---|
| `CheckAndAlert` | So sánh `total_quantity` với `min_stock`. Nếu `qty == 0`: level `critical`; nếu `qty < min_stock`: level `warning`. Publish WebSocket event `alert`. |

**Phụ thuộc:** `*ws.Hub`

---

## II. REPOSITORIES

### 1. UserRepository (`internal/repository/user_repository.go`)

```go
type UserRepository interface {
    FindByUsername(username string) (*domain.User, error)
    FindByID(id string) (*domain.User, error)
    FindByIDAny(id string) (*domain.User, error)   // Kể cả inactive
    List(page, limit int) ([]domain.User, int64, error)
    Create(user *domain.User) error
    Update(user *domain.User) error
}
```

- `FindByID`: Chỉ lấy active users.
- `FindByIDAny`: Lấy kể cả user đã bị disable (dùng khi JWT user đã bị vô hiệu hóa).

---

### 2. ProductRepository (`internal/repository/product_repository.go`)

```go
type ProductRepository interface {
    List(f ProductFilter) ([]domain.Product, int64, error)
    FindByID(id string) (*domain.Product, error)
    FindByCode(code string) (*domain.Product, error)
    Create(p *domain.Product) error
    Update(p *domain.Product) error
    Delete(id string) error
}

type ProductFilter struct {
    Search   string
    Category string
    IsActive *bool
    Page     int
    Limit    int
}
```

- `FindByCode`: Query `WHERE qr_code = ? OR rfid_uid = ?` với Preload Supplier.
- `List`: Build dynamic WHERE clause từ filter, Preload Supplier.

---

### 3. ProductRequestRepository (`internal/repository/product_request_repository.go`)

```go
type ProductRequestRepository interface {
    Create(req *domain.ProductRequest) error
    List(status string) ([]domain.ProductRequest, error)
    UpdateStatus(id string, status domain.ProductRequestStatus) error
}
```

- `List`: Preload `ReportedBy` (user info), filter theo status.
- `UpdateStatus`: Cập nhật status + `updated_at`.

---

### 4. StockRepository (`internal/repository/stock_repository.go`)

```go
type StockRepository interface {
    GetSummary(productID string) (*domain.StockSummary, error)
    ListSummaries() ([]domain.StockSummary, error)
    UpsertSummary(tx *gorm.DB, productID uuid.UUID, delta int) error
    GetItem(productID, binID string) (*domain.StockItem, error)
    ListByProduct(productID string) ([]domain.StockItem, error)
    UpsertItem(tx *gorm.DB, productID, binID uuid.UUID, delta int) error
    ListByBin(search string) ([]BinStockRow, error)
    GetItemsByProduct(productID string) ([]StockItemRow, error)
}
```

| Method | Chi tiết |
|---|---|
| `UpsertSummary` | `INSERT ... ON CONFLICT UPDATE quantity += delta`. Nguyên tử, thread-safe trong DB transaction. |
| `UpsertItem` | Tương tự cho `stock_items` theo (product_id, bin_id). Quantity không thể xuống dưới 0. |
| `ListByBin` | Raw SQL join 4 bảng (bins, racks, zones, warehouses) + search full-text. |

```go
type BinStockRow struct {
    BinID         string
    BinCode       string
    ProductID     string
    ProductName   string
    Quantity      int
    WarehouseName string
    ZoneName      string
    RackCode      string
}
```

---

### 5. TransactionRepository (`internal/repository/transaction_repository.go`)

```go
type TransactionRepository interface {
    List(f TransactionFilter) ([]domain.Transaction, int64, error)
    FindByID(id string) (*domain.Transaction, error)
    Create(tx *gorm.DB, t *domain.Transaction) error
    UpdateStatus(tx *gorm.DB, id string, status domain.TransactionStatus) error
    UpdateFields(tx *gorm.DB, id string, fields map[string]any) error
    AddItems(tx *gorm.DB, items []domain.TransactionItem) error
    UpdateItemActual(tx *gorm.DB, transactionID, productID string, qty int) error
    UpdateItemSuggestedBin(itemID, binID uuid.UUID) error
    ApplyBin(itemID, binID uuid.UUID) error
    GetSKUReport(fromDate, toDate string) ([]SKUReportRow, error)
    GetDB() *gorm.DB
}
```

| Method | Chi tiết |
|---|---|
| `FindByID` | Preload `CreatedBy`, `ApprovedBy`, `Items.Product`, `Items.FromBin`, `Items.ToBin`. Sau đó raw SQL để fill location path cho mỗi Bin. |
| `List` | Filter: type, status, created_by_me, date range + phân trang. |
| `GetSKUReport` | Aggregate query: nhóm theo SKU, tính tổng qty nhập/xuất trong khoảng thời gian. |

```go
type TransactionFilter struct {
    Type        string
    Status      string
    CreatedByID string
    Page        int
    Limit       int
}

type SKUReportRow struct {
    SKU         string
    ProductName string
    TotalImport int
    TotalExport int
}
```

---

### 6. WarehouseRepository / ZoneRepository / RackRepository / BinRepository

Tất cả implement CRUD cơ bản. `BinRepository` có thêm:

```go
type BinRepository interface {
    // ... CRUD cơ bản
    FindByIDWithLocation(id string) (*domain.Bin, error)  // Fill rack/zone/warehouse info
    ListByRack(rackID string) ([]domain.Bin, error)
}
```

`FindByIDWithLocation` dùng raw SQL join để fill các field `gorm:"-"` trong `domain.Bin` như `RackCode`, `ZoneName`, `WarehouseName`.

---

### 7. SupplierRepository (`internal/repository/supplier_repository.go`)

```go
type SupplierRepository interface {
    List() ([]domain.Supplier, error)
    FindByID(id string) (*domain.Supplier, error)
    Create(s *domain.Supplier) error
    Update(s *domain.Supplier) error
    Delete(id string) error
}
```

CRUD đơn giản. Delete xóa cứng (hard delete) — `ON DELETE SET NULL` ở FK bảng products tự động xử lý.

---

## III. WEBSOCKET LAYER

### Hub (`internal/websocket/hub.go`)

```go
type Hub struct {
    clients    map[*Client]bool
    broadcast  chan []byte       // Buffer 256
    register   chan *Client
    unregister chan *Client
    mu         sync.RWMutex
}
```

- `Run()`: Goroutine vô hạn xử lý register/unregister/broadcast.
- `Publish(event, data)`: Marshal JSON `{event, data}` → đẩy vào channel broadcast.
- `ServeWS(c *gin.Context)`: Upgrade HTTP → WebSocket, tạo Client, khởi động 2 goroutine.

### Client
- `writePump()`: Đọc từ `client.send` channel → ghi ra WebSocket connection.
- `readPump()`: Đọc message từ client (hiện tại bỏ qua nội dung, chỉ detect disconnect).

### Events được phát bởi
| Event | Phát bởi |
|---|---|
| `stock_update` | `TransactionService.Complete()` |
| `alert` | `AlertService.CheckAndAlert()` |
| `transaction_update` | `TransactionService.Approve()`, `Complete()`, `Reject()` |
| `bin_suggestion` | `TransactionService.SuggestBin()` |
| `alert` (product request) | `ProductRequestHandler.Create()` |