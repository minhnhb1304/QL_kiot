import React, { useState, useEffect } from 'react';
import { X, User, Phone, Mail, Save, AlertCircle } from 'lucide-react';

export default function ProfileEditModal({ isOpen, onClose, currentUser, onSave }) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync form when modal opens or user changes
  useEffect(() => {
    if (isOpen && currentUser) {
      setFullName(currentUser.fullName || '');
      setPhone(currentUser.phone || '');
      setEmail(currentUser.email || '');
      setErrorMsg('');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSaving(true);
    try {
      await onSave({
        username: currentUser.username,
        fullName,
        phone,
        email
      });
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content profile-edit-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            <User size={18} />
            Chỉnh Sửa Hồ Sơ
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="modal-form">
          {errorMsg && (
            <div className="profile-error-msg">
              <AlertCircle size={15} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Tên Hiển Thị <span className="req-star">*</span></label>
            <div className="input-icon-wrapper">
              <User size={18} className="input-icon" />
              <input
                type="text"
                className="form-input icon-input"
                placeholder="Nhập tên bạn muốn hiển thị"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <span className="field-hint">Tên này sẽ hiển thị trên giao diện thay vì tên mặc định</span>
          </div>

          <div className="form-group">
            <label className="form-label">Số Điện Thoại</label>
            <div className="input-icon-wrapper">
              <Phone size={18} className="input-icon" />
              <input
                type="tel"
                className="form-input icon-input"
                placeholder="0901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="input-icon-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                className="form-input icon-input"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="profile-modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSaving}
            >
              <Save size={15} />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
