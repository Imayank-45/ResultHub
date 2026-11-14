import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

import ResultCompareStudio from './ResultCompareStudio';
import CgpaCalculator from './CgpaCalculator';
import { AuthProvider, useAuth, API_BASE } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import ToastContainer from './components/ToastContainer';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import FeedbackPage from './pages/FeedbackPage';
import AboutPage from './pages/AboutPage';
import HistoryPage from './pages/HistoryPage';
import SessionExpiryModal from './components/SessionExpiryModal';
import CustomSelect from './components/CustomSelect';
import CustomExportPage from './pages/CustomExportPage';
import SupportAssistant from './components/SupportAssistant';
import AiReportGenerator from './components/AiReportGenerator';
import RgpvStudentHub from './RgpvStudentHub';
import FileConverterPage from './pages/FileConverterPage';
import MidSemStudio from './components/MidSemStudio';
import SubjectMarksManager from './components/SubjectMarksManager';
import { getHeadlessMode } from './utils/scraperSettings';


const isDev = window.location.port === '5173';
const host = isDev ? '127.0.0.1:8000' : window.location.host;
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/api/ws`;

export const PROGRAM_OPTIONS = [
  "B.Tech.",
  "B.E.",
  "B.Pharmacy",
  "B.Pharmacy (PCI)",
  "M.Pharmacy",
  "M.Pharmacy (PCI)",
  "MCA",
  "MCA (DD)",
  "MCA Bridge Course",
  "M.Tech.",
  "M.Tech. (PT)",
  "MBA",
  "M.Arch.",
  "B.Arch.",
  "M.Plan",
  "B.Design",
  "Diploma",
  "Ph.D."
];

const REQUIRED_IMPORT_COLS = ['ENROLLMENT', 'NAME', 'RESULT'];

export const PROGRAM_MAX_SEMESTER = {
  "B.Tech.": 8,
  "B.E.": 8,
  "B.Pharmacy": 8,
  "B.Pharmacy (PCI)": 8,
  "B.Design": 8,

  "B.Arch.": 10,

  "M.Pharmacy": 4,
  "M.Pharmacy (PCI)": 4,
  "MCA": 4,
  "M.Tech.": 4,
  "MBA": 4,
  "M.Arch.": 4,
  "M.Plan": 4,

  "MCA (DD)": 6,
  "Diploma": 6,
  "M.Tech. (PT)": 6,

  "MCA Bridge Course": 2,
  "Ph.D.": 4,
};

export function getSemesterOptionsForProgram(program) {
  const maxSem = PROGRAM_MAX_SEMESTER[program] || 8;
  const options = [{ value: '', label: '(None - CLI default)' }];

  for (let i = 1; i <= maxSem; i++) {
    if (program === 'Ph.D.' && i === 1) {
      options.push({ value: '1', label: 'Semester 1 (Coursework)' });
    } else {
      options.push({ value: String(i), label: `Semester ${i}` });
    }
  }
  return options;
}

export function parseUserFriendlyLog(log) {
  if (!log) return null;
  const l = log.trim();

  // Hide low-level HTTP requests, uvicorn server logs, DOM info, image hashes in User Mode
  if (
    l.includes('HTTP/1.1') ||
    l.includes('GET /api/') ||
    l.includes('POST /api/') ||
    l.includes('Uvicorn running') ||
    l.includes('Default admin user') ||
    l.includes('brand logo copied') ||
    l.includes('Application startup complete') ||
    l.includes('INFO: ') ||
    l.includes('DEBUG: ') ||
    l.includes('[plugin') ||
    l.includes('vite') ||
    l.includes('image hash:') ||
    l.includes('DOM element') ||
    l.includes('submitting form')
  ) {
    return null;
  }

  // 1. Extraction Started
  if (l.includes('[System] Running bulk fetch:') || l.includes('bulk fetch:') || l.includes('Starting extraction job')) {
    const rangeMatch = l.match(/Range=(\d+-\d+)/) || l.match(/Range:?\s*(\d+\s*to\s*\d+)/i);
    const prefixMatch = l.match(/Prefix=([A-Za-z0-9]+)/) || l.match(/Prefix:?\s*([A-Za-z0-9]+)/i);
    const details = prefixMatch && rangeMatch ? ` (${prefixMatch[1]} · Range ${rangeMatch[1]})` : '';
    return {
      type: 'start',
      icon: '🚀',
      text: `Extraction Started${details}`,
      color: '#38BDF8',
      bold: true
    };
  }

  // 2. Fetching Student
  if (l.includes('[Scraper] Fetching ') || l.includes('Fetching ')) {
    const match = l.match(/Fetching ([A-Za-z0-9]+)\s*\((.*?)\)/);
    if (match) {
      return {
        type: 'fetch',
        icon: '👤',
        text: `Fetching Student: ${match[1]} (${match[2]})`,
        color: '#93C5FD',
        bold: false
      };
    }
  }

  // 3. Result Found (PASS / FAIL)
  if (l.includes('Success: Result=')) {
    const enrMatch = l.match(/\[([A-Za-z0-9]+)\]/);
    const resMatch = l.match(/Result=([A-Z]+)/);
    const sgpaMatch = l.match(/SGPA=([0-9.]+)/);
    const cgpaMatch = l.match(/CGPA=([0-9.]+)/);

    const enr = enrMatch ? enrMatch[1] : '';
    const res = resMatch ? resMatch[1] : 'PASS';
    const gpas = [];
    if (sgpaMatch) gpas.push(`SGPA: ${sgpaMatch[1]}`);
    if (cgpaMatch) gpas.push(`CGPA: ${cgpaMatch[1]}`);

    const gpaStr = gpas.length > 0 ? ` (${gpas.join(' | ')})` : '';

    return {
      type: 'result_success',
      icon: res === 'PASS' ? '✅' : '⚠️',
      text: `Result Found for ${enr} — ${res}${gpaStr}`,
      color: res === 'PASS' ? '#22C55E' : '#F59E0B',
      bold: true
    };
  }

  // 4. Result Not Found
  if (l.includes('No result record found')) {
    const enrMatch = l.match(/\[([A-Za-z0-9]+)\]/);
    const enr = enrMatch ? enrMatch[1] : '';
    return {
      type: 'result_not_found',
      icon: '❌',
      text: `Result Not Found for ${enr}`,
      color: '#94A3B8',
      bold: false
    };
  }

  // 5. Fetch Failed / Parse Error
  if (l.includes('Fetch failed:') || l.includes('Error parsing HTML:')) {
    const enrMatch = l.match(/\[([A-Za-z0-9]+)\]/);
    const enr = enrMatch ? enrMatch[1] : '';
    return {
      type: 'fetch_error',
      icon: '⚠️',
      text: `Fetch Failed for ${enr}`,
      color: '#EF4444',
      bold: false
    };
  }

  // 6. OCR / CAPTCHA Mode
  if (l.includes('[OCR]') || l.includes('Attempting CAPTCHA') || l.includes('Solved CAPTCHA')) {
    if (l.includes('Solved CAPTCHA')) {
      const codeMatch = l.match(/Solved CAPTCHA:?\s*([A-Za-z0-9]+)/i);
      return {
        type: 'ocr',
        icon: '🤖',
        text: `OCR Resolved CAPTCHA${codeMatch ? `: ${codeMatch[1]}` : ''}`,
        color: '#A78BFA',
        bold: false
      };
    }
    return {
      type: 'ocr',
      icon: '🤖',
      text: 'OCR Processing CAPTCHA...',
      color: '#A78BFA',
      bold: false
    };
  }

  if (l.includes('Manual captcha mode activated') || l.includes('Manual CAPTCHA')) {
    return {
      type: 'manual_captcha',
      icon: '🟡',
      text: 'Manual CAPTCHA Required — Solve in browser window',
      color: '#F59E0B',
      bold: true
    };
  }

  // 7. Data Validation Step
  if (l.includes('Data Validation')) {
    if (l.includes('Data Validation Warning')) {
      return { type: 'validation', icon: '⚠️', text: l.replace('[System] ', ''), color: '#F59E0B', bold: true };
    }
    if (l.includes('Data Validation Success')) {
      return { type: 'validation', icon: '✅', text: 'Data Validation Completed Successfully', color: '#22C55E', bold: true };
    }
    return { type: 'validation', icon: '📊', text: 'Running Data Validation Inspection...', color: '#38BDF8', bold: false };
  }

  // 8. Generating Excel & Excel Saved
  if (l.includes('Compiling results to Excel')) {
    return {
      type: 'excel_compiling',
      icon: '📄',
      text: 'Generating Excel Spreadsheet...',
      color: '#38BDF8',
      bold: false
    };
  }

  if (l.includes('Excel file saved to:')) {
    const pathMatch = l.match(/saved to:\s*(.*)/);
    const path = pathMatch ? pathMatch[1] : '';
    return {
      type: 'excel_saved',
      icon: '💾',
      text: `Excel Saved: ${path}`,
      color: '#22C55E',
      bold: true
    };
  }

  // 9. History Saved
  if (l.includes('Scrape job history saved to database')) {
    const idMatch = l.match(/\(Job ID:\s*(.*?)\)/);
    return {
      type: 'history_saved',
      icon: '📜',
      text: `Scrape History Saved to Database${idMatch ? ` (${idMatch[1]})` : ''}`,
      color: '#818CF8',
      bold: false
    };
  }

  // 10. Job Completion / Pause / Resume / Cancel
  if (l.includes('Job finished successfully!') || l.includes('finished successfully')) {
    return {
      type: 'completed',
      icon: '🎉',
      text: 'Extraction Completed Successfully!',
      color: '#22C55E',
      bold: true
    };
  }

  if (l.includes('Scraper paused safely')) {
    return { type: 'paused', icon: '⏸️', text: l.replace('[System] ', ''), color: '#F59E0B', bold: true };
  }

  if (l.includes('Resuming bulk fetch')) {
    return { type: 'resumed', icon: '▶️', text: 'Resuming Extraction Job...', color: '#38BDF8', bold: true };
  }

  if (l.includes('Cancellation requested') || l.includes('Terminating job')) {
    return { type: 'cancelled', icon: '⏹️', text: 'Scraper Cancelled', color: '#EF4444', bold: true };
  }

  // Default fallback for any unhandled meaningful system messages
  if (l.startsWith('[System]') || l.startsWith('[Scraper]')) {
    return {
      type: 'system',
      icon: 'ℹ️',
      text: l.replace(/^\[(System|Scraper)\]\s*/, ''),
      color: '#E2E8F0',
      bold: false
    };
  }

  return null;
}

function ScrapingTimerWidget({ jobStatus, processedCount }) {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const prevStatusRef = useRef(jobStatus);
  const timerRef = useRef(null);

  // Auto start/stop/reset on jobStatus transitions
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    
    if (jobStatus === 'idle') {
      setSeconds(0);
      setIsActive(false);
    } 
    // Status transitioned to 'running' -> Reset and Start
    else if (jobStatus === 'running' && prevStatus !== 'running') {
      setSeconds(0);
      setIsActive(true);
    } 
    // Status transitioned from 'running' to non-running -> Stop
    else if (jobStatus !== 'running' && prevStatus === 'running') {
      setIsActive(false);
    } else if (jobStatus === 'running') {
      setIsActive(true);
    }
    
    prevStatusRef.current = jobStatus;
  }, [jobStatus]);

  // Interval timer handler
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive]);

  const formatTime = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hrs)} : ${pad(mins)} : ${pad(secs)}`;
  };

  const formatAvgTime = (totalSec, processed) => {
    if (!processed || processed <= 0) return '00:00.0';
    const avgSec = totalSec / processed;
    const mins = Math.floor(avgSec / 60);
    const secs = (avgSec % 60).toFixed(1);
    const pad = (n) => String(n).padStart(2, '0');
    const secParts = secs.split('.');
    const integerSecs = pad(secParts[0]);
    const decimalSecs = secParts[1] || '0';
    return `${pad(mins)}:${integerSecs}.${decimalSecs}`;
  };

  const renderStatusBadge = () => {
    if (jobStatus === 'running' || isActive) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '800', color: 'var(--success)', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)', animation: 'pulse 1.2s infinite' }} />
          ● Running
        </span>
      );
    }
    if (jobStatus === 'completed') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '800', color: '#3B82F6', background: 'rgba(59, 130, 246, 0.12)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          ■ Completed
        </span>
      );
    }
    if (jobStatus === 'paused') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '800', color: '#F59E0B', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          ⏸️ Paused
        </span>
      );
    }
    if (jobStatus === 'cancelled') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '800', color: '#EF4444', background: 'rgba(239, 68, 68, 0.12)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          ■ Cancelled
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '800', color: '#64748B', background: 'rgba(100, 116, 139, 0.12)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(100, 116, 139, 0.25)' }}>
        ■ Idle
      </span>
    );
  };

  return (
    <div className="metric-card" style={{ '--accent-color': 'var(--primary)' }}>
      <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span className="metric-label">Scraping Time</span>
        {renderStatusBadge()}
      </div>

      <div 
        className={`metric-value ${isActive ? 'timer-pulse' : ''}`}
        style={{
          fontFamily: 'monospace',
          fontSize: '20px',
          letterSpacing: '0.5px',
          margin: '6px 0',
          color: isActive ? 'var(--title-color)' : 'var(--text-muted)'
        }}
      >
        {formatTime(seconds)}
      </div>

      {/* AVERAGE TIME PER STUDENT */}
      <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '6px', width: '100%' }}>
        <span style={{ fontSize: '9px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
          Average Time Per Student
        </span>
        <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--primary)', fontFamily: 'monospace', marginTop: '2px', display: 'inline-block' }}>
          {formatAvgTime(seconds, processedCount)} <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: '600' }}>sec/student</span>
        </span>
      </div>
    </div>
  );
}

