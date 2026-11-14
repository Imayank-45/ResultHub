import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * CustomSelect Component
 * Renders a 100% responsive, viewport-bounded dropdown select using a React Portal.
 * Prevents clipping caused by sticky containers or parent elements with overflow: hidden/auto.
 */
export default function CustomSelect({
  id,
  value,
  onChange,
  options = [],
  disabled = false,
  allowCustom = false,
  style = {},
  className = '',
  placeholder = 'Select option...'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, maxHeight: 220 });

  // Normalize options array into { value, label } objects
  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'object' && opt !== null) {
        return {
          value: opt.value !== undefined ? opt.value : opt.label,
          label: opt.label !== undefined ? opt.label : String(opt.value)
        };
      }
      return { value: opt, label: String(opt) };
    });
  }, [options]);

  // Current selected option
  const currentOption = useMemo(() => {
    return normalizedOptions.find(o => String(o.value) === String(value)) || null;
  }, [normalizedOptions, value]);

  // Re-calculate dropdown position relative to trigger element in screen space
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 4;
    let maxHeight = 220;

    // Flip above if space below is too tight (< 150px) and space above is greater
    if (spaceBelow < 150 && spaceAbove > spaceBelow) {
      maxHeight = Math.min(220, spaceAbove - 16);
      top = Math.max(8, rect.top - 4 - maxHeight);
    } else {
      maxHeight = Math.min(220, spaceBelow - 16);
    }

    const width = Math.min(Math.max(rect.width, 160), viewportWidth - 32);
    let left = rect.left;
    if (left + width > viewportWidth - 16) {
      left = Math.max(16, viewportWidth - width - 16);
    }
    if (left < 16) left = 16;

    setCoords({
      top,
      left,
      width,
      maxHeight: Math.max(100, maxHeight)
    });
  }, []);

  // Update position on scroll/resize using capture phase to catch parent container scroll events
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleScrollOrResize = () => {
      requestAnimationFrame(updatePosition);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Close dropdown menu on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      const isTriggerClick = triggerRef.current && triggerRef.current.contains(e.target);
      const isPanelClick = panelRef.current && panelRef.current.contains(e.target);
      if (!isTriggerClick && !isPanelClick) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectOption = (optValue) => {
    if (disabled) return;
    onChange({ target: { value: optValue, id } });
    setIsOpen(false);
  };

  const optionsPanelMarkup = isOpen && typeof document !== 'undefined' ? (
    <div 
      ref={panelRef}
      className="custom-select-options-panel"
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: `${coords.maxHeight}px`,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: 'var(--card-bg, #0F172A)',
        border: '1px solid var(--card-border, rgba(255,255,255,0.12))',
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
        zIndex: 99999,
        padding: '4px',
        boxSizing: 'border-box',
        backdropFilter: 'blur(16px)'
      }}
    >
      {allowCustom && (
        <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', borderBottom: '1px solid var(--card-border)', marginBottom: '4px' }}>
          💡 PRESETS (OR TYPE CUSTOM DATE IN FIELD ABOVE)
        </div>
      )}
      {normalizedOptions.map((opt) => {
        const isSelected = String(opt.value) === String(value);
        return (
          <div
            key={String(opt.value)}
            onClick={() => handleSelectOption(opt.value)}
            className={`custom-select-option-item ${isSelected ? 'active' : ''}`}
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: isSelected ? '700' : '500',
              color: isSelected ? '#FFFFFF' : 'var(--text-main)',
              background: isSelected ? 'var(--primary-gradient)' : 'transparent',
              cursor: 'pointer',
              transition: 'background 0.15s',
              wordBreak: 'break-word',
              marginBottom: '2px',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {opt.label}
          </div>
        );
      })}
    </div>
  ) : null;

  return (
    <div 
      ref={triggerRef}
      className="custom-select-wrapper" 
      style={{ 
        position: 'relative', 
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}
    >
      {allowCustom ? (
        /* Combobox Mode with Direct Input + Dropdown Toggle Arrow */
        <div 
          style={{ 
            position: 'relative', 
            display: 'flex', 
            alignItems: 'center',
            width: '100%',
            maxWidth: '100%'
          }}
        >
          <input
            id={id}
            type="text"
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(e)}
            onFocus={() => !disabled && setIsOpen(true)}
            placeholder={placeholder}
            className={`custom-select-trigger ${className}`}
            style={{
              width: '100%',
              maxWidth: '100%',
              padding: '11px 40px 11px 14px',
              background: 'var(--input-bg)',
              border: isOpen ? '1px solid var(--primary)' : '1px solid var(--card-border)',
              borderRadius: '10px',
              color: 'var(--text-main)',
              fontSize: '13.5px',
              fontFamily: 'var(--font-body)',
              fontWeight: '500',
              boxSizing: 'border-box',
              outline: 'none',
              boxShadow: isOpen ? '0 0 0 3px rgba(124, 58, 237, 0.2)' : 'none',
              transition: 'var(--transition-smooth)',
              ...style
            }}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              padding: '8px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94A3B8'
            }}
          >
            <svg 
              width="15" 
              height="15" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              viewBox="0 0 24 24"
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      ) : (
        /* Standard Select Trigger Box */
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`custom-select-trigger ${className}`}
          style={{
            width: '100%',
            maxWidth: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '11px 14px',
            background: 'var(--input-bg)',
            border: isOpen ? '1px solid var(--primary)' : '1px solid var(--card-border)',
            borderRadius: '10px',
            color: 'var(--text-main)',
            fontSize: '13.5px',
            fontFamily: 'var(--font-body)',
            fontWeight: '500',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            boxSizing: 'border-box',
            textAlign: 'left',
            boxShadow: isOpen ? '0 0 0 3px rgba(124, 58, 237, 0.2)' : 'none',
            transition: 'var(--transition-smooth)',
            ...style
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {currentOption ? currentOption.label : (value || placeholder)}
          </span>
          <svg 
            width="15" 
            height="15" 
            fill="none" 
            stroke="#94A3B8" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            viewBox="0 0 24 24"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              flexShrink: 0,
              marginLeft: '8px'
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Render Options Panel in Body via React Portal */}
      {optionsPanelMarkup && createPortal(optionsPanelMarkup, document.body)}
    </div>
  );
}
