import { db, seedInitialData, hashPassword } from './db';

const SESSION_KEY = 'jl_auth_session';

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

  // Get all registered users for account selection in login UI
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
      passwordHash: await hashPassword(password),
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
    if (dbUser) {
      const inputHash = await hashPassword(password);
      if (dbUser.passwordHash === inputHash) {
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
    }

    throw new Error('Tài khoản hoặc mật khẩu không chính xác');
  },

  // Update user profile (fullName, phone, email)
  async updateUserProfile({ username, fullName, phone, email }) {
    const cleanFullName = (fullName || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanEmail = (email || '').trim();

    if (!cleanFullName) {
      throw new Error('Vui lòng nhập họ và tên');
    }
    if (cleanFullName.length < 2) {
      throw new Error('Họ và tên quá ngắn');
    }
    if (cleanPhone && !/^[0-9]{9,11}$/.test(cleanPhone)) {
      throw new Error('Số điện thoại không hợp lệ (gồm 9 - 11 chữ số)');
    }

    // Update in IndexedDB
    const dbUser = await db.users.where('username').equalsIgnoreCase(username).first();
    if (!dbUser) {
      throw new Error('Không tìm thấy tài khoản');
    }

    await db.users.update(dbUser.id, {
      fullName: cleanFullName,
      phone: cleanPhone,
      email: cleanEmail
    });

    // Update session in localStorage
    const updatedUser = {
      username: dbUser.username,
      fullName: cleanFullName,
      role: dbUser.role,
      phone: cleanPhone,
      email: cleanEmail
    };

    const currentSession = this.getSession();
    if (currentSession) {
      currentSession.user = updatedUser;
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
    }

    return currentSession;
  },

  // Logout
  logout() {
    localStorage.removeItem(SESSION_KEY);
  }
};

