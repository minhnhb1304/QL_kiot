import Dexie from 'dexie';

export async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Initialize IndexedDB database for JuiceLedger
export const db = new Dexie('JuiceLedgerDB');

db.version(1).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at'
});

db.version(2).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, password, fullName, role, phone, email, created_at'
});

db.version(3).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, passwordHash, fullName, role, phone, email, created_at'
});

// Seed default categories, initial demo data and default users if empty
export async function seedInitialData() {
  const countUsers = await db.users.count();
  if (countUsers === 0) {
    await db.users.bulkAdd([
      {
        username: 'admin',
        passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        fullName: 'Chủ Quán Nước Ép',
        role: 'OWNER',
        phone: '0901234567',
        email: 'admin@juiceledger.com',
        created_at: new Date().toISOString()
      },
      {
        username: 'quan',
        passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        fullName: 'Quản Lý Cửa Hàng',
        role: 'OWNER',
        phone: '0907654321',
        email: 'quanly@juiceledger.com',
        created_at: new Date().toISOString()
      },
      {
        username: 'nhanvien',
        passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        fullName: 'Nhân Viên Thu Ngân',
        role: 'STAFF',
        phone: '0988888888',
        email: 'nhanvien@juiceledger.com',
        created_at: new Date().toISOString()
      }
    ]);
  }

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
