import { db, seedInitialData, hashPassword } from './db.js';
import {
  apiFetch, ApiError, readStoredSession, writeStoredSession, clearStoredSession, getToken
} from './apiClient.js';

// Xác thực giờ nằm ở máy chủ (D1: bảng users + sessions). Dexie chỉ còn giữ một
// bản sao của người dùng để đăng nhập được khi mất mạng.
//
// Bề mặt hàm giữ nguyên hệt bản cũ — App.jsx và LoginPage.jsx không phải sửa gì:
//   getSession()      vẫn đồng bộ, vẫn đọc localStorage
//   loginWithPassword / registerUser  vẫn trả { user, token }
//   logout()          vẫn đồng bộ
//   updateUserProfile vẫn trả session đã cập nhật

// Giữ bản sao cục bộ của tài khoản để lần sau mất mạng vẫn đăng nhập được.
// passwordHash là SHA-256 như lược đồ Dexie xưa nay — đây chỉ là chốt chặn
// ngoại tuyến, còn nguồn sự thật là PBKDF2 trên máy chủ.
async function mirrorUserLocally(user, password) {
  try {
    const passwordHash = await hashPassword(password);
    const existing = await db.users.where('username').equalsIgnoreCase(user.username).first();
    const row = {
      username: user.username,
      passwordHash,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone || '',
      email: user.email || '',
      created_at: existing?.created_at || new Date().toISOString()
    };
    if (existing) {
      await db.users.update(existing.id, row);
    } else {
      await db.users.add(row);
    }
  } catch (err) {
    console.warn('Không lưu được bản sao tài khoản cục bộ:', err);
  }
}

function persist(session, rememberMe = true) {
  if (rememberMe) writeStoredSession(session);
  return session;
}