function DataValidationReportWidget({ report }) {
  if (!report) return null;

  const { has_suspicious_data, suspicious_count, total_records, issues = [], summary_counts = {} } = report;

  if (!has_suspicious_data) {
    return (
      <section className="glass-panel" style={{
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(16, 185, 129, 0.03) 100%)',
        border: '1px solid rgba(34, 197, 94, 0.35)',
        boxShadow: '0 8px 30px rgba(34, 197, 94, 0.08)',
        borderRadius: '16px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(34, 197, 94, 0.18)',
              color: '#22C55E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}>
              ✓
            </div>
            <div>
              <h3 style={{ fontSize: '16.5px', fontWeight: '850', color: 'var(--title-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                Data Validation Report
              </h3>
              <p style={{ fontSize: '13px', color: '#22C55E', margin: '3px 0 0 0', fontWeight: '750' }}>
                No suspicious data detected.
              </p>
            </div>
          </div>
          <span className="badge pass" style={{ fontSize: '11.5px', padding: '6px 14px', borderRadius: '20px', background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: '800' }}>
            ✅ {total_records} Records Checked & Verified
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel" style={{
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.03) 100%)',
      border: '1px solid rgba(245, 158, 11, 0.35)',
      boxShadow: '0 8px 30px rgba(245, 158, 11, 0.1)',
      borderRadius: '16px',
      padding: '20px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.18)',
            color: '#F59E0B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            border: '1px solid rgba(245, 158, 11, 0.3)'
          }}>
            ⚠️
          </div>
          <div>
            <h3 style={{ fontSize: '16.5px', fontWeight: '850', color: 'var(--title-color)', margin: 0 }}>
              Data Validation Report
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Anomaly inspection completed prior to Excel file generation. (Excel file generated normally)
            </p>
          </div>
        </div>
        <span style={{
          fontSize: '12px',
          fontWeight: '800',
          padding: '6px 14px',
          borderRadius: '20px',
          background: 'rgba(245, 158, 11, 0.2)',
          color: '#F59E0B',
          border: '1px solid rgba(245, 158, 11, 0.4)'
        }}>
          ⚠️ {suspicious_count} Suspicious Record(s) Flagged
        </span>
      </div>

      {/* Summary Category Badges */}
      {Object.keys(summary_counts).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {Object.entries(summary_counts).map(([cat, count], i) => (
            <span key={i} style={{
              fontSize: '11px',
              fontWeight: '750',
              padding: '4px 10px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ color: '#F59E0B' }}>•</span> {cat}: <strong style={{ color: '#F59E0B' }}>{count}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Detailed Issues List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {issues.map((issue, idx) => (
          <div key={idx} style={{
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '12.5px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontWeight: '800', color: '#F59E0B', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                [{issue.category}]
              </span>
            </div>
            <p style={{ color: 'var(--text-main)', margin: '0 0 6px 0', lineHeight: 1.4 }}>
              {issue.reason}
            </p>
            {issue.affected_enrollments && issue.affected_enrollments.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '700' }}>Affected Enrollments:</span>
                {issue.affected_enrollments.map((enr, eIdx) => (
                  <span key={eIdx} style={{
                    fontFamily: 'monospace',
                    fontSize: '10.5px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#F59E0B',
                    border: '1px solid rgba(245, 158, 11, 0.3)'
                  }}>
                    {enr}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

const createEmptyScrapeJobState = (ownerId = null) => ({
  owner_id: ownerId,
  job_id: null,
  status: 'idle',
  start_time: null,
  end_time: null,
  processing_time_seconds: null,
  total: 0,
  processed: 0,
  pass_count: 0,
  fail_count: 0,
  not_found_count: 0,
  error_count: 0,
  current_enrollment: '',
  excel_file_path: null,
  captcha_mode: 'ocr',
  records: [],
  logs: [],
  validation_report: null,
});

function MainApp() {
  const { user, token, loading, isAuthenticated, logout, authFetch } = useAuth();
  const { success, error, warning, info } = useToast();

  // Active view state: 'dashboard', 'studio', 'profile'
  const [currentView, setCurrentView] = useState('dashboard');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Theme state (persisted in local storage)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  // Form parameters state
  const [prefix, setPrefix] = useState('0105IT2410');
  const [start, setStart] = useState('1');
  const [end, setEnd] = useState('2');
  const [pad, setPad] = useState('2');
  const [sem, setSem] = useState('3');
  const [program, setProgram] = useState('B.Tech.');

  // Auto-clamp / reset semester selection if selected sem exceeds max semester for newly selected program
  useEffect(() => {
    if (sem) {
      const maxSem = PROGRAM_MAX_SEMESTER[program] || 8;
      const semNum = parseInt(sem, 10);
      if (!isNaN(semNum) && semNum > maxSem) {
        setSem('');
      }
    }
  }, [program]);

  // Scrape job state
  const [jobState, setJobState] = useState(() => createEmptyScrapeJobState(user?.id ?? null));
  const [jobError, setJobError] = useState('');
  const [statusRetryCount, setStatusRetryCount] = useState(0);
  const currentUserIdRef = useRef(user?.id ?? null);
  const jobStateRef = useRef(jobState);
  currentUserIdRef.current = user?.id ?? null;
  jobStateRef.current = jobState;
  const lastUserIdRef = useRef(user?.id ?? null);

  const captchaModeLabel = {
    ocr: '🟢 OCR Mode',
    manual: '🟡 Manual CAPTCHA',
    ocr_restored: '🟢 OCR Mode Restored',
  };


  // Selected student record for details modal
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Filter state for Extracted Student Records table
  const [filterEnrollment, setFilterEnrollment] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterResult, setFilterResult] = useState('ALL');

  // Custom Export configuration state
  const [customExportConfig, setCustomExportConfig] = useState(null);
  const [showCustomExportModal, setShowCustomExportModal] = useState(false);

  // Import Existing Excel state
  const [importFile, setImportFile] = useState(null);
  const [importStatus, setImportStatus] = useState('idle'); // idle | validating | valid | invalid
  const [importInfo, setImportInfo] = useState(null);       // server response on success
  const [importError, setImportError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [importEndRoll, setImportEndRoll] = useState('');
  const [isContinuing, setIsContinuing] = useState(false);
  const importFileInputRef = useRef(null);

  const effectiveValidationReport = useMemo(() => {
    if (jobState.validation_report) return jobState.validation_report;
    if (!jobState.records || jobState.records.length === 0) return null;
    const _running = jobState.status === 'running' || jobState.status === 'resumed';
    const _paused = jobState.status === 'paused';
    if (jobState.status === 'completed' || (jobState.records.length > 0 && !_running && !_paused)) {
      const records = jobState.records;
      const total_records = records.length;
      const issues = [];
      const suspicious_enrollments = new Set();
      const summary_counts = {};

      const enrMap = {};
      records.forEach((r) => {
        const e = (r.enrollment || '').toUpperCase().trim();
        if (e) enrMap[e] = (enrMap[e] || 0) + 1;
      });
      Object.entries(enrMap).forEach(([e, count]) => {
        if (count > 1) {
          suspicious_enrollments.add(e);
          issues.push({
            type: 'duplicate_enrollment',
            category: 'Duplicate Enrollment',
            reason: `Duplicate enrollment number '${e}' found ${count} times in records.`,
            affected_enrollments: [e]
          });
        }
      });

      const nameMap = {};
      records.filter((r) => !r.not_found && r.name).forEach((r) => {
        const name = r.name.trim().toUpperCase();
        const e = (r.enrollment || '').trim().toUpperCase();
        if (!nameMap[name]) nameMap[name] = new Set();
        nameMap[name].add(e);
      });
      Object.entries(nameMap).forEach(([name, enrsSet]) => {
        if (enrsSet.size > 1) {
          const enrList = Array.from(enrsSet);
          enrList.forEach((e) => suspicious_enrollments.add(e));
          issues.push({
            type: 'duplicate_name',
            category: 'Duplicate Student Name',
            reason: `Identical student name '${name}' shared across ${enrList.length} distinct enrollments (${enrList.join(', ')}).`,
            affected_enrollments: enrList
          });
        }
      });

      issues.forEach((i) => {
        summary_counts[i.category] = (summary_counts[i.category] || 0) + 1;
      });

      return {
        total_records,
        suspicious_count: suspicious_enrollments.size,
        has_suspicious_data: suspicious_enrollments.size > 0 || issues.length > 0,
        issues,
        summary_counts
      };
    }
    return null;
  }, [jobState.validation_report, jobState.records, jobState.status]);

  const filteredRecords = useMemo(() => {
    if (!jobState.records) return [];
    return jobState.records.filter((rec) => {
      if (filterEnrollment.trim()) {
        const query = filterEnrollment.trim().toLowerCase();
        if (!rec.enrollment || !rec.enrollment.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (filterName.trim()) {
        const query = filterName.trim().toLowerCase();
        const studentName = rec.not_found ? '' : (rec.name || '');
        if (!studentName.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (filterResult !== 'ALL') {
        if (filterResult === 'PASS' && (rec.not_found || rec.result !== 'PASS')) {
          return false;
        }
        if (filterResult === 'FAIL' && (rec.not_found || rec.result !== 'FAIL')) {
          return false;
        }
        if (filterResult === 'NOT_FOUND' && !rec.not_found) {
          return false;
        }
      }
      return true;
    });
  }, [jobState.records, filterEnrollment, filterName, filterResult]);

  const [devMode, setDevMode] = useState(false);

  const userLogs = useMemo(() => {
    if (!jobState.logs || !Array.isArray(jobState.logs)) return [];
    return jobState.logs
      .map(log => parseUserFriendlyLog(log))
      .filter(Boolean);
  }, [jobState.logs]);

  // Navigation tab state inside dashboard
  const [activeTab, setActiveTab] = useState('extractor'); // extractor, compare, or report

  // Report Generator state
  const [reportForm, setReportForm] = useState({
    excel_path: '',
    compare_path: '',
    college_name: 'Rajiv Gandhi Proudyogiki Vishwavidyalaya',
    department: 'Department of Information Technology',
    semester: '',
    program: 'B.Tech.',
    job_id: '',
    max_student_pages: 100
  });
  const [reportStatus, setReportStatus] = useState('idle'); // idle, generating, done, error
  const [reportPath, setReportPath] = useState(null);
  const [reportError, setReportError] = useState(null);
  const [reportLogs, setReportLogs] = useState([]);

  // Terminal scroll reference
  const terminalEndRef = useRef(null);

  // File Upload refs & state for Report Generator
  const reportFileInputRef = useRef(null);
  const reportCompareInputRef = useRef(null);
  const [uploadingFile, setUploadingFile] = useState(null); // null, 'excel', or 'compare'

  const handleReportFileUpload = async (file, type) => {
    setUploadingFile(type);
    setReportLogs(l => [...l, `[INFO] Uploading file: ${file.name}...`]);
    try {
      const res = await authFetch(`${API_BASE}/report/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      
      setReportForm(f => ({
        ...f,
        [type === 'excel' ? 'excel_path' : 'compare_path']: data.excel_path
      }));
      setReportLogs(l => [...l, `[OK] File uploaded successfully: ${data.excel_path}`]);
      success(`File uploaded successfully: ${file.name}`);
    } catch (err) {
      setReportLogs(l => [...l, `[ERR] Upload failed: ${err.message}`]);
      error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingFile(null);
    }
  };

  // Compute top 3 batch toppers from extracted records in real-time based on CGPA
  const toppers = useMemo(() => {
    if (!jobState.records || jobState.records.length === 0) return [];
    return [...jobState.records]
      .filter(r => !r.not_found && r.name && (r.cgpa || r.sgpa))
      .map(r => ({
        ...r,
        cgpaNum: parseFloat(r.cgpa) || 0,
        sgpaNum: parseFloat(r.sgpa) || 0
      }))
      .sort((a, b) => b.cgpaNum - a.cgpaNum || b.sgpaNum - a.sgpaNum)
      .slice(0, 3);
  }, [jobState.records]);

  const userDropdownRef = useRef(null);
  const mobileNavRef = useRef(null);
  const toolsDropdownRef = useRef(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [mobileNavSearch, setMobileNavSearch] = useState('');
  const [toolsSectionOpen, setToolsSectionOpen] = useState(true);

  const activeNavTitle = useMemo(() => {
    if (currentView === 'mid_sem_studio' || currentView === 'subject_marks_manager') return 'Mid-Sem Studio';
    if (currentView === 'studio') return 'Result Compare Studio';
    if (currentView === 'profile') return 'My Profile';
    if (currentView === 'feedback') return 'Feedback';
    if (currentView === 'about') return 'About';
    if (currentView === 'history') return 'Scraping History';
    if (currentView === 'file_converter') return 'Tools: File Converter';
    if (currentView === 'rgpv_hub') return 'Tools: RGPV Student Hub';
    if (activeTab === 'report') return 'Tools: AI Report Generator';
    if (activeTab === 'cgpa') return 'Tools: CGPA Calculator';
    if (activeTab === 'custom_export') return 'Tools: Custom Export';
    return 'Result Extractor';
  }, [currentView, activeTab]);

  const isToolsActive = useMemo(() => {
    return (currentView === 'dashboard' && ['report', 'cgpa', 'custom_export'].includes(activeTab)) || currentView === 'rgpv_hub' || currentView === 'file_converter' || currentView === 'studio';
  }, [currentView, activeTab]);


  // Close dropdowns on click outside or Escape key press
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
      if (mobileNavRef.current && !mobileNavRef.current.contains(event.target)) {
        setMobileNavOpen(false);
      }
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target)) {
        setToolsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setUserDropdownOpen(false);
        setMobileNavOpen(false);
        setToolsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Sync theme with body class and localStorage
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Safe state merger to prevent crashes from missing fields and auto-sync form inputs
  const mergeStatus = (newData, expectedUserId = user?.id ?? null, expectedJobId = null) => {
    if (!newData || expectedUserId == null || Number(currentUserIdRef.current) !== Number(expectedUserId)) return;
    if (expectedJobId && newData.job_id !== expectedJobId) return;

    const currentState = jobStateRef.current;
    if (
      expectedJobId && currentState.owner_id === expectedUserId && currentState.job_id &&
      currentState.job_id !== expectedJobId && currentState.status !== 'starting'
    ) return;
    if (
      !expectedJobId && currentState.owner_id === expectedUserId && currentState.job_id &&
      newData.job_id && currentState.job_id !== newData.job_id
    ) return;

    setJobState({
      ...createEmptyScrapeJobState(expectedUserId),
      ...newData,
      owner_id: expectedUserId,
      job_id: newData.job_id ?? expectedJobId ?? null,
      records: Array.isArray(newData.records) ? newData.records : [],
      logs: Array.isArray(newData.logs) ? newData.logs : [],
    });
    setJobError('');

    // Instantly sync Extractor panel form parameters from live single-source-of-truth backend status
    if (newData.prefix) setPrefix(newData.prefix);
    if (newData.start !== undefined && newData.start !== null) setStart(String(newData.start));
    if (newData.end !== undefined && newData.end !== null) setEnd(String(newData.end));
    if (newData.pad !== undefined && newData.pad !== null) setPad(String(newData.pad));
    if (newData.sem !== undefined && newData.sem !== null) setSem(String(newData.sem));
    if (newData.program) setProgram(newData.program);
  };

  useEffect(() => {
    const userId = user?.id ?? null;
    if (lastUserIdRef.current !== userId || !isAuthenticated) {
      lastUserIdRef.current = userId;
      setJobState(createEmptyScrapeJobState(isAuthenticated ? userId : null));
      setJobError('');
      setSelectedRecord(null);
      setFilterEnrollment('');
      setFilterName('');
      setFilterResult('ALL');
      setImportFile(null);
      setImportStatus('idle');
      setImportInfo(null);
      setImportError('');
      setImportEndRoll('');
    }
  }, [user?.id, isAuthenticated]);

  // Poll the authenticated user's latest job once, then track that job by ID.
  useEffect(() => {
    const ownerId = user?.id ?? null;
    if (!isAuthenticated || ownerId == null) return;
    const jobId = jobState.owner_id === ownerId ? jobState.job_id : null;
    const isJobActive = jobState.status === 'running' || jobState.status === 'resumed' || jobState.status === 'starting';
    const pollIntervalMs = isJobActive ? 1000 : (jobId ? 10000 : 2500);
    let disposed = false;
    let inFlight = false;
    let controller;

    const pollStatus = async () => {
      if (disposed || inFlight) return;
      if (!jobId && jobStateRef.current.status === 'starting') return;
      inFlight = true;
      controller = new AbortController();
      const query = jobId ? `?job_id=${encodeURIComponent(jobId)}` : '';
      try {
        const response = await authFetch(`${API_BASE}/scrape/status${query}`, { signal: controller.signal });
        if (disposed || Number(currentUserIdRef.current) !== Number(ownerId)) return;
        if (response.status === 404 && jobId) {
          setJobError('This scraping job is no longer available. Refresh your job list to continue.');
          return;
        }
        if (response.status === 403) {
          setJobError('You no longer have access to this scraping job.');
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        if (!disposed) mergeStatus(data, ownerId, jobId);
      } catch (requestError) {
        if (!disposed && requestError.name !== 'AbortError' && Number(currentUserIdRef.current) === Number(ownerId)) {
          setJobError('Connection interrupted. Retrying job status automatically.');
        }
      } finally {
        inFlight = false;
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, pollIntervalMs);

    return () => {
      disposed = true;
      if (interval) clearInterval(interval);
      controller?.abort();
    };
  }, [isAuthenticated, authFetch, user?.id, jobState.owner_id, jobState.status, jobState.job_id, statusRetryCount]);

  // Subscribe only after an owned job ID is known; polling supplies the initial status.
  useEffect(() => {
    const ownerId = user?.id ?? null;
    const jobId = jobState.owner_id === ownerId ? jobState.job_id : null;
    if (!isAuthenticated || ownerId == null || !jobId) return;

    let socket;
    let reconnectTimer;
    let disposed = false;
    let reconnectDelay = 1000;
    const seenLogEvents = new Set();
    const connectWebSocket = () => {
      if (disposed || Number(currentUserIdRef.current) !== Number(ownerId)) return;
      const query = `?job_id=${encodeURIComponent(jobId)}`;
      socket = new WebSocket(`${WS_URL}${query}`, ['resultai', token]);

      socket.onmessage = (event) => {
        if (disposed || Number(currentUserIdRef.current) !== Number(ownerId)) return;
        try {
          const msg = JSON.parse(event.data);
          const eventJobId = msg.job_id || msg.data?.job_id;
          if (msg.user_id !== undefined && Number(msg.user_id) !== Number(ownerId)) return;
          if (eventJobId !== jobId) return;
          if (msg.type === "status") {
            mergeStatus(msg.data, ownerId, jobId);
          } else if (msg.type === "log") {
            const logKey = `${eventJobId}:${msg.message}`;
            if (seenLogEvents.has(logKey)) return;
            seenLogEvents.add(logKey);
            if (seenLogEvents.size > 500) seenLogEvents.delete(seenLogEvents.values().next().value);
            setJobState(prev => {
              if (Number(currentUserIdRef.current) !== Number(ownerId) || prev.job_id !== jobId) return prev;
              const updatedLogs = [...prev.logs, msg.message];
              if (updatedLogs.length > 500) updatedLogs.shift();
              return { ...prev, logs: updatedLogs };
            });
          }
        } catch (e) {
          console.error("Error parsing socket message:", e);
        }
      };

      socket.onopen = () => {
        reconnectDelay = 1000;
        authFetch(`${API_BASE}/scrape/status?job_id=${encodeURIComponent(jobId)}`)
          .then(async (response) => {
            if (!response.ok) return;
            const data = await response.json();
            if (!disposed) mergeStatus(data, ownerId, jobId);
          })
          .catch(() => {});
      };

      socket.onclose = (event) => {
        if (event.code === 4404) {
          if (!disposed && Number(currentUserIdRef.current) === Number(ownerId)) {
            setJobError('This scraping job is no longer available to this account.');
          }
          return;
        }
        if (!disposed && Number(currentUserIdRef.current) === Number(ownerId)) {
          setJobError('Live updates disconnected. Job status will continue refreshing.');
          reconnectTimer = setTimeout(connectWebSocket, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 10000);
        }
      };

      socket.onerror = (err) => {
        socket.close();
      };
    };

    connectWebSocket();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [isAuthenticated, authFetch, token, user?.id, jobState.owner_id, jobState.job_id]);

  // Actions
  const handleReset = async () => {
    const ownerId = user?.id ?? null;
    try {
      const query = jobState.job_id ? `?job_id=${encodeURIComponent(jobState.job_id)}` : '';
      const response = await authFetch(`${API_BASE}/scrape/reset${query}`, { method: 'POST' });
      const data = await response.json();
      if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
      if (!response.ok) {
        error(data.detail || "Failed to reset scrape session");
      } else {
        setJobState(createEmptyScrapeJobState(ownerId));
        setJobError('');
        setFilterEnrollment('');
        setFilterName('');
        setFilterResult('ALL');
        setSelectedRecord(null);
        info("Scrape session reset. Ready for new extraction.");
      }
    } catch (err) {
      if (Number(currentUserIdRef.current) === Number(ownerId)) {
        setJobError('Could not reset the job because the server is unreachable.');
        error(err.message || 'Could not reset scraping job.');
      }
    }
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!prefix || !start || !end) {
      warning("Please fill in all required fields.");
      return;
    }

    const ownerId = user?.id ?? null;
    setJobError('');
    setJobState({ ...createEmptyScrapeJobState(ownerId), status: 'starting' });

    const payload = {
      prefix,
      start: parseInt(start),
      end: parseInt(end),
      pad: parseInt(pad),
      sem: sem || null,
      program,
      headless: getHeadlessMode(),
      selected_fields: customExportConfig
    };

    try {
      const response = await authFetch(`${API_BASE}/scrape/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
      if (!response.ok) {
        setJobState(createEmptyScrapeJobState(ownerId));
        error(data.detail || "Failed to start job");
      } else {
        mergeStatus(data.job, ownerId, data.job?.job_id);
        success(`Result extraction started for ${prefix} (${start} to ${end})`);
      }
    } catch (err) {
      if (Number(currentUserIdRef.current) === Number(ownerId)) {
        setJobState(createEmptyScrapeJobState(ownerId));
        setJobError('Unable to reach the server. Check your connection and retry.');
        error("Error contacting server: " + err.message);
      }
    }
  };

  const handleCancel = async () => {
    try {
      if (!jobState.job_id) return;
      const ownerId = user?.id ?? null;
      const jobId = jobState.job_id;
      const response = await authFetch(`${API_BASE}/scrape/cancel?job_id=${encodeURIComponent(jobId)}`, { method: 'POST' });
      const data = await response.json();
      if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
      if (!response.ok) {
        error(data.detail || "Failed to cancel job");
      } else {
        warning("Result extraction job cancelled.");
      }
    } catch (err) {
      error("Error cancelling job: " + err.message);
    }
  };

  const handlePause = async () => {
    try {
      if (!jobState.job_id) return;
      const ownerId = user?.id ?? null;
      const jobId = jobState.job_id;
      const response = await authFetch(`${API_BASE}/scrape/pause?job_id=${encodeURIComponent(jobId)}`, { method: 'POST' });
      const data = await response.json();
      if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
      if (!response.ok) {
        error(data.detail || "Failed to pause job");
      } else {
        warning("Pause requested. Scraper will pause safely after current student.");
      }
    } catch (err) {
      error("Error pausing job: " + err.message);
    }
  };

  const handleResume = async () => {
    try {
      if (!jobState.job_id) return;
      const ownerId = user?.id ?? null;
      const jobId = jobState.job_id;
      const response = await authFetch(`${API_BASE}/scrape/resume?job_id=${encodeURIComponent(jobId)}`, { method: 'POST' });
      const data = await response.json();
      if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
      if (!response.ok) {
        error(data.detail || "Failed to resume job");
      } else {
        info("Scraper job resumed!");
      }
    } catch (err) {
      error("Error resuming job: " + err.message);
    }
  };

  const handleDownload = () => {
    if (!jobState.job_id) return;
    const ownerId = user?.id ?? null;
    const jobId = jobState.job_id;
    info("Downloading extracted Excel spreadsheet...");
    authFetch(`${API_BASE}/scrape/download?job_id=${encodeURIComponent(jobId)}`)
      .then(async response => {
        if (!response.ok) throw new Error('Failed to download scrape output.');
        const blob = await response.blob();
        if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `RGPV_Result_${jobId}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => error(err.message));
  };

  // ─── Import Existing Excel Handlers ───
  const handleImportFile = useCallback(async (file) => {
    if (!file) return;
    const ownerId = user?.id ?? null;
    if (!file.name.endsWith('.xlsx')) {
      setImportStatus('invalid'); setImportError('Only .xlsx Excel files are supported.');
      setImportFile(null); setImportInfo(null); return;
    }
    setImportFile(file); setImportStatus('validating'); setImportError(''); setImportInfo(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (!data || data.length < 2) { setImportStatus('invalid'); setImportError('The Excel file is empty or has no data rows.'); return; }
      const headers = data[0].map(h => String(h || '').trim().toUpperCase());
      const missing = REQUIRED_IMPORT_COLS.filter(c => !headers.includes(c));
      if (missing.length > 0) { setImportStatus('invalid'); setImportError(`Missing required columns: ${missing.join(', ')}. Found: ${headers.filter(Boolean).join(', ')}`); return; }
      const enrollmentIdx = headers.indexOf('ENROLLMENT');
      const dataRows = data.slice(1).filter(row => row[enrollmentIdx] && String(row[enrollmentIdx]).trim());
      if (dataRows.length === 0) { setImportStatus('invalid'); setImportError('No valid enrollment numbers found in the file.'); return; }
      const formData = new FormData();
      formData.append('file', file);
      const response = await authFetch(`${API_BASE}/scrape/import_excel`, { method: 'POST', body: formData });
      const result = await response.json();
      if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
      if (!response.ok) { setImportStatus('invalid'); setImportError(result.detail || 'Server validation failed.'); return; }
      setImportInfo(result); setImportStatus('valid');
      setImportEndRoll(String(result.next_start_roll + 9));
      setPrefix(result.prefix); setPad(String(result.pad));
      success(`Excel imported: ${result.existing_count} records detected. Next roll: ${result.next_start_roll}`);
    } catch (err) { setImportStatus('invalid'); setImportError('Failed to process the file: ' + err.message); }
  }, [authFetch, success, user?.id]);

  const handleContinueExtraction = async () => {
    if (!importInfo || importStatus !== 'valid') return;
    const endRoll = parseInt(importEndRoll);
    if (!endRoll || endRoll < importInfo.next_start_roll) { warning(`End roll must be >= ${importInfo.next_start_roll}`); return; }
    setIsContinuing(true);
    const ownerId = user?.id ?? null;
    try {
      const payload = { prefix: importInfo.prefix, start: importInfo.next_start_roll, end: endRoll, pad: importInfo.pad, sem: sem || null, program, headless: getHeadlessMode(), import_file_path: importInfo.file_path, preloaded_records: importInfo.existing_records, selected_fields: customExportConfig };
      setJobState({ ...createEmptyScrapeJobState(ownerId), status: 'starting' });
      setJobError('');
      const response = await authFetch(`${API_BASE}/scrape/continue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
      if (!response.ok) { error(data.detail || 'Failed to start continue-extraction job.'); setJobState(prev => ({ ...prev, status: 'idle' })); }
      else { mergeStatus(data.job, ownerId, data.job?.job_id); success(`Continue extraction started from roll ${importInfo.next_start_roll} to ${endRoll}`); setImportFile(null); setImportStatus('idle'); setImportInfo(null); setImportError(''); setImportEndRoll(''); }
    } catch (err) {
      if (Number(currentUserIdRef.current) === Number(ownerId)) {
        setJobState(createEmptyScrapeJobState(ownerId));
        setJobError('Unable to reach the server. Check your connection and retry.');
        error('Error starting continue job: ' + err.message);
      }
    }
    finally { setIsContinuing(false); }
  };

  const handleImportDrop = useCallback((e) => { e.preventDefault(); setIsDragOver(false); const file = e.dataTransfer.files?.[0]; if (file) handleImportFile(file); }, [handleImportFile]);
  const handleImportDragOver = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleImportDragLeave = useCallback(() => setIsDragOver(false), []);

  const downloadStudentPDF = async (rec) => {
    const ownerId = user?.id ?? null;
    try {
      const response = await authFetch(`${API_BASE}/scrape/download_pdf?enrollment=${encodeURIComponent(rec.enrollment)}`);
      if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
      if (response.ok) {
        const blob = await response.blob();
        if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RGPV_Marksheet_${rec.enrollment}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return;
      }
    } catch (e) {
      console.error("Failed to fetch real PDF", e);
    }

    if (Number(currentUserIdRef.current) !== Number(ownerId)) return;
    
    // Fallback to generated PDF if real marksheet was not found (e.g. scraped before this feature was added)
    console.warn("Real marksheet not available. Generating a synthetic PDF instead.");

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 8, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text("RAJIV GANDHI PROUDYOGIKI VISHWAVYADHALAYA", 105, 22, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("State Technological University of Madhya Pradesh", 105, 27, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text("ACADEMIC GRADE CARD", 105, 34, { align: "center" });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(15, 38, 195, 38);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("STUDENT PROFILE", 15, 46);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    
    doc.text(`Student Name :  ${rec.name || 'N/A'}`, 15, 53);
    doc.text(`Enrollment No:  ${rec.enrollment}`, 15, 59);
    doc.text(`Program      :  ${program || 'B.Tech.'}`, 120, 53);
    doc.text(`Semester     :  Semester ${sem || 'N/A'}`, 120, 59);

    doc.line(15, 64, 195, 64);

    doc.setFont("helvetica", "bold");
    doc.text("SUBJECT-WISE GRADES", 15, 72);

    doc.setFillColor(241, 245, 249);
    doc.rect(15, 76, 180, 8, 'F');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("SUBJECT CODE", 20, 81.5);
    doc.text("GRADE OBTAINED", 150, 81.5);

    let y = 90;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);

    if (rec.subjects && Object.keys(rec.subjects).length > 0) {
      Object.entries(rec.subjects).forEach(([subj, grade], idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, y - 5, 180, 8, 'F');
        }
        
        doc.text(subj, 20, y);
        const isFailGrade = ['F', 'FAIL', 'AB', 'ABSENT', 'RL'].includes(grade.trim().toUpperCase());
        if (isFailGrade) {
          doc.setTextColor(239, 68, 68);
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "normal");
        }
        doc.text(grade, 150, y);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "normal");
        y += 8;
      });
    } else {
      doc.text("No subject grade records found.", 20, y);
      y += 8;
    }

    doc.line(15, y - 2, 195, y - 2);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ACADEMIC PERFORMANCE SUMMARY", 15, y);
    y += 6;

    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(250, 250, 250);
    doc.rect(15, y - 4, 180, 24, 'FD');

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Semester Grade Point Average (SGPA) :  ${rec.sgpa || '—'}`, 20, y + 2);
    doc.text(`Cumulative Grade Point Average (CGPA) :  ${rec.cgpa || '—'}`, 20, y + 8);
    
    const isPass = rec.result === 'PASS';
    const isFail = rec.result && rec.result.toUpperCase().includes('FAIL');
    
    if (isPass) {
      doc.setTextColor(34, 197, 94);
    } else if (isFail) {
      doc.setTextColor(239, 68, 68);
    } else {
      doc.setTextColor(245, 158, 11);
    }
    
    doc.setFont("helvetica", "bold");
    doc.text(`RESULT STATUS                       :  ${rec.result || 'UNKNOWN'}`, 20, y + 14);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Disclaimer: Computer generated ResultAI grade card extracted from RGPV portal.", 105, 280, { align: "center" });

    doc.save(`RGPV_Result_${rec.enrollment}.pdf`);
  };

  // Analytics Derived Data
  const isStarting = jobState.status === 'starting';
  const isRunning = jobState.status === 'running' || jobState.status === 'resumed' || jobState.status === 'starting';
  const isPaused = jobState.status === 'paused';
  const totalGraded = jobState.pass_count + jobState.fail_count;
  const passRate = totalGraded > 0 ? Math.round((jobState.pass_count / totalGraded) * 100) : 0;
  const circleOffset = 377 - (377 * passRate) / 100;

  const scrapingStatusBanner = useMemo(() => {
    const manualMode = jobState.captcha_mode === 'manual';
    const restoredMode = jobState.captcha_mode === 'ocr_restored';
    const hasProgress = (jobState.processed || 0) > 0;

    if (jobState.status === 'completed') {
      return {
        variant: 'completed',
        icon: '✅',
        title: 'Scraping Completed Successfully',
        message: 'All students in the current batch have been processed successfully.',
        accent: 'var(--success)'
      };
    }

    if (jobState.status === 'cancelled') {
      return {
        variant: 'error',
        icon: '⛔',
        title: 'Scraping Cancelled',
        message: 'The current extraction job was stopped before completion.',
        accent: 'var(--danger)'
      };
    }

    if (jobState.status === 'failed') {
      return {
        variant: 'error',
        icon: '❌',
        title: 'Scraping Failed',
        message: 'The extraction could not be completed. Review the job details or retry with the same settings.',
        accent: 'var(--danger)'
      };
    }

    if (jobState.status === 'paused') {
      return {
        variant: 'warning',
        icon: '⏸️',
        title: 'Scraping Paused',
        message: 'Extraction paused safely after current student. All progress is preserved.',
        accent: 'var(--warning)'
      };
    }

    if (jobState.status === 'resumed') {
      return {
        variant: 'processing',
        icon: '▶️',
        title: 'Resuming Extraction...',
        message: 'Scraper resumed. Processing remaining students in batch.',
        accent: 'var(--success)'
      };
    }

    if (manualMode) {
      return {
        variant: 'manual',
        icon: '⚠️',
        title: 'Manual CAPTCHA Required',
        message: 'OCR could not solve the CAPTCHA after 12 attempts. A browser window has been opened automatically. Please solve the CAPTCHA manually. Scraping will continue automatically after successful submission.',
        accent: 'var(--warning)'
      };
    }

    if (restoredMode) {
      return {
        variant: 'restored',
        icon: '🟢',
        title: 'OCR Mode Restored',
        message: 'Manual CAPTCHA solved successfully. Returning to automatic OCR mode...',
        accent: 'var(--success)'
      };
    }

    if (isRunning) {
      if (hasProgress) {
        return {
          variant: 'processing',
          icon: '🟢',
          title: 'Processing Remaining Students...',
          message: 'The scraper is continuing OCR mode for the remaining students in the batch.',
          accent: 'var(--success)'
        };
      }

      return {
        variant: 'starting',
        icon: '🔵',
        title: 'Starting Scraper...',
        message: 'Preparing the browser session and beginning the extraction workflow.',
        accent: 'var(--info)'
      };
    }

    return {
      variant: 'ready',
      icon: '🟢',
      title: 'Ready',
      message: 'Scraper is idle and ready for the next extraction job.',
      accent: 'var(--success)'
    };
  }, [isRunning, jobState.status, jobState.processed, jobState.captcha_mode]);

  // Loading Screen
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: '#FFFFFF'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '18px',
          background: 'var(--primary-gradient)',
          fontWeight: '900',
          fontSize: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          animation: 'pulse 1.5s infinite'
        }}>
          R
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>Initializing ResultAI Authentication...</p>
      </div>
    );
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Redirect to Login if unauthenticated
  if (!isAuthenticated) {
    return <LoginPage theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (jobState.owner_id !== user?.id) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        Loading your scraping workspace…
      </div>
    );
  }

  const sgpaRanges = {
    '< 5.0': 0,
    '5.0-6.0': 0,
    '6.0-7.0': 0,
    '7.0-8.0': 0,
    '8.0-9.0': 0,
    '> 9.0': 0,
  };

  if (jobState.records && Array.isArray(jobState.records)) {
    jobState.records.forEach(rec => {
      if (rec.not_found || !rec.sgpa) return;
      const sgpaVal = parseFloat(rec.sgpa);
      if (isNaN(sgpaVal)) return;

      if (sgpaVal < 5.0) sgpaRanges['< 5.0']++;
      else if (sgpaVal < 6.0) sgpaRanges['5.0-6.0']++;
      else if (sgpaVal < 7.0) sgpaRanges['6.0-7.0']++;
      else if (sgpaVal < 8.0) sgpaRanges['7.0-8.0']++;
      else if (sgpaVal < 9.0) sgpaRanges['8.0-9.0']++;
      else sgpaRanges['> 9.0']++;
    });
  }

  const sgpaMax = Math.max(...Object.values(sgpaRanges), 1);

  const getLogStyle = (log) => {
    const l = log.toLowerCase();
    if (l.includes('guest@resultai') || l.startsWith('$')) {
      return { color: '#22C55E', fontWeight: '600' };
    }
    if (l.includes('[success]') || l.includes('successfully') || l.includes(' success')) {
      return { color: '#22C55E', fontWeight: '600' };
    }
    if (l.includes('[info]') || l.includes('[system]') || l.includes('[scraper]')) {
      return { color: '#3B82F6', fontWeight: '600' };
    }
    if (l.includes('failed') || l.includes('error') || l.includes('timeout') || l.includes('exception') || l.includes('terminated')) {
      return { color: '#EF4444' };
    }
    if (l.includes('warning') || l.includes('alert') || l.includes('action required') || l.includes('please solve')) {
      return { color: '#F59E0B' };
    }
    return { color: '#FFFFFF' };
  };

  return (
    <div className="app-container">
      <div className="grid-overlay"></div>

      {/* HEADER WITH USER PROFILE WIDGET */}
      <motion.header 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="app-header"
      >
        <div className="logo-container" onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src="/logo.png" 
            alt="ResultAI Logo" 
            onError={(e) => { e.target.src = "/logo.jpg"; }}
            style={{
              height: '38px',
              width: 'auto',
              borderRadius: '8px',
              objectFit: 'contain',
              background: '#FFFFFF',
              padding: '2px',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)'
            }} 
          />
          <span className="logo-text">ResultAI</span>
        </div>

        {/* Permanent Top Navigation Tabs */}
        <div className="header-nav-tabs">
          <button 
            className="tab-btn" 
            style={{
              background: (currentView === 'dashboard' && activeTab === 'extractor') ? 'var(--primary-gradient)' : 'transparent',
              color: (currentView === 'dashboard' && activeTab === 'extractor') ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '12px'
            }}
            onClick={() => {
              setCurrentView('dashboard');
              setActiveTab('extractor');
            }}
          >
            Result Extractor
          </button>
          <button 
            className="tab-btn" 
            style={{
              background: currentView === 'mid_sem_studio' ? 'var(--primary-gradient)' : 'transparent',
              color: currentView === 'mid_sem_studio' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '12px'
            }}
            onClick={() => setCurrentView('mid_sem_studio')}
          >
            📝 Mid-Sem Studio
          </button>
          <button 
            className="tab-btn" 
            style={{
              background: currentView === 'history' ? 'var(--primary-gradient)' : 'transparent',
              color: currentView === 'history' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '12px'
            }}
            onClick={() => setCurrentView('history')}
          >
            📜 Scraping History
          </button>

          {/* Tools ▾ Dropdown Menu */}
          <div ref={toolsDropdownRef} style={{ position: 'relative' }}>
            <button
              className="tab-btn"
              onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
              type="button"
              style={{
                background: isToolsActive ? 'var(--primary-gradient)' : 'transparent',
                color: isToolsActive ? '#FFFFFF' : 'var(--text-muted)',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🛠️ Tools</span>
              <svg 
                width="12" 
                height="12" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                viewBox="0 0 24 24"
                style={{
                  transform: toolsDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            <AnimatePresence>
              {toolsDropdownOpen && (
                <motion.div
                  className="tools-dropdown-menu-panel"
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                >
                  <button
                    type="button"
                    className={`tools-dropdown-item ${(currentView === 'dashboard' && activeTab === 'report') ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentView('dashboard');
                      setActiveTab('report');
                      setToolsDropdownOpen(false);
                    }}
                  >
                    <span>📄</span> AI Report Generator
                  </button>
                  <button
                    type="button"
                    className={`tools-dropdown-item ${(currentView === 'dashboard' && activeTab === 'cgpa') ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentView('dashboard');
                      setActiveTab('cgpa');
                      setToolsDropdownOpen(false);
                    }}
                  >
                    <span>🧮</span> CGPA Calculator
                  </button>
                  <button
                    type="button"
                    className={`tools-dropdown-item ${(currentView === 'dashboard' && activeTab === 'custom_export') ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentView('dashboard');
                      setActiveTab('custom_export');
                      setToolsDropdownOpen(false);
                    }}
                  >
                    <span>⚙️</span> Custom Export Studio
                  </button>
                  <button
                    type="button"
                    className={`tools-dropdown-item ${currentView === 'studio' ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentView('studio');
                      setToolsDropdownOpen(false);
                    }}
                  >
                    <span>📊</span> Result Compare Studio
                  </button>
                  <button
                    type="button"
                    className={`tools-dropdown-item ${currentView === 'file_converter' ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentView('file_converter');
                      setToolsDropdownOpen(false);
                    }}
                  >
                    <span>🔄</span> File Converter
                  </button>
                  <button
                    type="button"
                    className={`tools-dropdown-item ${currentView === 'rgpv_hub' ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentView('rgpv_hub');
                      setToolsDropdownOpen(false);
                    }}
                  >
                    <span>🎓</span> RGPV Student Hub
                  </button>

                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            className="tab-btn"
            style={{
              background: currentView === 'profile' ? 'var(--primary-gradient)' : 'transparent',
              color: currentView === 'profile' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setCurrentView('profile')}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            My Profile
          </button>
          <button
            className="tab-btn"
            style={{
              background: currentView === 'feedback' ? 'var(--primary-gradient)' : 'transparent',
              color: currentView === 'feedback' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setCurrentView('feedback')}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            💬 Feedback
          </button>
          <button
            className="tab-btn"
            style={{
              background: currentView === 'about' ? 'var(--primary-gradient)' : 'transparent',
              color: currentView === 'about' ? '#FFFFFF' : 'var(--text-muted)',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setCurrentView('about')}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
              <path d="M12 8v4" />
              <circle cx="12" cy="16" r="1" />
            </svg>
            About
          </button>
        </div>

        {/* Mobile Navigation Dropdown (Mobile screens ONLY <767px) */}
        <div className="mobile-nav-container" ref={mobileNavRef}>
          <button 
            className="mobile-nav-trigger"
            onClick={() => {
              const next = !mobileNavOpen;
              setMobileNavOpen(next);
              if (!next) setMobileNavSearch('');
            }}
            type="button"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              <span style={{ fontSize: '14px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}>{activeNavTitle}</span>
            </div>
            <svg 
              width="16" 
              height="16" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              viewBox="0 0 24 24"
              style={{
                transform: mobileNavOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
                flexShrink: 0
              }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <AnimatePresence>
            {mobileNavOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className="mobile-nav-drawer"
              >
                {/* Search Tools bar */}
                <div className="mobile-nav-search">
                  <span className="mobile-nav-search-icon">🔍</span>
                  <input
                    className="mobile-nav-search-input"
                    type="text"
                    placeholder="Search tools…"
                    value={mobileNavSearch}
                    onChange={e => setMobileNavSearch(e.target.value)}
                    autoComplete="off"
                  />
                  {mobileNavSearch && (
                    <button
                      type="button"
                      onClick={() => setMobileNavSearch('')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '0 2px', lineHeight: 1 }}
                    >✕</button>
                  )}
                </div>

                {/* Main nav items (filtered by search) */}
                {['Result Extractor', 'Mid-Sem Studio', 'Scraping History'].filter(label =>
                  !mobileNavSearch.trim() || label.toLowerCase().includes(mobileNavSearch.toLowerCase())
                ).map(label => {
                  const iconMap = { 'Result Extractor': '⚡', 'Mid-Sem Studio': '📝', 'Scraping History': '📜' };
                  const isActive =
                    (label === 'Result Extractor' && currentView === 'dashboard' && activeTab === 'extractor') ||
                    (label === 'Mid-Sem Studio' && currentView === 'mid_sem_studio') ||
                    (label === 'Scraping History' && currentView === 'history');
                  return (
                    <button
                      key={label}
                      className={`mobile-nav-item${isActive ? ' active' : ''}`}
                      onClick={() => {
                        if (label === 'Result Extractor') { setCurrentView('dashboard'); setActiveTab('extractor'); }
                        if (label === 'Mid-Sem Studio') setCurrentView('mid_sem_studio');
                        if (label === 'Scraping History') setCurrentView('history');
                        setMobileNavOpen(false);
                        setMobileNavSearch('');
                      }}
                    >
                      <span className="mn-icon">{iconMap[label]}</span>
                      {label}
                    </button>
                  );
                })}

                {/* Tools & Utilities collapsible section */}
                {(() => {
                  const toolItems = [
                    { label: 'AI Report Generator', icon: '📄', action: () => { setCurrentView('dashboard'); setActiveTab('report'); } },
                    { label: 'CGPA Calculator', icon: '🧮', action: () => { setCurrentView('dashboard'); setActiveTab('cgpa'); } },
                    { label: 'Custom Export Studio', icon: '⚙️', action: () => { setCurrentView('dashboard'); setActiveTab('custom_export'); } },
                    { label: 'Result Compare Studio', icon: '📊', action: () => setCurrentView('studio') },
                    { label: 'File Converter', icon: '🔄', action: () => setCurrentView('file_converter') },
                    { label: 'RGPV Student Hub', icon: '🎓', action: () => setCurrentView('rgpv_hub') },
                  ];
                  const filteredTools = mobileNavSearch.trim()
                    ? toolItems.filter(t => t.label.toLowerCase().includes(mobileNavSearch.toLowerCase()))
                    : toolItems;
                  const isToolActive = (item) => {
                    if (item.label === 'AI Report Generator') return currentView === 'dashboard' && activeTab === 'report';
                    if (item.label === 'CGPA Calculator') return currentView === 'dashboard' && activeTab === 'cgpa';
                    if (item.label === 'Custom Export Studio') return currentView === 'dashboard' && activeTab === 'custom_export';
                    if (item.label === 'Result Compare Studio') return currentView === 'studio';
                    if (item.label === 'File Converter') return currentView === 'file_converter';
                    if (item.label === 'RGPV Student Hub') return currentView === 'rgpv_hub';
                    return false;
                  };
                  // Show section if no search, or if search has tool matches
                  if (filteredTools.length === 0) return null;
                  return (
                    <>
                      {/* Section header – hidden when searching so tools appear inline */}
                      {!mobileNavSearch.trim() && (
                        <button
                          className="mobile-nav-section-header"
                          onClick={() => setToolsSectionOpen(o => !o)}
                          type="button"
                        >
                          <span>🛠️ Tools & Utilities</span>
                          <svg
                            className={`mobile-nav-section-chevron${toolsSectionOpen ? ' open' : ''}`}
                            width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                          >
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </button>
                      )}
                      {/* Tool items */}
                      <AnimatePresence initial={false}>
                        {(toolsSectionOpen || mobileNavSearch.trim()) && (
                          <motion.div
                            key="tools-list"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px' }}
                          >
                            {filteredTools.map(item => (
                              <button
                                key={item.label}
                                className={`mobile-nav-item${isToolActive(item) ? ' active' : ''}`}
                                onClick={() => {
                                  item.action();
                                  setMobileNavOpen(false);
                                  setMobileNavSearch('');
                                }}
                              >
                                <span className="mn-icon">{item.icon}</span>
                                {item.label}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  );
                })()}

                <div style={{ height: '1px', background: 'var(--card-border)', margin: '4px 0' }}></div>

                {/* Profile, Feedback & About */}
                {['My Profile', 'Feedback', 'About'].filter(label =>
                  !mobileNavSearch.trim() || label.toLowerCase().includes(mobileNavSearch.toLowerCase())
                ).map(label => {
                  const iconMap = { 'My Profile': '👤', 'Feedback': '💬', 'About': 'ℹ️' };
                  const isActive =
                    (label === 'My Profile' && currentView === 'profile') ||
                    (label === 'Feedback' && currentView === 'feedback') ||
                    (label === 'About' && currentView === 'about');
                  return (
                    <button
                      key={label}
                      className={`mobile-nav-item${isActive ? ' active' : ''}`}
                      onClick={() => {
                        if (label === 'My Profile') setCurrentView('profile');
                        if (label === 'Feedback') setCurrentView('feedback');
                        if (label === 'About') setCurrentView('about');
                        setMobileNavOpen(false);
                        setMobileNavSearch('');
                      }}
                    >
                      <span className="mn-icon">{iconMap[label]}</span>
                      {label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="header-actions" style={{ position: 'relative' }}>
          {/* Theme Toggle Button */}
          <button 
            className="theme-toggle-btn"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>

          {/* Job Status Badge */}
          <div className="status-badge" style={{
            borderColor: isRunning ? 'var(--success)' : 'var(--card-border)',
            background: isRunning ? 'var(--success-bg)' : 'rgba(255,255,255,0.03)',
            color: isRunning ? 'var(--success)' : 'var(--text-muted)'
          }}>
            <span className={`dot ${isRunning ? 'pulse' : ''}`} style={{
              background: isRunning ? 'var(--success)' : 
                         jobState.status === 'completed' ? 'var(--info)' : 
                         jobState.status === 'cancelled' ? 'var(--danger)' : '#64748b'
            }}></span>
            {jobState.status}
          </div>

          {/* CAPTCHA Mode Badge */}
          {isRunning && jobState.captcha_mode && (
            <div className="status-badge" style={{
              borderColor: jobState.captcha_mode === 'manual' ? '#F59E0B' : 'var(--success)',
              background: jobState.captcha_mode === 'manual' ? 'rgba(245,158,11,0.12)' : 'var(--success-bg)',
              color: jobState.captcha_mode === 'manual' ? '#F59E0B' : 'var(--success)'
            }}>
              <span className={`dot ${jobState.captcha_mode === 'manual' ? 'pulse' : ''}`} style={{
                background: jobState.captcha_mode === 'manual' ? '#F59E0B' : 'var(--success)'
              }}></span>
              {captchaModeLabel[jobState.captcha_mode] || captchaModeLabel.ocr}
            </div>
          )}

          {/* TOP-RIGHT USER PROFILE AVATAR WIDGET */}
          <div ref={userDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--card-border)',
                padding: '4px 10px 4px 6px',
                borderRadius: '20px',
                color: 'var(--title-color)',
                cursor: 'pointer'
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--primary-gradient)',
                color: '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: user?.profile_image && user?.profile_image.length <= 4 ? '15px' : '12px',
                fontWeight: '800',
                overflow: 'hidden'
              }}>
                {user?.profile_image && (user?.profile_image.startsWith('http') || user?.profile_image.startsWith('data:image')) ? (
                  <img src={user.profile_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : user?.profile_image || user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className="user-name-label" style={{ fontSize: '13px', fontWeight: '700' }}>{user?.name || 'Admin'}</span>
              <svg 
                className="user-chevron"
                width="14" 
                height="14" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                viewBox="0 0 24 24"
                style={{
                  transform: userDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* User Dropdown Menu */}
            <AnimatePresence>
              {userDropdownOpen && (
                <motion.div
                  className="user-dropdown-menu-panel"
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '42px',
                    width: '210px',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '14px',
                    padding: '8px',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                    zIndex: 100,
                    backdropFilter: 'blur(16px)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 10px', borderBottom: '1px solid var(--card-border)', marginBottom: '4px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)' }}>{user?.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.email}</p>
                    </div>
                    <button 
                      onClick={() => setUserDropdownOpen(false)}
                      title="Close Menu (Esc)"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = 'var(--danger)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      ✕
                    </button>
                  </div>

                  <button
                    onClick={() => { setCurrentView('profile'); setUserDropdownOpen(false); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 10px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    👤 My Profile & Security
                  </button>

                  <button
                    onClick={() => { setCurrentView('mid_sem_studio'); setUserDropdownOpen(false); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 10px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    📝 Mid-Sem Studio
                  </button>


                  <button
                    onClick={() => { setCurrentView('history'); setUserDropdownOpen(false); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 10px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    📜 Scraping History & Logs
                  </button>

                  <button
                    onClick={() => { setCurrentView('dashboard'); setUserDropdownOpen(false); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 10px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    ⚡ Scraper Dashboard
                  </button>

                  <div style={{ height: '1px', background: 'var(--card-border)', margin: '4px 0' }}></div>

                  <button
                    onClick={logout}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '8px 10px',
                      color: 'var(--danger)',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    🚪 Sign Out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {/* RENDER CURRENT VIEW */}
      {currentView === 'profile' && (
        <ProfilePage onBackToDashboard={() => setCurrentView('dashboard')} />
      )}

      {currentView === 'history' && (
        <HistoryPage
          key={user?.id}
          onBackToDashboard={() => { setCurrentView('dashboard'); setActiveTab('extractor'); }}
          onRerunJob={(job) => {
            if (job.prefix) setPrefix(job.prefix);
            if (job.start_roll) setStart(String(job.start_roll));
            if (job.end_roll) setEnd(String(job.end_roll));
            if (job.pad) setPad(String(job.pad));
            if (job.sem !== undefined) setSem(job.sem || '');
            if (job.program) setProgram(job.program);
            setCurrentView('dashboard');
            setActiveTab('extractor');
            info(`Pre-filled configuration for ${job.job_id}. Click Start Extraction to run!`);
          }}
        />
      )}

      {currentView === 'feedback' && (
        <FeedbackPage />
      )}

      {currentView === 'about' && (
        <AboutPage />
      )}

      {currentView === 'rgpv_hub' && (
        <motion.div
          key="rgpv_hub"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}
        >
          <RgpvStudentHub theme={theme} />
        </motion.div>
      )}

      {currentView === 'file_converter' && (
        <motion.div
          key="file_converter"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          style={{ width: '100%', padding: '0 20px', boxSizing: 'border-box' }}
        >
          <FileConverterPage onBackToDashboard={() => setCurrentView('dashboard')} />
        </motion.div>
      )}



      {currentView === 'mid_sem_studio' && (
        <MidSemStudio theme={theme} />
      )}

      {currentView === 'subject_marks_manager' && (
        <MidSemStudio theme={theme} initialTab="subject_marks_manager" />
      )}

      {currentView === 'studio' && (
        <ResultCompareStudio />
      )}

      {currentView === 'dashboard' && activeTab === 'report' && (
        <AiReportGenerator jobState={jobState} />
      )}

      {currentView === 'dashboard' && activeTab === 'cgpa' && (
        <motion.div
          key="cgpa"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          style={{ maxWidth: '1120px', margin: '0 auto', width: '100%' }}
        >
          <CgpaCalculator />
        </motion.div>
      )}

      {currentView === 'dashboard' && activeTab === 'custom_export' && (
        <motion.div
          key="custom_export"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}
        >
          <CustomExportPage
            sessionRecords={jobState.records}
            currentExportConfig={customExportConfig}
            onSaveExportConfig={(cfg) => setCustomExportConfig(cfg)}
          />
        </motion.div>
      )}

      {currentView === 'dashboard' && activeTab === 'extractor' && (
        <div className="dashboard-grid">
          <aside className="extraction-panel-aside">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '6px' }}>
              <h2 className="form-title" style={{ margin: 0 }}>Extraction Panel</h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                {jobState.status !== 'idle' && !isRunning && !isPaused && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleReset}
                    title="Reset current scrape session"
                    style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)', borderColor: 'var(--warning)' }}
                  >
                    🔄 Reset
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCurrentView('history')}
                  style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  📜 History
                </button>
              </div>
            </div>
            <form onSubmit={handleStart}>
              <div className="form-group">
                <label htmlFor="prefix">Enrollment Prefix</label>
                <input 
                  id="prefix"
                  type="text" 
                  value={prefix} 
                  onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                  placeholder="e.g. 0105IT2410"
                  disabled={isRunning}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="start">Start Roll</label>
                  <input 
                    id="start"
                    type="number" 
                    value={start} 
                    onChange={(e) => setStart(e.target.value)}
                    min="1"
                    disabled={isRunning}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="end">End Roll</label>
                  <input 
                    id="end"
                    type="number" 
                    value={end} 
                    onChange={(e) => setEnd(e.target.value)}
                    min="1"
                    disabled={isRunning}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="pad">Padding</label>
                  <input 
                    id="pad"
                    type="number" 
                    value={pad} 
                    onChange={(e) => setPad(e.target.value)}
                    min="1"
                    disabled={isRunning}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="sem">Semester</label>
                  <CustomSelect
                    id="sem"
                    value={sem}
                    onChange={(e) => setSem(e.target.value)}
                    disabled={isRunning}
                    options={getSemesterOptionsForProgram(program)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label htmlFor="program">Program</label>
                <CustomSelect
                  id="program"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  disabled={isRunning}
                  options={PROGRAM_OPTIONS}
                />
              </div>

              {isStarting ? (
                <button className="btn btn-primary" type="button" disabled style={{ flex: 1, opacity: 0.7 }}>
                  Starting extraction…
                </button>
              ) : !isRunning && !isPaused ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-primary" 
                    type="submit"
                    style={{ flex: 1 }}
                  >
                    {jobState.status === 'completed' || jobState.status === 'cancelled' || jobState.status === 'failed' ? '🚀 Start New Extraction' : 'Start Extraction'}
                  </motion.button>
                  {jobState.status !== 'idle' && (
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="btn btn-secondary" 
                      type="button"
                      onClick={handleReset}
                      style={{ padding: '0 14px', fontSize: '13px' }}
                      title="Reset scrape session state"
                    >
                      🔄 Reset
                    </motion.button>
                  )}
                </div>
              ) : isPaused ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-primary" 
                    type="button"
                    onClick={handleResume}
                    style={{ flex: 1 }}
                  >
                    ▶️ Resume
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-danger" 
                    type="button" 
                    onClick={handleCancel}
                    style={{ flex: 1 }}
                  >
                    ⛔ Stop
                  </motion.button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-secondary" 
                    type="button"
                    onClick={handlePause}
                    style={{ flex: 1, borderColor: 'var(--warning)', color: 'var(--warning)' }}
                  >
                    ⏸️ Pause
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="btn btn-danger" 
                    type="button" 
                    onClick={handleCancel}
                    style={{ flex: 1 }}
                  >
                    ⛔ Stop
                  </motion.button>
                </div>
              )}
            </form>

            {/* ── Import Existing Excel Card ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              style={{
                marginTop: '20px',
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '14px',
                padding: '18px',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>📂</span>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '0.3px' }}>Import Existing Excel</span>
                </div>
                {importFile && (
                  <button
                    type="button"
                    onClick={() => { setImportFile(null); setImportStatus('idle'); setImportInfo(null); setImportError(''); setImportEndRoll(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1 }}
                    title="Clear import"
                  >✕</button>
                )}
              </div>

              {/* Drag & Drop Zone */}
              <div
                onDrop={handleImportDrop}
                onDragOver={handleImportDragOver}
                onDragLeave={handleImportDragLeave}
                onClick={() => importFileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? 'var(--primary)' : importStatus === 'valid' ? 'var(--success)' : importStatus === 'invalid' ? 'var(--danger)' : 'var(--card-border)'}`,
                  borderRadius: '10px',
                  padding: '16px 12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragOver ? 'var(--primary-bg, rgba(99,102,241,0.07))' : importStatus === 'valid' ? 'var(--success-bg, rgba(34,197,94,0.06))' : importStatus === 'invalid' ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
                />
                {importStatus === 'validating' ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>⏳</div>
                    Validating file…
                  </div>
                ) : importStatus === 'valid' ? (
                  <div style={{ color: 'var(--success)', fontSize: '12px' }}>
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>✅</div>
                    <strong style={{ fontSize: '12px' }}>{importFile?.name}</strong>
                  </div>
                ) : importStatus === 'invalid' ? (
                  <div style={{ color: 'var(--danger)', fontSize: '12px' }}>
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>⚠️</div>
                    <span style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '11px' }}>{importFile?.name}</span>
                    {importError}
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>📊</div>
                    <div style={{ marginBottom: '6px' }}>Drag & drop <strong>.xlsx</strong> file here</div>
                    <div style={{ marginBottom: '8px', color: 'var(--text-muted)', fontSize: '11px', opacity: 0.6 }}>— or —</div>
                    <div style={{
                      display: 'inline-block',
                      padding: '5px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--card-border)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}>
                      Choose Excel (.xlsx)
                    </div>
                  </div>
                )}
              </div>

              {/* Info banner when valid */}
              {importStatus === 'valid' && importInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  style={{
                    marginTop: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--success-bg, rgba(34,197,94,0.08))',
                    border: '1px solid rgba(34,197,94,0.25)',
                    fontSize: '11.5px',
                    color: 'var(--success)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span>🔖 <strong>Last Record:</strong> {importInfo.last_enrollment}</span>
                    <span>➡️ <strong>Next Start:</strong> {importInfo.prefix}{String(importInfo.next_start_roll).padStart(importInfo.pad, '0')}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                    📊 {importInfo.existing_count} existing records will be carried forward
                  </div>
                </motion.div>
              )}

              {/* Error banner when invalid and a file was selected */}
              {importStatus === 'invalid' && importError && !importFile && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--danger)' }}>
                  {importError}
                </div>
              )}

              {/* End Roll input + Continue button (only when valid) */}
              {importStatus === 'valid' && importInfo && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ marginTop: '12px' }}
                >
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label htmlFor="importEndRoll" style={{ fontSize: '11px', marginBottom: '4px', display: 'block', color: 'var(--text-muted)' }}>
                      End Roll <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(continue scraping up to)</span>
                    </label>
                    <input
                      id="importEndRoll"
                      type="number"
                      value={importEndRoll}
                      min={importInfo.next_start_roll}
                      onChange={(e) => setImportEndRoll(e.target.value)}
                      placeholder={`Min: ${importInfo.next_start_roll}`}
                      style={{ width: '100%', fontSize: '13px' }}
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={handleContinueExtraction}
                    disabled={isContinuing || isRunning || isPaused || !importEndRoll || parseInt(importEndRoll) < importInfo.next_start_roll}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: (isContinuing || isRunning || isPaused) ? 'var(--card-border)' : 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: (isContinuing || isRunning || isPaused) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      transition: 'all 0.2s ease',
                      boxShadow: (isContinuing || isRunning || isPaused) ? 'none' : '0 4px 14px rgba(16,185,129,0.3)',
                    }}
                  >
                    {isContinuing ? '⏳ Starting…' : (isRunning || isPaused) ? '🔒 Job In Progress' : '▶ Continue Extraction'}
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
            </motion.div>
          </aside>


          <motion.main 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}
          >
            {/* METRIC COUNTERS */}
            <section className="metrics-row">
              <ScrapingTimerWidget jobStatus={jobState.status} processedCount={jobState.processed} />
              <div className="metric-card" style={{ '--accent-color': 'var(--primary)' }}>
                <div className="metric-header"><span className="metric-label">Processed</span></div>
                <div className="metric-value">{jobState.processed} / {jobState.total}</div>
              </div>
              <div className="metric-card" style={{ '--accent-color': 'var(--success)' }}>
                <div className="metric-header"><span className="metric-label">Passed</span></div>
                <div className="metric-value" style={{ color: 'var(--success)' }}>{jobState.pass_count}</div>
              </div>
              <div className="metric-card" style={{ '--accent-color': 'var(--danger)' }}>
                <div className="metric-header"><span className="metric-label">Failed</span></div>
                <div className="metric-value" style={{ color: 'var(--danger)' }}>{jobState.fail_count}</div>
              </div>
              <div className="metric-card" style={{ '--accent-color': '#64748b' }}>
                <div className="metric-header"><span className="metric-label">Not Found</span></div>
                <div className="metric-value" style={{ color: '#94A3B8' }}>{jobState.not_found_count}</div>
              </div>
              <div className="metric-card" style={{ '--accent-color': 'var(--warning)' }}>
                <div className="metric-header"><span className="metric-label">Errors</span></div>
                <div className="metric-value" style={{ color: 'var(--warning)' }}>{jobState.error_count}</div>
              </div>
            </section>

            <motion.section
              key={`${jobState.status}-${jobState.captcha_mode}-${jobState.current_enrollment || 'idle'}`}
              className={`scraping-status-banner ${scrapingStatusBanner.variant}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              style={{ borderColor: scrapingStatusBanner.accent }}
            >
              <div className="scraping-status-banner__header">
                <div
                  className="scraping-status-banner__icon"
                  style={{
                    background: scrapingStatusBanner.variant === 'manual'
                      ? 'rgba(245, 158, 11, 0.18)'
                      : scrapingStatusBanner.variant === 'starting'
                        ? 'rgba(56, 189, 248, 0.18)'
                        : 'rgba(34, 197, 94, 0.18)',
                    color: scrapingStatusBanner.accent,
                    borderColor: scrapingStatusBanner.accent
                  }}
                >
                  {scrapingStatusBanner.icon}
                </div>
                <div className="scraping-status-banner__content">
                  <div className="scraping-status-banner__title">{scrapingStatusBanner.title}</div>
                  <div className="scraping-status-banner__message">{scrapingStatusBanner.message}</div>
                  {jobError && (
                    <div role="alert" style={{ marginTop: '8px', color: 'var(--danger)', fontSize: '12px' }}>
                      {jobError}{' '}
                      <button type="button" className="btn btn-secondary" onClick={() => setStatusRetryCount(count => count + 1)} style={{ width: 'auto', padding: '4px 9px', fontSize: '11px' }}>
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="scraping-status-banner__stats">
                <div className="status-chip">
                  <span>Current Student</span>
                  <strong>{(isRunning || isPaused) && jobState.current_enrollment ? jobState.current_enrollment : 'No extraction running'}</strong>
                </div>
                <div className="status-chip">
                  <span>Current Enrollment Number</span>
                  <strong>{(isRunning || isPaused) && jobState.current_enrollment ? jobState.current_enrollment : 'No extraction running'}</strong>
                </div>
                <div className="status-chip">
                  <span>Current Mode</span>
                  <strong>{jobState.captcha_mode === 'manual' ? 'Manual CAPTCHA' : jobState.captcha_mode === 'ocr_restored' ? 'OCR Restored' : 'OCR'}</strong>
                </div>
                <div className="status-chip">
                  <span>OCR</span>
                  <strong>{scrapingStatusBanner.variant === 'manual' ? 'Retry Exhausted' : 'Active'}</strong>
                </div>
                <div className="status-chip">
                  <span>Manual CAPTCHA</span>
                  <strong>{scrapingStatusBanner.variant === 'manual' ? 'Required' : 'Pending'}</strong>
                </div>
                <div className="status-chip">
                  <span>Completed</span>
                  <strong>{jobState.processed || 0} / {jobState.total || 0}</strong>
                </div>
              </div>
            </motion.section>

            {/* LIVE TERMINAL LOGS WITH USER MODE / DEV MODE TOGGLE */}
            <section className="glass-panel terminal-card">
              <div className="terminal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--card-border)' }}>
                <div className="terminal-header-title-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--title-color)' }}>Terminal Logger</span>
                  <span className="terminal-badge-text" style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: devMode ? 'rgba(124, 58, 237, 0.2)' : 'rgba(34, 197, 94, 0.15)',
                    color: devMode ? '#C7D2FE' : '#22C55E',
                    border: devMode ? '1px solid rgba(124, 58, 237, 0.4)' : '1px solid rgba(34, 197, 94, 0.3)'
                  }}>
                    {devMode ? '🛠️ Developer Mode (Raw Logs)' : '✨ User Mode (Event View)'}
                  </span>
                </div>

                <div className="terminal-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Developer Mode Toggle */}
                  <button
                    type="button"
                    onClick={() => setDevMode(!devMode)}
                    title={devMode ? "Switch to User Mode (Important Events Only)" : "Switch to Developer Mode (Raw Verbose Logs)"}
                    style={{
                      background: devMode ? 'rgba(124, 58, 237, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                      border: devMode ? '1px solid #818CF8' : '1px solid var(--card-border)',
                      color: devMode ? '#FFFFFF' : 'var(--text-muted)',
                      borderRadius: '7px',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: '750',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {devMode ? '🛠️ Dev Mode: ON' : '🛠️ Enable Dev Mode'}
                  </button>

                  {/* Copy Logs Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!jobState.logs || jobState.logs.length === 0) return;
                      const textToCopy = devMode
                        ? jobState.logs.join('\n')
                        : userLogs.map(item => `${item.icon} ${item.text}`).join('\n');
                      navigator.clipboard.writeText(textToCopy);
                      success("Terminal logs copied to clipboard!");
                    }}
                    title="Copy Logs to Clipboard"
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid var(--card-border)',
                      color: 'var(--text-main)',
                      borderRadius: '7px',
                      padding: '4px 9px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    📋 Copy
                  </button>

                  {/* Clear Logs Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setJobState(prev => ({ ...prev, logs: [] }));
                      info("Terminal logs cleared.");
                    }}
                    title="Clear Terminal View"
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#EF4444',
                      borderRadius: '7px',
                      padding: '4px 9px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ Clear
                  </button>
                </div>
              </div>

              <div className="terminal-viewport">
                {devMode ? (
                  /* DEVELOPER MODE: RAW VERBOSE LOGS */
                  !jobState.logs || jobState.logs.length === 0 ? (
                    <div className="terminal-line" style={{ color: 'var(--text-muted)' }}>
                      [Developer Mode] Terminal ready. Waiting for backend stdout stream...
                    </div>
                  ) : (
                    jobState.logs.map((log, idx) => (
                      <div className="terminal-line" key={idx} style={getLogStyle(log)}>
                        <span style={{ opacity: 0.3, marginRight: '10px', fontFamily: 'monospace' }}>{(idx + 1).toString().padStart(3, '0')}</span>
                        {log}
                      </div>
                    ))
                  )
                ) : (
                  /* DEFAULT USER MODE: CONCISE & IMPORTANT EVENTS ONLY */
                  userLogs.length === 0 ? (
                    <div className="terminal-line" style={{ color: 'var(--text-muted)' }}>
                      [System] Ready. Configure scraper inputs to begin.
                    </div>
                  ) : (
                    userLogs.map((item, idx) => (
                      <div className="terminal-line" key={idx} style={{ color: item.color, fontWeight: item.bold ? '800' : '600', display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0' }}>
                        <span style={{ fontSize: '14px', lineHeight: 1 }}>{item.icon}</span>
                        <span style={{ opacity: 0.3, fontSize: '11px', fontFamily: 'monospace', minWidth: '24px' }}>{(idx + 1).toString().padStart(2, '0')}</span>
                        <span>{item.text}</span>
                      </div>
                    ))
                  )
                )}
                <div ref={terminalEndRef} />
              </div>
            </section>

            {/* REAL-TIME BATCH TOPPERS WIDGET */}
            {toppers.length > 0 && (
              <section className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(79,70,229,0.03) 100%)', border: '1px solid rgba(124,58,237,0.25)', boxShadow: '0 8px 30px rgba(124,58,237,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '22px' }}>🏆</span>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '850', color: 'var(--title-color)', margin: 0 }}>Batch Top Performers (CGPA Rank)</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Highest CGPA rank holders calculated from current extracted results</p>
                    </div>
                  </div>
                  <span className="badge pass" style={{ fontSize: '11px', padding: '4px 10px' }}>Real-time Rank Leaderboard</span>
                </div>

                <div className="toppers-grid">
                  {toppers.map((t, idx) => {
                    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                    const rankColor = idx === 0 ? "#F59E0B" : idx === 1 ? "#94A3B8" : "#B45309";
                    return (
                      <div key={t.enrollment} style={{
                        background: 'var(--card-bg)',
                        border: `1px solid ${idx === 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--card-border)'}`,
                        borderRadius: '14px',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        boxShadow: idx === 0 ? '0 6px 20px rgba(245, 158, 11, 0.12)' : 'none'
                      }}>
                        <div style={{ fontSize: '28px', lineHeight: 1 }}>{medal}</div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '900', color: rankColor, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', border: `1px solid ${rankColor}40` }}>
                              #{idx + 1} TOPPER
                            </span>
                            {t.result === 'PASS' && <span style={{ fontSize: '10px', color: '#10B981', fontWeight: '750' }}>PASS</span>}
                          </div>
                          <p style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--title-color)', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', margin: '4px 0 0 0' }}>
                            {t.name}
                          </p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', margin: '2px 0 0 0' }}>{t.enrollment}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '18px', fontWeight: '900', color: 'var(--primary)', margin: 0 }}>{t.cgpa || t.sgpa}</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', margin: 0 }}>CGPA</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* DATA VALIDATION REPORT CARD */}
            <DataValidationReportWidget report={effectiveValidationReport} />

            {/* STUDENTS RESULTS GRID */}
            <section className="glass-panel">
              <div className="table-section-header">
                <h3 style={{ fontSize: '16px', fontWeight: '800' }}>Extracted Student Records</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setShowCustomExportModal(true)} 
                    style={{ width: 'auto', padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ⚙️ Custom Export
                  </button>
                  {jobState.excel_file_path && (
                    <button className="btn btn-secondary" onClick={handleDownload} style={{ width: 'auto', padding: '6px 14px', fontSize: '13px' }}>
                      📥 Download Excel
                    </button>
                  )}
                  {jobState.status !== 'idle' && !isRunning && !isPaused && (
                    <button className="btn btn-primary" onClick={handleReset} style={{ width: 'auto', padding: '6px 14px', fontSize: '13px' }}>
                      🔄 Start New Extraction
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Filter by Enrollment
                  </label>
                  <input 
                    type="text" 
                    placeholder="Search enrollment..." 
                    value={filterEnrollment}
                    onChange={(e) => setFilterEnrollment(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Filter by Student Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="Search student name..." 
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Filter by Result
                  </label>
                  <CustomSelect
                    value={filterResult}
                    onChange={(e) => setFilterResult(e.target.value)}
                    options={[
                      { value: 'ALL', label: 'All Results' },
                      { value: 'PASS', label: 'PASS' },
                      { value: 'FAIL', label: 'FAIL' },
                      { value: 'NOT_FOUND', label: 'Not Found' }
                    ]}
                  />
                </div>
              </div>

              {!jobState.records || jobState.records.length === 0 ? (
                isRunning ? (
                  <div className="table-wrapper" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Enrollment</th>
                          <th>Student Name</th>
                          <th>Result</th>
                          <th>SGPA</th>
                          <th>CGPA</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <tr key={i}>
                            <td><div className="skeleton skeleton-text" style={{ width: '110px' }}></div></td>
                            <td><div className="skeleton skeleton-text" style={{ width: '150px' }}></div></td>
                            <td><div className="skeleton skeleton-badge"></div></td>
                            <td><div className="skeleton skeleton-text" style={{ width: '45px' }}></div></td>
                            <td><div className="skeleton skeleton-text" style={{ width: '45px' }}></div></td>
                            <td><div className="skeleton skeleton-btn"></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '40px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)' }}>No records loaded yet. Click "Start Extraction" to scrape.</p>
                  </div>
                )
              ) : (
                <div className="table-wrapper" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                  {filteredRecords.length === 0 ? (
                    <div className="empty-state" style={{ padding: '30px', textAlign: 'center' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No records match the selected filter criteria.</p>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => { setFilterEnrollment(''); setFilterName(''); setFilterResult('ALL'); }}
                        style={{ width: 'auto', padding: '6px 14px', fontSize: '12px', marginTop: '8px' }}
                      >
                        Clear Filters
                      </button>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Enrollment</th>
                          <th>Student Name</th>
                          <th>Result</th>
                          <th>SGPA</th>
                          <th>CGPA</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((rec, idx) => (
                          <tr key={idx}>
                            <td className="subject-code">{rec.enrollment}</td>
                            <td>{rec.not_found ? '—' : rec.name}</td>
                            <td>
                              {rec.not_found ? <span className="badge not-found">Not Found</span> : rec.result === 'PASS' ? <span className="badge pass">PASS</span> : <span className="badge fail">FAIL</span>}
                            </td>
                            <td style={{ fontWeight: '700' }}>{rec.not_found ? '—' : (rec.sgpa || 'N/A')}</td>
                            <td style={{ fontWeight: '700' }}>{rec.not_found ? '—' : (rec.cgpa || 'N/A')}</td>
                            <td>
                              {!rec.not_found && (
                                <button className="btn btn-secondary" onClick={() => setSelectedRecord(rec)} style={{ padding: '4px 10px', fontSize: '11px', width: 'auto' }}>
                                  View Grades
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>
          </motion.main>
        </div>
      )}

      {/* STUDENT GRADES DETAIL MODAL */}
      <AnimatePresence>
        {selectedRecord && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setSelectedRecord(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800' }}>{selectedRecord.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{selectedRecord.enrollment}</p>
                </div>
                <button className="modal-close" onClick={() => setSelectedRecord(null)}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '16px 0' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SGPA</span>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: 'var(--title-color)' }}>{selectedRecord.sgpa || 'N/A'}</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CGPA</span>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: 'var(--title-color)' }}>{selectedRecord.cgpa || 'N/A'}</p>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', fontWeight: '800', marginBottom: '8px' }}>Subject Grades</h4>
              <div className="table-wrapper" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Subject Code</th><th>Grade</th></tr>
                  </thead>
                  <tbody>
                    {selectedRecord.subjects && Object.entries(selectedRecord.subjects).map(([code, grade], i) => (
                      <tr key={i}>
                        <td className="subject-code">{code}</td>
                        <td style={{ fontWeight: '700', color: ['F', 'FAIL', 'AB'].includes(grade) ? 'var(--danger)' : 'var(--title-color)' }}>{grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedRecord(null)} style={{ flex: 1 }}>Close</button>
                <button className="btn btn-primary" onClick={() => downloadStudentPDF(selectedRecord)} style={{ flex: 1 }}>Download PDF</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CUSTOM EXPORT MODAL OVERLAY */}
      <AnimatePresence>
        {showCustomExportModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowCustomExportModal(false)}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="modal-content" 
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '1100px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
            >
              <CustomExportPage
                sessionRecords={jobState.records}
                currentExportConfig={customExportConfig}
                onSaveExportConfig={(cfg) => {
                  setCustomExportConfig(cfg);
                  setShowCustomExportModal(false);
                }}
                onCloseModal={() => setShowCustomExportModal(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SessionExpiryModal />
      <SupportAssistant key={user?.id} jobState={jobState} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
        <ToastContainer />
      </AuthProvider>
    </ToastProvider>
  );
}
