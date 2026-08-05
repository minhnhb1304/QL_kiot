# 🏪 Đề Xuất Tính Năng: Hồ Sơ Cửa Hàng (Store Profile)

## Hiện trạng

Hiện tại JuiceLedger chỉ lưu thông tin **tài khoản đăng nhập** cơ bản:

| Trường | Mô tả |
|---|---|
| `username` | Tên đăng nhập |
| `fullName` | Tên hiển thị (vừa thêm chức năng chỉnh sửa) |
| `role` | OWNER / STAFF |
| `phone`, `email` | Thông tin liên hệ |

**Chưa có** bất kỳ thông tin nào về **cửa hàng** — tên quán, ngày bắt đầu kinh doanh, logo, v.v.

---

## Đề Xuất 3 Nhóm Tính Năng

### 📋 Nhóm 1 — Thông Tin Cơ Bản Cửa Hàng

> Mục tiêu: Cá nhân hóa ứng dụng theo cửa hàng của user

| Tính năng | Mô tả | Nơi hiển thị |
|---|---|---|
| **Tên cửa hàng** | Thay thế "JuiceLedger" trên header bằng tên quán thực tế (vd: "Quán Nước Ép Minh") | Header, Drawer |
| **Logo / Avatar cửa hàng** | Upload ảnh logo, hiển thị thay icon 🍊 mặc định | Header, Drawer |
| **Địa chỉ cửa hàng** | Lưu địa chỉ kinh doanh | Trang Hồ Sơ |
| **Số điện thoại quán** | SĐT liên hệ của cửa hàng (khác SĐT cá nhân) | Trang Hồ Sơ |
| **Slogan / Mô tả ngắn** | Dòng tagline nhỏ dưới tên quán (vd: "Nước ép tươi nguyên chất") | Drawer |

### 📊 Nhóm 2 — Thống Kê & Cột Mốc

> Mục tiêu: Giúp chủ quán theo dõi hành trình kinh doanh

| Tính năng | Mô tả | Nơi hiển thị |
|---|---|---|
| **Ngày bắt đầu sử dụng app** | Tự động ghi nhận khi tạo tài khoản, hiển thị "Đã sử dụng X ngày" | Dashboard, Hồ Sơ |
| **Ngày bắt đầu kinh doanh** | User tự nhập ngày mở quán (có thể trước khi dùng app) | Trang Hồ Sơ |
| **Tổng số giao dịch** | Đếm tổng số giao dịch đã ghi nhận từ trước đến nay | Dashboard card |
| **Tháng có doanh thu cao nhất** | Tự động tính và highlight tháng peak | Dashboard |
| **Chuỗi ngày ghi sổ liên tiếp** | Streak — số ngày liên tiếp có ghi nhận giao dịch (gamification nhẹ) | Dashboard card |

### ⚙️ Nhóm 3 — Cài Đặt & Cá Nhân Hóa

> Mục tiêu: Tùy chỉnh trải nghiệm sử dụng app

| Tính năng | Mô tả |
|---|---|
| **Đơn vị tiền tệ** | Cho phép chọn VND / USD / custom (hiện đang hardcode VND) |
| **Ngày bắt đầu tháng tài chính** | Mặc định ngày 1, nhưng một số quán tính tháng từ ngày 15 hoặc ngày 25 |
| **Mục tiêu doanh thu tháng** | Đặt target, hiển thị progress bar trên Dashboard |
| **Ghi chú cửa hàng** | Notepad nhỏ để ghi nhớ (vd: "Nhớ đổi nhà cung cấp trái cây tháng 9") |

---

## Schema Database Đề Xuất

Thêm bảng mới `store_profile` trong IndexedDB:

```javascript
// db.js - version 5
db.version(5).stores({
  categories: '++id, name, type, icon, color',
  transactions: '++id, type, category_id, category_name, amount, payment_source, note, transaction_date, created_at',
  users: '++id, &username, passwordHash, pin, fullName, role, phone, email, created_at',
  store_profile: '++id, owner_username'   // one profile per owner
});
```

