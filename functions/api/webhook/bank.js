// Cloudflare Pages Function: /api/webhook/bank
// Tự động nhận biến động số dư tài khoản ngân hàng (SePay / Casso Webhook)

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const data = await request.json();
    
    // Đọc số tiền & nội dung từ Webhook SePay/Casso
    const amount = Number(data.transferAmount || data.amount || 0);
    const note = data.content || data.description || 'Chuyển khoản QR Ngân hàng';
    const dateStr = new Date().toISOString().split('T')[0];

    if (amount <= 0) {
      return new Response(JSON.stringify({ status: 'ignored', reason: 'Non-positive transaction' }), { status: 200 });
    }

    // Tự động ghi khoản THU (IN) nguồn Ngân Hàng (BANK) vào D1 Database
    const query = `
      INSERT INTO transactions (type, category_id, category_name, amount, payment_source, note, transaction_date)
      VALUES ('IN', 1, 'Doanh thu nước ép', ?, 'BANK', ?, ?)
    `;

    const info = await env.DB.prepare(query).bind(
      amount, 
      `[Tự động Ngân hàng] ${note}`, 
      dateStr
    ).run();

    return new Response(JSON.stringify({ 
      success: true, 
      id: info.meta.last_row_id,
      message: `Đã tự động cộng ${amount}đ từ tài khoản Ngân hàng` 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
