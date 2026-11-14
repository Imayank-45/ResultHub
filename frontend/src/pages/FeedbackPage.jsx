import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Star, Send, CheckCircle2, AlertCircle, 
  Sparkles, RefreshCw, Mail, User, Tag, ChevronDown, Heart
} from 'lucide-react';

const FEEDBACK_TYPES = [
  { id: 'General Feedback', label: '💬 General Feedback' },
  { id: 'Bug Report', label: '🐛 Bug Report' },
  { id: 'Feature Request', label: '💡 Feature Request' },
  { id: 'UI/UX Suggestion', label: '🎨 UI/UX Suggestion' },
  { id: 'Performance Issue', label: '⚡ Performance Issue' },
  { id: 'Other', label: '📌 Other' }
];

// Quick reaction chips for fast template filling
const PRESET_TAGS = [
  { 
    label: '⚡ Scraper Speed', 
    rating: 5, 
    type: 'General Feedback', 
    text: 'Scraping and OCR result extraction is extremely fast and accurate!' 
  },
  { 
    label: '🎯 High Accuracy', 
    rating: 5, 
    type: 'General Feedback', 
    text: 'Parsed all student marks and SGPA correctly with zero errors.' 
  },
  { 
    label: '🐛 Found a Bug', 
    rating: 2, 
    type: 'Bug Report', 
    text: 'I noticed an issue while scraping results: ' 
  },
  { 
    label: '💡 Feature Idea', 
    rating: 4, 
    type: 'Feature Request', 
    text: 'It would be awesome if ResultAI could add this feature: ' 
  },
  { 
    label: '📊 Compare Studio', 
    rating: 5, 
    type: 'UI/UX Suggestion', 
    text: 'Result Compare Studio is super helpful! Suggestion: ' 
  }
];

const MAX_MESSAGE_LENGTH = 1000;

// Deployed Google Apps Script Web App Endpoint
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbyKNzAWQ8QZWX695Ssv_5d-rYE6Xy2TCWnrOzldlz-DcEOofkeRe9loF4OjoZSUaG8/exec";

