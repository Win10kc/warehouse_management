# 📋 Tài liệu Chức năng Chi tiết — Warehouse Management System

---

## 1. Module Xác thực (Authentication)

### 1.1 Đăng nhập
- **Endpoint:** `POST /api/v1/auth/login`
- **Chức năng:** Nhận `username` + `password`, kiểm tra bcrypt hash, cấp Access Token (JWT, 24h) và Refresh Token (lưu Redis).
- **Output:** `{ access_token, refresh_token, user: { id, username, full_name, role } }`
- **Lỗi:** 401 nếu sai mật khẩu, user không tồn tại hoặc bị vô hiệu hóa.

### 1.2 Lấy thông tin người dùng hiện tại
- **Endpoint:** `GET /api/v1/auth/me`
- **Yêu cầu:** Bearer Token
- **Output:** Thông tin user đang đăng nhập.

### 1.3 Middleware JWT
- `ValidateJWT`: Parse và verify JWT từ header `Authorization: Bearer <token>`. Ghi `user_id` và `role` vào Gin context.
- `RequireRole(roles...)`: Kiểm tra role, trả 403 nếu không đủ quyền.

### 1.4 Phân quyền

| Tính năng | admin | manager | warehouse |
|---|:---:|:---:|:---:|
| Xem dữ liệu | ✅ | ✅ | ✅ |
| Tạo/sửa sản phẩm, kho | ✅ | ✅ | ❌ |
| Xóa dữ liệu | ✅ | ❌ | ❌ |
| Duyệt giao dịch | ✅ | ✅ | ❌ |
| Quản lý user | ✅ | ❌ | ❌ |
| Xem báo cáo SKU | ✅ | ✅ | ❌ |
| Gợi ý / Apply Bin | ✅ | ✅ | ❌ |
| Tạo giao dịch | ✅ | ✅ | ✅ |
| Hoàn tất giao dịch | ✅ | ✅ | ✅ |
| Báo cáo sản phẩm chưa có | ✅ | ✅ | ✅ |

---

## 2. Module Sản phẩm (Products)

### 2.1 Danh sách sản phẩm
- **Endpoint:** `GET /api/v1/products`
- **Query params:** `search`, `category`, `is_active` (true/false), `page`, `limit`
- **Chức năng:** Lấy danh sách sản phẩm với filter và phân trang. Bao gồm thông tin nhà cung cấp liên kết.

### 2.2 Chi tiết sản phẩm
- **Endpoint:** `GET /api/v1/products/:id`
- **Output:** Thông tin đầy đủ sản phẩm + Supplier.

### 2.3 Quét sản phẩm bằng QR/RFID
- **Endpoint:** `GET /api/v1/products/scan/:code`
- **Chức năng:** Tìm sản phẩm theo QR code hoặc RFID UID. Trả thêm trường `scan_method` (`qr`/`rfid`). Nếu không tìm thấy, trả 404 để Android biết mở màn hình báo cáo.

### 2.4 Tạo sản phẩm
- **Endpoint:** `POST /api/v1/products` — Role: admin/manager
- **Body:** `sku`, `name`, `unit`, `category`, `description`, `qr_code`, `rfid_uid`, `image_url`, `min_stock`, `max_stock`, `supplier_id`

### 2.5 Cập nhật sản phẩm
- **Endpoint:** `PUT /api/v1/products/:id` — Role: admin/manager

### 2.6 Xóa sản phẩm
- **Endpoint:** `DELETE /api/v1/products/:id` — Role: admin
- **Chức năng:** Soft delete (set `is_active = false`).

### 2.7 Tạo QR Code
- **Endpoint:** `POST /api/v1/products/:id/generate-qr` — Role: admin/manager
- **Chức năng:** Tự động sinh QR Code dựa trên SKU, lưu vào DB.

---

## 3. Module Nhà cung cấp (Suppliers)

- **CRUD đầy đủ:** `GET /api/v1/suppliers`, `GET /:id`, `POST`, `PUT /:id`, `DELETE /:id`
- Mỗi sản phẩm có thể liên kết 1 nhà cung cấp (FK nullable).
- Xóa supplier: SET NULL trên bảng products (không cascade xóa sản phẩm).

---

## 4. Module Kho vật lý (Warehouse Structure)

Hệ thống quản lý kho theo 4 cấp phân cấp:

```
Warehouse (Kho tổng)
  └── Zone (Khu vực: A, B, C...)
        └── Rack (Kệ: RACK-01, RACK-02...)
              └── Bin (Ô: BIN-01, BIN-02...)
```

