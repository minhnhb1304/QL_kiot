import React from 'react';
import { Banknote, Wallet } from 'lucide-react';
import KpiCard from '../components/KpiCard';
import CashflowChart from '../components/CashflowChart';
import ExpensePieChart from '../components/ExpensePieChart';

const RANGE_LABELS = {
  TODAY: 'Hôm nay',
  WEEK: '7 ngày qua',
  MONTH: 'Tháng này',
  ALL: 'Tất cả',
};

const formatVND = (val) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

export default function Dashboard({ stats, dateRange, setDateRange, theme, onOpenAddModal, transactions = [] }) {
  // Extract unique months from transactions array in "T7/2026", "T8/2026" format
  const availableMonths = React.useMemo(() => {
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

  if (!stats) return <div className="loading">Đang tải dữ liệu...</div>;

  let periodLabel = RANGE_LABELS[dateRange.rangeType] || '';
  if (!periodLabel && dateRange.rangeType && dateRange.rangeType.startsWith('MONTH_')) {
    const yearMonth = dateRange.rangeType.replace('MONTH_', '');
    const [yearStr, monthStr] = yearMonth.split('-');
    periodLabel = `Tháng T${parseInt(monthStr, 10)}/${yearStr}`;
  }

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
        />
        <KpiCard
          title="CHI PHÍ"
          amount={stats.totalExpense}
          color="var(--expense-red-500)"
          badgeText="Chi"
          badgeType="out"
        />
        <KpiCard
          title="LÃI RÒNG"
          amount={stats.netProfit}
          color={stats.netProfit >= 0 ? 'var(--primary-500)' : 'var(--expense-red-500)'}
          subtitle={`Tỷ suất: ${stats.profitMargin}%`}
          badgeText={stats.netProfit >= 0 ? 'Lãi' : 'Lỗ'}
          badgeType={stats.netProfit >= 0 ? 'in' : 'out'}
        />
        <KpiCard
          title="QUỸ NGÂN HÀNG"
          amount={stats.bankBalance}
          color="var(--bank-blue-500)"
          badgeText="Bank QR"
          badgeType="bank"
        />
      </div>

      {/* Charts */}
      <div className="grid-charts">
        <CashflowChart dailyData={stats.dailyTrends || []} theme={theme} periodLabel={periodLabel} />
        <ExpensePieChart categoriesData={stats.expenseCategories || []} theme={theme} />
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
                {formatVND(stats.cashBalance)}
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
                {formatVND(stats.bankBalance)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
