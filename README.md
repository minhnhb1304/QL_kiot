# 🍹 JuiceLedger — Giải Pháp Quản Lý Dòng Tiền & Sổ Thu Chi Cá Nhân

> **Ứng dụng quản lý tài chính & kiểm soát dòng tiền đơn giản, khoa học và riêng tư cho mô hình kinh doanh nhỏ, quán nước ép & cửa hàng cá nhân.**

---

## 💡 Bối Cảnh & Vấn Đề Giải Quyết

Nhiều chủ cửa hàng nhỏ, quán bán hàng cá nhân hiện nay sử dụng **tài khoản ngân hàng cá nhân** để nhận tiền chuyển khoản QR từ khách hàng. Tuy nhiên, họ gặp phải các bài toán thực tế:

- **Khó kiểm soát dòng tiền tổng thể**: Việc kiểm tra trực tiếp trên app ngân hàng mất thời gian và khó tổng hợp lại doanh thu/chi phí theo ngày, tuần, tháng.
- **Chi phí giải pháp tự động quá cao**: Các dịch vụ bên thứ ba (như SePay...) tính phí theo *số lượng giao dịch*. Với quán nước ép hay cửa hàng bán lẻ có số lượng đơn nhỏ nhưng tần suất lớn, chi phí duy trì hàng tháng trở nên rất tốn kém.
- **Nhu cầu riêng tư & đơn giản**: Chỉ cần 1 hệ thống cho đúng 1 người quản lý, giao diện tinh gọn, không rườm rà, xem tốt trên điện thoại di động (iPhone / Android).

👉 **JuiceLedger** ra đời để giải quyết triệt để vấn đề này: Kết hợp **Sổ thu chi thông minh + Tự động hóa qua SMS Banking Webhook** với **0đ chi phí duy trì hàng tháng**.

---

## ✨ Tính Năng Cốt Lõi

### 📊 1. Thống Kê & Báo Cáo Tài Chính Trực Quan
- **KPI Cards**: Theo dõi nhanh Doanh Thu, Chi Phí, Lãi Ròng và Tỷ suất lợi nhuận (Profit Margin %).
- **Biểu đồ Dòng Tiền (Cashflow Chart)**: So sánh doanh thu và chi phí theo thời gian (Hôm nay, 7 ngày qua, Tháng này, Tất cả).
- **Biểu đồ Tỷ Trọng Chi Phí (Expense Pie Chart)**: Phân tích các khoản chi theo danh mục (Nguyên liệu, Mặt bằng, Điện nước, Dụng cụ...).

### 📒 2. Sổ Thu Chi Với Chế Độ Xem Song Song
- **Chế độ Gộp Chung**: Danh sách/bảng giao dịch tiêu chuẩn sắp xếp theo thời gian.
- **Chế độ Thu | Chi Song Song (Split View)**: Hiển thị cột Khoản Thu (bên trái) và Khoản Chi (bên phải) cạnh nhau, giúp chủ quán dễ dàng quan sát và đối soát tức thì.
- **Bộ lọc đa năng**: Tìm kiếm theo từ khóa ghi chú, lọc theo nguồn tiền (Ngân hàng / Tiền mặt).

### 📲 3. SMS Banking Tự Động (0đ Phí Giao Dịch)
- **Tự động bắt biến động số dư**: Kết hợp ứng dụng đẩy tin nhắn (như MacroDroid/Tasker) đọc SMS ngân hàng gửi về điện thoại và gửi Webhook tới JuiceLedger.
- **Phân tích cú pháp thông minh**: Tự động nhận diện số tiền, mã giao dịch, thời gian và phân loại nguồn Ngân hàng mà không cần nhập tay.

### 🏦 4. Phân Loại Quỹ Tiền Mặt & Ngân Hàng
- Quản lý tách biệt **Tiền mặt tại quầy** và **Số dư Ngân hàng (Chuyển khoản QR)**.
- Giúp chủ quán nắm rõ tiền đang nằm ở đâu để chủ động nhập hàng hay rút tiền mặt.

### 📱 5. Thiết Kế Mobile-First & Trải Nghiệm Premium
- **Left Drawer Navigation (Menu Hamburger ☰)**: Điều hướng gọn gàng, tối ưu không gian hiển thị trên điện thoại.
- **Tương thích iPhone & Android**: Tối ưu Safe-area notches, chống auto-zoom ô nhập liệu trên iOS.
- **Chế độ Sáng / Tối (Light & Dark Mode)**: Chuyển đổi giao diện linh hoạt bảo vệ mắt.

### 🔒 6. Bảo Mật & Riêng Tư (Privacy-First)
- Toàn bộ dữ liệu được lưu trữ an toàn ngay trên trình duyệt thiết bị người dùng (IndexedDB via Dexie.js).
- Không lo rò rỉ dữ liệu tài chính hay lưu trữ thông tin ngân hàng nhạy cảm trên máy chủ bên thứ ba.

---

## 🔄 Luồng Hoạt Động SMS Banking Tự Động

```
[Khách chuyển khoản QR] ➔ [Ngân hàng gửi SMS vào Phone] ➔ [MacroDroid / Tasker đọc SMS]
                                                                   │
                                                                   ▼
[App JuiceLedger tự ghi sổ] ◄── [Webhook API phân tích dữ liệu] ◄──┘
```

---

## 🛠️ Cấu Trúc Công Nghệ (Tech Stack)

| Thành Phần | Công Nghệ |
|---|---|
| **Core Framework** | React 19, Vite |
| **Icons & UI Elements** | Lucide React |
| **Data Visualization** | Chart.js & React-ChartJS-2 |
| **Local Storage** | Dexie.js (IndexedDB) |
| **Styling Strategy** | Custom Vanilla CSS Tokens, Flexbox/Grid, Mobile-First Media Queries |

---

## 🚀 Hướng Dẫn Khởi Chạy

### 1. Cài Đặt Tại Local
```bash
# Cài đặt thư viện
npm install

# Chạy server phát triển (hỗ trợ truy cập từ điện thoại cùng WiFi)
npm run dev -- --host

# Kiểm tra đóng gói Production
npm run build
```

### 2. Triển Khai Lên Web (Deploy)
Dự án được cấu hình sẵn cho các nền tảng Cloud Hosting phổ biến:
- **Vercel**: Tích hợp sẵn `vercel.json` hỗ trợ SPA Routing.
- **Netlify**: Tích hợp sẵn `public/_redirects`.

---

## 📄 Giấy Phép
Dự án phát hành theo giấy phép MIT — Tự do tùy biến và sử dụng cá nhân.
