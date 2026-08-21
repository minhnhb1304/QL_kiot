// Cloudflare Pages Function: /api/transactions
// Đọc & ghi giao dịch trên Cloudflare D1.
//
// Lược đồ cloud sync đổi khóa chính từ id INTEGER sang uuid TEXT, nên:
//   - không còn ORDER BY id, thay bằng server_seq (thứ tự do máy chủ gán)
//   - phải lọc deleted = 0 vì xóa giờ là xóa mềm (tombstone)
//   - phản hồi trả uuid; last_row_id vô nghĩa với khóa chính kiểu TEXT

import { json, bumpSeq, SEQ_EXPR } from '../../shared/d1.js';
import { authorizeDataRequest } from '../../shared/auth.js';

// Endpoint này trả nguyên cả sổ, nên phải qua cùng một cổng như /api/sync.
// Trước đây nó hoàn toàn để mở: GET /api/transactions đọc được toàn bộ doanh
// thu của quán mà không cần gì cả.
const DENIED = { error: 'Unauthorized', code: 'unauthorized' };

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  try {
    if (!(await authorizeDataRequest(env, request)).ok) return json(DENIED, 401);

    let query = `SELECT * FROM transactions WHERE deleted = 0`;
    const params = [];

    if (startDate && endDate) {
      query += ` AND transaction_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY transaction_date DESC, server_seq DESC LIMIT 200`;

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return json(results);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    if (!(await authorizeDataRequest(env, request)).ok) return json(DENIED, 401);

    const data = await request.json();
    const { type, category_id, category_name, amount, payment_source, note, transaction_date } = data;

    // uuid do client sinh nếu có (giữ nguyên danh tính khi đồng bộ về sau),
    // ngược lại máy chủ tự sinh. crypto.randomUUID() có sẵn trong Workers.
    const uuid = data.uuid || crypto.randomUUID();
    const now = Date.now();

    const insert = env.DB.prepare(`
      INSERT INTO transactions (
        uuid, type, category_id, category_name, amount, payment_source,
        note, transaction_date, created_at, updated_at, deleted, server_seq
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ${SEQ_EXPR})
    `).bind(uuid, type, category_id, category_name, amount, payment_source, note, transaction_date, now, now);

    await env.DB.batch([bumpSeq(env), insert]);

    return json({ success: true, uuid });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// Xóa mềm: đặt tombstone thay vì DELETE, để lệnh xóa lan được sang thiết bị khác.
export async function onRequestDelete(context) {
  const { env, request } = context;
  try {
    if (!(await authorizeDataRequest(env, request)).ok) return json(DENIED, 401);

    const url = new URL(request.url);
    const uuid = url.searchParams.get('uuid');
    if (!uuid) return json({ error: 'Thiếu tham số uuid' }, 400);

    const update = env.DB.prepare(`
      UPDATE transactions
         SET deleted = 1, updated_at = ?, server_seq = ${SEQ_EXPR}
       WHERE uuid = ?
    `).bind(Date.now(), uuid);

    const [, result] = await env.DB.batch([bumpSeq(env), update]);

    if ((result.meta?.changes ?? 0) === 0) {
      return json({ error: 'Không tìm thấy giao dịch' }, 404);
    }
    return json({ success: true, uuid });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
