import React, { useState, useEffect, useCallback } from 'react';
import { StickyNote, Plus, Check, Trash2, X } from 'lucide-react';
import { storageService } from '../services/storageService';

const NOTE_COLORS = [
  '#10B981', // emerald
  '#3B82F6', // blue
  '#F97316', // orange
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
];

export default function QuickNotes() {
  const [notes, setNotes] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);

  const loadNotes = useCallback(async () => {
    const data = await storageService.getQuickNotes();
    setNotes(data);
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleAdd = async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    await storageService.addQuickNote({ text: trimmed, color: selectedColor });
    setNewText('');
    setIsAdding(false);
    setSelectedColor(NOTE_COLORS[0]);
    await loadNotes();
  };

  const handleToggle = async (id) => {
    await storageService.toggleQuickNote(id);
    await loadNotes();
  };

  const handleDelete = async (id) => {
    await storageService.deleteQuickNote(id);
    await loadNotes();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setIsAdding(false);
      setNewText('');
    }
  };

  const activeNotes = notes.filter(n => !n.is_done);
  const doneNotes = notes.filter(n => n.is_done);

  return (
    <div className="card quick-notes-card">
      <div className="qn-header">
        <div className="qn-title-row">
          <StickyNote size={18} color="var(--primary-500)" />
          <h3>Ghi Chú Nhanh</h3>
          {activeNotes.length > 0 && (
            <span className="qn-count">{activeNotes.length}</span>
          )}
        </div>
        <button
          className="btn-qn-add"
          onClick={() => setIsAdding(true)}
          title="Thêm ghi chú"
        >
          <Plus size={16} />
        </button>
      </div>

      {isAdding && (
        <div className="qn-add-form">
          <textarea
            className="form-textarea qn-textarea"
            placeholder="Ghi chú gì đó..."
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            rows={2}
          />
          <div className="qn-add-actions">
            <div className="qn-color-picker">
              {NOTE_COLORS.map(c => (
                <button
                  key={c}
                  className={`qn-color-dot ${selectedColor === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setSelectedColor(c)}
                />
              ))}
            </div>
            <div className="qn-add-buttons">
              <button className="btn-qn-cancel" onClick={() => { setIsAdding(false); setNewText(''); }}>
                <X size={14} />
              </button>
              <button className="btn-qn-save" onClick={handleAdd} disabled={!newText.trim()}>
                <Check size={14} />
                <span>Lưu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="qn-list">
        {activeNotes.length === 0 && doneNotes.length === 0 && !isAdding && (
          <div className="qn-empty">
            <StickyNote size={32} color="var(--text-light)" strokeWidth={1.5} />
            <span>Chưa có ghi chú nào</span>
          </div>
        )}

        {activeNotes.map(note => (
          <div key={note.id} className="qn-item">
            <button
              className="qn-check-btn"
              onClick={() => handleToggle(note.id)}
              style={{ borderColor: note.color }}
            />
            <span className="qn-text" style={{ borderLeftColor: note.color }}>
              {note.text}
            </span>
            <button className="qn-delete-btn" onClick={() => handleDelete(note.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}

        {doneNotes.length > 0 && (
          <>
            <div className="qn-done-divider">
              <span>Đã xong ({doneNotes.length})</span>
            </div>
            {doneNotes.map(note => (
              <div key={note.id} className="qn-item qn-item-done">
                <button
                  className="qn-check-btn checked"
                  onClick={() => handleToggle(note.id)}
                  style={{ backgroundColor: note.color, borderColor: note.color }}
                >
                  <Check size={10} color="#fff" />
                </button>
                <span className="qn-text done">{note.text}</span>
                <button className="qn-delete-btn" onClick={() => handleDelete(note.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
