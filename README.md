# Quản Lý Kho 2

Hệ thống quản lý kho hàng nội bộ gồm 3 thành phần: **Backend API** (Go), **Web Admin** (React), và **Android App** (Kotlin) dành cho nhân viên vận hành kho.

---

## Kiến trúc tổng quan

```
┌─────────────────┐     ┌─────────────────┐
│   Web Admin      │     │  Android App     │
│  React + Vite   │     │  Kotlin (M35)    │
│  :5173 (dev)    │     │  Scan QR / NFC   │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         └──────────┬────────────┘
                    │ HTTP / WebSocket
         ┌──────────▼────────────┐
         │     Backend API       │
         │   Go + Gin + GORM     │
         │   localhost:8080      │
         └──────────┬────────────┘
                    │
         ┌──────────▼────────────┐
         │  PostgreSQL 17        │  Redis 7
         │  localhost:5432       │  localhost:6379
         └───────────────────────┘
```

**Web Admin** — Quản trị trung tâm: duyệt phiếu, quản lý sản phẩm, kho bãi, xem tồn kho real-time qua WebSocket.

**Android App** — Công cụ vận hành kho: quét QR/NFC, tạo phiếu nhập/xuất tại thực địa, nhận thông báo real-time.

---

## Tech Stack

| Tầng | Công nghệ |
|---|---|
| Backend | Go 1.23 · Gin · GORM · Air (dev) |
| Frontend | Vite + React 18 · TailwindCSS · Zustand · Recharts |
| Android | Kotlin · AGP 8.6.1 · Retrofit · CameraX · ML Kit |
| Database | PostgreSQL 17 · Redis 7 |
| Real-time | WebSocket (gorilla/websocket) — singleton pub/sub trên frontend |
| Package manager FE | pnpm |
| Production | Ubuntu 24.04 · nginx · systemd |

---

## Môi trường

| | Dev (Windows) | Production (Ubuntu) |
|---|---|---|
| Frontend | `http://localhost:5173` | `http://192.168.110.179` |
| Backend | `http://localhost:8080` | `http://192.168.110.179/api/` (nginx proxy) |
| WebSocket | `ws://localhost:8080/ws` | `ws://192.168.110.179/ws` (nginx proxy) |
| Android BASE_URL | `http://<IP_LAN>:8080` | `http://192.168.110.179:8080` |
| DB | `localhost:5432` · `warehouse_db` | idem |
| Redis | `localhost:6379` | idem |

---

## Cài đặt môi trường — Windows (Dev)

