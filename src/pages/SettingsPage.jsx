import React, { useState } from 'react';
import { Zap, Plus, Edit3, Trash2, Check, X, Banknote, Landmark } from 'lucide-react';

const EMPTY_FORM = { icon: '⚡', label: '', amount: '', category_id: '', payment_source: 'CASH' };

export default function SettingsPage({
  presets = [],
  categories = [],
  onAddPreset,
  onUpdatePreset,
  onDeletePreset,
  formatCurrency
}) {
  const [editingId, setEditingId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const expenseCategories = categories.filter(c => c.type === 'OUT');
  const isFormOpen = isAdding || editingId !== null;

  const setField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const startAdd = () => {
    setEditingId(null);
    setIsAdding(true);
    setError('');
    setForm({ ...EMPTY_FORM, category_id: expenseCategories[0]?.id || '' });
  };

  const startEdit = (preset) => {
    setIsAdding(false);
    setEditingId(preset.id);
    setError('');
    setForm({
      icon: preset.icon || '⚡',
      label: preset.label || '',
      amount: String(preset.amount || ''),
      category_id: preset.category_id || '',
      payment_source: preset.payment_source || 'CASH'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.label.trim()) {
      setError('Vui lòng nhập tên mẫu chi.');
      return;
    }
    if (!Number(form.amount) || Number(form.amount) <= 0) {
      setError('Số tiền phải lớn hơn 0.');
      return;
    }

    const selectedCat = expenseCategories.find(c => Number(c.id) === Number(form.category_id));
    if (!selectedCat) {
      setError('Vui lòng chọn danh mục chi.');
      return;
    }

    const payload = {
      icon: form.icon.trim() || '⚡',
      label: form.label.trim(),
      amount: Number(form.amount),
      category_id: selectedCat.id,
      category_name: selectedCat.name,
      payment_source: form.payment_source
    };

    if (editingId !== null) {
      await onUpdatePreset(editingId, payload);
    } else {
      await onAddPreset(payload);
    }

    closeForm();
  };

  return (
    <div className="settings-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Zap size={18} className="text-amber-500" /> Mẫu Chi Nhanh
          </h3>
          {!isFormOpen && (
            <button
              className="btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              onClick={startAdd}
            >
              <Plus size={15} /> Thêm mẫu
            </button>
          )}
        </div>

        <p className="settings-hint">
          Các mẫu này hiện thành phím tắt trong ô <strong>Ghi Thu / Chi</strong>. Bấm một mẫu để điền
          sẵn số tiền, danh mục và nguồn tiền — bạn vẫn cần bấm Lưu để ghi sổ.
        </p>

        {/* Add / Edit Form */}
        {isFormOpen && (
          <form className="preset-form" onSubmit={handleSubmit}>
            <div className="preset-form-row">
              <div className="form-group preset-field-icon">
                <label className="form-label">Icon</label>
                <input
                  type="text"
                  className="form-input preset-icon-input"
                  value={form.icon}
                  onChange={e => setField('icon', e.target.value)}
                  maxLength={4}
                  placeholder="⚡"
                />
              </div>

              <div className="form-group preset-field-label">
                <label className="form-label">Tên mẫu *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.label}
                  onChange={e => setField('label', e.target.value)}
                  placeholder="VD: Đá, Ly / Ống hút, Cam..."
                  maxLength={40}
                  autoFocus
                />
              </div>

              <div className="form-group preset-field-amount">
                <label className="form-label">Số tiền (VNĐ) *</label>
                <input
                  type="number"
                  step="1000"
                  className="form-input"
                  value={form.amount}
                  onChange={e => setField('amount', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="preset-form-row">
              <div className="form-group flex-1">
                <label className="form-label">Danh mục chi *</label>
                <select
                  className="form-select"
                  value={form.category_id}
                  onChange={e => setField('category_id', e.target.value)}
                >
                  {expenseCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group flex-1">
                <label className="form-label">Nguồn tiền</label>
                <div className="source-toggle-group">
                  <button
                    type="button"
                    className={`source-btn ${form.payment_source === 'BANK' ? 'active-bank' : ''}`}
                    onClick={() => setField('payment_source', 'BANK')}
                  >
                    <span>Ngân Hàng</span>
                  </button>
                  <button
                    type="button"
                    className={`source-btn ${form.payment_source === 'CASH' ? 'active-cash' : ''}`}
                    onClick={() => setField('payment_source', 'CASH')}
                  >
                    <span>Tiền Mặt</span>
                  </button>
                </div>
              </div>
            </div>

            {error && <div className="preset-form-error">{error}</div>}

            <div className="preset-form-actions">
              <button type="button" className="btn-secondary" onClick={closeForm}>
                <X size={15} /> Hủy
              </button>
              <button type="submit" className="btn-primary">
                <Check size={15} /> {editingId !== null ? 'Cập nhật mẫu' : 'Lưu mẫu'}
              </button>
            </div>
          </form>
        )}

        {/* Preset List */}
        {presets.length === 0 ? (
          <div className="preset-empty">
            Chưa có mẫu chi nhanh nào. Bấm <strong>Thêm mẫu</strong> để tạo phím tắt cho các khoản
            chi lặp lại hàng ngày.
          </div>
        ) : (
          <ul className="preset-list">
            {presets.map(preset => (
              <li key={preset.id} className="preset-row">
                <span className="preset-row-icon">{preset.icon}</span>

                <div className="preset-row-info">
                  <span className="preset-row-label">{preset.label}</span>
                  <span className="preset-row-meta">
                    {preset.category_name}
                    <span className="preset-row-source">
                      {preset.payment_source === 'CASH'
                        ? <><Banknote size={12} /> Tiền mặt</>
                        : <><Landmark size={12} /> Ngân hàng</>
                      }
                    </span>
                  </span>
                </div>

                <span className="preset-row-amount">{formatCurrency(preset.amount)}</span>

                <div className="preset-row-actions">
                  <button
                    className="icon-btn"
                    onClick={() => startEdit(preset)}
                    title="Sửa mẫu"
                    aria-label={`Sửa mẫu ${preset.label}`}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    className="icon-btn preset-delete-btn"
                    onClick={() => onDeletePreset(preset)}
                    title="Xóa mẫu"
                    aria-label={`Xóa mẫu ${preset.label}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
