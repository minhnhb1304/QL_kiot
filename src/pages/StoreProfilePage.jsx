import React, { useState } from 'react';
import { Store, Edit3, MapPin, Phone, Calendar, Award, Receipt, Citrus } from 'lucide-react';
import StoreProfileEditModal from '../components/StoreProfileEditModal';

export default function StoreProfilePage({
  storeProfile,
  currentUser,
  onUpdateProfile,
  totalTransactions = 0
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const isOwner = currentUser?.role === 'OWNER';

  // Tính số ngày sử dụng ứng dụng
  const calculateAppDays = () => {
    if (!storeProfile?.appStartDate) return 1;
    const start = new Date(storeProfile.appStartDate);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  };

  // Định dạng ngày hiển thị (dd/mm/yyyy)
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Chưa cập nhật';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="store-profile-page">
      {/* Header Card — Logo & Basic Info */}
      <div className="card sp-header-card">
        <div className="sp-logo-area">
          {storeProfile?.storeLogo ? (
            <img src={storeProfile.storeLogo} alt="Logo Cửa Hàng" />
          ) : (
            <Citrus size={40} className="text-emerald-600" />
          )}
        </div>

        <div className="sp-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 className={`sp-store-name ${!storeProfile?.storeName ? 'placeholder-name' : ''}`}>
                {storeProfile?.storeName || 'JuiceLedger Store'}
              </h2>
              {storeProfile?.storeSlogan && (
                <div className="sp-slogan">"{storeProfile.storeSlogan}"</div>
              )}
            </div>

            {isOwner && (
              <button
                className="btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                onClick={() => setIsEditModalOpen(true)}
              >
                <Edit3 size={15} /> Chỉnh sửa hồ sơ
              </button>
            )}
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {storeProfile?.storeAddress && (
              <div className="sp-address">
                <MapPin size={14} className="text-emerald-500" /> {storeProfile.storeAddress}
              </div>
            )}
            {storeProfile?.storePhone && (
              <div className="sp-address">
                <Phone size={14} className="text-emerald-500" /> {storeProfile.storePhone}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Milestone / Stats Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Award size={18} className="text-emerald-500" /> Thống Kê Hành Trình
          </h3>
        </div>

        <div className="sp-milestones">
          <div className="sp-milestone-item">
            <div className="sp-milestone-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <Calendar size={20} />
            </div>
            <div>
              <span className="sp-milestone-label">Ngày mở quán</span>
              <span className="sp-milestone-value">
                {formatDate(storeProfile?.businessStartDate)}
              </span>
            </div>
          </div>

          <div className="sp-milestone-item">
            <div className="sp-milestone-icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
              <Calendar size={20} />
            </div>
            <div>
              <span className="sp-milestone-label">Thời gian dùng app</span>
              <span className="sp-milestone-value">
                {calculateAppDays()} ngày ({formatDate(storeProfile?.appStartDate)})
              </span>
            </div>
          </div>

          <div className="sp-milestone-item">
            <div className="sp-milestone-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <Receipt size={20} />
            </div>
            <div>
              <span className="sp-milestone-label">Tổng số giao dịch</span>
              <span className="sp-milestone-value">{totalTransactions} giao dịch</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Chỉnh Sửa */}
      {isOwner && (
        <StoreProfileEditModal
          storeProfile={storeProfile}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={onUpdateProfile}
        />
      )}
    </div>
  );
}
