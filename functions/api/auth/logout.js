// Cloudflare Pages Function: POST /api/auth/logout
//
// Xoá dòng phiên tương ứng với token đang gửi. Token không tồn tại cũng trả
// 200: đăng xuất là thao tác idempotent, và báo lỗi ở đây chỉ khiến client
// phải xử lý một nhánh không có ý nghĩa gì với người dùng.

import { json } from '../../../shared/d1.js';
import { deleteSession } from '../../../shared/auth.js';

export async function onRequestPost(context) {
  const { env, request } = context;
  try {
    const removed = await deleteSession(env, request);
    return json({ success: true, removed });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
