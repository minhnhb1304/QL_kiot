// Cloudflare Pages Function: POST /api/sync
//
// Một vòng đồng bộ = đẩy (push) rồi kéo (pull) trong đúng một lượt gọi.
//
//   Request  { since: 0, changes: { transactions: [...], quick_notes: [...] } }
//   Response { cursor: 143, hasMore: false, pushed: 4, changes: { ... } }
//
// `since` là con trỏ server_seq của client. `changes` chỉ chứa những dòng
// _dirty = 1 ở máy đó. Máy chủ ghi chúng vào D1 (trọng tài last-write-wins theo
// updated_at), gán server_seq mới cho từng dòng được nhận, rồi trả về MỌI dòng
// có server_seq > since — kể cả những dòng vừa đẩy lên. Đó là cách client biết
// server_seq được gán cho mình để xóa cờ _dirty.
//
// Tên cột dùng ở đây là tên cột D1 (snake_case). Bảng store_profile phía Dexie
// đang để camelCase (storeName, storeSlogan…), việc quy đổi thuộc về vòng lặp
// đồng bộ ở client — máy chủ chỉ nói một thứ tiếng.

import { json, bumpSeq, SEQ_EXPR } from '../../shared/d1.js';
import { authorizeDataRequest } from '../../shared/auth.js';

// Số dòng tối đa nhận trong một lượt đẩy. Mỗi dòng tốn 2 câu lệnh trong batch,
// nên đây cũng là cái hãm cho kích thước transaction của D1.
const MAX_PUSH = 200;

// Số dòng tối đa trả về mỗi bảng trong một lượt kéo. Client tụt hậu xa sẽ kéo
// nhiều vòng thay vì timeout một vòng.
const PAGE = 500;

// Cấu hình các bảng đồng bộ HAI CHIỀU.
//
//   conflicts: các ràng buộc UNIQUE có thể va, theo thứ tự ưu tiên
//   keep:      cột KHÔNG được ghi đè khi va chạm ở clause đó
//   required:  cột NOT NULL không có giá trị mặc định hợp lý
const PUSH_TABLES = {
  transactions: {
    cols: ['uuid', 'type', 'category_id', 'category_name', 'amount', 'payment_source',
           'note', 'transaction_date', 'idempotency_key', 'created_at', 'updated_at', 'deleted'],
    // idempotency_key cũng là UNIQUE. Nếu client đẩy lên một uuid khác nhưng
    // trùng khóa (không nên xảy ra), DO NOTHING giữ cho cả lô khỏi bị rollback.
    conflicts: [{ target: 'uuid' }, { target: 'idempotency_key', action: 'nothing' }],
    required: ['type', 'category_name', 'amount', 'payment_source', 'transaction_date']
  },

  // Hợp nhất theo `date`, KHÔNG theo uuid — xem chú thích schema.sql:110.
  // Hai thiết bị cùng chốt sổ một ngày sinh ra hai uuid nhưng cùng date; ghép
  // theo uuid sẽ làm cả lô batch() vi phạm UNIQUE(date) và bị hủy sạch.
  // `date` nằm trong keep ở cả hai clause: đổi ngày của một dòng đã có nghĩa là
  // một bản ghi khác, và ghi đè nó có thể va vào UNIQUE của dòng thứ ba.
  daily_cash_records: {
    cols: ['uuid', 'date', 'opening_cash', 'closing_cash', 'total_cash', 'note',
           'created_at', 'updated_at', 'deleted'],
    conflicts: [{ target: 'uuid', keep: ['date'] }, { target: 'date', keep: ['date'] }],
    required: ['date']
  },

  quick_notes: {
    cols: ['uuid', 'text', 'is_done', 'color', 'created_at', 'updated_at', 'deleted'],
    conflicts: [{ target: 'uuid' }],
    required: ['text']
  },

  expense_presets: {
    cols: ['uuid', 'label', 'icon', 'amount', 'category_id', 'category_name',
           'payment_source', 'sort_order', 'created_at', 'updated_at', 'deleted'],
    conflicts: [{ target: 'uuid' }],
    required: ['label', 'amount', 'category_name']
  },

  store_profile: {
    cols: ['uuid', 'store_name', 'store_slogan', 'store_logo', 'store_address', 'store_phone',
           'business_start_date', 'app_start_date', 'currency', 'monthly_revenue_goal',
           'financial_month_start_day', 'store_notes', 'created_at', 'updated_at', 'deleted'],
    conflicts: [{ target: 'uuid' }],
    required: []
  }
};

// categories là dữ liệu tham chiếu: id số nguyên cố định, UI không cho tạo mới,
// nên client CHỈ kéo về. Client có đẩy lên cũng bị bỏ qua.
const PULL_TABLES = ['categories', ...Object.keys(PUSH_TABLES)];

