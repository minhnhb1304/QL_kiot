import React, { useState, useEffect } from 'react';
import { Store, X, Save, Upload, Camera, Trash2, DollarSign, Calendar, Target } from 'lucide-react';

export default function StoreProfileEditModal({ storeProfile, isOpen, onClose, onSave }) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState({
    storeName: storeProfile?.storeName || '',
    storeSlogan: storeProfile?.storeSlogan || '',
    storeAddress: storeProfile?.storeAddress || '',
    storePhone: storeProfile?.storePhone || '',
    businessStartDate: storeProfile?.businessStartDate || '',
    currency: storeProfile?.currency || 'VND',
    monthlyRevenueGoal: storeProfile?.monthlyRevenueGoal || 0,
    financialMonthStartDay: storeProfile?.financialMonthStartDay || 1,
  });

  const [logoPreview, setLogoPreview] = useState(storeProfile?.storeLogo || null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData({
      storeName: storeProfile?.storeName || '',
      storeSlogan: storeProfile?.storeSlogan || '',
      storeAddress: storeProfile?.storeAddress || '',
      storePhone: storeProfile?.storePhone || '',
      businessStartDate: storeProfile?.businessStartDate || '',
      currency: storeProfile?.currency || 'VND',
      monthlyRevenueGoal: storeProfile?.monthlyRevenueGoal || 0,
      financialMonthStartDay: storeProfile?.financialMonthStartDay || 1,
    });
    setLogoPreview(storeProfile?.storeLogo || null);
  }, [storeProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Chỉ chấp nhận file ảnh (PNG, JPG, WebP)');
      return;
    }
    if (file.size > 512000) {
      setError('Kích thước ảnh quá lớn (tối đa 500KB)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);

        setLogoPreview(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
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
      if (Number(formData.monthlyRevenueGoal) < 0) {
        throw new Error('Mục tiêu doanh thu phải lớn hơn hoặc bằng 0');
      }

      await onSave({
        storeName: formData.storeName.trim(),
        storeSlogan: formData.storeSlogan.trim(),
        storeAddress: formData.storeAddress.trim(),
        storePhone: formData.storePhone.trim(),
        businessStartDate: formData.businessStartDate,
        storeLogo: logoPreview,
        currency: formData.currency,
        monthlyRevenueGoal: Number(formData.monthlyRevenueGoal),
        financialMonthStartDay: Number(formData.financialMonthStartDay)
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
          {/* Logo Upload Section */}
          <div className="form-group">
            <label className="form-label">Logo Cửa Hàng</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '12px',
                  border: '2px dashed var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-main)',
                  flexShrink: 0
                }}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Camera size={24} style={{ color: 'var(--text-light)' }} />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Upload size={14} /> Chọn Ảnh Logo
                  <input type="file" accept="image/*" hidden onChange={handleLogoUpload} />
                </label>
                {logoPreview && (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={() => setLogoPreview(null)}
                  >
                    <Trash2 size={12} /> Xóa logo
                  </button>
                )}
              </div>
            </div>
          </div>

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
              <label className="form-label">Ngày Mở Quán</label>
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

          {/* Phase 3 Options: Currency & Financial Month */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                <DollarSign size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Đơn Vị Tiền Tệ
              </label>
              <select
                name="currency"
                className="form-select"
                value={formData.currency}
                onChange={handleChange}
              >
                <option value="VND">VND (₫)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Calendar size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Bắt Đầu Tháng Tài Chính
              </label>
              <select
                name="financialMonthStartDay"
                className="form-select"
                value={formData.financialMonthStartDay}
                onChange={handleChange}
              >
                {[1, 5, 10, 15, 20, 25].map(d => (
                  <option key={d} value={d}>Ngày {d} hàng tháng</option>
                ))}
              </select>
            </div>
          </div>
          <span className="field-hint" style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '-0.5rem', marginBottom: '0.75rem', display: 'block' }}>
            * Nếu chọn ngày 15, tháng tài chính sẽ tính từ ngày 15 tháng trước đến ngày 14 tháng này.
          </span>

          <div className="form-group">
            <label className="form-label">
              <Target size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Mục Tiêu Doanh Thu Tháng ({formData.currency})
            </label>
            <input
              type="number"
              name="monthlyRevenueGoal"
              className="form-input"
              placeholder="VD: 50000000"
              min="0"
              step="1000"
              value={formData.monthlyRevenueGoal}
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
