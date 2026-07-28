// Cloudflare Pages Function: /api/transactions
// Handles GET (List), POST (Create), DELETE (Remove) on Cloudflare D1 DB

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');

  try {
    let query = `SELECT * FROM transactions WHERE 1=1`;
    const params = [];

    if (startDate && endDate) {
      query += ` AND transaction_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY transaction_date DESC, id DESC LIMIT 200`;

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const data = await request.json();
    const { type, category_id, category_name, amount, payment_source, note, transaction_date } = data;

    const query = `
      INSERT INTO transactions (type, category_id, category_name, amount, payment_source, note, transaction_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const info = await env.DB.prepare(query).bind(
      type, category_id, category_name, amount, payment_source, note, transaction_date
    ).run();

    return new Response(JSON.stringify({ success: true, id: info.meta.last_row_id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
