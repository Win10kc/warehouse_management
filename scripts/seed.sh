#!/bin/bash
set -e

# Đọc cấu hình từ file .env nếu có
if [ -f ../warehouse-backend/.env ]; then
    export $(cat ../warehouse-backend/.env | grep -v '^#' | xargs)
fi

# Tự động truyền mật khẩu cho psql
export PGPASSWORD="${DB_PASSWORD:-warehouse_pass}"

DB_USER=${DB_USER:-warehouse_user}
DB_NAME=${DB_NAME:-warehouse_db}

echo "=== Đang đổ dữ liệu mẫu (Seed Data) vào hệ thống... ==="

# Chuỗi hash dưới đây tương đương với mật khẩu: Admin@123
psql -h "localhost" -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO users (username, password_hash, role, full_name, created_at) 
VALUES ('admin', '\$2a\$12\$Hh7ozxr1DFo5UmSKXr.d/uGyDa9ysLR.XeDkkAhbhLQap12smJQWK', 'admin', 'Administrator', NOW())
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
"

echo "🎉 Đã làm mới tài khoản admin (MK: Admin@123)!"