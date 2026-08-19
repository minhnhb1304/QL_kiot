import Dexie from 'dexie';
// Ghi rõ đuôi .js: Vite tự suy ra được, Node thì không, mà scripts/test-db-upgrade.mjs
// nạp thẳng file này bằng Node để kiểm thử các bước nâng cấp lược đồ.
import { newUuid } from '../utils/uuid.js';

export async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Initialize IndexedDB database for JuiceLedger
export const db = new Dexie('JuiceLedgerDB');

db.version(1).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at'
});

db.version(2).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, password, fullName, role, phone, email, created_at'
});

db.version(3).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, passwordHash, fullName, role, phone, email, created_at'
});

db.version(5).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, passwordHash, pin, fullName, role, phone, email, created_at',
  store_profile: '++id, &owner_username'
});

db.version(6).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, passwordHash, pin, fullName, role, phone, email, created_at',
  store_profile: '++id, &owner_username',
  daily_cash_records: '++id, &date, opening_cash, closing_cash, total_cash, note, created_at'
});

db.version(7).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, passwordHash, pin, fullName, role, phone, email, created_at',
  store_profile: '++id, &owner_username',
  daily_cash_records: '++id, &date, opening_cash, closing_cash, total_cash, note, created_at',
  quick_notes: '++id, text, is_done, color, created_at, updated_at'
});

db.version(8).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, passwordHash, pin, fullName, role, phone, email, created_at',
  store_profile: '++id, &owner_username',
  daily_cash_records: '++id, &date, opening_cash, closing_cash, total_cash, note, created_at',
  quick_notes: '++id, text, is_done, color, created_at, updated_at',
  expense_presets: '++id, label, icon, amount, category_id, category_name, payment_source, sort_order, created_at'
}).upgrade(tx => tx.table('expense_presets').bulkAdd(defaultExpensePresets()));

// v9: thêm cột đồng bộ để chuẩn bị cho Cloudflare D1.
// uuid là danh tính xuyên thiết bị — ++id tự tăng sẽ đụng nhau khi 2 máy
// cùng ghi ngoại tuyến, nên không dùng làm khóa đồng bộ được.
// _dirty = 1 nghĩa là dòng chưa được đẩy lên máy chủ.
db.version(9).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, &uuid, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at, updated_at, deleted, _dirty',
  users: '++id, &username, passwordHash, pin, fullName, role, phone, email, created_at',
  store_profile: '++id, &owner_username, &uuid, updated_at, deleted, _dirty',
  daily_cash_records: '++id, &uuid, &date, opening_cash, closing_cash, total_cash, note, created_at, updated_at, deleted, _dirty',
  quick_notes: '++id, &uuid, text, is_done, color, created_at, updated_at, deleted, _dirty',
  expense_presets: '++id, &uuid, label, icon, amount, category_id, category_name, payment_source, sort_order, created_at, updated_at, deleted, _dirty',
  sync_meta: 'key'
}).upgrade(async tx => {
  // Gán uuid + cột đồng bộ cho mọi dòng đang có, tránh mất dữ liệu cũ.
  // _dirty = 0: dữ liệu có trước khi bật đồng bộ, chưa coi là thay đổi cần đẩy.
  const tables = ['transactions', 'daily_cash_records', 'quick_notes', 'expense_presets', 'store_profile'];
  for (const name of tables) {
    await tx.table(name).toCollection().modify(row => {
      // MỌI bảng đều nhận uuid ngẫu nhiên, kể cả store_profile.
      //
      // Bản trước gán thẳng 'default' cho store_profile vì cho rằng bảng này chỉ
      // có một dòng. Thực tế App.jsx tạo hồ sơ theo từng owner và
      // authService.registerUser mặc định role 'OWNER', nên máy nào có hai chủ
      // đăng ký là có hai dòng. Cả hai cùng nhận 'default' → vi phạm chỉ mục
      // &uuid → cả transaction nâng cấp bị hủy → db.open() reject → KHÔNG MỞ
      // ĐƯỢC APP trên máy đó.
      //
      // v10 ngay bên dưới mới là chỗ gộp về đúng một hồ sơ mang uuid 'default'.
      if (!row.uuid) row.uuid = newUuid();
      if (row.updated_at === undefined || typeof row.updated_at === 'string') {
        row.updated_at = Date.parse(row.updated_at || '') || Date.now();
      }
      if (row.deleted === undefined) row.deleted = 0;
      if (row._dirty === undefined) row._dirty = 0;
      if (row.server_seq === undefined) row.server_seq = 0;
    });
  }
});

// v10: MỘT hồ sơ cửa hàng dùng chung cho cả quán, uuid cố định 'default'.
//
// Vì sao đổi: lược đồ đám mây (schema.sql:5) nói rõ "MỘT sổ dùng chung cho cả
// quán", và bảng store_profile trên D1 có uuid làm khóa chính với đúng một dòng
// seed 'default' — không có cột nào để chứa chủ sở hữu. Việc khóa hồ sơ theo
// &owner_username ở client là tàn dư từ trước khi có mô hình dùng chung, và nó
// là nguyên nhân của xung đột uuid ở v9.
//
// Bỏ chỉ mục &owner_username, gộp mọi hồ sơ đang có về một dòng duy nhất.
db.version(10).stores({
  store_profile: '++id, &uuid, updated_at, deleted, _dirty'
}).upgrade(async tx => {
  const table = tx.table('store_profile');
  const rows = await table.toArray();
  if (rows.length === 0) return;

  // Giữ hồ sơ được sửa gần nhất — đó là cái chủ quán đang thực sự dùng.
  // Hòa thì lấy id nhỏ nhất cho ổn định, không phụ thuộc thứ tự đọc.
  const winner = rows.reduce((best, row) => {
    const a = row.updated_at || 0, b = best.updated_at || 0;
    if (a !== b) return a > b ? row : best;
    return row.id < best.id ? row : best;
  });

  // Xóa các dòng thừa TRƯỚC khi gán 'default', nếu không dòng còn lại sẽ đụng
  // chỉ mục &uuid với chính những dòng sắp bị xóa.
  const losers = rows.filter(r => r.id !== winner.id).map(r => r.id);
  if (losers.length) await table.bulkDelete(losers);

  await table.update(winner.id, {
    uuid: 'default',
    owner_username: undefined,   // Dexie xóa hẳn khóa khi gán undefined
    updated_at: winner.updated_at || Date.now(),
    _dirty: 1                    // gộp là một thay đổi thật, cần đẩy lên máy chủ
  });
});

