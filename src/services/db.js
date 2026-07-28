import Dexie from 'dexie';

// Initialize IndexedDB database for JuiceLedger
export const db = new Dexie('JuiceLedgerDB');

db.version(1).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at'
});

// Seed default categories and initial demo data if empty
export async function seedInitialData() {
  const countCategories = await db.categories.count();
  if (countCategories === 0) {
    await db.categories.bulkAdd([
      { id: 1, name: 'Doanh thu nước ép', type: 'IN', icon: '🍹', color: '#10B981' },
      { id: 2, name: 'Doanh thu ship app (Grab/ShopeeFood)', type: 'IN', icon: '🛵', color: '#06B6D4' },
      { id: 3, name: 'Thu khác', type: 'IN', icon: '💵', color: '#8B5CF6' },
      { id: 4, name: 'Trái cây / Hoa quả', type: 'OUT', icon: '🍎', color: '#F97316' },
      { id: 5, name: 'Bao bì & Vật tư (Ly, ống hút)', type: 'OUT', icon: '🥤', color: '#EC4899' },
      { id: 6, name: 'Đá lạnh', type: 'OUT', icon: '🧊', color: '#3B82F6' },
      { id: 7, name: 'Điện nước & Internet', type: 'OUT', icon: '⚡', color: '#EAB308' },
      { id: 8, name: 'Tiền mặt bằng', type: 'OUT', icon: '🏠', color: '#6366F1' },
      { id: 9, name: 'Lương nhân viên', type: 'OUT', icon: '👨‍🍳', color: '#14B8A6' },
      { id: 10, name: 'Chi phí khác', type: 'OUT', icon: '💸', color: '#64748B' }
    ]);
  }

  const countTransactions = await db.transactions.count();
  if (countTransactions === 0) {
    // Generate realistic demo transactions for the past 14 days
    const demoItems = [];
    const today = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Income - Cash & Bank QR
      const cashJuice = Math.floor(Math.random() * 800000) + 1200000; // 1.2M - 2.0M
      const bankJuice = Math.floor(Math.random() * 1500000) + 1800000; // 1.8M - 3.3M

      demoItems.push({
        type: 'IN',
        category_id: 1,
        category_name: 'Doanh thu nước ép',
        amount: cashJuice,
        payment_source: 'CASH',
        note: 'Doanh thu tiền mặt tại quầy',
        transaction_date: dateStr,
        created_at: new Date(d.setHours(12, 0, 0)).toISOString()
      });

      demoItems.push({
        type: 'IN',
        category_id: 1,
        category_name: 'Doanh thu nước ép',
        amount: bankJuice,
        payment_source: 'BANK',
        note: 'Doanh thu chuyển khoản QR VietQR',
        transaction_date: dateStr,
        created_at: new Date(d.setHours(18, 30, 0)).toISOString()
      });

      // Daily fruit expense
      const fruitExpense = Math.floor(Math.random() * 600000) + 800000; // 800k - 1.4M
      demoItems.push({
        type: 'OUT',
        category_id: 4,
        category_name: 'Trái cây / Hoa quả',
        amount: fruitExpense,
        payment_source: Math.random() > 0.4 ? 'CASH' : 'BANK',
        note: 'Nhập cam, dưa hấu, cà rốt, dứa đầu ngày',
        transaction_date: dateStr,
        created_at: new Date(d.setHours(7, 30, 0)).toISOString()
      });

      // Ice expense daily
      demoItems.push({
        type: 'OUT',
        category_id: 6,
        category_name: 'Đá lạnh',
        amount: 60000,
        payment_source: 'CASH',
        note: '3 bao đá bi',
        transaction_date: dateStr,
        created_at: new Date(d.setHours(8, 0, 0)).toISOString()
      });

      // Occasional packaging or utilities
      if (i % 5 === 0) {
        demoItems.push({
          type: 'OUT',
          category_id: 5,
          category_name: 'Bao bì & Vật tư (Ly, ống hút)',
          amount: 450000,
          payment_source: 'BANK',
          note: 'Mua 1000 ly nhựa 500ml + 500 ống hút bọc màng',
          transaction_date: dateStr,
          created_at: new Date(d.setHours(10, 15, 0)).toISOString()
        });
      }
    }

    await db.transactions.bulkAdd(demoItems);
  }
}
