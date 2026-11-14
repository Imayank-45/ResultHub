import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let globalToastRef = null;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if used outside provider
    return {
      success: (msg) => globalToastRef?.success(msg),
      error: (msg) => globalToastRef?.error(msg),
      warning: (msg) => globalToastRef?.warning(msg),
      info: (msg) => globalToastRef?.info(msg),
      removeToast: () => {},
    };
  }
  return context;
}

// Global static object for convenience across any utility or fetch wrapper
export const toast = {
  success: (msg, opts) => globalToastRef?.success(msg, opts),
  error: (msg, opts) => globalToastRef?.error(msg, opts),
  warning: (msg, opts) => globalToastRef?.warning(msg, opts),
  info: (msg, opts) => globalToastRef?.info(msg, opts),
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const recentMessagesRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, options = {}) => {
    if (!message) return;
    const now = Date.now();
    const key = `${type}:${message}`;

    // Deduplication check: ignore identical message within 2000ms
    if (recentMessagesRef.current.has(key)) {
      const lastTime = recentMessagesRef.current.get(key);
      if (now - lastTime < 2000) {
        return;
      }
    }
    recentMessagesRef.current.set(key, now);

    // Cleanup old map entries
    for (const [k, time] of recentMessagesRef.current.entries()) {
      if (now - time > 5000) {
        recentMessagesRef.current.delete(k);
      }
    }

    const id = `${now}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = options.duration ?? 4000;
    const title = options.title || null;

    const newToast = {
      id,
      type, // 'success' | 'error' | 'warning' | 'info'
      message,
      title,
      duration,
      createdAt: now,
    };

    setToasts((prev) => {
      // Keep maximum 5 toasts at a time to prevent screen overflow
      const updated = [...prev, newToast];
      if (updated.length > 5) {
        updated.shift();
      }
      return updated;
    });

    return id;
  }, []);

  const success = useCallback((msg, opts) => addToast('success', msg, opts), [addToast]);
  const error = useCallback((msg, opts) => addToast('error', msg, opts), [addToast]);
  const warning = useCallback((msg, opts) => addToast('warning', msg, opts), [addToast]);
  const info = useCallback((msg, opts) => addToast('info', msg, opts), [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  // Register global ref
  globalToastRef = value;

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}
