import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({ isOpen, title, message, confirmText, cancelText, variant, onConfirm, onCancel }) {
  if (!isOpen) return null;
  
  const variantColor = variant === 'danger' ? 'var(--expense-red-500)' : 'var(--primary-500)';
  
  return (
    <div className="modal-overlay confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon" style={{ color: variantColor }}>
          <AlertTriangle size={28} />
        </div>
        <h3 className="confirm-title">{title || 'Xác nhận'}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelText || 'Hủy'}
          </button>
          <button 
            className="btn-primary" 
            style={{ background: variantColor }}
            onClick={onConfirm}
          >
            {confirmText || 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