### 1. PostgreSQL 17
1. Tải tại [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Thêm vào System PATH: `C:\Program Files\PostgreSQL\17\bin`
3. Tạo database và user:
```sql
CREATE USER warehouse_user WITH PASSWORD 'warehouse_pass';
CREATE DATABASE warehouse_db OWNER warehouse_user;
GRANT ALL PRIVILEGES ON DATABASE warehouse_db TO warehouse_user;
```

### 2. Redis (Memurai)
1. Tải tại [memurai.com](https://www.memurai.com/) — tự đăng ký Windows Service
2. Mặc định `localhost:6379`, không cần password

### 3. Go 1.23+
```powershell
# Sau khi cài từ golang.org/dl:
go env -w GOPROXY=https://goproxy.cn,direct
```

### 4. Node.js + pnpm
```powershell
npm install -g pnpm
```

### 5. Android Studio
- SDK Platform: Android 14 (API 34) và Android 15 (API 35)
- SDK Build-Tools: 34.0.0+, AGP 8.6.1, Gradle 8.9, JDK 17

---

## Cài đặt môi trường — Ubuntu 24.04 (Production)

### Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ca-certificates

# Go 1.23
sudo rm -rf /usr/local/go
wget https://go.dev/dl/go1.23.4.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.23.4.linux-amd64.tar.gz
rm go1.23.4.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin:$HOME/go/bin' >> ~/.bashrc
source ~/.bashrc
go env -w GOPROXY=https://goproxy.cn,direct

# Node.js 20 + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pnpm

# PostgreSQL 17
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list'
sudo apt update && sudo apt install -y postgresql-17 postgresql-client-17

# Redis 7
sudo apt install -y redis-server
sudo systemctl enable redis-server && sudo systemctl start redis-server
```

### Database
```bash
sudo -u postgres psql <<EOF
CREATE DATABASE warehouse_db;
CREATE USER warehouse_user WITH ENCRYPTED PASSWORD 'warehouse_pass';
GRANT ALL PRIVILEGES ON DATABASE warehouse_db TO warehouse_user;
ALTER DATABASE warehouse_db OWNER TO warehouse_user;
\c warehouse_db
GRANT ALL ON SCHEMA public TO warehouse_user;
EOF
```

### Nginx
```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/warehouse
```

Nội dung (thay IP nếu khác):
```nginx
server {
    listen 80;
    server_name 192.168.110.179;

    root /home/minh/quan_ly_kho_2/warehouse-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws {
        proxy_pass http://localhost:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/warehouse /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo chmod +x /home/minh
sudo chmod -R 755 /home/minh/quan_ly_kho_2/warehouse-frontend/dist
sudo nginx -t && sudo systemctl reload nginx
```

### Systemd service (Backend)
```bash
sudo nano /etc/systemd/system/warehouse-backend.service
```

```ini
[Unit]
Description=Warehouse Backend Service
After=network.target postgresql.service redis-server.service

[Service]
User=minh
WorkingDirectory=/home/minh/quan_ly_kho_2/warehouse-backend
ExecStart=/home/minh/quan_ly_kho_2/warehouse-backend/build/warehouse-server
Restart=always
RestartSec=5
Environment="APP_ENV=production"

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable warehouse-backend
```

---

## Clone và cấu hình

```bash
git clone <repo-url> ~/quan_ly_kho_2
cd ~/quan_ly_kho_2
```

### Backend `.env`
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=warehouse_db
DB_USER=warehouse_user
DB_PASSWORD=warehouse_pass
DB_SSLMODE=disable
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=super_secret_key_warehouse
JWT_EXPIRE_HOURS=24
APP_PORT=8080
APP_ENV=development   # đổi thành production trên Ubuntu
```

### Frontend `.env`
```env
# Dev (Windows)
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws

# Production (Ubuntu) — thay IP nếu khác
VITE_API_URL=http://192.168.110.179
VITE_WS_URL=ws://192.168.110.179/ws
```

### Android
Mở `warehouse-android/app/build.gradle.kts`, sửa:
```kotlin
buildConfigField("String", "BASE_URL", "\"http://<IP_MÁY_UBUNTU>:8080\"")
```
> Tìm IP LAN: chạy `ip a` (Ubuntu) hoặc `ipconfig` (Windows). Điện thoại và máy chủ phải cùng mạng WiFi.

---

## Chạy ứng dụng

### Dev (Windows)
```powershell
# Terminal 1 — Backend
cd warehouse-backend
go mod tidy
go run ./cmd/server/main.go

# Terminal 2 — Frontend
cd warehouse-frontend
pnpm install
pnpm dev
```

### Production (Ubuntu)
```bash
cd ~/quan_ly_kho_2
chmod +x scripts/*.sh

# Lần đầu: migrate + seed
./scripts/migrate.sh
./scripts/seed.sh

# Build và deploy (dùng mỗi khi có code mới)
./scripts/deploy.sh
```

`deploy.sh` tự động: migrate DB → build backend → build frontend → restart systemd service → reload nginx.

---

## Kết nối Android (Wireless Debugging)

> Yêu cầu: Android 11+, cùng mạng WiFi với máy chủ.

1. Settings → About phone → tap "Build number" 7 lần
2. Settings → Developer options → bật **Wireless debugging**
3. Tap **Pair device with pairing code** → ghi lại IP:Port và mã 6 số
4. Android Studio → Tools → Device Manager → **+** → **Pair using Wi-Fi** → nhập thông tin trên

---

## Cấu trúc thư mục

```
quan_ly_kho_2/
├── warehouse-backend/
│   ├── cmd/server/main.go          # Entry point
│   ├── internal/
│   │   ├── domain/                 # Entity: Product, Transaction, Warehouse, Bin...
│   │   ├── handler/                # HTTP handlers
│   │   ├── service/                # Business logic
│   │   ├── repository/             # DB queries (GORM)
│   │   ├── middleware/             # JWT auth
│   │   └── websocket/              # Real-time hub (pub/sub)
│   ├── migrations/                 # SQL migration files
│   └── build/warehouse-server      # Binary sau khi build
├── warehouse-frontend/
│   └── src/
│       ├── pages/                  # TransactionListPage, DashboardPage...
│       ├── store/                  # Zustand: authStore, stockStore
│       ├── api/                    # Axios client
│       └── hooks/useSocket.ts      # WebSocket singleton pub/sub
├── warehouse-android/
│   └── app/src/main/java/com/minh/warehouse/
│       ├── ui/                     # Activities: Login, Scan, TransactionForm
│       ├── data/                   # Retrofit API client, Models, WebSocketManager
│       └── util/                   # TokenManager, NfcScanHelper
└── scripts/
    ├── deploy.sh                   # Build + deploy tự động
    ├── migrate.sh                  # Chạy migration SQL
    └── seed.sh                     # Seed dữ liệu mẫu
```

---

## WebSocket — Real-time events

Frontend dùng kiến trúc singleton pub/sub: 1 WebSocket connection duy nhất toàn app, các component subscribe theo event name.

| Event | Trigger | Consumer |
|---|---|---|
| `transaction_update` | Tạo / Approve / Complete / Reject phiếu | Web `/transactions`, Android |
| `stock_update` | Complete transaction | Web Dashboard, Android |
| `alert` | Tồn kho thấp, báo cáo SP mới | Web `/admin/product-requests` |
| `bin_suggestion` | Manager đề xuất đổi bin | Android "Phiếu của tôi" |

Format message: `{ "event": "...", "data": { ... } }`

---

## API chính

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/v1/auth/login` | Public | Đăng nhập |
| GET | `/api/v1/auth/me` | JWT | Thông tin user hiện tại |
| GET | `/api/v1/products` | JWT | Danh sách sản phẩm |
| GET | `/api/v1/products/scan/:code` | JWT | Tra cứu qua QR/RFID |
| POST | `/api/v1/products/:id/generate-qr` | JWT | Tạo mã QR |
| GET/POST | `/api/v1/transactions` | JWT | Danh sách / Tạo phiếu |
| PUT | `/api/v1/transactions/:id/approve` | JWT (admin/manager) | Duyệt phiếu |
| PUT | `/api/v1/transactions/:id/complete` | JWT (admin/manager) | Hoàn tất phiếu |
| PUT | `/api/v1/transactions/:id/reject` | JWT (admin/manager) | Từ chối phiếu |
| PUT | `/api/v1/transactions/:id/suggest-bin` | JWT (admin/manager) | Đề xuất bin mới |
| GET | `/api/v1/warehouses` | JWT | Danh sách kho (Zone/Rack/Bin) |
| GET | `/api/v1/stock` | JWT | Tồn kho hiện tại |
| GET | `/api/v1/stock/locations` | JWT | Bin đang có hàng |
| POST | `/api/v1/product-requests` | JWT | Báo cáo SP chưa có trong hệ thống |
| GET | `/api/v1/product-requests` | JWT (admin/manager) | Danh sách báo cáo |
| GET | `/ws` | Public | WebSocket endpoint |

---

## Luồng vận hành

**Nhập kho:**
```
Xe hàng đến → Android scan QR → Chọn bin lưu → Tạo phiếu nhập
→ Web nhận real-time → Admin/Manager duyệt → Hoàn tất → Tồn kho cập nhật

```

**Xuất kho:**
```
Lấy lệnh xuất → Android scan QR xác nhận → Tạo phiếu xuất
→ Admin duyệt → Hoàn tất → Tồn kho giảm

```

**Hàng chưa có QR:**
```
Scan không ra → Android báo cáo SP mới → Web nhận alert real-time
→ Admin tạo SKU + generate QR → In nhãn dán lên hàng

```

**Manager đề xuất đổi bin:**
```
Phiếu đang processing → Manager mở chi tiết phiếu (web)
→ Bấm "Đổi bin" → Chọn bin mới → Android nhận alert real-time
→ Staff thấy bin đề xuất trong CompleteModal

```

---

## Cấu trúc kho

```
Warehouse (Kho)
└── Zone (Khu vực)
    └── Rack (Kệ)
        └── Bin (Ô chứa hàng)
```

Ví dụ hiển thị: `Kho HN › Khu A › RACK-01 › BIN-03`

---

## Tài khoản mặc định

| Username | Role | Password |
|---|---|---|
| `admin` | Admin | `Admin@123` |
| `manager1` | Manager | `Admin@123` |
| `staff1` | Warehouse staff | `Admin@123` |

> **Bảo mật:** Đổi `JWT_SECRET` và tất cả password trước khi dùng thực tế.

---

## Kiểm tra & xử lý sự cố (Ubuntu)

```bash
# Log backend realtime
sudo journalctl -u warehouse-backend -f

# Log nginx lỗi
sudo tail -f /var/log/nginx/error.log

# Trạng thái dịch vụ
sudo systemctl status warehouse-backend nginx postgresql redis-server

# Restart backend
sudo systemctl restart warehouse-backend

# Kiểm tra health
curl http://localhost:8080/health
```

---

## Gradle config (Android)

| | Giá trị |
|---|---|
| AGP | 8.6.1 |
| Kotlin | 2.0.21 |
| Gradle | 8.9 |
| compileSdk | 36 |
| targetSdk | 34 |
| minSdk | 26 |
| Thiết bị test | Samsung Galaxy M35 (SM-M356B) · Android 16 |