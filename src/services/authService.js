// Authentication Service for JuiceLedger
// Manages persistent login sessions, quick PIN login, and default shop owner account

const SESSION_KEY = 'jl_auth_session';
const PIN_KEY = 'jl_user_pin';

export const authService = {
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

  // Log in with Username / Password
  async loginWithPassword(username, password, rememberMe = true) {
    // Default Owner account: admin / 123456
    if ((username === 'admin' || username === 'quan') && password === '123456') {
      const session = {
        user: {
          username: username,
          fullName: 'Chủ Quán Nước Ép',
          role: 'OWNER'
        },
        token: 'token_' + Date.now()
      };
      if (rememberMe) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      return session;
    }

    // Demo staff account: nhanvien / 123456
    if (username === 'nhanvien' && password === '123456') {
      const session = {
        user: {
          username: username,
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