export const authService = {
  async init() {
    try {
      await seedInitialData();
    } catch (err) {
      console.error('Error initializing auth db:', err);
    }
  },

  getSession() {
    return readStoredSession();
  },

  getToken,

  // Phiên còn sống không? Dùng để phát hiện token hết hạn sau nhiều ngày không mở app.
  // Mất mạng trả về true: không có bằng chứng phiên hỏng thì đừng đá người dùng ra.
  async validateSession() {
    if (!getToken()) return false;
    try {
      const { user } = await apiFetch('/api/auth/me');
      const session = readStoredSession();
      if (session) persist({ ...session, user });
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'unauthorized') {
        clearStoredSession();
        return false;
      }
      return true;
    }
  },

  async getUsers() {
    await this.init();
    try {
      const users = await db.users.toArray();
      return users.map(u => ({
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        phone: u.phone || '',
        email: u.email || ''
      }));
    } catch {
      return [];
    }
  },

  async registerUser({ username, fullName, password, confirmPassword, role = 'OWNER', phone = '', email = '' }) {
    await this.init();

    // Kiểm tra tại chỗ để báo lỗi ngay mà không tốn một vòng mạng. Máy chủ vẫn
    // kiểm tra lại đúng những luật này — đây chỉ là cho nhanh, không phải cho chắc.
    if (password !== confirmPassword) throw new Error('Mật khẩu xác nhận không trùng khớp');

    const { token, user } = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { username, fullName, password, confirmPassword, role, phone, email }
    });

    await mirrorUserLocally(user, password);
    return persist({ user, token });
  },

  async loginWithPassword(username, password, rememberMe = true) {
    await this.init();
    const cleanUsername = (username || '').trim().toLowerCase();

    try {
      const { token, user } = await apiFetch('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { username: cleanUsername, password }
      });
      await mirrorUserLocally(user, password);
      return persist({ user, token }, rememberMe);

    } catch (err) {
      if (!(err instanceof ApiError)) throw err;

      // Mất mạng: quán vẫn phải ghi sổ được. Xác minh bằng bản sao cục bộ và
      // đánh dấu phiên là ngoại tuyến để syncService biết chưa có token thật.
      if (err.kind === 'offline') {
        const session = await this.loginOffline(cleanUsername, password);
        if (session) return persist(session, rememberMe);
        throw new Error('Không kết nối được máy chủ và máy này chưa từng đăng nhập tài khoản đó');
      }

      // Máy chủ chưa biết tài khoản này, nhưng máy này thì có. Đây là các tài
      // khoản có từ trước khi có đăng nhập máy chủ (admin/quan/nhanvien và tài
      // khoản chủ quán tự đăng ký hồi còn cục bộ). Chuyển nó lên máy chủ bằng
      // chính mật khẩu vừa gõ — người dùng không thấy bước nào khác thường.
      if (err.code === 'user_not_found') {
        const migrated = await this.migrateLocalAccount(cleanUsername, password);
        if (migrated) return persist(migrated, rememberMe);
      }

      throw new Error(err.message);
    }
  },

  // Xác minh bằng Dexie. Chỉ dùng khi không gọi được máy chủ.
  async loginOffline(username, password) {
    const dbUser = await db.users.where('username').equalsIgnoreCase(username).first();
    if (!dbUser) return null;
    if (dbUser.passwordHash !== await hashPassword(password)) return null;

    const previous = readStoredSession();
    return {
      user: {
        username: dbUser.username,
        fullName: dbUser.fullName,
        role: dbUser.role,
        phone: dbUser.phone || '',
        email: dbUser.email || ''
      },
      // Giữ token cũ nếu còn: nó có thể vẫn hợp lệ, và đồng bộ sẽ chạy lại được
      // ngay khi có mạng mà không bắt đăng nhập lại.
      token: previous?.user?.username === dbUser.username ? previous.token : null,
      offline: true
    };
  },

  // Đưa một tài khoản chỉ-có-ở-Dexie lên máy chủ. Trả null nếu không đủ điều kiện.
  async migrateLocalAccount(username, password) {
    const dbUser = await db.users.where('username').equalsIgnoreCase(username).first();
    if (!dbUser) return null;
    if (dbUser.passwordHash !== await hashPassword(password)) return null;

    try {
      const { token, user } = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: {
          username: dbUser.username,
          fullName: dbUser.fullName || dbUser.username,
          password,
          role: dbUser.role || 'OWNER',
          phone: dbUser.phone || '',
          email: dbUser.email || ''
        }
      });
      await mirrorUserLocally(user, password);
      return { user, token };
    } catch (err) {
      // registration_closed: quán đã có chủ trên máy chủ, và tài khoản cục bộ
      // này không phải một trong số đó. Đúng là nên từ chối — nếu không thì bất
      // kỳ ai cài app rồi tự đăng ký cục bộ cũng vào được sổ của quán.
      console.warn('Không chuyển được tài khoản cục bộ lên máy chủ:', err.message);
      return null;
    }
  },

  async updateUserProfile({ username, fullName, phone, email }) {
    const cleanFullName = (fullName || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim();

    if (!cleanFullName) throw new Error('Vui lòng nhập họ và tên');
    if (cleanFullName.length < 2) throw new Error('Họ và tên quá ngắn');
    if (cleanPhone && !/^[0-9]{9,11}$/.test(cleanPhone)) {
      throw new Error('Số điện thoại không hợp lệ (gồm 9 - 11 chữ số)');
    }

    let updatedUser = null;
    try {
      const result = await apiFetch('/api/auth/me', {
        method: 'PATCH',
        body: { fullName: cleanFullName, phone: cleanPhone, email: cleanEmail }
      });
      updatedUser = result.user;
    } catch (err) {
      if (!(err instanceof ApiError) || err.kind !== 'offline') throw new Error(err.message);
      // Ngoại tuyến: sửa cục bộ để người dùng thấy ngay. Lần đăng nhập sau máy
      // chủ sẽ ghi đè — hồ sơ tài khoản không nằm trong vòng đồng bộ.
      updatedUser = null;
    }

    const dbUser = await db.users.where('username').equalsIgnoreCase(username).first();
    if (dbUser) {
      await db.users.update(dbUser.id, {
        fullName: cleanFullName, phone: cleanPhone, email: cleanEmail
      });
    }

    const session = readStoredSession();
    if (session) {
      session.user = updatedUser || {
        ...session.user,
        fullName: cleanFullName,
        phone: cleanPhone,
        email: cleanEmail
      };
      writeStoredSession(session);
    }
    return session;
  },

  logout() {
    // Xoá phiên cục bộ trước và không chờ mạng: đăng xuất phải luôn thành công
    // ngay lập tức. Máy chủ dọn dòng sessions khi nào tới được thì tới.
    const token = getToken();
    clearStoredSession();
    if (token) {
      // Gửi token thủ công: phiên cục bộ vừa bị xoá nên apiFetch không còn
      // chỗ nào để đọc ra nó nữa.
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }
  }
};
