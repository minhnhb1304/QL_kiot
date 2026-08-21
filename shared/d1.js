// Tiện ích dùng chung cho các Cloudflare Pages Function nói chuyện với D1.
//
// Vì sao file này nằm NGOÀI thư mục functions/: mọi file trong functions/ đều
// được Pages biến thành một route HTTP. Module dùng chung mà đặt trong đó sẽ
// tạo ra một endpoint rác. Pages bundle bằng esbuild nên import ra ngoài repo
// vẫn resolve bình thường.

// ─────────────────────────────────────────────────────────
// Phản hồi JSON — lặp lại ở cả bốn function trước đây
// ─────────────────────────────────────────────────────────
export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ─────────────────────────────────────────────────────────
// SHA-256 → hex. Dùng để sinh idempotency_key ổn định từ nội dung
// tin nhắn khi ngân hàng không gửi kèm mã giao dịch.
// ─────────────────────────────────────────────────────────
export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// ─────────────────────────────────────────────────────────
// Cấp phát server_seq
//
// server_seq do MÁY CHỦ gán và phải tăng đơn điệu — client dùng nó làm con trỏ
// kéo dữ liệu. Cách duy nhất an toàn khi hai thiết bị đẩy cùng lúc là tăng bộ
// đếm và đọc lại giá trị TRONG CÙNG một transaction. D1 không có transaction
// tương tác, nhưng env.DB.batch() chạy cả lô như một transaction — nên cặp
// "UPDATE bộ đếm" + "INSERT đọc bộ đếm" phải nằm chung một batch.
//
// Trả về câu lệnh tăng bộ đếm; SQL đi kèm đọc lại bằng SEQ_EXPR.
// ─────────────────────────────────────────────────────────
export const SEQ_EXPR = '(SELECT last_seq FROM sync_state WHERE id = 1)';

export function bumpSeq(env) {
  return env.DB.prepare('UPDATE sync_state SET last_seq = last_seq + 1 WHERE id = 1');
}

// ─────────────────────────────────────────────────────────
// Ghi một khoản THU từ ngân hàng
//
// Ba webhook (sms / bank / bank-direct) trước đây lặp lại y hệt câu INSERT này,
// chỉ khác tiền tố ghi chú. Gộp về một chỗ để lược đồ uuid chỉ phải sửa một lần.
//
// idempotencyKey: cột UNIQUE trong schema. INSERT OR IGNORE + khóa này là thứ
// chặn SMS Forwarder gửi lại làm ghi trùng doanh thu. Truyền null nếu không có
// khóa ổn định — khi đó mọi lần gọi đều ghi một dòng mới.
// ─────────────────────────────────────────────────────────
export async function insertIncome({ env, amount, note, dateStr, idempotencyKey = null, categoryId = 1, categoryName = 'Doanh thu nước ép' }) {
  const uuid = crypto.randomUUID();
  const now = Date.now();

  const insert = env.DB.prepare(`
    INSERT OR IGNORE INTO transactions (
      uuid, type, category_id, category_name, amount, payment_source,
      note, transaction_date, idempotency_key, created_at, updated_at, deleted, server_seq
    ) VALUES (?, 'IN', ?, ?, ?, 'BANK', ?, ?, ?, ?, ?, 0, ${SEQ_EXPR})
  `).bind(uuid, categoryId, categoryName, amount, note, dateStr, idempotencyKey, now, now);

  // Bộ đếm bị tiêu tốn kể cả khi OR IGNORE bỏ qua dòng trùng. Khoảng trống
  // trong dãy server_seq là vô hại: client chỉ so sánh lớn hơn con trỏ.
  const [, result] = await env.DB.batch([bumpSeq(env), insert]);

  const inserted = (result.meta?.changes ?? 0) > 0;
  return { uuid, inserted, duplicate: !inserted };
}
