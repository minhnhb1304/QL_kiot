// Cloudflare Pages Function: /api/webhook/bank-direct
// API Tiếp nhận Webhook kết nối TRỰC TIẾP từ Ngân Hàng (MB Bank / VietinBank / BIDV Open API)

import { json, sha256Hex, insertIncome } from '../../../shared/d1.js';

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const rawBody = await request.text();
    const _signature = request.headers.get('x-bank-signature') || request.headers.get('x-signature');

    // 1. Giải mã Payload từ Ngân Hàng
    const payload = JSON.parse(rawBody);

    // Cấu trúc dữ liệu chuẩn Open API Ngân hàng Việt Nam:
    // payload: { amount: 35000, creditDebit: "CR", description: "Mã VietQR 001", transactionDate: "2026-07-27" }
    const amount = Number(payload.amount || payload.transferAmount || 0);
    const isCredit = payload.creditDebit === 'CR' || payload.type === 'RECEIVE' || amount > 0;
    const note = payload.description || payload.content || 'Khách quét QR Bank Direct API';
    const dateStr = new Date().toISOString().split('T')[0];

    if (!isCredit || amount <= 0) {
      return json({ responseCode: '01', message: 'Ignored non-credit transaction' });
    }

    // Cổng ngân hàng gửi lại cho tới khi nhận responseCode '00'. Mã giao dịch
    // của ngân hàng là khóa chống trùng tin cậy nhất; băm payload nếu thiếu.
    const bankRef = payload.transactionId || payload.referenceNumber || payload.traceId || payload.ftNumber;
    const idempotencyKey = bankRef
      ? `bank-direct:${bankRef}`
      : `bank-direct:${dateStr}:${amount}:${(await sha256Hex(rawBody)).slice(0, 32)}`;

    // 2. Ghi khoản THU (IN) nguồn Ngân Hàng vào Cloudflare D1 Database
    const { uuid, duplicate } = await insertIncome({
      env,
      amount,
      note: `[Bank Direct API] ${note}`,
      dateStr,
      idempotencyKey
    });

    // 3. Phản hồi chuẩn ISO 20022 cho cổng API Ngân hàng.
    //    Bản ghi trùng vẫn trả '00': với cổng ngân hàng, "đã nhận rồi" là thành
    //    công — trả mã lỗi chỉ khiến nó gửi lại mãi.
    return json({
      responseCode: '00',
      success: true,
      duplicate,
      transactionId: uuid,
      message: duplicate
        ? 'Transaction already recorded, ignored'
        : 'Successfully recorded incoming bank transfer'
    });

  } catch (err) {
    return json({ responseCode: '99', error: err.message }, 500);
  }
}
