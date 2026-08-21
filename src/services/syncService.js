// Vòng đồng bộ phía client: nửa còn thiếu của functions/api/sync.js.
//
// Một vòng = đẩy các dòng _dirty lên rồi kéo mọi dòng có server_seq > con trỏ
// về, trong đúng một lượt gọi HTTP. Máy chủ trả về cả những dòng vừa nhận, nhờ
// đó client biết server_seq được gán cho mình mà xoá cờ _dirty.
//
// Mọi thao tác ghi vẫn vào Dexie trước và chỉ vào Dexie. Đồng bộ là việc chạy
// nền, hỏng hay chậm đều không được chặn người dùng ghi sổ — quán mất sóng là
// chuyện thường ngày.

import { db } from './db.js';
import { apiFetch, ApiError, getToken } from './apiClient.js';

const CURSOR_KEY = 'cursor';

// Máy chủ nhận tối đa 200 dòng một lượt (MAX_PUSH, functions/api/sync.js:23).
const PUSH_LIMIT = 200;

// Bốn bảng này đặt tên cột ở Dexie trùng khít với D1 nên đi thẳng, không quy đổi.
const DIRECT_TABLES = ['transactions', 'daily_cash_records', 'quick_notes', 'expense_presets'];

// store_profile là ngoại lệ duy nhất: Dexie để camelCase, D1 để snake_case.
// functions/api/sync.js:14-16 nói rõ máy chủ chỉ nói một thứ tiếng, quy đổi là
// việc của client.
const PROFILE_MAP = {
  store_name: 'storeName',
  store_slogan: 'storeSlogan',
  store_logo: 'storeLogo',
  store_address: 'storeAddress',
  store_phone: 'storePhone',
  business_start_date: 'businessStartDate',
  app_start_date: 'appStartDate',
  currency: 'currency',
  monthly_revenue_goal: 'monthlyRevenueGoal',
  financial_month_start_day: 'financialMonthStartDay',
  store_notes: 'storeNotes'
};

const PUSH_TABLES = [...DIRECT_TABLES, 'store_profile'];

// Cột chỉ có ý nghĩa với Dexie, không được gửi lên máy chủ.
const LOCAL_ONLY = ['id', '_dirty'];

// ─────────────────────────────────────────────────────────
// Quy đổi hai chiều
// ─────────────────────────────────────────────────────────
function toServer(table, row) {
  const out = {};
  if (table === 'store_profile') {
    for (const [serverCol, localCol] of Object.entries(PROFILE_MAP)) {
      out[serverCol] = row[localCol] ?? null;
    }
    out.uuid = row.uuid;
    out.created_at = row.created_at ?? 0;
    out.updated_at = row.updated_at ?? 0;
    out.deleted = row.deleted ? 1 : 0;
    return out;
  }

  for (const [key, value] of Object.entries(row)) {
    if (LOCAL_ONLY.includes(key)) continue;
    if (key === 'server_seq') continue;      // máy chủ tự gán, gửi lên là vô nghĩa
    out[key] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
  }
  return out;
}

function toLocal(table, row) {
  if (table === 'store_profile') {
    const out = { uuid: row.uuid };
    for (const [serverCol, localCol] of Object.entries(PROFILE_MAP)) {
      out[localCol] = row[serverCol];
    }
    out.created_at = row.created_at;
    out.updated_at = row.updated_at;
    out.deleted = row.deleted ? 1 : 0;
    out.server_seq = row.server_seq;
    return out;
  }

  const out = { ...row };
  out.deleted = row.deleted ? 1 : 0;
  // SQLite không có kiểu boolean; UI thì kiểm tra is_done kiểu boolean.
  if ('is_done' in out) out.is_done = !!out.is_done;
  return out;
}

// ─────────────────────────────────────────────────────────
// Con trỏ đồng bộ (bảng sync_meta khai báo từ db.js v9, tới giờ chưa ai dùng)
// ─────────────────────────────────────────────────────────
export async function getCursor() {
  const row = await db.sync_meta.get(CURSOR_KEY);
  return row ? row.value : null;
}

