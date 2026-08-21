import { db, seedInitialData } from './db';
import { newUuid, syncNow } from '../utils/uuid';

// Dấu đồng bộ cho dòng MỚI tạo ở thiết bị này
function stampNew() {
  const now = syncNow();
  return { uuid: newUuid(), created_at: now, updated_at: now, deleted: 0, _dirty: 1, server_seq: 0 };
}

// Dấu đồng bộ cho dòng ĐƯỢC SỬA ở thiết bị này
function stampUpdate() {
  return { updated_at: syncNow(), _dirty: 1 };
}

// Tombstone: xóa mềm để lệnh xóa lan được sang thiết bị khác
function stampDelete() {
  return { deleted: 1, updated_at: syncNow(), _dirty: 1 };
}

// Bỏ các dòng đã xóa mềm khỏi kết quả đọc
function alive(row) {
  return !row.deleted;
}

// Unified Storage Service: Local IndexedDB (Dexie) + Cloudflare D1 API Adapter
class StorageService {
  constructor() {
    this.initialized = false;
    this.useCloudApi = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      await seedInitialData();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize local DB:', error);
    }
  }

  // Get all categories
  async getCategories() {
    await this.init();
    return await db.categories.toArray();
  }

  // Add custom category
  async addCategory(category) {
    await this.init();
    const id = await db.categories.add(category);
    return { ...category, id };
  }

  // Get transactions with optional filters
  async getTransactions(filters = {}) {
    await this.init();
    let collection = db.transactions.orderBy('transaction_date').reverse();

    let items = (await collection.toArray()).filter(alive);

    // Apply filters in memory for local mode
    if (filters.startDate && filters.endDate) {
      items = items.filter(t => t.transaction_date >= filters.startDate && t.transaction_date <= filters.endDate);
    }

    if (filters.type && filters.type !== 'ALL') {
      items = items.filter(t => t.type === filters.type);
    }

    if (filters.paymentSource && filters.paymentSource !== 'ALL') {
      items = items.filter(t => t.payment_source === filters.paymentSource);
    }

    if (filters.categoryId) {
      items = items.filter(t => t.category_id === Number(filters.categoryId));
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(t => 
        (t.note && t.note.toLowerCase().includes(q)) || 
        t.category_name.toLowerCase().includes(q)
      );
    }

    return items;
  }

  // Add new transaction
  async addTransaction(transaction) {
    await this.init();
    const newTx = {
      ...transaction,
      amount: Number(transaction.amount),
      ...stampNew()
    };
    const id = await db.transactions.add(newTx);
    return { ...newTx, id };
  }

  // Auto-parse Vietnamese Bank SMS and save as Bank Transaction
  async parseAndProcessSms(smsText, sender = 'SACOMBANK') {
    await this.init();

    // Match patterns like +50,000VND or +35.000đ or +100000VND
    const amountMatch = smsText.match(/\+([0-9.,]+)\s*(VND|đ|d)/i);
    
    if (!amountMatch) {
      throw new Error('Không tìm thấy giao dịch báo có (+) tiền hợp lệ trong tin nhắn');
    }

    const rawAmountStr = amountMatch[1].replace(/[,.]/g, '');
    const amount = Number(rawAmountStr);

    if (!amount || amount <= 0) {
      throw new Error('Số tiền bóc tách không hợp lệ');
    }

    const dateStr = new Date().toISOString().split('T')[0];

    const newTx = {
      type: 'IN',
      category_id: 1,
      category_name: 'Doanh thu nước ép',
      amount: amount,
      payment_source: 'BANK',
      note: `[SMS Tự Động ${sender}] ${smsText.substring(0, 100)}`,
      transaction_date: dateStr,
      ...stampNew()
    };

    const id = await db.transactions.add(newTx);
    return { ...newTx, id, parsedAmount: amount };
  }

  // Parse SMS Banking text into transaction object
  parseSmsMessage(smsText, categories = []) {
    const amountMatch = smsText.match(/\+([0-9.,]+)\s*(VND|đ|d)/i);
    if (!amountMatch) return null;

    const rawAmountStr = amountMatch[1].replace(/[,.]/g, '');
    const amount = Number(rawAmountStr);
    if (!amount || amount <= 0) return null;

    const dateStr = new Date().toISOString().split('T')[0];

    return {
      type: 'IN',
      category_id: categories[0]?.id || 1,
      category_name: categories[0]?.name || 'Doanh thu nước ép',
      amount: amount,
      payment_source: 'BANK',
      note: `[SMS Tự Động] ${smsText.substring(0, 100)}`,
      transaction_date: dateStr,
      created_at: new Date().toISOString()
    };
  }

  // Delete transaction (xóa mềm để đồng bộ được sang thiết bị khác)
  async deleteTransaction(id) {
    await this.init();
    await db.transactions.update(id, stampDelete());
    return true;
  }

  // Update existing transaction
  async updateTransaction(id, updates) {
    await this.init();
    const updatedTx = {
      ...updates,
      amount: Number(updates.amount),
      ...stampUpdate()
    };
    // uuid là danh tính đồng bộ, không được ghi đè khi sửa
    delete updatedTx.uuid;
    await db.transactions.update(id, updatedTx);
    return { id, ...updatedTx };
  }

  // Get Summary Statistics for Dashboard
  async getStats(startDate, endDate) {
    await this.init();
    const transactions = await this.getTransactions({ startDate, endDate });

    // Fetch all transactions up to endDate (or all-time) for accurate account fund balances
    const allTransactions = await this.getTransactions({});
    let accumulatedCashIn = 0;
    let accumulatedCashOut = 0;
    let accumulatedBankIn = 0;
    let accumulatedBankOut = 0;

    allTransactions.forEach(t => {
      // Only include transactions up to selected endDate if endDate exists
      if (endDate && t.transaction_date > endDate) return;
      const amt = Number(t.amount) || 0;
      if (t.type === 'IN') {
        if (t.payment_source === 'CASH') accumulatedCashIn += amt;
        if (t.payment_source === 'BANK') accumulatedBankIn += amt;
      } else {
        if (t.payment_source === 'CASH') accumulatedCashOut += amt;
        if (t.payment_source === 'BANK') accumulatedBankOut += amt;
      }
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let cashIncome = 0;
    let cashExpense = 0;
    let bankIncome = 0;
    let bankExpense = 0;

    const categoryMap = {};

    transactions.forEach(t => {
      const amount = Number(t.amount) || 0;
      if (t.type === 'IN') {
        totalIncome += amount;
        if (t.payment_source === 'CASH') cashIncome += amount;
        if (t.payment_source === 'BANK') bankIncome += amount;
      } else {
        totalExpense += amount;
        if (t.payment_source === 'CASH') cashExpense += amount;
        if (t.payment_source === 'BANK') bankExpense += amount;

        if (!categoryMap[t.category_name]) {
          categoryMap[t.category_name] = 0;
        }
        categoryMap[t.category_name] += amount;
      }
    });

    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;
    const cashBalance = accumulatedCashIn - accumulatedCashOut;
    const bankBalance = accumulatedBankIn - accumulatedBankOut;

    const expenseCategories = Object.keys(categoryMap).map(catName => ({
      name: catName,
      value: categoryMap[catName]
    })).sort((a, b) => b.value - a.value);

    const dailyMap = {};
    transactions.forEach(t => {
      const date = t.transaction_date;
      if (!dailyMap[date]) {
        dailyMap[date] = { date, income: 0, expense: 0 };
      }
      if (t.type === 'IN') {
        dailyMap[date].income += Number(t.amount);
      } else {
        dailyMap[date].expense += Number(t.amount);
      }
    });

    const dailyTrends = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin,
      cashBalance,
      bankBalance,
      cashIncome,
      bankIncome,
      cashExpense,
      bankExpense,
      expenseCategories,
      dailyTrends,
      transactionCount: transactions.length
    };
  }

  // Clear all transaction data
  async clearAllTransactions() {
    await this.init();
    await db.transactions.clear();
  }

  // Clear all data (Reset tool for user)
  async resetData() {
    await db.transactions.clear();
  }

  // Phase 3: Get total transaction count all-time
  async getTotalTransactionCount() {
    await this.init();
    return await db.transactions.filter(alive).count();
  }

  // Phase 3: Get peak revenue month
  async getPeakRevenueMonth() {
    await this.init();
    const allTx = (await db.transactions
      .where('type').equals('IN')
      .toArray()).filter(alive);

    if (allTx.length === 0) return null;

    const monthMap = {};
    allTx.forEach(t => {
      if (t.transaction_date) {
        const monthKey = t.transaction_date.substring(0, 7); // "YYYY-MM"
        monthMap[monthKey] = (monthMap[monthKey] || 0) + Number(t.amount);
      }
    });

    let peakMonth = null;
    let peakAmount = 0;
    for (const [month, amount] of Object.entries(monthMap)) {
      if (amount > peakAmount) {
        peakAmount = amount;
        peakMonth = month;
      }
    }

    if (!peakMonth) return null;

    const [y, m] = peakMonth.split('-');
    return {
      monthKey: peakMonth,
      label: `T${parseInt(m, 10)}/${y}`,
      amount: peakAmount
    };
  }

  // ── Daily Cash Tally (Nhập số tiền mặt đầu ngày - cuối ngày) ──
  async getDailyCashRecords(filters = {}) {
    await this.init();
    let collection = db.daily_cash_records.orderBy('date').reverse();
    let items = (await collection.toArray()).filter(alive);

    if (filters.startDate && filters.endDate) {
      items = items.filter(r => r.date >= filters.startDate && r.date <= filters.endDate);
    }
    return items;
  }

  async getDailyCashByDate(date) {
    await this.init();
    const record = await db.daily_cash_records.where('date').equals(date).first();
    return record && alive(record) ? record : null;
  }

  async getYesterdayClosingCash(currentDate) {
    await this.init();
    const records = (await db.daily_cash_records
      .where('date')
      .below(currentDate)
      .reverse()
      .sortBy('date')).filter(alive);
    if (records.length > 0) {
      return records[0].closing_cash || 0;
    }
    return 0;
  }

  async saveDailyCashRecord({ date, opening_cash, closing_cash, note = '', saveAsTransaction = false }) {
    await this.init();
    const openVal = Number(opening_cash) || 0;
    const closeVal = Number(closing_cash) || 0;
    const totalCash = closeVal - openVal; // Hiệu = Cuối ngày - Đầu ngày

    // Cố ý KHÔNG lọc tombstone ở đây: `date` là UNIQUE, nên nếu bản ghi của
    // ngày này từng bị xóa mềm thì phải hồi sinh chính dòng đó (deleted: 0),
    // chứ thêm dòng mới sẽ vi phạm ràng buộc UNIQUE.
    const existing = await db.daily_cash_records.where('date').equals(date).first();
    let recordId;

    if (existing) {
      recordId = existing.id;
      await db.daily_cash_records.update(existing.id, {
        opening_cash: openVal,
        closing_cash: closeVal,
        total_cash: totalCash,
        note: note,
        deleted: 0,
        ...stampUpdate()
      });
    } else {
      recordId = await db.daily_cash_records.add({
        date: date,
        opening_cash: openVal,
        closing_cash: closeVal,
        total_cash: totalCash,
        note: note,
        ...stampNew()
      });
    }

    // Optionally sync / save as a transaction in Sổ Thu Chi if requested and totalCash > 0
    if (saveAsTransaction && totalCash > 0) {
      const formattedDate = date.split('-').reverse().join('/');
      const syncNote = `[Chốt tiền mặt ${formattedDate}] ${note ? `(${note})` : ''}`.trim();
      
      const allTxForDate = (await db.transactions.where('transaction_date').equals(date).toArray()).filter(alive);
      const existingSyncTx = allTxForDate.find(t => t.note && t.note.includes('[Chốt tiền mặt'));

      if (existingSyncTx) {
        await db.transactions.update(existingSyncTx.id, {
          amount: totalCash,
          note: syncNote,
          ...stampUpdate()
        });
      } else {
        const categories = await this.getCategories();
        const catIn = categories.find(c => c.type === 'IN') || { id: 1, name: 'Doanh thu nước ép' };
        await db.transactions.add({
          type: 'IN',
          category_id: catIn.id,
          category_name: catIn.name,
          amount: totalCash,
          payment_source: 'CASH',
          note: syncNote,
          transaction_date: date,
          ...stampNew()
        });
      }
    }

    return {
      id: recordId,
      date,
      opening_cash: openVal,
      closing_cash: closeVal,
      total_cash: totalCash,
      note
    };
  }

  async deleteDailyCashRecord(id) {
    await this.init();
    await db.daily_cash_records.update(id, stampDelete());
    return true;
  }

  // ── Quick Notes (Ghi Chú Nhanh) ──
  async getQuickNotes() {
    await this.init();
    return (await db.quick_notes.orderBy('created_at').reverse().toArray()).filter(alive);
  }

  async addQuickNote({ text, color = '#10B981' }) {
    await this.init();
    const note = { text, is_done: false, color, ...stampNew() };
    const id = await db.quick_notes.add(note);
    return { ...note, id };
  }

  async toggleQuickNote(id) {
    await this.init();
    const note = await db.quick_notes.get(id);
    if (!note) return null;
    const updated = { is_done: !note.is_done, ...stampUpdate() };
    await db.quick_notes.update(id, updated);
    return { ...note, ...updated };
  }

  async updateQuickNote(id, updates) {
    await this.init();
    const updated = { ...updates, ...stampUpdate() };
    delete updated.uuid;
    await db.quick_notes.update(id, updated);
    return { id, ...updated };
  }

  async deleteQuickNote(id) {
    await this.init();
    await db.quick_notes.update(id, stampDelete());
    return true;
  }

  // ── Quick Expense Presets (Mẫu nhập nhanh chi phí thường dùng) ──
  async getExpensePresets() {
    await this.init();
    const items = (await db.expense_presets.toArray()).filter(alive);
    return items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  async addExpensePreset(preset) {
    await this.init();
    const existing = await db.expense_presets.toArray();
    const maxOrder = existing.reduce((max, p) => Math.max(max, p.sort_order || 0), 0);

    const newPreset = {
      label: preset.label,
      icon: preset.icon || '⚡',
      amount: Number(preset.amount) || 0,
      category_id: Number(preset.category_id),
      category_name: preset.category_name,
      payment_source: preset.payment_source || 'CASH',
      sort_order: maxOrder + 1,
      ...stampNew()
    };

    const id = await db.expense_presets.add(newPreset);
    return { ...newPreset, id };
  }

  async updateExpensePreset(id, updates) {
    await this.init();
    const patch = {
      label: updates.label,
      icon: updates.icon || '⚡',
      amount: Number(updates.amount) || 0,
      category_id: Number(updates.category_id),
      category_name: updates.category_name,
      payment_source: updates.payment_source || 'CASH',
      ...stampUpdate()
    };
    await db.expense_presets.update(id, patch);
    return { id, ...patch };
  }

  async deleteExpensePreset(id) {
    await this.init();
    await db.expense_presets.update(id, stampDelete());
    return true;
  }
}

export const storageService = new StorageService();

