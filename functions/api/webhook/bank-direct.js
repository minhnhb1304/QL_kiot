// Cloudflare Pages Function: /api/webhook/bank-direct
// API Tiếp nhận Webhook kết nối TRỰC TIẾP từ Ngân Hàng (MB Bank / VietinBank / BIDV Open API)

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
      return new Response(JSON.stringify({ responseCode: '01', message: 'Ignored non-credit transaction' }), { status: 200 });
    }

    // 2. Ghi khoản THU (IN) nguồn Ngân Hàng vào Cloudflare D1 Database
    const query = `
      INSERT INTO transactions (type, category_id, category_name, amount, payment_source, note, transaction_date)
      VALUES ('IN', 1, 'Doanh thu nước ép', ?, 'BANK', ?, ?)
    `;

    const info = await env.DB.prepare(query).bind(
      amount, 
      `[Bank Direct API] ${note}`, 
      dateStr
    ).run();

    // 3. Phản hồi chuẩn ISO 20022 cho cổng API Ngân hàng
    return new Response(JSON.stringify({ 
      responseCode: '00', 
      success: true,
      transactionId: info.meta.last_row_id,
      message: 'Successfully recorded incoming bank transfer' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ responseCode: '99', error: err.message }), { status: 500 });
  }
}