async function setCursor(value) {
  await db.sync_meta.put({ key: CURSOR_KEY, value });
}

export async function resetCursor() {
  await db.sync_meta.delete(CURSOR_KEY);
}

// ─────────────────────────────────────────────────────────
// Gom các dòng cần đẩy
// ─────────────────────────────────────────────────────────
async function collectDirty() {
  const changes = {};
  let budget = PUSH_LIMIT;

  for (const table of PUSH_TABLES) {
    if (budget <= 0) break;
    // Lọc bằng filter() chứ không where('_dirty'): chỉ mục trên _dirty tồn tại
    // nhưng các dòng cũ có thể thiếu hẳn khoá này, mà khoá thiếu thì không nằm
    // trong chỉ mục nào cả và sẽ bị bỏ sót.
    const rows = await db[table].filter(r => r._dirty === 1).limit(budget).toArray();
    if (!rows.length) continue;
    changes[table] = rows.map(r => toServer(table, r));
    budget -= rows.length;
  }

  return changes;
}

// ─────────────────────────────────────────────────────────
// Áp dữ liệu kéo về — phần dễ hỏng nhất của toàn bộ tính năng
// ─────────────────────────────────────────────────────────

// Tìm dòng cục bộ tương ứng với một dòng của máy chủ.
//
// daily_cash_records phải tra thêm theo `date`: máy chủ hợp nhất bảng này theo
// date chứ không theo uuid (functions/api/sync.js:44-52), nên hai máy cùng chốt
// sổ một ngày sinh ra hai uuid cho cùng một bản ghi. Không bắt được trường hợp
// đó thì Dexie sẽ ném ConstraintError vì chỉ mục &date (db.js:76) và cả vòng
// đồng bộ hỏng.
async function findLocal(table, serverRow) {
  const byUuid = await db[table].where('uuid').equals(serverRow.uuid).first();
  if (byUuid) return byUuid;

  if (table === 'daily_cash_records' && serverRow.date) {
    return await db[table].where('date').equals(serverRow.date).first() || null;
  }
  return null;
}

async function applyTable(table, rows) {
  let changed = 0;

  for (const serverRow of rows) {
    const incoming = toLocal(table, serverRow);
    const local = await findLocal(table, serverRow);

    if (!local) {
      await db[table].add(incoming);
      changed++;
      continue;
    }

    // Thay đổi của mình chưa đẩy kịp và mới hơn → giữ lại, vòng sau đẩy lên.
    // Không so sánh khi bằng nhau: dòng máy chủ trả về sau một lượt đẩy chính
    // là dòng của mình, lúc đó phải rơi xuống nhánh dưới để xoá cờ _dirty.
    if (local._dirty === 1 && (local.updated_at || 0) > (incoming.updated_at || 0)) {
      // Vẫn nhận uuid của máy chủ nếu khớp theo `date`, nếu không lần đẩy sau
      // lại tạo ra một bản ghi thứ hai cho cùng một ngày.
      if (local.uuid !== incoming.uuid) {
        await db[table].update(local.id, { uuid: incoming.uuid });
        changed++;
      }
      continue;
    }

    // Dòng seed của máy chủ (updated_at = 0, xem schema.sql) không được đè lên
    // dữ liệu thật đã có ở máy. Vẫn ghi server_seq để con trỏ tiến lên.
    if ((incoming.updated_at || 0) === 0 && (local.updated_at || 0) > 0) {
      await db[table].update(local.id, { server_seq: incoming.server_seq });
      continue;
    }

    await db[table].update(local.id, { ...incoming, _dirty: 0 });
    changed++;
  }

  return changed;
}

// categories là dữ liệu tham chiếu chỉ-kéo, khoá theo id số nguyên chứ không
// theo uuid (functions/api/sync.js:77).
async function applyCategories(rows) {
  let changed = 0;
  for (const row of rows) {
    const local = await db.categories.get(row.id);
    const next = { id: row.id, name: row.name, type: row.type, icon: row.icon, color: row.color };
    if (local) {
      await db.categories.update(row.id, next);
    } else {
      await db.categories.add(next);
    }
    changed++;
  }
  return changed;
}

