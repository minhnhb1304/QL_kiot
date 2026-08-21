// Cloudflare Pages Function: /api/webhook/sms
// Endpoint tiếp nhận Webhook tin nhắn SMS Banking từ App Android SMS Forwarder

import { json, sha256Hex, insertIncome } from '../../../shared/d1.js';

export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const data = await request.json();

    // Format gửi từ SMS Forwarder: { sender: "SACOMBANK", message: "STK... +35,000VND...", secret: "xxx" }
    const sender = data.sender || 'BANK_SMS';
    const message = data.message || data.text || '';
    const secret = data.secret;

    // 1. Kiểm tra mã bí mật (Optional Security Check)
    if (env.SMS_SECRET && secret !== env.SMS_SECRET) {
      return json({ error: 'Unauthorized SMS Sender' }, 401);
    }

    // 2. Bóc tách số tiền báo có (+<số tiền>VND hoặc +<số tiền>d)
    const amountMatch = message.match(/\+([0-9.,]+)\s*(VND|đ|d)/i);

    if (!amountMatch) {
      return json({ status: 'ignored', reason: 'Not a credit SMS' });
    }

    // Làm sạch chuỗi số tiền (ví dụ: "50,000" hay "50.000" thành 50000)
    const rawAmountStr = amountMatch[1].replace(/[,.]/g, '');
    const amount = Number(rawAmountStr);

    if (amount <= 0) {
      return json({ status: 'ignored', reason: 'Invalid amount' });
    }

    const dateStr = new Date().toISOString().split('T')[0];

    // 3. Khóa chống ghi trùng. SMS Forwarder gửi lại khi mạng chập chờn, và
    //    trước đây mỗi lần gửi lại là một dòng doanh thu ảo. Băm cả nội dung
    //    tin nhắn: SMS ngân hàng luôn kèm số dư và giờ giao dịch nên hai lần
    //    chuyển tiền thật không bao giờ trùng chuỗi.
    const idempotencyKey = `sms:${sender}:${amount}:${(await sha256Hex(message)).slice(0, 32)}`;

    // 4. Tự động ghi khoản THU NGÂN HÀNG vào Cloudflare D1 Database
    const { uuid, duplicate } = await insertIncome({
      env,
      amount,
      note: `[SMS ${sender}] ${message.substring(0, 120)}`,
      dateStr,
      idempotencyKey
    });

    if (duplicate) {
      return json({
        success: true,
        duplicate: true,
        amountExtracted: amount,
        message: 'Tin nhắn này đã được ghi sổ trước đó, bỏ qua để không cộng trùng.'
      });
    }

    return json({
      success: true,
      uuid,
      amountExtracted: amount,
      message: `Đã tự động đọc SMS từ ${sender} và cộng +${new Intl.NumberFormat('vi-VN').format(amount)}đ vào Sổ Thu Chi!`
    });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
