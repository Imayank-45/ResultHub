import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    color: '#10B981',
    bgLight: 'rgba(16, 185, 129, 0.10)',
    border: 'rgba(16, 185, 129, 0.28)',
    defaultTitle: 'Success'
  },
  error: {
    icon: XCircle,
    color: '#EF4444',
    bgLight: 'rgba(239, 68, 68, 0.10)',
    border: 'rgba(239, 68, 68, 0.28)',
    defaultTitle: 'Error'
  },
  warning: {
    icon: AlertTriangle,
    color: '#F59E0B',
    bgLight: 'rgba(245, 158, 11, 0.10)',
    border: 'rgba(245, 158, 11, 0.28)',
    defaultTitle: 'Warning'
  },
  info: {
    icon: Info,
    color: '#3B82F6',
    bgLight: 'rgba(59, 130, 246, 0.10)',
    border: 'rgba(59, 130, 246, 0.28)',
    defaultTitle: 'Notification'
  }
};

function ToastItem({ toast, onRemove }) {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(toast.duration);
  const timerRef = useRef(null);

  const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info;
  const IconComponent = config.icon;

  useEffect(() => {
    if (toast.duration <= 0) return;

    const updateInterval = 50; // update progress every 50ms

    const startTimer = () => {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = remainingRef.current - elapsed;
        const pct = Math.max(0, (remaining / toast.duration) * 100);

        setProgress(pct);

        if (remaining <= 0) {
          clearInterval(timerRef.current);
          onRemove(toast.id);
        }
      }, updateInterval);
    };

    if (!isHovered) {
      startTimer();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        const elapsed = Date.now() - startTimeRef.current;
        remainingRef.current = Math.max(0, remainingRef.current - elapsed);
      }
    };
  }, [isHovered, toast.duration, toast.id, onRemove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.9, transition: { duration: 0.2 } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '360px',
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--card-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${config.border}`,
        borderRadius: '14px',
        padding: '14px 16px 16px',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        pointerEvents: 'auto',
        color: 'var(--text-main)',
        userSelect: 'none'
      }}
    >
      {/* Icon Badge */}
      <div style={{
        width: '34px',
        height: '34px',
        borderRadius: '10px',
        background: config.bgLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: config.color,
        flexShrink: 0,
        marginTop: '1px'
      }}>
        <IconComponent size={20} />
      </div>

      {/* Message & Content */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: '18px' }}>
        <div style={{
          fontSize: '13px',
          fontWeight: '800',
          color: 'var(--title-color)',
          lineHeight: '1.3',
          marginBottom: '2px'
        }}>
          {toast.title || config.defaultTitle}
        </div>
        <div style={{
          fontSize: '12.5px',
          color: 'var(--text-muted)',
          lineHeight: '1.45',
          wordBreak: 'break-word'
        }}>
          {toast.message}
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={() => onRemove(toast.id)}
        title="Dismiss Notification"
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.color = 'var(--title-color)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        <X size={15} />
      </button>

      {/* Progress Bar */}
      {toast.duration > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: config.color,
            transition: isHovered ? 'none' : 'width 0.05s linear'
          }} />
        </div>
      )}
    </motion.div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div style={{
      position: 'fixed',
      top: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none'
    }}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toastItem) => (
          <ToastItem key={toastItem.id} toast={toastItem} onRemove={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
