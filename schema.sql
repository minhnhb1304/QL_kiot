-- JuiceLedger - Cloudflare D1 Database Schema
-- Run this in Cloudflare D1: npx wrangler d1 execute juice-db --file=./schema.sql

-- 1. Table Categories (Danh mục Thu / Chi)
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
    icon TEXT DEFAULT '💰',
    color TEXT DEFAULT '#10B981',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default categories for Juice Shop
INSERT OR IGNORE INTO categories (id, name, type, icon, color) VALUES
(1, 'Doanh thu nước ép', 'IN', '🍹', '#10B981'),
(2, 'Doanh thu ship app', 'IN', '🛵', '#06B6D4'),
(3, 'Thu khác', 'IN', '💵', '#8B5CF6'),
(4, 'Trái cây / Hoa quả', 'OUT', '🍎', '#F97316'),
(5, 'Bao bì & Vật tư (Ly, ống hút)', 'OUT', '🥤', '#EC4899'),
(6, 'Đá lạnh', 'OUT', '🧊', '#3B82F6'),
(7, 'Điện nước & Internet', 'OUT', '⚡', '#EAB308'),
(8, 'Tiền mặt bằng', 'OUT', '🏠', '#6366F1'),
(9, 'Lương nhân viên', 'OUT', '👨‍🍳', '#14B8A6'),
(10, 'Chi phí khác', 'OUT', '💸', '#64748B');

-- 2. Table Transactions (Nhật ký giao dịch Thu / Chi)
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    category_name TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_source TEXT CHECK(payment_source IN ('CASH', 'BANK')) NOT NULL,
    note TEXT,
    transaction_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast date queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(payment_source);
