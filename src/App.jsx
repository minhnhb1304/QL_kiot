import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import LedgerPage from './pages/LedgerPage';
import StoreProfilePage from './pages/StoreProfilePage';
import LoginPage from './pages/LoginPage';
import TransactionFormModal from './components/TransactionFormModal';
import SmsAutomationModal from './components/SmsAutomationModal';
import ProfileEditModal from './components/ProfileEditModal';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { storeProfileService } from './services/storeProfileService';
import ConfirmDialog from './components/ConfirmDialog';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/global.css';
import './styles/dashboard.css';
import './styles/mobile.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('jl_theme') || 'light');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [storeProfile, setStoreProfile] = useState(null);

  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);

  // Date Range filter for Dashboard ('TODAY', 'WEEK', 'MONTH', 'ALL')
  const [dateRange, setDateRange] = useState({ rangeType: 'MONTH' });

  // Auto-login on mount if saved session exists
  useEffect(() => {
    const existingSession = authService.getSession();
    if (existingSession) {
      setSession(existingSession);
    }
  }, []);

  // Load store profile when session is available
  useEffect(() => {
    if (session?.user) {
      const ownerUsername = session.user.role === 'OWNER'
        ? session.user.username
        : 'admin';
      storeProfileService.getOrCreateProfile(ownerUsername)
        .then(setStoreProfile)
        .catch(err => console.error('Error loading store profile:', err));
    }
  }, [session]);

  const handleUpdateStoreProfile = async (updates) => {
    if (!session?.user) return;
    const ownerUsername = session.user.role === 'OWNER'
      ? session.user.username
      : 'admin';
    const updated = await storeProfileService.updateProfile(ownerUsername, updates);
    setStoreProfile(updated);
    showToast('Đã cập nhật hồ sơ cửa hàng', 'success');
  };

  // Sync theme attribute to HTML tag
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jl_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Calculate start & end date strings based on rangeType
  const getDateRangeFilter = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (dateRange.rangeType === 'TODAY') {
      return { startDate: todayStr, endDate: todayStr };
    }

    if (dateRange.rangeType === 'WEEK') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return { startDate: d.toISOString().split('T')[0], endDate: todayStr };
    }

    if (dateRange.rangeType === 'MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      return { startDate: firstDay, endDate: todayStr };
    }

    if (dateRange.rangeType && dateRange.rangeType.startsWith('MONTH_')) {
      const yearMonth = dateRange.rangeType.replace('MONTH_', '');
      const [yearStr, monthStr] = yearMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, month, 0).toISOString().split('T')[0];
      return { startDate: firstDay, endDate: lastDay };
    }

    return {}; // ALL
  };

  // Load Categories, Transactions & Stats
  const loadData = async () => {
    try {
      const cats = await storageService.getCategories();
      setCategories(cats);

      // Load ALL transactions for LedgerPage (independent of Dashboard date range)
      const txs = await storageService.getTransactions({});
      setTransactions(txs);

      // Load Summary Stats specifically for Dashboard's date range
      const filter = getDateRangeFilter();
      const summaryStats = await storageService.getStats(filter.startDate, filter.endDate);
      setStats(summaryStats);
    } catch (err) {
      console.error('Lỗi load dữ liệu:', err);
    }
  };

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, dateRange]);

  // Handle adding new transaction
  const handleSaveTransaction = async (formData) => {
    await storageService.addTransaction(formData);
    await loadData();
    showToast('Đã lưu giao dịch mới!', 'success');
  };

  // Handle parsing & processing SMS Banking text
  const handleProcessSms = async (smsText) => {
    const parsed = storageService.parseSmsMessage(smsText, categories);
    if (!parsed) {
      showToast('Không đọc được thông tin giao dịch từ SMS!', 'error');
      return false;
    }
    await storageService.addTransaction(parsed);
    await loadData();
    showToast(`Tự động ghi nhận ${parsed.type === 'IN' ? 'Thu' : 'Chi'}: ${parsed.amount.toLocaleString('vi-VN')}đ`, 'success');
    return true;
  };

  // Handle deleting transaction
  const handleDeleteTransaction = async (id) => {
    setConfirmDialog({
      title: 'Xóa giao dịch',
      message: 'Bạn có chắc chắn muốn xóa giao dịch này không?',
      variant: 'danger',
      onConfirm: async () => {
        await storageService.deleteTransaction(id);
        await loadData();
        setConfirmDialog(null);
        showToast('Đã xóa giao dịch', 'info');
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // Reset demo data
  const handleResetData = () => {
    setConfirmDialog({
      title: 'Khôi phục dữ liệu gốc',
      message: 'Bạn có muốn tải lại dữ liệu mẫu cho quán nước ép không?',
      variant: 'danger',
      onConfirm: async () => {
        await storageService.resetData();
        await loadData();
        setConfirmDialog(null);
        showToast('Đã khôi phục dữ liệu', 'success');
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // Handle Login & Logout
  const handleLoginSuccess = (newSession) => {
    setSession(newSession);
  };

  const handleLogout = () => {
    authService.logout();
    setSession(null);
  };

  // Handle profile update
  const handleUpdateProfile = async (profileData) => {
    const updatedSession = await authService.updateUserProfile(profileData);
    if (updatedSession) {
      setSession({ ...updatedSession });
      showToast('Đã cập nhật hồ sơ thành công', 'success');
    }
  };

  // If user is not logged in, show Login Page
  if (!session) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <ErrorBoundary>
      <div className="app-root">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddModal={() => setIsModalOpen(true)}
        onOpenSmsModal={() => setIsSmsModalOpen(true)}
        theme={theme}
        toggleTheme={toggleTheme}
        onResetData={handleResetData}
        currentUser={session?.user}
        onLogout={handleLogout}
        onEditProfile={() => setIsProfileModalOpen(true)}
        storeProfile={storeProfile}
      />

      {/* Main Container */}
      <main className="app-container">
        {activeTab === 'dashboard' && (
          <Dashboard
            stats={stats}
            dateRange={dateRange}
            setDateRange={setDateRange}
            theme={theme}
            onOpenAddModal={() => setIsModalOpen(true)}
            transactions={transactions}
          />
        )}
        {activeTab === 'ledger' && (
          <LedgerPage
            transactions={transactions}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenAddModal={() => setIsModalOpen(true)}
          />
        )}
        {activeTab === 'store-profile' && (
          <StoreProfilePage
            storeProfile={storeProfile}
            currentUser={session?.user}
            onUpdateProfile={handleUpdateStoreProfile}
            totalTransactions={transactions.length}
          />
        )}
      </main>

      {/* Modal Quick Transaction Entry */}
      <TransactionFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
        categories={categories}
      />

      {/* Modal SMS Automation & Simulator */}
      <SmsAutomationModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        onSmsProcessed={handleProcessSms}
      />

      {/* Profile Edit Modal */}
      <ProfileEditModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={session?.user}
        onSave={handleUpdateProfile}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        variant={confirmDialog?.variant}
        onConfirm={confirmDialog?.onConfirm}
        onCancel={confirmDialog?.onCancel}
      />
    </div>
    </ErrorBoundary>
  );
}
