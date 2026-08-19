// Cloudflare Pages Function: /api/webhook/bank
// Tự động nhận biến động số dư tài khoản ngân hàng (SePay / Casso Webhook)

import { json, sha256Hex, insertIncome } from '../../../shared/d1.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const data = await request.json();

    // Đọc số tiền & nội dung từ Webhook SePay/Casso
    const amount = Number(data.transferAmount || data.amount || 0);
    const note = data.content || data.description || 'Chuyển khoản QR Ngân hàng';
    const dateStr = new Date().toISOString().split('T')[0];

    if (amount <= 0) {
      return json({ status: 'ignored', reason: 'Non-positive transaction' });
    }

    // SePay/Casso gửi lại webhook cho tới khi nhận được 2xx. Ưu tiên mã giao
    // dịch của cổng làm khóa chống trùng; nếu payload không có thì băm nội dung.
    const gatewayRef = data.id || data.referenceCode || data.tid || data.transactionId;
    const idempotencyKey = gatewayRef
      ? `bank:${gatewayRef}`
      : `bank:${dateStr}:${amount}:${(await sha256Hex(note)).slice(0, 32)}`;

    // Tự động ghi khoản THU (IN) nguồn Ngân Hàng (BANK) vào D1 Database
    const { uuid, duplicate } = await insertIncome({
      env,
      amount,
      note: `[Tự động Ngân hàng] ${note}`,
      dateStr,
      idempotencyKey
    });

    if (duplicate) {
      return json({
        success: true,
        duplicate: true,
        message: 'Giao dịch này đã được ghi sổ trước đó, bỏ qua để không cộng trùng.'
      });
    }

    return json({
      success: true,
      uuid,
      message: `Đã tự động cộng ${amount}đ từ tài khoản Ngân hàng`
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
