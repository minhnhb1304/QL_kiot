import { db, seedInitialData } from './db';

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

    let items = await collection.toArray();

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
      created_at: new Date().toISOString()
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
      created_at: new Date().toISOString()
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

  // Delete transaction
  async deleteTransaction(id) {
    await this.init();
    await db.transactions.delete(id);
    return true;
  }

  // Get Summary Statistics for Dashboard
  async getStats(startDate, endDate) {
    await this.init();
    const transactions = await this.getTransactions({ startDate, endDate });

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
    const cashBalance = cashIncome - cashExpense;
    const bankBalance = bankIncome - bankExpense;

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
    return await db.transactions.count();
  }

  // Phase 3: Get peak revenue month
  async getPeakRevenueMonth() {
    await this.init();
    const allTx = await db.transactions
      .where('type').equals('IN')
      .toArray();

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
}

export const storageService = new StorageService();