async function applyPulled(changes) {
  let changed = 0;
  for (const [table, rows] of Object.entries(changes)) {
    if (!Array.isArray(rows) || !rows.length) continue;
    if (table === 'categories') {
      changed += await applyCategories(rows);
    } else if (PUSH_TABLES.includes(table)) {
      changed += await applyTable(table, rows);
    }
  }
  return changed;
}

// ─────────────────────────────────────────────────────────
// Vòng đầu tiên trên một thiết bị: KÉO TRƯỚC, KHÔNG ĐẨY
//
// Bước nâng cấp v9 cố ý đặt _dirty = 0 cho mọi dòng đang có (db.js:82), nên sổ
// sẵn có trên máy sẽ không bao giờ tự lên máy chủ. Nhưng đánh dấu tất cả là
// dirty rồi đẩy mù thì hỏng theo hướng ngược lại: một máy vừa cài tạo hồ sơ cửa
// hàng rỗng với updated_at = bây giờ, đẩy lên là xoá sổ hồ sơ thật của quán, vì
// máy chủ phân xử theo last-write-wins.
//
// Nên: kéo hết về trước, rồi chỉ đánh dấu những dòng mà máy chủ KHÔNG có — đó
// mới đúng là dữ liệu chỉ tồn tại ở máy này.
// ─────────────────────────────────────────────────────────
async function firstSync() {
  const seen = {};
  for (const table of PUSH_TABLES) seen[table] = new Set();

  let cursor = -1;          // -1 chứ không phải 0, xem functions/api/sync.js:137-141
  let changed = 0;
  let guard = 0;

  for (;;) {
    const result = await apiFetch('/api/sync', {
      method: 'POST',
      body: { since: cursor, changes: {} }
    });

    for (const table of PUSH_TABLES) {
      for (const row of result.changes?.[table] || []) seen[table].add(row.uuid);
    }

    changed += await applyPulled(result.changes || {});
    cursor = result.cursor;

    if (!result.hasMore || ++guard > 50) break;
  }

  // Dòng nào máy chủ chưa biết thì đánh dấu để vòng sau đẩy lên.
  let queued = 0;
  for (const table of PUSH_TABLES) {
    const rows = await db[table].toArray();
    for (const row of rows) {
      if (!row.uuid || seen[table].has(row.uuid) || row._dirty === 1) continue;
      await db[table].update(row.id, { _dirty: 1 });
      queued++;
    }
  }

  await setCursor(cursor);
  return { changed, queued };
}

// ─────────────────────────────────────────────────────────
// Vòng đồng bộ thường
// ─────────────────────────────────────────────────────────
let inFlight = null;
const listeners = new Set();

