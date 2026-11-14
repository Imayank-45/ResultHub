import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getHeadlessMode, setHeadlessMode } from '../utils/scraperSettings';
import CustomSelect from '../components/CustomSelect';

export default function ProfilePage({ onBackToDashboard }) {
  const { user, updateProfile, changePassword, authFetch, logout, logoutAll, resendVerification } = useAuth();
  const { success, error: toastError, info } = useToast();
  const fileInputRef = useRef(null);

  const handleLogoutAllClick = async () => {
    if (window.confirm("Are you sure you want to log out from all devices? All active sessions across all browsers will be terminated.")) {
      await logoutAll();
      success("Logged out from all devices successfully.");
    }
  };

  const handleResendEmailVerification = async () => {
    if (user?.email) {
      const res = await resendVerification(user.email);
      if (res.success) {
        info("A verification code has been sent to your email address.");
      } else {
        toastError(res.error || "Failed to send verification code.");
      }
    }
  };


  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileImage, setProfileImage] = useState(user?.profile_image || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Image Upload & URL Modal/Toggle State
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Handle custom image file upload & compression via Canvas
  const handleImageFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file (.png, .jpg, .jpeg, .webp)');
      return;
    }

    setProfileError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setProfileImage(compressedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (imageUrlInput.trim()) {
      setProfileImage(imageUrlInput.trim());
      setShowUrlInput(false);
      setImageUrlInput('');
    }
  };

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [passError, setPassError] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  // Login History State
  const [loginHistory, setLoginHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Settings & Preferences State (Persisted in localStorage)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('resultai_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      autoSaveExport: true,
      soundAlerts: true,
      defaultFormat: 'xlsx',
      concurrencyMode: 'balanced',
      themeMode: localStorage.getItem('theme') || 'dark',
      sessionTimeout: '60'
    };
  });

  const [settingsMsg, setSettingsMsg] = useState('');
  const [headlessMode, setHeadlessModeState] = useState(getHeadlessMode);

  // Synchronize state when user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setProfileImage(user.profile_image || '');
    }
  }, [user]);

  // Fetch Login History
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await authFetch(`${API_BASE}/auth/me`);
        if (res.ok) {
          const data = await res.json();
          setLoginHistory(data.recent_login_history || []);
        }
      } catch (err) {
        console.error("Failed to fetch login history:", err);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [authFetch]);

  const handleDeleteHistoryItem = async (historyId) => {
    try {
      const res = await authFetch(`${API_BASE}/auth/login-history/${historyId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setLoginHistory(prev => prev.filter(h => h.id !== historyId));
      }
    } catch (err) {
      console.error("Failed to delete login history item:", err);
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all login history audit records?")) return;
    try {
      const res = await authFetch(`${API_BASE}/auth/login-history`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setLoginHistory([]);
      }
    } catch (err) {
      console.error("Failed to clear login history:", err);
    }
  };

  // Preset Avatar Options
  const presetAvatars = [
    "🤖", "👨‍💻", "👩‍💻", "🎓", "🚀", "⚡", "🔬", "💻"
  ];

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileError('');
    setProfileLoading(true);

    const res = await updateProfile({
      name,
      phone,
      profile_image: profileImage
    });

    if (res.success) {
      const msg = "Profile updated successfully!";
      setProfileMsg(msg);
      success(msg);
    } else {
      const errMsg = res.error || "Failed to update profile.";
      setProfileError(errMsg);
      toastError(errMsg);
    }
    setProfileLoading(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPassMsg('');
    setPassError('');

    if (newPassword !== confirmPassword) {
      const errMsg = "New password and confirmation do not match.";
      setPassError(errMsg);
      toastError(errMsg);
      return;
    }

    setPassLoading(true);
    const res = await changePassword({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    });

    if (res.success) {
      const msg = res.message || "Password changed successfully!";
      setPassMsg(msg);
      success(msg);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      const errMsg = res.error || "Failed to change password.";
      setPassError(errMsg);
      toastError(errMsg);
    }
    setPassLoading(false);
  };

  const handleSettingChange = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    localStorage.setItem('resultai_settings', JSON.stringify(updated));

    if (key === 'themeMode') {
      if (value === 'light') {
        document.body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
      } else {
        document.body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
      }
    }

    setSettingsMsg("Preferences saved automatically!");
    info("App settings updated.");
    setTimeout(() => setSettingsMsg(''), 3000);
  };

  const handleHeadlessModeChange = (enabled) => {
    setHeadlessModeState(enabled);
    setHeadlessMode(enabled);
    setSettingsMsg("Preferences saved automatically!");
    setTimeout(() => setSettingsMsg(''), 3000);
  };

  const handleClearCache = () => {
    if (window.confirm("Are you sure you want to clear local cache & reset app preferences?")) {
      localStorage.removeItem('resultai_settings');
      localStorage.removeItem('resultai_recent_searches');
      window.location.reload();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-container"
      style={{ padding: '0 0 40px 0', gap: '24px' }}
    >
      {/* HEADER SECTION */}
      <div className="table-section-header profile-header-row">
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '850', background: 'linear-gradient(135deg, var(--title-color), #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Account & System Settings
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Manage personal credentials, application preferences, security options, and view audit logs.
          </p>
        </div>

        <button 
          className="btn btn-secondary profile-back-btn"
          onClick={onBackToDashboard}
          style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* 2-COLUMN MAIN GRID */}
      <div className="two-column-responsive-grid">
        
        {/* LEFT COLUMN: PERSONAL DETAILS & AVATAR */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>👤</span>
            <h3 style={{ fontSize: '17px', fontWeight: '800' }}>Personal Information</h3>
          </div>

          {/* Hidden File Input for Image Upload */}
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            style={{ display: 'none' }} 
            onChange={handleImageFileSelect} 
          />

          {/* Avatar Preview & Photo Action Buttons */}
          <div className="profile-avatar-row" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div 
              onClick={() => fileInputRef.current.click()}
              title="Click to Upload Profile Photo"
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '24px',
                background: 'var(--primary-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: profileImage && profileImage.length <= 4 ? '40px' : '32px',
                color: '#FFFFFF',
                boxShadow: '0 8px 25px rgba(124, 58, 237, 0.35)',
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
                border: '2px solid var(--primary)'
              }}
            >
              {profileImage && (profileImage.startsWith('http') || profileImage.startsWith('data:image')) ? (
                <img src={profileImage} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : profileImage || user?.name?.[0]?.toUpperCase() || 'A'}

              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.55)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s ease',
                color: '#FFFFFF'
              }}
              className="avatar-hover-overlay"
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
              >
                <span style={{ fontSize: '18px' }}>📷</span>
                <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase' }}>Upload</span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: '180px' }}>
              <p style={{ fontWeight: '800', fontSize: '17px', color: 'var(--title-color)' }}>{user?.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{user?.email}</p>
                {user?.email_verified ? (
                  <span style={{ fontSize: '11px', color: '#22c55e', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                    ✓ Email Verified
                  </span>
                ) : (
                  <span
                    onClick={handleResendEmailVerification}
                    title="Click to resend verification OTP"
                    style={{ fontSize: '11px', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 8px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    ⚠️ Unverified (Resend Code)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current.click()}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  📷 Upload Photo
                </button>

                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="btn btn-secondary"
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
                >
                  🌐 Image URL
                </button>

                {profileImage && (
                  <button
                    type="button"
                    onClick={() => setProfileImage('')}
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger)', padding: '6px 10px', borderRadius: '8px', fontSize: '11.5px', cursor: 'pointer', fontWeight: '700' }}
                  >
                    🗑️ Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Inline Image URL Input */}
          <AnimatePresence>
            {showUrlInput && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid var(--card-border)' }}
              >
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Paste Direct Image Web Link (HTTPS URL)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="https://example.com/my-photo.jpg"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '12.5px' }}
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '8px 14px', fontSize: '12px' }}
                  >
                    Apply URL
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preset Avatar Selection */}
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Or Choose Preset Emoji Avatar</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {presetAvatars.map(av => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setProfileImage(av)}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    border: profileImage === av ? '2px solid var(--primary)' : '1px solid var(--card-border)',
                    background: profileImage === av ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255,255,255,0.03)',
                    fontSize: '18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="prof-name">Full Name</label>
              <input 
                id="prof-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="prof-email">Email Address (Read-only)</label>
              <input 
                id="prof-email"
                type="email"
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.65, cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="prof-phone">Phone Number</label>
              <input 
                id="prof-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            {profileMsg && <p style={{ color: 'var(--success)', fontSize: '13px', fontWeight: '600' }}>{profileMsg}</p>}
            {profileError && <p style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: '600' }}>{profileError}</p>}

            <button type="submit" className="btn btn-primary" disabled={profileLoading} style={{ marginTop: '8px' }}>
              {profileLoading ? "Saving Changes..." : "Update Profile"}
            </button>
          </form>
        </section>

        {/* RIGHT COLUMN: CHANGE PASSWORD */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>🔐</span>
            <h3 style={{ fontSize: '17px', fontWeight: '800' }}>Security & Credentials</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Ensure your account uses a strong password (minimum 8 characters with at least one uppercase letter and one number/symbol).
          </p>

          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="curr-pass">Current Password</label>
              <input 
                id="curr-pass"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="new-pass">New Password</label>
              <input 
                id="new-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="conf-pass">Confirm New Password</label>
              <input 
                id="conf-pass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {passMsg && <p style={{ color: 'var(--success)', fontSize: '13px', fontWeight: '600' }}>{passMsg}</p>}
            {passError && <p style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: '600' }}>{passError}</p>}

            <button type="submit" className="btn btn-primary" disabled={passLoading} style={{ marginTop: '8px' }}>
              {passLoading ? "Updating Password..." : "Update Password"}
            </button>
          </form>

          {/* Quick Sign out and Logout from all devices */}
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={handleLogoutAllClick}
              className="btn"
              style={{ width: '100%', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: '700' }}
            >
              🌐 Logout From All Devices
            </button>
            <button 
              onClick={logout}
              className="btn"
              style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.25)' }}
            >
              🚪 Sign Out of Account
            </button>
          </div>
        </section>

      </div>

      {/* FULL WIDTH: SYSTEM SETTINGS & PREFERENCES */}
      <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>⚙️</span>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: '800' }}>Application & Scraper Settings</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '2px' }}>
                Configure scraper speed, default export formats, theme mode, and session timeout options.
              </p>
            </div>
          </div>

          {settingsMsg && (
            <span style={{ fontSize: '12px', fontWeight: '750', color: 'var(--success)', background: 'rgba(34, 197, 94, 0.12)', padding: '4px 12px', borderRadius: '20px' }}>
              ✓ {settingsMsg}
            </span>
          )}
        </div>

        <div className="three-column-responsive-grid settings-cards-grid" style={{ marginTop: '10px' }}>
          
          {/* Setting Item 1: Theme Mode */}
          <div className="setting-card-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)', display: 'block', marginBottom: '6px' }}>
              🎨 UI Theme Preference
            </label>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>Choose your visual interface appearance.</p>
            <CustomSelect
              value={settings.themeMode}
              onChange={(e) => handleSettingChange('themeMode', e.target.value)}
              options={[
                { value: 'dark', label: '🌙 Dark Glassmorphism' },
                { value: 'light', label: '☀️ Light Clean Mode' }
              ]}
            />
          </div>

          {/* Setting Item 2: Default Export Format */}
          <div className="setting-card-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)', display: 'block', marginBottom: '6px' }}>
              📊 Default Export Format
            </label>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>Preferred format when downloading results.</p>
            <CustomSelect
              value={settings.defaultFormat}
              onChange={(e) => handleSettingChange('defaultFormat', e.target.value)}
              options={[
                { value: 'xlsx', label: 'Excel Document (.xlsx)' },
                { value: 'csv', label: 'Comma Separated (.csv)' },
                { value: 'pdf', label: 'PDF Analytics Report (.pdf)' }
              ]}
            />
          </div>

          {/* Setting Item 3: Scraper Concurrency */}
          <div className="setting-card-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)', display: 'block', marginBottom: '6px' }}>
              ⚡ Scraper Speed & Concurrency
            </label>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>Control parallel browser page fetch rates.</p>
            <CustomSelect
              value={settings.concurrencyMode}
              onChange={(e) => handleSettingChange('concurrencyMode', e.target.value)}
              options={[
                { value: 'stealth', label: '🛡️ Stealth Mode (Slower, High Reliability)' },
                { value: 'balanced', label: '⚡ Balanced Mode (Recommended)' },
                { value: 'turbo', label: '🚀 Turbo Speed (Maximum Parallelization)' }
              ]}
            />
          </div>

          {/* Setting Item 4: Auto-Save Export */}
          <div className="setting-card-item setting-toggle-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)', display: 'block', marginBottom: '4px' }}>
                📁 Auto-Save Downloads
              </label>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Automatically trigger download on completion.</p>
            </div>
            <input 
              type="checkbox"
              checked={settings.autoSaveExport}
              onChange={(e) => handleSettingChange('autoSaveExport', e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Setting Item 5: Sound Alerts */}
          <div className="setting-card-item setting-toggle-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)', display: 'block', marginBottom: '4px' }}>
                🔔 Sound & Toast Alerts
              </label>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Play sound notification when scraping finishes.</p>
            </div>
            <input 
              type="checkbox"
              checked={settings.soundAlerts}
              onChange={(e) => handleSettingChange('soundAlerts', e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Setting Item: Headless Mode */}
          <div className="setting-card-item setting-toggle-card" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ paddingRight: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)', display: 'block', marginBottom: '4px' }}>
                Headless Mode
              </label>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                When enabled, the browser runs in the background. Disable it to view the browser and solve CAPTCHAs manually.
              </p>
            </div>
            <input
              type="checkbox"
              checked={headlessMode}
              onChange={(e) => handleHeadlessModeChange(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)', flexShrink: 0 }}
            />
          </div>

          {/* Setting Item 6: Session Timeout Duration */}
          <div className="setting-card-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <label style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)', display: 'block', marginBottom: '6px' }}>
              ⏱️ Session Expiration Warning
            </label>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>Inactive session warning window.</p>
            <CustomSelect
              value={settings.sessionTimeout}
              onChange={(e) => handleSettingChange('sessionTimeout', e.target.value)}
              options={[
                { value: '15', label: '15 Minutes' },
                { value: '30', label: '30 Minutes' },
                { value: '60', label: '1 Hour (Default)' },
                { value: 'disabled', label: 'Never Expire (Active Session)' }
              ]}
            />
          </div>

        </div>

        {/* Cache Clearing Maintenance Bar */}
        <div className="profile-maintenance-bar" style={{ marginTop: '10px', paddingTop: '16px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)' }}>Cache & Local Storage Maintenance</p>
            <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Clear cached student records, recent searches, and reset application settings.</p>
          </div>
          <button 
            onClick={handleClearCache}
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '6px 14px', fontSize: '12px', borderColor: 'rgba(245, 158, 11, 0.4)', color: 'var(--warning)' }}
          >
            🧹 Reset App Preferences & Cache
          </button>
        </div>
      </section>

      {/* FULL WIDTH: LOGIN HISTORY AUDIT LOG */}
      <section className="glass-panel">
        <div className="profile-history-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>📋</span>
            <h3 style={{ fontSize: '17px', fontWeight: '800' }}>Recent Login History Audit</h3>
          </div>
          {loginHistory.length > 0 && (
            <button
              onClick={handleClearAllHistory}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              🗑️ Clear All History
            </button>
          )}
        </div>

        {historyLoading ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Login Time</th>
                  <th>Logout Time</th>
                  <th>IP Address</th>
                  <th>Browser</th>
                  <th>Operating System</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td><div className="skeleton skeleton-text" style={{ width: '130px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '110px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '80px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '100px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '90px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '40px' }}></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : loginHistory.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No recent login records found.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Login Time</th>
                  <th>Logout Time</th>
                  <th>IP Address</th>
                  <th>Browser</th>
                  <th>Operating System</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: '600', color: 'var(--title-color)' }}>
                      {new Date(h.login_time).toLocaleString()}
                    </td>
                    <td>
                      {h.logout_time ? (
                        new Date(h.logout_time).toLocaleString()
                      ) : (
                        <span className="badge pass">Active Session</span>
                      )}
                    </td>
                    <td className="subject-code">{h.ip_address || '127.0.0.1'}</td>
                    <td>{h.browser || 'Unknown Browser'}</td>
                    <td>{h.os || 'Unknown OS'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteHistoryItem(h.id)}
                        className="cc-iconbtn"
                        title="Delete this entry"
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#EF4444',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </motion.div>
  );
}
