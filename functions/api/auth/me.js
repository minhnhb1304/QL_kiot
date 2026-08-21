// Cloudflare Pages Function: /api/auth/me
//
//   GET   → { user }        client dùng để phát hiện phiên đã hết hạn
//   PATCH → { user }        sửa họ tên / SĐT / email (authService.updateUserProfile)
//
// Không có route đổi mật khẩu: mật khẩu đổi được nghĩa là phải xử lý cả việc
// huỷ các phiên khác, chưa thuộc phạm vi lần này.

import { json } from '../../../shared/d1.js';
import { getSessionUser, publicUser } from '../../../shared/auth.js';

const UNAUTHORIZED = { error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn', code: 'unauthorized' };

export async function onRequestGet(context) {
  const { env, request } = context;
  try {
    const user = await getSessionUser(env, request);
    if (!user) return json(UNAUTHORIZED, 401);
    return json({ user: publicUser(user) });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestPatch(context) {
  const { env, request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body không phải JSON hợp lệ' }, 400);
  }

  try {
    const user = await getSessionUser(env, request);
    if (!user) return json(UNAUTHORIZED, 401);

    const fullName = (body.fullName ?? user.full_name ?? '').trim();
    const phone = (body.phone ?? user.phone ?? '').trim();
    const email = (body.email ?? user.email ?? '').trim();

    if (!fullName) return json({ error: 'Vui lòng nhập họ và tên' }, 400);
    if (fullName.length < 2) return json({ error: 'Họ và tên quá ngắn' }, 400);
    if (phone && !/^[0-9]{9,11}$/.test(phone)) {
      return json({ error: 'Số điện thoại không hợp lệ (gồm 9 - 11 chữ số)' }, 400);
    }

    const updated = await env.DB.prepare(`
      UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ? RETURNING *
    `).bind(fullName, phone, email, user.id).first();

    return json({ user: publicUser(updated) });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
