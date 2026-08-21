// Lớp bọc fetch mỏng cho các endpoint /api/* của Pages Functions.
//
// Lý do tồn tại: authService và syncService đều phải phân biệt được ba tình
// huống rất khác nhau mà fetch gộp chung thành "lỗi":
//
//   offline      — không gọi tới nơi. App phải chạy tiếp bằng dữ liệu cục bộ,
//                  KHÔNG được coi là đăng nhập sai hay đồng bộ thất bại vĩnh viễn.
//   unauthorized — token hỏng hoặc hết hạn. Phải đưa người dùng về màn đăng nhập.
//   http         — máy chủ trả lỗi có nội dung. Hiện câu lỗi của máy chủ.
//
// Trộn ba thứ này lại là cách chắc chắn nhất để mất dữ liệu của quán khi mạng
// chập chờn — thứ xảy ra hằng ngày với một cái điện thoại trong quán nước.

export const SESSION_KEY = 'jl_auth_session';

export class ApiError extends Error {
  constructor(message, { kind = 'http', status = 0, code = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

export function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Chế độ riêng tư của Safari ném lỗi ở đây. Phiên chỉ sống trong bộ nhớ,
    // vẫn dùng app được đến khi tải lại trang — không đáng để chặn đăng nhập.
  }
}

export function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch { /* như trên */ }
}

export function getToken() {
  return readStoredSession()?.token || null;
}

// Trả về body đã parse. Ném ApiError cho mọi trường hợp không phải 2xx.
export async function apiFetch(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (err) {
    // TypeError của fetch = không tới được máy chủ: mất mạng, DNS hỏng, bị chặn.
    throw new ApiError(err?.name === 'AbortError' ? 'Yêu cầu bị huỷ' : 'Không kết nối được máy chủ', {
      kind: err?.name === 'AbortError' ? 'aborted' : 'offline'
    });
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // 502/504 từ tầng biên trả về HTML chứ không phải JSON.
    payload = null;
  }

  if (response.ok) return payload;

  const message = payload?.error || `Máy chủ trả lỗi ${response.status}`;
  throw new ApiError(message, {
    kind: response.status === 401 ? 'unauthorized' : 'http',
    status: response.status,
    code: payload?.code || null
  });
}

// Chỉ là gợi ý: trình duyệt báo online không đảm bảo ra được Internet, nên
// đừng dùng nó để chặn request — chỉ dùng để chọn thời điểm thử lại.
export function isProbablyOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}
