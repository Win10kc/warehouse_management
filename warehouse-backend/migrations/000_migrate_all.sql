-- ============================================================
-- Warehouse App — Full Migration (001 → 005)
-- Chạy: psql -U warehouse_user -d warehouse_db -f migrate_all.sql
-- ============================================================

-- ── 001_init ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(200) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'warehouse',
    is_active     BOOLEAN DEFAULT true,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS warehouses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    address     TEXT,
    description TEXT,
    is_active   BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS zones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    code         VARCHAR(50)  NOT NULL,
    name         VARCHAR(200) NOT NULL,
    description  TEXT
);

CREATE TABLE IF NOT EXISTS racks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id      UUID NOT NULL REFERENCES zones(id),
    code         VARCHAR(50)  NOT NULL,
    name         VARCHAR(200) NOT NULL,
    max_weight_kg INT
);

CREATE TABLE IF NOT EXISTS bins (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rack_id   UUID NOT NULL REFERENCES racks(id),
    code      VARCHAR(50)  NOT NULL,
    qr_code   VARCHAR(200) UNIQUE,
    rfid_uid  VARCHAR(200) UNIQUE,
    capacity  INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku         VARCHAR(100) UNIQUE NOT NULL,
    name        VARCHAR(300) NOT NULL,
    unit        VARCHAR(50)  NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    qr_code     VARCHAR(200) UNIQUE,
    rfid_uid    VARCHAR(200) UNIQUE,
    image_url   TEXT,
    min_stock   INT DEFAULT 0,
    max_stock   INT DEFAULT 0,
    supplier_id UUID,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_summary (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id        UUID UNIQUE NOT NULL REFERENCES products(id),
    total_quantity    INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id),
    bin_id      UUID NOT NULL REFERENCES bins(id),
    quantity    INT DEFAULT 0,
    status      VARCHAR(50) DEFAULT 'good',
    expire_date DATE,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, bin_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code           VARCHAR(100) UNIQUE NOT NULL,
    type           VARCHAR(20) NOT NULL,
    status         VARCHAR(20) DEFAULT 'draft',
    created_by_id  UUID NOT NULL REFERENCES users(id),
    approved_by_id UUID REFERENCES users(id),
    note           TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    approved_at    TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transaction_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id   UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id       UUID NOT NULL REFERENCES products(id),
    from_bin_id      UUID REFERENCES bins(id),
    to_bin_id        UUID REFERENCES bins(id),
    suggested_bin_id UUID REFERENCES bins(id) ON DELETE SET NULL,
    quantity_requested INT NOT NULL,
    quantity_actual    INT DEFAULT 0,
    scan_method        VARCHAR(20) DEFAULT 'manual'
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   UUID,
    old_value   JSONB,
    new_value   JSONB,
    ip_address  VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger update_updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_stock_summary_updated
    BEFORE UPDATE ON stock_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed admin (password: Admin@123)
INSERT INTO users (username, password_hash, full_name, role)
VALUES ('admin', '$2a$10$JGfDcov1f7y1e6hFuR70DubOC/GahL2irU1DL30ei8vBvIJ9K4KFu', 'Administrator', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ── 002_qr_rfid ───────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_rfid_uid
    ON products(rfid_uid) WHERE rfid_uid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_qr_code
    ON products(qr_code) WHERE qr_code IS NOT NULL;

-- ── 003_product_requests ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_code       VARCHAR(500) NOT NULL,
    suggested_name VARCHAR(300) NOT NULL,
    note           TEXT,
    reported_by_id UUID NOT NULL REFERENCES users(id),
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_requests_status
    ON product_requests(status);

CREATE OR REPLACE TRIGGER trg_product_requests_updated
    BEFORE UPDATE ON product_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 004_suppliers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(300) NOT NULL,
    contact    VARCHAR(300),
    note       TEXT,
    is_active  BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_suppliers_updated
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- FK products → suppliers (bỏ qua nếu đã tồn tại)
DO $$ BEGIN
    ALTER TABLE products
        ADD CONSTRAINT fk_products_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 005_product_request_supplier ──────────────────────────────
ALTER TABLE product_requests
    ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(300) DEFAULT '';

-- ── Done ──────────────────────────────────────────────────────
DO $$ BEGIN
    RAISE NOTICE 'Migration hoàn tất (001–005).';
END $$;