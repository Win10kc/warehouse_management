#!/bin/bash
set -e

# Đọc cấu hình từ file .env nếu có
if [ -f ../warehouse-backend/.env ]; then
    export $(cat ../warehouse-backend/.env | grep -v '^#' | xargs)
fi

DB_USER=${DB_USER:-warehouse_user}
DB_NAME=${DB_NAME:-warehouse_db}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

echo "=== [1/2] Đang kiểm tra kết nối Database... ==="
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
  echo "Database chưa sẵn sàng, đang thử lại sau 2 giây..."
  sleep 2
done

echo "=== [2/2] Bắt đầu chạy dữ liệu cấu trúc (Migration)... ==="
# Thay đổi đường dẫn trỏ đúng đến nơi chứa các file SQL của bạn (ví dụ nằm ở database/migrations hoặc gốc)
# Giả định các file sql nằm ở thư mục gốc hoặc sql/ của dự án:
for file in /home/minh/quan_ly_kho_2/warehouse-backend/migrations/*.sql; do
    if [ -f "$file" ]; then
        echo "Đang thực thi: $file"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"
    fi
done

echo "🎉 Cập nhật cấu trúc Database thành công!"
