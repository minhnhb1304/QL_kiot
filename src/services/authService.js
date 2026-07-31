import { db, seedInitialData } from './db';

const SESSION_KEY = 'jl_auth_session';
const PIN_KEY = 'jl_user_pin';

export const authService = {
  // Ensure DB is initialized before auth actions
  async init() {
    try {
      await seedInitialData();
    } catch (err) {
      console.error('Error initializing auth db:', err);
    }
  },

  // Check if active valid session exists
  getSession() {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) return null;
      const session = JSON.parse(saved);
      return session;
    } catch {
      return null;
    }
  },

  // Register a new user account
  async registerUser({ username, fullName, password, confirmPassword, role = 'OWNER', phone = '', email = '' }) {
    await this.init();

    // 1. Validation checks
    const cleanUsername = (username || '').trim().toLowerCase();
    const cleanFullName = (fullName || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim();

    if (!cleanUsername) {
      throw new Error('Vui lòng nhập tên đăng nhập');
    }

    if (cleanUsername.length < 3) {
      throw new Error('Tên đăng nhập phải có ít nhất 3 ký tự');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      throw new Error('Tên đăng nhập chỉ chứa chữ cái, chữ số và dấu gạch dưới (_)');
    }

    if (!cleanFullName) {
      throw new Error('Vui lòng nhập họ và tên');
    }

    if (cleanFullName.length < 2) {
      throw new Error('Họ và tên quá ngắn');
    }

    if (!password || password.length < 6) {
      throw new Error('Mật khẩu phải chứa ít nhất 6 ký tự');
    }

    if (password !== confirmPassword) {
      throw new Error('Mật khẩu xác nhận không trùng khớp');
    }

    if (cleanPhone && !/^[0-9]{9,11}$/.test(cleanPhone)) {
      throw new Error('Số điện thoại không hợp lệ (gồm 9 - 11 chữ số)');
    }

    // 2. Check if username already exists in DB
    const existingUser = await db.users.where('username').equalsIgnoreCase(cleanUsername).first();
    if (existingUser) {
      throw new Error(`Tên đăng nhập "${cleanUsername}" đã được sử dụng`);
    }

    // 3. Create user object
    const newUser = {
      username: cleanUsername,
      fullName: cleanFullName,
      password: password,
      role: role || 'OWNER',
      phone: cleanPhone,
      email: cleanEmail,
      created_at: new Date().toISOString()
    };

    // 4. Save to IndexedDB
    await db.users.add(newUser);

    // 5. Create session object
    const session = {
      user: {
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
        phone: newUser.phone,
        email: newUser.email
      },
      token: 'token_' + Date.now()
    };

    // Save session automatically
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    return session;
  },

  // Log in with Username / Password
  async loginWithPassword(username, password, rememberMe = true) {
    await this.init();

    const cleanUsername = (username || '').trim().toLowerCase();

    // Search in IndexedDB users table first
    const dbUser = await db.users.where('username').equalsIgnoreCase(cleanUsername).first();
    if (dbUser && dbUser.password === password) {
      const session = {
        user: {
          username: dbUser.username,
          fullName: dbUser.fullName,
          role: dbUser.role,
          phone: dbUser.phone || '',
          email: dbUser.email || ''
        },
        token: 'token_' + Date.now()
      };
      if (rememberMe) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return session;
    }

    // Fallback default Owner account: admin / 123456
    if ((cleanUsername === 'admin' || cleanUsername === 'quan') && password === '123456') {
      const session = {
        user: {
          username: cleanUsername,
          fullName: cleanUsername === 'quan' ? 'Quản Lý Cửa Hàng' : 'Chủ Quán Nước Ép',
          role: 'OWNER'
        },
        token: 'token_' + Date.now()
      };
      if (rememberMe) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return session;
    }

    // Fallback demo staff account: nhanvien / 123456
    if (cleanUsername === 'nhanvien' && password === '123456') {
      const session = {
        user: {
          username: cleanUsername,
          fullName: 'Nhân Viên Thu Ngân',
          role: 'STAFF'
        },
        token: 'token_' + Date.now()
      };
      if (rememberMe) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return session;
    }

    throw new Error('Tài khoản hoặc mật khẩu không chính xác');
  },

  // Log in with Quick PIN (Default PIN is '1234' or custom set)
  async loginWithPin(pinCode) {
    const customPin = localStorage.getItem(PIN_KEY) || '1234';
    if (pinCode === customPin) {
      const session = {
        user: {
          username: 'quan_pin',
          fullName: 'Chủ Quán Nước Ép',
          role: 'OWNER'
        },
        token: 'pin_token_' + Date.now()
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }
    throw new Error('Mã PIN không đúng (Mặc định: 1234)');
  },

  // Save custom PIN
  setCustomPin(newPin) {
    if (!newPin || newPin.length < 4) {
      throw new Error('Mã PIN phải gồm ít nhất 4 chữ số');
    }
    localStorage.setItem(PIN_KEY, newPin);
    return true;
  },

  // Get current PIN
  getCustomPin() {
    return localStorage.getItem(PIN_KEY) || '1234';
  },

  // Logout
  logout() {
    localStorage.removeItem(SESSION_KEY);
  }
};

