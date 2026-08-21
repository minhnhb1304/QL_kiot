import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import LedgerPage from './pages/LedgerPage';
import StoreProfilePage from './pages/StoreProfilePage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import TransactionFormModal from './components/TransactionFormModal';
import SmsAutomationModal from './components/SmsAutomationModal';
import ProfileEditModal from './components/ProfileEditModal';
import DailyCashModal from './components/DailyCashModal';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { storeProfileService } from './services/storeProfileService';
import { createCurrencyFormatter } from './utils/currency';
import ConfirmDialog from './components/ConfirmDialog';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/global.css';
import './styles/dashboard.css';
import './styles/mobile.css';
import './styles/quicknotes.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('jl_theme') || 'light');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

  const handleOpenAddModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEditTransaction = (tx) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };
  const [isDailyCashModalOpen, setIsDailyCashModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [storeProfile, setStoreProfile] = useState(null);

  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [expensePresets, setExpensePresets] = useState([]);

  // Date Range filter for Dashboard ('TODAY', 'WEEK', 'MONTH', 'ALL')
  const [dateRange, setDateRange] = useState({ rangeType: 'MONTH' });

  // Currency Formatter based on storeProfile.currency
  const formatCurrency = useMemo(
    () => createCurrencyFormatter(storeProfile?.currency || 'VND'),
    [storeProfile?.currency]
  );

  // Auto-login on mount if saved session exists
  useEffect(() => {
    const existingSession = authService.getSession();
    if (existingSession) {
      setSession(existingSession);
    }
  }, []);

  // Load store profile when session is available.
  // Hồ sơ cửa hàng dùng chung cho cả quán nên không phụ thuộc tài khoản đăng
  // nhập — chủ hay nhân viên đều thấy và sửa cùng một hồ sơ.
  useEffect(() => {
    if (session?.user) {
      storeProfileService.getOrCreateProfile()
        .then(setStoreProfile)
        .catch(err => console.error('Error loading store profile:', err));
    }
  }, [session]);

  const handleUpdateStoreProfile = async (updates) => {
    if (!session?.user) return;
    const updated = await storeProfileService.updateProfile(updates);
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

  // Load Categories, Transactions & Stats
  const loadData = useCallback(async () => {
    try {
      const cats = await storageService.getCategories();
      setCategories(cats);

      // Load quick expense presets (Mẫu chi nhanh)
      const presets = await storageService.getExpensePresets();
      setExpensePresets(presets);

      // Load ALL transactions for LedgerPage (independent of Dashboard date range)
      const txs = await storageService.getTransactions({});
      setTransactions(txs);

      // Calculate start & end date strings based on rangeType and financialMonthStartDay
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      let filter = {};

      if (dateRange.rangeType === 'TODAY') {
        filter = { startDate: todayStr, endDate: todayStr };
      } else if (dateRange.rangeType === 'WEEK') {
        const d = new Date(today);
        d.setDate(d.getDate() - 7);
        filter = { startDate: d.toISOString().split('T')[0], endDate: todayStr };
      } else if (dateRange.rangeType === 'MONTH') {
        const startDay = storeProfile?.financialMonthStartDay || 1;
        let startDate;
        if (today.getDate() >= startDay) {
          startDate = new Date(today.getFullYear(), today.getMonth(), startDay);
        } else {
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, startDay);
        }
        filter = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: todayStr
        };
      } else if (dateRange.rangeType && dateRange.rangeType.startsWith('MONTH_')) {
        const yearMonth = dateRange.rangeType.replace('MONTH_', '');
        const [yearStr, monthStr] = yearMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const startDay = storeProfile?.financialMonthStartDay || 1;

        const startDate = new Date(year, month - 1, startDay);
        const endDate = new Date(year, month, startDay - 1);
        filter = {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        };
      }

      // Load Summary Stats specifically for Dashboard's date range
      const summaryStats = await storageService.getStats(filter.startDate, filter.endDate);
      setStats(summaryStats);
    } catch (err) {
      console.error('Lỗi load dữ liệu:', err);
    }
  }, [dateRange, storeProfile?.financialMonthStartDay]);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, loadData]);

  // Handle adding or updating transaction
  const handleSaveTransaction = async (formData) => {
    if (formData.id) {
      await storageService.updateTransaction(formData.id, formData);
      showToast('Đã cập nhật giao dịch!', 'success');
    } else {
      await storageService.addTransaction(formData);
      showToast('Đã lưu giao dịch mới!', 'success');
    }
    setEditingTransaction(null);
    await loadData();
  };

  // Handle parsing & processing SMS Banking text
  const handleProcessSms = async (smsText, sender = 'SACOMBANK') => {
    try {
      const result = await storageService.parseAndProcessSms(smsText, sender);
      await loadData();
      showToast(`Tự động ghi nhận Thu: ${formatCurrency(result.parsedAmount)}`, 'success');
      return result;
    } catch (err) {
      showToast(err.message || 'Lỗi bóc tách SMS!', 'error');
      throw err;
    }
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

  // Quick expense presets (Mẫu chi nhanh)
  const handleAddPreset = async (preset) => {
    await storageService.addExpensePreset(preset);
    await loadData();
    showToast('Đã thêm mẫu chi nhanh', 'success');
  };

  const handleUpdatePreset = async (id, updates) => {
    await storageService.updateExpensePreset(id, updates);
    await loadData();
    showToast('Đã cập nhật mẫu chi nhanh', 'success');
  };

  const handleDeletePreset = (preset) => {
    setConfirmDialog({
      title: 'Xóa mẫu chi nhanh',
      message: `Bạn có chắc chắn muốn xóa mẫu "${preset.label}" không?`,
      variant: 'danger',
      onConfirm: async () => {
        await storageService.deleteExpensePreset(preset.id);
        await loadData();
        setConfirmDialog(null);
        showToast('Đã xóa mẫu chi nhanh', 'info');
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
        onOpenAddModal={handleOpenAddModal}
        onOpenSmsModal={() => setIsSmsModalOpen(true)}
        onOpenDailyCashModal={() => setIsDailyCashModalOpen(true)}
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
            onOpenAddModal={handleOpenAddModal}
            onOpenDailyCashModal={() => setIsDailyCashModalOpen(true)}
            transactions={transactions}
            storeProfile={storeProfile}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'ledger' && (
          <LedgerPage
            transactions={transactions}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={handleEditTransaction}
            onOpenAddModal={handleOpenAddModal}
            storeProfile={storeProfile}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'store-profile' && (
          <StoreProfilePage
            storeProfile={storeProfile}
            currentUser={session?.user}
            onUpdateProfile={handleUpdateStoreProfile}
            totalTransactions={transactions.length}
            currentMonthRevenue={stats?.totalIncome || 0}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsPage
            presets={expensePresets}
            categories={categories}
            onAddPreset={handleAddPreset}
            onUpdatePreset={handleUpdatePreset}
            onDeletePreset={handleDeletePreset}
            formatCurrency={formatCurrency}
          />
        )}
      </main>

      {/* Modal Quick Transaction Entry */}
      <TransactionFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        categories={categories}
        presets={expensePresets}
        editingTransaction={editingTransaction}
      />

      {/* Modal Daily Cash Entry (Chốt tiền mặt đầu ngày - cuối ngày) */}
      <DailyCashModal
        isOpen={isDailyCashModalOpen}
        onClose={() => setIsDailyCashModalOpen(false)}
        onSaved={loadData}
        formatCurrency={formatCurrency}
        transactions={transactions}
        showToast={showToast}
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