// ─────────────────────────────────────────────────────────
// Sinh câu UPSERT cho một bảng
// ─────────────────────────────────────────────────────────
function upsertSql(table, cfg) {
  const placeholders = cfg.cols.map(() => '?').join(', ');

  const clauses = cfg.conflicts.map(c => {
    if (c.action === 'nothing') {
      return `ON CONFLICT(${c.target}) DO NOTHING`;
    }
    // uuid là danh tính của dòng trên máy chủ — không bao giờ ghi đè.
    const keep = new Set(['uuid', ...(c.keep || [])]);
    const sets = cfg.cols
      .filter(col => !keep.has(col))
      .map(col => `${col} = excluded.${col}`)
      .concat('server_seq = excluded.server_seq')
      .join(', ');

    // Trọng tài last-write-wins: bản ghi cũ hơn bị bỏ qua lặng lẽ. Nó vẫn tiêu
    // một số thứ tự, tạo khoảng trống trong dãy server_seq — vô hại, client chỉ
    // so sánh "lớn hơn con trỏ".
    return `ON CONFLICT(${c.target}) DO UPDATE SET ${sets} WHERE excluded.updated_at > ${table}.updated_at`;
  }).join('\n    ');

  return `INSERT INTO ${table} (${cfg.cols.join(', ')}, server_seq)
    VALUES (${placeholders}, ${SEQ_EXPR})
    ${clauses}`;
}

// Dexie trả về boolean cho is_done/deleted; SQLite muốn 0/1.
// undefined phải thành null, nếu không .bind() sẽ ném lỗi.
function bindValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export async function onRequestPost(context) {
  const { env, request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body không phải JSON hợp lệ' }, 400);
  }

  // Hai đường vào: phiên đăng nhập (app trong trình duyệt) hoặc x-sync-secret
  // (máy-với-máy). Xem chú thích authorizeDataRequest — client là JavaScript
  // công khai nên secret dùng chung không bảo vệ được gì cho đường thứ nhất.
  const auth = await authorizeDataRequest(env, request, body.secret);
  if (!auth.ok) {
    return json({ error: 'Unauthorized sync client', code: 'unauthorized' }, 401);
  }

  // Con trỏ khởi đầu là -1, KHÔNG phải 0.
  // Dữ liệu seed (categories, 3 mẫu chi, store_profile 'default') nằm sẵn trong
  // schema.sql với server_seq = 0. Nếu client mới bắt đầu từ 0 thì điều kiện
  // "server_seq > since" loại đúng những dòng đó ra và máy mới sẽ không bao giờ
  // nhận được danh mục.
  const since = Number.isInteger(body.since) && body.since >= -1 ? body.since : -1;
  const changes = body.changes && typeof body.changes === 'object' ? body.changes : {};

  try {
    // ── 1. ĐẨY ────────────────────────────────────────────
    const stmts = [];

    for (const [table, rows] of Object.entries(changes)) {
      const cfg = PUSH_TABLES[table];
      if (!cfg || !Array.isArray(rows)) continue;   // bảng chỉ-kéo hoặc bảng lạ

      const sql = upsertSql(table, cfg);

      for (const row of rows) {
        if (!row || typeof row.uuid !== 'string' || !row.uuid) {
          return json({ error: `${table}: có dòng thiếu uuid` }, 400);
        }
        const missing = cfg.required.filter(col => row[col] === undefined || row[col] === null);
        if (missing.length) {
          return json({ error: `${table}/${row.uuid}: thiếu ${missing.join(', ')}` }, 400);
        }

        // updated_at là trọng tài của last-write-wins — thiếu nó thì không xử
        // được xung đột, nên mặc định về "bây giờ" thay vì từ chối.
        const updatedAt = Number(row.updated_at) || Date.now();
        const normalized = {
          ...row,
          updated_at: updatedAt,
          created_at: Number(row.created_at) || updatedAt,
          deleted: row.deleted ? 1 : 0
        };

        stmts.push(bumpSeq(env));
        stmts.push(env.DB.prepare(sql).bind(...cfg.cols.map(col => bindValue(normalized[col]))));
      }
    }

    const pushed = stmts.length / 2;
    if (pushed > MAX_PUSH) {
      return json({ error: `Một lượt đẩy tối đa ${MAX_PUSH} dòng, nhận ${pushed}. Chia nhỏ ra.` }, 413);
    }
    if (stmts.length) {
      // batch() chạy cả lô như MỘT transaction: bộ đếm và dòng dữ liệu không
      // bao giờ lệch nhau, kể cả khi hai thiết bị đẩy cùng lúc.
      await env.DB.batch(stmts);
    }

    // ── 2. KÉO ────────────────────────────────────────────
    const pulled = {};
    let maxSeq = Math.max(since, 0);   // không bao giờ trả con trỏ -1 về lại client
    let cappedSeq = null;              // seq cuối cùng của bảng bị cắt trang, nếu có

    for (const table of PULL_TABLES) {
      const { results } = await env.DB
        .prepare(`SELECT * FROM ${table} WHERE server_seq > ? ORDER BY server_seq LIMIT ${PAGE}`)
        .bind(since)
        .all();

      if (!results.length) continue;
      pulled[table] = results;

      const lastSeq = results[results.length - 1].server_seq;
      if (lastSeq > maxSeq) maxSeq = lastSeq;

      if (results.length === PAGE) {
        // Bảng này còn dữ liệu. Con trỏ không được vượt quá dòng cuối đã gửi,
        // nếu không phần còn lại của nó sẽ bị bỏ qua vĩnh viễn.
        cappedSeq = cappedSeq === null ? lastSeq : Math.min(cappedSeq, lastSeq);
      }
    }

    const hasMore = cappedSeq !== null;

    return json({
      pushed,
      // Vòng kéo tiếp theo gửi lại `cursor` này. Khi bị cắt trang, các bảng
      // khác sẽ gửi trùng vài dòng — áp lại là idempotent nên không sao.
      cursor: hasMore ? cappedSeq : maxSeq,
      hasMore,
      changes: pulled
    });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
