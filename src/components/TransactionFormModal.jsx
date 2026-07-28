import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function TransactionFormModal({ isOpen, onClose, onSave, categories }) {
  const [type, setType] = useState('OUT');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState('BANK');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredCategories = categories.filter(c => c.type === type);

  useEffect(() => {
    if (filteredCategories.length > 0 && !categoryId) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [type, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    const selectedCat = categories.find(c => Number(c.id) === Number(categoryId)) || {
      id: 0,
      name: type === 'IN' ? 'Doanh thu' : 'Chi phí'
    };

    onSave({
      type,
      category_id: selectedCat.id,
      category_name: selectedCat.name,
      amount: Number(amount),
      payment_source: paymentSource,
      note,
      transaction_date: date
    });

    setAmount('');
    setNote('');
    onClose();
  };

  const addQuickAmount = (val) => {
    const current = Number(amount) || 0;
    setAmount((current + val).toString());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ghi Thu / Chi</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Type Selector (Thu vs Chi) */}
          <div className="type-toggle-group">
            <button
              type="button"
              className={`type-btn btn-in ${type === 'IN' ? 'active' : ''}`}
              onClick={() => {
                setType('IN');
                const inCats = categories.filter(c => c.type === 'IN');
                if (inCats.length > 0) setCategoryId(inCats[0].id);
              }}
            >
              <span>THU (TIỀN VÀO)</span>
            </button>

            <button
              type="button"
              className={`type-btn btn-out ${type === 'OUT' ? 'active' : ''}`}
              onClick={() => {
                setType('OUT');
                const outCats = categories.filter(c => c.type === 'OUT');
                if (outCats.length > 0) setCategoryId(outCats[0].id);
              }}
            >
              <span>CHI (TIỀN RA)</span>
            </button>
          </div>

          {/* Amount Input */}
          <div className="form-group">
            <label className="form-label">Số Tiền (VNĐ) *</label>
            <div className="amount-input-wrapper">
              <input
                type="number"
                step="1000"
                className="form-input amount-input"
                placeholder="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                autoFocus
                required
              />
              <span className="currency-suffix">VNĐ</span>
            </div>

            {/* Quick Amount Chips */}
            <div className="quick-chips">
              <button type="button" onClick={() => addQuickAmount(50000)}>+50k</button>
              <button type="button" onClick={() => addQuickAmount(100000)}>+100k</button>
              <button type="button" onClick={() => addQuickAmount(200000)}>+200k</button>
              <button type="button" onClick={() => addQuickAmount(500000)}>+500k</button>
              <button type="button" onClick={() => addQuickAmount(1000000)}>+1M</button>
            </div>
          </div>

          {/* Payment Source Selection (Bank vs Cash) */}
          <div className="form-group">
            <label className="form-label">Nguồn Tiền *</label>
            <div className="source-toggle-group">
              <button
                type="button"
                className={`source-btn ${paymentSource === 'BANK' ? 'active-bank' : ''}`}
                onClick={() => setPaymentSource('BANK')}
              >
                <span>Ngân Hàng (QR)</span>
              </button>

              <button
                type="button"
                className={`source-btn ${paymentSource === 'CASH' ? 'active-cash' : ''}`}
                onClick={() => setPaymentSource('CASH')}
              >
                <span>Tiền Mặt</span>
              </button>
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="form-group">
            <label className="form-label">Danh Mục *</label>
            <select
              className="form-select"
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
            >
              {filteredCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Note */}
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">Ngày Giao Dịch</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div className="form-group flex-2">
              <label className="form-label">Ghi Chú</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ghi chú chi tiết..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              Lưu Giao Dịch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
