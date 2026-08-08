import * as XLSX from 'xlsx';

/**
 * Export Transaction Ledger to Excel (.xlsx)
 * @param {Array} transactions List of transactions to export
 * @param {Object} storeProfile Store details
 * @param {Object} options Filter options (filterLabel, dateFilter, sourceFilter, viewMode)
 */
export function exportTransactionsToExcel(transactions = [], storeProfile = {}, options = {}) {
  const storeName = storeProfile?.storeName || 'Cửa hàng';
  const exportDate = new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const filterLabel = options.filterLabel || 'Tất cả';

  // 1. Prepare Header rows
  const sheetData = [
    [`BÁO CÁO SỔ THU CHI - ${storeName.toUpperCase()}`],
    [`Ngày xuất file: ${exportDate}`],
    [`Phạm vi lọc: ${filterLabel}`],
    [] // Empty row separator
  ];

  // 2. Table Headers
  const headers = [
    'STT',
    'Ngày Giao Dịch',
    'Loại Giao Dịch',
    'Danh Mục',
    'Ghi Chú',
    'Nguồn Thanh Toán',
    'Số Tiền'
  ];
  sheetData.push(headers);

  // 3. Populate rows
  let totalIn = 0;
  let totalOut = 0;

  transactions.forEach((tx, idx) => {
    const isIncome = tx.type === 'IN';
    const amount = Number(tx.amount) || 0;

    if (isIncome) totalIn += amount;
    else totalOut += amount;

    sheetData.push([
      idx + 1,
      tx.transaction_date || '',
      isIncome ? 'THU (+)' : 'CHI (-)',
      tx.category_name || '',
      tx.note || '',
      tx.payment_source === 'BANK' ? 'Ngân hàng' : 'Tiền mặt',
      amount
    ]);
  });

  // 4. Summary rows
  sheetData.push([]); // Empty row
  sheetData.push(['TỔNG CỘNG THU (IN)', '', '', '', '', '', totalIn]);
  sheetData.push(['TỔNG CỘNG CHI (OUT)', '', '', '', '', '', totalOut]);
  sheetData.push(['THẶNG DƯ / LÃI RÒNG', '', '', '', '', '', totalIn - totalOut]);
  sheetData.push(['TỔNG SỐ GIAO DỊCH', '', '', '', '', '', transactions.length]);

  // Create Worksheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 15 }, // Ngày Giao Dịch
    { wch: 16 }, // Loại Giao Dịch
    { wch: 25 }, // Danh Mục
    { wch: 35 }, // Ghi Chú
    { wch: 18 }, // Nguồn Thanh Toán
    { wch: 18 }  // Số Tiền
  ];

  // Create Workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'So_Thu_Chi');

  // Filename timestamp
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `So_Thu_Chi_${storeName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

  // Trigger download
  XLSX.writeFile(wb, filename);
}

/**
 * Export Financial Statistics & Dashboard Reports to Excel (.xlsx)
 * @param {Object} stats Financial stats object from storageService.getStats
 * @param {String} periodLabel Time range label (e.g., 'Tháng này', '7 ngày qua')
 * @param {Object} storeProfile Store details
 */
export function exportDashboardStatsToExcel(stats, periodLabel = 'Tất cả', storeProfile = {}) {
  if (!stats) return;

  const storeName = storeProfile?.storeName || 'Cửa hàng';
  const exportDate = new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const wb = XLSX.utils.book_new();

  // ==========================================
  // SHEET 1: TỔNG QUAN KPI & QUỸ TÀI CHÍNH
  // ==========================================
  const totalFundBalance = (stats.cashBalance || 0) + (stats.bankBalance || 0);

  const kpiData = [
    [`BÁO CÁO THỐNG KÊ TÀI CHÍNH - ${storeName.toUpperCase()}`],
    [`Kỳ báo cáo: ${periodLabel}`],
    [`Ngày xuất file: ${exportDate}`],
    [],
    ['MỤC THỐNG KÊ', 'GIÁ TRỊ (VND / UNT)', 'GHI CHÚ / TỶ LỆ'],
    ['Tổng Doanh Thu (Thu)', stats.totalIncome || 0, 'Các khoản thu vào'],
    ['Tổng Chi Phí (Chi)', stats.totalExpense || 0, 'Các khoản chi ra'],
    ['Lãi Ròng (Lợi Nhuận Thuần)', stats.netProfit || 0, stats.netProfit >= 0 ? 'Có lãi' : 'Đang lỗ'],
    ['Tỷ Suất Lợi Nhuận (%)', `${stats.profitMargin || 0}%`, 'Lãi ròng / Doanh thu'],
    [],
    ['NGUỒN TIỀN & SỐ DƯ QUỸ', '', ''],
    ['Tiền Mặt Tại Quầy', stats.cashBalance || 0, 'Số dư tiền mặt khả dụng'],
    ['Tài Khoản Ngân Hàng (Bank QR)', stats.bankBalance || 0, 'Số dư tài khoản bank'],
    ['TỔNG SỐ DƯ TÀI CHÍNH', totalFundBalance, 'Tổng tiền mặt + Ngân hàng'],
    [],
    ['CHI TIẾT THEO HÌNH THỨC', '', ''],
    ['Doanh Thu Tiền Mặt', stats.cashIncome || 0, 'Thu tiền mặt'],
    ['Doanh Thu Chuyển Khoản / Bank', stats.bankIncome || 0, 'Thu ngân hàng / QR'],
    ['Chi Phí Tiền Mặt', stats.cashExpense || 0, 'Chi bằng tiền mặt'],
    ['Chi Phí Chuyển Khoản / Bank', stats.bankExpense || 0, 'Chi qua ngân hàng']
  ];

  if (storeProfile?.monthlyRevenueGoal > 0) {
    const goal = storeProfile.monthlyRevenueGoal;
    const current = stats.totalIncome || 0;
    const percent = ((current / goal) * 100).toFixed(1);
    kpiData.push([]);
    kpiData.push(['MỤC TIÊU DOANH THU THÁNG', goal, `Đã đạt ${percent}% target`]);
  }

  const wsKpi = XLSX.utils.aoa_to_sheet(kpiData);
  wsKpi['!cols'] = [
    { wch: 32 },
    { wch: 22 },
    { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsKpi, 'Tong_Quan_KPI');

  // ==========================================
  // SHEET 2: XU HƯỚNG THU CHI THEO NGÀY
  // ==========================================
  const trendRows = [
    [`XU HƯỚNG THU CHI THEO NGÀY - ${storeName.toUpperCase()}`],
    [`Kỳ báo cáo: ${periodLabel}`],
    [],
    ['STT', 'Ngày', 'Doanh Thu (+)', 'Chi Phí (-)', 'Lãi Ròng']
  ];

  let sumIncome = 0;
  let sumExpense = 0;

  (stats.dailyTrends || []).forEach((item, idx) => {
    const inc = Number(item.income) || 0;
    const exp = Number(item.expense) || 0;
    const net = inc - exp;
    sumIncome += inc;
    sumExpense += exp;

    trendRows.push([
      idx + 1,
      item.date,
      inc,
      exp,
      net
    ]);
  });

  trendRows.push([]);
  trendRows.push(['TỔNG CỘNG', 'All Days', sumIncome, sumExpense, sumIncome - sumExpense]);

  const wsTrends = XLSX.utils.aoa_to_sheet(trendRows);
  wsTrends['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsTrends, 'Xu_Huong_Thu_Chi');

  // ==========================================
  // SHEET 3: CƠ CẤU CHI PHÍ THEO DANH MỤC
  // ==========================================
  const catRows = [
    [`CƠ CẤU CHI PHÍ THEO DANH MỤC - ${storeName.toUpperCase()}`],
    [`Kỳ báo cáo: ${periodLabel}`],
    [],
    ['STT', 'Danh Mục Chi Phí', 'Số Tiền Chi (VND)', 'Tỷ Lệ (%)']
  ];

  const totalCatExpense = stats.totalExpense || 1; // avoid division by zero

  (stats.expenseCategories || []).forEach((cat, idx) => {
    const val = Number(cat.value) || 0;
    const pct = ((val / totalCatExpense) * 100).toFixed(1);
    catRows.push([
      idx + 1,
      cat.name,
      val,
      `${pct}%`
    ]);
  });

  catRows.push([]);
  catRows.push(['TỔNG CỘNG CHI PHÍ', '', stats.totalExpense || 0, '100%']);

  const wsCat = XLSX.utils.aoa_to_sheet(catRows);
  wsCat['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 22 },
    { wch: 14 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCat, 'Co_Cau_Chi_Phi');

  // Filename timestamp
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Bao_Cao_Thong_Ke_${storeName.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);
}
