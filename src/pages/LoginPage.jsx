import React, { useState } from 'react';
import { Citrus, KeyRound, Lock, User } from 'lucide-react';
import { authService } from '../services/authService';

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('pin'); // 'pin' or 'password'
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

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
      <div className="login-card card">
        {/* Brand Header */}
        <div className="login-brand">
          <div className="brand-icon-lg">
            <Citrus size={36} color="#FFFFFF" />
          </div>
          <h2>JuiceLedger</h2>
        </div>

        {/* Mode Selector Tabs */}
        <div className="login-mode-tabs">
          <button
            className={`mode-tab ${mode === 'pin' ? 'active' : ''}`}
            onClick={() => { setMode('pin'); setErrorMsg(''); }}
          >
            <KeyRound size={16} />
            <span>Mã PIN</span>
          </button>
          <button
            className={`mode-tab ${mode === 'password' ? 'active' : ''}`}
            onClick={() => { setMode('password'); setErrorMsg(''); }}
          >
            <Lock size={16} />
            <span>Mật Khẩu</span>
          </button>
        </div>

        {errorMsg && (
          <div className="login-error-alert">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* MODE 1: Quick PIN Login */}
        {mode === 'pin' ? (
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
        ) : (
          /* MODE 2: Password Login */
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
                  type="password"
                  className="form-input icon-input"
                  placeholder="123456"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
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
          </form>
        )}
      </div>
    </div>
  );
}
