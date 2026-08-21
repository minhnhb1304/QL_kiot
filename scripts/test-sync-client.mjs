// Kiểm thử vòng đồng bộ phía client bằng CHÍNH src/services/syncService.js.
//
// Chạy: npm run test:sync
//
// Vì sao đáng có: các luật hợp nhất ở đây chỉ sai khi có hai thiết bị và dữ
// liệu có sẵn từ trước — đúng những điều kiện mà `npm run dev` trên một máy
// sạch không bao giờ tạo ra. Sai thì hậu quả là mất sổ của quán, không phải một
// nút bấm hỏng. Ba cái bẫy được nhắm thẳng:
//
//   1. Hồ sơ cửa hàng RỖNG của máy vừa cài đè mất hồ sơ thật trên máy chủ.
//   2. Hai máy cùng chốt sổ một ngày → hai uuid, một `date` → ConstraintError
//      của chỉ mục &date làm hỏng cả vòng đồng bộ.
//   3. Dữ liệu có sẵn trên máy mang _dirty = 0 (do bước nâng cấp v9) nên không
//      bao giờ được đẩy lên, im lặng ở lại một máy.
//
// Máy chủ ở đây là bản mô phỏng trong bộ nhớ, KHÔNG phải functions/api/sync.js.
// Nó chỉ dựng lại đúng phần hợp đồng mà client dựa vào (server_seq tăng dần,
// last-write-wins theo updated_at, hợp nhất daily_cash_records theo date). Bản
// thật được kiểm bởi scripts/test-sync-api.mjs chạy trên wrangler.

