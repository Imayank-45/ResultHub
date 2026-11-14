import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const {
    login,
    register,
    forgotPassword,
    verifyResetOtp,
    resetPassword
  } = useAuth();
  const { success, error: toastError, info } = useToast();

  // Primary mode: 'signin' | 'signup'
  const [authMode, setAuthMode] = useState('signin');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Input state & submit controls
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formServerError, setFormServerError] = useState(null);

  // Field validation & interaction states
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Forgot password modal state (3 steps: 1=Email, 2=OTP, 3=New Password)
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Real-time password requirement criteria
  const passwordCriteria = {
    hasLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  const criteriaMetCount = Object.values(passwordCriteria).filter(Boolean).length;
  const strengthLabels = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Very Strong'];
  const strengthColors = ['#EF4444', '#F97316', '#F59E0B', '#3B82F6', '#22C55E'];

  // Validation helpers
  const validateEmail = (val) => {
    if (!val || !val.trim()) return 'Email address is required.';
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(val.trim())) return 'Please enter a valid email address.';
    return '';
  };

  const validatePassword = (val) => {
    if (!val) return 'Password is required.';
    if (val.length < 8) return 'Password must be at least 8 characters.';
    return '';
  };

  const validateName = (val) => {
    if (!val || val.trim().length < 2) return 'Full name must be at least 2 characters.';
    return '';
  };

  const validateConfirmPassword = (val, pwd) => {
    if (!val) return 'Please confirm your password.';
    if (val !== pwd) return 'Passwords do not match';
    return '';
  };

  // Handle field blur
  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    runValidation(field);
  };

  const runValidation = (fieldKey) => {
    let err = '';
    if (fieldKey === 'email') err = validateEmail(email);
    if (fieldKey === 'password') err = validatePassword(password);
    if (fieldKey === 'name') err = validateName(name);
    if (fieldKey === 'confirmPassword') err = validateConfirmPassword(confirmPassword, password);

    setFieldErrors((prev) => ({ ...prev, [fieldKey]: err }));
    return err;
  };

  const shouldShowError = (fieldKey) => {
    return (touched[fieldKey] || submitted) && !!fieldErrors[fieldKey];
  };

  // Switch between Sign In and Create Account tabs
  const handleSwitchMode = (mode) => {
    setAuthMode(mode);
    setFieldErrors({});
    setTouched({});
    setSubmitted(false);
    setFormServerError(null);
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    setSubmitted(true);
    setFormServerError(null);

    let errors = {};
    if (authMode === 'signin') {
      errors.email = validateEmail(email);
      errors.password = validatePassword(password);
    } else {
      errors.name = validateName(name);
      errors.email = validateEmail(email);
      errors.password = validatePassword(password);
      errors.confirmPassword = validateConfirmPassword(confirmPassword, password);
    }

    setFieldErrors(errors);

    const hasErrors = Object.values(errors).some((msg) => msg !== '');
    if (hasErrors) {
      return;
    }

    setLoading(true);

    if (authMode === 'signin') {
      const result = await login(email.trim(), password, rememberMe);

      setLoading(false);
      if (!result.success) {
        let rawErr = result.error || '';
        if (rawErr.toLowerCase().includes('connect') || rawErr.toLowerCase().includes('network') || rawErr.toLowerCase().includes('server')) {
          setFormServerError({
            title: 'Unable to sign in right now. Please try again.',
            sub: ''
          });
        } else {
          setFormServerError({
            title: 'Invalid email or password',
            sub: 'Please check your credentials and try again.'
          });
        }
      } else {
        const userName = result.user?.name || 'User';
        success(`You’ve successfully signed in.`, { title: `Welcome back, ${userName} 👋` });
      }
    } else {
      // SIGN UP
      const result = await register(name, email.trim(), password, true);
      setLoading(false);

      if (!result.success) {
        let errStr = result.error || '';
        if (errStr.toLowerCase().includes('already exists') || errStr.toLowerCase().includes('registered')) {
          setFormServerError({
            title: 'Account already exists',
            sub: 'Try signing in instead.',
            action: true
          });
        } else {
          toastError(errStr || 'Registration failed. Please try again.');
        }
      } else {
        const userName = result.user?.name || name || 'User';
        success(`Welcome to ResultAI, ${userName}! 🎉`, { title: 'Account created successfully' });
      }
    }
  };

  // Handle Forgot Password Steps
  const handleForgotStep1 = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.trim()) {
      toastError('Please enter your email address.');
      return;
    }
    setForgotLoading(true);

    const res = await forgotPassword(forgotEmail.trim());
    setForgotLoading(false);
    if (res.success) {
      info('If an account exists, a 6-digit OTP code has been sent.');
      setForgotStep(2);
    } else {
      toastError(res.error || 'Failed to request password reset');
    }
  };

  const handleForgotStep2 = async (e) => {
    e.preventDefault();
    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      toastError('Please enter the 6-digit OTP code.');
      return;
    }
    setForgotLoading(true);

    const res = await verifyResetOtp(forgotEmail.trim(), forgotOtp.trim());
    setForgotLoading(false);
    if (res.success && res.resetToken) {
      setResetToken(res.resetToken);
      success('OTP verified! Please set your new password.');
      setForgotStep(3);
    } else {
      toastError(res.error || 'Invalid or expired OTP code.');
    }
  };

  const handleForgotStep3 = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toastError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toastError('Passwords do not match.');
      return;
    }
    setForgotLoading(true);

    const res = await resetPassword(forgotEmail.trim(), resetToken, newPassword, confirmNewPassword);
    setForgotLoading(false);
    if (res.success) {
      success('Password updated successfully ✓');
      setShowForgotModal(false);
      setForgotStep(1);
      setForgotEmail('');
      setForgotOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
      handleSwitchMode('signin');
    } else {
      toastError(res.error || 'Password reset failed.');
    }
  };

  return (
    <div className="login-page-container">
      {/* Animated Background Layers */}
      <div className="grid-overlay" />
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      {/* Floating Ambient Particles */}
      {[...Array(8)].map((_, i) => (
        <div key={i} className={`login-particle login-particle-${i + 1}`} />
      ))}

      {/* Main Centered Authentication Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="login-card"
      >
        {/* Top Glow Accent Line */}
        <div className="login-card-accent" />

        {/* Brand Header */}
        <div className="login-brand">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
            className="login-logo-wrap"
          >
            <img
              src="/logo.png"
              alt="ResultAI Logo"
              onError={(e) => {
                e.target.src = '/logo.jpg';
              }}
              className="login-logo-img"
            />
            <div className="login-logo-glow" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="login-header-text"
          >
            <h1 className="login-title">
              {authMode === 'signin' ? 'Welcome to ResultAI' : 'Create Your Account'}
            </h1>
            <p className="login-subtitle">
              {authMode === 'signin'
                ? 'Your intelligent platform for academic result automation'
                : 'Join ResultAI to experience automated result analysis & reports'}
            </p>
          </motion.div>
        </div>

        {/* Sign In vs Create Account Mode Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="login-mode-tabs"
        >
          <button
            type="button"
            className={`login-mode-tab ${authMode === 'signin' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('signin')}
          >
            {authMode === 'signin' && (
              <motion.div
                layoutId="loginTabHighlight"
                className="login-tab-highlight"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="login-tab-text">Sign In</span>
          </button>
          <button
            type="button"
            className={`login-mode-tab ${authMode === 'signup' ? 'active' : ''}`}
            onClick={() => handleSwitchMode('signup')}
          >
            {authMode === 'signup' && (
              <motion.div
                layoutId="loginTabHighlight"
                className="login-tab-highlight"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="login-tab-text">Create Account</span>
          </button>
        </motion.div>

        {/* Global Form Server Error Banner */}
        <AnimatePresence>
          {formServerError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="login-server-error-banner"
            >
              <div className="error-icon-wrap">
                <svg width="18" height="18" fill="none" stroke="#EF4444" strokeWidth="2.2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="error-text-content">
                <span className="error-title">{formServerError.title}</span>
                {formServerError.sub && <span className="error-sub">{formServerError.sub}</span>}
                {formServerError.action && (
                  <button
                    type="button"
                    className="error-action-link"
                    onClick={() => handleSwitchMode('signin')}
                  >
                    Go to Sign In →
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Form Area */}
        <AnimatePresence mode="wait">
          {authMode === 'signin' ? (
            <motion.form
              key="signin-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.22 }}
              onSubmit={handleSubmit}
              className="login-form"
              noValidate
            >
              {/* Email Address */}
              <div className="login-field">
                <label htmlFor="login-email" className="login-label">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Email Address
                </label>
                <div className="login-input-wrap">
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (touched.email || submitted) {
                        setFieldErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                      }
                    }}
                    onBlur={() => handleBlur('email')}
                    placeholder="user@example.com"
                    required
                    autoFocus
                    className={`login-input ${shouldShowError('email') ? 'has-error' : ''}`}
                  />
                </div>
                {shouldShowError('email') && (
                  <span className="login-inline-error">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {fieldErrors.email}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="login-field">
                <div className="login-label-row">
                  <label htmlFor="login-password" className="login-label">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotModal(true);
                    }}
                    className="login-forgot-link-btn"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="login-input-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (touched.password || submitted) {
                        setFieldErrors((prev) => ({ ...prev, password: validatePassword(e.target.value) }));
                      }
                    }}
                    onBlur={() => handleBlur('password')}
                    placeholder="••••••••"
                    required
                    className={`login-input ${shouldShowError('password') ? 'has-error' : ''}`}
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-eye-btn"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                    aria-label={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.349-3.938 5.155-7 9.964-7s8.615 3.062 9.964 7c-1.349 3.938-5.155 7-9.964 7s-8.615-3.062-9.964-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {shouldShowError('password') && (
                  <span className="login-inline-error">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              {/* Remember Me */}
              <label className="login-remember">
                <div className="login-checkbox-wrap">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="login-checkbox"
                  />
                  <div className="login-checkbox-custom">
                    {rememberMe && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2">
                        <polyline points="1.5,5 4,7.5 8.5,2.5" />
                      </svg>
                    )}
                  </div>
                </div>
                <span>Remember me for 7 days</span>
              </label>

              {/* Primary Sign In Button */}
              <motion.button
                whileHover={!loading ? { scale: 1.012 } : {}}
                whileTap={!loading ? { scale: 0.988 } : {}}
                type="submit"
                disabled={loading}
                className="login-submit-btn"
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                    </svg>
                    Sign In to Dashboard
                  </>
                )}
              </motion.button>
            </motion.form>
          ) : (
            /* CREATE ACCOUNT FORM */
            <motion.form
              key="signup-form"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.22 }}
              onSubmit={handleSubmit}
              className="login-form"
              noValidate
            >
              {/* Full Name */}
              <div className="login-field">
                <label htmlFor="signup-name" className="login-label">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Full Name
                </label>
                <div className="login-input-wrap">
                  <input
                    id="signup-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (touched.name || submitted) {
                        setFieldErrors((prev) => ({ ...prev, name: validateName(e.target.value) }));
                      }
                    }}
                    onBlur={() => handleBlur('name')}
                    placeholder="John Doe"
                    required
                    autoFocus
                    className={`login-input ${shouldShowError('name') ? 'has-error' : ''}`}
                  />
                </div>
                {shouldShowError('name') && (
                  <span className="login-inline-error">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {fieldErrors.name}
                  </span>
                )}
              </div>

              {/* Email Address */}
              <div className="login-field">
                <label htmlFor="signup-email" className="login-label">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Email Address
                </label>
                <div className="login-input-wrap">
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (touched.email || submitted) {
                        setFieldErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                      }
                    }}
                    onBlur={() => handleBlur('email')}
                    placeholder="user@example.com"
                    required
                    className={`login-input ${shouldShowError('email') ? 'has-error' : ''}`}
                  />
                </div>
                {shouldShowError('email') && (
                  <span className="login-inline-error">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {fieldErrors.email}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="login-field">
                <label htmlFor="signup-password" className="login-label">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Password
                </label>
                <div className="login-input-wrap">
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (touched.password || submitted) {
                        setFieldErrors((prev) => ({ ...prev, password: validatePassword(e.target.value) }));
                      }
                      if ((touched.confirmPassword || submitted) && confirmPassword) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          confirmPassword: validateConfirmPassword(confirmPassword, e.target.value)
                        }));
                      }
                    }}
                    onBlur={() => handleBlur('password')}
                    placeholder="At least 8 characters"
                    required
                    className={`login-input ${shouldShowError('password') ? 'has-error' : ''}`}
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-eye-btn"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.349-3.938 5.155-7 9.964-7s8.615 3.062 9.964 7c-1.349 3.938-5.155 7-9.964 7s-8.615-3.062-9.964-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password Strength Meter & Checklist */}
                {password && (
                  <div className="login-password-strength-container">
                    <div className="login-strength-header">
                      <span className="login-strength-title">Password Strength:</span>
                      <span
                        className="login-strength-value"
                        style={{ color: strengthColors[Math.max(0, criteriaMetCount - 1)] }}
                      >
                        {strengthLabels[Math.max(0, criteriaMetCount - 1)] || 'Very Weak'}
                      </span>
                    </div>

                    <div className="login-strength-track">
                      <motion.div
                        className="login-strength-fill"
                        initial={{ width: '0%' }}
                        animate={{ width: `${(criteriaMetCount / 5) * 100}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        style={{ background: strengthColors[Math.max(0, criteriaMetCount - 1)] }}
                      />
                    </div>

                    <div className="login-checklist-grid">
                      <div className={`login-checklist-item ${passwordCriteria.hasLength ? 'met' : ''}`}>
                        <span className="login-checklist-icon">{passwordCriteria.hasLength ? '✓' : '✕'}</span>
                        <span>8+ characters</span>
                      </div>
                      <div className={`login-checklist-item ${passwordCriteria.hasUpper ? 'met' : ''}`}>
                        <span className="login-checklist-icon">{passwordCriteria.hasUpper ? '✓' : '✕'}</span>
                        <span>Uppercase letter</span>
                      </div>
                      <div className={`login-checklist-item ${passwordCriteria.hasLower ? 'met' : ''}`}>
                        <span className="login-checklist-icon">{passwordCriteria.hasLower ? '✓' : '✕'}</span>
                        <span>Lowercase letter</span>
                      </div>
                      <div className={`login-checklist-item ${passwordCriteria.hasNumber ? 'met' : ''}`}>
                        <span className="login-checklist-icon">{passwordCriteria.hasNumber ? '✓' : '✕'}</span>
                        <span>Number</span>
                      </div>
                      <div className={`login-checklist-item ${passwordCriteria.hasSpecial ? 'met' : ''}`}>
                        <span className="login-checklist-icon">{passwordCriteria.hasSpecial ? '✓' : '✕'}</span>
                        <span>Special character</span>
                      </div>
                    </div>
                  </div>
                )}

                {shouldShowError('password') && (
                  <span className="login-inline-error">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              {/* Confirm Password */}
              <div className="login-field">
                <label htmlFor="signup-confirm-password" className="login-label">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Confirm Password
                </label>
                <div className="login-input-wrap">
                  <input
                    id="signup-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (touched.confirmPassword || submitted) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          confirmPassword: validateConfirmPassword(e.target.value, password)
                        }));
                      }
                    }}
                    onBlur={() => handleBlur('confirmPassword')}
                    placeholder="Re-enter your password"
                    required
                    className={`login-input ${shouldShowError('confirmPassword') ? 'has-error' : ''}`}
                    style={{ paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="login-eye-btn"
                    title={showConfirmPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showConfirmPassword ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.349-3.938 5.155-7 9.964-7s8.615 3.062 9.964 7c-1.349 3.938-5.155 7-9.964 7s-8.615-3.062-9.964-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password Match Indicator */}
                {confirmPassword && (
                  confirmPassword === password ? (
                    <div className="login-match-indicator match-success">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Passwords match</span>
                    </div>
                  ) : (
                    <div className="login-match-indicator match-error">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <span>Passwords do not match</span>
                    </div>
                  )
                )}

                {shouldShowError('confirmPassword') && !confirmPassword && (
                  <span className="login-inline-error">
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {fieldErrors.confirmPassword}
                  </span>
                )}
              </div>

              {/* Primary Create Account Button */}
              <motion.button
                whileHover={!loading ? { scale: 1.012 } : {}}
                whileTap={!loading ? { scale: 0.988 } : {}}
                type="submit"
                disabled={loading}
                className="login-submit-btn"
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    Create Free Account
                  </>
                )}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowForgotModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '440px', borderRadius: '20px', padding: '28px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <svg width="20" height="20" fill="none" stroke="var(--primary)" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '2px', color: 'var(--title-color)' }}>
                    {forgotStep === 1 && 'Reset Your Password'}
                    {forgotStep === 2 && 'Enter Verification OTP'}
                    {forgotStep === 3 && 'Set New Password'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {forgotStep === 1 && 'Enter your registered email address.'}
                    {forgotStep === 2 && `Enter the 6-digit verification code sent to ${forgotEmail}.`}
                    {forgotStep === 3 && 'Choose a strong new password for your account.'}
                  </p>
                </div>
              </div>

              {forgotStep === 1 && (
                <form onSubmit={handleForgotStep1} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <div className="login-field">
                    <label htmlFor="forgot-email" className="login-label">Registered Email Address</label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                      autoFocus
                      className="login-input"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="login-secondary-action-btn"
                      onClick={() => setShowForgotModal(false)}
                      style={{ flex: 1, padding: '10px 14px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="login-submit-btn"
                      disabled={forgotLoading}
                      style={{ flex: 1, marginTop: 0, padding: '10px 14px' }}
                    >
                      {forgotLoading ? 'Sending OTP...' : 'Send OTP Code'}
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 2 && (
                <form onSubmit={handleForgotStep2} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <div className="login-field">
                    <label htmlFor="forgot-otp" className="login-label">6-Digit Verification OTP</label>
                    <input
                      id="forgot-otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      required
                      autoFocus
                      className="login-input otp-styled-input"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="login-secondary-action-btn"
                      onClick={() => setForgotStep(1)}
                      style={{ flex: 1, padding: '10px 14px' }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="login-submit-btn"
                      disabled={forgotLoading}
                      style={{ flex: 1, marginTop: 0, padding: '10px 14px' }}
                    >
                      {forgotLoading ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </div>
                </form>
              )}

              {forgotStep === 3 && (
                <form onSubmit={handleForgotStep3} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <div className="login-field">
                    <label htmlFor="new-pwd" className="login-label">New Password</label>
                    <input
                      id="new-pwd"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      autoFocus
                      className="login-input"
                    />
                  </div>

                  <div className="login-field">
                    <label htmlFor="confirm-new-pwd" className="login-label">Confirm New Password</label>
                    <input
                      id="confirm-new-pwd"
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                      className="login-input"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="login-secondary-action-btn"
                      onClick={() => setShowForgotModal(false)}
                      style={{ flex: 1, padding: '10px 14px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="login-submit-btn"
                      disabled={forgotLoading}
                      style={{ flex: 1, marginTop: 0, padding: '10px 14px' }}
                    >
                      {forgotLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
