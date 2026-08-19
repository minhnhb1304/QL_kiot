-- Migration 0001 — chuyển D1 đang chạy sang lược đồ cloud sync
--
-- CHẠY MỘT LẦN DUY NHẤT, TRƯỚC schema.sql:
--   npx wrangler d1 execute juice-db --remote --file=./migrations/0001_cloud_sync.sql
--   npx wrangler d1 execute juice-db --remote --file=./schema.sql
--
-- Vì sao cần file này: schema.sql chỉ có CREATE TABLE IF NOT EXISTS, nên với
-- database đang chạy (đã có categories + transactions kiểu cũ) nó bỏ qua hai
-- bảng đó — cột đồng bộ sẽ KHÔNG bao giờ được thêm. File này làm phần đó.
--
-- Không idempotent: chạy lần hai sẽ lỗi "duplicate column name". Đó là chủ ý —
-- lỗi còn hơn âm thầm dựng lại bảng lần nữa.

-- ─────────────────────────────────────────────────────────
-- 1. categories — thêm cột đồng bộ tại chỗ (an toàn, không mất dữ liệu)
--    Cột created_at kiểu cũ được giữ lại; thừa nhưng vô hại.
-- ─────────────────────────────────────────────────────────
ALTER TABLE categories ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN deleted    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN server_seq INTEGER NOT NULL DEFAULT 0;

-- Tên danh mục 2 đã đổi trong lược đồ mới; INSERT OR IGNORE không cập nhật được
-- dòng đã tồn tại nên phải sửa tay.
UPDATE categories
   SET name = 'Doanh thu ship app (Grab/ShopeeFood)'
 WHERE id = 2 AND name = 'Doanh thu ship app';

-- ─────────────────────────────────────────────────────────
-- 2. transactions — đổi khóa chính từ id INTEGER sang uuid TEXT
--    SQLite không ALTER được khóa chính, buộc phải dựng lại bảng.
-- ─────────────────────────────────────────────────────────
CREATE TABLE transactions_new (
    uuid             TEXT PRIMARY KEY,
    type             TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    category_id      INTEGER REFERENCES categories(id),
    category_name    TEXT NOT NULL,
    amount           REAL NOT NULL,
    payment_source   TEXT NOT NULL CHECK (payment_source IN ('CASH', 'BANK')),
    note             TEXT,
    transaction_date TEXT NOT NULL,
    idempotency_key  TEXT UNIQUE,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL,
    deleted          INTEGER NOT NULL DEFAULT 0,
    server_seq       INTEGER NOT NULL
);

-- Sinh uuid v4 bằng randomblob vì SQLite không có hàm uuid sẵn.
-- created_at cũ là chuỗi DATETIME ('YYYY-MM-DD HH:MM:SS') — đổi sang epoch mili giây.
-- server_seq gán theo thứ tự id cũ để giữ nguyên trình tự lịch sử.
INSERT INTO transactions_new (
    uuid, type, category_id, category_name, amount, payment_source,
    note, transaction_date, idempotency_key, created_at, updated_at,
    deleted, server_seq
)
SELECT
    lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', (abs(random() % 4)) + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))),
    type,
    category_id,
    category_name,
    amount,
    payment_source,
    note,
    transaction_date,
    NULL,
    COALESCE(CAST(strftime('%s', created_at) AS INTEGER) * 1000,
             CAST(strftime('%s', 'now')     AS INTEGER) * 1000),
    COALESCE(CAST(strftime('%s', created_at) AS INTEGER) * 1000,
             CAST(strftime('%s', 'now')     AS INTEGER) * 1000),
    0,
    ROW_NUMBER() OVER (ORDER BY id)
FROM transactions;

DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;

CREATE INDEX IF NOT EXISTS idx_tx_seq    ON transactions(server_seq);
CREATE INDEX IF NOT EXISTS idx_tx_date   ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tx_type   ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_source ON transactions(payment_source);

-- ─────────────────────────────────────────────────────────
-- 3. Bộ đếm đồng bộ — đặt con trỏ ngay sau dòng cuối vừa chuyển
--    (schema.sql tạo lại bảng này cũng không sao: INSERT OR IGNORE)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_state (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    last_seq INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO sync_state (id, last_seq) VALUES (1, 0);
UPDATE sync_state
   SET last_seq = (SELECT COALESCE(MAX(server_seq), 0) FROM transactions)
 WHERE id = 1;
