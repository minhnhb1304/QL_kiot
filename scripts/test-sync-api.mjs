// Kiểm thử end-to-end các endpoint /api trên một D1 ĐÃ MIGRATE.
//
// Cách chạy (bốn bước, từ thư mục gốc dự án):
//
//   1. Dựng lại D1 cục bộ đúng như production TRƯỚC khi migrate:
//        rm -rf .wrangler/state
//        npx wrangler d1 execute juice-db --local --file=./scripts/rehearse-old-schema.sql
//   2. Migrate rồi áp lược đồ mới — ĐÚNG thứ tự này:
//        npx wrangler d1 execute juice-db --local --file=./migrations/0001_cloud_sync.sql
//        npx wrangler d1 execute juice-db --local --file=./schema.sql
//   3. npx wrangler pages dev --port 8788
//   4. npm run test:api
//
// Bài kiểm tra giả định đúng 5 giao dịch mẫu từ bước 1. Muốn chạy lại thì làm
// lại từ bước 1 — nó có ghi dữ liệu, không idempotent.
//
// Trỏ sang preview deployment: BASE_URL=https://<preview>.pages.dev npm run test:api
// (khi đó phải bỏ qua các mốc đếm số dòng ở mục 1 và 4).
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8788';
let failures = 0;

// /api/sync và /api/transactions giờ nằm sau cổng xác thực (shared/auth.js).
// Bọc fetch đúng một lần thay vì sửa từng lời gọi: sửa tay thì chỉ cần bỏ sót
// một chỗ là cả bài test đỏ vì 401 chứ không phải vì lỗi thật.
//
// rawFetch giữ lại để gọi KHÔNG kèm xác thực — chính là thứ mục 0 cần kiểm.
const rawFetch = globalThis.fetch;
let authHeader = {};
globalThis.fetch = (url, init = {}) =>
  rawFetch(url, String(url).startsWith(BASE)
    ? { ...init, headers: { ...authHeader, ...(init.headers || {}) } }
    : init);

const post = (path, body, headers = {}) =>
  fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  }).then(async r => ({ status: r.status, body: await r.json() }));

