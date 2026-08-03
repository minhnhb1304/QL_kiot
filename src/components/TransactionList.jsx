import React, { useState } from 'react';
import { Search, Trash2, FileText } from 'lucide-react';

export default function TransactionList({ transactions, onDeleteTransaction, onOpenAddModal }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('ALL'); // 'ALL', 'SPLIT', 'IN', 'OUT'
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL'); // 'ALL', 'MONTH', 'WEEK', 'TODAY', 'MONTH_YYYY-MM'

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

  // Filter transactions in UI
  const filtered = transactions.filter(t => {
    const matchesSource = sourceFilter === 'ALL' || t.payment_source === sourceFilter;
    const matchesSearch = !searchTerm || 
      t.category_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.note && t.note.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesDate = true;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (dateFilter === 'TODAY') {
      matchesDate = t.transaction_date === todayStr;
    } else if (dateFilter === 'WEEK') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      const weekAgoStr = d.toISOString().split('T')[0];
      matchesDate = t.transaction_date >= weekAgoStr && t.transaction_date <= todayStr;
    } else if (dateFilter === 'MONTH') {
      const firstDayStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      matchesDate = t.transaction_date >= firstDayStr && t.transaction_date <= todayStr;
    } else if (dateFilter.startsWith('MONTH_')) {
      const targetYearMonth = dateFilter.replace('MONTH_', '');
      matchesDate = t.transaction_date && t.transaction_date.startsWith(targetYearMonth);
    }
    
    if (viewMode === 'IN') return t.type === 'IN' && matchesSource && matchesSearch && matchesDate;
    if (viewMode === 'OUT') return t.type === 'OUT' && matchesSource && matchesSearch && matchesDate;
    return matchesSource && matchesSearch && matchesDate;
  });

  // Separate IN and OUT for SPLIT mode
  const inList = filtered.filter(t => t.type === 'IN');
  const outList = filtered.filter(t => t.type === 'OUT');

  const totalInAmount = inList.reduce((acc, cur) => acc + Number(cur.amount), 0);
  const totalOutAmount = outList.reduce((acc, cur) => acc + Number(cur.amount), 0);

  const formatVND = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="card transaction-list-card">
      <div className="list-header">
        <div>
          <h3>Sổ Thu Chi ({filtered.length})</h3>
        </div>

        <button className="btn-primary btn-sm" onClick={onOpenAddModal}>
          + Thêm Mới
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        {/* Search Input */}
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="form-input search-input"
            placeholder="Tìm theo ghi chú, danh mục..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* View & Filter Mode */}
        <div className="filter-group">
          {/* Date Range Filter for Ledger */}
          <select 
            className="form-select filter-select"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          >
            <option value="ALL">Tất cả thời gian</option>
            <option value="MONTH">Tháng này</option>
            <option value="WEEK">7 ngày qua</option>
            <option value="TODAY">Hôm nay</option>
            {availableMonths.length > 0 && (
              <optgroup label="Tháng có dữ liệu">
                {availableMonths.map(m => (
                  <option key={m.key} value={`MONTH_${m.key}`}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <select 
            className="form-select filter-select mode-select"
            value={viewMode}
            onChange={e => setViewMode(e.target.value)}
          >
            <option value="ALL">Gộp chung</option>
            <option value="SPLIT">Thu | Chi</option>
            <option value="IN">Chỉ thu</option>
            <option value="OUT">Chỉ chi</option>
          </select>

          {/* Payment Source Filter */}
          <select 
            className="form-select filter-select"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
          >
            <option value="ALL">Tất cả nguồn</option>
            <option value="BANK">Ngân hàng</option>
            <option value="CASH">Tiền mặt</option>
          </select>
        </div>
      </div>

      {/* VIEW MODE 1: SPLIT (Thu 1 Bên - Chi 1 Bên Song Song) */}
      {viewMode === 'SPLIT' ? (
        <div className="split-columns-container">
          {/* LEFT COLUMN: KHOẢN THU (IN) */}
          <div className="split-column column-in">
            <div className="column-header header-in">
              <div className="col-header-title">
                <span>KHOẢN THU</span>
              </div>
              <strong className="col-total-amount text-green">
                +{formatVND(totalInAmount)}
              </strong>
            </div>

            <div className="split-items-list">
              {inList.length > 0 ? (
                inList.map(item => (
                  <div key={item.id} className="split-item-card item-in">
                    <div className="split-item-top">
                      <span className="badge badge-in">{item.category_name}</span>
                      <strong className="item-amount text-green">+{formatVND(item.amount)}</strong>
                    </div>
                    {item.note && (
                      <div className="split-item-note text-muted">
                        {item.note}
                      </div>
                    )}
                    <div className="split-item-bottom">
                      <span className="cell-date">{item.transaction_date}</span>
                      <div className="split-item-actions">
                        <span className={`badge ${item.payment_source === 'BANK' ? 'badge-bank' : 'badge-cash'}`}>
                          {item.payment_source === 'BANK' ? 'Ngân hàng' : 'Tiền mặt'}
                        </span>
                        <button
                          className="icon-btn btn-delete-sm"
                          title="Xóa"
                          onClick={() => onDeleteTransaction(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-column-state">Không có dữ liệu thu</div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: KHOẢN CHI (OUT) */}
          <div className="split-column column-out">
            <div className="column-header header-out">
              <div className="col-header-title">
                <span>KHOẢN CHI</span>
              </div>
              <strong className="col-total-amount text-red">
                -{formatVND(totalOutAmount)}
              </strong>
            </div>

            <div className="split-items-list">
              {outList.length > 0 ? (
                outList.map(item => (
                  <div key={item.id} className="split-item-card item-out">
                    <div className="split-item-top">
                      <span className="badge badge-out">{item.category_name}</span>
                      <strong className="item-amount text-red">-{formatVND(item.amount)}</strong>
                    </div>
                    {item.note && (
                      <div className="split-item-note text-muted">
                        {item.note}
                      </div>
                    )}
                    <div className="split-item-bottom">
                      <span className="cell-date">{item.transaction_date}</span>
                      <div className="split-item-actions">
                        <span className={`badge ${item.payment_source === 'BANK' ? 'badge-bank' : 'badge-cash'}`}>
                          {item.payment_source === 'BANK' ? 'Ngân hàng' : 'Tiền mặt'}
                        </span>
                        <button
                          className="icon-btn btn-delete-sm"
                          title="Xóa"
                          onClick={() => onDeleteTransaction(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-column-state">Không có dữ liệu chi</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: COMBINED VIEW (Mobile List + Desktop Table) */
        <div className="tx-view-wrapper">
          {filtered.length > 0 ? (
            <>
              {/* DESKTOP/TABLET TABLE VIEW (≥ 640px) */}
              <div className="table-responsive desktop-tx-table">
                <table className="transaction-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Danh Mục</th>
                      <th>Ghi Chú</th>
                      <th>Nguồn</th>
                      <th className="text-right">Số Tiền</th>
                      <th className="text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(item => (
                      <tr key={item.id} className={`row-type-${item.type.toLowerCase()}`}>
                        <td className="cell-date">
                          {item.transaction_date}
                        </td>
                        <td>
                          <div className="category-cell">
                            <span className={`badge ${item.type === 'IN' ? 'badge-in' : 'badge-out'}`}>
                              {item.type === 'IN' ? 'Thu' : 'Chi'}
                            </span>
                            <strong className="cat-name">{item.category_name}</strong>
                          </div>
                        </td>
                        <td className="cell-note text-muted">
                          {item.note || '—'}
                        </td>
                        <td>
                          <span className={`badge ${item.payment_source === 'BANK' ? 'badge-bank' : 'badge-cash'}`}>
                            {item.payment_source === 'BANK' ? 'Ngân hàng' : 'Tiền mặt'}
                          </span>
                        </td>
                        <td className={`text-right font-bold ${item.type === 'IN' ? 'text-green' : 'text-red'}`}>
                          {item.type === 'IN' ? '+' : '-'}{formatVND(item.amount)}
                        </td>
                        <td className="text-center">
                          <button
                            className="icon-btn btn-delete"
                            title="Xóa giao dịch này"
                            onClick={() => onDeleteTransaction(item.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARD LIST VIEW (< 640px) */}
              <div className="mobile-tx-list">
                {filtered.map(item => (
                  <div key={item.id} className={`mobile-tx-card item-${item.type.toLowerCase()}`}>
                    <div className="mobile-tx-row-top">
                      <div className="mobile-tx-category">
                        <span className={`badge ${item.type === 'IN' ? 'badge-in' : 'badge-out'}`}>
                          {item.type === 'IN' ? 'Thu' : 'Chi'}
                        </span>
                        <strong>{item.category_name}</strong>
                      </div>
                      <strong className={`mobile-tx-amount ${item.type === 'IN' ? 'text-green' : 'text-red'}`}>
                        {item.type === 'IN' ? '+' : '-'}{formatVND(item.amount)}
                      </strong>
                    </div>

                    {item.note && (
                      <p className="mobile-tx-note text-muted">{item.note}</p>
                    )}

                    <div className="mobile-tx-row-bottom">
                      <div className="mobile-tx-meta">
                        <span className="cell-date">{item.transaction_date}</span>
                        <span className={`badge ${item.payment_source === 'BANK' ? 'badge-bank' : 'badge-cash'}`}>
                          {item.payment_source === 'BANK' ? 'Bank' : 'Tiền mặt'}
                        </span>
                      </div>
                      <button
                        className="icon-btn btn-delete-sm"
                        title="Xóa"
                        onClick={() => onDeleteTransaction(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FileText size={28} color="var(--text-light)" />
              <p>Không có dữ liệu phù hợp</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