### 4.1 Warehouse
- `GET /api/v1/warehouses` — Liệt kê tất cả kho
- `POST /api/v1/warehouses` — Tạo kho (admin/manager)
- `PUT /:id` — Cập nhật
- `DELETE /:id` — Xóa

### 4.2 Zone
- `GET /api/v1/warehouses/:id/zones`
- `POST /api/v1/warehouses/:id/zones`
- `PUT /api/v1/warehouses/:id/zones/:zoneId`
- `DELETE /api/v1/warehouses/:id/zones/:zoneId`

### 4.3 Rack
- CRUD tương tự, path: `/warehouses/:id/zones/:zoneId/racks`
- Có trường `max_weight_kg`.

### 4.4 Bin
- CRUD path: `/warehouses/:id/zones/:zoneId/racks/:rackId/bins`
- Mỗi Bin có `qr_code` (unique) và `rfid_uid` (unique) để quét định vị.
- `DisplayName()` tự ghép chuỗi: `"Kho HN › Khu A › RACK-01 › BIN-03"`

---

## 5. Module Tồn kho (Stock)

### 5.1 Tổng quan tồn kho
- **Endpoint:** `GET /api/v1/stock`
- **Chức năng:** Liệt kê `stock_summary` — tổng số lượng + reserved theo từng sản phẩm.

### 5.2 Tồn kho theo sản phẩm
- **Endpoint:** `GET /api/v1/stock/:productId`
- **Output:** Danh sách các bin đang chứa sản phẩm này + số lượng từng bin.

### 5.3 Tồn kho theo vị trí (Bin)
- **Endpoint:** `GET /api/v1/stock/locations?search=xxx`
- **Chức năng:** Xem hàng theo vị trí bin, hỗ trợ search theo tên kho/zone/rack/bin.

### 5.4 Kiểm kê kho (Stock Count)
- **Endpoint:** `POST /api/v1/stock/count`
- **Chức năng:** Nhân viên nhập số lượng thực tế từng bin. Hệ thống tạo Transaction loại `count` và cập nhật tồn kho sau khi hoàn tất.

### 5.5 Cơ chế cập nhật tồn kho
- Khi giao dịch `import` hoàn tất: `total_quantity += qty`, `UpsertItem` trong bin tương ứng.
- Khi giao dịch `export` hoàn tất: `total_quantity -= qty`.
- Khi giao dịch `transfer`: trừ bin nguồn, cộng bin đích.
- Mỗi thay đổi kích hoạt `AlertService.CheckAndAlert()` — phát WebSocket nếu dưới ngưỡng.

---

## 6. Module Giao dịch (Transactions)

### 6.1 Các loại giao dịch

| Loại | Code | Mô tả |
|---|---|---|
| Nhập kho | `import` | Hàng vào → cộng tồn bin đích |
| Xuất kho | `export` | Hàng ra → trừ tồn bin nguồn |
| Chuyển kho | `transfer` | Hàng từ bin A → bin B |
| Kiểm kê | `count` | Đối chiếu số lượng thực tế |

### 6.2 Luồng trạng thái giao dịch

```
draft → pending → processing → done
                ↘ rejected
```

- `draft`: Mới tạo (Android)
- `pending`: Chờ duyệt (tự chuyển sau khi tạo)
- `processing`: Đã duyệt, nhân viên đang thực hiện
- `done`: Hoàn tất, tồn kho đã cập nhật
- `rejected`: Bị từ chối

### 6.3 Tạo giao dịch
- **Endpoint:** `POST /api/v1/transactions`
- **Body:** `type`, `note`, `items[]` (product_id, from_bin_id, to_bin_id, quantity_requested)
- **Auto:** Sinh `code` duy nhất (VD: `IMP-20260612-001`), set status `pending`, gọi `autoSuggestBins`.

### 6.4 Gợi ý Bin (Suggest Bin)
- **Endpoint:** `PUT /api/v1/transactions/:id/suggest-bin` — admin/manager
- **Chức năng:** Manager chọn bin cụ thể cho từng item, lưu vào `suggested_bin_id`.
- Sau đó, Android nhận WebSocket event `bin_suggestion`, hiển thị gợi ý.

### 6.5 Apply Bin
- **Endpoint:** `PUT /api/v1/transactions/:id/apply-bin` — admin/manager
- Xác nhận gợi ý bin → cập nhật `to_bin_id` hoặc `from_bin_id` của item.

