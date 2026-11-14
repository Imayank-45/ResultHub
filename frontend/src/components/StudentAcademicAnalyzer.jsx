import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE } from '../context/AuthContext';

// Helper to clean messy or concatenated subject names
const cleanSubjectName = (name, code) => {
  if (!name || name === code) return code || 'Subject';
  const nameUpper = name.toUpperCase().trim();
  
  const isGarbage = anyWordMatch(nameUpper, ["EXAMINATION", "BACHELOR OF TECHNOLOGY", "ROLL NO", "INSTT.", "SEMESTER :", "STATUS :", "RESULT :", "ENGLISH FOR COMMUNICATION"]);
  
  const codeMap = {
    "BT101": "Engineering Mathematics-I",
    "BT102": "Engineering Physics",
    "BT103": "Engineering Chemistry",
    "BT104": "Basic Electrical & Electronics Engg.",
    "BT105": "Engineering Graphics",
    "BT201": "Engineering Mathematics-II",
    "BT202": "Basic Mechanical Engineering",
    "BT203": "Basic Civil Engineering & Mechanics",
    "BT204": "Basic Computer Engineering",
    "BT205": "Language Lab & Seminars",
    "ES301": "Energy & Environmental Engineering",
    "CS301": "Data Structures",
    "CS302": "Discrete Structure",
    "CS303": "Object Oriented Programming & Methodology",
    "CS304": "Digital Circuits & Systems",
    "IT301": "Data Structures",
    "IT302": "Discrete Structure",
    "IT303": "Object Oriented Programming & Methodology",
    "IT304": "Digital Circuits & Systems",
    "CS401": "Operating Systems",
    "CS402": "Analysis & Design of Algorithms",
    "CS403": "Software Engineering"
  };

  if (code && codeMap[code]) {
    return codeMap[code];
  }

  if (isGarbage || name.length > 45) {
    const cleanStr = name.replace(/\s+/g, ' ').slice(0, 38).trim();
    return isGarbage ? `Subject ${code || ''}` : `${cleanStr}...`;
  }

  return name;
};

const anyWordMatch = (str, keywords) => {
  return keywords.some(kw => str.includes(kw));
};

const isValidSubject = (sub) => {
  if (!sub || !sub.code) return false;
  const codeUpper = sub.code.toUpperCase();
  const invalidTokens = ["JUNE", "JULY", "DEC", "NOV", "MAY", "APR", "JAN", "FEB", "MAR", "AUG", "SEP", "OCT", "EXAM", "STATUS", "RESULT", "TOTAL", "SEM", "REMARK", "ROLL", "ENROLL"];
  if (invalidTokens.some(tok => codeUpper.includes(tok))) return false;
  if (!/\d/.test(codeUpper)) return false;
  return true;
};

