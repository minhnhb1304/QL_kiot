-- JuiceLedger — Cloudflare D1 Schema (cloud sync)
-- Áp dụng: npx wrangler d1 execute juice-db --remote --file=./schema.sql
--
-- Mô hình: MỘT sổ dùng chung cho cả quán. Mọi tài khoản đọc/ghi cùng dữ liệu,
-- nên không có store_id. Xem specs/cloud-sync/ để biết chi tiết.
--
-- Quy ước cột đồng bộ (mọi bảng hai chiều đều có):
--   uuid        TEXT    danh tính xuyên thiết bị, sinh ở client
--   updated_at  INTEGER epoch mili giây — trọng tài last-write-wins
--   deleted     INTEGER 0/1 tombstone, để lệnh xóa lan sang máy khác
--   server_seq  INTEGER bộ đếm tăng dần do MÁY CHỦ gán, dùng làm con trỏ kéo

-- ─────────────────────────────────────────────────────────
-- 1. Bộ đếm đồng bộ toàn cục
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_state (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    last_seq INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO sync_state (id, last_seq) VALUES (1, 0);

-- ─────────────────────────────────────────────────────────
-- 2. Người dùng — chỉ máy chủ, KHÔNG đồng bộ về client
--    Mật khẩu băm PBKDF2-SHA256 (Workers không có bcrypt/argon2)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash       TEXT NOT NULL,
    password_salt       TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    full_name           TEXT NOT NULL,
    role                TEXT NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
    phone               TEXT,
    email               TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at          INTEGER NOT NULL
);

-- ─────────────────────────────────────────────────────────
-- 3. Phiên đăng nhập — chỉ lưu SHA-256 của token, không lưu token gốc
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ─────────────────────────────────────────────────────────
-- 4. Danh mục — dữ liệu tham chiếu, client CHỈ kéo về
--    Giữ id số nguyên vì đã seed cố định và UI không cho tạo mới
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    icon       TEXT DEFAULT '💰',
    color      TEXT DEFAULT '#10B981',
    updated_at INTEGER NOT NULL DEFAULT 0,
    deleted    INTEGER NOT NULL DEFAULT 0,
    server_seq INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO categories (id, name, type, icon, color) VALUES
(1,  'Doanh thu nước ép',                'IN',  '🍹', '#10B981'),
(2,  'Doanh thu ship app (Grab/ShopeeFood)', 'IN', '🛵', '#06B6D4'),
(3,  'Thu khác',                         'IN',  '💵', '#8B5CF6'),
(4,  'Trái cây / Hoa quả',               'OUT', '🍎', '#F97316'),
(5,  'Bao bì & Vật tư (Ly, ống hút)',    'OUT', '🥤', '#EC4899'),
(6,  'Đá lạnh',                          'OUT', '🧊', '#3B82F6'),
(7,  'Điện nước & Internet',             'OUT', '⚡', '#EAB308'),
(8,  'Tiền mặt bằng',                    'OUT', '🏠', '#6366F1'),
(9,  'Lương nhân viên',                  'OUT', '👨‍🍳', '#14B8A6'),
(10, 'Chi phí khác',                     'OUT', '💸', '#64748B');

-- ─────────────────────────────────────────────────────────
-- 5. Giao dịch thu/chi — bảng đồng bộ chính
--    idempotency_key chống webhook SMS ghi trùng khi gửi lại
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    uuid             TEXT PRIMARY KEY,
    type             TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    category_id      INTEGER REFERENCES categories(id),
    category_name    TEXT NOT NULL,
    amount           REAL NOT NULL,
    payment_source   TEXT NOT NULL CHECK (payment_source IN ('CASH', 'BANK')),
    note             TEXT,
    transaction_date TEXT NOT NULL,          -- 'YYYY-MM-DD'
    idempotency_key  TEXT UNIQUE,            -- NULL cho giao dịch nhập tay
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    deleted          INTEGER NOT NULL DEFAULT 0,
    server_seq       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_seq    ON transactions(server_seq);
