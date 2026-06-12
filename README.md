# 📦 Warehouse Management System

> Hệ thống quản lý kho hàng đa nền tảng — Backend Go, Frontend React, Mobile Android

---

## Tổng quan

Warehouse Management System (WMS) là giải pháp quản lý kho hàng toàn diện gồm 3 thành phần chính:

| Thành phần | Công nghệ | Mô tả |
|---|---|---|
| **Backend API** | Go 1.26 + Gin + GORM | REST API + WebSocket |
| **Frontend Web** | React 18 + TypeScript + Vite | Dashboard quản trị |
| **Mobile Android** | Kotlin + MVVM + Retrofit2 | App cho nhân viên kho |

**Database:** PostgreSQL · **Cache/Session:** Redis · **Real-time:** WebSocket (Gorilla)

---

## Tính năng chính

- **Xác thực phân quyền** — JWT (Access + Refresh Token), 3 role: `admin / manager / warehouse`
- **Quản lý sản phẩm** — CRUD, QR Code, RFID UID, liên kết nhà cung cấp
- **Quản lý kho vật lý** — Warehouse › Zone › Rack › Bin (4 cấp phân cấp)
- **Giao dịch kho** — Nhập / Xuất / Chuyển / Kiểm kê (với luồng duyệt)
- **Tồn kho thời gian thực** — Cập nhật tức thì qua WebSocket
- **Cảnh báo tồn kho thấp** — Tự động phát hiện `warning` / `critical`
- **Quét QR/RFID** — Android hỗ trợ quét Camera + NFC
- **Báo cáo sản phẩm chưa có mã** — Nhân viên báo cáo, admin xử lý
- **Báo cáo SKU** — Thống kê nhập/xuất theo tháng (export CSV/Excel)
- **Gợi ý Bin thông minh** — Manager gợi ý vị trí đặt hàng cho nhân viên

---

## Cấu trúc dự án

```
warehouse-project/
├── warehouse-backend/          # Go REST API
│   ├── cmd/server/main.go      # Entry point, router
│   ├── config/                 # Cấu hình env
│   ├── internal/
│   │   ├── domain/             # Entity models
│   │   ├── handler/            # HTTP handlers (controllers)
│   │   ├── middleware/         # JWT, RBAC
│   │   ├── repository/         # Data access layer
│   │   ├── service/            # Business logic
│   │   └── websocket/          # WS Hub + Client
│   ├── migrations/             # SQL migration (001–005)
│   └── pkg/
│       ├── database/           # Postgres + Redis init
│       └── response/           # Chuẩn hóa HTTP response
│
├── warehouse-frontend/         # React Web Dashboard
│   └── src/
│       ├── api/                # Axios API clients
│       ├── components/         # AlertBadge, ExportPanel
│       ├── hooks/              # useSocket (WebSocket)
│       ├── pages/              # 10 trang chính
│       └── store/              # Zustand state (auth, stock)
│
└── warehouse-android/          # Kotlin Android App
    └── app/src/main/java/
        ├── data/
        │   ├── api/            # Retrofit ApiService
        │   ├── model/          # Data models
        │   └── websocket/      # WS Manager
        ├── ui/                 # Activities + ViewModels
        └── util/               # NFC, TokenManager
```

---

## Yêu cầu hệ thống

- **Go** ≥ 1.22
- **Node.js** ≥ 18 + pnpm
- **PostgreSQL** ≥ 14
- **Redis** ≥ 6
- **Android Studio** (cho mobile)

---

## Cài đặt & Chạy

### 1. Database

```bash
psql -U postgres -c "CREATE DATABASE warehouse_db;"
psql -U postgres -c "CREATE USER warehouse_user WITH PASSWORD 'warehouse_pass';"
psql -U postgres -c "GRANT ALL ON DATABASE warehouse_db TO warehouse_user;"
psql -U warehouse_user -d warehouse_db -f warehouse-backend/migrations/000_migrate_all.sql
```

### 2. Backend

```bash
cd warehouse-backend
cp .env.example .env   # Chỉnh sửa DB/Redis/JWT config
go mod download
go run cmd/server/main.go
# Server: http://localhost:8080
```

### 3. Frontend

```bash
cd warehouse-frontend
pnpm install
cp .env.example .env   # VITE_API_URL, VITE_WS_URL
pnpm dev
# Web: http://localhost:5173
```

### 4. Android

Mở `warehouse-android/` trong Android Studio, cập nhật `BASE_URL` trong `ApiClient.kt`, build & chạy.
Tải APK từ Android Srudio, buid trên android device.

### 5. Production
Xem chi tiết trên DEPLOYMENT_LINUX.md
```bash
# Web linux: http://localhost:5173
```
---

## Tài khoản mặc định

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@123` | admin |

---

## Biến môi trường (Backend)

| Biến | Mô tả | Mặc định |
|---|---|---|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Tên database | `warehouse_db` |
| `DB_USER` | Username | `warehouse_user` |
| `DB_PASSWORD` | Password | `warehouse_pass` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | Khóa ký JWT | — |
| `JWT_EXPIRE_HOURS` | Thời hạn access token | `24` |
| `APP_PORT` | Port server | `8080` |
| `APP_ENV` | Môi trường | `development` |

---

## Tài liệu

- [Tài liệu chức năng chi tiết](./MODULES.md)
- [Danh sách API](./API_LIST.md)
- [ERD Database](./ERD.md)
- [Kiến trúc hệ thống](./ARCHITECTURE.md)
- [Service & Repository](./SERVICES_REPOS.md)
- [Sequence Diagram](./SEQUENCE_DIAGRAM.md)
- [Data Flow Diagram](./DFD.md)