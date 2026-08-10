# 🚀 Spec Các Tính Năng Nâng Cấp Tương Lai (Future Features Spec)

> Document tổng hợp các tính năng nhỏ, tiện ích được lập kế hoạch phát triển cho JuiceLedger (QL_kiot).

---

## 📌 Danh Sách Tính Năng

### 1. ✏️ Chỉnh Sửa Giao Dịch (Edit Transaction) — [ĐANG THỰC HIỆN]
- **Mục tiêu**: Cho phép chỉnh sửa trực tiếp các giao dịch thu/chi đã tạo mà không cần xóa đi tạo lại.
- **Chi tiết**:
  - Thêm nút **"Sửa" (Edit)** bên cạnh nút Xóa trên từng dòng giao dịch (trong cả View gộp chung và Split View).
  - Tái sử dụng `TransactionFormModal` (hoặc mở ở chế độ Edit) với dữ liệu được điền sẵn.
  - Cập nhật hàm `updateTransaction(id, updates)` trong `storageService.js` và `db.js`.
  - Tự động load lại thống kê & danh sách sau khi chỉnh sửa.

### 2. 🔍 Bộ Lọc Nâng Cao Cho Sổ Thu Chi (Advanced Ledger Filters)
- **Mục tiêu**: Tìm kiếm và lọc giao dịch chi tiết hơn.
- **Chi tiết**:
  - Lọc theo khoảng thời gian tùy chọn (Từ ngày ... Đến ngày ...).
  - Lọc theo Danh mục (VD: Chỉ xem chi "Trái cây" hoặc thu "App ship").
  - Cho phép xóa nhanh các bộ lọc về trạng thái mặc định.

### 3. ⚡ Mẫu Nhập Nhanh Chi Phí Thường Dùng (Quick Expense Presets)
- **Mục tiêu**: Giảm thời gian nhập liệu các khoản chi lặp đi lặp lại hàng ngày.
- **Chi tiết**:
  - Thêm danh sách phím tắt 1-click: `[🧊 Đá 20k]`, `[🥤 Ly/Ống hút 50k]`, `[🍊 Cam 200k]`.
  - Cho phép tùy chỉnh/thêm bớt các preset trong Cài đặt.

### 4. 💾 Sao Lưu & Khôi Phục Dữ Liệu JSON (Data Backup & Restore)
- **Mục tiêu**: Bảo vệ dữ liệu và chuyển đổi giữa các thiết bị linh hoạt.
- **Chi tiết**:
  - Nút **"Xuất file sao lưu (.json)"**: Đóng gói toàn bộ `categories`, `transactions`, `store_profile`, `daily_cash_records`.
  - Nút **"Khôi phục từ file (.json)"**: Nạp lại dữ liệu an toàn.

### 5. 📸 Thẻ Tóm Tắt Doanh Thu Ngày (Daily Summary Card)
- **Mục tiêu**: Dễ dàng chia sẻ báo cáo nhanh cuối ngày vào nhóm chat (Zalo/Telegram).
- **Chi tiết**:
  - Hiển thị card tổng kết Doanh thu, Chi phí, Lãi ròng, Tiền mặt thực tế.
  - Hỗ trợ copy tóm tắt văn bản hoặc tải ảnh báo cáo.

---
*Ngày cập nhật: 10/08/2026*
