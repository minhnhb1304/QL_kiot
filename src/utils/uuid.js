// Sinh UUID v4 làm danh tính đồng bộ xuyên thiết bị.
// crypto.randomUUID() CHỈ tồn tại trong secure context (https / localhost).
// Khi test trên điện thoại qua LAN (http://192.168.x.x:5173) nó là undefined,
// nên phải có đường lùi bằng crypto.getRandomValues() — hàm này luôn có.
export function newUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Đường lùi cuối: không an toàn về mật mã nhưng vẫn đủ duy nhất để làm khóa
  return 'uuid-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 14);
}

// Dấu thời gian đồng bộ: epoch mili giây, dùng để phân xử last-write-wins
export function syncNow() {
  return Date.now();
}
