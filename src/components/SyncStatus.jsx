import React from 'react';
import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';

// Chỉ báo trạng thái đồng bộ.
//
// Vì sao cần: từ khi có nhiều thiết bị, "sổ trên máy này" và "sổ của quán"
// không còn là một. Khi mạng chập chờn, chủ quán phải nhìn được ngay là giao
// dịch vừa ghi đã lên máy chủ chưa — nếu không, người ta sẽ ghi lại lần nữa ở
// máy kia và sổ có hai dòng cho một lần bán.
const LOOK = {
  syncing: { Icon: RefreshCw, label: 'Đang đồng bộ', title: 'Đang gửi và nhận dữ liệu với máy chủ', cls: 'is-syncing' },
  idle:    { Icon: Cloud,     label: 'Đã đồng bộ',   title: 'Sổ trên máy này khớp với máy chủ',      cls: 'is-idle' },
  offline: { Icon: CloudOff,  label: 'Ngoại tuyến',  title: 'Mất kết nối — vẫn ghi sổ được, sẽ tự đẩy lên khi có mạng', cls: 'is-offline' },
  error:   { Icon: AlertTriangle, label: 'Lỗi đồng bộ', title: 'Máy chủ trả lỗi — dữ liệu vẫn an toàn trên máy này', cls: 'is-error' }
};

export default function SyncStatus({ state = 'idle', onClick }) {
  const { Icon, label, title, cls } = LOOK[state] || LOOK.idle;

  return (
    <button
      type="button"
      className={`sync-status ${cls}`}
      title={`${title}. Nhấn để đồng bộ ngay.`}
      onClick={onClick}
      aria-label={label}
    >
      <Icon size={13} />
      <span className="sync-status-text">{label}</span>
    </button>
  );
}