// Mẫu chi nhanh mặc định cho quán nước ép.
// uuid cố định trùng với seed trong schema.sql để khi đồng bộ không sinh bản trùng.
// _dirty = 0 vì đây là seed, không phải thao tác của người dùng.
function defaultExpensePresets() {
  const now = Date.now();
  const base = { updated_at: now, created_at: now, deleted: 0, _dirty: 0, server_seq: 0 };
  return [
    { uuid: 'seed-preset-ice', label: 'Đá', icon: '🧊', amount: 20000, category_id: 6, category_name: 'Đá lạnh', payment_source: 'CASH', sort_order: 1, ...base },
    { uuid: 'seed-preset-cup', label: 'Ly / Ống hút', icon: '🥤', amount: 50000, category_id: 5, category_name: 'Bao bì & Vật tư (Ly, ống hút)', payment_source: 'CASH', sort_order: 2, ...base },
    { uuid: 'seed-preset-orange', label: 'Cam', icon: '🍊', amount: 200000, category_id: 4, category_name: 'Trái cây / Hoa quả', payment_source: 'CASH', sort_order: 3, ...base }
  ];
}

// Database mới tạo lần đầu bỏ qua upgrade hook, nên phải seed preset tại đây
db.on('populate', tx => tx.table('expense_presets').bulkAdd(defaultExpensePresets()));

// Clear all transactions from database
export async function clearTransactions() {
  await db.transactions.clear();
}

// Seed default categories, initial demo data and default users if empty
export async function seedInitialData() {
  const countUsers = await db.users.count();
  if (countUsers === 0) {
    await db.users.bulkAdd([
      {
        username: 'admin',
        passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        fullName: 'Chủ Quán Nước Ép',
        role: 'OWNER',
        phone: '0901234567',
        email: 'admin@juiceledger.com',
        created_at: new Date().toISOString()
      },
      {
        username: 'quan',
        passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        fullName: 'Quản Lý Cửa Hàng',
        role: 'OWNER',
        phone: '0907654321',
        email: 'quanly@juiceledger.com',
        created_at: new Date().toISOString()
      },
      {
        username: 'nhanvien',
        passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        fullName: 'Nhân Viên Thu Ngân',
        role: 'STAFF',
        phone: '0988888888',
        email: 'nhanvien@juiceledger.com',
        created_at: new Date().toISOString()
      }
    ]);
  }

  const countCategories = await db.categories.count();
  if (countCategories === 0) {
    await db.categories.bulkAdd([
      { id: 1, name: 'Doanh thu nước ép', type: 'IN', icon: '🍹', color: '#10B981' },
      { id: 2, name: 'Doanh thu ship app (Grab/ShopeeFood)', type: 'IN', icon: '🛵', color: '#06B6D4' },
      { id: 3, name: 'Thu khác', type: 'IN', icon: '💵', color: '#8B5CF6' },
      { id: 4, name: 'Trái cây / Hoa quả', type: 'OUT', icon: '🍎', color: '#F97316' },
      { id: 5, name: 'Bao bì & Vật tư (Ly, ống hút)', type: 'OUT', icon: '🥤', color: '#EC4899' },
      { id: 6, name: 'Đá lạnh', type: 'OUT', icon: '🧊', color: '#3B82F6' },
      { id: 7, name: 'Điện nước & Internet', type: 'OUT', icon: '⚡', color: '#EAB308' },
      { id: 8, name: 'Tiền mặt bằng', type: 'OUT', icon: '🏠', color: '#6366F1' },
      { id: 9, name: 'Lương nhân viên', type: 'OUT', icon: '👨‍🍳', color: '#14B8A6' },
      { id: 10, name: 'Chi phí khác', type: 'OUT', icon: '💸', color: '#64748B' }
    ]);
  }

  const countProfiles = await db.store_profile.count();
  if (countProfiles === 0) {
    await db.store_profile.add({
      storeName: '',
      storeSlogan: '',
      storeLogo: null,
      storeAddress: '',
      storePhone: '',
      businessStartDate: '',
      appStartDate: new Date().toISOString().split('T')[0],
      currency: 'VND',
      monthlyRevenueGoal: 0,
      financialMonthStartDay: 1,
      storeNotes: '',
      // uuid cố định 'default': hồ sơ cửa hàng chỉ có đúng một dòng.
      // _dirty = 0 vì đây là seed, không phải thao tác của người dùng.
      uuid: 'default',
      created_at: Date.now(),
      updated_at: Date.now(),
      deleted: 0,
      _dirty: 0,
      server_seq: 0
    });
  }
}