export default function FeedbackPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackType, setFeedbackType] = useState('');
  const [message, setMessage] = useState('');

  // Like ResultAI State
  const [totalLikes, setTotalLikes] = useState(128);
  const [hasLiked, setHasLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [likeToast, setLikeToast] = useState('');

  // Validation & Submission States
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null); // 'success' | 'error' | null
  const [statusMessage, setStatusMessage] = useState('');

  // Load initial likes count and user liked status on mount
  useEffect(() => {
    const userLiked = localStorage.getItem('resultai_has_liked') === 'true';
    setHasLiked(userLiked);

    const fetchLikes = async () => {
      try {
        const res = await fetch('/api/likes');
        if (res.ok) {
          const data = await res.json();
          if (data.total_likes !== undefined && typeof data.total_likes === 'number') {
            setTotalLikes(data.total_likes);
          }
        }
      } catch (err) {
        console.warn('Likes fetch notice:', err);
      }
    };
    fetchLikes();
  }, []);

  const handleLike = async () => {
    if (hasLiked) {
      setLikeToast('You have already liked ResultAI! Thank you for your support ❤️');
      setTimeout(() => setLikeToast(''), 3000);
      return;
    }

    // Optimistic UI update & anti-repeat setting
    setHasLiked(true);
    setTotalLikes(prev => prev + 1);
    localStorage.setItem('resultai_has_liked', 'true');
    setLikeToast('Thank you for liking ResultAI! ❤️');
    setTimeout(() => setLikeToast(''), 3500);

    setIsLiking(true);
    const targetUrl = (import.meta.env.VITE_FEEDBACK_API_URL || DEFAULT_API_URL).trim();

    // 1. Post to FastAPI backend Proxy
    try {
      await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like' })
      });
    } catch (e) {}

    // 2. Post to Google Apps Script Web App
    if (targetUrl && !targetUrl.includes('YOUR_DEPLOYMENT_ID')) {
      try {
        await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'like' })
        });
      } catch (e) {
        try {
          const formData = new URLSearchParams();
          formData.append('action', 'like');
          await fetch(targetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
          });
        } catch (err) {}
      }
    }
    setIsLiking(false);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!rating || rating < 1 || rating > 5) {
      newErrors.rating = 'Please select a rating (1 to 5 stars).';
    }

    if (!feedbackType) {
      newErrors.feedbackType = 'Please select a feedback category.';
    }

    if (!message.trim()) {
      newErrors.message = 'Please enter your message or feedback.';
    } else if (message.length > MAX_MESSAGE_LENGTH) {
      newErrors.message = `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Dual Submission Engine:
   * 1. Posts to local FastAPI `/api/feedback` (which saves locally & forwards server-side to Apps Script)
   * 2. Direct fetch to Google Apps Script Web App URL with no-cors fallback
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus(null);
    setStatusMessage('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: name.trim() || 'Anonymous',
      email: email.trim() || 'N/A',
      rating: rating.toString(),
      feedback_type: feedbackType,
      message: message.trim(),
      timestamp: new Date().toISOString()
    };

    let submittedSuccessfully = false;

    // 1. Submit to FastAPI backend proxy
    try {
      const backendResp = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (backendResp.ok) {
        submittedSuccessfully = true;
      }
    } catch (backendErr) {
      console.warn('Backend endpoint unreachable, falling back to direct Apps Script submission', backendErr);
    }

    // 2. Direct submit to Google Apps Script Web App
    const targetUrl = (import.meta.env.VITE_FEEDBACK_API_URL || DEFAULT_API_URL).trim();

    if (targetUrl && !targetUrl.includes('YOUR_DEPLOYMENT_ID')) {
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          submittedSuccessfully = true;
        }
      } catch (tier1Err) {
        // Fallback: mode 'no-cors' URLSearchParams
        try {
          const formData = new URLSearchParams();
          Object.keys(payload).forEach(key => formData.append(key, payload[key]));

          await fetch(targetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
          });
          submittedSuccessfully = true;
        } catch (tier2Err) {
          console.warn('Direct Apps Script fetch notice', tier2Err);
        }
      }
    }

    setIsSubmitting(false);

    if (submittedSuccessfully) {
      setSubmitStatus('success');
      setStatusMessage('Thank you for your feedback! Your feedback has been submitted successfully.');
      resetForm();
    } else {
      setSubmitStatus('error');
      setStatusMessage('Unable to submit feedback. Please check your internet connection and try again.');
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setRating(0);
    setHoverRating(0);
    setFeedbackType('');
    setMessage('');
    setErrors({});
  };

  const handleApplyPreset = (preset) => {
    setRating(preset.rating);
    setFeedbackType(preset.type);
    setMessage(preset.text);
    setErrors({});
  };

  const getStarLabel = (star) => {
    switch (star) {
      case 1: return 'Poor 😞';
      case 2: return 'Fair 😐';
      case 3: return 'Good 🙂';
      case 4: return 'Very Good 😊';
      case 5: return 'Excellent! 🔥';
      default: return 'Select Rating';
    }
  };

  return (
    <div className="fb-root-container">
      {/* Ambient Background Glows */}
      <div className="fb-bg-glow fb-glow-1"></div>
      <div className="fb-bg-glow fb-glow-2"></div>

      <motion.div 
        className="fb-content-wrapper"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {/* Header Section */}
        <div className="fb-header-card">
          <div className="fb-badge-pill">
            <Sparkles size={14} className="fb-badge-sparkle" />
            <span>WE VALUE YOUR INPUT</span>
          </div>

          <h1 className="fb-title">Share Your Feedback</h1>
          <p className="fb-subtitle">
            Help us make <strong>ResultAI</strong> better! Tell us what you love, report bugs, or suggest features.
          </p>

          {/* Quick Reaction Chips */}
          <div className="fb-preset-chips-wrap">
            <span className="fb-preset-label">Quick Presets:</span>
            {PRESET_TAGS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                className="fb-preset-chip"
                onClick={() => handleApplyPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* ❤️ Like ResultAI Interactive Card Section */}
        <div className="fb-like-card">
          <div className="fb-like-left">
            <div className={`fb-like-heart-wrapper ${hasLiked ? 'liked' : ''}`}>
              <Heart 
                size={30} 
                className={`fb-like-heart-icon ${hasLiked ? 'liked' : ''}`} 
                fill={hasLiked ? '#EF4444' : 'none'} 
              />
            </div>
            <div className="fb-like-text">
              <div className="fb-like-title-row">
                <h3>Enjoying ResultAI?</h3>
                <span className="fb-like-badge">Public App Rating</span>
              </div>
              <p>Show some love and help us make academic result extraction even better!</p>
            </div>
          </div>

          <div className="fb-like-right">
            <div className="fb-like-counter-box">
              <span className="fb-like-counter-val">{totalLikes.toLocaleString()}</span>
              <span className="fb-like-counter-lbl">Total Likes ❤️</span>
            </div>

            <button
              type="button"
              className={`fb-like-btn ${hasLiked ? 'liked' : ''}`}
              onClick={handleLike}
              disabled={isLiking}
            >
              <Heart 
                size={18} 
                fill={hasLiked ? '#FFFFFF' : 'none'} 
                className={hasLiked ? 'heart-pulse' : ''} 
              />
              <span>{hasLiked ? 'Liked! ❤️' : 'Like ResultAI'}</span>
            </button>
          </div>

          <AnimatePresence>
            {likeToast && (
              <motion.div 
                className="fb-like-toast"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
              >
                {likeToast}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status Notification Banner */}
        <AnimatePresence mode="wait">
          {submitStatus && (
            <motion.div 
              key={submitStatus}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className={`fb-status-banner ${submitStatus}`}
            >
              <div className="fb-status-icon-wrap">
                {submitStatus === 'success' ? (
                  <CheckCircle2 className="fb-status-icon success" size={22} />
                ) : (
                  <AlertCircle className="fb-status-icon error" size={22} />
                )}
              </div>
              <div className="fb-status-text">
                <strong>
                  {submitStatus === 'success' ? '✅ Thank you for your feedback!' : '❌ Submission Error'}
                </strong>
                <p>{statusMessage}</p>
              </div>
              <button 
                type="button" 
                className="fb-status-dismiss"
                onClick={() => setSubmitStatus(null)}
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Feedback Form Card */}
        <div className="fb-form-card">
          <form onSubmit={handleSubmit} noValidate>
            
            {/* Rating Field */}
            <div className="fb-field-group">
              <label className="fb-label">
                <span>Rating</span>
                <span className="fb-required-asterisk">*</span>
              </label>

              <div className="fb-rating-wrapper">
                <div className="fb-stars-row" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (hoverRating || rating);
                    return (
                      <button
                        key={star}
                        type="button"
                        className={`fb-star-btn ${active ? 'active' : ''}`}
                        onClick={() => {
                          setRating(star);
                          if (errors.rating) setErrors((prev) => ({ ...prev, rating: null }));
                        }}
                        onMouseEnter={() => setHoverRating(star)}
                        aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                      >
                        <Star 
                          size={28} 
                          className={`fb-star-icon ${active ? 'filled' : ''}`} 
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="fb-rating-caption">
                  {getStarLabel(hoverRating || rating)}
                </span>
              </div>
              {errors.rating && <p className="fb-field-error">{errors.rating}</p>}
            </div>

            {/* Feedback Category Selection */}
            <div className="fb-field-group">
              <label className="fb-label" htmlFor="feedback-type-select">
                <Tag size={15} />
                <span>Feedback Category</span>
                <span className="fb-required-asterisk">*</span>
              </label>

              <div className="fb-select-wrapper" style={{ position: 'relative', width: '100%' }}>
                <select
                  id="feedback-type-select"
                  className={`fb-input ${errors.feedbackType ? 'has-error' : ''}`}
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    backgroundImage: 'none',
                    paddingRight: '40px',
                    cursor: 'pointer'
                  }}
                  value={feedbackType}
                  onChange={(e) => {
                    setFeedbackType(e.target.value);
                    if (errors.feedbackType) setErrors((prev) => ({ ...prev, feedbackType: null }));
                  }}
                >
                  <option value="" disabled>-- Select Category --</option>
                  {FEEDBACK_TYPES.map((type) => (
                    <option key={type.id} value={type.id} style={{ background: 'var(--card-bg, #111827)', color: 'var(--title-color, #FFFFFF)' }}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <ChevronDown 
                  size={16} 
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--text-muted)'
                  }}
                />
              </div>
              {errors.feedbackType && <p className="fb-field-error">{errors.feedbackType}</p>}
            </div>

            {/* Message Field */}
            <div className="fb-field-group">
              <div className="fb-label-row">
                <label className="fb-label" htmlFor="feedback-message">
                  <MessageSquare size={15} />
                  <span>Your Message</span>
                  <span className="fb-required-asterisk">*</span>
                </label>

                <span className={`fb-char-counter ${message.length >= MAX_MESSAGE_LENGTH ? 'limit-reached' : ''}`}>
                  {message.length} / {MAX_MESSAGE_LENGTH}
                </span>
              </div>

              <textarea
                id="feedback-message"
                className={`fb-input fb-textarea ${errors.message ? 'has-error' : ''}`}
                rows={5}
                placeholder="Tell us what's on your mind... What worked well? What can we improve?"
                value={message}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errors.message) setErrors((prev) => ({ ...prev, message: null }));
                }}
              />
              {errors.message && <p className="fb-field-error">{errors.message}</p>}
            </div>

            {/* Optional Name & Email Inputs (2 Column Layout) */}
            <div className="fb-grid-2col">
              {/* Name */}
              <div className="fb-field-group">
                <label className="fb-label" htmlFor="feedback-name">
                  <User size={15} />
                  <span>Name</span>
                  <span className="fb-optional-tag">(Optional)</span>
                </label>
                <input
                  id="feedback-name"
                  type="text"
                  className="fb-input"
                  placeholder="e.g. Alex Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Email */}
              <div className="fb-field-group">
                <label className="fb-label" htmlFor="feedback-email">
                  <Mail size={15} />
                  <span>Email</span>
                  <span className="fb-optional-tag">(Optional)</span>
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  className={`fb-input ${errors.email ? 'has-error' : ''}`}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                  }}
                />
                {errors.email && <p className="fb-field-error">{errors.email}</p>}
              </div>
            </div>

            {/* Submission Button */}
            <div className="fb-submit-row">
              <button
                type="submit"
                className="fb-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={18} className="fb-spin-icon" />
                    <span>Submitting Feedback...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </motion.div>
    </div>
  );
}
