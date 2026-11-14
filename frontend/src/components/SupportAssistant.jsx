import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, API_BASE } from '../context/AuthContext';

const STORAGE_KEY = 'resultai_support_chats_v1';

function getFormattedTimestamp(dateObj = new Date()) {
  try {
    return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function createNewChatObject(initialTitle = 'New Conversation') {
  const timestamp = getFormattedTimestamp();
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: initialTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        role: 'assistant',
        content:
          '👋 **Hello! I am your ResultAI Support Assistant.**\n\nI can help you with roll range configurations, CAPTCHA OCR issues, resuming partial extraction jobs, data validation warnings, and resolving error codes.\n\nHow can I help you today?',
        source: 'system',
        timestamp: timestamp
      }
    ]
  };
}

// Simple Markdown & Code Block Renderer with high-contrast text styling
function FormattedMessage({ text }) {
  if (!text) return null;

  const rawParts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', lineHeight: '1.55', color: '#F1F5F9', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
      {rawParts.map((part, pIdx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          const codeContent = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <pre
              key={pIdx}
              style={{
                margin: '6px 0',
                padding: '10px 12px',
                background: 'rgba(2, 6, 23, 0.85)',
                border: '1px solid rgba(129, 140, 248, 0.35)',
                borderRadius: '8px',
                color: '#C7D2FE',
                fontFamily: 'monospace',
                fontSize: '11.5px',
                lineHeight: '1.45',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}
            >
              <code>{codeContent}</code>
            </pre>
          );
        }

        const lines = part.split('\n');

        return (
          <React.Fragment key={pIdx}>
            {lines.map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={idx} style={{ height: '4px' }} />;

              // Headers
              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={idx} style={{ margin: '8px 0 3px 0', fontSize: '13.5px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '0.01em' }}>
                    {trimmed.replace('### ', '')}
                  </h4>
                );
              }

              // Bullet points
              if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                const content = trimmed.replace(/^[-•]\s*/, '');
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px', margin: '2px 0' }}>
                    <span style={{ color: '#818CF8', fontWeight: '800', fontSize: '14px', lineHeight: '1.4' }}>•</span>
                    <div style={{ flex: 1, color: '#F1F5F9' }}>{renderInlineFormatting(content)}</div>
                  </div>
                );
              }

              // Numbered lists
              const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
              if (numMatch) {
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px', margin: '2px 0' }}>
                    <span style={{ color: '#818CF8', fontWeight: '800', fontSize: '12px', lineHeight: '1.5', minWidth: '16px' }}>{numMatch[1]}.</span>
                    <div style={{ flex: 1, color: '#F1F5F9' }}>{renderInlineFormatting(numMatch[2])}</div>
                  </div>
                );
              }

              return <div key={idx} style={{ color: '#F1F5F9' }}>{renderInlineFormatting(line)}</div>;
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Helper to format **bold** and `code` spans
function renderInlineFormatting(text) {
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    const codeMatch = remaining.match(/`(.*?)`/);

    if (boldMatch && (!codeMatch || boldMatch.index < codeMatch.index)) {
      const before = remaining.substring(0, boldMatch.index);
      if (before) parts.push(<span key={keyIdx++} style={{ color: '#F1F5F9' }}>{before}</span>);
      parts.push(
        <strong key={keyIdx++} style={{ color: '#FFFFFF', fontWeight: '800' }}>
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
    } else if (codeMatch) {
      const before = remaining.substring(0, codeMatch.index);
      if (before) parts.push(<span key={keyIdx++} style={{ color: '#F1F5F9' }}>{before}</span>);
      parts.push(
        <code
          key={keyIdx++}
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            color: '#C7D2FE',
            padding: '2px 6px',
            borderRadius: '5px',
            fontFamily: 'monospace',
            fontSize: '11.5px',
            border: '1px solid rgba(129, 140, 248, 0.35)',
            fontWeight: '600',
            wordBreak: 'break-all'
          }}
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.substring(codeMatch.index + codeMatch[0].length);
    } else {
      parts.push(<span key={keyIdx++} style={{ color: '#F1F5F9' }}>{remaining}</span>);
      break;
    }
  }

  return parts;
}

// Real-Time Scraping Progress Card for Chatbot Stream
function LiveScrapingCard({ message, currentJobState, onStopJob }) {
  const { authFetch, isAuthenticated } = useAuth();
  const [fetchedData, setFetchedData] = useState(null);
  const [tick, setTick] = useState(0);

  const banner = message?.live_job_banner || message?.job_info || {};
  const targetJobId = message?.job_id || banner?.job_id || 'JOB-1787111890';

  // Match live active job from WebSocket / Polling
  const isMatchingJob = currentJobState && (
    currentJobState.job_id === targetJobId ||
    (currentJobState.status !== 'idle' && currentJobState.total > 0)
  );

  const activeJob = fetchedData || (isMatchingJob ? currentJobState : null);
  const jobData = {
    ...banner,
    ...(activeJob || {})
  };

  const jobId = jobData.job_id || targetJobId;
  const rawStatus = (jobData.status || 'idle').toLowerCase();

  const isRunning = rawStatus === 'running' || rawStatus === 'resumed' || rawStatus === 'starting';
  const isPaused = rawStatus === 'paused';
  const isCompleted = rawStatus === 'completed';
  const isFailed = rawStatus === 'failed';
  const isCancelled = rawStatus === 'cancelled';

  // 1-second interval ticker & status polling while active
  useEffect(() => {
    if (isCompleted || isFailed || isCancelled) return;

    const timer = setInterval(() => {
      setTick((t) => t + 1);

      const fetchFn = (isAuthenticated && authFetch) ? authFetch : fetch;
      fetchFn(`${API_BASE}/scrape/status`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.status) {
            setFetchedData(data);
          }
        })
        .catch(() => {});
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, isPaused, isCompleted, isFailed, isCancelled, isAuthenticated, authFetch]);

  // Overall status label
  const statusLabel = isRunning
    ? 'Running'
    : isPaused
    ? 'Paused'
    : isCompleted
    ? 'Completed'
    : isFailed
    ? 'Failed'
    : isCancelled
    ? 'Cancelled'
    : 'Running';

  const processed = jobData?.processed ?? 0;
  const total = jobData?.total ?? 0;
  const passCount = jobData?.pass_count ?? 0;
  const failCount = jobData?.fail_count ?? 0;
  const extracted = passCount + failCount;
  const remaining = Math.max(0, total - processed);

  const pctNum = total > 0 ? Math.min(100, Math.max(0, (processed / total) * 100)) : 0;
  const pctStr = pctNum.toFixed(1);

  // Dynamic Speed and ETA
  let speedStr = 'Calculating...';
  let etaStr = 'Calculating...';

  const startTime = jobData?.start_time;
  if (startTime && processed > 0 && (isRunning || isPaused)) {
    const elapsedSec = Math.max(1, (Date.now() / 1000) - startTime);
    const speedPerMin = (processed / elapsedSec) * 60;
    speedStr = `${speedPerMin.toFixed(1)} students/min`;

    if (remaining > 0 && speedPerMin > 0) {
      const etaSec = Math.round((remaining / speedPerMin) * 60);
      if (etaSec < 60) {
        etaStr = `~${etaSec} sec`;
      } else {
        const mins = Math.floor(etaSec / 60);
        const secs = etaSec % 60;
        etaStr = `~${mins}m ${secs}s`;
      }
    } else if (remaining === 0) {
      etaStr = 'Done';
    }
  } else if (isCompleted) {
    speedStr = 'Done';
    etaStr = 'Done';
  }

  // Duration calculation - FREEZE when job is completed / failed / cancelled
  let durationStr = '00:00';
  if (startTime) {
    let durSec = 0;
    if (jobData.processing_time_seconds !== undefined && jobData.processing_time_seconds !== null) {
      durSec = jobData.processing_time_seconds;
    } else if (jobData.end_time) {
      durSec = Math.max(0, Math.floor(jobData.end_time - startTime));
    } else if (isCompleted || isFailed || isCancelled) {
      if (!message._frozen_duration) {
        message._frozen_duration = Math.max(0, Math.floor((Date.now() / 1000) - startTime));
      }
      durSec = message._frozen_duration;
    } else {
      durSec = Math.max(0, Math.floor((Date.now() / 1000) - startTime));
    }

    const mins = String(Math.floor(durSec / 60)).padStart(2, '0');
    const secs = String(durSec % 60).padStart(2, '0');
    durationStr = `${mins}:${secs}`;
  }

  // CAPTCHA Mode
  const captchaMode = jobData?.captcha_mode === 'manual' ? 'Manual' : 'Auto';

  // Current enrollment
  const rawRoll = jobData?.current_enrollment || banner?.current_enrollment || '';
  const currentRoll = (rawRoll && String(rawRoll).trim()) ? String(rawRoll).trim() : 'N/A';

  // Excel Path
  const excelPath = jobData?.excel_file_path || banner?.excel_file_path;

  // Block progress bar string
  const totalBlocks = 18;
  const filledBlocks = Math.round((pctNum / 100) * totalBlocks);
  const blockString = '█'.repeat(Math.min(totalBlocks, filledBlocks)) + '░'.repeat(Math.max(0, totalBlocks - filledBlocks));

  return (
    <div
      className="chatbot-live-progress-card"
      style={{
        width: '100%',
        maxWidth: '100%',
        margin: '6px 0',
        padding: '14px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.98) 100%)',
        border: isCompleted
          ? '1.5px solid rgba(34, 197, 94, 0.6)'
          : (isFailed || isCancelled)
          ? '1.5px solid rgba(239, 68, 68, 0.6)'
          : '1.5px solid rgba(99, 102, 241, 0.6)',
        boxShadow: isCompleted
          ? '0 6px 20px rgba(34, 197, 94, 0.25)'
          : (isFailed || isCancelled)
          ? '0 6px 20px rgba(239, 68, 68, 0.25)'
          : '0 6px 20px rgba(99, 102, 241, 0.3)',
        color: '#FFFFFF',
        fontFamily: 'inherit',
        boxSizing: 'border-box'
      }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '8px', marginBottom: '10px', flexWrap: 'wrap', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '16px' }}>
            {isCompleted ? '✅' : (isFailed ? '❌' : (isCancelled ? '⏹️' : (isPaused ? '⏸️' : '🚀')))}
          </span>
          <span style={{ fontWeight: '850', fontSize: '13.5px', color: '#FFFFFF', letterSpacing: '0.01em' }}>
            {isCompleted ? 'Scraping Completed' : (isFailed ? 'Scraping Failed' : (isCancelled ? 'Scraping Cancelled' : (isPaused ? 'Scraping Paused' : 'Scraping in Progress')))}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'rgba(203, 213, 225, 0.75)', fontFamily: 'monospace', fontWeight: '700' }}>
          Job ID: {jobId}
        </span>
      </div>

      {/* BODY DEPENDING ON STATUS */}
      {isCompleted ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: '800', fontSize: '13px', color: '#4ADE80' }}>
            {total} / {total} Students Processed
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '6px 12px', fontSize: '12px', color: '#CBD5E1', padding: '4px 0' }}>
            <div>Extracted: <strong style={{ color: '#FFFFFF' }}>{extracted}</strong></div>
            <div>Passed: <strong style={{ color: '#4ADE80' }}>{passCount}</strong></div>
            <div>Failed: <strong style={{ color: '#F87171' }}>{failCount}</strong></div>
            <div>Duration: <strong style={{ color: '#38BDF8', fontFamily: 'monospace' }}>{durationStr}</strong></div>
          </div>

          {excelPath && (
            <div style={{ marginTop: '6px' }}>
              <a
                href={`${API_BASE}/scrape/download?path=${encodeURIComponent(excelPath)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  width: '100%',
                  justifyContent: 'center',
                  padding: '9px 14px',
                  borderRadius: '9px',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  fontWeight: '800',
                  fontSize: '12px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                📥 Download Excel
              </a>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* PROGRESS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '12px' }}>
              <span style={{ fontWeight: '750', color: '#E2E8F0' }}>Progress:</span>
              <span style={{ fontWeight: '800', color: '#38BDF8' }}>{processed} / {total} Students Processed</span>
            </div>

            {/* VISUAL PROGRESS BAR WITH BLOCK TEXT */}
            <div style={{ position: 'relative', width: '100%', height: '24px', borderRadius: '7px', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255,255,255,0.18)', overflow: 'hidden', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${pctNum}%`,
                  background: isPaused
                    ? 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)'
                    : (isFailed || isCancelled)
                    ? 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
                    : 'linear-gradient(90deg, #6366F1 0%, #38BDF8 100%)',
                  transition: 'width 0.3s ease',
                  opacity: 0.85
                }}
              />
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', width: '100%', fontFamily: 'monospace', fontSize: '11px', fontWeight: '800', color: '#FFFFFF', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                <span style={{ letterSpacing: '1px' }}>{blockString}</span>
                <span>{pctStr}%</span>
              </div>
            </div>
          </div>

          {/* CURRENT STATS LIST */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', borderRadius: '9px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontWeight: '800', fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Current:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '12px', color: '#F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#818CF8' }}>•</span>
                <span>Processing Roll: <strong style={{ color: '#60A5FA', fontFamily: 'monospace' }}>{currentRoll}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#818CF8' }}>•</span>
                <span>Extracted: <strong style={{ color: '#FFFFFF' }}>{extracted}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#818CF8' }}>•</span>
                <span>Passed: <strong style={{ color: '#4ADE80' }}>{passCount}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#818CF8' }}>•</span>
                <span>Failed: <strong style={{ color: '#F87171' }}>{failCount}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#818CF8' }}>•</span>
                <span>Remaining: <strong style={{ color: '#FBBF24' }}>{remaining}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#818CF8' }}>•</span>
                <span>Speed: <strong style={{ color: '#38BDF8' }}>{speedStr}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#818CF8' }}>•</span>
                <span>ETA: <strong style={{ color: '#A78BFA' }}>{etaStr}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#818CF8' }}>•</span>
                <span>CAPTCHA Mode: <strong style={{ color: captchaMode === 'Manual' ? '#F59E0B' : '#4ADE80' }}>{captchaMode === 'Manual' ? 'Manual' : 'Auto'}</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#818CF8' }}>•</span>
                <span>Status: <strong style={{ color: isRunning ? '#4ADE80' : (isPaused ? '#F59E0B' : '#F87171') }}>{statusLabel}</strong></span>
              </div>
            </div>

            {(!isCompleted && !isFailed && !isCancelled) && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setFetchedData(prev => ({ ...(prev || {}), status: 'cancelled' }));
                  try {
                    const activeToken = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
                    const headers = activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {};
                    await fetch(`${API_BASE}/scrape/cancel`, { method: 'POST', headers });
                  } catch (err) {
                    console.error("Error stopping scrape:", err);
                  }
                  if (onStopJob) {
                    onStopJob();
                  }
                }}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  padding: '8.5px 12px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  color: '#FFFFFF',
                  fontWeight: '800',
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                ⏹️ Stop Scraping
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupportAssistant({ jobState }) {
  const { authFetch, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showConfirmClearModal, setShowConfirmClearModal] = useState(false);

  // Persistent Chats State
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to load chat history from localStorage", e);
    }
    return [createNewChatObject('Welcome Chat')];
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    return conversations[0]?.id || null;
  });

  // Search & Edit states inside drawer
  const [searchHistoryQuery, setSearchHistoryQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingTitleInput, setEditingTitleInput] = useState('');

  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState([
    '⚡ Live status and speed',
    '📊 Kitne jobs complete hai?',
    '👥 Total students count',
    '🚀 BTech IT 3 sem 1 se 50 tak nikal do',
    '📜 View Scraping History',
    '❓ Assistant capabilities'
  ]);
  const [unreadBadge, setUnreadBadge] = useState(false);

  const messagesEndRef = useRef(null);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.error("Failed to save chat history to localStorage", e);
    }
  }, [conversations]);

  // Current Active Conversation
  const activeConversation = conversations.find((c) => c.id === activeChatId) || conversations[0];
  const messages = activeConversation?.messages || [];

  // Auto-scroll to bottom of chat window
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setUnreadBadge(false);
    }
  }, [messages, isOpen]);

  const [liveJobState, setLiveJobState] = useState(jobState || null);

  useEffect(() => {
    if (jobState) {
      setLiveJobState(jobState);
    }
  }, [jobState]);

  // Fetch FAQ quick prompts on load
  useEffect(() => {
    const fetchFn = (isAuthenticated && authFetch) ? authFetch : fetch;
    fetchFn(`${API_BASE}/support/faq`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.quick_prompts) {
          setQuickPrompts(data.quick_prompts);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, authFetch]);

  // Fetch job status if opened
  useEffect(() => {
    if (isOpen) {
      const fetchFn = (isAuthenticated && authFetch) ? authFetch : fetch;
      fetchFn(`${API_BASE}/scrape/status`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data) setLiveJobState(data); })
        .catch(() => {});
    }
  }, [isOpen, isAuthenticated, authFetch]);

  // Highlight badge when scrape fails or completes
  useEffect(() => {
    const activeState = liveJobState || jobState;
    if (activeState?.status === 'failed' || activeState?.status === 'completed') {
      if (!isOpen) setUnreadBadge(true);
    }
  }, [liveJobState?.status, jobState?.status, isOpen]);

  // Do not render chatbot component on unauthenticated views/routes
  if (!isAuthenticated) {
    return null;
  }

  const handleStartNewChat = () => {
    const newChat = createNewChatObject(`Chat ${conversations.length + 1}`);
    setConversations((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setShowDrawer(false);
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isTyping) return;

    const userTimestamp = getFormattedTimestamp();
    const userMsg = { role: 'user', content: query, timestamp: userTimestamp };
    const updatedMessages = [...messages, userMsg];

    // Determine auto-generated title if this is the first user message in a new/default chat
    let newTitle = activeConversation?.title || 'Conversation';
    if (
      (!activeConversation?.messages || activeConversation.messages.length <= 1) &&
      (newTitle.startsWith('New Conversation') || newTitle.startsWith('Chat ') || newTitle === 'Welcome Chat')
    ) {
      newTitle = query.length > 28 ? query.substring(0, 28) + '...' : query;
    }

    // Update conversation state locally first
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? { ...c, title: newTitle, updatedAt: Date.now(), messages: updatedMessages }
          : c
      )
    );

    setInputQuery('');
    setIsTyping(true);

    try {
      const activeState = liveJobState || jobState;
      const fetchFn = (isAuthenticated && authFetch) ? authFetch : fetch;
      const response = await fetchFn(`${API_BASE}/support/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role || 'user', content: m.content || '' })),
          user_query: query,
          client_context: activeState ? { status: activeState.status, total: activeState.total } : null
        })
      });

      if (!response.ok) {
        throw new Error('Support API returned error status');
      }

      const data = await response.json();
      const assistantTimestamp = getFormattedTimestamp();
      const assistantMsg = {
        role: 'assistant',
        content: data.reply,
        source: data.source,
        suggested_actions: data.suggested_actions,
        live_job_banner: data.live_job_banner,
        job_id: data.job_id || data.live_job_banner?.job_id,
        is_job_card: data.is_job_card || data.intent === 'START_EXTRACTION' || data.intent === 'LIVE_STATUS',
        timestamp: assistantTimestamp
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, updatedAt: Date.now(), messages: [...c.messages, assistantMsg] }
            : c
        )
      );
    } catch (err) {
      const assistantTimestamp = getFormattedTimestamp();
      const fallbackMsg = {
        role: 'assistant',
        content:
          '⚠️ **Offline Support Response**\n\nI encountered a connection issue reaching the backend assistant service. Here are quick troubleshooting steps:\n\n1. Check if the ResultAI backend server (`server.py`) is running.\n2. Ensure your backend endpoint `/api/support/chat` is accessible.\n3. If you have an active scrape job, hit **Reset Session** on the dashboard if stuck.',
        source: 'offline_fallback',
        suggested_actions: ['⚡ Check Scrape Status', '⚠️ Fix Common Errors'],
        timestamp: assistantTimestamp
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? { ...c, updatedAt: Date.now(), messages: [...c.messages, fallbackMsg] }
            : c
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteConversation = (e, chatId) => {
    e.stopPropagation();
    const filtered = conversations.filter((c) => c.id !== chatId);
    setConversations(filtered);
    if (activeChatId === chatId) {
      if (filtered.length > 0) {
        setActiveChatId(filtered[0].id);
      } else {
        const newChat = createNewChatObject('New Chat');
        setConversations([newChat]);
        setActiveChatId(newChat.id);
      }
    }
  };

  const handleStartRename = (e, chat) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingTitleInput(chat.title);
  };

  const handleSaveRename = (chatId) => {
    if (editingTitleInput.trim()) {
      setConversations((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title: editingTitleInput.trim() } : c))
      );
    }
    setEditingChatId(null);
  };

  const handleClearAllHistory = () => {
    const newChat = createNewChatObject('New Chat');
    setConversations([newChat]);
    setActiveChatId(newChat.id);
    setShowConfirmClearModal(false);
    setShowDrawer(false);
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchHistoryQuery.trim()) return true;
    const q = searchHistoryQuery.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  });

  const currentJobState = liveJobState || jobState;

  return (
    <>
      <style>{`
        .support-assistant-input-field::placeholder {
          color: rgba(241, 245, 249, 0.5) !important;
        }
        .support-assistant-chip-btn:hover {
          background: rgba(99, 102, 241, 0.38) !important;
          color: #FFFFFF !important;
          border-color: rgba(165, 180, 252, 0.6) !important;
        }
        .support-assistant-prompt-btn:hover {
          background: rgba(255, 255, 255, 0.16) !important;
          color: #FFFFFF !important;
          border-color: rgba(255, 255, 255, 0.35) !important;
        }
        .support-assistant-history-item:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }
        .support-assistant-aura-ring {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(124, 58, 237, 0.28) 0%, rgba(99, 102, 241, 0.1) 60%, transparent 80%);
          animation: botAuraPulse 3.5s ease-in-out infinite alternate;
          pointer-events: none;
          z-index: -1;
          transition: all 0.3s ease;
        }
        @keyframes botAuraPulse {
          0% { transform: scale(0.95); opacity: 0.25; }
          100% { transform: scale(1.1); opacity: 0.45; }
        }
        .support-assistant-fab-btn:hover {
          box-shadow: 0 8px 24px rgba(124, 58, 237, 0.38), 0 0 16px rgba(99, 102, 241, 0.3) !important;
          border-color: rgba(255, 255, 255, 0.6) !important;
        }
      `}</style>

      {/* FLOATING ACTION CHAT BUTTON (BOTTOM-RIGHT) */}
      <div style={{ position: 'fixed', bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', right: '20px', zIndex: 999999 }}>
        <div className="support-assistant-aura-ring" />
        <motion.button
          id="support-assistant-toggle-btn"
          whileHover={{ scale: 1.06, rotate: isOpen ? 90 : 3 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={() => setIsOpen(!isOpen)}
          className="support-assistant-fab-btn"
          style={{
            position: 'relative',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED 0%, #6366F1 50%, #4F46E5 100%)',
            border: '1.5px solid rgba(255, 255, 255, 0.35)',
            boxShadow: '0 6px 18px rgba(124, 58, 237, 0.28), 0 2px 8px rgba(0, 0, 0, 0.18)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            outline: 'none',
            transition: 'box-shadow 0.3s ease, border-color 0.3s ease'
          }}
          title="ResultAI Support Assistant"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close-icon"
                initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </motion.div>
            ) : (
              <motion.div
                key="bot-icon"
                initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Outer Sparkle Details */}
                  <path d="M26 4L26.8 5.6L28.4 6.4L26.8 7.2L26 8.8L25.2 7.2L23.6 6.4L25.2 5.6L26 4Z" fill="#F59E0B" />
                  <path d="M6 24L6.5 25L7.5 25.5L6.5 26L6 27L5.5 26L4.5 25.5L5.5 25L6 24Z" fill="#38BDF8" opacity="0.85" />
                  
                  {/* Antenna */}
                  <line x1="16" y1="3.5" x2="16" y2="8" stroke="#E0E7FF" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="16" cy="3" r="2" fill="#38BDF8" />
                  <circle cx="16" cy="3" r="3.5" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.6" />

                  {/* Robot Head Outer Body */}
                  <rect x="5" y="8" width="22" height="17" rx="6" fill="url(#ai-head-gradient)" stroke="#FFFFFF" strokeWidth="1.5" />
                  
                  {/* Side Ears / Headsets */}
                  <rect x="2.5" y="13.5" width="2.5" height="6" rx="1.25" fill="#818CF8" />
                  <rect x="27" y="13.5" width="2.5" height="6" rx="1.25" fill="#818CF8" />
                  
                  {/* Inner Face Screen */}
                  <rect x="8" y="11" width="16" height="11" rx="4" fill="#0F172A" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  
                  {/* AI Glowing Eyes */}
                  <circle cx="12" cy="15.5" r="2.2" fill="#38BDF8" />
                  <circle cx="20" cy="15.5" r="2.2" fill="#38BDF8" />
                  <circle cx="12.8" cy="14.8" r="0.8" fill="#FFFFFF" />
                  <circle cx="20.8" cy="14.8" r="0.8" fill="#FFFFFF" />

                  {/* Cute AI Smile / Voice Wave */}
                  <path d="M13 19C14 20.2 18 20.2 19 19" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />

                  <defs>
                    <linearGradient id="ai-head-gradient" x1="5" y1="8" x2="27" y2="25" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#6366F1" />
                      <stop offset="0.5" stopColor="#4F46E5" />
                      <stop offset="1" stopColor="#3730A3" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>
            )}
          </AnimatePresence>

          {/* UNREAD BADGE / LIVE JOB INDICATOR */}
          {unreadBadge && !isOpen && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#EF4444',
                border: '2px solid #0F172A',
                boxShadow: '0 0 8px #EF4444'
              }}
            />
          )}

          {/* ACTIVE SCRAPE GLOW DOT */}
          {currentJobState?.status === 'running' && !isOpen && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#22C55E',
                border: '2px solid #0F172A',
                boxShadow: '0 0 8px #22C55E',
                animation: 'pulse 1.2s infinite'
              }}
            />
          )}
        </motion.button>
      </div>

      {/* CHATBOT MODAL PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="support-assistant-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
              right: '20px',
              width: '410px',
              maxWidth: 'calc(100vw - 28px)',
              height: '610px',
              maxHeight: 'calc(100dvh - 120px)',
              borderRadius: '20px',
              background: '#0F172A',
              backgroundImage: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(99, 102, 241, 0.3)',
              zIndex: 999999,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              isolation: 'isolate'
            }}
          >
            {/* PANEL HEADER */}
            <div
              style={{
                padding: '14px 18px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.28) 0%, rgba(79, 70, 229, 0.18) 100%)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowDrawer(!showDrawer)}
                  title="Toggle Chat History"
                  style={{
                    background: showDrawer ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    width: '34px',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="18" x2="15" y2="18"></line>
                  </svg>
                </button>

                <div>
                  <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                    {activeConversation?.title || 'ResultAI Assistant'}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#22C55E',
                        boxShadow: '0 0 6px #22C55E'
                      }}
                    />
                    <span style={{ fontSize: '11px', color: 'rgba(241, 245, 249, 0.8)', fontWeight: '600' }}>
                      Persistent Chat Active
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS: NEW CHAT & CLOSE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  title="Start New Chat"
                  style={{
                    background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    padding: '6px 11px',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)'
                  }}
                >
                  + New
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* SLIDE-OUT HISTORY DRAWER / SIDEBAR */}
            <AnimatePresence>
              {showDrawer && (
                <motion.div
                  initial={{ x: '-100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '-100%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                  style={{
                    position: 'absolute',
                    top: '63px',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(15, 23, 42, 0.98)',
                    backdropFilter: 'blur(24px)',
                    zIndex: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '14px',
                    borderRight: '1px solid rgba(255, 255, 255, 0.12)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#FFFFFF' }}>📜 Chat History</h4>
                    <button
                      type="button"
                      onClick={() => setShowDrawer(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '16px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* SEARCH HISTORY INPUT */}
                  <input
                    type="text"
                    value={searchHistoryQuery}
                    onChange={(e) => setSearchHistoryQuery(e.target.value)}
                    placeholder="Search past conversations..."
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: '8px',
                      padding: '7px 11px',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      marginBottom: '12px',
                      outline: 'none'
                    }}
                  />

                  {/* CONVERSATION LIST */}
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {filteredConversations.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 10px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
                        No matching conversations found.
                      </div>
                    ) : (
                      filteredConversations.map((chat) => {
                        const isActive = chat.id === activeChatId;
                        const isEditing = editingChatId === chat.id;

                        return (
                          <div
                            key={chat.id}
                            className="support-assistant-history-item"
                            onClick={() => {
                              setActiveChatId(chat.id);
                              setShowDrawer(false);
                            }}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '10px',
                              background: isActive ? 'rgba(99, 102, 241, 0.28)' : 'rgba(255, 255, 255, 0.04)',
                              border: isActive ? '1px solid rgba(129, 140, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingTitleInput}
                                  onChange={(e) => setEditingTitleInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename(chat.id);
                                  }}
                                  onBlur={() => handleSaveRename(chat.id)}
                                  autoFocus
                                  style={{
                                    width: '100%',
                                    background: '#0F172A',
                                    border: '1px solid #818CF8',
                                    borderRadius: '4px',
                                    color: '#FFFFFF',
                                    padding: '2px 6px',
                                    fontSize: '12px'
                                  }}
                                />
                              ) : (
                                <div style={{ fontSize: '12.5px', fontWeight: '750', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {chat.title}
                                </div>
                              )}
                              <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                                {chat.messages.length} messages • {getFormattedTimestamp(new Date(chat.updatedAt))}
                              </div>
                            </div>

                            {/* ACTION BUTTONS (RENAME / DELETE) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={(e) => handleStartRename(e, chat)}
                                title="Rename Chat"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'rgba(255, 255, 255, 0.6)',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  padding: '2px'
                                }}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteConversation(e, chat.id)}
                                title="Delete Chat"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'rgba(239, 68, 68, 0.8)',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  padding: '2px'
                                }}
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* DRAWER FOOTER */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '10px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setShowConfirmClearModal(true)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#EF4444',
                        fontSize: '11.5px',
                        fontWeight: '750',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Clear All Chat History
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CONFIRMATION MODAL DIALOG */}
            <AnimatePresence>
              {showConfirmClearModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    style={{
                      background: '#1E293B',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '16px',
                      padding: '20px',
                      textAlign: 'center',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}
                  >
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</div>
                    <h4 style={{ margin: '0 0 6px 0', color: '#FFFFFF', fontSize: '15px', fontWeight: '800' }}>Clear All Chat History?</h4>
                    <p style={{ fontSize: '12px', color: 'rgba(241, 245, 249, 0.7)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                      This action will delete all saved conversations from local storage. It cannot be undone.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setShowConfirmClearModal(false)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllHistory}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: '#EF4444',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        Yes, Delete All
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* LIVE SCRAPE STATUS BANNER (REAL-TIME STREAMING FROM SINGLE SOURCE OF TRUTH) */}
            {currentJobState && currentJobState.status !== 'idle' && (
              <div
                style={{
                  padding: '10px 14px',
                  background:
                    currentJobState.status === 'running' || currentJobState.status === 'resumed'
                      ? 'rgba(34, 197, 94, 0.16)'
                      : currentJobState.status === 'completed'
                      ? 'rgba(99, 102, 241, 0.18)'
                      : 'rgba(239, 68, 68, 0.16)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '11.5px',
                  color: '#FFFFFF'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background:
                          currentJobState.status === 'running' || currentJobState.status === 'resumed'
                            ? '#22C55E'
                            : currentJobState.status === 'completed'
                            ? '#6366F1'
                            : '#EF4444',
                        boxShadow: '0 0 8px currentColor',
                        animation: (currentJobState.status === 'running' || currentJobState.status === 'resumed') ? 'pulse 1.2s infinite' : 'none'
                      }}
                    />
                    <span style={{ fontWeight: '800' }}>
                      Job {currentJobState.status.toUpperCase()} ({Math.round((currentJobState.processed / (currentJobState.total || 1)) * 100)}%)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: currentJobState.captcha_mode === 'manual' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(34, 197, 94, 0.2)',
                      color: currentJobState.captcha_mode === 'manual' ? '#F59E0B' : '#22C55E',
                      fontWeight: '750',
                      border: currentJobState.captcha_mode === 'manual' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)'
                    }}>
                      {currentJobState.captcha_mode === 'manual' ? '🟡 Manual CAPTCHA' : '🟢 OCR Active'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleSendMessage('⚡ What is the status of my live scrape?')}
                      style={{
                        background: 'rgba(255, 255, 255, 0.18)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '5px',
                        color: '#FFFFFF',
                        fontSize: '10.5px',
                        fontWeight: '750',
                        padding: '2px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      Inspect
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Enrollment Details */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(241, 245, 249, 0.85)' }}>
                  <span>
                    {currentJobState.current_enrollment ? `Current: ${currentJobState.current_enrollment}` : `Processed: ${currentJobState.processed}/${currentJobState.total}`}
                  </span>
                  <span>
                    ✅ {currentJobState.pass_count || 0} Passed | ❌ {currentJobState.fail_count || 0} Failed
                  </span>
                </div>

                {/* Progress track */}
                <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, Math.round((currentJobState.processed / (currentJobState.total || 1)) * 100))}%`,
                    height: '100%',
                    background: currentJobState.status === 'completed' ? '#6366F1' : '#22C55E',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                {/* Excel Download button (ONLY IF COMPLETED AND FILE EXISTS) */}
                {currentJobState.status === 'completed' && currentJobState.excel_file_path && (
                  <div style={{ marginTop: '2px', display: 'flex', justifyContent: 'flex-end' }}>
                    <a
                      href={`${API_BASE}/scrape/download?path=${encodeURIComponent(currentJobState.excel_file_path)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: '800',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 6px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      📥 Download Output Excel
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* CHAT MESSAGES BODY */}
            <div
              style={{
                flex: 1,
                padding: '14px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                background: 'transparent'
              }}
            >
              {messages.length === 0 ? (
                /* EMPTY STATE CARD */
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '20px'
                  }}
                >
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '16px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(129, 140, 248, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      marginBottom: '12px',
                      color: '#818CF8'
                    }}
                  >
                    ✨
                  </div>
                  <h4 style={{ margin: '0 0 6px 0', color: '#FFFFFF', fontSize: '15px', fontWeight: '800' }}>
                    Start New Conversation
                  </h4>
                  <p style={{ margin: 0, color: 'rgba(241, 245, 249, 0.6)', fontSize: '12.5px', lineHeight: 1.5, maxWidth: '260px' }}>
                    Ask anything about RGPV result extraction, CAPTCHA OCR, Excel export, or error troubleshooting.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartNewChat}
                    style={{
                      marginTop: '16px',
                      padding: '8px 18px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontWeight: '800',
                      fontSize: '12.5px',
                      cursor: 'pointer'
                    }}
                  >
                    + Start New Chat
                  </button>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '88%',
                        padding: '11px 15px',
                        borderRadius: msg.role === 'user' ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                        background:
                          msg.role === 'user'
                            ? 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)'
                            : 'rgba(30, 41, 59, 0.95)',
                        border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.16)',
                        color: '#FFFFFF',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {msg.is_job_card ? (
                        <>
                          <FormattedMessage text={msg.content} />
                          <LiveScrapingCard message={msg} currentJobState={currentJobState} onStopJob={() => handleSendMessage("stop scrape")} />
                        </>
                      ) : (
                        <FormattedMessage text={msg.content} />
                      )}

                      {/* TIMESTAMP & SOURCE TAG */}
                      <div
                        style={{
                          marginTop: '6px',
                          paddingTop: '4px',
                          borderTop: msg.role === 'assistant' && msg.source ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                          fontSize: '10px',
                          color: 'rgba(203, 213, 225, 0.6)',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px'
                        }}
                      >
                        {msg.role === 'assistant' && msg.source && msg.source !== 'system' && (
                          <span>{msg.source === 'ai' ? '⚡ AI Response' : '💡 ResultAI Engine'}</span>
                        )}
                        <span style={{ marginLeft: 'auto' }}>{msg.timestamp || getFormattedTimestamp()}</span>
                      </div>
                    </div>

                    {/* SUGGESTED FOLLOW-UP ACTION CHIPS */}
                    {msg.role === 'assistant' && msg.suggested_actions && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {msg.suggested_actions.map((act, aIdx) => (
                          <button
                            key={aIdx}
                            type="button"
                            className="support-assistant-chip-btn"
                            onClick={() => handleSendMessage(act)}
                            style={{
                              background: 'rgba(99, 102, 241, 0.22)',
                              border: '1px solid rgba(129, 140, 248, 0.45)',
                              borderRadius: '12px',
                              color: '#E0E7FF',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              padding: '4px 10px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            {act}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))
              )}

              {/* TYPING INDICATOR */}
              {isTyping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}>
                  <div
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#818CF8',
                      animation: 'pulse 0.8s infinite'
                    }}
                  />
                  <div
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#818CF8',
                      animation: 'pulse 0.8s infinite 0.2s'
                    }}
                  />
                  <div
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#818CF8',
                      animation: 'pulse 0.8s infinite 0.4s'
                    }}
                  />
                  <span style={{ fontSize: '11.5px', color: 'rgba(241, 245, 249, 0.7)', fontWeight: '600', marginLeft: '4px' }}>
                    Generating response...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* QUICK SUGGESTIONS CAROUSEL / HORIZONTAL CHIPS */}
            <div
              style={{
                padding: '8px 12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(15, 23, 42, 0.95)',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                display: 'flex',
                gap: '6px'
              }}
            >
              {quickPrompts.map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  className="support-assistant-prompt-btn"
                  onClick={() => handleSendMessage(prompt)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '14px',
                    color: '#F1F5F9',
                    fontSize: '11px',
                    fontWeight: '650',
                    padding: '5px 11px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.2s'
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* INPUT FIELD & SEND BUTTON */}
            <div
              style={{
                padding: '12px 14px',
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                background: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <input
                id="support-assistant-input"
                className="support-assistant-input-field"
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about scraping, roll ranges, errors..."
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  borderRadius: '10px',
                  padding: '9px 13px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              <button
                id="support-assistant-send-btn"
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputQuery.trim() || isTyping}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: inputQuery.trim() ? 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' : 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: inputQuery.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s'
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
