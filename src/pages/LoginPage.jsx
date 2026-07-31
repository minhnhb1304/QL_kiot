import React, { useState } from 'react';
import {
  Citrus, KeyRound, Lock, User, AtSign, Phone, Mail,
  Eye, EyeOff, UserPlus, Crown, UserCheck, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { authService } from '../services/authService';

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('pin'); // 'pin' | 'password' | 'register'
  const [pin, setPin] = useState('');
  
  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState('OWNER'); // 'OWNER' | 'STAFF'
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const session = await authService.loginWithPin(pin);
      onLoginSuccess(session);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const session = await authService.loginWithPassword(username, password, rememberMe);
      onLoginSuccess(session);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      const session = await authService.registerUser({
        username: regUsername,
        fullName: regFullName,
        password: regPassword,
        confirmPassword: regConfirmPassword,
        role: regRole,
        phone: regPhone,
        email: regEmail
      });
      setSuccessMsg('Đăng ký tài khoản thành công! Đang tự động đăng nhập...');
      setTimeout(() => {
        onLoginSuccess(session);
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinDigit = (digit) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        authService.loginWithPin(nextPin)
          .then(session => onLoginSuccess(session))
          .catch(err => setErrorMsg(err.message));
      }
    }
  };

  const handlePinBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="login-overlay">
      <div className={`login-card card ${mode === 'register' ? 'register-mode' : ''}`}>
        {/* Brand Header */}
        <div className="login-brand">
          <div className="brand-icon-lg">
            <Citrus size={36} color="#FFFFFF" />
          </div>
          <h2>JuiceLedger</h2>
          <p className="login-subtext">Quản Lý Sổ Thu Chi Quán Nước Ép & Sinh Tố</p>
        </div>

        {/* Mode Selector Tabs (3 Modes: PIN, Login, Register) */}
        <div className="login-mode-tabs trio-tabs">
          <button
            type="button"
            className={`mode-tab ${mode === 'pin' ? 'active' : ''}`}
            onClick={() => switchMode('pin')}
          >
            <KeyRound size={15} />
            <span>Mã PIN</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'password' ? 'active' : ''}`}
            onClick={() => switchMode('password')}
          >
            <Lock size={15} />
            <span>Đăng Nhập</span>
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            <UserPlus size={15} />
            <span>Đăng Ký</span>
          </button>
        </div>

        {errorMsg && (
          <div className="login-error-alert">
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="login-success-alert">
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE 1: Quick PIN Login */}
        {mode === 'pin' && (
          <form onSubmit={handlePinSubmit} className="login-form">
            <div className="pin-display-group">
              <span className="pin-label">Nhập PIN (Mặc định: 1234)</span>
              <div className="pin-dots">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : ''}`} />
                ))}
              </div>
            </div>

            {/* Numeric Keypad for Mobile/Touch */}
            <div className="keypad-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  className="keypad-btn"
                  onClick={() => handlePinDigit(num.toString())}
                >
                  {num}
                </button>
              ))}
              <button type="button" className="keypad-btn btn-clear" onClick={() => setPin('')}>
                Xóa
              </button>
              <button
                type="button"
                className="keypad-btn"
                onClick={() => handlePinDigit('0')}
              >
                0
              </button>
              <button type="button" className="keypad-btn btn-back" onClick={handlePinBackspace}>
                ⌫
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: Password Login */}
        {mode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Tên Đăng Nhập</label>
              <div className="input-icon-wrapper">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  className="form-input icon-input"
                  placeholder="admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mật Khẩu</label>
              <div className="input-icon-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input icon-input icon-input-right"
                  placeholder="••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="remember-checkbox">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>Duy trì đăng nhập trên thiết bị này</span>
              </label>
            </div>

            <button type="submit" className="btn-primary w-full">
              Đăng Nhập
            </button>

            <div className="register-footer-hint">
              <span>Chưa có tài khoản? </span>
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode('register')}
              >
                Đăng ký ngay
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: User Registration */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="login-form register-form-animated">
            <div className="form-group">
              <label className="form-label">Họ và Tên <span className="req-star">*</span></label>
              <div className="input-icon-wrapper">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  className="form-input icon-input"
                  placeholder="Ví dụ: Nguyễn Văn Quán"
                  value={regFullName}
                  onChange={e => setRegFullName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tên Đăng Nhập <span className="req-star">*</span></label>
              <div className="input-icon-wrapper">
                <AtSign size={18} className="input-icon" />
                <input
                  type="text"
                  className="form-input icon-input"
                  placeholder="Ví dụ: quanly_juice"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  required
                />
              </div>
              <span className="field-hint">Chữ cái, chữ số, dấu gạch dưới (_). Ít nhất 3 ký tự.</span>
            </div>

            {/* Role Selection Cards */}
            <div className="form-group">
              <label className="form-label">Vai Trò Tài Khoản</label>
              <div className="role-selector-grid">
                <div
                  className={`role-option-card ${regRole === 'OWNER' ? 'selected' : ''}`}
                  onClick={() => setRegRole('OWNER')}
                >
                  <div className="role-card-header">
                    <Crown size={18} className="role-icon owner-color" />
                    <span className="role-title">Chủ Quán</span>
                  </div>
                  <p className="role-desc">Toàn quyền quản lý doanh thu, chi phí & cài đặt</p>
                </div>

                <div
                  className={`role-option-card ${regRole === 'STAFF' ? 'selected' : ''}`}
                  onClick={() => setRegRole('STAFF')}
                >
                  <div className="role-card-header">
                    <UserCheck size={18} className="role-icon staff-color" />
                    <span className="role-title">Nhân Viên</span>
                  </div>
                  <p className="role-desc">Ghi nhận thu tiền mặt, QR code & nhập chi phí hàng ngày</p>
                </div>
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Mật Khẩu <span className="req-star">*</span></label>
                <div className="input-icon-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input icon-input icon-input-right"
                    placeholder="Ít nhất 6 ký tự"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Xác Nhận Mật Khẩu <span className="req-star">*</span></label>
                <div className="input-icon-wrapper">
                  <ShieldCheck size={18} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input icon-input"
                    placeholder="Nhập lại mật khẩu"
                    value={regConfirmPassword}
                    onChange={e => setRegConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Số Điện Thoại (Tùy chọn)</label>
                <div className="input-icon-wrapper">
                  <Phone size={18} className="input-icon" />
                  <input
                    type="tel"
                    className="form-input icon-input"
                    placeholder="0901234567"
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email (Tùy chọn)</label>
                <div className="input-icon-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    className="form-input icon-input"
                    placeholder="user@example.com"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full register-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span>Đang khởi tạo tài khoản...</span>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Tạo Tài Khoản Mới</span>
                </>
              )}
            </button>

            <div className="register-footer-hint">
              <span>Đã có tài khoản? </span>
              <button
                type="button"
                className="link-btn"
                onClick={() => switchMode('password')}
              >
                Đăng nhập tại đây
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