// Interactive SVG Line/Area Chart for SGPA & CGPA
const AcademicPerformanceChart = ({ gpaTrend }) => {
  if (!gpaTrend || gpaTrend.length === 0) return null;

  const width = 720;
  const height = 240;
  const paddingLeft = 45;
  const paddingRight = 25;
  const paddingTop = 35;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = 10.0;
  const minVal = 0.0;

  const pointsCount = gpaTrend.length;
  const stepX = pointsCount > 1 ? chartWidth / (pointsCount - 1) : chartWidth / 2;

  const getX = (idx) => pointsCount === 1 ? paddingLeft + chartWidth / 2 : paddingLeft + idx * stepX;
  const getY = (val) => paddingTop + chartHeight - ((val - minVal) / (maxVal - minVal)) * chartHeight;

  // Build SVG path points
  const sgpaPoints = gpaTrend.map((g, i) => ({ x: getX(i), y: getY(g.sgpa), sem: g.semester_number, val: g.sgpa }));
  const cgpaPoints = gpaTrend.map((g, i) => ({ x: getX(i), y: getY(g.cgpa), sem: g.semester_number, val: g.cgpa }));

  const sgpaPathD = sgpaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const cgpaPathD = cgpaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Area under SGPA curve
  const sgpaAreaD = sgpaPoints.length > 0 
    ? `${sgpaPathD} L ${sgpaPoints[sgpaPoints.length - 1].x} ${paddingTop + chartHeight} L ${sgpaPoints[0].x} ${paddingTop + chartHeight} Z`
    : '';

  return (
    <div style={{ background: 'var(--card-bg, #FFFFFF)', borderRadius: '20px', border: '1px solid var(--card-border, #E2E8F0)', padding: '26px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span> Semester Performance Trajectory Chart
          </h3>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted, #64748B)' }}>Visual progression of SGPA & CGPA across semesters</div>
        </div>

        <div style={{ display: 'flex', gap: '16px', fontSize: '12.5px', fontWeight: '800', background: 'var(--input-bg, #F8FAFC)', padding: '6px 14px', borderRadius: '12px', border: '1px solid var(--card-border, #E2E8F0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#0284C7', display: 'inline-block' }} />
            <span style={{ color: '#0284C7' }}>SGPA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#9333EA', display: 'inline-block' }} />
            <span style={{ color: '#9333EA' }}>CGPA</span>
          </div>
        </div>
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: '550px' }}>
          <defs>
            <linearGradient id="sgpaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284C7" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[2, 4, 6, 8, 10].map((gridVal) => {
            const y = getY(gridVal);
            return (
              <g key={gridVal}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" strokeWidth="1" />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#94A3B8" fontWeight="700">{gridVal}</text>
              </g>
            );
          })}

          {/* Area Fill */}
          {sgpaAreaD && <path d={sgpaAreaD} fill="url(#sgpaGrad)" />}

          {/* CGPA Line */}
          <path d={cgpaPathD} fill="none" stroke="#9333EA" strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round" />

          {/* SGPA Line */}
          <path d={sgpaPathD} fill="none" stroke="#0284C7" strokeWidth="3.5" strokeLinecap="round" />

          {/* Data Points */}
          {sgpaPoints.map((p, i) => (
            <g key={`sgpa-pt-${i}`}>
              <circle cx={p.x} cy={p.y} r="6" fill="#FFFFFF" stroke="#0284C7" strokeWidth="3" />
              <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fontWeight="850" fill="#0284C7">{p.val.toFixed(2)}</text>
              <text x={p.x} y={paddingTop + chartHeight + 22} textAnchor="middle" fontSize="11" fontWeight="800" fill="#475569">Sem {p.sem}</text>
            </g>
          ))}

          {cgpaPoints.map((p, i) => (
            <g key={`cgpa-pt-${i}`}>
              <circle cx={p.x} cy={p.y} r="4.5" fill="#FFFFFF" stroke="#9333EA" strokeWidth="2.5" />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};


export default function StudentAcademicAnalyzer({ authFetch, toast }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'manual', 'dashboard'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Profile Result State
  const [profile, setProfile] = useState(null);
  const [validationReport, setValidationReport] = useState(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Subject Filter State in Dashboard
  const [subjectFilterTab, setSubjectFilterTab] = useState('all'); // 'all', 'strong', 'weak', 'critical'

  // Manual Entry Form State
  const [studentName, setStudentName] = useState('Ayush Sharma');
  const [enrollment, setEnrollment] = useState('0105IT241001');
  const [branch, setBranch] = useState('IT');
  const [course, setCourse] = useState('B.Tech.');

  const [manualSemesters, setManualSemesters] = useState([
    {
      semester_number: 1,
      sgpa: 7.8,
      subjects: [
        { code: 'BT101', name: 'Engineering Mathematics-I', credits: 4, grade: 'A', status: 'PASS' },
        { code: 'BT102', name: 'Engineering Physics', credits: 4, grade: 'B+', status: 'PASS' },
        { code: 'BT103', name: 'Basic Computer Engineering', credits: 4, grade: 'A+', status: 'PASS' }
      ]
    },
    {
      semester_number: 2,
      sgpa: 8.2,
      subjects: [
        { code: 'BT201', name: 'Engineering Mathematics-II', credits: 4, grade: 'A', status: 'PASS' },
        { code: 'BT202', name: 'Basic Electrical Engineering', credits: 4, grade: 'B', status: 'PASS' },
        { code: 'BT203', name: 'Data Structures', credits: 4, grade: 'O', status: 'PASS' }
      ]
    }
  ]);

  // Ask My Result Q&A State
  const [qaInput, setQaInput] = useState('');
  const [qaMessages, setQaMessages] = useState([
    {
      role: 'assistant',
      text: '🤖 **Ask My Result Assistant Ready!**\nAsk me anything about your analyzed academic profile (e.g. *"What is my weakest subject?"*, *"Which semester was my best?"*, *"How many backlogs do I have?"*, *"What is my CGPA?"*).'
    }
  ]);
  const [qaLoading, setQaLoading] = useState(false);

  const fileInputRef = useRef(null);

  // File Handling
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Safe Fetch Function using API_BASE
  const executeApiCall = async (endpoint, options = {}) => {
    const fetchFn = authFetch || fetch;
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    return await fetchFn(url, options);
  };

  // Upload & Process Files
  const handleProcessFiles = async () => {
    if (files.length === 0) {
      toast?.warning?.('Please select at least one academic file to upload.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));

      const res = await executeApiCall('/academic-analyzer/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Server response error.' }));
        throw new Error(errData.detail || 'Failed to process academic files.');
      }

      const data = await res.json();
      setProfile(data);
      setValidationReport(data.validation_report);

      if (data.validation_report && (data.validation_report.has_warnings || data.validation_report.has_errors)) {
        setShowValidationModal(true);
      }

      setActiveTab('dashboard');
      toast?.success?.('Academic files processed and profile generated successfully!');
    } catch (err) {
      setErrorMsg(err.message);
      toast?.error?.(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Manual Entry Submission
  const handleProcessManualEntry = async () => {
    if (!studentName.trim() || !enrollment.trim()) {
      toast?.warning?.('Please provide Student Name and Enrollment Number.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        student_name: studentName.trim(),
        enrollment: enrollment.trim().toUpperCase(),
        branch: branch.trim(),
        course: course.trim(),
        semesters: manualSemesters
      };

      const res = await executeApiCall('/academic-analyzer/analyze-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Server response error.' }));
        throw new Error(errData.detail || 'Failed to analyze manual entries.');
      }

      const data = await res.json();
      setProfile(data);
      setValidationReport(data.validation_report);
      setActiveTab('dashboard');
      toast?.success?.('Manual academic profile analyzed successfully!');
    } catch (err) {
      setErrorMsg(err.message);
      toast?.error?.(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Ask My Result Q&A Handler
  const handleSendQaQuestion = async (overridePrompt) => {
    const query = overridePrompt || qaInput;
    if (!query.trim() || !profile) return;

    setQaMessages((prev) => [...prev, { role: 'user', text: query }]);
    if (!overridePrompt) setQaInput('');
    setQaLoading(true);

    try {
      const res = await executeApiCall('/academic-analyzer/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, profile })
      });

      if (!res.ok) throw new Error('Q&A response error.');

      const data = await res.json();
      setQaMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
    } catch (err) {
      setQaMessages((prev) => [...prev, { role: 'assistant', text: `⚠️ Error fetching answer: ${err.message}` }]);
    } finally {
      setQaLoading(false);
    }
  };

  // Export File Handlers
  const handleExportPDF = async () => {
    if (!profile) return;
    try {
      const res = await executeApiCall('/academic-analyzer/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (!res.ok) throw new Error('PDF export failed.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Academic_Profile_${profile.identity.enrollment}.pdf`;
      a.click();
      toast?.success?.('PDF Profile Report downloaded!');
    } catch (err) {
      toast?.error?.(`Export failed: ${err.message}`);
    }
  };

  const handleExportExcel = async () => {
    if (!profile) return;
    try {
      const res = await executeApiCall('/academic-analyzer/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (!res.ok) throw new Error('Excel export failed.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Academic_Profile_${profile.identity.enrollment}.xlsx`;
      a.click();
      toast?.success?.('Multi-sheet Excel report downloaded!');
    } catch (err) {
      toast?.error?.(`Export failed: ${err.message}`);
    }
  };

  // Helper Form Functions for Manual Entry
  const addSemesterRow = () => {
    const nextSemNum = manualSemesters.length + 1;
    setManualSemesters([
      ...manualSemesters,
      {
        semester_number: nextSemNum,
        sgpa: 8.0,
        subjects: [{ code: `CS${nextSemNum}01`, name: 'Core Subject', credits: 4, grade: 'A', status: 'PASS' }]
      }
    ]);
  };

  const addSubjectRow = (semIdx) => {
    const updated = [...manualSemesters];
    updated[semIdx].subjects.push({
      code: `SUB${updated[semIdx].subjects.length + 1}`,
      name: 'New Subject',
      credits: 4,
      grade: 'A',
      status: 'PASS'
    });
    setManualSemesters(updated);
  };

  // Grade color mapper helper
  const getGradeStyle = (grade, status) => {
    if (status === 'FAIL' || ['F', 'FAIL', 'ABS'].includes(grade)) {
      return { bg: '#FEE2E2', color: '#DC2626', border: '#FCA5A5' };
    }
    if (['O', 'A+'].includes(grade)) {
      return { bg: '#DCFCE7', color: '#15803D', border: '#86EFAC' };
    }
    if (['A', 'B+'].includes(grade)) {
      return { bg: '#E0F2FE', color: '#0369A1', border: '#BAE6FD' };
    }
    if (['B', 'C'].includes(grade)) {
      return { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' };
    }
    return { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' };
  };

  return (
    <div className="academic-analyzer-container" style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px', color: 'var(--text-main, #1E293B)' }}>

      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: 'var(--card-bg, #FFFFFF)',
          border: '1px solid var(--card-border, #E2E8F0)',
          borderRadius: '20px',
          padding: '28px 32px',
          marginBottom: '28px',
          position: 'relative',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '20px', background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(2, 132, 199, 0.25)', color: '#0284C7', fontSize: '12px', fontWeight: '800', marginBottom: '12px', letterSpacing: '0.04em' }}>
              <span>📈</span> STANDALONE ACADEMIC ENGINE
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: '0 0 6px 0', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Student Academic Analyzer
            </h1>
            <p style={{ fontSize: '14.5px', color: 'var(--text-muted, #64748B)', margin: 0, maxWidth: '680px', lineHeight: 1.5 }}>
              Analyze multi-semester academic performance from marksheets, PDFs, Excel/CSV files, images or manual records with offline intelligence.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(34, 197, 94, 0.08)', padding: '10px 18px', borderRadius: '14px', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
            <span style={{ fontSize: '20px' }}>🔒</span>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: '850', color: '#15803D' }}>100% Local & Private</div>
              <div style={{ fontSize: '11px', color: '#166534' }}>Zero cloud storage or web calls</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Segmented Pill Tabs Navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'inline-flex', background: 'var(--card-bg, #FFFFFF)', padding: '6px', borderRadius: '16px', border: '1px solid var(--card-border, #E2E8F0)', gap: '6px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '10px 22px',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '13.5px',
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'upload' ? 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)' : 'transparent',
              color: activeTab === 'upload' ? '#FFFFFF' : 'var(--text-main, #334155)',
              boxShadow: activeTab === 'upload' ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>📁</span> Multi-File Upload
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            style={{
              padding: '10px 22px',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '13.5px',
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'manual' ? 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)' : 'transparent',
              color: activeTab === 'manual' ? '#FFFFFF' : 'var(--text-main, #334155)',
              boxShadow: activeTab === 'manual' ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>✏️</span> Manual Academic Entry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            disabled={!profile}
            style={{
              padding: '10px 22px',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '13.5px',
              cursor: profile ? 'pointer' : 'not-allowed',
              opacity: profile ? 1 : 0.5,
              border: 'none',
              background: activeTab === 'dashboard' ? 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)' : 'transparent',
              color: activeTab === 'dashboard' ? '#FFFFFF' : 'var(--text-main, #334155)',
              boxShadow: activeTab === 'dashboard' ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>📊</span> Academic Dashboard {profile ? '✓' : ''}
          </button>
        </div>
      </div>

      {/* Error Alert Box */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '14px', padding: '14px 18px', color: '#DC2626', marginBottom: '24px', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div style={{ flex: 1, fontWeight: '700' }}>{errorMsg}</div>
            <button type="button" onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontWeight: '800', fontSize: '16px' }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TAB 1: FILE UPLOAD SECTION */}
      {activeTab === 'upload' && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="glass-panel" style={{ padding: '32px', borderRadius: '20px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: '0 0 6px 0' }}>
              Upload Semester Marksheets & Records
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted, #64748B)', margin: 0 }}>
              Select multiple files across semesters. Supported formats: <strong style={{ color: 'var(--title-color, #0F172A)' }}>PDF, XLSX, XLS, CSV, JPG, PNG</strong>.
            </p>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: isDragOver ? '2px dashed #0284C7' : '2px dashed #CBD5E1',
              borderRadius: '18px',
              padding: '42px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: isDragOver ? 'rgba(2, 132, 199, 0.06)' : 'var(--input-bg, #F8FAFC)',
              transition: 'all 0.25s',
              marginBottom: '24px'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>📄</div>
            <div style={{ fontSize: '16px', fontWeight: '850', color: 'var(--title-color, #0F172A)', marginBottom: '6px' }}>
              Drag & Drop multi-semester files here or click to browse
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted, #64748B)' }}>
              Supports batch marksheets: <em>Sem1.pdf, Sem2.pdf, Sem3.xlsx, Sem4.png</em>
            </div>
          </div>

          {/* Selected File Chips List */}
          {files.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color, #0F172A)', marginBottom: '12px' }}>
                Selected Files ({files.length}):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: 'var(--input-bg, #F1F5F9)', border: '1px solid var(--card-border, #CBD5E1)', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span>📑</span>
                      <span style={{ fontWeight: '750', color: 'var(--title-color, #0F172A)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ color: 'var(--text-muted, #64748B)', fontSize: '11px', flexShrink: 0 }}>({(f.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: '800', padding: '2px 6px' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--card-border, #E2E8F0)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔒</span> <span>Files are parsed offline inside local memory. No cloud upload occurs.</span>
            </div>
            <button
              type="button"
              onClick={handleProcessFiles}
              disabled={loading || files.length === 0}
              style={{
                padding: '12px 30px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)',
                color: '#FFF',
                border: 'none',
                fontWeight: '850',
                fontSize: '14px',
                cursor: loading || files.length === 0 ? 'not-allowed' : 'pointer',
                opacity: loading || files.length === 0 ? 0.5 : 1,
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Analyzing Files...' : '🚀 Analyze Academic Profile'}
            </button>
          </div>
        </motion.section>
      )}

      {/* TAB 2: MANUAL ENTRY SECTION */}
      {activeTab === 'manual' && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="glass-panel" style={{ padding: '32px', borderRadius: '20px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: '0 0 20px 0' }}>
            Manual Academic Data Entry
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted, #475569)', display: 'block', marginBottom: '6px' }}>Student Name</label>
              <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--input-bg, #F8FAFC)', color: 'var(--text-main, #0F172A)', fontSize: '13.5px', fontWeight: '600', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted, #475569)', display: 'block', marginBottom: '6px' }}>Enrollment Number</label>
              <input type="text" value={enrollment} onChange={(e) => setEnrollment(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--input-bg, #F8FAFC)', color: 'var(--text-main, #0F172A)', fontSize: '13.5px', fontWeight: '600', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted, #475569)', display: 'block', marginBottom: '6px' }}>Branch</label>
              <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--input-bg, #F8FAFC)', color: 'var(--text-main, #0F172A)', fontSize: '13.5px', fontWeight: '600', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted, #475569)', display: 'block', marginBottom: '6px' }}>Course</label>
              <input type="text" value={course} onChange={(e) => setCourse(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--input-bg, #F8FAFC)', color: 'var(--text-main, #0F172A)', fontSize: '13.5px', fontWeight: '600', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Semesters Form */}
          {manualSemesters.map((sem, sIdx) => (
            <div key={sIdx} style={{ background: 'var(--input-bg, #F8FAFC)', border: '1px solid var(--card-border, #CBD5E1)', borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '850', color: '#0284C7' }}>
                  Semester {sem.semester_number}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted, #475569)' }}>SGPA:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={sem.sgpa}
                    onChange={(e) => {
                      const updated = [...manualSemesters];
                      updated[sIdx].sgpa = parseFloat(e.target.value) || 0;
                      setManualSemesters(updated);
                    }}
                    style={{ width: '75px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-main, #0F172A)', fontSize: '13px', fontWeight: '750' }}
                  />
                </div>
              </div>

              {/* Subjects Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--card-border, #CBD5E1)', color: 'var(--text-muted, #475569)', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Code</th>
                      <th style={{ padding: '8px' }}>Subject Name</th>
                      <th style={{ padding: '8px' }}>Credits</th>
                      <th style={{ padding: '8px' }}>Grade</th>
                      <th style={{ padding: '8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sem.subjects.map((sub, subIdx) => (
                      <tr key={subIdx} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="text"
                            value={sub.code}
                            onChange={(e) => {
                              const updated = [...manualSemesters];
                              updated[sIdx].subjects[subIdx].code = e.target.value;
                              setManualSemesters(updated);
                            }}
                            style={{ width: '85px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-main, #0F172A)', fontSize: '12px', fontWeight: '600' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="text"
                            value={sub.name}
                            onChange={(e) => {
                              const updated = [...manualSemesters];
                              updated[sIdx].subjects[subIdx].name = e.target.value;
                              setManualSemesters(updated);
                            }}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-main, #0F172A)', fontSize: '12px', fontWeight: '600', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="number"
                            value={sub.credits}
                            onChange={(e) => {
                              const updated = [...manualSemesters];
                              updated[sIdx].subjects[subIdx].credits = parseFloat(e.target.value) || 0;
                              setManualSemesters(updated);
                            }}
                            style={{ width: '55px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-main, #0F172A)', fontSize: '12px', fontWeight: '600' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <select
                            value={sub.grade}
                            onChange={(e) => {
                              const updated = [...manualSemesters];
                              const g = e.target.value;
                              updated[sIdx].subjects[subIdx].grade = g;
                              updated[sIdx].subjects[subIdx].status = ['F', 'FAIL', 'ABS'].includes(g) ? 'FAIL' : 'PASS';
                              setManualSemesters(updated);
                            }}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--card-bg, #FFFFFF)', color: 'var(--text-main, #0F172A)', fontSize: '12px', fontWeight: '600' }}
                          >
                            {['O', 'A+', 'A', 'B+', 'B', 'C', 'D', 'F', 'ABS'].map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', background: sub.status === 'PASS' ? '#DCFCE7' : '#FEE2E2', color: sub.status === 'PASS' ? '#15803D' : '#DC2626', fontWeight: '850', fontSize: '11px' }}>
                            {sub.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={() => addSubjectRow(sIdx)} style={{ marginTop: '12px', padding: '6px 14px', fontSize: '12px', fontWeight: '750', borderRadius: '8px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #CBD5E1)', color: 'var(--text-main, #0F172A)', cursor: 'pointer' }}>
                + Add Subject Row
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '14px', justifyContent: 'space-between', marginTop: '24px' }}>
            <button type="button" onClick={addSemesterRow} style={{ padding: '12px 20px', borderRadius: '12px', background: 'var(--input-bg, #F1F5F9)', border: '1px solid var(--card-border, #CBD5E1)', color: 'var(--title-color, #0F172A)', fontWeight: '800', fontSize: '13.5px', cursor: 'pointer' }}>
              + Add Semester
            </button>
            <button type="button" onClick={handleProcessManualEntry} disabled={loading} style={{ padding: '12px 28px', borderRadius: '12px', background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)', color: '#FFF', border: 'none', fontWeight: '850', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(2, 132, 199, 0.35)' }}>
              {loading ? 'Analyzing Entry...' : '🚀 Generate Academic Profile'}
            </button>
          </div>
        </motion.section>
      )}

      {/* TAB 3: ACADEMIC DASHBOARD VIEW */}
      {activeTab === 'dashboard' && profile && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* 1. Student Overview Card */}
          <section className="glass-panel" style={{ padding: '28px 32px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(99, 102, 241, 0.06) 100%)', border: '1px solid rgba(2, 132, 199, 0.3)', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: '850', boxShadow: '0 6px 18px rgba(2, 132, 199, 0.35)' }}>
                  👤
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: '850', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284C7', background: 'rgba(2, 132, 199, 0.12)', padding: '4px 10px', borderRadius: '12px' }}>
                      {profile.identity.course} · {profile.identity.branch}
                    </span>
                    <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-muted, #64748B)', background: 'var(--card-bg, #FFFFFF)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--card-border, #E2E8F0)' }}>
                      {profile.semesters.length} Semester(s) Analyzed
                    </span>
                  </div>
                  <h2 style={{ fontSize: '26px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: '8px 0 4px 0', letterSpacing: '-0.02em' }}>
                    {profile.identity.name}
                  </h2>
                  <div style={{ fontSize: '13.5px', fontFamily: 'monospace', color: 'var(--text-muted, #475569)' }}>
                    Enrollment: <strong style={{ color: 'var(--title-color, #0F172A)' }}>{profile.identity.enrollment}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={handleExportPDF} style={{ padding: '11px 20px', borderRadius: '12px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', fontWeight: '850', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📄</span> PDF Report
                </button>
                <button type="button" onClick={handleExportExcel} style={{ padding: '11px 20px', borderRadius: '12px', background: '#DCFCE7', border: '1px solid #86EFAC', color: '#15803D', fontWeight: '850', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📊</span> Excel Export
                </button>
              </div>
            </div>
          </section>

          {/* 2. Key Metrics Grid (4 Hero Cards) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
            {/* Metric 1: CGPA */}
            <div style={{ padding: '20px', borderRadius: '18px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '850', color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall CGPA</span>
                  <span style={{ fontSize: '18px' }}>🎓</span>
                </div>
                <div style={{ fontSize: '34px', fontWeight: '850', color: '#0284C7', lineHeight: 1.1 }}>{profile.cgpa.toFixed(2)}</div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--card-border, #F1F5F9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted, #64748B)' }}>Trend Trajectory:</span>
                <span style={{ color: profile.analytics.overview.overall_trend === 'Improving' ? '#15803D' : profile.analytics.overview.overall_trend === 'Declining' ? '#DC2626' : '#0369A1', fontWeight: '800' }}>
                  {profile.analytics.overview.overall_trend === 'Improving' ? '↗ Improving' : profile.analytics.overview.overall_trend === 'Declining' ? '↘ Declining' : '➔ Stable'}
                </span>
              </div>
            </div>

            {/* Metric 2: Consistency Score */}
            <div style={{ padding: '20px', borderRadius: '18px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '850', color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Consistency Score</span>
                  <span style={{ fontSize: '18px' }}>🎯</span>
                </div>
                <div style={{ fontSize: '34px', fontWeight: '850', color: '#9333EA', lineHeight: 1.1 }}>{profile.analytics.consistency_score.score}<span style={{ fontSize: '16px', color: 'var(--text-muted, #94A3B8)' }}>/100</span></div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--card-border, #F1F5F9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted, #64748B)' }}>Rating:</span>
                <span style={{ color: '#9333EA', fontWeight: '800' }}>{profile.analytics.consistency_score.rating}</span>
              </div>
            </div>

            {/* Metric 3: Active Backlogs */}
            <div style={{ padding: '20px', borderRadius: '18px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '850', color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Backlogs</span>
                  <span style={{ fontSize: '18px' }}>{profile.backlogs.active_backlogs > 0 ? '🚨' : '✅'}</span>
                </div>
                <div style={{ fontSize: '34px', fontWeight: '850', color: profile.backlogs.active_backlogs > 0 ? '#DC2626' : '#16A34A', lineHeight: 1.1 }}>
                  {profile.backlogs.active_backlogs}
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--card-border, #F1F5F9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted, #64748B)' }}>History Cleared:</span>
                <span style={{ color: 'var(--title-color, #0F172A)', fontWeight: '800' }}>{profile.backlogs.cleared_backlogs} cleared</span>
              </div>
            </div>

            {/* Metric 4: Academic Risk */}
            <div style={{ padding: '20px', borderRadius: '18px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: '850', color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Academic Risk</span>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                </div>
                <div style={{ fontSize: '26px', fontWeight: '850', color: profile.analytics.risk_analysis.risk_level === 'LOW' ? '#16A34A' : '#DC2626', lineHeight: 1.1, marginTop: '4px' }}>
                  {profile.analytics.risk_analysis.risk_level} RISK
                </div>
              </div>
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--card-border, #F1F5F9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted, #64748B)' }}>Penalty Score:</span>
                <span style={{ color: profile.analytics.risk_analysis.risk_level === 'LOW' ? '#16A34A' : '#DC2626', fontWeight: '800' }}>{profile.analytics.risk_analysis.score}/100</span>
              </div>
            </div>
          </div>

          {/* NEW: SVG Academic Performance Trajectory Chart */}
          <AcademicPerformanceChart gpaTrend={profile.analytics.gpa_trend} />

          {/* 3. Semester SGPA / CGPA Progression Table */}
          <section className="glass-panel" style={{ padding: '26px', borderRadius: '20px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: 0 }}>
                📈 Semester SGPA / CGPA Progression
              </h3>
              {profile.analytics.best_worst_analysis?.best_semester && (
                <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                  <span style={{ padding: '4px 12px', borderRadius: '12px', background: '#FEF3C7', color: '#B45309', fontWeight: '800', border: '1px solid #FDE68A' }}>
                    🏆 Best: Sem {profile.analytics.best_worst_analysis.best_semester.semester_number} (SGPA: {profile.analytics.best_worst_analysis.best_semester.sgpa})
                  </span>
                  {profile.analytics.best_worst_analysis?.weakest_semester && (
                    <span style={{ padding: '4px 12px', borderRadius: '12px', background: '#F1F5F9', color: '#475569', fontWeight: '800', border: '1px solid #CBD5E1' }}>
                      📉 Lowest: Sem {profile.analytics.best_worst_analysis.weakest_semester.semester_number} (SGPA: {profile.analytics.best_worst_analysis.weakest_semester.sgpa})
                    </span>
                  )}
                </div>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--input-bg, #F8FAFC)', color: 'var(--text-muted, #64748B)', textAlign: 'left', borderBottom: '1px solid var(--card-border, #E2E8F0)' }}>
                    <th style={{ padding: '12px 14px' }}>Semester</th>
                    <th style={{ padding: '12px 14px' }}>SGPA</th>
                    <th style={{ padding: '12px 14px' }}>CGPA</th>
                    <th style={{ padding: '12px 14px' }}>Credits Earned</th>
                    <th style={{ padding: '12px 14px' }}>Passed Subjects Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.analytics.gpa_trend.map((g, idx) => {
                    const passPercent = g.total_subjects > 0 ? (g.passed_subjects / g.total_subjects) * 100 : 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--card-border, #E2E8F0)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '850', color: 'var(--title-color, #0F172A)' }}>Semester {g.semester_number}</td>
                        <td style={{ padding: '12px 14px', fontWeight: '850', color: '#0284C7' }}>{g.sgpa.toFixed(2)}</td>
                        <td style={{ padding: '12px 14px', fontWeight: '800', color: 'var(--text-main, #0F172A)' }}>{g.cgpa.toFixed(2)}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-muted, #64748B)' }}>{g.credits} Credits</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: '#E2E8F0', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${passPercent}%`, background: passPercent === 100 ? '#16A34A' : '#F59E0B', borderRadius: '4px' }} />
                            </div>
                            <span style={{ fontSize: '11.5px', fontWeight: '800', color: passPercent === 100 ? '#15803D' : '#B45309', minWidth: '75px' }}>
                              {g.passed_subjects}/{g.total_subjects} Passed
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Subject Performance Highlights - Clean Individual Subject Cards */}
          <section className="glass-panel" style={{ padding: '26px', borderRadius: '20px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚡</span> Subject Performance Highlights
                </h3>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted, #64748B)' }}>Individual subject breakdown with Grade Points and Status</div>
              </div>

              {/* Subject Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px', background: 'var(--input-bg, #F8FAFC)', padding: '4px', borderRadius: '12px', border: '1px solid var(--card-border, #E2E8F0)' }}>
                {[
                  { key: 'all', label: 'All Subjects' },
                  { key: 'strong', label: '🌟 Strong' },
                  { key: 'weak', label: '⚠️ Weak' },
                  { key: 'critical', label: '🚨 Critical / Backlogs' }
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSubjectFilterTab(t.key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      border: 'none',
                      background: subjectFilterTab === t.key ? '#0284C7' : 'transparent',
                      color: subjectFilterTab === t.key ? '#FFFFFF' : 'var(--text-main, #334155)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject Cards Grid */}
            {(() => {
              const strong = profile.analytics.subject_analysis.strong_subjects || [];
              const weak = profile.analytics.subject_analysis.weak_subjects || [];
              const critical = profile.analytics.subject_analysis.critical_subjects || [];

              let displayedList = [];
              if (subjectFilterTab === 'strong') displayedList = strong;
              else if (subjectFilterTab === 'weak') displayedList = weak;
              else if (subjectFilterTab === 'critical') displayedList = critical;
              else displayedList = [...critical, ...weak, ...strong];

              displayedList = displayedList.filter(isValidSubject);

              if (displayedList.length === 0) {
                return (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted, #64748B)', fontSize: '13.5px', background: 'var(--input-bg, #F8FAFC)', borderRadius: '14px' }}>
                    🎉 No subjects in this category filter!
                  </div>
                );
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
                  {displayedList.map((sub, idx) => {
                    const cleanName = cleanSubjectName(sub.name, sub.code);
                    const gradeStyle = getGradeStyle(sub.latest_grade || sub.grade, sub.status);
                    return (
                      <div key={idx} style={{ padding: '18px', borderRadius: '16px', background: 'var(--card-bg, #FFFFFF)', border: `1px solid ${gradeStyle.border}`, boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '850', color: '#0284C7', background: 'rgba(2, 132, 199, 0.1)', padding: '3px 10px', borderRadius: '8px', fontFamily: 'monospace' }}>
                              {sub.code}
                            </span>
                            <span style={{ padding: '4px 10px', borderRadius: '12px', background: gradeStyle.bg, color: gradeStyle.color, border: `1px solid ${gradeStyle.border}`, fontWeight: '850', fontSize: '11.5px' }}>
                              Grade: {sub.latest_grade || sub.grade || 'N/A'}
                            </span>
                          </div>
                          <div style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--title-color, #0F172A)', margin: '4px 0 10px 0', lineHeight: 1.4 }}>
                            {cleanName}
                          </div>
                        </div>

                        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--card-border, #F1F5F9)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: 'var(--text-muted, #64748B)', background: 'var(--input-bg, #F1F5F9)', padding: '2px 8px', borderRadius: '6px' }}>
                            {sub.category || 'General'}
                          </span>
                          <span style={{ fontWeight: '850', color: gradeStyle.color, fontSize: '13px' }}>
                            {sub.average_grade_points != null ? `${sub.average_grade_points.toFixed(1)} GP` : 'Grade Point N/A'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>

          {/* 5. Category Domain Analysis Cards */}
          <section className="glass-panel" style={{ padding: '26px', borderRadius: '20px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: '0 0 16px 0' }}>
              🏷️ Category Domain Analysis
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
              {profile.analytics.category_analysis.map((cat, idx) => {
                const tierColor = cat.performance_tier === 'Excellent' ? '#15803D' : cat.performance_tier === 'Good' ? '#0284C7' : '#D97706';
                const tierBg = cat.performance_tier === 'Excellent' ? '#DCFCE7' : cat.performance_tier === 'Good' ? '#E0F2FE' : '#FEF3C7';
                return (
                  <div key={idx} style={{ padding: '16px', borderRadius: '14px', background: 'var(--input-bg, #F8FAFC)', border: '1px solid var(--card-border, #E2E8F0)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '850', color: 'var(--title-color, #0F172A)' }}>{cat.category_name}</span>
                        <span style={{ fontSize: '11px', fontWeight: '850', padding: '3px 8px', borderRadius: '10px', background: tierBg, color: tierColor }}>
                          {cat.performance_tier}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>{cat.subject_count} Subject(s) evaluated</div>
                    </div>

                    <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--card-border, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Category Avg:</span>
                      <span style={{ fontSize: '15px', fontWeight: '850', color: '#0284C7' }}>{cat.average_grade_points.toFixed(1)} GP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 6. Academic Risk Factors & CGPA Scenario Projections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            {/* Risk Card */}
            <section className="glass-panel" style={{ padding: '24px', borderRadius: '18px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: 0 }}>
                    Academic Risk Evaluation
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Rule-based transparent penalty rating</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {profile.analytics.risk_analysis.reasons.map((r, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-main, #0F172A)', padding: '8px 12px', borderRadius: '8px', background: 'var(--input-bg, #F8FAFC)', border: '1px solid var(--card-border, #E2E8F0)' }}>
                    <span style={{ color: '#DC2626', fontWeight: '800' }}>•</span>
                    <span style={{ lineHeight: 1.5 }}>{r}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Scenario Projections Card */}
            <section className="glass-panel" style={{ padding: '24px', borderRadius: '18px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '20px' }}>🔮</span>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: 0 }}>
                    CGPA Scenario Projections
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Estimates based on upcoming semester performance</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'var(--input-bg, #F8FAFC)', border: '1px solid var(--card-border, #CBD5E1)' }}>
                  <span>Maintain Current SGPA:</span>
                  <strong style={{ fontSize: '15px', color: 'var(--title-color, #0F172A)' }}>~{profile.analytics.cgpa_projection.projected_similar.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: '#DCFCE7', border: '1px solid #86EFAC' }}>
                  <span style={{ color: '#166534', fontWeight: '750' }}>With SGPA Improvement (+0.6):</span>
                  <strong style={{ fontSize: '15px', color: '#15803D' }}>~{profile.analytics.cgpa_projection.projected_improved.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: '#FEE2E2', border: '1px solid #FCA5A5' }}>
                  <span style={{ color: '#991B1B', fontWeight: '750' }}>If SGPA Declines (-0.6):</span>
                  <strong style={{ fontSize: '15px', color: '#DC2626' }}>~{profile.analytics.cgpa_projection.projected_decline.toFixed(2)}</strong>
                </div>
              </div>
            </section>
          </div>

          {/* 7. Local AI Academic Insights Section */}
          <section className="glass-panel" style={{ padding: '28px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)', border: '1px solid rgba(2, 132, 199, 0.25)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🤖</span> Local AI Academic Insights
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-main, #0F172A)', lineHeight: 1.6, margin: '0 0 18px 0', background: 'var(--card-bg, #FFFFFF)', padding: '16px', borderRadius: '12px', border: '1px solid var(--card-border, #E2E8F0)' }}>
              {profile.ai_insights.overall_assessment}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', fontSize: '13px' }}>
              <div style={{ background: 'var(--card-bg, #FFFFFF)', padding: '18px', borderRadius: '14px', border: '1px solid var(--card-border, #E2E8F0)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <span style={{ fontWeight: '850', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '14px' }}>
                  <span>🌟</span> Key Strengths
                </span>
                {profile.ai_insights.strengths.map((s, i) => (
                  <div key={i} style={{ marginBottom: '6px', color: 'var(--text-main, #0F172A)', lineHeight: 1.5 }}>• {s}</div>
                ))}
              </div>
              <div style={{ background: 'var(--card-bg, #FFFFFF)', padding: '18px', borderRadius: '14px', border: '1px solid var(--card-border, #E2E8F0)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <span style={{ fontWeight: '850', color: '#0284C7', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '14px' }}>
                  <span>🎯</span> Recommended Focus Areas
                </span>
                {profile.ai_insights.recommended_focus_areas.map((f, i) => (
                  <div key={i} style={{ marginBottom: '6px', color: 'var(--text-main, #0F172A)', lineHeight: 1.5 }}>• {f}</div>
                ))}
              </div>
            </div>
          </section>

          {/* 8. Ask My Result Local Chat Assistant */}
          <section className="glass-panel" style={{ padding: '28px', borderRadius: '20px', background: 'var(--card-bg, #FFFFFF)', border: '1px solid var(--card-border, #E2E8F0)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: '850', color: 'var(--title-color, #0F172A)', margin: '0 0 14px 0' }}>
              💬 Ask My Result (Local Q&A Assistant)
            </h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {[
                'What is my weakest subject?',
                'Which semester was my best?',
                'How many backlogs do I have?',
                'Has my SGPA improved?',
                'What is my current CGPA?',
                'Why is my academic risk marked high?'
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendQaQuestion(chip)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: 'rgba(2, 132, 199, 0.08)',
                    border: '1px solid rgba(2, 132, 199, 0.2)',
                    color: '#0284C7',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: '750',
                    transition: 'all 0.2s'
                  }}
                >
                  ⚡ {chip}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div style={{ background: 'var(--input-bg, #F8FAFC)', borderRadius: '14px', border: '1px solid var(--card-border, #E2E8F0)', padding: '16px', maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {qaMessages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', background: msg.role === 'user' ? 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)' : 'var(--card-bg, #FFFFFF)', color: msg.role === 'user' ? '#FFFFFF' : 'var(--text-main, #0F172A)', padding: '10px 16px', borderRadius: msg.role === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px', fontSize: '13px', lineHeight: 1.5, border: msg.role === 'user' ? 'none' : '1px solid var(--card-border, #E2E8F0)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                  {msg.text}
                </div>
              ))}
              {qaLoading && (
                <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted, #64748B)', fontSize: '12px' }}>
                  ⏳ Computing answer locally...
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                placeholder="Ask any question about your result..."
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendQaQuestion()}
                style={{ flex: 1, padding: '11px 16px', borderRadius: '12px', border: '1px solid var(--card-border, #CBD5E1)', background: 'var(--input-bg, #F8FAFC)', color: 'var(--text-main, #0F172A)', fontSize: '13.5px' }}
              />
              <button
                type="button"
                onClick={() => handleSendQaQuestion()}
                disabled={qaLoading || !qaInput.trim()}
                style={{ padding: '11px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)', color: '#FFF', border: 'none', fontWeight: '850', fontSize: '13.5px', cursor: qaLoading || !qaInput.trim() ? 'not-allowed' : 'pointer' }}
              >
                Send
              </button>
            </div>
          </section>

        </motion.div>
      )}

      {/* Validation Warning Audit Modal */}
      <AnimatePresence>
        {showValidationModal && validationReport && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={{ background: 'var(--card-bg, #FFFFFF)', border: '1px solid #F59E0B', borderRadius: '20px', padding: '28px', maxWidth: '560px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '28px' }}>⚠️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '850', color: '#B45309' }}>
                    Pre-Analysis Record Warning
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>Identity or formatting warnings detected</div>
                </div>
              </div>

              <div style={{ background: '#FEF3C7', borderRadius: '12px', border: '1px solid #FDE68A', padding: '14px', marginBottom: '20px', maxHeight: '220px', overflowY: 'auto' }}>
                {validationReport.issues.map((iss, i) => (
                  <div key={i} style={{ marginBottom: '10px', fontSize: '12.5px', color: '#78350F' }}>
                    <strong style={{ color: '#B45309' }}>[{iss.category}]</strong> {iss.description}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowValidationModal(false)}
                  style={{ padding: '10px 22px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284C7 0%, #38BDF8 100%)', color: '#FFF', border: 'none', fontWeight: '850', fontSize: '13px', cursor: 'pointer' }}
                >
                  Understood & Continue
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
