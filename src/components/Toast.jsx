import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => onDismiss(), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 size={18} />,
    error: <XCircle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <div className={`toast toast-${toast.type || 'info'}`}>
      <div className="toast-icon">{icons[toast.type] || icons.info}</div>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}
