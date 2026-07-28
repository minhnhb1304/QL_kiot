import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import LedgerPage from './pages/LedgerPage';
import LoginPage from './pages/LoginPage';
import TransactionFormModal from './components/TransactionFormModal';
import SmsAutomationModal from './components/SmsAutomationModal';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import './styles/global.css';
import './styles/dashboard.css';
import './styles/mobile.css';

export default function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(localStorage.getItem('jl_theme') || 'light');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);

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

    return {}; // ALL
  };

  // Load Categories, Transactions & Stats
  const loadData = async () => {
    try {
      const cats = await storageService.getCategories();
      setCategories(cats);

      const filter = getDateRangeFilter();
      const txs = await storageService.getTransactions(filter);
      setTransactions(txs);

      const s = await storageService.getStats(filter.startDate, filter.endDate);
      setStats(s);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, dateRange]);

  // Handle adding new transaction
  const handleSaveTransaction = async (newTx) => {
    await storageService.addTransaction(newTx);
    await loadData();
  };

  // Handle parsing & processing SMS Banking text
  const handleProcessSms = async (smsText, sender) => {
    const result = await storageService.parseAndProcessSms(smsText, sender);
    await loadData();
    return result;
  };

  // Handle deleting transaction
  const handleDeleteTransaction = async (id) => {
    await storageService.deleteTransaction(id);
    await loadData();
  };

  // Reset demo data
  const handleResetData = async () => {
    if (confirm('Bạn có muốn tải lại dữ liệu mẫu cho quán nước ép không?')) {
      await storageService.resetData();
      await loadData();
    }
  };

  // Handle Login & Logout
  const handleLoginSuccess = (newSession) => {
    setSession(newSession);
  };

  const handleLogout = () => {
    authService.logout();
    setSession(null);
  };

  // If user is not logged in, show Login Page
  if (!session) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
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
      />

      {/* Main Container */}
      <main className="app-container">
        {activeTab === 'dashboard' ? (
          <Dashboard
            stats={stats}
            dateRange={dateRange}
            setDateRange={setDateRange}
            theme={theme}
            onOpenAddModal={() => setIsModalOpen(true)}
          />
        ) : (
          <LedgerPage
            transactions={transactions}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenAddModal={() => setIsModalOpen(true)}
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
    </div>
  );
}
