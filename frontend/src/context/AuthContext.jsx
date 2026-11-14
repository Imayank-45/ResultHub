import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const isDev = window.location.port === '5173';
const host = isDev ? '127.0.0.1:8000' : window.location.host;
export const API_BASE = `${window.location.protocol}//${host}/api`;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    return localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || null;
  });

  const [refreshToken, setRefreshToken] = useState(() => {
    return localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token') || null;
  });

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user_data') || sessionStorage.getItem('user_data');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [loading, setLoading] = useState(true);
  const [showExpiryModal, setShowExpiryModal] = useState(false);

  // Storage selection helper based on rememberMe flag
  const saveAuthData = (accessToken, refToken, userData, rememberMe) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    // Clear both first to avoid duplicates
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user_data');

    storage.setItem('access_token', accessToken);
    storage.setItem('refresh_token', refToken);
    storage.setItem('user_data', JSON.stringify(userData));

    setToken(accessToken);
    setRefreshToken(refToken);
    setUser(userData);
  };

  const clearAuthData = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user_data');

    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setShowExpiryModal(false);
  }, []);

  // Authenticated fetch wrapper
  const authFetch = useCallback(async (url, options = {}) => {
    const activeToken = token || localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    
    const headers = {
      ...(options.headers || {}),
    };

    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Handle 401 Unauthorized -> attempt token refresh
    if (response.status === 401 && refreshToken) {
      console.log("Access token expired. Attempting refresh...");
      const refreshed = await refreshAuthToken();
      if (refreshed && refreshed.access_token) {
        headers['Authorization'] = `Bearer ${refreshed.access_token}`;
        response = await fetch(url, { ...options, headers });
      } else {
        clearAuthData();
      }
    }

    return response;
  }, [token, refreshToken, clearAuthData]);

  // Login handler (email or mobile)
  const login = async (identifier, password, rememberMe = false) => {
    try {
      const isEmail = identifier.includes('@');
      const payload = {
        email: isEmail ? identifier : undefined,
        phone: !isEmail ? identifier : undefined,
        password,
        remember_me: rememberMe
      };
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 400) {
          throw new Error(data.detail || 'Invalid email/mobile or password.');
        }
        if (response.status >= 500) {
          throw new Error('Unable to sign in right now. Please try again.');
        }
        throw new Error(data.detail || 'Unable to sign in right now. Please try again.');
      }

      saveAuthData(data.access_token, data.refresh_token, data.user, rememberMe);
      return { success: true, user: data.user };
    } catch (err) {
      let msg = err.message || 'Unable to sign in right now. Please try again.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        msg = 'Unable to sign in right now. Please try again.';
      }
      return { success: false, error: msg };
    }
  };

  // Register handler (email or mobile)
  const register = async (name, identifier, password, rememberMe = true) => {
    try {
      const isEmail = identifier.includes('@');
      const payload = {
        name,
        email: isEmail ? identifier : undefined,
        phone: !isEmail ? identifier : undefined,
        password
      };
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed. Please try again.');
      }

      saveAuthData(data.access_token, data.refresh_token, data.user, rememberMe);
      return { success: true, user: data.user };
    } catch (err) {
      let msg = err.message || 'Registration failed';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed')) {
        msg = 'Unable to connect to the server. Please try again.';
      }
      return { success: false, error: msg };
    }
  };

  // Send mobile OTP handler
  const sendMobileOtp = async (phone) => {
    try {
      const res = await fetch(`${API_BASE}/auth/send-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send OTP code');
      return { success: true, message: data.message, otp: data.otp };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Verify mobile OTP handler
  const verifyMobileOtp = async (phone, otp) => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-mobile-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OTP verification failed');
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      const refToken = refreshToken || localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
      if (token) {
        await authFetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refToken })
        });
      }
    } catch (e) {
      console.error("Logout API error:", e);
    } finally {
      clearAuthData();
    }
  };

  // Logout from all devices
  const logoutAll = async () => {
    try {
      if (token) {
        await authFetch(`${API_BASE}/auth/logout-all`, { method: 'POST' });
      }
    } catch (e) {
      console.error("Logout-all API error:", e);
    } finally {
      clearAuthData();
    }
  };

  // Verify email handler
  const verifyEmail = async (email, otp) => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Email verification failed');
      
      // Update local user state
      if (user) {
        const updated = { ...user, email_verified: true };
        setUser(updated);
        const isRemembered = !!localStorage.getItem('user_data');
        const storage = isRemembered ? localStorage : sessionStorage;
        storage.setItem('user_data', JSON.stringify(updated));
      }
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Resend verification email handler
  const resendVerification = async (email) => {
    try {
      const res = await fetch(`${API_BASE}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to resend verification code');
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Forgot password request handler (accepts email or mobile)
  const forgotPassword = async (identifier) => {
    try {
      const isEmail = identifier.includes('@');
      const payload = isEmail ? { email: identifier } : { phone: identifier };
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to request password reset');
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Verify reset OTP handler (accepts email or mobile)
  const verifyResetOtp = async (identifier, otp) => {
    try {
      const isEmail = identifier.includes('@');
      const payload = isEmail ? { email: identifier, otp } : { phone: identifier, otp };
      const res = await fetch(`${API_BASE}/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'OTP verification failed');
      return { success: true, resetToken: data.reset_token, message: data.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Reset password handler
  const resetPassword = async (identifier, resetToken, newPassword, confirmPassword) => {
    try {
      const isEmail = identifier.includes('@');
      const payload = {
        email: isEmail ? identifier : undefined,
        phone: !isEmail ? identifier : undefined,
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword
      };
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Password reset failed');
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Refresh token handler
  const refreshAuthToken = async () => {
    const refToken = refreshToken || localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
    if (!refToken) return null;

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refToken })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to refresh token');
      }

      const isRemembered = !!localStorage.getItem('refresh_token');
      saveAuthData(data.access_token, data.refresh_token, data.user, isRemembered);
      setShowExpiryModal(false);
      return data;
    } catch (err) {
      console.error("Token refresh failed:", err);
      clearAuthData();
      return null;
    }
  };

  // Initial session verification on mount
  useEffect(() => {
    const initAuth = async () => {
      const activeToken = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
      if (activeToken) {
        try {
          const res = await authFetch(`${API_BASE}/auth/me`);
          if (res.ok) {
            const meData = await res.json();
            setUser(meData.user);
          } else {
            clearAuthData();
          }
        } catch (e) {
          console.error("Init auth failed:", e);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [authFetch, clearAuthData]);

  // Update profile handler
  const updateProfile = async (profileData) => {
    try {
      const res = await authFetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to update profile');
      setUser(data);
      const isRemembered = !!localStorage.getItem('user_data');
      const storage = isRemembered ? localStorage : sessionStorage;
      storage.setItem('user_data', JSON.stringify(data));
      return { success: true, user: data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // Change password handler
  const changePassword = async (passwordData) => {
    try {
      const res = await authFetch(`${API_BASE}/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to change password');
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    sendMobileOtp,
    verifyMobileOtp,
    logout,
    logoutAll,
    verifyEmail,
    resendVerification,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    refreshAuthToken,
    updateProfile,
    changePassword,
    authFetch,
    showExpiryModal,
    setShowExpiryModal
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

