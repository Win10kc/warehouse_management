# 📡 Danh sách API — Warehouse Management System

Base URL: `http://localhost:8080`  
Tất cả API (trừ login) yêu cầu header: `Authorization: Bearer <access_token>`

---

## 🔐 Auth

| Method | Endpoint | Auth | Role | Mô tả |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | ❌ | — | Đăng nhập, lấy JWT token |
| GET | `/api/v1/auth/me` | ✅ | Tất cả | Thông tin user hiện tại |

### POST /api/v1/auth/login
```json
// Request
{ "username": "admin", "password": "Admin@123" }

// Response 200
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": { "id": "uuid", "username": "admin", "full_name": "Administrator", "role": "admin" }
}
```

---

## 📦 Products

| Method | Endpoint | Auth | Role | Mô tả |
|---|---|---|---|---|
| GET | `/api/v1/products` | ✅ | Tất cả | Danh sách sản phẩm |
| GET | `/api/v1/products/:id` | ✅ | Tất cả | Chi tiết sản phẩm |
| GET | `/api/v1/products/scan/:code` | ✅ | Tất cả | Tìm qua QR/RFID |
| POST | `/api/v1/products` | ✅ | admin/manager | Tạo sản phẩm |
| PUT | `/api/v1/products/:id` | ✅ | admin/manager | Cập nhật sản phẩm |
| DELETE | `/api/v1/products/:id` | ✅ | admin | Xóa mềm sản phẩm |
| POST | `/api/v1/products/:id/generate-qr` | ✅ | admin/manager | Sinh QR code |

### Query params — GET /api/v1/products
| Param | Type | Mô tả |
|---|---|---|
| `search` | string | Tìm theo SKU, tên |
| `category` | string | Lọc theo danh mục |
| `is_active` | bool | `true`/`false` |
| `page` | int | Trang hiện tại (default: 1) |
| `limit` | int | Số bản ghi/trang (default: 20) |

### POST /api/v1/products — Body
```json
{
  "sku": "SP001",
  "name": "Linh kiện A",
  "unit": "cái",
  "category": "Điện tử",
  "description": "Mô tả",
  "qr_code": "QR-SP001",
  "rfid_uid": null,
  "min_stock": 10,
  "max_stock": 500,
  "supplier_id": "uuid-or-null"
}
```

---

## 🏢 Suppliers

| Method | Endpoint | Auth | Role | Mô tả |
|---|---|---|---|---|
| GET | `/api/v1/suppliers` | ✅ | Tất cả | Danh sách nhà cung cấp |
| GET | `/api/v1/suppliers/:id` | ✅ | Tất cả | Chi tiết |
| POST | `/api/v1/suppliers` | ✅ | admin/manager | Tạo mới |
| PUT | `/api/v1/suppliers/:id` | ✅ | admin/manager | Cập nhật |
| DELETE | `/api/v1/suppliers/:id` | ✅ | admin | Xóa |

---

## 🏭 Warehouses / Zones / Racks / Bins

| Method | Endpoint | Auth | Role | Mô tả |
|---|---|---|---|---|
| GET | `/api/v1/warehouses` | ✅ | Tất cả | Danh sách kho |
| GET | `/api/v1/warehouses/:id` | ✅ | Tất cả | Chi tiết kho |
| POST | `/api/v1/warehouses` | ✅ | admin/manager | Tạo kho |
| PUT | `/api/v1/warehouses/:id` | ✅ | admin/manager | Cập nhật kho |
| DELETE | `/api/v1/warehouses/:id` | ✅ | admin | Xóa kho |
| GET | `/api/v1/warehouses/:id/zones` | ✅ | Tất cả | Danh sách zone |
| POST | `/api/v1/warehouses/:id/zones` | ✅ | admin/manager | Tạo zone |
| PUT | `/api/v1/warehouses/:id/zones/:zoneId` | ✅ | admin/manager | Cập nhật zone |
| DELETE | `/api/v1/warehouses/:id/zones/:zoneId` | ✅ | admin | Xóa zone |
| GET | `/api/v1/warehouses/:id/zones/:zoneId/racks` | ✅ | Tất cả | Danh sách rack |
| POST | `/api/v1/warehouses/:id/zones/:zoneId/racks` | ✅ | admin/manager | Tạo rack |
| PUT | `.../racks/:rackId` | ✅ | admin/manager | Cập nhật rack |
| DELETE | `.../racks/:rackId` | ✅ | admin | Xóa rack |
| GET | `.../racks/:rackId/bins` | ✅ | Tất cả | Danh sách bin |
| POST | `.../racks/:rackId/bins` | ✅ | admin/manager | Tạo bin |
| PUT | `.../bins/:binId` | ✅ | admin/manager | Cập nhật bin |
| DELETE | `.../bins/:binId` | ✅ | admin | Xóa bin |

---

## 📊 Stock

| Method | Endpoint | Auth | Role | Mô tả |
|---|---|---|---|---|
| GET | `/api/v1/stock` | ✅ | Tất cả | Tổng hợp tồn kho |
| GET | `/api/v1/stock/:productId` | ✅ | Tất cả | Tồn kho theo sản phẩm |
| GET | `/api/v1/stock/locations` | ✅ | Tất cả | Tồn kho theo bin |
| POST | `/api/v1/stock/count` | ✅ | Tất cả | Tạo phiếu kiểm kê |

### Query params — GET /api/v1/stock/locations
| Param | Type | Mô tả |
|---|---|---|
| `search` | string | Tìm theo tên kho/zone/bin |

### POST /api/v1/stock/count — Body
```json
{
  "note": "Kiểm kê tháng 6",
  "items": [
    { "product_id": "uuid", "bin_id": "uuid", "quantity": 50 }
  ]
}
```