import 'fake-indexeddb/auto';

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail !== undefined ? '\n        ' + JSON.stringify(detail) : ''}`); }
};

// ─────────────────────────────────────────────────────────
// localStorage giả — apiClient đọc phiên đăng nhập từ đây
// ─────────────────────────────────────────────────────────
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
store.set('jl_auth_session', JSON.stringify({ user: { username: 'chuquan' }, token: 'token-test' }));

// ─────────────────────────────────────────────────────────
// Máy chủ mô phỏng
// ─────────────────────────────────────────────────────────
const PULL_TABLES = ['categories', 'transactions', 'daily_cash_records', 'quick_notes', 'expense_presets', 'store_profile'];

function makeServer() {
  const tables = Object.fromEntries(PULL_TABLES.map(t => [t, []]));
  let lastSeq = 0;

  // Dòng dựng sẵn vẫn phải tiêu một số thứ tự. Máy chủ thật cấp server_seq từ
  // sync_state.last_seq và không bao giờ cấp lại một số đã dùng; quên nâng bộ
  // đếm ở đây thì dòng đẩy lên sau đó nhận trùng số và biến mất khỏi lượt kéo.
  function seed(table, row, { seq = ++lastSeq } = {}) {
    lastSeq = Math.max(lastSeq, seq);
    tables[table].push({ deleted: 0, updated_at: 0, created_at: 0, ...row, server_seq: seq });
  }

  // Máy KIA vừa sửa dòng này: đổi nội dung và cấp cho nó số thứ tự mới.
  function touch(table, uuid, patch) {
    const row = tables[table].find(r => r.uuid === uuid);
    Object.assign(row, patch, { server_seq: ++lastSeq });
  }

  function upsert(table, row) {
    const rows = tables[table];
    let idx = rows.findIndex(r => r.uuid === row.uuid);
    // Máy chủ thật hợp nhất bảng này theo `date`, không theo uuid.
    if (idx === -1 && table === 'daily_cash_records' && row.date != null) {
      idx = rows.findIndex(r => r.date === row.date);
    }

    const seq = ++lastSeq;   // bộ đếm bị tiêu tốn kể cả khi bản ghi bị bỏ qua

    if (idx === -1) {
      rows.push({ ...row, server_seq: seq });
      return;
    }
    const existing = rows[idx];
    if ((row.updated_at || 0) > (existing.updated_at || 0)) {
      // uuid là danh tính trên máy chủ, không bao giờ bị ghi đè; `date` cũng vậy.
      const keep = { uuid: existing.uuid };
      if (table === 'daily_cash_records') keep.date = existing.date;
      rows[idx] = { ...existing, ...row, ...keep, server_seq: seq };
    }
  }

  function handle(body) {
    let pushed = 0;
    for (const [table, rows] of Object.entries(body.changes || {})) {
      if (!tables[table] || table === 'categories') continue;
      for (const row of rows) { upsert(table, row); pushed++; }
    }

    const since = Number.isInteger(body.since) && body.since >= -1 ? body.since : -1;
    const changes = {};
    let maxSeq = Math.max(since, 0);
    for (const table of PULL_TABLES) {
      const hit = tables[table].filter(r => r.server_seq > since).sort((a, b) => a.server_seq - b.server_seq);
      if (!hit.length) continue;
      changes[table] = hit.map(r => ({ ...r }));
      maxSeq = Math.max(maxSeq, hit[hit.length - 1].server_seq);
    }
    return { pushed, cursor: maxSeq, hasMore: false, changes };
  }

  return { tables, seed, touch, handle, get lastSeq() { return lastSeq; } };
}

let server;
let requests = 0;

globalThis.fetch = async (path, init = {}) => {
  requests++;
  if (!String(path).startsWith('/api/sync')) {
    return { ok: false, status: 404, json: async () => ({ error: 'không có route' }) };
  }
  const body = JSON.parse(init.body || '{}');
  const result = server.handle(body);
  return { ok: true, status: 200, json: async () => result };
};

// ─────────────────────────────────────────────────────────
// Nạp module thật
// ─────────────────────────────────────────────────────────
const { db, seedInitialData } = await import('../src/services/db.js');
const syncService = await import('../src/services/syncService.js');

// Mỗi kịch bản cần database sạch. Xoá rồi mở lại chính instance đó thay vì nạp
// lại module: syncService giữ tham chiếu tới đúng instance này, nạp bản mới sẽ
// làm hai bên trỏ vào hai database khác nhau và test cho kết quả vô nghĩa.
async function freshDb() {
  await db.delete();
  await db.open();
  await seedInitialData();
  server = makeServer();
}

const now = Date.now();
const tx = (over = {}) => ({
  type: 'OUT', category_id: 4, category_name: 'Trái cây / Hoa quả', amount: 100000,
  payment_source: 'CASH', note: '', transaction_date: '2026-08-20',
  created_at: now, updated_at: now, deleted: 0, _dirty: 0, server_seq: 0, ...over
});

// ═════════════════════════════════════════════════════════
console.log('\n=== 1. Vòng đầu: sổ có sẵn trên máy phải lên được máy chủ ===');
{
  await freshDb();
  // Dữ liệu có từ trước khi bật đồng bộ: _dirty = 0 vì bước nâng cấp v9 đặt vậy.
  await db.transactions.bulkAdd([
    tx({ uuid: 'cu-1', note: 'giao dịch cũ 1' }),
    tx({ uuid: 'cu-2', note: 'giao dịch cũ 2' })
  ]);

  await syncService.runSync();

  const onServer = server.tables.transactions.map(r => r.uuid).sort();
  check('hai giao dịch cũ đã lên máy chủ', JSON.stringify(onServer) === '["cu-1","cu-2"]', onServer);

  const local = await db.transactions.toArray();
  check('cờ _dirty đã được xoá sau khi đẩy', local.every(r => r._dirty === 0), local.map(r => r._dirty));
  check('server_seq đã ghi về máy', local.every(r => r.server_seq > 0), local.map(r => r.server_seq));
}

// ═════════════════════════════════════════════════════════
console.log('\n=== 2. Hồ sơ cửa hàng rỗng của máy mới KHÔNG được đè hồ sơ thật ===');
{
  await freshDb();
  // Máy chủ đang giữ hồ sơ thật của quán.
  server.seed('store_profile', {
    uuid: 'default', store_name: 'Quán Nước Ép Cô Ba', store_slogan: 'Tươi mỗi ngày',
    store_address: '12 Lê Lợi', store_phone: '0901234567', currency: 'VND',
    monthly_revenue_goal: 30000000, financial_month_start_day: 1,
    updated_at: 5_000, created_at: 5_000
  });

  // Máy vừa cài: hồ sơ rỗng, updated_at là BÂY GIỜ — mới hơn hẳn máy chủ.
  const before = await db.store_profile.where('uuid').equals('default').first();
  check('máy mới đúng là đang có hồ sơ rỗng', !before.storeName, before.storeName);

  await syncService.runSync();

  const after = await db.store_profile.where('uuid').equals('default').first();
  check('máy đã nhận tên quán thật', after.storeName === 'Quán Nước Ép Cô Ba', after.storeName);
  check('nhận cả mục tiêu doanh thu', after.monthlyRevenueGoal === 30000000, after.monthlyRevenueGoal);
  check('máy chủ vẫn giữ tên quán thật', server.tables.store_profile[0].store_name === 'Quán Nước Ép Cô Ba',
        server.tables.store_profile[0].store_name);
}

// ═════════════════════════════════════════════════════════
console.log('\n=== 3. Hồ sơ thật trên máy phải thắng hồ sơ seed rỗng của máy chủ ===');
{
  await freshDb();
  // Máy chủ chỉ có dòng seed: schema.sql chèn ('default') với updated_at = 0.
  server.seed('store_profile', { uuid: 'default', store_name: '', updated_at: 0 });

  const row = await db.store_profile.where('uuid').equals('default').first();
  await db.store_profile.update(row.id, {
    storeName: 'Quán Nước Ép Cô Ba', updated_at: 9_000, _dirty: 1
  });

  await syncService.runSync();

  const after = await db.store_profile.where('uuid').equals('default').first();
  check('tên quán trên máy không bị dòng seed xoá', after.storeName === 'Quán Nước Ép Cô Ba', after.storeName);
  check('tên quán đã lên máy chủ', server.tables.store_profile[0].store_name === 'Quán Nước Ép Cô Ba',
        server.tables.store_profile[0].store_name);
}

// ═════════════════════════════════════════════════════════
console.log('\n=== 4. Hai máy chốt sổ cùng một ngày: hai uuid, một dòng ===');
{
  await freshDb();
  // Máy chủ đã có bản chốt của máy A cho ngày 2026-08-20.
  server.seed('daily_cash_records', {
    uuid: 'may-A', date: '2026-08-20', opening_cash: 500000, closing_cash: 900000,
    total_cash: 400000, note: 'máy A', updated_at: 8_000
  });

  // Máy B chốt sổ cùng ngày khi đang ngoại tuyến → uuid khác hẳn.
  await db.daily_cash_records.add({
    uuid: 'may-B', date: '2026-08-20', opening_cash: 500000, closing_cash: 950000,
    total_cash: 450000, note: 'máy B', created_at: 7_000, updated_at: 7_000,
    deleted: 0, _dirty: 1, server_seq: 0
  });

  const result = await syncService.runSync();
  check('vòng đồng bộ không ném lỗi', !result.error, result.error);

  const rows = await db.daily_cash_records.toArray();
  check('chỉ còn đúng một dòng cho ngày đó', rows.length === 1, rows.length);
  check('dòng đó đã nhận uuid của máy chủ', rows[0]?.uuid === 'may-A', rows[0]?.uuid);
  check('giữ bản chốt mới hơn của máy chủ', rows[0]?.closing_cash === 900000, rows[0]?.closing_cash);
}

// ═════════════════════════════════════════════════════════
console.log('\n=== 5. Sửa cục bộ mới hơn thì thắng dữ liệu kéo về ===');
{
  await freshDb();
  server.seed('transactions', { uuid: 'chung', ...tx({ note: 'bản máy chủ', amount: 100000 }), updated_at: 1_000 });

  await db.transactions.add(tx({ uuid: 'chung', note: 'bản của tôi', amount: 250000, updated_at: 9_000, _dirty: 1 }));

  await syncService.runSync();

  const row = await db.transactions.where('uuid').equals('chung').first();
  check('bản sửa cục bộ không bị ghi đè', row.amount === 250000, row.amount);
  check('bản sửa cục bộ đã lên máy chủ', server.tables.transactions[0].amount === 250000,
        server.tables.transactions[0].amount);
  check('cờ _dirty đã được xoá', row._dirty === 0, row._dirty);
}

// ═════════════════════════════════════════════════════════
console.log('\n=== 6. Lệnh xoá lan được sang máy kia ===');
{
  await freshDb();
  await db.transactions.add(tx({ uuid: 'se-bi-xoa', note: 'sẽ bị xoá' }));
  await syncService.runSync();
  check('đã đẩy lên trước khi xoá', server.tables.transactions.length === 1, server.tables.transactions.length);

  // Máy kia xoá mềm dòng này.
  server.touch('transactions', 'se-bi-xoa', { deleted: 1, updated_at: Date.now() + 1000 });

  await syncService.runSync();

  const row = await db.transactions.where('uuid').equals('se-bi-xoa').first();
  check('máy này đã nhận tombstone', row.deleted === 1, row.deleted);

  const { storageService } = await import('../src/services/storageService.js');
  const visible = await storageService.getTransactions({});
  check('giao dịch đã xoá không còn hiện trong sổ', !visible.some(t => t.uuid === 'se-bi-xoa'),
        visible.map(t => t.uuid));
}

// ═════════════════════════════════════════════════════════
console.log('\n=== 7. Con trỏ chỉ tiến, không kéo lại từ đầu ===');
{
  await freshDb();
  await db.transactions.add(tx({ uuid: 'a-1' }));
  await syncService.runSync();

  const cursorAfterFirst = await syncService.getCursor();
  check('con trỏ đã được lưu', typeof cursorAfterFirst === 'number' && cursorAfterFirst > 0, cursorAfterFirst);

  const before = requests;
  await syncService.runSync();
  const cursorAfterSecond = await syncService.getCursor();

  check('con trỏ không tụt lại', cursorAfterSecond >= cursorAfterFirst, [cursorAfterFirst, cursorAfterSecond]);
  check('vòng rỗng chỉ tốn một lượt gọi', requests - before === 1, requests - before);

  const rows = await db.transactions.where('uuid').equals('a-1').toArray();
  check('không sinh bản trùng khi đồng bộ lại', rows.length === 1, rows.length);
}

console.log(failures === 0 ? '\n✅ TẤT CẢ ĐỀU PASS' : `\n❌ ${failures} kiểm tra THẤT BẠI`);
process.exit(failures === 0 ? 0 : 1);
