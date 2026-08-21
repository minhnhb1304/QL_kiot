// Xác thực phía máy chủ cho các Cloudflare Pages Function.
//
// Nằm ngoài thư mục functions/ vì cùng lý do đã ghi ở shared/d1.js: mọi file
// trong functions/ đều biến thành một route HTTP.
//
// Vì sao phải có: sổ nằm trên một URL công khai và client là JavaScript trong
// trình duyệt, nên không giấu nổi một secret dùng chung — ai mở được trang là
// đọc được nó trong bundle. Phiên đăng nhập là cách duy nhất phân biệt được
// "chủ quán" với "người lạ đi ngang".

import { sha256Hex } from './d1.js';

// PBKDF2 vì Workers không có bcrypt/argon2 (schema.sql:24). 100k vòng là mức
// OWASP khuyến nghị cho PBKDF2-SHA256 và vẫn nằm gọn trong giới hạn CPU của
// một request Pages Function.
const ITERATIONS = 100_000;
const KEY_BITS = 256;

// 30 ngày: quán dùng hằng ngày, bắt đăng nhập lại hàng tuần chỉ gây phiền.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(byteLength) {
  return toHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export function newSalt() {
  return randomHex(16);
}

// ─────────────────────────────────────────────────────────
// Băm mật khẩu
//
// iterations là tham số chứ không phải hằng số vì nó được lưu theo từng dòng
// users. Khi cần tăng số vòng cho tài khoản mới, tài khoản cũ vẫn xác minh
// được bằng đúng số vòng đã dùng lúc đăng ký.
// ─────────────────────────────────────────────────────────
export async function hashPassword(password, salt, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations,
      hash: 'SHA-256'
    },
    key,
    KEY_BITS
  );

  return toHex(new Uint8Array(bits));
}

// So sánh theo thời gian hằng: dừng sớm ở byte đầu tiên khác nhau sẽ rò rỉ
// thông tin về giá trị băm qua thời gian phản hồi.
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPassword(userRow, password) {
  if (!userRow?.password_hash || !userRow?.password_salt) return false;
  const computed = await hashPassword(
    password,
    userRow.password_salt,
    userRow.password_iterations || ITERATIONS
  );
  return timingSafeEqual(computed, userRow.password_hash);
}

export const DEFAULT_ITERATIONS = ITERATIONS;

// ─────────────────────────────────────────────────────────
// Phiên đăng nhập
//
// Bảng sessions CHỈ lưu SHA-256 của token (schema.sql:42). Rò rỉ bảng đó không
// cho phép ai mạo danh: từ giá trị băm không dựng ngược ra token được.
// ─────────────────────────────────────────────────────────
export async function createSession(env, userId, userAgent = null) {
  const token = randomHex(32);
  const now = Date.now();

  await env.DB.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at, user_agent)
    VALUES (?, ?, ?, ?, ?)
  `).bind(await sha256Hex(token), userId, now, now + SESSION_TTL_MS, userAgent).run();

  return token;
}

export function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

// Trả về dòng users nếu token hợp lệ và chưa hết hạn, ngược lại null.
export async function getSessionUser(env, request) {
  const token = bearerToken(request);
  if (!token) return null;

  const row = await env.DB.prepare(`
    SELECT u.*, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
  `).bind(await sha256Hex(token)).first();

  if (!row) return null;

  if (row.expires_at <= Date.now()) {
    // Dọn luôn dòng đã hết hạn: bảng sessions không có tiến trình quét định kỳ
    // nào cả, nếu không dọn ở đây thì nó chỉ có phình ra.
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256Hex(token)).run();
    return null;
  }

  return row;
}

export async function deleteSession(env, request) {
  const token = bearerToken(request);
  if (!token) return false;
  const result = await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
    .bind(await sha256Hex(token)).run();
  return (result.meta?.changes ?? 0) > 0;
}

// ─────────────────────────────────────────────────────────
// Hình dạng user trả về client
//
// camelCase để khớp với thứ UI đang dùng sẵn (session.user.fullName ở
// App.jsx, LoginPage.jsx). Ba cột mật khẩu không bao giờ được lọt ra ngoài.
// ─────────────────────────────────────────────────────────
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone || '',
    email: row.email || ''
  };
}

// ─────────────────────────────────────────────────────────
// Cổng chung cho các endpoint dữ liệu
//
// Chấp nhận HAI đường vào, không có đường thứ ba:
//   - phiên đăng nhập  → app trong trình duyệt
//   - x-sync-secret    → máy-với-máy (scripts/test-sync-api.mjs, curl chẩn đoán)
//
// KHÔNG có ngoại lệ "chưa cấu hình gì thì để mở". Nghe thì tiện cho lần chạy
// đầu, nhưng nó có nghĩa là bất kỳ deploy nào chưa kịp đặt SYNC_SECRET và chưa
// có tài khoản đều phơi nguyên cả sổ ra Internet — đúng cảnh môi trường preview
// rơi vào. Mà cũng không cần: /api/auth/register tự kiểm tra bảng users chứ
// không đi qua cổng này, nên chủ quán vẫn đăng ký được từ một hệ thống đóng kín.
// ─────────────────────────────────────────────────────────
export async function authorizeDataRequest(env, request, bodySecret = null) {
  const provided = request.headers.get('x-sync-secret') || bodySecret;
  if (env.SYNC_SECRET && provided === env.SYNC_SECRET) {
    return { ok: true, via: 'secret', user: null };
  }

  const user = await getSessionUser(env, request);
  if (user) return { ok: true, via: 'session', user };

  return { ok: false, via: null, user: null };
}
