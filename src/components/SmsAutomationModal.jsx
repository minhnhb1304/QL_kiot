import React, { useState } from 'react';
import { X, Copy, Play } from 'lucide-react';

export default function SmsAutomationModal({ isOpen, onClose, onSmsProcessed }) {
  const [sender, setSender] = useState('SACOMBANK');
  const [smsText, setSmsText] = useState('STK 060012345678 +45,000VND. ND: KH CHUYEN TIEN NUOC EP');
  const [messageResult, setMessageResult] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const webhookUrl = window.location.origin + '/api/webhook/sms';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestSms = async (e) => {
    e.preventDefault();
    setMessageResult(null);
    try {
      const result = await onSmsProcessed(smsText, sender);
      setMessageResult({
        success: true,
        text: `Đã bóc tách: +${new Intl.NumberFormat('vi-VN').format(result.parsedAmount)}đ (Đã lưu vào Sổ)`
      });
    } catch (err) {
      setMessageResult({
        success: false,
        text: `Lỗi: ${err.message}`
      });
    }
  };

  const loadPresetSms = (presetSender, presetText) => {
    setSender(presetSender);
    setSmsText(presetText);
    setMessageResult(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content sms-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tự Động Hóa SMS Bank</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-form">
          {/* Webhook Endpoint Box */}
          <div className="form-group">
            <label className="form-label">Đường Dẫn Webhook Endpoint:</label>
            <div className="webhook-copy-box">
              <input type="text" className="form-input" value={webhookUrl} readOnly />
              <button type="button" className="btn-secondary" onClick={handleCopyUrl}>
                <Copy size={16} />
                <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>
            <p className="form-help-text" style={{ marginTop: '8px', fontSize: '0.85rem', color: '#64748b' }}>
              Dùng URL này cài đặt vào ứng dụng tự động chuyển tiếp SMS (SMS Forwarder/Auto Forward SMS).
            </p>
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <a 
                href="https://apps.apple.com/us/app/sms-forwarder-forward-sms/id6693285061" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '0.85rem' }}
              >
                <span>📱 Tải ứng dụng trên App Store</span>
              </a>
              <a 
                href="https://play.google.com/store/apps/details?id=com.bogdad.smsforwarder" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '0.85rem' }}
              >
                <span>🤖 Tải ứng dụng trên Google Play</span>
              </a>
            </div>

            {/* Instruction Box */}
            <div className="sms-notice-box">
              <strong>📌 Lưu ý quan trọng khi cài đặt trên điện thoại:</strong>
              <ul>
                <li><strong>Cấp quyền tin nhắn:</strong> Cho phép app quyền <i>Read SMS / Notification Access</i>.</li>
                <li><strong>Tắt Tối ưu hóa pin (Battery Optimization):</strong> Vào <i>Cài đặt điện thoại &gt; Ứng dụng &gt; SMS Forwarder &gt; Pin &gt; Chọn "Không hạn chế" (Unrestricted)</i> để app không bị hệ thống tắt khi chạy ngầm.</li>
                <li><strong>Cấu hình Webhook:</strong> Chọn Phương thức HTTP là <code>POST</code>, định dạng JSON payload, và dán <b>URL Webhook</b> ở trên vào mục Target URL.</li>
                <li><strong>Bộ lọc Sender (Khuyên dùng):</strong> Cài đặt lọc chỉ chuyển tiếp SMS có tên từ ngân hàng (ví dụ: <code>VCB</code>, <code>MBBANK</code>, <code>SACOMBANK</code>) để tránh gửi nhầm tin nhắn rác/riêng tư.</li>
              </ul>
            </div>
          </div>

          {/* Live Simulator Form */}
          <div className="simulator-section card">
            <div className="sim-title">
              <strong>Thử Nghiệm Giả Lập SMS Bank:</strong>
            </div>

            {/* Presets */}
            <div className="preset-buttons">
              <span className="preset-label">Mẫu tin nhắn:</span>
              <button 
                type="button" 
                className="chip-btn"
                onClick={() => loadPresetSms('SACOMBANK', 'STK 060012345 +50,000VND. ND: KH CHUYEN TIEN')}
              >
                Sacombank +50k
              </button>
              <button 
                type="button" 
                className="chip-btn"
                onClick={() => loadPresetSms('MBBANK', 'TK 0987654321 +35,000VND. ND: MB QR')}
              >
                MB Bank +35k
              </button>
              <button 
                type="button" 
                className="chip-btn"
                onClick={() => loadPresetSms('VCB', 'SD TK 007100 +100,000VND. Ref: VCB123')}
              >
                Vietcombank +100k
              </button>
            </div>

            <form onSubmit={handleTestSms} className="sim-form">
              <div className="form-group">
                <label className="form-label">Tên Ngân Hàng (Sender)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={sender} 
                  onChange={e => setSender(e.target.value)}
                  placeholder="SACOMBANK / MBBANK / VCB"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nội Dung SMS Báo Có</label>
                <textarea 
                  className="form-textarea" 
                  rows="3"
                  value={smsText}
                  onChange={e => setSmsText(e.target.value)}
                  placeholder="Nhập nội dung tin nhắn SMS..."
                  required
                />
              </div>

              {messageResult && (
                <div className={`sim-result ${messageResult.success ? 'result-success' : 'result-error'}`}>
                  {messageResult.text}
                </div>
              )}

              <button type="submit" className="btn-primary w-full">
                <Play size={16} />
                <span>Bóc Tách SMS & Lưu</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
