// Kiểm thử chuỗi nâng cấp Dexie bằng CHÍNH src/services/db.js.
//
// Chạy: npm run test:db
//
// Vì sao đáng có bài test này: lỗi trong hàm upgrade không làm hỏng một tính
// năng — nó làm db.open() reject, tức là app KHÔNG MỞ ĐƯỢC, và chỉ xảy ra trên
// máy đã có dữ liệu cũ nên `npm run dev` trên máy sạch không bao giờ lộ ra.
// Đúng một lỗi như vậy từng tồn tại ở v9: hai chủ quán đăng ký trên cùng một
// thiết bị thì cả hai hồ sơ cùng nhận uuid 'default', vi phạm chỉ mục &uuid.
//
// Bài test nạp db.js thật chứ không chép lại lược đồ — chép lại thì bản sao sẽ
// trôi khỏi bản gốc và test vẫn xanh trong khi app đã hỏng.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

const DB_URL = new URL('../src/services/db.js', import.meta.url).href;

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail !== undefined ? '\n        ' + JSON.stringify(detail) : ''}`); }
};

// Lược đồ v8 — trạng thái đang chạy trên máy người dùng ở nhánh main.
const V8_STORES = {
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, passwordHash, pin, fullName, role, phone, email, created_at',
  store_profile: '++id, &owner_username',
  daily_cash_records: '++id, &date, opening_cash, closing_cash, total_cash, note, created_at',
  quick_notes: '++id, text, is_done, color, created_at',
  expense_presets: '++id, label, icon, amount, category_id, category_name, payment_source, sort_order'
};

// Mỗi kịch bản cần một database sạch VÀ một bản db.js mới.
//
// Xóa bằng Dexie.delete chứ KHÔNG gán lại globalThis.indexedDB: Dexie giữ tham
// chiếu tới indexedDB ngay từ lúc module được nạp, nên thay factory toàn cục
// không có tác dụng — các kịch bản sẽ dùng chung một database và test cho kết
// quả sai.
//
// Query ?scenario= làm Node coi đó là module khác nên đánh giá lại từ đầu:
// db.js tạo instance Dexie ngay lúc nạp, dùng lại bản cũ sẽ trỏ vào database
// vừa bị xóa.
let scenarioId = 0;
async function freshDb(seedProfiles) {
  await Dexie.delete('JuiceLedgerDB');
  scenarioId++;

  if (seedProfiles) {
    const v8 = new Dexie('JuiceLedgerDB');
    v8.version(8).stores(V8_STORES);
    await v8.open();
    await v8.store_profile.bulkAdd(seedProfiles);
    await v8.transactions.bulkAdd([{
      type: 'IN', category_id: 1, category_name: 'Doanh thu nước ép', amount: 50000,
      payment_source: 'CASH', note: 'x', transaction_date: '2026-08-01',
      created_at: '2026-08-01 09:00:00'
    }]);
    v8.close();
  }

  const mod = await import(`${DB_URL}?scenario=${scenarioId}`);
  await mod.db.open();
  return mod.db;
}

console.log('\n=== 1. Máy một chủ (v8 → mới nhất) ===');
{
  const db = await freshDb([{ owner_username: 'anh', storeName: 'Quán A' }]);
  const rows = await db.store_profile.toArray();
  check('app mở được', true);
  check('còn đúng 1 hồ sơ', rows.length === 1, rows.length);
  check("uuid = 'default'", rows[0].uuid === 'default', rows[0].uuid);
  check('giữ nguyên tên quán', rows[0].storeName === 'Quán A', rows[0].storeName);
  check('bỏ hẳn owner_username', rows[0].owner_username === undefined, rows[0]);
  check('giao dịch cũ không mất', (await db.transactions.count()) === 1);
  check('giao dịch cũ được gán uuid', !!(await db.transactions.toCollection().first()).uuid);
  db.close();
}

console.log('\n=== 2. Máy hai chủ — ca từng làm app không mở được ===');
{
  let db, opened = true;
  try {
    db = await freshDb([
      { owner_username: 'anh', storeName: 'Quán A', updated_at: 1000 },
      { owner_username: 'chi', storeName: 'Quán B', updated_at: 9000 }  // sửa gần nhất
    ]);
  } catch (err) {
    opened = false;
    check('app mở được (trước đây ConstraintError)', false, err.message);
  }
  if (opened) {
    check('app mở được (trước đây ConstraintError)', true);
    const rows = await db.store_profile.toArray();
    check('gộp còn đúng 1 hồ sơ', rows.length === 1, rows.length);
    check("uuid = 'default'", rows[0].uuid === 'default', rows[0].uuid);
    check('giữ hồ sơ được sửa gần nhất', rows[0].storeName === 'Quán B', rows[0].storeName);
    check('đánh dấu _dirty để đẩy lên máy chủ', rows[0]._dirty === 1, rows[0]._dirty);
    check('giao dịch cũ không mất', (await db.transactions.count()) === 1);
    db.close();
  }
}

console.log('\n=== 3. Cài mới hoàn toàn ===');
{
  const db = await freshDb(null);
  check('mở được, không lỗi', true);
  check('seed sẵn 3 mẫu chi nhanh', (await db.expense_presets.count()) === 3, await db.expense_presets.count());
  const presets = await db.expense_presets.toArray();
  check('uuid mẫu chi khớp seed của schema.sql',
    presets.every(p => String(p.uuid).startsWith('seed-preset-')), presets.map(p => p.uuid));
  db.close();
}

console.log(`\n${failures === 0 ? '✅ TẤT CẢ ĐỀU PASS' : `❌ ${failures} THẤT BẠI`}\n`);
process.exit(failures === 0 ? 0 : 1);
