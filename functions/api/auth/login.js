// Cloudflare Pages Function: POST /api/auth/login
//
//   Request  { username, password }
//   Response { token, user }
//
// Client cần phân biệt "chưa có tài khoản này trên máy chủ" với "sai mật khẩu":
// trường hợp đầu là đầu vào của luồng di trú tài khoản cũ từ Dexie lên D1
// (authService.loginWithPassword), trường hợp sau chỉ là gõ nhầm. Nên phản hồi
// mang thêm `code`, trong khi câu chữ hiển thị cho người dùng vẫn mơ hồ như
// nhau ở cả hai — không xác nhận cho người lạ biết tên đăng nhập nào có thật.

import { json } from '../../../shared/d1.js';
import { verifyPassword, createSession, publicUser } from '../../../shared/auth.js';

const WRONG = 'Tài khoản hoặc mật khẩu không chính xác';

export async function onRequestPost(context) {
  const { env, request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body không phải JSON hợp lệ' }, 400);
  }

  const username = (body.username || '').trim().toLowerCase();
  const password = body.password || '';

  if (!username || !password) {
    return json({ error: WRONG, code: 'invalid_credentials' }, 401);
  }

  try {
    const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?')
      .bind(username).first();

    if (!user) {
      return json({ error: WRONG, code: 'user_not_found' }, 401);
    }

    if (!await verifyPassword(user, password)) {
      return json({ error: WRONG, code: 'invalid_credentials' }, 401);
    }

    const token = await createSession(env, user.id, request.headers.get('User-Agent'));
    return json({ token, user: publicUser(user) });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
