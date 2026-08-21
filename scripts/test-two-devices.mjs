// Kiểm thử đúng câu hỏi gốc: hai thiết bị đăng nhập một tài khoản có thấy cùng
// một sổ không.
//
// Chạy (cần máy chủ cục bộ, giống test:api):
//   npx wrangler pages dev --port 8788
//   npm run test:devices
//
// Khác test:sync ở chỗ KHÔNG có máy chủ giả: nó gọi thẳng authService và
// syncService thật vào Pages Functions thật trên D1 thật. Đây là bài duy nhất
// chứng minh hai nửa client và máy chủ khớp nhau — mỗi nửa xanh riêng vẫn có
// thể lệch nhau ở tên cột hay hình dạng phản hồi.
//
// "Thiết bị thứ hai" được mô phỏng bằng cách xoá sạch IndexedDB và phiên đăng
// nhập rồi đăng nhập lại. Máy chủ không biết khác biệt: với nó đó đúng là một
// máy mới tinh chưa có con trỏ đồng bộ nào.

import 'fake-indexeddb/auto';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8788';

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail !== undefined ? '\n        ' + JSON.stringify(detail) : ''}`); }
};

// apiClient gọi bằng đường dẫn tương đối như trong trình duyệt; Node thì cần
// URL tuyệt đối.
const rawFetch = globalThis.fetch;
globalThis.fetch = (url, init) =>
  rawFetch(String(url).startsWith('/') ? BASE + url : url, init);

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};

const { db, seedInitialData } = await import('../src/services/db.js');
const { authService } = await import('../src/services/authService.js');
const syncService = await import('../src/services/syncService.js');
const { storageService } = await import('../src/services/storageService.js');
const { storeProfileService } = await import('../src/services/storeProfileService.js');

// Một "máy mới": không dữ liệu cục bộ, không phiên đăng nhập, không con trỏ.
async function wipeDevice() {
  store.clear();
  await db.delete();
  await db.open();
  await seedInitialData();
}

// Tài khoản riêng cho lần chạy này để chạy lại nhiều lần không đụng nhau.
// Máy chủ chỉ cho đăng ký tự do khi bảng users còn rỗng, nên nếu D1 đã có chủ
// thì bài test dùng luôn tài khoản mặc định của lần chạy trước.
const owner = { username: 'chuquan_test', fullName: 'Chủ Quán Test', password: 'matkhau123' };

async function signIn() {
  try {
    return await authService.loginWithPassword(owner.username, owner.password);
  } catch {
    return await authService.registerUser({ ...owner, confirmPassword: owner.password });
  }
}

const stamp = Date.now();
const noteA = `máy A ${stamp}`;
const noteB = `máy B ${stamp}`;
const storeName = `Quán Test ${stamp}`;

// ═════════════════════════════════════════════════════════
console.log('\n=== MÁY A: đăng nhập, ghi sổ, đồng bộ lên ===');
{
  await wipeDevice();
  const session = await signIn();
  check('đăng nhập được vào máy chủ', !!session?.token, session?.user);
  check('phiên KHÔNG ở chế độ ngoại tuyến', !session?.offline, session?.offline);

  await storageService.addTransaction({
    type: 'OUT', category_id: 4, category_name: 'Trái cây / Hoa quả',
    amount: 175000, payment_source: 'CASH', note: noteA, transaction_date: '2026-08-21'
  });
  await storeProfileService.updateProfile({ storeName });

  const result = await syncService.runSync();
  check('vòng đồng bộ của máy A không lỗi', !result.error, result.error);
  check('máy A đã đẩy dữ liệu lên', result.pushed > 0, result);
}

// ═════════════════════════════════════════════════════════
console.log('\n=== MÁY B: máy khác, cùng tài khoản, phải thấy sổ của máy A ===');
{
  await wipeDevice();

  const beforeLogin = await storageService.getTransactions({});
  check('máy B khởi đầu với sổ trống', beforeLogin.length === 0, beforeLogin.length);

  const session = await signIn();
  check('đăng nhập được bằng CHÍNH tài khoản đó ở máy khác', !!session?.token, session?.user?.username);

  await syncService.runSync();

  const rows = await storageService.getTransactions({});
  check('máy B thấy giao dịch máy A vừa ghi', rows.some(t => t.note === noteA),
        rows.map(t => t.note));

  const profile = await storeProfileService.getProfile();
  check('máy B thấy tên quán máy A vừa đặt', profile?.storeName === storeName, profile?.storeName);

  // Máy B ghi thêm để kiểm chiều ngược lại.
  await storageService.addTransaction({
    type: 'IN', category_id: 1, category_name: 'Doanh thu nước ép',
    amount: 90000, payment_source: 'BANK', note: noteB, transaction_date: '2026-08-21'
  });
  const back = await syncService.runSync();
  check('máy B đẩy được thay đổi của mình lên', back.pushed > 0, back);
}

// ═════════════════════════════════════════════════════════
console.log('\n=== MÁY C: máy thứ ba phải thấy đủ cả hai chiều ===');
{
  await wipeDevice();
  await signIn();
  await syncService.runSync();

  const rows = await storageService.getTransactions({});
  check('thấy giao dịch của máy A', rows.some(t => t.note === noteA), rows.length);
  check('thấy giao dịch của máy B', rows.some(t => t.note === noteB), rows.length);

  const a = rows.filter(t => t.note === noteA);
  const b = rows.filter(t => t.note === noteB);
  check('không nhân bản giao dịch của máy A', a.length === 1, a.length);
  check('không nhân bản giao dịch của máy B', b.length === 1, b.length);

  // Đồng bộ lần nữa không được đổi gì — đây là chốt chặn cho vòng lặp đẩy/kéo
  // bất tận: một dòng bị hiểu sai sẽ liên tục được coi là "mới" ở mỗi vòng.
  await syncService.runSync();
  const again = await storageService.getTransactions({});
  check('đồng bộ lại không sinh thêm dòng nào', again.length === rows.length,
        [rows.length, again.length]);

  const dirty = [];
  for (const table of ['transactions', 'daily_cash_records', 'quick_notes', 'expense_presets', 'store_profile']) {
    const n = await db[table].filter(r => r._dirty === 1).count();
    if (n) dirty.push([table, n]);
  }
  check('không còn dòng nào chờ đẩy', dirty.length === 0, dirty);
}

// ═════════════════════════════════════════════════════════
console.log('\n=== Ngoại tuyến: vẫn ghi được, có mạng lại thì tự lên ===');
{
  await wipeDevice();
  await signIn();
  await syncService.runSync();

  const offlineNote = `ghi lúc mất mạng ${stamp}`;
  globalThis.fetch = () => Promise.reject(new TypeError('mô phỏng mất mạng'));

  await storageService.addTransaction({
    type: 'OUT', category_id: 6, category_name: 'Đá lạnh',
    amount: 20000, payment_source: 'CASH', note: offlineNote, transaction_date: '2026-08-21'
  });
  const failed = await syncService.runSync();
  check('mất mạng được báo đúng loại lỗi, không phải lỗi lạ', failed.kind === 'offline', failed);

  const local = await storageService.getTransactions({});
  check('giao dịch vẫn nằm nguyên trên máy', local.some(t => t.note === offlineNote), local.length);

  // Có mạng lại.
  globalThis.fetch = (url, init) =>
    rawFetch(String(url).startsWith('/') ? BASE + url : url, init);

  const recovered = await syncService.runSync();
  check('có mạng lại thì đẩy lên được', recovered.pushed > 0, recovered);

  await wipeDevice();
  await signIn();
  await syncService.runSync();
  const elsewhere = await storageService.getTransactions({});
  check('máy khác nhận được giao dịch ghi lúc mất mạng',
        elsewhere.some(t => t.note === offlineNote), elsewhere.length);
}

console.log(failures === 0 ? '\n✅ TẤT CẢ ĐỀU PASS\n' : `\n❌ ${failures} kiểm tra THẤT BẠI\n`);
process.exit(failures === 0 ? 0 : 1);
