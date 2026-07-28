# 🍹 JuiceLedger — Sổ Thu Chi & Quản Lý Dòng Tiền Quán Nước Ép

**JuiceLedger** là ứng dụng sổ thu chi và kiểm soát dòng tiền cá nhân được thiết kế tối ưu dành riêng cho chủ cửa hàng nhỏ, quán nước ép / đồ uống. Ứng dụng giúp theo dõi chính xác từng khoản thu chi, phân biệt nguồn tiền ngân hàng và tiền mặt, tích hợp SMS Banking tự động mà không mất phí giao dịch hàng tháng.

---

## 🌟 Tính Năng Nổi Bật

- **📊 Thống Kê Tài Chính Trực Quan**:
  - Theo dõi Doanh Thu, Chi Phí, Lãi Ròng và Tỷ suất lợi nhuận theo thời gian (Hôm nay, 7 ngày qua, Tháng này, Tất cả).
  - Biểu đồ dòng tiền (Bar Chart) và tỷ trọng chi phí (Doughnut Chart) được thiết kế tối ưu responsive trên mọi thiết bị.

- **📒 Sổ Thu Chi Đa Dạng Chế Độ Xem**:
  - Chế độ **Gộp chung**: Xem toàn bộ lịch sử giao dịch dưới dạng danh sách/bảng.
  - Chế độ **Thu | Chi song song**: Hiển thị 2 cột riêng biệt bên cạnh nhau để dễ đối soát.
  - Bộ lọc thông minh theo nguồn tiền (Ngân hàng / Tiền mặt) và từ khóa tìm kiếm.

- **📱 SMS Banking Tự Động (Miễn phí 100%)**:
  - Tự động bắt tin nhắn biến động số dư từ Android/iOS đẩy qua Webhook (Tasker/Macrodroid).
  - Phân tích cú pháp SMS thông minh (Số tiền, Mã giao dịch, Nội dung) và tự động ghi sổ mà không tốn phí per-transaction.

- **🏦 Phân Loại Nguồn Tiền**:
  - Tách biệt rõ ràng **Tiền mặt tại quầy** và **Tài khoản Ngân hàng (QR)**.

- **📱 Tối Ưu Mobile-First & PWA**:
  - Giao diện Drawer Navigation slide từ bên trái.
  - Chế độ giao diện Sáng / Tối (Light & Dark Mode).
  - Hỗ trợ safe-area notches cho iPhone và các dòng điện thoại thông minh.

---

## 🚀 Công Nghệ Sử Dụng

- **Frontend**: React 19, Vite
- **Icon Set**: Lucide React
- **Charts**: Chart.js & React-ChartJS-2
- **Offline Database**: Dexie.js (IndexedDB)
- **Styling**: Vanilla CSS3 Custom Tokens & Responsive Design

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Tại Local

### 1. Yêu cầu hệ thống
- Node.js (phiên bản 18 trở lên)
- npm hoặc yarn

### 2. Các bước khởi chạy
```bash
# Cài đặt dependencies
npm install

# Khởi chạy dev server (mở port local & network cho điện thoại)
npm run dev -- --host

# Kiểm tra build cho production
npm run build
```

---

## 🌐 Hướng Dẫn Deploy Lên Vercel / Netlify

### Cách 1: Deploy lên Vercel (Khuyên dùng - 1 Click)
1. Đẩy code lên repository GitHub của bạn (xem hướng dẫn bên dưới).
2. Truy cập [vercel.com](https://vercel.com) và đăng nhập bằng tài khoản GitHub.
3. Chọn **New Project** ➔ Chọn Repository `JuiceLedger`.
4. Giữ nguyên cấu hình mặc định (Framework Preset: **Vite**, Build Command: `npm run build`, Output Directory: `dist`).
5. Bấm **Deploy**.

### Cách 2: Deploy lên Netlify
1. Truy cập [netlify.com](https://netlify.com) và kết nối tài khoản GitHub.
2. Chọn **Add new site** ➔ **Import an existing project**.
3. Chọn repository `JuiceLedger` ➔ Bấm **Deploy**.

---

## 📄 Giấy Phép
Dự án được phát hành theo giấy phép MIT.
