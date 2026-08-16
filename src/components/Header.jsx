import React, { useState, useEffect } from 'react';
import {
  Citrus, PlusCircle, Sun, Moon, BarChart2, BookOpen,
  LogOut, UserCheck, Smartphone, Menu, X,
  TrendingUp, Edit2, Store, Calculator, Settings
} from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onOpenSmsModal,
  onOpenDailyCashModal,
  theme,
  toggleTheme,
  currentUser,
  onLogout,
  onEditProfile,
  storeProfile
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const navigate = (tab) => {
    setActiveTab(tab);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* ── TOP HEADER BAR ─────────────────────────── */}
      <header className="header-bar">
        <div className="header-container">

          {/* Left: Hamburger + Brand */}
          <div className="header-left">
            <button
              className="icon-btn hamburger-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Mở menu"
            >
              <Menu size={20} />
            </button>

            <div className="header-brand" onClick={() => setActiveTab('store-profile')} style={{ cursor: 'pointer' }}>
              <div className="brand-icon">
                {storeProfile?.storeLogo ? (
                  <img src={storeProfile.storeLogo} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <Citrus size={20} color="#FFFFFF" />
                )}
              </div>
              <div className="brand-text">
                <h1>{storeProfile?.storeName || 'JuiceLedger'}</h1>
              </div>
            </div>
          </div>

          {/* Center: Nav Tabs (desktop only) */}
          <nav className="header-nav desktop-nav">
            <button
              className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart2 size={15} />
              <span>Thống Kê</span>
            </button>
            <button
              className={`nav-btn ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setActiveTab('ledger')}
            >
              <BookOpen size={15} />
              <span>Sổ Thu Chi</span>
            </button>
            <button
              className={`nav-btn ${activeTab === 'store-profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('store-profile')}
            >
              <Store size={15} />
              <span>Hồ Sơ Quán</span>
            </button>
            <button
              className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={15} />
              <span>Cài Đặt</span>
            </button>
          </nav>

          {/* Right: Actions */}
          <div className="header-actions">
            <button
              className="btn-primary btn-quick-add"
              onClick={onOpenAddModal}
              title="Ghi nhận giao dịch thu/chi mới (Phím tắt chính)"
            >
              <PlusCircle size={18} />
              <span className="quick-add-text">Ghi Thu / Chi</span>
            </button>

            <button
              className="btn-secondary btn-cash-tally"
              onClick={onOpenDailyCashModal}
              title="Nhập số tiền mặt đầu ngày & cuối ngày (Chốt tiền mặt)"
            >
              <Calculator size={13} color="var(--primary-600)" />
              <span className="btn-cash-text">Chốt Tiền Mặt</span>
            </button>

            <button
              className="btn-secondary btn-sms-action"
              onClick={onOpenSmsModal}
              title="SMS Banking tự động"
            >
              <Smartphone size={13} color="var(--primary-600)" />
              <span className="btn-sms-text">SMS Bank</span>
            </button>

            {currentUser && (
              <div
                className="user-profile-badge desktop-only clickable-badge"
                title="Nhấn để chỉnh sửa hồ sơ"
                onClick={onEditProfile}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onEditProfile(); }}
              >
                <UserCheck size={14} color="var(--primary-500)" />
                <span>{currentUser.fullName}</span>
                <Edit2 size={12} className="edit-profile-icon" />
              </div>
            )}

            <button
              className="icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Chuyển sáng' : 'Chuyển tối'}
            >
              {theme === 'dark'
                ? <Sun size={16} color="#FACC15" />
                : <Moon size={16} color="#475569" />
              }
            </button>

            {currentUser && (
              <button
                className="icon-btn btn-logout-desktop desktop-only"
                onClick={onLogout}
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                <LogOut size={16} color="#EF4444" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── LEFT DRAWER ───────────────────────────── */}
      {/* Backdrop */}
      <div
        className={`drawer-backdrop ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside className={`drawer-panel ${drawerOpen ? 'open' : ''}`} aria-label="Menu điều hướng">

        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-brand" onClick={() => navigate('store-profile')} style={{ cursor: 'pointer' }}>
            <div className="brand-icon">
              {storeProfile?.storeLogo ? (
                <img src={storeProfile.storeLogo} alt="Logo" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <Citrus size={20} color="#FFFFFF" />
              )}
            </div>
            <span className="drawer-brand-name">{storeProfile?.storeName || 'JuiceLedger'}</span>
          </div>
          <button
            className="icon-btn drawer-close-btn"
            onClick={() => setDrawerOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Info */}
        {currentUser && (
          <div
            className="drawer-user-info clickable-badge"
            onClick={() => { setDrawerOpen(false); onEditProfile(); }}
            role="button"
            tabIndex={0}
            title="Nhấn để chỉnh sửa hồ sơ"
          >
            <div className="drawer-user-avatar">
              <UserCheck size={20} color="var(--primary-500)" />
            </div>
            <div className="drawer-user-detail">
              <span className="drawer-user-name">{currentUser.fullName}</span>
              <span className="drawer-user-role">{currentUser.role === 'STAFF' ? 'Nhân Viên Thu Ngân' : 'Chủ Quán / Quản Lý'}</span>
            </div>
            <Edit2 size={14} className="edit-profile-icon" />
          </div>
        )}

        {/* Nav Links */}
        <nav className="drawer-nav">
          <p className="drawer-section-label">ĐIỀU HƯỚNG</p>

          <button
            className={`drawer-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigate('dashboard')}
          >
            <div className="drawer-nav-icon">
              <TrendingUp size={18} />
            </div>
            <span>Thống Kê Tài Chính</span>
          </button>

          <button
            className={`drawer-nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => navigate('ledger')}
          >
            <div className="drawer-nav-icon">
              <BookOpen size={18} />
            </div>
            <span>Sổ Thu Chi</span>
          </button>

          <button
            className={`drawer-nav-item ${activeTab === 'store-profile' ? 'active' : ''}`}
            onClick={() => navigate('store-profile')}
          >
            <div className="drawer-nav-icon">
              <Store size={18} />
            </div>
            <span>Hồ Sơ Cửa Hàng</span>
          </button>

          <button
            className={`drawer-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <div className="drawer-nav-icon">
              <Settings size={18} />
            </div>
            <span>Cài Đặt</span>
          </button>
        </nav>

        {/* Quick Actions */}
        <div className="drawer-actions">
          <p className="drawer-section-label">THAO TÁC NHANH</p>

          <button
            className="drawer-action-btn drawer-action-primary"
            onClick={() => { setDrawerOpen(false); onOpenAddModal(); }}
          >
            <PlusCircle size={17} />
            <span>Ghi Thu / Chi</span>
          </button>

          <button
            className="drawer-action-btn"
            onClick={() => { setDrawerOpen(false); onOpenDailyCashModal(); }}
          >
            <Calculator size={17} color="var(--primary-600)" />
            <span>Chốt Tiền Mặt Đầu/Cuối Ngày</span>
          </button>

          <button
            className="drawer-action-btn"
            onClick={() => { setDrawerOpen(false); onOpenSmsModal(); }}
          >
            <Smartphone size={17} />
            <span>SMS Banking</span>
          </button>

          <button
            className="drawer-action-btn"
            onClick={toggleTheme}
          >
            {theme === 'dark'
              ? <Sun size={17} color="#FACC15" />
              : <Moon size={17} />
            }
            <span>{theme === 'dark' ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}</span>
          </button>
        </div>

        {/* Bottom: Danger Zone */}
        <div className="drawer-footer">
          {currentUser && (
            <button
              className="drawer-action-btn drawer-action-danger"
              onClick={() => { setDrawerOpen(false); onLogout(); }}
            >
              <LogOut size={17} />
              <span>Đăng xuất</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