---

## 🔄 Transactions

| Method | Endpoint | Auth | Role | Mô tả |
|---|---|---|---|---|
| GET | `/api/v1/transactions` | ✅ | Tất cả | Danh sách giao dịch |
| GET | `/api/v1/transactions/:id` | ✅ | Tất cả | Chi tiết giao dịch |
| POST | `/api/v1/transactions` | ✅ | Tất cả | Tạo giao dịch |
| PUT | `/api/v1/transactions/:id/approve` | ✅ | admin/manager | Duyệt giao dịch |
| PUT | `/api/v1/transactions/:id/complete` | ✅ | Tất cả | Hoàn tất giao dịch |
| PUT | `/api/v1/transactions/:id/reject` | ✅ | admin/manager | Từ chối giao dịch |
| PUT | `/api/v1/transactions/:id/suggest-bin` | ✅ | admin/manager | Gợi ý bin vị trí |
| PUT | `/api/v1/transactions/:id/apply-bin` | ✅ | admin/manager | Áp dụng bin gợi ý |

### Query params — GET /api/v1/transactions
| Param | Type | Mô tả |
|---|---|---|
| `type` | string | `import`/`export`/`transfer`/`count` |
| `status` | string | `draft`/`pending`/`processing`/`done`/`rejected` |
| `created_by_me` | bool | Chỉ lấy phiếu của mình |
| `page` | int | Phân trang |
| `limit` | int | Giới hạn |

### POST /api/v1/transactions — Body
```json
{
  "type": "import",
  "note": "Nhập hàng tháng 6",
  "items": [
    {
      "product_id": "uuid",
      "to_bin_id": "uuid",
      "quantity_requested": 100
    }
  ]
}
```

### PUT /api/v1/transactions/:id/complete — Body
```json
{
  "items": [
    {
      "product_id": "uuid",
      "quantity_actual": 98,
      "scan_method": "qr"
    }
  ]
}
```

---

## 🚨 Product Requests

| Method | Endpoint | Auth | Role | Mô tả |
|---|---|---|---|---|
| POST | `/api/v1/product-requests` | ✅ | Tất cả | Báo cáo sản phẩm chưa có mã |
| GET | `/api/v1/product-requests` | ✅ | admin/manager | Danh sách yêu cầu |
| PUT | `/api/v1/product-requests/:id/resolve` | ✅ | admin/manager | Đánh dấu đã xử lý |
| PUT | `/api/v1/product-requests/:id/reject` | ✅ | admin/manager | Từ chối yêu cầu |

### POST /api/v1/product-requests — Body
```json
{
  "raw_code": "QR-UNKNOWN-12345",
  "suggested_name": "Linh kiện B mới",
  "supplier_name": "Công ty ABC",
  "note": "Quét trong zone A"
}
```

---

## 📈 Reports

| Method | Endpoint | Auth | Role | Mô tả |
|---|---|---|---|---|
| GET | `/api/v1/reports/products` | ✅ | admin/manager | Báo cáo nhập/xuất theo SKU |

### Query params — GET /api/v1/reports/products
| Param | Type | Mô tả |
|---|---|---|
| `month` | string | Format `YYYY-MM` (VD: `2026-05`) |

---

## 👥 Admin — User Management

| Method | Endpoint | Auth | Role | Mô tả |
|---|---|---|---|---|
| GET | `/api/v1/admin/users` | ✅ | admin | Danh sách user |
| POST | `/api/v1/admin/users` | ✅ | admin | Tạo user mới |
| PUT | `/api/v1/admin/users/:id` | ✅ | admin | Cập nhật user |
| PUT | `/api/v1/admin/users/:id/disable` | ✅ | admin | Vô hiệu hóa |
| PUT | `/api/v1/admin/users/:id/enable` | ✅ | admin | Kích hoạt |

### POST /api/v1/admin/users — Body
```json
{
  "username": "nhanvien01",
  "password": "Pass@1234",
  "full_name": "Nguyễn Văn A",
  "role": "warehouse"
}
```

---

## 🔌 WebSocket

| Endpoint | Protocol | Auth | Mô tả |
|---|---|---|---|
| `/ws` | WebSocket | ❌ | Real-time events stream |

### WebSocket Message Format
```json
{
  "event": "stock_update | alert | transaction_update | bin_suggestion",
  "data": { ... }
}
```

### Event Payloads

**stock_update**
```json
{ "product_id": "uuid", "product_name": "Linh kiện A", "total_quantity": 250, "delta": 100, "tx_code": "IMP-001" }
```

**alert**
```json
{ "product_id": "uuid", "product_name": "SP B", "current_quantity": 3, "min_stock": 10, "level": "critical", "message": "..." }
```

**transaction_update**
```json
{ "transaction_id": "uuid", "transaction_code": "IMP-001", "status": "done", "created_by_id": "uuid" }
```

**bin_suggestion**
```json
{
  "transaction_id": "uuid", "transaction_code": "IMP-001",
  "item_id": "uuid", "product_name": "Linh kiện A",
  "suggested_bin_id": "uuid", "suggested_bin_display": "Kho HN › Khu A › RACK-01 › BIN-03",
  "created_by_id": "uuid"
}
```

---

## ✅ Chuẩn hóa Response

### Thành công
```json
{ "success": true, "data": { ... } }
```

### Lỗi
```json
{ "success": false, "error": "Mô tả lỗi" }
```

### HTTP Status Codes
| Code | Ý nghĩa |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request — Dữ liệu đầu vào sai |
| 401 | Unauthorized — Thiếu hoặc sai token |
| 403 | Forbidden — Không đủ quyền |
| 404 | Not Found |
| 500 | Internal Server Error |