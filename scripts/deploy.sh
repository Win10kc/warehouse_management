#!/bin/bash
set -e

PROJECT_ROOT="/home/minh/quan_ly_kho_2"

echo "🚀 [START] Bắt đầu quy trình triển khai tự động..."

# 1. Cập nhật code mới nhất (nếu dùng git)
# cd $PROJECT_ROOT && git pull

# 2. Thực hiện Migration database
echo "----------------------------------------"
echo "📦 1. Đang kiểm tra và cập nhật Database..."
bash $PROJECT_ROOT/scripts/migrate.sh

# 3. Build Backend Go
echo "----------------------------------------"
echo "�� 2. Đang biên dịch Backend Go..."
cd $PROJECT_ROOT/warehouse-backend
go build -o build/warehouse-server ./cmd/server

# 4. Build Frontend Vite + React
echo "----------------------------------------"
echo "⚛️ 3. Đang biên dịch Frontend (Production Mode)..."
cd $PROJECT_ROOT/warehouse-frontend
pnpm install
pnpm build

# 5. Khởi động lại các dịch vụ hệ thống
echo "----------------------------------------"
echo "🔄 4. Khởi động lại dịch vụ Hệ thống & Nginx..."
sudo systemctl restart warehouse-backend
sudo systemctl reload nginx

echo "========================================"
echo "🎉 [SUCCESS] Hệ thống đã được triển khai hoàn tất!"
echo "📍 Truy cập tại: http://192.168.110.179"
echo "========================================"