### 6.6 Duyệt giao dịch
- **Endpoint:** `PUT /api/v1/transactions/:id/approve` — admin/manager
- Chuyển status `pending → processing`, lưu `approved_by_id`, `approved_at`.

### 6.7 Hoàn tất giao dịch
- **Endpoint:** `PUT /api/v1/transactions/:id/complete`
- **Body:** `items[]` (product_id, quantity_actual, scan_method)
- **Chức năng:** Nhân viên xác nhận số lượng thực tế sau khi thực hiện. Hệ thống:
  1. Cập nhật `quantity_actual` từng item
  2. Gọi `UpsertItem` + `UpsertSummary` cho tồn kho
  3. Chạy `AlertService.CheckAndAlert`
  4. Broadcast WebSocket `stock_update` + `transaction_update`
  5. Set status → `done`, `completed_at`

### 6.8 Từ chối giao dịch
- **Endpoint:** `PUT /api/v1/transactions/:id/reject` — admin/manager

---

## 7. Module Báo cáo Sản phẩm Chưa có Mã (Product Requests)

### Luồng hoạt động
1. Nhân viên quét QR/RFID → hệ thống không tìm thấy sản phẩm → mở màn hình báo cáo.
2. Nhân viên nhập tên gợi ý + nhà cung cấp + ghi chú → `POST /api/v1/product-requests`
3. Server broadcast WebSocket event `alert` cho admin/manager.
4. Admin xem danh sách: `GET /api/v1/product-requests?status=pending`
5. Admin resolve (tạo sản phẩm mới + đóng request): `PUT /:id/resolve`
6. Hoặc reject: `PUT /:id/reject`

### Trạng thái
- `pending` → `resolved` hoặc `rejected`

---

## 8. Module Báo cáo (Reports)

### SKU Report
- **Endpoint:** `GET /api/v1/reports/products?month=2026-05` — admin/manager
- **Chức năng:** Thống kê số lượng nhập/xuất từng SKU trong tháng được chọn.
- **Output CSV/Excel:** Frontend cung cấp nút export qua `ExportPanel` component.

---

## 9. Module Quản trị User (Admin)

- `GET /api/v1/admin/users?page=1&limit=20` — Danh sách user có phân trang
- `POST /api/v1/admin/users` — Tạo user mới, password được hash bcrypt
- `PUT /api/v1/admin/users/:id` — Cập nhật thông tin (full_name, role, password)
- `PUT /api/v1/admin/users/:id/disable` — Vô hiệu hóa tài khoản
- `PUT /api/v1/admin/users/:id/enable` — Kích hoạt lại tài khoản
- Tất cả chỉ dành cho role `admin`.

---

## 10. Module WebSocket Real-time

### Các sự kiện

| Event | Trigger | Payload |
|---|---|---|
| `stock_update` | Giao dịch hoàn tất | product_id, product_name, total_quantity, delta, tx_code |
| `alert` | Tồn kho dưới ngưỡng | product_id, product_name, current_qty, min_stock, level (warning/critical) |
| `transaction_update` | Duyệt / từ chối / hoàn tất | transaction_id, code, status, created_by_id |
| `bin_suggestion` | Manager gợi ý bin | transaction_id, item_id, product_name, suggested_bin_display |

- **Endpoint WS:** `ws://host:8080/ws` (không cần JWT)
- **Frontend:** Hook `useSocket` — singleton connection, tự reconnect sau 3 giây.
- **Android:** `WebSocketManager` + `WebSocketEvent` sealed class.

---

## 11. Module Android — Chức năng theo màn hình

| Activity | Chức năng |
|---|---|
| `LoginActivity` | Đăng nhập, lưu token vào DataStore |
| `MainActivity` | Menu chính: Scan, Giao dịch, Kiểm kê, Lịch sử |
| `ScanActivity` | Quét QR (Camera) hoặc RFID (NFC), tìm sản phẩm |
| `TransactionFormActivity` | Chọn loại GD, thêm sản phẩm, chọn bin, tạo phiếu |
| `ProductSearchActivity` | Tìm kiếm sản phẩm bằng text |
| `PickListActivity` | Xem danh sách phiếu `processing`, thực hiện hoàn tất |
| `StockCountActivity` | Kiểm kê: quét bin, nhập số lượng thực tế |
| `MyTransactionsActivity` | Lịch sử phiếu của nhân viên |