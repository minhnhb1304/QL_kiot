import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Calculator, ArrowRightLeft, History, Trash2, CheckCircle2, AlertTriangle, Sparkles, Copy } from 'lucide-react';
import { storageService } from '../services/storageService';

export default function DailyCashModal({ isOpen, onClose, onSaved, formatCurrency, transactions = [], showToast }) {
  const [activeTab, setActiveTab] = useState('tally'); // 'tally' | 'history'
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [note, setNote] = useState('');
  const [saveAsTransaction, setSaveAsTransaction] = useState(false);
  const [yesterdayCash, setYesterdayCash] = useState(0);

  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load existing daily record when date or isOpen changes
  const loadRecordForDate = useCallback(async (selectedDate) => {
    try {
      const existing = await storageService.getDailyCashByDate(selectedDate);
      if (existing) {
        setOpeningCash(existing.opening_cash ? String(existing.opening_cash) : '0');
        setClosingCash(existing.closing_cash ? String(existing.closing_cash) : '0');
        setNote(existing.note || '');
      } else {
        setOpeningCash('');
        setClosingCash('');
        setNote('');
      }

      const prevCash = await storageService.getYesterdayClosingCash(selectedDate);
      setYesterdayCash(prevCash);
    } catch (err) {
      console.error('Lỗi tải dữ liệu chốt tiền mặt:', err);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const records = await storageService.getDailyCashRecords({});
      setHistoryList(records);
    } catch (err) {
      console.error('Lỗi tải lịch sử chốt tiền mặt:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const todayStr = new Date().toISOString().split('T')[0];
      setDate(todayStr);
      loadRecordForDate(todayStr);
      loadHistory();
    }
  }, [isOpen, loadRecordForDate, loadHistory]);

  const handleDateChange = (newDate) => {
    setDate(newDate);
    loadRecordForDate(newDate);
  };

  // Calculate live difference: Hiệu = Cuối ngày - Đầu ngày
  const openVal = Number(openingCash) || 0;
  const closeVal = Number(closingCash) || 0;
  const totalCashDiff = closeVal - openVal;

  // Comparison with logged cash transactions for selected date
  const loggedCashStats = useMemo(() => {
    const dayTxs = (transactions || []).filter(t => t.transaction_date === date && t.payment_source === 'CASH');
    const cashIn = dayTxs.filter(t => t.type === 'IN').reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const cashOut = dayTxs.filter(t => t.type === 'OUT').reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const netLogged = cashIn - cashOut;
    return { cashIn, cashOut, netLogged };
  }, [transactions, date]);

  const discrepancy = totalCashDiff - loggedCashStats.netLogged;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (openingCash === '' || closingCash === '') {
      if (showToast) showToast('Vui lòng nhập số tiền mặt đầu ngày và cuối ngày!', 'error');
      return;
    }

    try {
      await storageService.saveDailyCashRecord({
        date,
        opening_cash: openVal,
        closing_cash: closeVal,
        note,
        saveAsTransaction
      });

      if (showToast) {
        showToast(`Đã lưu chốt tiền mặt ngày ${date.split('-').reverse().join('/')}!`, 'success');
      }

      if (onSaved) onSaved();
      loadHistory();
      onClose();
    } catch (err) {
      console.error('Lỗi khi lưu chốt tiền mặt:', err);
      if (showToast) showToast('Không thể lưu chốt tiền mặt', 'error');
    }
  };

  const handleDeleteHistory = async (id) => {
    try {
      await storageService.deleteDailyCashRecord(id);
      loadHistory();
      loadRecordForDate(date);
      if (showToast) showToast('Đã xóa bản ghi chốt tiền mặt', 'info');
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Lỗi xóa chốt tiền mặt:', err);
    }
  };

  const addQuickOpening = (val) => {
    setOpeningCash(prev => String((Number(prev) || 0) + val));
  };

  const addQuickClosing = (val) => {
    setClosingCash(prev => String((Number(prev) || 0) + val));
  };

  const copyYesterdayCash = () => {
    if (yesterdayCash > 0) {
      setOpeningCash(String(yesterdayCash));
      if (showToast) {
        showToast(`Đã lấy số tiền cuối ngày trước (${formatCurrency ? formatCurrency(yesterdayCash) : yesterdayCash})`, 'info');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content daily-cash-modal" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-title">
            <Calculator className="text-emerald-500" size={22} />
            <h2>Nhập Tiền Mặt Đầu/Cuối Ngày (Chốt Tiền Mặt)</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </div>

        {/* Modal Tabs */}
        <div className="daily-cash-tabs">
          <button
            className={`dc-tab ${activeTab === 'tally' ? 'active' : ''}`}
            onClick={() => setActiveTab('tally')}
          >
            <ArrowRightLeft size={16} />
            <span>Nhập Số Liệu Ngày</span>
          </button>
          <button
            className={`dc-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={16} />
            <span>Lịch Sử Chốt Tiền Mặt ({historyList.length})</span>
          </button>
        </div>

        {activeTab === 'tally' ? (
          <form onSubmit={handleSubmit} className="modal-form daily-cash-form">

            {/* Date Selection */}
            <div className="form-group">
              <label className="form-label font-bold">Ngày Kiểm Tiền Mặt *</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={e => handleDateChange(e.target.value)}
                required
              />
            </div>

            {/* Opening Cash Input */}
            <div className="form-group">
              <div className="label-with-action">
                <label className="form-label font-bold">1. Số Tiền Mặt Đầu Ngày (Tiền lẻ / Quỹ đầu ca) *</label>
                {yesterdayCash > 0 && (
                  <button
                    type="button"
                    className="btn-text-link"
                    onClick={copyYesterdayCash}
                    title="Lấy số tiền mặt cuối ngày trước làm đầu ngày hôm nay"
                  >
                    <Copy size={13} style={{ flexShrink: 0 }} />
                    <span>Tiền ngày trước ({formatCurrency(yesterdayCash)})</span>
                  </button>
                )}
              </div>
              <div className="amount-input-wrapper">
                <input
                  type="number"
                  step="1000"
                  min="0"
                  className="form-input amount-input"
                  placeholder="0"
                  value={openingCash}
                  onChange={e => setOpeningCash(e.target.value)}
                  required
                />
                <span className="currency-suffix">VNĐ</span>
              </div>
              <div className="quick-chips">
                <button type="button" onClick={() => addQuickOpening(100000)}>+100k</button>
                <button type="button" onClick={() => addQuickOpening(200000)}>+200k</button>
                <button type="button" onClick={() => addQuickOpening(500000)}>+500k</button>
                <button type="button" onClick={() => addQuickOpening(1000000)}>+1M</button>
              </div>
            </div>

            {/* Closing Cash Input */}
            <div className="form-group">
              <label className="form-label font-bold">2. Số Tiền Mặt Cuối Ngày (Tiền trong két cuối ca) *</label>
              <div className="amount-input-wrapper">
                <input
                  type="number"
                  step="1000"
                  min="0"
                  className="form-input amount-input"
                  placeholder="0"
                  value={closingCash}
                  onChange={e => setClosingCash(e.target.value)}
                  required
                />
                <span className="currency-suffix">VNĐ</span>
              </div>
              <div className="quick-chips">
                <button type="button" onClick={() => addQuickClosing(200000)}>+200k</button>
                <button type="button" onClick={() => addQuickClosing(500000)}>+500k</button>
                <button type="button" onClick={() => addQuickClosing(1000000)}>+1M</button>
                <button type="button" onClick={() => addQuickClosing(2000000)}>+2M</button>
                <button type="button" onClick={() => addQuickClosing(5000000)}>+5M</button>
              </div>
            </div>

            {/* Live Calculation Display Box: HIỆU = TỔNG THU TIỀN MẶT 1 NGÀY */}
            <div className={`dc-result-card ${totalCashDiff >= 0 ? 'positive' : 'negative'}`}>
              <div className="dc-result-header">
                <div className="dc-result-title">
                  <Sparkles size={18} />
                  <span>HIỆU = TỔNG THU TIỀN MẶT 1 NGÀY</span>
                </div>
                <span className="dc-formula-tag">Cuối ngày - Đầu ngày</span>
              </div>

              <div className="dc-result-amount">
                {totalCashDiff >= 0 ? '+' : ''}{formatCurrency(totalCashDiff)}
              </div>

              <div className="dc-result-breakdown">
                <div>
                  <span className="text-muted">Đầu ngày:</span>{' '}
                  <strong>{formatCurrency(openVal)}</strong>
                </div>
                <div>
                  <span className="text-muted">Cuối ngày:</span>{' '}
                  <strong>{formatCurrency(closeVal)}</strong>
                </div>
              </div>

              {/* Comparison with logged transactions in Sổ Thu Chi */}
              {loggedCashStats.netLogged > 0 && (
                <div className="dc-comparison-box">
                  <div className="dc-comp-row">
                    <span>Ghi nhận Sổ Thu Chi (Tiền mặt):</span>
                    <strong>{formatCurrency(loggedCashStats.netLogged)}</strong>
                  </div>
                  {Math.abs(discrepancy) < 1 ? (
                    <div className="dc-comp-status status-match">
                      <CheckCircle2 size={15} />
                      <span>Khớp 100% với Sổ Thu Chi</span>
                    </div>
                  ) : (
                    <div className="dc-comp-status status-diff">
                      <AlertTriangle size={15} />
                      <span>
                        Chênh lệch: {discrepancy > 0 ? '+' : ''}{formatCurrency(discrepancy)} so với sổ
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Optional Sync to Transactions Checkbox */}
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={saveAsTransaction}
                  onChange={e => setSaveAsTransaction(e.target.checked)}
                />
                <span>Tự động tạo/cập nhật 1 giao dịch Thu Tiền Mặt vào Sổ Thu Chi</span>
              </label>
            </div>

            {/* Note Input */}
            <div className="form-group">
              <label className="form-label">Ghi Chú Tiền Mặt / Ghi Chú Thêm</label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: Nhượng tiền lẻ đầu ngày, thu ngân..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Hủy
              </button>
              <button type="submit" className="btn-primary">
                Lưu Chốt Tiền Mặt
              </button>
            </div>
          </form>
        ) : (
          /* HISTORY TAB */
          <div className="dc-history-container">
            {loading ? (
              <div className="loading">Đang tải lịch sử...</div>
            ) : historyList.length > 0 ? (
              <div className="dc-history-list">
                {historyList.map(item => {
                  const itemDiff = (item.closing_cash || 0) - (item.opening_cash || 0);
                  const isPositive = itemDiff >= 0;
                  return (
                    <div key={item.id} className="dc-history-card">
                      <div className="dc-history-top">
                        <div className="dc-history-date">
                          <strong>Ngày {item.date.split('-').reverse().join('/')}</strong>
                        </div>
                        <strong className={`dc-history-diff ${isPositive ? 'text-green' : 'text-red'}`}>
                          Hiệu: {isPositive ? '+' : ''}{formatCurrency(itemDiff)}
                        </strong>
                      </div>

                      <div className="dc-history-details">
                        <div className="dc-detail-chip">
                          <span className="text-muted">Đầu ngày:</span> {formatCurrency(item.opening_cash)}
                        </div>
                        <div className="dc-detail-chip">
                          <span className="text-muted">Cuối ngày:</span> {formatCurrency(item.closing_cash)}
                        </div>
                      </div>

                      {item.note && (
                        <p className="dc-history-note text-muted">Ghi chú: {item.note}</p>
                      )}

                      <div className="dc-history-actions">
                        <button
                          type="button"
                          className="icon-btn btn-delete-sm"
                          title="Xóa bản ghi chốt tiền mặt này"
                          onClick={() => handleDeleteHistory(item.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <Calculator size={32} color="var(--text-light)" />
                <p>Chưa có dữ liệu chốt tiền mặt nào</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