Cấu trúc dữ liệu `store_profile`:

```javascript
{
  id: 1,
  owner_username: 'admin',

  // Nhóm 1: Thông tin cơ bản
  storeName: 'Quán Nước Ép Minh',
  storeSlogan: 'Nước ép tươi nguyên chất mỗi ngày',
  storeLogo: null,            // base64 encoded image hoặc null
  storeAddress: '123 Nguyễn Huệ, Q1, TP.HCM',
  storePhone: '0901234567',

  // Nhóm 2: Cột mốc
  businessStartDate: '2024-06-15',      // ngày mở quán (user nhập)
  appStartDate: '2025-01-10',           // tự động ghi nhận

  // Nhóm 3: Cài đặt
  currency: 'VND',
  monthlyRevenueGoal: 50000000,         // mục tiêu doanh thu tháng
  financialMonthStartDay: 1,            // ngày bắt đầu tháng tài chính
  storeNotes: '',                       // ghi chú tự do

  updated_at: '2025-08-04T22:50:00Z'
}
```

---

## Thiết Kế UI

### Trang "Hồ Sơ Cửa Hàng" — truy cập từ Drawer menu

```
┌─────────────────────────────────────┐
│  🏪  Hồ Sơ Cửa Hàng                │
├─────────────────────────────────────┤
│                                     │
│  ┌───────┐                          │
│  │ LOGO  │  Quán Nước Ép Minh       │
│  │  📷   │  "Nước ép tươi mỗi ngày" │
│  └───────┘  📍 123 Nguyễn Huệ, Q1   │
│                                     │
├── Thống Kê Hành Trình ──────────────┤
│                                     │
│  📅 Mở quán: 15/06/2024             │
│  📱 Dùng app: 10/01/2025 (207 ngày) │
│  📊 Tổng giao dịch: 1,234           │
│  🔥 Streak ghi sổ: 15 ngày          │
│                                     │
├── Mục Tiêu Tháng ───────────────────┤
│                                     │
│  Doanh thu: 35tr / 50tr (70%)       │
│  ████████████░░░░░░                 │
│                                     │
├── Ghi Chú ──────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Nhớ đổi nhà cung cấp...    │    │
│  └─────────────────────────────┘    │
│                                     │
│  [ ✏️ Chỉnh Sửa Hồ Sơ ]            │
└─────────────────────────────────────┘
```

### Header sau khi có Store Profile

```
Trước:  🍊 JuiceLedger          [Ghi Thu/Chi] [SMS Bank] admin ✏️
Sau:    🏪 Quán Nước Ép Minh    [Ghi Thu/Chi] [SMS Bank] Minh ✏️
```

---

## Kế Hoạch Triển Khai

### Pha 1 — Core (ưu tiên cao) ⚡
1. Tạo bảng `store_profile` trong IndexedDB (version 5)
2. Tạo service `storeProfileService.js`
3. Tạo trang `StoreProfilePage.jsx` (thay thế 1 tab hoặc thêm từ Drawer)
4. Tích hợp: tên cửa hàng hiển thị trên Header
5. Lưu ngày bắt đầu kinh doanh + ngày dùng app

### Pha 2 — Enrichment (nâng cao)
6. Upload logo cửa hàng (lưu base64 trong IndexedDB)
7. Mục tiêu doanh thu + progress bar trên Dashboard
8. Streak ghi sổ liên tiếp
9. Ghi chú cửa hàng

### Pha 3 — Polish
10. Tổng số giao dịch all-time trên Dashboard
11. Tháng doanh thu cao nhất
12. Đơn vị tiền tệ tùy chỉnh
13. Ngày bắt đầu tháng tài chính tùy chỉnh

---

> [!IMPORTANT]
> Hãy cho tôi biết bạn muốn triển khai những tính năng nào, hoặc muốn thêm/bớt gì trước khi tôi bắt đầu code!