function check(name, cond, detail) {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? '\n        ' + JSON.stringify(detail) : ''}`); }
}

const uuid = () => crypto.randomUUID();
const now = () => Date.now();

console.log('\n=== 0. Xác thực: đăng ký, đăng nhập, khoá endpoint ===');
{
  const rawPost = (path, body, headers = {}) =>
    rawFetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  // Chưa có tài khoản nào → người cài app đầu tiên nhận quán và thành OWNER.
  const owner = { username: 'chuquan_test', fullName: 'Chủ Quán Test', password: 'matkhau123' };
  const reg = await rawPost('/api/auth/register', { ...owner, confirmPassword: owner.password });
  const alreadySetUp = reg.status === 409 || reg.body?.code === 'registration_closed';

  if (alreadySetUp) {
    console.log('  SKIP  đã có tài khoản từ lần chạy trước — chỉ kiểm đăng nhập');
  } else {
    check('đăng ký chủ quán đầu tiên thành công', reg.status === 200 && !!reg.body.token, reg);
    check('người đầu tiên luôn là OWNER', reg.body?.user?.role === 'OWNER', reg.body?.user);
    check('máy chủ không trả về bất kỳ cột mật khẩu nào',
      !!reg.body?.user && !('password_hash' in reg.body.user) && !('password_salt' in reg.body.user),
      Object.keys(reg.body?.user || {}));
  }

  // Từ người thứ hai trở đi phải có phiên OWNER. Không token → 403.
  const stranger = await rawPost('/api/auth/register', {
    username: 'nguoila', fullName: 'Người Lạ', password: 'matkhau123', confirmPassword: 'matkhau123'
  });
  check('người lạ không tự đăng ký được', stranger.status === 403, stranger);

  const wrong = await rawPost('/api/auth/login', { username: owner.username, password: 'sai-be-bet' });
  check('sai mật khẩu bị từ chối', wrong.status === 401 && wrong.body.code === 'invalid_credentials', wrong);

  const unknown = await rawPost('/api/auth/login', { username: 'khong-ton-tai', password: 'matkhau123' });
  check('tài khoản không tồn tại phân biệt được với sai mật khẩu',
    unknown.status === 401 && unknown.body.code === 'user_not_found', unknown);

  const login = await rawPost('/api/auth/login', { username: owner.username, password: owner.password });
  check('đăng nhập đúng mật khẩu thành công', login.status === 200 && !!login.body.token, login);

  const token = login.body?.token;

  // Giờ đã có tài khoản → cửa phải đóng với mọi lời gọi không xác thực.
  const bare = await rawPost('/api/sync', { since: -1, changes: {} });
  check('/api/sync từ chối lời gọi không xác thực', bare.status === 401, bare);

  const bareGet = await rawFetch(BASE + '/api/transactions');
  check('/api/transactions từ chối lời gọi không xác thực', bareGet.status === 401, bareGet.status);

  const withToken = await rawPost('/api/sync', { since: -1, changes: {} }, { Authorization: `Bearer ${token}` });
  check('/api/sync chấp nhận phiên đăng nhập', withToken.status === 200, withToken.status);

  const me = await rawFetch(BASE + '/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  check('/api/auth/me xác nhận phiên còn sống', me.status === 200, me.status);

  const meBad = await rawFetch(BASE + '/api/auth/me', { headers: { Authorization: 'Bearer khong-phai-token' } });
  check('token bịa bị từ chối', meBad.status === 401, meBad.status);

  // Các mục sau dùng x-sync-secret nếu có (đường máy-với-máy), ngược lại dùng
  // chính phiên vừa đăng nhập.
  authHeader = process.env.SYNC_SECRET
    ? { 'x-sync-secret': process.env.SYNC_SECRET }
    : { Authorization: `Bearer ${token}` };
}

console.log('\n=== 1. GET /api/transactions (lược đồ uuid) ===');
{
  const r = await fetch(BASE + '/api/transactions');
  const rows = await r.json();
  check('trả 200', r.status === 200, rows);
  check('có 5 dòng đã migrate', Array.isArray(rows) && rows.length === 5, rows.length);
  check('mỗi dòng có uuid, không có id', rows.every(x => typeof x.uuid === 'string' && x.id === undefined));
  check('có server_seq', rows.every(x => typeof x.server_seq === 'number'));
}

console.log('\n=== 2. POST /api/webhook/sms — chống ghi trùng ===');
const smsPayload = { sender: 'SACOMBANK', message: 'TK 0601 +75,000VND luc 14:22 SD 1,240,000VND' };
{
  const a = await post('/api/webhook/sms', smsPayload);
  const b = await post('/api/webhook/sms', smsPayload);
  check('lần 1 ghi thành công', a.status === 200 && a.body.success && !a.body.duplicate, a.body);
  check('lần 1 trả uuid', typeof a.body.uuid === 'string', a.body);
  check('lần 2 bị nhận diện trùng', b.status === 200 && b.body.duplicate === true, b.body);

  const rows = await fetch(BASE + '/api/transactions').then(r => r.json());
  const matches = rows.filter(x => x.amount === 75000);
  check('chỉ có ĐÚNG 1 dòng 75.000đ trong sổ', matches.length === 1, matches.length);
  check('dòng mới có server_seq > 0', matches[0]?.server_seq > 0, matches[0]);
}

console.log('\n=== 3. POST /api/webhook/bank + bank-direct ===');
{
  const a = await post('/api/webhook/bank', { id: 'SEPAY-991', transferAmount: 50000, content: 'CK QR' });
  const b = await post('/api/webhook/bank', { id: 'SEPAY-991', transferAmount: 50000, content: 'CK QR' });
  check('bank: lần 1 ghi', a.body.success && !a.body.duplicate, a.body);
  check('bank: lần 2 trùng', b.body.duplicate === true, b.body);

  const c = await post('/api/webhook/bank-direct', { transactionId: 'MB-77', amount: 60000, creditDebit: 'CR', description: 'VietQR' });
  const d = await post('/api/webhook/bank-direct', { transactionId: 'MB-77', amount: 60000, creditDebit: 'CR', description: 'VietQR' });
  check('bank-direct: responseCode 00', c.body.responseCode === '00' && !c.body.duplicate, c.body);
  check('bank-direct: lần 2 trùng vẫn trả 00', d.body.responseCode === '00' && d.body.duplicate === true, d.body);
}

console.log('\n=== 4. POST /api/sync — kéo toàn bộ từ con trỏ -1 ===');
let cursor;
{
  const r = await post('/api/sync', { since: -1, changes: {} });
  check('trả 200', r.status === 200, r.body);
  cursor = r.body.cursor;
  const ch = r.body.changes || {};
  check('kéo được categories (server_seq = 0, seed)', (ch.categories || []).length === 10, (ch.categories || []).length);
  check('kéo được expense_presets seed', (ch.expense_presets || []).length === 3, (ch.expense_presets || []).length);
  check('kéo được store_profile default', (ch.store_profile || []).length === 1, (ch.store_profile || []).length);
  check('kéo được transactions', (ch.transactions || []).length === 8, (ch.transactions || []).length);
  check('cursor > 0', cursor > 0, cursor);
  check('hasMore = false', r.body.hasMore === false, r.body.hasMore);

  const r2 = await post('/api/sync', { since: cursor, changes: {} });
  check('kéo lại từ cursor → rỗng', Object.keys(r2.body.changes || {}).length === 0, r2.body.changes);
  check('cursor giữ nguyên', r2.body.cursor === cursor, r2.body.cursor);
}

console.log('\n=== 5. Đẩy dòng mới + nhận lại server_seq ===');
const txUuid = uuid();
const t0 = now();
{
  const r = await post('/api/sync', {
    since: cursor,
    changes: {
      transactions: [{
        uuid: txUuid, type: 'OUT', category_id: 4, category_name: 'Trái cây / Hoa quả',
        amount: 180000, payment_source: 'CASH', note: 'Mua cam sáng',
        transaction_date: '2026-08-19', created_at: t0, updated_at: t0, deleted: 0, _dirty: 1, server_seq: 0
      }]
    }
  });
  check('pushed = 1', r.body.pushed === 1, r.body);
  const back = (r.body.changes?.transactions || []).find(x => x.uuid === txUuid);
  check('dòng vừa đẩy quay về trong cùng phản hồi', !!back, r.body.changes);
  check('được gán server_seq > cursor cũ', back?.server_seq > cursor, back);
  check('cột _dirty của client KHÔNG lọt vào D1', back && back._dirty === undefined, back);
  cursor = r.body.cursor;
}

console.log('\n=== 6. Last-write-wins ===');
{
  // Bản CŨ hơn: phải bị bỏ qua
  await post('/api/sync', {
    since: cursor,
    changes: { transactions: [{
      uuid: txUuid, type: 'OUT', category_id: 4, category_name: 'Trái cây / Hoa quả',
      amount: 999999, payment_source: 'CASH', note: 'GHI DE CU',
      transaction_date: '2026-08-19', created_at: t0, updated_at: t0 - 5000, deleted: 0
    }] }
  });
  let rows = await fetch(BASE + '/api/transactions').then(r => r.json());
  let row = rows.find(x => x.uuid === txUuid);
  check('bản updated_at cũ hơn bị từ chối', row?.amount === 180000, row);

  // Bản MỚI hơn: phải thắng
  await post('/api/sync', {
    since: cursor,
    changes: { transactions: [{
      uuid: txUuid, type: 'OUT', category_id: 4, category_name: 'Trái cây / Hoa quả',
      amount: 210000, payment_source: 'CASH', note: 'Sua lai gia cam',
      transaction_date: '2026-08-19', created_at: t0, updated_at: t0 + 5000, deleted: 0
    }] }
  });
  rows = await fetch(BASE + '/api/transactions').then(r => r.json());
  row = rows.find(x => x.uuid === txUuid);
  check('bản updated_at mới hơn thắng', row?.amount === 210000, row);
}

console.log('\n=== 7. Tombstone (xóa mềm lan sang máy khác) ===');
{
  const r = await post('/api/sync', {
    since: cursor,
    changes: { transactions: [{
      uuid: txUuid, type: 'OUT', category_id: 4, category_name: 'Trái cây / Hoa quả',
      amount: 210000, payment_source: 'CASH', note: 'Sua lai gia cam',
      transaction_date: '2026-08-19', created_at: t0, updated_at: now() + 10000, deleted: 1
    }] }
  });
  const back = (r.body.changes?.transactions || []).find(x => x.uuid === txUuid);
  check('tombstone quay về trong lượt kéo', back?.deleted === 1, back);

  const rows = await fetch(BASE + '/api/transactions').then(r => r.json());
  check('GET /api/transactions đã lọc dòng bị xóa', !rows.some(x => x.uuid === txUuid), rows.length);
  cursor = r.body.cursor;
}

console.log('\n=== 8. daily_cash_records — hợp nhất theo date, không theo uuid ===');
{
  // Hai "thiết bị" cùng chốt sổ ngày 2026-08-19 với hai uuid khác nhau.
  const uuidA = uuid(), uuidB = uuid();
  const base = { date: '2026-08-19', opening_cash: 500000, closing_cash: 900000, total_cash: 400000, note: 'May A' };
  const r1 = await post('/api/sync', { since: cursor, changes: { daily_cash_records: [{ uuid: uuidA, ...base, created_at: t0, updated_at: t0, deleted: 0 }] } });
  check('máy A ghi được', r1.status === 200, r1.body);

  const r2 = await post('/api/sync', {
    since: cursor,
    changes: { daily_cash_records: [{ uuid: uuidB, ...base, note: 'May B', closing_cash: 950000, created_at: t0, updated_at: t0 + 1000, deleted: 0 }] }
  });
  check('máy B không làm hỏng cả lô (UNIQUE date)', r2.status === 200, r2.body);

  const all = await post('/api/sync', { since: -1, changes: {} });
  const recs = (all.body.changes?.daily_cash_records || []).filter(x => x.date === '2026-08-19');
  check('chỉ còn ĐÚNG 1 bản ghi cho ngày đó', recs.length === 1, recs);
  check('giữ uuid của máy A (ghi trước)', recs[0]?.uuid === uuidA, recs[0]);
  check('nội dung mới hơn của máy B thắng', recs[0]?.closing_cash === 950000 && recs[0]?.note === 'May B', recs[0]);
  cursor = all.body.cursor;
}

console.log('\n=== 9. Kiểm tra đầu vào ===');
{
  const a = await post('/api/sync', { since: 0, changes: { transactions: [{ type: 'IN', amount: 1 }] } });
  check('thiếu uuid → 400', a.status === 400, a);

  const b = await post('/api/sync', { since: 0, changes: { transactions: [{ uuid: uuid(), type: 'IN' }] } });
  check('thiếu cột bắt buộc → 400', b.status === 400 && /thiếu/.test(b.body.error || ''), b);

  const c = await post('/api/sync', { since: 0, changes: { categories: [{ id: 1, uuid: 'x', name: 'HACKED' }] } });
  check('đẩy categories bị bỏ qua (bảng chỉ-kéo)', c.status === 200 && c.body.pushed === 0, c.body);
  const cats = (await post('/api/sync', { since: -1, changes: {} })).body.changes.categories;
  check('tên danh mục không bị đổi', cats.find(x => x.id === 1).name === 'Doanh thu nước ép', cats[0]);

  const d = await post('/api/sync', { since: 0, changes: { quick_notes: Array.from({ length: 201 }, () => ({ uuid: uuid(), text: 'x', updated_at: now() })) } });
  check('vượt 200 dòng → 413', d.status === 413, d.status);
}

console.log('\n=== 10. DELETE /api/transactions?uuid= (xóa mềm) ===');
{
  const rows = await fetch(BASE + '/api/transactions').then(r => r.json());
  const victim = rows[0].uuid;
  const r = await fetch(`${BASE}/api/transactions?uuid=${victim}`, { method: 'DELETE' });
  const b = await r.json();
  check('trả 200', r.status === 200 && b.success, b);

  const after = await fetch(BASE + '/api/transactions').then(r => r.json());
  check('biến mất khỏi danh sách', !after.some(x => x.uuid === victim));

  const pull = await post('/api/sync', { since: cursor, changes: {} });
  const tomb = (pull.body.changes?.transactions || []).find(x => x.uuid === victim);
  check('tombstone lan qua /api/sync', tomb?.deleted === 1, tomb);

  const missing = await fetch(`${BASE}/api/transactions?uuid=khong-ton-tai`, { method: 'DELETE' });
  check('uuid không tồn tại → 404', missing.status === 404, missing.status);
}

console.log(`\n${failures === 0 ? '✅ TẤT CẢ ĐỀU PASS' : `❌ ${failures} KIỂM THỬ THẤT BẠI`}\n`);
process.exit(failures === 0 ? 0 : 1);
