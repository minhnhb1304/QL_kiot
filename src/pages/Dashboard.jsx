import React, { useMemo } from 'react';
import { Banknote, Wallet, Target, FileSpreadsheet } from 'lucide-react';
import KpiCard from '../components/KpiCard';
import CashflowChart from '../components/CashflowChart';
import ExpensePieChart from '../components/ExpensePieChart';
import { createCurrencyFormatter } from '../utils/currency';
import { exportDashboardStatsToExcel } from '../utils/excelExport';

const RANGE_LABELS = {
  TODAY: 'Hôm nay',
  WEEK: '7 ngày qua',
  MONTH: 'Tháng này',
  ALL: 'Tất cả',
};

export default function Dashboard({
  stats,
  dateRange,
  setDateRange,
  theme,
  transactions = [],
  storeProfile,
  formatCurrency
}) {
  const currencyFormatter = useMemo(
    () => formatCurrency || createCurrencyFormatter(storeProfile?.currency || 'VND'),
    [formatCurrency, storeProfile?.currency]
  );

  // Extract unique months from transactions array in "T7/2026", "T8/2026" format
  const availableMonths = useMemo(() => {
    const monthMap = new Map();
    (transactions || []).forEach(t => {
      if (t.transaction_date) {
        const parts = t.transaction_date.split('-');
        if (parts.length >= 2) {
          const year = parts[0];
          const month = parseInt(parts[1], 10);
          const key = `${year}-${parts[1]}`;
          const label = `T${month}/${year}`;
          if (!monthMap.has(key)) {
            monthMap.set(key, { key, label });
          }
        }
      }
    });

    return Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [transactions]);

  // Revenue goal progress for dashboard
  const revenueGoalProgress = useMemo(() => {
    if (!storeProfile?.monthlyRevenueGoal || storeProfile.monthlyRevenueGoal <= 0) return null;
    const goal = storeProfile.monthlyRevenueGoal;
    const current = stats?.totalIncome || 0;
    const percent = Math.min((current / goal) * 100, 100);
    return { goal, current, percent };
  }, [storeProfile?.monthlyRevenueGoal, stats?.totalIncome]);

  if (!stats) return <div className="loading">Đang tải dữ liệu...</div>;

  let periodLabel = RANGE_LABELS[dateRange.rangeType] || '';
  if (!periodLabel && dateRange.rangeType && dateRange.rangeType.startsWith('MONTH_')) {
    const yearMonth = dateRange.rangeType.replace('MONTH_', '');
    const [yearStr, monthStr] = yearMonth.split('-');
    periodLabel = `Tháng T${parseInt(monthStr, 10)}/${yearStr}`;
  }

  const handleExportDashboardExcel = () => {
    exportDashboardStatsToExcel(stats, periodLabel || 'Tất cả', storeProfile);
  };

  return (
    <div className="dashboard-page">
      {/* Time Filter Bar */}
      <div className="dashboard-toolbar card">
        <div className="toolbar-title">
          <h2>Thống Kê Tài Chính</h2>
          {periodLabel && <span className="toolbar-period-badge">{periodLabel}</span>}
        </div>
        <div className="date-filter-buttons">
          {['TODAY', 'WEEK', 'MONTH', 'ALL'].map((range) => (
            <button
              key={range}
              className={`filter-chip ${dateRange.rangeType === range ? 'active' : ''}`}
              onClick={() => setDateRange({ rangeType: range })}
            >
              {RANGE_LABELS[range]}
            </button>
          ))}

          {/* Dynamic Month Selector */}
          {availableMonths.length > 0 && (
            <select
              className={`form-select filter-select dash-month-select ${dateRange.rangeType?.startsWith('MONTH_') ? 'active-select' : ''}`}
              value={dateRange.rangeType?.startsWith('MONTH_') ? dateRange.rangeType : ''}
              onChange={e => {
                if (e.target.value) {
                  setDateRange({ rangeType: e.target.value });
                }
              }}
            >
              <option value="">Chọn tháng khác...</option>
              {availableMonths.map(m => (
                <option key={m.key} value={`MONTH_${m.key}`}>
                  {m.label}
                </option>
              ))}
            </select>
          )}

          <button
            className="btn-secondary btn-excel-export"
            onClick={handleExportDashboardExcel}
            title="Xuất báo cáo thống kê chi tiết ra Excel (.xlsx)"
          >
            <FileSpreadsheet size={16} color="#10B981" />
            <span>Xuất Báo Cáo Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-kpi">
        <KpiCard
          title="DOANH THU"
          amount={stats.totalIncome}
          color="var(--primary-500)"
          badgeText="Thu"
          badgeType="in"
          formatCurrency={currencyFormatter}
        />
        <KpiCard
          title="CHI PHÍ"
          amount={stats.totalExpense}
          color="var(--expense-red-500)"
          badgeText="Chi"
          badgeType="out"
          formatCurrency={currencyFormatter}
        />
        <KpiCard
          title="LÃI RÒNG"
          amount={stats.netProfit}
          color={stats.netProfit >= 0 ? 'var(--primary-500)' : 'var(--expense-red-500)'}
          subtitle={`Tỷ suất: ${stats.profitMargin}%`}
          badgeText={stats.netProfit >= 0 ? 'Lãi' : 'Lỗ'}
          badgeType={stats.netProfit >= 0 ? 'in' : 'out'}
          formatCurrency={currencyFormatter}
        />
        <KpiCard
          title="QUỸ NGÂN HÀNG"
          amount={stats.bankBalance}
          color="var(--bank-blue-500)"
          badgeText="Bank QR"
          badgeType="bank"
          formatCurrency={currencyFormatter}
        />
      </div>

      {/* Monthly Revenue Goal Progress (Phase 2 & Phase 3) */}
      {revenueGoalProgress && (
        <div className="card revenue-goal-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
          <div className="rg-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            <Target size={16} className="text-emerald-500" />
            <span>Mục Tiêu Doanh Thu Tháng</span>
          </div>
          <div className="rg-amounts" style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.75rem' }}>
            <span className="rg-current" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-500)' }}>
              {currencyFormatter(revenueGoalProgress.current)}
            </span>
            <span className="rg-divider" style={{ color: 'var(--text-light)' }}>/</span>
            <span className="rg-goal" style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              {currencyFormatter(revenueGoalProgress.goal)}
            </span>
          </div>
          <div className="rg-bar-track" style={{ height: '10px', borderRadius: '9999px', backgroundColor: 'var(--bg-main)', overflow: 'hidden', marginBottom: '0.5rem' }}>
            <div
              className="rg-bar-fill"
              style={{
                width: `${revenueGoalProgress.percent}%`,
                height: '100%',
                borderRadius: '9999px',
                background: 'linear-gradient(90deg, var(--primary-500), #34D399)',
                transition: 'width 0.6s ease-in-out'
              }}
            />
          </div>
          <span className="rg-percent" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary-600)' }}>
            {revenueGoalProgress.percent.toFixed(1)}% Hoàn thành
          </span>
        </div>
      )}

      {/* Charts */}
      <div className="grid-charts">
        <CashflowChart
          dailyData={stats.dailyTrends || []}
          theme={theme}
          periodLabel={periodLabel}
          formatCurrency={currencyFormatter}
        />
        <ExpensePieChart
          categoriesData={stats.expenseCategories || []}
          theme={theme}
          formatCurrency={currencyFormatter}
        />
      </div>

      {/* Fund Control Card */}
      <div className="card fund-control-card">
        <h3>Số Dư Nguồn Tiền</h3>
        <div className="fund-grid">
          <div className="fund-box fund-cash">
            <div className="fund-icon">
              <Wallet size={22} />
            </div>
            <div className="fund-info">
              <span className="fund-label">Tiền Mặt Tại Quầy</span>
              <strong className="fund-amount text-orange">
                {currencyFormatter(stats.cashBalance)}
              </strong>
            </div>
          </div>

          <div className="fund-box fund-bank">
            <div className="fund-icon">
              <Banknote size={22} />
            </div>
            <div className="fund-info">
              <span className="fund-label">Tài Khoản Ngân Hàng</span>
              <strong className="fund-amount text-blue">
                {currencyFormatter(stats.bankBalance)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
