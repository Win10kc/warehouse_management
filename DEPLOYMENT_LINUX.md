# Warehouse App — Triển khai Ubuntu 24.04

Hướng dẫn deploy chi tiết trên Ubuntu 24.04 dùng **nginx** làm reverse proxy và **systemd** quản lý backend service.

> Xem hướng dẫn cài đặt dev (Windows) và tổng quan hệ thống tại `README.md`.

---

## Yêu cầu hệ thống

- OS: Ubuntu 24.04 LTS
- RAM: tối thiểu 2GB
- Network: kết nối LAN nội bộ

---

## 1. Cài đặt dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ca-certificates gnupg lsb-release

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

---

## 2. Thiết lập Database

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

---

## 3. Clone và cấu hình

```bash
git clone <repository-url> ~/quan_ly_kho_2
cd ~/quan_ly_kho_2
```

**`warehouse-backend/.env`**
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
APP_ENV=production
```

**`warehouse-frontend/.env`** — thay IP nếu khác
```env
VITE_API_URL=http://192.168.110.179
VITE_WS_URL=ws://192.168.110.179/ws
```

---

## 4. Systemd service

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

## 5. Nginx reverse proxy

```bash
sudo apt install -y nginx
# Gỡ Apache nếu đang chạy
sudo systemctl stop apache2 2>/dev/null; sudo systemctl disable apache2 2>/dev/null

sudo nano /etc/nginx/sites-available/warehouse
```

```nginx
server {
    listen 80;
    server_name 192.168.110.179;   # thay bằng IP thực tế

    # Frontend static files
    root /home/minh/quan_ly_kho_2/warehouse-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:8080/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/warehouse /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo chmod +x /home/minh
sudo chmod -R 755 /home/minh/quan_ly_kho_2/warehouse-frontend/dist
sudo nginx -t && sudo systemctl enable nginx && sudo systemctl reload nginx
```

---

## 6. Deploy lần đầu

```bash
cd ~/quan_ly_kho_2
chmod +x scripts/*.sh

./scripts/migrate.sh   # chạy SQL migration
./scripts/seed.sh      # seed tài khoản mặc định
./scripts/deploy.sh    # build + start toàn bộ
```

---

## 7. Cập nhật code

Mỗi khi có thay đổi (frontend hoặc backend), chỉ cần:

```bash
cd ~/quan_ly_kho_2
./scripts/deploy.sh
```

Script tự động: migrate DB → build backend → build frontend → restart service → reload nginx.

---

## 8. Kiểm tra & xử lý sự cố

```bash
# Log backend realtime
sudo journalctl -u warehouse-backend -f

# Log nginx lỗi
sudo tail -f /var/log/nginx/error.log

# Trạng thái tất cả dịch vụ
sudo systemctl status warehouse-backend nginx postgresql redis-server

# Restart thủ công
sudo systemctl restart warehouse-backend
sudo systemctl reload nginx

# Health check
curl http://localhost:8080/health

# Kiểm tra WebSocket qua nginx
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     http://192.168.110.179/ws
```

---

## Tài khoản mặc định

| Username | Role | Password |
|---|---|---|
| `admin` | Admin | `Admin@123` |
| `manager1` | Manager | `Admin@123` |
| `staff1` | Warehouse staff | `Admin@123` |

> Đổi `JWT_SECRET` và tất cả password trước khi dùng thực tế.