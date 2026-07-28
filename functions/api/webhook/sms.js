// Cloudflare Pages Function: /api/webhook/sms
// Endpoint tiếp nhận Webhook tin nhắn SMS Banking từ App Android SMS Forwarder

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
      return new Response(JSON.stringify({ error: 'Unauthorized SMS Sender' }), { status: 401 });
    }

    // 2. Bóc tách số tiền báo có (+<số tiền>VND hoặc +<số tiền>d)
    const amountMatch = message.match(/\+([0-9.,]+)\s*(VND|đ|d)/i);

    if (!amountMatch) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'Not a credit SMS' }), { status: 200 });
    }

    // Làm sạch chuỗi số tiền (ví dụ: "50,000" hay "50.000" thành 50000)
    const rawAmountStr = amountMatch[1].replace(/[,.]/g, '');
    const amount = Number(rawAmountStr);

    if (amount <= 0) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'Invalid amount' }), { status: 200 });
    }

    const dateStr = new Date().toISOString().split('T')[0];

    // 3. Tự động ghi khoản THU NGÂN HÀNG vào Cloudflare D1 Database
    const query = `
      INSERT INTO transactions (type, category_id, category_name, amount, payment_source, note, transaction_date)
      VALUES ('IN', 1, 'Doanh thu nước ép', ?, 'BANK', ?, ?)
    `;

    const info = await env.DB.prepare(query).bind(
      amount, 
      `[SMS ${sender}] ${message.substring(0, 120)}`, 
      dateStr
    ).run();

    return new Response(JSON.stringify({ 
      success: true, 
      id: info.meta.last_row_id,
      amountExtracted: amount,
      message: `Đã tự động đọc SMS từ ${sender} và cộng +${new Intl.NumberFormat('vi-VN').format(amount)}đ vào Sổ Thu Chi!` 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
