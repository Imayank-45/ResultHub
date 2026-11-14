import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function SubjectMarksManager({ theme }) {
  const { authFetch } = useAuth();
  const { success, error, warning, info } = useToast();

  // Class & Subject Form State
  const [subjectName, setSubjectName] = useState('Data Structures');
  const [subjectCode, setSubjectCode] = useState('IT401');
  const [semester, setSemester] = useState('IV');
  const [academicSession, setAcademicSession] = useState('Jan - Jun 2026');
  const [rollPrefix, setRollPrefix] = useState('0105IT2410');
  const [rollStart, setRollStart] = useState('1');
  const [rollEnd, setRollEnd] = useState('60');
  const [rollPadding, setRollPadding] = useState('2');

  // Marks Type State: 'mst1', 'mst2', 'both'
  const [marksType, setMarksType] = useState('both');

  // Students & Marks State (Starts empty, no default 5 records auto-generated)
  const [students, setStudents] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Raw string input values for handling typing 'A' or 'a' directly in inputs
  const [rawInputs, setRawInputs] = useState({});

  // Auto-generate students from roll range
  const handleGenerateStudents = (e) => {
    if (e) e.preventDefault();

    if (!subjectCode.trim() || !subjectName.trim()) {
      warning("Please enter Subject Code and Subject Name.");
      return;
    }

    const startNum = parseInt(rollStart, 10);
    const endNum = parseInt(rollEnd, 10);
    const padVal = parseInt(rollPadding, 10) || 2;

    if (isNaN(startNum) || startNum < 1) {
      warning("Start Roll Number must be >= 1.");
      return;
    }
    if (isNaN(endNum) || endNum < startNum) {
      warning("End Roll Number must be >= Start Roll Number.");
      return;
    }

    const count = endNum - startNum + 1;
    if (count > 500) {
      warning("Maximum batch size for single subject is 500 students.");
      return;
    }

    const generated = [];
    const newRaw = {};
    for (let r = startNum; r <= endNum; r++) {
      const suffix = String(r).padStart(padVal, '0');
      const enrollmentNo = `${rollPrefix.trim()}${suffix}`;
      generated.push({
        s_no: generated.length + 1,
        enrollment_no: enrollmentNo,
        mst1: null,
        mst2: null,
        total: null,
        mst1_absent: false,
        mst2_absent: false
      });
      newRaw[`${enrollmentNo}_mst1`] = '';
      newRaw[`${enrollmentNo}_mst2`] = '';
    }

    setStudents(generated);
    setRawInputs(newRaw);
    success(`Generated ${generated.length} student records for ${subjectCode.trim().toUpperCase()}!`);
  };

  // Handle Per-MST Mark Input (supports typing 'A' or 'a' for granular Absent per MST)
  const handleMarkInputChange = (enrollmentNo, field, val) => {
    const rawKey = `${enrollmentNo}_${field}`;
    setRawInputs(prev => ({ ...prev, [rawKey]: val }));

    const strVal = String(val).trim().toUpperCase();

    setStudents(prev => {
      const copy = [...prev];
      const index = copy.findIndex(s => s.enrollment_no === enrollmentNo);
      if (index === -1) return prev;

      const target = { ...copy[index] };

      if (field === 'mst1') {
        if (strVal === 'A' || strVal === 'ABSENT' || strVal === 'AB') {
          target.mst1_absent = true;
          target.mst1 = 0;
        } else if (val === '' || val === null) {
          target.mst1_absent = false;
          target.mst1 = null;
        } else {
          const numVal = parseFloat(val);
          if (!isNaN(numVal)) {
            if (numVal < 0) { warning("Marks cannot be negative."); return prev; }
            if (numVal > 10) { warning("Maximum MST marks limit is 10."); return prev; }
            target.mst1_absent = false;
            target.mst1 = numVal;
          }
        }
      } else if (field === 'mst2') {
        if (strVal === 'A' || strVal === 'ABSENT' || strVal === 'AB') {
          target.mst2_absent = true;
          target.mst2 = 0;
        } else if (val === '' || val === null) {
          target.mst2_absent = false;
          target.mst2 = null;
        } else {
          const numVal = parseFloat(val);
          if (!isNaN(numVal)) {
            if (numVal < 0) { warning("Marks cannot be negative."); return prev; }
            if (numVal > 10) { warning("Maximum MST marks limit is 10."); return prev; }
            target.mst2_absent = false;
            target.mst2 = numVal;
          }
        }
      }

      // Auto-calculate Total in real-time with granular absent
      const m1Score = target.mst1_absent ? 0 : (target.mst1 !== null ? target.mst1 : null);
      const m2Score = target.mst2_absent ? 0 : (target.mst2 !== null ? target.mst2 : null);

      if (target.mst1_absent && target.mst2_absent) {
        target.total = 0;
      } else if (m1Score !== null || m2Score !== null) {
        target.total = (m1Score || 0) + (m2Score || 0);
      } else {
        target.total = null;
      }

      copy[index] = target;
      return copy;
    });
  };

  // Toggle Absence State for specific MST or Both
  const setStudentAbsenceState = (enrollmentNo, stateType) => {
    setStudents(prev => {
      const copy = [...prev];
      const index = copy.findIndex(s => s.enrollment_no === enrollmentNo);
      if (index === -1) return prev;

      const target = { ...copy[index] };

      if (stateType === 'both_present') {
        target.mst1_absent = false;
        target.mst2_absent = false;
        setRawInputs(r => ({
          ...r,
          [`${enrollmentNo}_mst1`]: target.mst1 !== null ? String(target.mst1) : '',
          [`${enrollmentNo}_mst2`]: target.mst2 !== null ? String(target.mst2) : ''
        }));
      } else if (stateType === 'mst1_absent') {
        target.mst1_absent = true;
        target.mst1 = 0;
        target.mst2_absent = false;
        setRawInputs(r => ({
          ...r,
          [`${enrollmentNo}_mst1`]: 'A',
          [`${enrollmentNo}_mst2`]: target.mst2 !== null ? String(target.mst2) : ''
        }));
      } else if (stateType === 'mst2_absent') {
        target.mst2_absent = true;
        target.mst2 = 0;
        target.mst1_absent = false;
        setRawInputs(r => ({
          ...r,
          [`${enrollmentNo}_mst1`]: target.mst1 !== null ? String(target.mst1) : '',
          [`${enrollmentNo}_mst2`]: 'A'
        }));
      } else if (stateType === 'both_absent') {
        target.mst1_absent = true;
        target.mst1 = 0;
        target.mst2_absent = true;
        target.mst2 = 0;
        target.total = 0;
        setRawInputs(r => ({
          ...r,
          [`${enrollmentNo}_mst1`]: 'A',
          [`${enrollmentNo}_mst2`]: 'A'
        }));
      }

      // Recalculate total
      const m1Score = target.mst1_absent ? 0 : (target.mst1 !== null ? target.mst1 : null);
      const m2Score = target.mst2_absent ? 0 : (target.mst2 !== null ? target.mst2 : null);

      if (target.mst1_absent && target.mst2_absent) {
        target.total = 0;
      } else if (m1Score !== null || m2Score !== null) {
        target.total = (m1Score || 0) + (m2Score || 0);
      } else {
        target.total = null;
      }

      copy[index] = target;
      return copy;
    });
  };

  // Bulk Action: Mark all unfilled students as Absent
  const handleMarkUnfilledAbsent = () => {
    let count = 0;
    setStudents(prev => prev.map(st => {
      const isUnfilledM1 = st.mst1 === null && !st.mst1_absent;
      const isUnfilledM2 = st.mst2 === null && !st.mst2_absent;

      if (isUnfilledM1 || isUnfilledM2) {
        count++;
        const newM1Abs = isUnfilledM1 ? true : st.mst1_absent;
        const newM2Abs = isUnfilledM2 ? true : st.mst2_absent;

        setRawInputs(r => ({
          ...r,
          [`${st.enrollment_no}_mst1`]: newM1Abs ? 'A' : (st.mst1 !== null ? String(st.mst1) : ''),
          [`${st.enrollment_no}_mst2`]: newM2Abs ? 'A' : (st.mst2 !== null ? String(st.mst2) : '')
        }));

        const m1S = newM1Abs ? 0 : (st.mst1 || 0);
        const m2S = newM2Abs ? 0 : (st.mst2 || 0);

        return {
          ...st,
          mst1_absent: newM1Abs,
          mst2_absent: newM2Abs,
          mst1: newM1Abs ? 0 : st.mst1,
          mst2: newM2Abs ? 0 : st.mst2,
          total: (newM1Abs && newM2Abs) ? 0 : (m1S + m2S)
        };
      }
      return st;
    }));

    if (count > 0) {
      success(`Marked ${count} unfilled student record(s) as ABSENT.`);
    } else {
      info("No unfilled students found.");
    }
  };

  // Clear All Marks & Absents
  const handleClearAll = () => {
    const freshRaw = {};
    setStudents(prev => prev.map(st => {
      freshRaw[`${st.enrollment_no}_mst1`] = '';
      freshRaw[`${st.enrollment_no}_mst2`] = '';
      return {
        ...st,
        mst1_absent: false,
        mst2_absent: false,
        mst1: null,
        mst2: null,
        total: null
      };
    }));
    setRawInputs(freshRaw);
    info("All entered marks and absent statuses cleared.");
  };

  // Filtered Students Search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(st => st.enrollment_no.toLowerCase().includes(q));
  }, [students, searchQuery]);

  // Summary Metrics
  const summaryStats = useMemo(() => {
    let filledCount = 0;
    let failCount = 0;
    let absentCount = 0;
    let totalScoreSum = 0;

    students.forEach(st => {
      const isM1Abs = st.mst1_absent;
      const isM2Abs = st.mst2_absent;

      if (isM1Abs || isM2Abs) absentCount++;

      const isM1Filled = isM1Abs || st.mst1 !== null;
      const isM2Filled = isM2Abs || st.mst2 !== null;

      if (marksType === 'mst1' && isM1Filled) filledCount++;
      else if (marksType === 'mst2' && isM2Filled) filledCount++;
      else if (marksType === 'both' && isM1Filled && isM2Filled) filledCount++;

      if (marksType === 'mst1' && !isM1Abs && st.mst1 !== null && st.mst1 < 4) failCount++;
      else if (marksType === 'mst2' && !isM2Abs && st.mst2 !== null && st.mst2 < 4) failCount++;
      else if (marksType === 'both' && (!isM1Abs || !isM2Abs) && st.total !== null && st.total < 8) failCount++;

      if (marksType === 'mst1' && !isM1Abs && st.mst1 !== null) totalScoreSum += st.mst1;
      else if (marksType === 'mst2' && !isM2Abs && st.mst2 !== null) totalScoreSum += st.mst2;
      else if (marksType === 'both' && (!isM1Abs || !isM2Abs) && st.total !== null) totalScoreSum += st.total;
    });

    const completionRate = students.length > 0 ? Math.round((filledCount / students.length) * 100) : 0;
    const avgScore = filledCount > 0 ? (totalScoreSum / filledCount).toFixed(1) : '0.0';

    return { filledCount, failCount, absentCount, completionRate, avgScore };
  }, [students, marksType]);

  // Luxury Client-Side Excel Generation Fallback (Guarantees download 100% of the time)
  const downloadClientSideExcel = (payload) => {
    const { subject_name, subject_code, semester, academic_session, marks_type, students: stList } = payload;
    const mtype = (marks_type || 'both').toLowerCase();
    const safeCode = (subject_code || 'SUBJ').toUpperCase();
    const safeSession = (academic_session || 'SESSION').replace(/ /g, '_');

    const rows = [];

    // Header Banner Rows (Matching Official Oriental College Format without 'SHEET')
    rows.push(["ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL"]);
    rows.push([`DEPARTMENT OF INFORMATION TECHNOLOGY — OFFICIAL MID-SEM MARKS`]);
    rows.push([`SUBJECT: ${safeCode} – ${subject_name}  |  SEMESTER: ${semester}  |  SESSION: ${academic_session}`]);
    rows.push([]); // Spacer row 4

    if (mtype === 'mst1') {
      rows.push(["S.No.", "Enrollment No.", `${safeCode} – ${subject_name} (MST-I)`]);
      stList.forEach(st => {
        const isAbs = st.mst1_absent || st.is_absent;
        rows.push([
          st.s_no,
          st.enrollment_no,
          isAbs ? "ABSENT" : (st.mst1 !== null ? st.mst1 : "-")
        ]);
      });
    } else if (mtype === 'mst2') {
      rows.push(["S.No.", "Enrollment No.", `${safeCode} – ${subject_name} (MST-II)`]);
      stList.forEach(st => {
        const isAbs = st.mst2_absent || st.is_absent;
        rows.push([
          st.s_no,
          st.enrollment_no,
          isAbs ? "ABSENT" : (st.mst2 !== null ? st.mst2 : "-")
        ]);
      });
    } else {
      rows.push(["S.No.", "Enrollment No.", "MST-I (Max 10)", "MST-II (Max 10)", "TOT (Max 20)"]);
      stList.forEach(st => {
        const m1Abs = st.mst1_absent || (st.is_absent && st.mst1 === null);
        const m2Abs = st.mst2_absent || (st.is_absent && st.mst2 === null);
        const isBothAbs = m1Abs && m2Abs;

        rows.push([
          st.s_no,
          st.enrollment_no,
          m1Abs ? "ABSENT" : (st.mst1 !== null ? st.mst1 : "-"),
          m2Abs ? "ABSENT" : (st.mst2 !== null ? st.mst2 : "-"),
          isBothAbs ? "ABSENT" : (st.total !== null ? st.total : "-")
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 10 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${safeCode}_Marks`);

    const filename = `SubjectMarks_${safeCode}_${semester}_${mtype.toUpperCase()}_${safeSession}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Export Excel Handler with Backend API + Instant Fallback
  const handleExportExcel = async () => {
    if (students.length === 0) {
      warning("No student records available for export.");
      return;
    }

    setIsExporting(true);
    const payload = {
      subject_name: (subjectName || "Subject").trim(),
      subject_code: (subjectCode || "SUBJ").trim().toUpperCase(),
      semester: (semester || "I").trim(),
      academic_session: (academicSession || "2026").trim(),
      marks_type: marksType,
      students: students.map(st => ({
        s_no: st.s_no,
        enrollment_no: st.enrollment_no,
        mst1: st.mst1,
        mst2: st.mst2,
        total: st.total,
        mst1_absent: !!st.mst1_absent,
        mst2_absent: !!st.mst2_absent,
        is_absent: !!(st.mst1_absent && st.mst2_absent)
      }))
    };

    try {
      const res = await authFetch(`${API_BASE}/subject-marks/generate-excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res && res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeCode = (subjectCode || "SUBJ").trim().toUpperCase();
        const safeSession = (academicSession || "SESSION").replace(/ /g, '_');
        a.download = `SubjectMarks_${safeCode}_${semester}_${marksType.toUpperCase()}_${safeSession}.xlsx`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          a.remove();
        }, 200);

        success(`Official Subject Marks Excel downloaded for ${safeCode}!`);
      } else {
        downloadClientSideExcel(payload);
        success(`Subject Marks Excel generated and downloaded for ${payload.subject_code}!`);
      }
    } catch (err) {
      console.warn("Backend Excel export failed, using instant client-side export fallback:", err);
      downloadClientSideExcel(payload);
      success(`Subject Marks Excel downloaded for ${payload.subject_code}!`);
    } finally {
      setIsExporting(false);
    }
  };

  // Keyboard navigation handler
  const handleKeyDown = (e, index, field) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (marksType === 'both' && field === 'mst1') {
        const nextInput = document.getElementById(`input-mst2-${index}`);
        if (nextInput) { nextInput.focus(); nextInput.select?.(); }
      } else {
        if (index < students.length - 1) {
          const nextInput = document.getElementById(`input-${marksType === 'mst2' ? 'mst2' : 'mst1'}-${index + 1}`);
          if (nextInput) { nextInput.focus(); nextInput.select?.(); }
        }
      }
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── HEADER BANNER ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--card-bg, #0F172A)',
          border: '1px solid var(--card-border, #334155)',
          padding: '20px 24px',
          borderRadius: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            boxShadow: '0 6px 20px rgba(37, 99, 235, 0.35)',
            flexShrink: 0
          }}>
            📑
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--title-color, #F8FAFC)', margin: 0 }}>
              Subject Marks Manager
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted, #94A3B8)', margin: '3px 0 0 0' }}>
              Standalone single-subject marks entry & instant official Excel spreadsheet generator for teachers.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn"
            onClick={handleMarkUnfilledAbsent}
            title="Mark all remaining unfilled student records as ABSENT in 1 click"
            style={{ fontSize: '12px', padding: '8px 14px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: '700' }}
          >
            🚫 Mark Unfilled as Absent
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleClearAll}
            style={{ fontSize: '12px', padding: '8px 14px', background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.35)', fontWeight: '700' }}
          >
            🧹 Clear All Marks
          </button>
        </div>
      </motion.div>

      {/* ── CLASS & SUBJECT CONFIGURATION FORM ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--card-bg, #0F172A)',
          border: '1px solid var(--card-border, #334155)',
          padding: '22px',
          borderRadius: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--title-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚙️</span> Step 1: Class & Subject Details
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Configure details before data entry</span>
        </div>

        <form onSubmit={handleGenerateStudents} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div className="form-group">
            <label htmlFor="subjCode">Subject Code</label>
            <input
              id="subjCode"
              type="text"
              value={subjectCode}
              onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
              placeholder="e.g. IT401"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="subjName">Subject Name</label>
            <input
              id="subjName"
              type="text"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Data Structures"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="semSelect">Semester</label>
            <select
              id="semSelect"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '9px 12px', borderRadius: '10px', fontSize: '13px', width: '100%' }}
            >
              <option value="I">Semester I</option>
              <option value="II">Semester II</option>
              <option value="III">Semester III</option>
              <option value="IV">Semester IV</option>
              <option value="V">Semester V</option>
              <option value="VI">Semester VI</option>
              <option value="VII">Semester VII</option>
              <option value="VIII">Semester VIII</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sessTitle">Academic Session</label>
            <input
              id="sessTitle"
              type="text"
              value={academicSession}
              onChange={(e) => setAcademicSession(e.target.value)}
              placeholder="e.g. Jan - Jun 2026"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="rollPrefix">Roll Number Prefix</label>
            <input
              id="rollPrefix"
              type="text"
              value={rollPrefix}
              onChange={(e) => setRollPrefix(e.target.value.toUpperCase())}
              placeholder="e.g. 0105IT2410"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="rollStart">Start Roll No.</label>
            <input
              id="rollStart"
              type="number"
              min="1"
              value={rollStart}
              onChange={(e) => setRollStart(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="rollEnd">End Roll No.</label>
            <input
              id="rollEnd"
              type="number"
              min="1"
              value={rollEnd}
              onChange={(e) => setRollEnd(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="rollPad">Padding Width</label>
            <input
              id="rollPad"
              type="number"
              min="1"
              max="5"
              value={rollPadding}
              onChange={(e) => setRollPadding(e.target.value)}
              placeholder="2 (1 → 01, 99 → 99)"
              required
            />
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '12.5px', color: '#38BDF8', fontWeight: '700' }}>
              ℹ️ Student Roll Range: {rollPrefix}{String(rollStart).padStart(parseInt(rollPadding, 10) || 2, '0')} to {rollPrefix}{String(rollEnd).padStart(parseInt(rollPadding, 10) || 2, '0')} ({Math.max(0, parseInt(rollEnd || 0) - parseInt(rollStart || 0) + 1)} Students)
            </span>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '9px 20px', fontSize: '13px', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
            >
              🔄 Update Student Batch
            </button>
          </div>
        </form>
      </motion.div>

      {/* ── STEP 2: MARKS TYPE SELECTION & SUMMARY BAR ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--card-bg, #0F172A)',
          border: '1px solid var(--card-border, #334155)',
          padding: '18px 22px',
          borderRadius: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--title-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎯</span> Step 2: Select Marks Type
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Select required exam scope for <strong>{subjectCode} – {subjectName}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setMarksType('mst1')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: '800',
                border: marksType === 'mst1' ? '2px solid #2563EB' : '1px solid var(--card-border)',
                background: marksType === 'mst1' ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255,255,255,0.04)',
                color: marksType === 'mst1' ? '#38BDF8' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              MST-I Only
            </button>
            <button
              type="button"
              onClick={() => setMarksType('mst2')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: '800',
                border: marksType === 'mst2' ? '2px solid #2563EB' : '1px solid var(--card-border)',
                background: marksType === 'mst2' ? 'rgba(37, 99, 235, 0.2)' : 'rgba(255,255,255,0.04)',
                color: marksType === 'mst2' ? '#38BDF8' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              MST-II Only
            </button>
            <button
              type="button"
              onClick={() => setMarksType('both')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: '800',
                border: marksType === 'both' ? '2px solid #7C3AED' : '1px solid var(--card-border)',
                background: marksType === 'both' ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255,255,255,0.04)',
                color: marksType === 'both' ? '#A78BFA' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              MST-I + MST-II (Both)
            </button>
          </div>
        </div>

        {/* METRICS METERS BAR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', paddingTop: '8px', borderTop: '1px solid var(--card-border)' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>Total Students</span>
            <div style={{ fontSize: '18px', fontWeight: '900', color: 'var(--title-color)' }}>{students.length}</div>
          </div>
          <div style={{ background: 'rgba(34, 197, 94, 0.08)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: '700' }}>Marks Entered</span>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#22C55E' }}>{summaryStats.filledCount} / {students.length} ({summaryStats.completionRate}%)</div>
          </div>
          <div style={{ background: summaryStats.failCount > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '12px', border: summaryStats.failCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '11px', color: summaryStats.failCount > 0 ? '#EF4444' : 'var(--text-muted)', fontWeight: '700' }}>Fail Indication</span>
            <div style={{ fontSize: '18px', fontWeight: '900', color: summaryStats.failCount > 0 ? '#EF4444' : 'var(--title-color)' }}>
              {summaryStats.failCount} <span style={{ fontSize: '11px', fontWeight: '500' }}>({marksType === 'both' ? 'TOT < 8' : 'MST < 4'})</span>
            </div>
          </div>
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px 14px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '700' }}>Absents</span>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#F59E0B' }}>{summaryStats.absentCount}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>Average Score</span>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#38BDF8' }}>{summaryStats.avgScore} <span style={{ fontSize: '11px' }}>/ {marksType === 'both' ? '20' : '10'}</span></div>
          </div>
        </div>
      </motion.div>

      {/* ── STEP 3: MARKS ENTRY TABLE & ACTION BAR ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--card-bg, #0F172A)',
          border: '1px solid var(--card-border, #334155)',
          padding: '22px',
          borderRadius: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="text"
              placeholder="Search enrollment number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'var(--input-bg)',
                color: 'var(--text-main)',
                border: '1px solid var(--card-border)',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '12.5px',
                width: '220px'
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {filteredStudents.length} of {students.length} students
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '700' }}>
            ✏️ Live Data Entry Active
          </div>
        </div>

        {/* Granular Absence Tip for Teachers */}
        <div style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '9px 14px',
          borderRadius: '10px',
          color: '#38BDF8',
          fontSize: '12.5px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          💡 <strong>Per-MST Granular Absent:</strong> Type <strong>'A'</strong> directly in MST-I or MST-II box to mark absent for that specific exam! If MST-I = 5 and MST-II = A, total will be 5.
        </div>

        {/* ── DYNAMIC MARKS ENTRY TABLE ── */}
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'center' }}>
            <thead>
              {/* TOP HEADER ROW */}
              <tr style={{ background: '#1E3A8A', color: '#FFFFFF', fontWeight: '800' }}>
                <th rowSpan={marksType === 'both' ? 2 : 1} style={{ padding: '12px', border: '1px solid #334155', width: '70px' }}>S.No.</th>
                <th rowSpan={marksType === 'both' ? 2 : 1} style={{ padding: '12px', border: '1px solid #334155', width: '180px' }}>Enrollment No.</th>
                
                <th colSpan={marksType === 'both' ? 3 : 1} style={{ padding: '12px', border: '1px solid #334155' }}>
                  {subjectCode} – {subjectName}
                  {marksType === 'mst1' && <span style={{ fontSize: '11px', color: '#93C5FD', display: 'block', fontWeight: '500' }}>(MST-I Marks, Max 10)</span>}
                  {marksType === 'mst2' && <span style={{ fontSize: '11px', color: '#93C5FD', display: 'block', fontWeight: '500' }}>(MST-II Marks, Max 10)</span>}
                </th>

                <th rowSpan={marksType === 'both' ? 2 : 1} style={{ padding: '12px', border: '1px solid #334155', width: '170px' }}>Absence Status</th>
              </tr>

              {/* SUBHEADER ROW FOR BOTH MODE */}
              {marksType === 'both' && (
                <tr style={{ background: '#2563EB', color: '#FFFFFF', fontWeight: '800', fontSize: '12px' }}>
                  <th style={{ padding: '8px', border: '1px solid #334155', width: '120px' }}>MST-I (Max 10)</th>
                  <th style={{ padding: '8px', border: '1px solid #334155', width: '120px' }}>MST-II (Max 10)</th>
                  <th style={{ padding: '8px', border: '1px solid #334155', width: '120px' }}>TOT (Max 20)</th>
                </tr>
              )}
            </thead>

            <tbody>
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={marksType === 'both' ? 6 : 4} style={{ padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '28px' }}>📋</span>
                      <strong style={{ fontSize: '14px', color: 'var(--title-color)' }}>No Student Records Generated Yet</strong>
                      <span>Configure your class details & roll range above, then click <strong style={{ color: 'var(--primary)' }}>Update Student Batch</strong> to create records.</span>
                    </div>
                  </td>
                </tr>
              )}

              {filteredStudents.map((st, idx) => {
                const actualIndex = students.findIndex(s => s.enrollment_no === st.enrollment_no);
                const isM1Abs = st.mst1_absent;
                const isM2Abs = st.mst2_absent;
                const isBothAbs = isM1Abs && isM2Abs;

                const isM1Fail = !isM1Abs && st.mst1 !== null && st.mst1 < 4;
                const isM2Fail = !isM2Abs && st.mst2 !== null && st.mst2 < 4;
                const isTotFail = !isBothAbs && st.total !== null && st.total < 8;

                const bgRow = isBothAbs ? 'rgba(239, 68, 68, 0.08)' : (actualIndex % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent');

                return (
                  <tr key={st.enrollment_no} style={{ background: bgRow, borderBottom: '1px solid var(--card-border)' }}>
                    {/* S.No. */}
                    <td style={{ padding: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>
                      {st.s_no}
                    </td>

                    {/* Enrollment No. */}
                    <td style={{ padding: '10px', fontWeight: '800', fontFamily: 'monospace', color: isBothAbs ? '#EF4444' : 'var(--title-color)', fontSize: '13.5px' }}>
                      {st.enrollment_no}
                    </td>

                    {/* MST-I ONLY MODE INPUT */}
                    {marksType === 'mst1' && (
                      <td style={{ padding: '10px' }}>
                        <input
                          id={`input-mst1-${actualIndex}`}
                          type="text"
                          placeholder="0 - 10 or 'A'"
                          value={rawInputs[`${st.enrollment_no}_mst1`] !== undefined ? rawInputs[`${st.enrollment_no}_mst1`] : (isM1Abs ? 'A' : (st.mst1 !== null ? st.mst1 : ''))}
                          onChange={(e) => handleMarkInputChange(st.enrollment_no, 'mst1', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, actualIndex, 'mst1')}
                          style={{
                            width: '110px',
                            textAlign: 'center',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            fontWeight: '800',
                            fontSize: '13.5px',
                            background: isM1Abs ? '#FEF2F2' : (isM1Fail ? '#FEE2E2' : 'var(--input-bg)'),
                            color: isM1Abs ? '#B91C1C' : (isM1Fail ? '#991B1B' : 'var(--title-color)'),
                            border: isM1Abs ? '2px solid #EF4444' : (isM1Fail ? '2px solid #EF4444' : '1px solid var(--card-border)')
                          }}
                        />
                      </td>
                    )}

                    {/* MST-II ONLY MODE INPUT */}
                    {marksType === 'mst2' && (
                      <td style={{ padding: '10px' }}>
                        <input
                          id={`input-mst2-${actualIndex}`}
                          type="text"
                          placeholder="0 - 10 or 'A'"
                          value={rawInputs[`${st.enrollment_no}_mst2`] !== undefined ? rawInputs[`${st.enrollment_no}_mst2`] : (isM2Abs ? 'A' : (st.mst2 !== null ? st.mst2 : ''))}
                          onChange={(e) => handleMarkInputChange(st.enrollment_no, 'mst2', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, actualIndex, 'mst2')}
                          style={{
                            width: '110px',
                            textAlign: 'center',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            fontWeight: '800',
                            fontSize: '13.5px',
                            background: isM2Abs ? '#FEF2F2' : (isM2Fail ? '#FEE2E2' : 'var(--input-bg)'),
                            color: isM2Abs ? '#B91C1C' : (isM2Fail ? '#991B1B' : 'var(--title-color)'),
                            border: isM2Abs ? '2px solid #EF4444' : (isM2Fail ? '2px solid #EF4444' : '1px solid var(--card-border)')
                          }}
                        />
                      </td>
                    )}

                    {/* BOTH (MST-I + MST-II) MODE INPUTS */}
                    {marksType === 'both' && (
                      <>
                        {/* MST-I */}
                        <td style={{ padding: '10px' }}>
                          <input
                            id={`input-mst1-${actualIndex}`}
                            type="text"
                            placeholder="0-10 / A"
                            value={rawInputs[`${st.enrollment_no}_mst1`] !== undefined ? rawInputs[`${st.enrollment_no}_mst1`] : (isM1Abs ? 'A' : (st.mst1 !== null ? st.mst1 : ''))}
                            onChange={(e) => handleMarkInputChange(st.enrollment_no, 'mst1', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, actualIndex, 'mst1')}
                            style={{
                              width: '90px',
                              textAlign: 'center',
                              padding: '6px 8px',
                              borderRadius: '8px',
                              fontWeight: '800',
                              fontSize: '13px',
                              background: isM1Abs ? '#FEF2F2' : (isM1Fail ? '#FEE2E2' : 'var(--input-bg)'),
                              color: isM1Abs ? '#B91C1C' : (isM1Fail ? '#991B1B' : 'var(--title-color)'),
                              border: isM1Abs ? '2px solid #EF4444' : (isM1Fail ? '2px solid #EF4444' : '1px solid var(--card-border)')
                            }}
                          />
                        </td>

                        {/* MST-II */}
                        <td style={{ padding: '10px' }}>
                          <input
                            id={`input-mst2-${actualIndex}`}
                            type="text"
                            placeholder="0-10 / A"
                            value={rawInputs[`${st.enrollment_no}_mst2`] !== undefined ? rawInputs[`${st.enrollment_no}_mst2`] : (isM2Abs ? 'A' : (st.mst2 !== null ? st.mst2 : ''))}
                            onChange={(e) => handleMarkInputChange(st.enrollment_no, 'mst2', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, actualIndex, 'mst2')}
                            style={{
                              width: '90px',
                              textAlign: 'center',
                              padding: '6px 8px',
                              borderRadius: '8px',
                              fontWeight: '800',
                              fontSize: '13px',
                              background: isM2Abs ? '#FEF2F2' : (isM2Fail ? '#FEE2E2' : 'var(--input-bg)'),
                              color: isM2Abs ? '#B91C1C' : (isM2Fail ? '#991B1B' : 'var(--title-color)'),
                              border: isM2Abs ? '2px solid #EF4444' : (isM2Fail ? '2px solid #EF4444' : '1px solid var(--card-border)')
                            }}
                          />
                        </td>

                        {/* TOT (AUTOMATICALLY CALCULATED REAL-TIME) */}
                        <td style={{ padding: '10px' }}>
                          {isBothAbs ? (
                            <span style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', borderRadius: '6px', fontWeight: '800', fontSize: '11.5px' }}>
                              ABSENT
                            </span>
                          ) : (
                            <div style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontWeight: '900',
                              fontSize: '13.5px',
                              background: isTotFail ? '#FEE2E2' : (st.total !== null ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255,255,255,0.04)'),
                              color: isTotFail ? '#991B1B' : (st.total !== null ? '#38BDF8' : 'var(--text-muted)'),
                              border: isTotFail ? '1px solid #EF4444' : '1px solid var(--card-border)',
                              display: 'inline-block',
                              minWidth: '70px'
                            }}>
                              {st.total !== null ? `${st.total} / 20` : '—'}
                            </div>
                          )}
                        </td>
                      </>
                    )}

                    {/* Absence Status Dropdown Selector */}
                    <td style={{ padding: '10px' }}>
                      <select
                        value={isBothAbs ? 'both_absent' : (isM1Abs ? 'mst1_absent' : (isM2Abs ? 'mst2_absent' : 'both_present'))}
                        onChange={(e) => setStudentAbsenceState(st.enrollment_no, e.target.value)}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          background: (isM1Abs || isM2Abs) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.12)',
                          color: (isM1Abs || isM2Abs) ? '#EF4444' : '#22C55E',
                          border: (isM1Abs || isM2Abs) ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="both_present">🟢 Present Both</option>
                        <option value="mst1_absent">🔴 MST-I Absent</option>
                        <option value="mst2_absent">🔴 MST-II Absent</option>
                        <option value="both_absent">🔴 Both Absent</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── STEP 4: DOWNLOAD EXCEL BUTTON BELOW TABLE ── */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px', paddingTop: '14px', borderTop: '1px solid var(--card-border)' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isExporting || students.length === 0}
            onClick={handleExportExcel}
            style={{
              width: '100%',
              maxWidth: '600px',
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: '900',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {isExporting ? '⏳ Downloading Excel...' : '📄 Step 4: Download Subject Excel (.xlsx)'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
