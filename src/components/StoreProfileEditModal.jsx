import React, { useState } from 'react';
import { Store, X, Save } from 'lucide-react';

export default function StoreProfileEditModal({ storeProfile, isOpen, onClose, onSave }) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    storeName: storeProfile?.storeName || '',
    storeSlogan: storeProfile?.storeSlogan || '',
    storeAddress: storeProfile?.storeAddress || '',
    storePhone: storeProfile?.storePhone || '',
    businessStartDate: storeProfile?.businessStartDate || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (formData.storeName && formData.storeName.trim().length > 50) {
        throw new Error('Tên cửa hàng tối đa 50 ký tự');
      }
      if (formData.storePhone && formData.storePhone.trim() && !/^[0-9]{9,11}$/.test(formData.storePhone.trim())) {
        throw new Error('SĐT cửa hàng phải từ 9-11 chữ số');
      }

      await onSave({
        storeName: formData.storeName.trim(),
        storeSlogan: formData.storeSlogan.trim(),
        storeAddress: formData.storeAddress.trim(),
        storePhone: formData.storePhone.trim(),
        businessStartDate: formData.businessStartDate
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi lưu thông tin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content store-profile-edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            <Store size={20} className="text-emerald-500" /> Chỉnh Sửa Hồ Sơ Cửa Hàng
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && <div className="modal-error-alert">{error}</div>}

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tên Cửa Hàng</label>
            <input
              type="text"
              name="storeName"
              className="form-input"
              placeholder="VD: Quán Nước Ép ABC"
              maxLength={50}
              value={formData.storeName}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Khẩu Hiệu / Slogan</label>
            <input
              type="text"
              name="storeSlogan"
              className="form-input"
              placeholder="VD: Tươi ngon nguyên chất mỗi ngày"
              maxLength={100}
              value={formData.storeSlogan}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Số Điện Thoại</label>
              <input
                type="tel"
                name="storePhone"
                className="form-input"
                placeholder="VD: 0901234567"
                value={formData.storePhone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ngày Khai Trương / Mở Quán</label>
              <input
                type="date"
                name="businessStartDate"
                className="form-input"
                max={new Date().toISOString().split('T')[0]}
                value={formData.businessStartDate}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Địa Chỉ Cửa Hàng</label>
            <input
              type="text"
              name="storeAddress"
              className="form-input"
              placeholder="VD: 123 Nguyễn Huệ, Quận 1, TP.HCM"
              maxLength={200}
              value={formData.storeAddress}
              onChange={handleChange}
            />
          </div>

          <div className="profile-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              <Save size={16} /> {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
