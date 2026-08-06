import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Store, Edit3, MapPin, Phone, Calendar, Award, Receipt, Citrus, StickyNote, Target, Crown, Flame } from 'lucide-react';
import StoreProfileEditModal from '../components/StoreProfileEditModal';
import { storeProfileService } from '../services/storeProfileService';
import { storageService } from '../services/storageService';
import { createCurrencyFormatter } from '../utils/currency';

export default function StoreProfilePage({
  storeProfile,
  currentUser,
  onUpdateProfile,
  totalTransactions = 0,
  currentMonthRevenue = 0
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [peakMonth, setPeakMonth] = useState(null);
  const [notes, setNotes] = useState(storeProfile?.storeNotes || '');
  const saveTimeoutRef = useRef(null);

  const isOwner = currentUser?.role === 'OWNER';

  const currencyFormatter = useMemo(
    () => createCurrencyFormatter(storeProfile?.currency || 'VND'),
    [storeProfile?.currency]
  );

  useEffect(() => {
    setNotes(storeProfile?.storeNotes || '');
  }, [storeProfile?.storeNotes]);

  // Load Streak & Peak Revenue Month
  useEffect(() => {
    let isMounted = true;
    
    storeProfileService.calculateStreak()
      .then(s => { if (isMounted) setStreak(s); })
      .catch(err => console.error('Lỗi tính streak:', err));

    storageService.getPeakRevenueMonth()
      .then(p => { if (isMounted) setPeakMonth(p); })
      .catch(err => console.error('Lỗi tính peak month:', err));

    return () => { isMounted = false; };
  }, [totalTransactions]);

  const handleNotesChange = (value) => {
    setNotes(value);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onUpdateProfile({ storeNotes: value });
    }, 800);
  };

  // Calculate App Days
  const calculateAppDays = () => {
    if (!storeProfile?.appStartDate) return 1;
    const start = new Date(storeProfile.appStartDate);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays || 1;
  };

  // Format Date dd/mm/yyyy
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Chưa cập nhật';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Revenue Goal Progress
  const goalProgress = useMemo(() => {
    if (!storeProfile?.monthlyRevenueGoal || storeProfile.monthlyRevenueGoal <= 0) return null;
    const goal = storeProfile.monthlyRevenueGoal;
    const current = currentMonthRevenue || 0;
    const percent = Math.min((current / goal) * 100, 100);
    return { goal, current, percent };
  }, [storeProfile?.monthlyRevenueGoal, currentMonthRevenue]);

  return (
    <div className="store-profile-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Card — Logo & Basic Info */}
      <div className="card sp-header-card">
        <div className="sp-logo-area">
          {storeProfile?.storeLogo ? (
            <img src={storeProfile.storeLogo} alt="Logo Cửa Hàng" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
            <Award size={18} className="text-emerald-500" /> Thống Kê Hành Trình & Cột Mốc
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
              <span className="sp-milestone-label">Tổng số giao dịch (All-time)</span>
              <span className="sp-milestone-value">{totalTransactions} giao dịch</span>
            </div>
          </div>

          {/* Phase 2: Streak */}
          <div className="sp-milestone-item">
            <div className="sp-milestone-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <Flame size={20} />
            </div>
            <div>
              <span className="sp-milestone-label">Chuỗi ghi sổ liên tiếp</span>
              <span className="sp-milestone-value">{streak} ngày</span>
            </div>
          </div>

          {/* Phase 3: Peak Month */}
          {peakMonth && (
            <div className="sp-milestone-item">
              <div className="sp-milestone-icon" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: '#eab308' }}>
                <Crown size={20} />
              </div>
              <div>
                <span className="sp-milestone-label">Tháng doanh thu cao nhất</span>
                <span className="sp-milestone-value">
                  {peakMonth.label} — {currencyFormatter(peakMonth.amount)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Monthly Revenue Goal Card (Phase 2 & 3) */}
      {goalProgress && (
        <div className="card revenue-goal-card" style={{ padding: '1.25rem' }}>
          <div className="rg-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            <Target size={16} className="text-emerald-500" />
            <span>Mục Tiêu Doanh Thu Tháng Này</span>
          </div>
          <div className="rg-amounts" style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.75rem' }}>
            <span className="rg-current" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-500)' }}>
              {currencyFormatter(goalProgress.current)}
            </span>
            <span className="rg-divider" style={{ color: 'var(--text-light)' }}>/</span>
            <span className="rg-goal" style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              {currencyFormatter(goalProgress.goal)}
            </span>
          </div>
          <div className="rg-bar-track" style={{ height: '10px', borderRadius: '9999px', backgroundColor: 'var(--bg-main)', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div
              className="rg-bar-fill"
              style={{
                width: `${goalProgress.percent}%`,
                height: '100%',
                borderRadius: '9999px',
                background: 'linear-gradient(90deg, var(--primary-500), #34D399)',
                transition: 'width 0.6s ease-in-out'
              }}
            />
          </div>
          <span className="rg-percent" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-600)' }}>
            {goalProgress.percent.toFixed(1)}% Hoàn thành
          </span>
        </div>
      )}

      {/* Store Notes Card (Phase 2) */}
      <div className="card sp-notes-card" style={{ padding: '1.25rem' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700 }}>
          <StickyNote size={18} className="text-amber-500" /> Ghi Chú & Kế Hoạch Cửa Hàng
        </h4>
        <textarea
          className="form-textarea sp-notes-textarea"
          placeholder="Ghi nhớ, kế hoạch hoặc lưu ý quan trọng cho cửa hàng..."
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          rows={4}
          maxLength={1000}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-main)', resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
          {notes.length}/1000 Ký tự (Tự động lưu)
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