export function onSyncChange(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify(payload) {
  for (const cb of listeners) {
    try {
      cb(payload);
    } catch (err) {
      console.error('Lỗi trong listener đồng bộ:', err);
    }
  }
}

async function syncOnce() {
  if (await getCursor() !== null) return await syncRound();

  const { changed } = await firstSync();

  // Vòng đầu cố ý chỉ kéo. Nhưng nếu sau đó có bất kỳ dòng nào đang chờ đẩy
  // thì phải chạy tiếp một vòng thường ngay, chứ không bắt người dùng đợi tới
  // nhịp 60 giây.
  //
  // Phải xét TOÀN BỘ số dòng _dirty chứ không chỉ những dòng firstSync vừa
  // đánh dấu: người dùng đăng nhập rồi ghi ngay một giao dịch thì dòng đó đã
  // mang sẵn _dirty = 1 từ storageService, firstSync không đụng tới, và nếu chỉ
  // đếm phần mình vừa đánh dấu thì lần đồng bộ đầu tiên đẩy đúng con số không.
  if (countRows(await collectDirty()) === 0) return { changed, pushed: 0 };

  const next = await syncRound();
  return { changed: changed + next.changed, pushed: next.pushed };
}

function countRows(changes) {
  return Object.values(changes).reduce((sum, rows) => sum + rows.length, 0);
}

async function syncRound() {
  let changed = 0;
  let pushed = 0;
  let guard = 0;

  for (;;) {
    const cursor = await getCursor() ?? -1;
    const changes = await collectDirty();
    const dirtyBefore = countRows(changes);

    const result = await apiFetch('/api/sync', {
      method: 'POST',
      body: { since: cursor, changes }
    });

    pushed += result.pushed || 0;
    changed += await applyPulled(result.changes || {});
    await setCursor(result.cursor);

    const dirtyAfter = countRows(await collectDirty());

    // Chạy tiếp khi máy chủ còn dữ liệu, hoặc khi lượt vừa rồi có tiến triển
    // thật (số dòng chờ đẩy giảm đi) — quá hạn mức 200 dòng thì phải nhiều lượt.
    //
    // Điều kiện "có tiến triển" là thứ chặn vòng lặp vô hạn: một dòng bị máy chủ
    // bỏ qua vĩnh viễn (thua last-write-wins mà bản thắng đã nằm dưới con trỏ,
    // hoặc trúng clause DO NOTHING của idempotency_key) sẽ mãi mang cờ _dirty.
    // Không có điều kiện này thì mỗi lần đồng bộ là 50 lượt gọi mạng vô ích.
    const progressed = dirtyAfter < dirtyBefore;
    if ((!result.hasMore && !progressed) || ++guard > 50) break;
  }

  return { changed, pushed };
}

// Gọi từ mọi nơi, bao nhiêu lần cũng được: hai lời gọi chồng nhau dùng chung
// một lượt chạy thay vì tranh nhau ghi vào Dexie.
export function runSync({ silent = true } = {}) {
  if (!getToken()) return Promise.resolve({ skipped: 'no-token' });
  if (inFlight) return inFlight;

  inFlight = (async () => {
    notify({ type: 'status', state: 'syncing' });
    try {
      const result = await syncOnce();
      if (result.changed > 0 || result.pushed > 0) notify({ type: 'changed', ...result });
      notify({ type: 'status', state: 'idle' });
      return result;
    } catch (err) {
      const kind = err instanceof ApiError ? err.kind : 'unknown';
      // Mất mạng là trạng thái bình thường của một cái điện thoại trong quán,
      // không phải sự cố cần báo động.
      notify({ type: 'status', state: kind === 'offline' ? 'offline' : 'error' });
      if (kind !== 'offline' && !silent) notify({ type: 'error', kind, message: err.message });
      if (kind === 'unauthorized') notify({ type: 'unauthorized' });
      return { error: err.message, kind };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

// Gộp nhiều thao tác ghi liên tiếp thành một vòng đồng bộ. App.jsx gọi hàm này
// sau mỗi lần nạp lại dữ liệu — tức sau mọi lần ghi, và cả khi chỉ đổi bộ lọc
// ngày. Gọi thừa vô hại (một POST với changes rỗng) còn gọi thiếu thì thay đổi
// nằm lại trên máy, nên chỗ này cố ý chọn phía gọi thừa.
let scheduled = null;

export function scheduleSync(delay = 1500) {
  if (scheduled) clearTimeout(scheduled);
  scheduled = setTimeout(() => {
    scheduled = null;
    runSync();
  }, delay);
}

// ─────────────────────────────────────────────────────────
// Bộ kích hoạt: đăng nhập, có mạng lại, quay lại tab, và nhịp nền
// ─────────────────────────────────────────────────────────
const INTERVAL_MS = 60_000;
let timer = null;
let detach = null;

export function startAutoSync() {
  stopAutoSync();

  const kick = () => { runSync(); };

  timer = setInterval(kick, INTERVAL_MS);

  const onOnline = () => kick();
  const onVisible = () => { if (document.visibilityState === 'visible') kick(); };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);

  detach = () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };

  kick();
}

export function stopAutoSync() {
  if (timer) clearInterval(timer);
  timer = null;
  if (scheduled) clearTimeout(scheduled);
  scheduled = null;
  if (detach) detach();
  detach = null;
}

export const syncService = {
  runSync,
  scheduleSync,
  startAutoSync,
  stopAutoSync,
  onSyncChange,
  resetCursor,
  getCursor
};