CREATE INDEX IF NOT EXISTS idx_tx_date   ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tx_type   ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_source ON transactions(payment_source);

-- ─────────────────────────────────────────────────────────
-- 6. Chốt tiền mặt đầu/cuối ngày
--    date là UNIQUE → hợp nhất theo date, KHÔNG theo uuid.
--    Hai thiết bị cùng chốt một ngày sẽ tạo 2 uuid nhưng cùng date;
--    nếu ghép theo uuid thì lô batch() vi phạm UNIQUE và bị hủy toàn bộ.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_cash_records (
    uuid         TEXT PRIMARY KEY,
    date         TEXT NOT NULL UNIQUE,       -- 'YYYY-MM-DD'
    opening_cash REAL NOT NULL DEFAULT 0,
    closing_cash REAL NOT NULL DEFAULT 0,
    total_cash   REAL NOT NULL DEFAULT 0,
    note         TEXT,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    deleted      INTEGER NOT NULL DEFAULT 0,
    server_seq   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cash_seq  ON daily_cash_records(server_seq);
CREATE INDEX IF NOT EXISTS idx_cash_date ON daily_cash_records(date);

-- ─────────────────────────────────────────────────────────
-- 7. Ghi chú nhanh
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_notes (
    uuid       TEXT PRIMARY KEY,
    text       TEXT NOT NULL,
    is_done    INTEGER NOT NULL DEFAULT 0,
    color      TEXT DEFAULT '#10B981',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0,
    server_seq INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_seq ON quick_notes(server_seq);

-- ─────────────────────────────────────────────────────────
-- 8. Mẫu chi nhanh
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_presets (
    uuid           TEXT PRIMARY KEY,
    label          TEXT NOT NULL,
    icon           TEXT DEFAULT '⚡',
    amount         REAL NOT NULL,
    category_id    INTEGER REFERENCES categories(id),
    category_name  TEXT NOT NULL,
    payment_source TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_source IN ('CASH', 'BANK')),
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    deleted        INTEGER NOT NULL DEFAULT 0,
    server_seq     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_presets_seq  ON expense_presets(server_seq);
CREATE INDEX IF NOT EXISTS idx_presets_sort ON expense_presets(sort_order);

-- Seed 3 mẫu chi mặc định cho quán nước ép (uuid cố định để mọi
-- thiết bị nhận đúng một bản, không sinh ra bản trùng khi đồng bộ)
INSERT OR IGNORE INTO expense_presets
    (uuid, label, icon, amount, category_id, category_name, payment_source, sort_order, created_at, updated_at, server_seq)
VALUES
('seed-preset-ice',   'Đá',           '🧊',  20000, 6, 'Đá lạnh',                       'CASH', 1, 0, 0, 0),
('seed-preset-cup',   'Ly / Ống hút', '🥤',  50000, 5, 'Bao bì & Vật tư (Ly, ống hút)', 'CASH', 2, 0, 0, 0),
('seed-preset-orange','Cam',          '🍊', 200000, 4, 'Trái cây / Hoa quả',            'CASH', 3, 0, 0, 0);

-- ─────────────────────────────────────────────────────────
-- 9. Hồ sơ cửa hàng — đúng một dòng, uuid cố định 'default'
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_profile (
    uuid                   TEXT PRIMARY KEY,
    store_name             TEXT DEFAULT '',
    store_slogan           TEXT DEFAULT '',
    store_logo             TEXT,
    store_address          TEXT DEFAULT '',
    store_phone            TEXT DEFAULT '',
    business_start_date    TEXT DEFAULT '',
    app_start_date         TEXT DEFAULT '',
    currency               TEXT DEFAULT 'VND',
    monthly_revenue_goal   REAL DEFAULT 0,
    financial_month_start_day INTEGER DEFAULT 1,
    store_notes            TEXT DEFAULT '',
    created_at             INTEGER NOT NULL DEFAULT 0,
    updated_at             INTEGER NOT NULL DEFAULT 0,
    deleted                INTEGER NOT NULL DEFAULT 0,
    server_seq             INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO store_profile (uuid) VALUES ('default');
