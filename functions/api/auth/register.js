// Cloudflare Pages Function: POST /api/auth/register
//
// Ai được đăng ký:
//   - users rỗng      → tự do. Đây là lần "nhận quán": người cài app đầu tiên
//                       trở thành OWNER. Vai trò bị ép thành OWNER bất kể client
//                       gửi gì, nếu không thì người đầu tiên có thể tự đặt mình
//                       là STAFF và khoá luôn khả năng tạo tài khoản về sau.
//   - đã có người dùng → bắt buộc Bearer token của một phiên OWNER. Sổ nằm trên
//                       URL công khai; để đăng ký mở là mời người lạ vào đọc sổ.
//
// Các luật kiểm tra đầu vào chép đúng từ authService.registerUser cũ để câu
// thông báo lỗi người dùng đang quen không đổi.

import { json } from '../../../shared/d1.js';
import { newSalt, hashPassword, createSession, getSessionUser, publicUser, DEFAULT_ITERATIONS } from '../../../shared/auth.js';

function validate({ username, fullName, password, confirmPassword, phone }) {
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanFullName = (fullName || '').trim();
  const cleanPhone = (phone || '').trim();

  if (!cleanUsername) return 'Vui lòng nhập tên đăng nhập';
  if (cleanUsername.length < 3) return 'Tên đăng nhập phải có ít nhất 3 ký tự';
  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return 'Tên đăng nhập chỉ chứa chữ cái, chữ số và dấu gạch dưới (_)';
  }
  if (!cleanFullName) return 'Vui lòng nhập họ và tên';
  if (cleanFullName.length < 2) return 'Họ và tên quá ngắn';
  if (!password || password.length < 6) return 'Mật khẩu phải chứa ít nhất 6 ký tự';
  // confirmPassword là tuỳ chọn: client tự đăng ký thì gửi, luồng di trú tài
  // khoản cũ thì không có gì để xác nhận lại.
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return 'Mật khẩu xác nhận không trùng khớp';
  }
  if (cleanPhone && !/^[0-9]{9,11}$/.test(cleanPhone)) {
    return 'Số điện thoại không hợp lệ (gồm 9 - 11 chữ số)';
  }
  return null;
}

export async function onRequestPost(context) {
  const { env, request } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body không phải JSON hợp lệ' }, 400);
  }

  const problem = validate(body);
  if (problem) return json({ error: problem }, 400);

  const username = body.username.trim().toLowerCase();
  const fullName = body.fullName.trim();
  const phone = (body.phone || '').trim();
  const email = (body.email || '').trim();

  try {
    const { total } = await env.DB.prepare('SELECT COUNT(*) AS total FROM users').first();
    const isFirstUser = total === 0;

    let role = 'OWNER';
    if (!isFirstUser) {
      const actor = await getSessionUser(env, request);
      if (!actor) {
        return json({
          error: 'Quán này đã có tài khoản. Chỉ chủ quán mới tạo thêm được tài khoản — hãy đăng nhập trước rồi thêm nhân viên.',
          code: 'registration_closed'
        }, 403);
      }
      if (actor.role !== 'OWNER') {
        return json({ error: 'Chỉ chủ quán mới tạo được tài khoản mới', code: 'forbidden' }, 403);
      }
      role = body.role === 'STAFF' ? 'STAFF' : 'OWNER';
    }

    // username là UNIQUE COLLATE NOCASE, nên kiểm tra trước chỉ để có câu lỗi
    // tử tế; ràng buộc ở tầng D1 mới là thứ thật sự chặn đua ghi đồng thời.
    const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(username).first();
    if (existing) {
      return json({ error: `Tên đăng nhập "${username}" đã được sử dụng`, code: 'username_taken' }, 409);
    }

    const salt = newSalt();
    const passwordHash = await hashPassword(body.password, salt);

    const inserted = await env.DB.prepare(`
      INSERT INTO users (username, password_hash, password_salt, password_iterations,
                         full_name, role, phone, email, must_change_password, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      RETURNING *
    `).bind(username, passwordHash, salt, DEFAULT_ITERATIONS,
            fullName, role, phone, email, Date.now()).first();

    const token = await createSession(env, inserted.id, request.headers.get('User-Agent'));

    return json({ token, user: publicUser(inserted), isFirstUser });
  } catch (err) {
    // UNIQUE(username) thua cuộc đua ghi đồng thời rơi vào đây.
    if (/UNIQUE/i.test(err.message)) {
      return json({ error: `Tên đăng nhập "${username}" đã được sử dụng`, code: 'username_taken' }, 409);
    }
    return json({ error: err.message }, 500);
  }
}
