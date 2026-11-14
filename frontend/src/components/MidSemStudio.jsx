import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomSelect from './CustomSelect';
import SubjectMarksManager from './SubjectMarksManager';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function MidSemStudio({ theme, initialTab = 'config' }) {
  const { authFetch } = useAuth();
  const { success, error, warning, info } = useToast();

  // Mode view tabs: 'config', 'marks_entry', 'batch_spreadsheet', 'subject_admin', 'subject_marks_manager'
  const [activeTab, setActiveTab] = useState(initialTab);

  // Configuration Parameters State
  const [academicSession, setAcademicSession] = useState('Jan - Jun 2026');
  const [year, setYear] = useState('2nd Year');
  const [semester, setSemester] = useState('IV');
  const [branch, setBranch] = useState('CS');
  const [program, setProgram] = useState('B.Tech.');
  const [rollPrefix, setRollPrefix] = useState('0105CS2410');
  const [rollStart, setRollStart] = useState('1');
  const [rollEnd, setRollEnd] = useState('5'); // Default 5 for quick demo & reference test
  const [rollPadding, setRollPadding] = useState('2'); // Default padding width: 2 (1 -> 01, 99 -> 99, 100 -> 100)

  // Metadata Options
  const [configOptions, setConfigOptions] = useState({
    sessions: ['Jan - Jun 2026', 'Jul - Dec 2026', 'Jan - Jun 2025'],
    years: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    semesters: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'],
    branches: ['CS', 'IT', 'EC', 'ME', 'CE', 'EX', 'AIML', 'DS', 'CSBS'],
    programs: ['B.Tech.', 'B.E.', 'Diploma', 'M.Tech.', 'MCA']
  });

  // Active Session & Data State
  const [sessionId, setSessionId] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState('idle'); // idle | saving | saved | error

  // Selected Student for Marks Entry UI
  const [selectedStudentIndex, setSelectedStudentIndex] = useState(0);

  // Search & Filters for Student List
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Subject Configuration Admin State
  const [editingSubject, setEditingSubject] = useState(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  // Excel/PDF Preview Modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [marksType, setMarksType] = useState('all'); // 'all' | 'mst1' | 'mst2'
  const [pendingScope, setPendingScope] = useState(null); // Pending scope change confirmation modal

  // Selection & Bulk Absent Action State
  const [selectedEnrollments, setSelectedEnrollments] = useState([]);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentOption, setAbsentOption] = useState('both'); // 'both' | 'mst1' | 'mst2'
  const [absentTargetEnrollments, setAbsentTargetEnrollments] = useState([]);
  const [undoState, setUndoState] = useState(null); // { snapshot, count, message }

  // College & Header Settings State (Persisted in localStorage)
  const [headerSettings, setHeaderSettings] = useState(() => {
    const saved = localStorage.getItem('resultai_midsem_header_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      collegeName: 'ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL',
      departmentName: 'DEPARTMENT OF INFORMATION TECHNOLOGY',
      subjectName: '',
      subjectCode: '',
      semester: 'IV',
      session: 'Jan - Jun 2026',
      examTitle: 'OFFICIAL MID-SEM MARKS SHEET'
    };
  });

  const [showHeaderSettingsModal, setShowHeaderSettingsModal] = useState(false);

  // Sync default header settings when branch, semester, or academicSession change
  useEffect(() => {
    if (branch) {
      let deptName = branch;
      if (branch === 'CS') deptName = 'COMPUTER SCIENCE & ENGINEERING';
      else if (branch === 'IT') deptName = 'INFORMATION TECHNOLOGY';
      else if (branch === 'DS') deptName = 'DATA SCIENCE';
      else if (branch === 'CSBS') deptName = 'COMPUTER SCIENCE & BUSINESS SYSTEMS';

      setHeaderSettings(prev => ({
        ...prev,
        departmentName: prev.departmentName || `DEPARTMENT OF ${deptName}`,
        semester: semester || prev.semester,
        session: academicSession || prev.session
      }));
    }
  }, [branch, semester, academicSession]);

  const handleSaveHeaderSettings = (e) => {
    if (e) e.preventDefault();
    localStorage.setItem('resultai_midsem_header_settings', JSON.stringify(headerSettings));
    setShowHeaderSettingsModal(false);
    success("College & Header settings saved! Custom values will be used for Excel & PDF generation.");
  };

  const handleResetHeaderSettings = () => {
    const defaults = {
      collegeName: 'ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL',
      departmentName: `DEPARTMENT OF ${branch || 'INFORMATION TECHNOLOGY'}`,
      subjectName: subjects.length > 0 ? (subjects[0].subject_name || '') : '',
      subjectCode: subjects.length > 0 ? (subjects[0].subject_code || '') : '',
      semester: semester || 'IV',
      session: academicSession || 'Jan - Jun 2026',
      examTitle: 'OFFICIAL MID-SEM MARKS SHEET'
    };
    setHeaderSettings(defaults);
    localStorage.setItem('resultai_midsem_header_settings', JSON.stringify(defaults));
    info("Header settings reset to defaults.");
  };

  // Responsive Screen Listener
  const [isMobileScreen, setIsMobileScreen] = useState(() => window.innerWidth <= 868);

  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth <= 868);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle Single Student Checkbox Selection
  const toggleStudentSelection = (enrollmentNo) => {
    setSelectedEnrollments(prev => {
      if (prev.includes(enrollmentNo)) {
        return prev.filter(e => e !== enrollmentNo);
      } else {
        return [...prev, enrollmentNo];
      }
    });
  };

  // Toggle Select All Checkbox
  const toggleSelectAllStudents = () => {
    if (selectedEnrollments.length === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedEnrollments([]);
    } else {
      setSelectedEnrollments(filteredStudents.map(s => s.enrollment_no));
    }
  };

  // Open Absent Confirmation Modal
  const openAbsentModal = (targetList) => {
    if (!targetList || targetList.length === 0) {
      warning("Please select at least one student.");
      return;
    }
    setAbsentTargetEnrollments(targetList);
    setAbsentOption('both'); // default
    setShowAbsentModal(true);
  };

  // Execute Mark Absent Action
  const handleConfirmMarkAbsent = async () => {
    if (!sessionId || absentTargetEnrollments.length === 0) return;

    if (absentOption === 'reset') {
      await handleResetStudentMarks(absentTargetEnrollments);
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/mid-sem/mark-absent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          enrollment_numbers: absentTargetEnrollments,
          absence_type: absentOption
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to mark absent");
      }

      const data = await res.json();

      // Update local state instantly
      const tag = absentOption === 'both' ? 'ABSENT_BOTH' : (absentOption === 'mst1' ? 'ABSENT_MST1' : 'ABSENT_MST2');
      const updatedStudents = students.map(st => {
        if (absentTargetEnrollments.includes(st.enrollment_no)) {
          const updatedMarks = { ...st.marks };
          subjects.forEach(s => {
            const sm = { ...(updatedMarks[s.subject_code] || {}) };
            if (absentOption === 'both') {
              sm.mst1 = 0;
              sm.mst2 = 0;
            } else if (absentOption === 'mst1') {
              sm.mst1 = 0;
            } else if (absentOption === 'mst2') {
              sm.mst2 = 0;
            }
            sm.total = (sm.mst1 || 0) + (sm.mst2 || 0);
            updatedMarks[s.subject_code] = sm;
          });
          return {
            ...st,
            status: tag,
            absence_type: tag,
            marks: updatedMarks
          };
        }
        return st;
      });

      setStudents(updatedStudents);
      setShowAbsentModal(false);
      setSelectedEnrollments([]); // Reset selection

      // Store undo state
      setUndoState({
        snapshot: data.previous_snapshot,
        count: absentTargetEnrollments.length,
        message: `${absentTargetEnrollments.length} student(s) marked absent (${tag.replace('_', ' ')}).`
      });

      success(`${absentTargetEnrollments.length} student(s) marked absent successfully!`);
    } catch (err) {
      error(err.message || "Failed to mark students absent.");
    } finally {
      setLoading(false);
    }
  };

  // Execute Reset Marks / Clear Absent Status Action
  const handleResetStudentMarks = async (targetEnrollments) => {
    if (!sessionId || !targetEnrollments || targetEnrollments.length === 0) {
      warning("Please select at least one student.");
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/mid-sem/reset-marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          enrollment_numbers: targetEnrollments
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to reset marks");
      }

      // Update local state for reset students
      const updatedStudents = students.map(st => {
        if (targetEnrollments.includes(st.enrollment_no)) {
          const freshMarks = {};
          subjects.forEach(s => {
            freshMarks[s.subject_code] = {
              subject_id: s.id,
              mst1: null,
              mst2: null,
              total: null,
              mst1_max: s.mst1_max,
              mst2_max: s.mst2_max,
              total_max: s.total_max
            };
          });
          return {
            ...st,
            status: 'READY',
            absence_type: null,
            marks: freshMarks
          };
        }
        return st;
      });

      setStudents(updatedStudents);
      setShowAbsentModal(false);
      setSelectedEnrollments([]); // Reset selection
      success(`Marks & status reset for ${targetEnrollments.length} student(s)!`);
    } catch (err) {
      error(err.message || "Failed to reset student marks.");
    } finally {
      setLoading(false);
    }
  };

  // Execute Undo Action
  const handleUndoAbsent = async () => {
    if (!undoState || !undoState.snapshot || !sessionId) return;

    setLoading(true);
    try {
      const recordsPayload = undoState.snapshot.map(item => {
        const targetSt = students.find(s => s.enrollment_no === item.enrollment_no);
        const studentName = targetSt ? targetSt.student_name : "";
        const marksPayload = item.marks.map(m => ({
          subject_id: m.subject_id,
          mst1_marks: m.mst1,
          mst2_marks: m.mst2
        }));

        return {
          session_id: sessionId,
          enrollment_no: item.enrollment_no,
          student_name: studentName,
          marks: marksPayload
        };
      });

      const res = await authFetch(`${API_BASE}/mid-sem/batch-marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          records: recordsPayload
        })
      });

      if (!res.ok) {
        throw new Error("Failed to undo absent operation.");
      }

      // Re-fetch resolved student list to restore full state
      const startNum = parseInt(rollStart, 10);
      const endNum = parseInt(rollEnd, 10);
      const resolveRes = await authFetch(
        `${API_BASE}/mid-sem/resolve-students?session_id=${sessionId}&prefix=${rollPrefix}&start=${startNum}&end=${endNum}&branch=${branch}&semester=${semester}&program=${program}`
      );

      if (resolveRes.ok) {
        const resolvedData = await resolveRes.json();
        setStudents(resolvedData.students);
      }

      setUndoState(null);
      success("Undo successful! Marks fully restored to previous state.");
    } catch (err) {
      error(err.message || "Undo failed.");
    } finally {
      setLoading(false);
    }
  };

  // Derived roll prefix auto-update
  useEffect(() => {
    if (branch) {
      const b = branch.toUpperCase();
      let code = b;
      if (b === 'CSE') code = 'CS';
      else if (b === 'ECE') code = 'EC';
      else if (b === 'AIML' || b === 'AI') code = 'AL';
      else if (b === 'DS') code = 'DS';
      else if (b === 'CSBS') code = 'CB';
      setRollPrefix(`0105${code}2410`);
    }
  }, [branch]);

  const [subjectLoading, setSubjectLoading] = useState(false);

  // Dependent Cascade Handlers
  const handleProgramChange = (newProg) => {
    setProgram(newProg);
    setBranch('');
    setSemester('');
    setSubjects([]);
  };

  const handleBranchChange = (newBranch) => {
    setBranch(newBranch);
    setSemester('');
    setSubjects([]);
  };

  const handleSemesterChange = (newSem) => {
    setSemester(newSem);
    if (program && branch && newSem) {
      loadSubjectsForSelection(program, branch, newSem);
    } else {
      setSubjects([]);
    }
  };

  const loadSubjectsForSelection = async (prog, br, sem) => {
    if (!prog || !br || !sem) {
      setSubjects([]);
      return [];
    }
    setSubjectLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/mid-sem/subjects?program=${prog}&branch=${br}&semester=${sem}`);
      if (res.ok) {
        const data = await res.json();
        const subList = Array.isArray(data) ? data : (data.subjects || []);
        setSubjects(subList);
        return subList;
      }
    } catch (err) {
      console.error("Error loading subjects:", err);
      setSubjects([]);
    } finally {
      setSubjectLoading(false);
    }
    return [];
  };

  // Load config options on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  // Auto-focus first MST-I input when switching student or opening single student card view
  useEffect(() => {
    if (activeTab === 'single_student' && subjects.length > 0) {
      const timer = setTimeout(() => {
        const firstInput = document.getElementById('card-input-mst1-0');
        if (firstInput) {
          firstInput.focus();
          firstInput.select?.();
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [selectedStudentIndex, activeTab, subjects]);

  const fetchConfig = async () => {
    try {
      const res = await authFetch(`${API_BASE}/mid-sem/config`);
      if (res.ok) {
        const data = await res.json();
        setConfigOptions(data);
      }
    } catch (err) {
      console.error("Config load error:", err);
    }
  };

  // Fetch subjects for branch & semester
  const loadSubjects = useCallback(async () => {
    return await loadSubjectsForSelection(program, branch, semester);
  }, [program, branch, semester, authFetch]);

  // Generate Student List Action
  const handleGenerateStudentList = async (e) => {
    if (e) e.preventDefault();

    const startNum = parseInt(rollStart, 10);
    const endNum = parseInt(rollEnd, 10);

    if (isNaN(startNum) || startNum < 1) {
      warning("Roll Number From must be a valid number >= 1");
      return;
    }
    if (isNaN(endNum) || endNum < startNum) {
      warning("Roll Number To must be greater than or equal to Roll Number From");
      return;
    }

    const count = endNum - startNum + 1;
    if (count > 200) {
      if (!window.confirm(`You are generating a large batch of ${count} students. Do you want to continue?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Create or get backend session record
      const sessRes = await authFetch(`${API_BASE}/mid-sem/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academic_session: academicSession,
          year,
          semester,
          branch,
          program,
          roll_prefix: rollPrefix,
          roll_start: startNum,
          roll_end: endNum,
          roll_padding: parseInt(rollPadding, 10) || 2
        })
      });

      if (!sessRes.ok) {
        const errData = await sessRes.json();
        throw new Error(errData.detail || "Failed to create mid-sem session");
      }
      const sessData = await sessRes.json();
      setSessionId(sessData.id);

      // 2. Load subjects and resolve student list with fresh=true to start with clean empty fields
      const loadedSubjs = await loadSubjects();
      const padVal = parseInt(rollPadding, 10) || 2;
      const res = await authFetch(
        `${API_BASE}/mid-sem/resolve-students?session_id=${sessData.id}&prefix=${rollPrefix}&start=${startNum}&end=${endNum}&pad=${padVal}&branch=${branch}&semester=${semester}&program=${program}&fresh=true`
      );

      if (res.ok) {
        const resolvedData = await res.json();
        setStudents(resolvedData.students);
        setSelectedStudentIndex(0);
        setActiveTab('marks_entry');
        success(`Generated ${resolvedData.students.length} student records for ${branch} Sem ${semester}!`);
      }
    } catch (err) {
      error(err.message || "Error generating student list.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered Student List
  const filteredStudents = useMemo(() => {
    return students.filter(st => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesEnr = st.enrollment_no.toLowerCase().includes(q);
        const matchesName = st.student_name && st.student_name.toLowerCase().includes(q);
        if (!matchesEnr && !matchesName) return false;
      }
      if (statusFilter !== 'ALL') {
        if (st.status !== statusFilter) return false;
      }
      return true;
    });
  }, [students, searchQuery, statusFilter]);

  // Current active student for marks entry
  const currentStudent = students[selectedStudentIndex] || null;

  // Handle Mark Change for Current Student & Subject
  const handleMarkChange = (subjectCode, field, value) => {
    if (!currentStudent) return;

    // Allow empty string for clearing input
    let numericVal = value === '' ? null : parseFloat(value);

    // Copy students array & current student
    const updatedStudents = [...students];
    const targetStudent = { ...updatedStudents[selectedStudentIndex] };
    const targetMarks = { ...targetStudent.marks };
    const currentSubjMark = { ...(targetMarks[subjectCode] || {}) };

    const maxLimit = field === 'mst1' ? currentSubjMark.mst1_max : currentSubjMark.mst2_max;

    if (numericVal !== null) {
      if (isNaN(numericVal)) return; // Ignore invalid non-numeric typing
      if (numericVal < 0) {
        warning(`Marks cannot be negative.`);
        return;
      }
      if (numericVal > maxLimit) {
        warning(`${field.toUpperCase()} cannot exceed ${maxLimit} marks.`);
        return;
      }
    }

    currentSubjMark[field] = numericVal;
    
    // Instant JS total calculation
    const m1 = currentSubjMark.mst1 !== null ? currentSubjMark.mst1 : null;
    const m2 = currentSubjMark.mst2 !== null ? currentSubjMark.mst2 : null;

    if (m1 !== null || m2 !== null) {
      currentSubjMark.total = (m1 || 0) + (m2 || 0);
    } else {
      currentSubjMark.total = null;
    }

    targetMarks[subjectCode] = currentSubjMark;
    targetStudent.marks = targetMarks;

    // Check completion status
    const allFilled = Object.values(targetMarks).every(m => m.mst1 !== null && m.mst2 !== null);
    const anyFilled = Object.values(targetMarks).some(m => m.mst1 !== null || m.mst2 !== null);
    targetStudent.status = allFilled ? 'SAVED' : anyFilled ? 'PENDING' : 'READY';

    updatedStudents[selectedStudentIndex] = targetStudent;
    setStudents(updatedStudents);
  };

  // Keyboard Navigation Helpers for Single Student Card View
  const handleScopeChange = (newScope) => {
    if (newScope === marksType) return;
    const hasAnyMarksEntered = students.some(st => 
      Object.values(st.marks || {}).some(m => m.mst1 !== null || m.mst2 !== null)
    );

    if (hasAnyMarksEntered) {
      setPendingScope(newScope);
    } else {
      setMarksType(newScope);
      success(`Marks Scope updated: ${newScope === 'mst1' ? 'MST-I Only' : newScope === 'mst2' ? 'MST-II Only' : 'Full Result (MST-I + MST-II)'}`);
    }
  };

  const confirmScopeChange = () => {
    if (pendingScope) {
      setMarksType(pendingScope);
      success(`Marks Scope updated: ${pendingScope === 'mst1' ? 'MST-I Only' : pendingScope === 'mst2' ? 'MST-II Only' : 'Full Result (MST-I + MST-II)'}`);
      setPendingScope(null);
    }
  };

  // Keyboard Navigation Helpers for Single Student Card View
  const handleCardKeyDown = (e, subjectIndex, inputType) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (marksType === 'mst1') {
        if (subjectIndex < subjects.length - 1) {
          const nextInput = document.getElementById(`card-input-mst1-${subjectIndex + 1}`);
          if (nextInput) { nextInput.focus(); nextInput.select?.(); }
        } else {
          const nextBtn = document.getElementById('btn-next-student');
          if (nextBtn) nextBtn.focus();
        }
      } else if (marksType === 'mst2') {
        if (subjectIndex < subjects.length - 1) {
          const nextInput = document.getElementById(`card-input-mst2-${subjectIndex + 1}`);
          if (nextInput) { nextInput.focus(); nextInput.select?.(); }
        } else {
          const nextBtn = document.getElementById('btn-next-student');
          if (nextBtn) nextBtn.focus();
        }
      } else {
        if (inputType === 'mst1') {
          const nextInput = document.getElementById(`card-input-mst2-${subjectIndex}`);
          if (nextInput) { nextInput.focus(); nextInput.select?.(); }
        } else if (inputType === 'mst2') {
          if (subjectIndex < subjects.length - 1) {
            const nextInput = document.getElementById(`card-input-mst1-${subjectIndex + 1}`);
            if (nextInput) { nextInput.focus(); nextInput.select?.(); }
          } else {
            const nextBtn = document.getElementById('btn-next-student');
            if (nextBtn) nextBtn.focus();
          }
        }
      }
    }
  };

  // Keyboard Navigation Helpers for Batch Spreadsheet Grid View
  const handleGridKeyDown = (e, studentIdx, subjectIdx, inputType) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (marksType === 'mst1') {
        if (subjectIdx < subjects.length - 1) {
          const nextInput = document.getElementById(`grid-input-${studentIdx}-${subjectIdx + 1}-mst1`);
          if (nextInput) { nextInput.focus(); nextInput.select?.(); }
        } else if (studentIdx < students.length - 1) {
          const nextInput = document.getElementById(`grid-input-${studentIdx + 1}-0-mst1`);
          if (nextInput) { nextInput.focus(); nextInput.select?.(); }
        }
      } else if (marksType === 'mst2') {
        if (subjectIdx < subjects.length - 1) {
          const nextInput = document.getElementById(`grid-input-${studentIdx}-${subjectIdx + 1}-mst2`);
          if (nextInput) { nextInput.focus(); nextInput.select?.(); }
        } else if (studentIdx < students.length - 1) {
          const nextInput = document.getElementById(`grid-input-${studentIdx + 1}-0-mst2`);
          if (nextInput) { nextInput.focus(); nextInput.select?.(); }
        }
      } else {
        if (inputType === 'mst1') {
          const nextInput = document.getElementById(`grid-input-${studentIdx}-${subjectIdx}-mst2`);
          if (nextInput) { nextInput.focus(); nextInput.select?.(); }
        } else if (inputType === 'mst2') {
          if (subjectIdx < subjects.length - 1) {
            const nextInput = document.getElementById(`grid-input-${studentIdx}-${subjectIdx + 1}-mst1`);
            if (nextInput) { nextInput.focus(); nextInput.select?.(); }
          } else if (studentIdx < students.length - 1) {
            const nextInput = document.getElementById(`grid-input-${studentIdx + 1}-0-mst1`);
            if (nextInput) { nextInput.focus(); nextInput.select?.(); }
          }
        }
      }
    }
  };

  // Student Name Edit
  const handleStudentNameEdit = (newName) => {
    if (!currentStudent) return;
    const updatedStudents = [...students];
    updatedStudents[selectedStudentIndex] = {
      ...updatedStudents[selectedStudentIndex],
      student_name: newName
    };
    setStudents(updatedStudents);
  };

  // Save Current Student Marks to Backend
  const saveCurrentStudentMarks = async () => {
    if (!currentStudent || !sessionId) return;

    setSavingStatus('saving');
    try {
      const marksPayload = subjects.map(s => {
        const sm = currentStudent.marks[s.subject_code] || {};
        return {
          subject_id: s.id,
          mst1_marks: sm.mst1,
          mst2_marks: sm.mst2
        };
      });

      const res = await authFetch(`${API_BASE}/mid-sem/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          enrollment_no: currentStudent.enrollment_no,
          student_name: currentStudent.student_name,
          marks: marksPayload
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to save marks");
      }

      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 2500);
      success(`Marks saved for ${currentStudent.student_name || currentStudent.enrollment_no}!`);
    } catch (err) {
      setSavingStatus('error');
      error(err.message || "Save marks failed.");
    }
  };

  // Save All / Batch Marks
  const saveAllStudentMarks = async () => {
    if (!sessionId || students.length === 0) return;

    setSavingStatus('saving');
    try {
      const recordsPayload = students.map(st => {
        const marksPayload = subjects.map(s => {
          const sm = st.marks[s.subject_code] || {};
          return {
            subject_id: s.id,
            mst1_marks: sm.mst1,
            mst2_marks: sm.mst2
          };
        });
        return {
          session_id: sessionId,
          enrollment_no: st.enrollment_no,
          student_name: st.student_name,
          marks: marksPayload
        };
      });

      const res = await authFetch(`${API_BASE}/mid-sem/batch-marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          records: recordsPayload
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Batch save failed");
      }

      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 2500);
      success("All student marks saved safely to backend database!");
    } catch (err) {
      setSavingStatus('error');
      error(err.message || "Failed to batch save marks.");
    }
  };

  // Completion Validation Summary
  const validationSummary = useMemo(() => {
    let completedCount = 0;
    let pendingCount = 0;
    let missingMarksCount = 0;
    let totalObtainedSum = 0;
    let maxPossibleSum = 0;

    students.forEach(st => {
      let stFilled = true;
      
      // Explicitly saved or marked absent for both/required MSTs = Completed
      if (st.status === 'SAVED') {
        stFilled = true;
      } else if (st.absence_type === 'ABSENT_BOTH' || st.status === 'ABSENT_BOTH') {
        stFilled = true;
      } else if ((st.absence_type === 'ABSENT_MST1' || st.status === 'ABSENT_MST1') && marksType === 'mst1') {
        stFilled = true;
      } else if ((st.absence_type === 'ABSENT_MST2' || st.status === 'ABSENT_MST2') && marksType === 'mst2') {
        stFilled = true;
      } else {
        subjects.forEach(s => {
          const sm = st.marks[s.subject_code] || {};
          const isMst1Filled = sm.mst1 !== null || st.absence_type === 'ABSENT_BOTH' || st.absence_type === 'ABSENT_MST1';
          const isMst2Filled = sm.mst2 !== null || st.absence_type === 'ABSENT_BOTH' || st.absence_type === 'ABSENT_MST2';

          if (marksType === 'mst1') {
            if (!isMst1Filled) stFilled = false;
          } else if (marksType === 'mst2') {
            if (!isMst2Filled) stFilled = false;
          } else {
            if (!isMst1Filled || !isMst2Filled) stFilled = false;
          }
        });
      }

      subjects.forEach(s => {
        const sm = st.marks[s.subject_code] || {};
        if (sm.mst1 === null || sm.mst2 === null) {
          missingMarksCount += 1;
        }
        totalObtainedSum += (sm.total || 0);
        maxPossibleSum += s.total_max;
      });

      if (stFilled) completedCount += 1;
      else pendingCount += 1;
    });

    return {
      totalStudents: students.length,
      completedCount,
      pendingCount,
      missingMarksCount,
      totalObtainedSum,
      maxPossibleSum,
      completionPercentage: students.length > 0 ? Math.round((completedCount / students.length) * 100) : 0
    };
  }, [students, subjects, marksType]);

  // Generate Official Excel File Download
  const handleGenerateExcel = async () => {
    if (!sessionId) {
      error("No active Mid-Sem session. Please generate student list first.");
      return;
    }

    setIsExporting(true);
    try {
      // First ensure all current edits are saved to DB
      await saveAllStudentMarks();

      const payload = {
        college_name: headerSettings.collegeName,
        department_name: headerSettings.departmentName,
        subject_name: headerSettings.subjectName,
        subject_code: headerSettings.subjectCode,
        semester: headerSettings.semester || semester,
        academic_session: headerSettings.session || academicSession,
        exam_title: headerSettings.examTitle
      };

      const res = await authFetch(`${API_BASE}/mid-sem/sessions/${sessionId}/generate-excel?marks_type=${marksType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let detail = "Failed to generate Excel sheet.";
        try {
          const errJson = await res.json();
          detail = errJson.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const tag = marksType === 'mst1' ? '_MST1' : (marksType === 'mst2' ? '_MST2' : '');
      a.download = `OIST_${branch}_${semester}_MidSem_${academicSession.replace(/ /g, '_')}${tag}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      success("Official Mid-Sem Marks Excel generated and downloaded!");
      setShowPreviewModal(false);
    } catch (err) {
      let msg = err.message || "Excel generation error.";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        msg = "Unable to connect to server for Excel generation. Please check backend connection.";
      }
      error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  // Generate Official PDF File Download
  const handleGeneratePDF = async () => {
    if (!sessionId) {
      error("No active Mid-Sem session.");
      return;
    }

    setIsExporting(true);
    try {
      await saveAllStudentMarks();

      const payload = {
        college_name: headerSettings.collegeName,
        department_name: headerSettings.departmentName,
        subject_name: headerSettings.subjectName,
        subject_code: headerSettings.subjectCode,
        semester: headerSettings.semester || semester,
        academic_session: headerSettings.session || academicSession,
        exam_title: headerSettings.examTitle
      };

      const res = await authFetch(`${API_BASE}/mid-sem/sessions/${sessionId}/generate-pdf?marks_type=${marksType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let detail = "Failed to generate PDF summary.";
        try {
          const errJson = await res.json();
          detail = errJson.detail || detail;
        } catch (_) {}
        throw new Error(detail);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const tag = marksType === 'mst1' ? '_MST1' : (marksType === 'mst2' ? '_MST2' : '');
      a.download = `OIST_${branch}_${semester}_MidSem_${academicSession.replace(/ /g, '_')}${tag}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      success("Mid-Sem Marks PDF summary downloaded!");
      setShowPreviewModal(false);
    } catch (err) {
      let msg = err.message || "PDF generation error.";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        msg = "Unable to connect to server for PDF generation. Please check backend connection.";
      }
      error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  // Save Admin Subject Edit
  const handleSaveSubjectAdmin = async (e) => {
    e.preventDefault();
    if (!editingSubject) return;

    const m1Max = isNaN(parseFloat(editingSubject.mst1_max)) ? 10.0 : parseFloat(editingSubject.mst1_max);
    const m2Max = isNaN(parseFloat(editingSubject.mst2_max)) ? 10.0 : parseFloat(editingSubject.mst2_max);
    const dispOrder = isNaN(parseInt(editingSubject.display_order, 10)) ? 1 : parseInt(editingSubject.display_order, 10);

    try {
      const res = await authFetch(`${API_BASE}/mid-sem/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSubject.id,
          branch: editingSubject.branch || branch,
          semester: editingSubject.semester || semester,
          program: editingSubject.program || program,
          subject_code: editingSubject.subject_code,
          subject_name: editingSubject.subject_name || "",
          mst1_max: m1Max,
          mst2_max: m2Max,
          display_order: dispOrder,
          mst_enabled: editingSubject.mst_enabled !== false,
          is_elective: !!editingSubject.is_elective,
          is_active: editingSubject.is_active !== false
        })
      });

      if (res.ok) {
        success(`Subject ${editingSubject.subject_code} updated successfully!`);
        setShowSubjectModal(false);
        setEditingSubject(null);
        loadSubjects();
      } else {
        const errData = await res.json();
        error(errData.detail || "Failed to save subject configuration.");
      }
    } catch (err) {
      error("Error saving subject configuration.");
    }
  };

  // Auto-Fill Demo Marks for Quick Testing
  const handleAutoFillDemoMarks = () => {
    if (students.length === 0) return;
    const updated = students.map((st, idx) => {
      const targetMarks = {};
      subjects.forEach((s) => {
        const m1 = Math.min(s.mst1_max, Math.max(0, 5 + (idx % 5)));
        const m2 = Math.min(s.mst2_max, Math.max(0, 4 + ((idx + 2) % 6)));
        targetMarks[s.subject_code] = {
          mst1: m1,
          mst2: m2,
          total: m1 + m2
        };
      });
      return {
        ...st,
        status: 'SAVED',
        marks: targetMarks
      };
    });
    setStudents(updated);
    success("Auto-filled sample marks for all students!");
  };

  return (
    <div style={{ width: '100%', maxWidth: '1300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* ── EASY 3-STEP VISUAL WORKFLOW WIZARD BAR ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--card-bg, #0F172A)',
          border: '1px solid var(--card-border, #334155)',
          boxShadow: 'var(--shadow-base, 0 10px 30px rgba(0,0,0,0.15))',
          padding: '20px 24px',
          borderRadius: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div className="midsem-top-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              boxShadow: '0 6px 20px rgba(124, 58, 237, 0.35)',
              flexShrink: 0
            }}>
              📝
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: 'var(--title-color)', margin: 0, letterSpacing: '-0.5px' }}>
                Mid-Sem Studio
              </h1>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '3px 0 0 0', fontWeight: '500' }}>
                3-Step Mid-Sem Marks & Excel Generator
              </p>
            </div>
          </div>

          <div className="midsem-top-action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="midsem-top-action-btn"
              onClick={() => setShowHeaderSettingsModal(true)}
              style={{
                fontSize: '12.5px',
                fontWeight: '800',
                padding: '9px 16px',
                borderRadius: '10px',
                border: '1px solid var(--card-border)',
                background: 'rgba(124, 58, 237, 0.08)',
                color: 'var(--primary)',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              🏛️ Header Settings
            </button>

            <button
              type="button"
              className="midsem-top-action-btn"
              onClick={() => setActiveTab('subject_marks_manager')}
              style={{
                fontSize: '12.5px',
                fontWeight: '800',
                padding: '9px 16px',
                borderRadius: '10px',
                border: activeTab === 'subject_marks_manager' ? '1px solid #7C3AED' : '1px solid var(--card-border)',
                background: activeTab === 'subject_marks_manager' ? 'var(--primary-gradient)' : 'rgba(124, 58, 237, 0.08)',
                color: activeTab === 'subject_marks_manager' ? '#FFFFFF' : 'var(--primary)',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeTab === 'subject_marks_manager' ? '0 4px 14px rgba(124, 58, 237, 0.3)' : 'none'
              }}
            >
              📑 Subject Marks Manager
            </button>

            <button
              type="button"
              className="midsem-top-action-btn"
              onClick={() => { loadSubjects(); setActiveTab('subject_admin'); }}
              style={{
                fontSize: '12.5px',
                fontWeight: '800',
                padding: '9px 16px',
                borderRadius: '10px',
                border: activeTab === 'subject_admin' ? '1px solid #7C3AED' : '1px solid var(--card-border)',
                background: activeTab === 'subject_admin' ? 'var(--primary-gradient)' : 'rgba(124, 58, 237, 0.08)',
                color: activeTab === 'subject_admin' ? '#FFFFFF' : 'var(--primary)',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeTab === 'subject_admin' ? '0 4px 14px rgba(124, 58, 237, 0.3)' : 'none'
              }}
            >
              📚 Subject Admin
            </button>
          </div>
        </div>

        {/* 3 STEPS PROGRESS STEPPER */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          
          {/* STEP 1 */}
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            style={{
              padding: '12px 16px',
              borderRadius: '14px',
              border: activeTab === 'config' ? '1.5px solid #6D28D9' : '1.5px solid var(--card-border)',
              background: activeTab === 'config' ? 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' : 'var(--bg-secondary, rgba(255, 255, 255, 0.04))',
              color: activeTab === 'config' ? '#FFFFFF' : 'var(--title-color)',
              fontWeight: '850',
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: activeTab === 'config' ? '0 6px 20px rgba(124, 58, 237, 0.35)' : 'none',
              transition: 'all 0.2s ease',
              letterSpacing: '0.2px'
            }}
          >
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: activeTab === 'config' ? '#FFFFFF' : 'rgba(124, 58, 237, 0.15)',
              color: activeTab === 'config' ? '#7C3AED' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '900',
              boxShadow: activeTab === 'config' ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
              flexShrink: 0
            }}>1</span>
            Step 1: Setup Class
          </button>

          {/* STEP 2 */}
          <button
            type="button"
            disabled={students.length === 0}
            onClick={() => setActiveTab('marks_entry')}
            style={{
              padding: '12px 16px',
              borderRadius: '14px',
              border: (activeTab === 'marks_entry' || activeTab === 'batch_spreadsheet') ? '1.5px solid #6D28D9' : '1.5px solid var(--card-border)',
              background: (activeTab === 'marks_entry' || activeTab === 'batch_spreadsheet') ? 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' : 'var(--bg-secondary, rgba(255, 255, 255, 0.04))',
              color: (activeTab === 'marks_entry' || activeTab === 'batch_spreadsheet') ? '#FFFFFF' : (students.length === 0 ? 'var(--text-muted)' : 'var(--title-color)'),
              opacity: students.length === 0 ? 0.55 : 1,
              fontWeight: '850',
              fontSize: '13.5px',
              cursor: students.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: (activeTab === 'marks_entry' || activeTab === 'batch_spreadsheet') ? '0 6px 20px rgba(124, 58, 237, 0.35)' : 'none',
              transition: 'all 0.2s ease',
              letterSpacing: '0.2px'
            }}
          >
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: (activeTab === 'marks_entry' || activeTab === 'batch_spreadsheet') ? '#FFFFFF' : 'rgba(124, 58, 237, 0.15)',
              color: (activeTab === 'marks_entry' || activeTab === 'batch_spreadsheet') ? '#7C3AED' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '900',
              boxShadow: (activeTab === 'marks_entry' || activeTab === 'batch_spreadsheet') ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
              flexShrink: 0
            }}>2</span>
            Step 2: Enter Marks
          </button>

          {/* STEP 3 */}
          <button
            type="button"
            disabled={students.length === 0}
            onClick={() => setShowPreviewModal(true)}
            style={{
              padding: '12px 16px',
              borderRadius: '14px',
              border: students.length > 0 ? '1.5px solid #047857' : '1.5px dashed var(--card-border)',
              background: students.length > 0 ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'var(--bg-secondary, rgba(255, 255, 255, 0.04))',
              color: students.length > 0 ? '#FFFFFF' : 'var(--text-muted)',
              opacity: students.length === 0 ? 0.55 : 1,
              fontWeight: '850',
              fontSize: '13.5px',
              cursor: students.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: students.length > 0 ? '0 6px 20px rgba(16, 185, 129, 0.35)' : 'none',
              transition: 'all 0.2s ease',
              letterSpacing: '0.2px'
            }}
          >
            <span style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: students.length > 0 ? '#FFFFFF' : 'rgba(148, 163, 184, 0.2)',
              color: students.length > 0 ? '#059669' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '900',
              boxShadow: students.length > 0 ? '0 2px 6px rgba(0, 0, 0, 0.2)' : 'none',
              flexShrink: 0
            }}>3</span>
            Step 3: Download Excel
          </button>
        </div>
      </motion.div>

      {/* ── STEP 2 MARKS SCOPE SELECTION BANNER ── */}
      {(activeTab === 'marks_entry' || activeTab === 'batch_spreadsheet') && students.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '18px 20px',
            borderRadius: '16px',
            background: 'var(--card-bg, #FFFFFF)',
            border: '1px solid var(--card-border, #E2E8F0)',
            opacity: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--title-color, #0F172A)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', opacity: 1 }}>
                <span>🎯</span> What marks do you want to record for this batch?
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0', fontWeight: '500', opacity: 1 }}>
                Select required scope before data entry. The system will adapt input forms, keyboard navigation, and exports accordingly.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F3E8FF', border: '1px solid #DDD6FE', padding: '6px 14px', borderRadius: '20px', opacity: 1 }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#5B21B6' }}>
                Recording: <strong style={{ color: '#4C1D95' }}>{marksType === 'mst1' ? 'MST-I Only' : marksType === 'mst2' ? 'MST-II Only' : 'Full Result (MST-I + MST-II)'}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {/* MST-I ONLY CARD */}
            <button
              type="button"
              onClick={() => handleScopeChange('mst1')}
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: marksType === 'mst1' ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                background: marksType === 'mst1' ? '#F5F3FF' : '#FFFFFF',
                opacity: 1,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: marksType === 'mst1' ? '0 4px 14px rgba(124, 58, 237, 0.15)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: marksType === 'mst1' ? '#5B21B6' : '#1E293B', opacity: 1 }}>
                  MST-I Only
                </div>
                <div style={{ fontSize: '12px', color: marksType === 'mst1' ? '#6D28D9' : '#64748B', marginTop: '3px', fontWeight: marksType === 'mst1' ? '600' : '500', opacity: 1 }}>
                  Record & Export MST-I Marks Only (Max 10)
                </div>
              </div>
              <span style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: marksType === 'mst1' ? '#7C3AED' : 'transparent',
                border: marksType === 'mst1' ? 'none' : '2px solid #94A3B8',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '900',
                flexShrink: 0
              }}>
                {marksType === 'mst1' ? '✓' : ''}
              </span>
            </button>

            {/* MST-II ONLY CARD */}
            <button
              type="button"
              onClick={() => handleScopeChange('mst2')}
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: marksType === 'mst2' ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                background: marksType === 'mst2' ? '#F5F3FF' : '#FFFFFF',
                opacity: 1,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: marksType === 'mst2' ? '0 4px 14px rgba(124, 58, 237, 0.15)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: marksType === 'mst2' ? '#5B21B6' : '#1E293B', opacity: 1 }}>
                  MST-II Only
                </div>
                <div style={{ fontSize: '12px', color: marksType === 'mst2' ? '#6D28D9' : '#64748B', marginTop: '3px', fontWeight: marksType === 'mst2' ? '600' : '500', opacity: 1 }}>
                  Record & Export MST-II Marks Only (Max 10)
                </div>
              </div>
              <span style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: marksType === 'mst2' ? '#7C3AED' : 'transparent',
                border: marksType === 'mst2' ? 'none' : '2px solid #94A3B8',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '900',
                flexShrink: 0
              }}>
                {marksType === 'mst2' ? '✓' : ''}
              </span>
            </button>

            {/* MST-I + MST-II CARD */}
            <button
              type="button"
              onClick={() => handleScopeChange('all')}
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                border: marksType === 'all' ? '2px solid #7C3AED' : '1px solid #CBD5E1',
                background: marksType === 'all' ? '#F5F3FF' : '#FFFFFF',
                opacity: 1,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: marksType === 'all' ? '0 4px 14px rgba(124, 58, 237, 0.15)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: marksType === 'all' ? '#5B21B6' : '#1E293B', opacity: 1 }}>
                  MST-I + MST-II
                </div>
                <div style={{ fontSize: '12px', color: marksType === 'all' ? '#6D28D9' : '#64748B', marginTop: '3px', fontWeight: marksType === 'all' ? '600' : '500', opacity: 1 }}>
                  Record & Export Both MSTs + Total / 20
                </div>
              </div>
              <span style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                background: marksType === 'all' ? '#7C3AED' : 'transparent',
                border: marksType === 'all' ? 'none' : '2px solid #94A3B8',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '900',
                flexShrink: 0
              }}>
                {marksType === 'all' ? '✓' : ''}
              </span>
            </button>
          </div>
        </motion.div>
      )}

      {/* ── STEP 2 VIEW MODE TOGGLE PILLS (FOR MARKS ENTRY & SPREADSHEET) ── */}
      {(activeTab === 'marks_entry' || activeTab === 'batch_spreadsheet') && students.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.03)', padding: '10px 16px', borderRadius: '14px', border: '1px solid var(--card-border)', flexWrap: 'wrap', gap: '12px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)' }}>
              🎓 Batch: <strong style={{ color: 'var(--primary)' }}>{branch} Sem-{semester} ({academicSession})</strong>
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: '800', background: 'rgba(124, 58, 237, 0.15)', color: 'var(--primary)', padding: '3px 10px', borderRadius: '20px' }}>
              {validationSummary.completedCount} / {validationSummary.totalStudents} Completed ({validationSummary.completionPercentage}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* View Mode Pills */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0, 0, 0, 0.25)', padding: '3px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('marks_entry')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '800',
                  border: 'none',
                  background: activeTab === 'marks_entry' ? 'var(--primary-gradient)' : 'transparent',
                  color: activeTab === 'marks_entry' ? '#FFF' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                👤 Single Student View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('batch_spreadsheet')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '800',
                  border: 'none',
                  background: activeTab === 'batch_spreadsheet' ? 'var(--primary-gradient)' : 'transparent',
                  color: activeTab === 'batch_spreadsheet' ? '#FFF' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                📊 Spreadsheet View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNDO BANNER FOR ABSENT OPERATIONS */}
      <AnimatePresence>
        {undoState && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              border: '1px solid #991B1B',
              borderRadius: '14px',
              padding: '14px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#FFFFFF',
              boxShadow: '0 6px 20px rgba(220, 38, 38, 0.35)',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>🔴</span>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '0.2px' }}>
                {undoState.message}
              </span>
            </div>

            <button
              className="btn"
              type="button"
              onClick={handleUndoAbsent}
              style={{
                background: '#FFFFFF',
                color: '#991B1B',
                fontWeight: '900',
                fontSize: '12.5px',
                padding: '8px 18px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.2s'
              }}
            >
              ↩️ Undo Action
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEP 1: CONFIGURATION PANEL ── */}
      {activeTab === 'config' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--title-color)', margin: 0 }}>
              Academic & Roll Number Configuration
            </h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Select session parameters and roll range. The system will automatically derive subjects, student names, and enrollment numbers.
            </p>
          </div>

          <form onSubmit={handleGenerateStudentList} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
            <div className="form-group">
              <label htmlFor="program">Program</label>
              <CustomSelect
                id="program"
                value={program}
                onChange={(e) => handleProgramChange(e.target.value)}
                options={configOptions.programs}
              />
            </div>

            <div className="form-group">
              <label htmlFor="branch">Branch</label>
              <CustomSelect
                id="branch"
                value={branch}
                onChange={(e) => handleBranchChange(e.target.value)}
                options={configOptions.branches}
                disabled={!program}
              />
            </div>

            <div className="form-group">
              <label htmlFor="semester">Semester</label>
              <CustomSelect
                id="semester"
                value={semester}
                onChange={(e) => handleSemesterChange(e.target.value)}
                options={configOptions.semesters}
                disabled={!branch}
              />
            </div>

            <div className="form-group">
              <label htmlFor="academicSession">Academic Session</label>
              <CustomSelect
                id="academicSession"
                value={academicSession}
                onChange={(e) => setAcademicSession(e.target.value)}
                options={configOptions.sessions}
                allowCustom={true}
                placeholder="e.g. Jan - Jun 2026, 2025-26, or enter custom date"
              />
            </div>

            <div className="form-group">
              <label htmlFor="year">Year</label>
              <CustomSelect
                id="year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                options={configOptions.years}
              />
            </div>

            <div className="form-group">
              <label htmlFor="rollPrefix">Enrollment Prefix</label>
              <input
                id="rollPrefix"
                type="text"
                value={rollPrefix}
                onChange={(e) => setRollPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. 0105CS2410"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="rollStart">Roll Number From</label>
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
              <label htmlFor="rollEnd">Roll Number To</label>
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
              <label htmlFor="rollPadding">Roll Number Padding</label>
              <input
                id="rollPadding"
                type="number"
                min="1"
                max="6"
                value={rollPadding}
                onChange={(e) => setRollPadding(e.target.value)}
                placeholder="2 (1 → 01, 99 → 99, 100 → 100)"
                required
              />
            </div>

            {/* SUBJECT AUTO-LOADING / MISSING CONFIGURATION FEEDBACK BOX */}
            {subjectLoading && (
              <div style={{ gridColumn: '1 / -1', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', padding: '14px 18px', borderRadius: '14px', color: 'var(--primary)', fontSize: '13px', fontWeight: '800' }}>
                ⏳ Loading MST theory subjects for {program} {branch} Semester {semester}...
              </div>
            )}

            {!subjectLoading && semester && subjects.length > 0 && (
              <div style={{ gridColumn: '1 / -1', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', padding: '14px 18px', borderRadius: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13.5px', color: '#22C55E' }}>
                    ✓ {subjects.length} MST Subjects Auto-Loaded for {program} {branch} Semester {semester}
                  </strong>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>From Subject Master DB</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {subjects.map(s => (
                    <span key={s.id || (s.code || s.subject_code)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--card-border)', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', color: 'var(--title-color)' }}>
                      ✓ <strong>{s.code || s.subject_code}</strong> — {s.name || s.subject_name} {s.is_elective ? '(Elective)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!subjectLoading && semester && subjects.length === 0 && (
              <div style={{ gridColumn: '1 / -1', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', padding: '16px 20px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '900', color: '#F59E0B', margin: 0 }}>
                    ⚠️ Subject Configuration Missing
                  </h4>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-main)', margin: '4px 0 0 0' }}>
                    No MST subjects are configured for <strong>{program} {branch} Semester {semester}</strong>. Please add subjects to proceed.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingSubject({
                      id: null,
                      program: program || 'B.Tech.',
                      branch: branch || 'IT',
                      semester: semester || 'IV',
                      subject_code: '',
                      subject_name: '',
                      mst1_max: 10,
                      mst2_max: 10,
                      display_order: 1,
                      mst_enabled: true,
                      is_elective: false,
                      is_active: true
                    });
                    setShowSubjectModal(true);
                  }}
                  style={{ fontSize: '12.5px', padding: '8px 16px', background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                >
                  ➕ Add Subject Configuration
                </button>
              </div>
            )}

            <div style={{ gridColumn: '1 / -1', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>
                ℹ️ {Math.max(0, parseInt(rollEnd || 0) - parseInt(rollStart || 0) + 1)} Students will be generated ({rollPrefix}{String(rollStart).padStart(2, '0')} to {rollPrefix}{String(rollEnd).padStart(2, '0')})
              </span>

              <motion.button
                whileHover={{ scale: subjects.length > 0 ? 1.02 : 1 }}
                whileTap={{ scale: subjects.length > 0 ? 0.98 : 1 }}
                className="btn btn-primary"
                type="submit"
                disabled={loading || subjects.length === 0}
                style={{ padding: '12px 28px', fontSize: '14px', fontWeight: '800', opacity: subjects.length === 0 ? 0.5 : 1, cursor: subjects.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                {loading ? '⏳ Generating Student List...' : '🚀 Generate Student List'}
              </motion.button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ── STEP 3 & STEP 4: SINGLE STUDENT MARKS ENTRY ── */}
      {activeTab === 'marks_entry' && currentStudent && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobileScreen ? '1fr' : '320px 1fr', gap: '20px', alignItems: 'start' }}>
          
          {/* LEFT SIDEBAR: STUDENT NAVIGATION & LIST */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="glass-panel" style={{ padding: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)' }}>Student Batch</span>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)' }}>
                  {validationSummary.completedCount} / {validationSummary.totalStudents} Completed ({validationSummary.completionPercentage}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${validationSummary.completionPercentage}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Search, Filters & Bulk Selection Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Search enrollment number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '12px' }}
              />
              <CustomSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'READY', label: '🟢 Marks Entered' },
                  { value: 'PENDING', label: '🟡 Marks Pending' },
                  { value: 'SAVED', label: '🔵 Saved' },
                  { value: 'ABSENT_BOTH', label: '🔴 Both MST Absent' },
                  { value: 'ABSENT_MST1', label: '🔴 MST-I Absent' },
                  { value: 'ABSENT_MST2', label: '🔴 MST-II Absent' }
                ]}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedEnrollments.length === filteredStudents.length && filteredStudents.length > 0}
                    onChange={toggleSelectAllStudents}
                  />
                  Select All ({filteredStudents.length})
                </label>

                {selectedEnrollments.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => openAbsentModal(selectedEnrollments)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: '#EF4444',
                        color: '#FFFFFF',
                        fontWeight: '800',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      🚫 Mark Absent ({selectedEnrollments.length})
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => handleResetStudentMarks(selectedEnrollments)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        background: '#F59E0B',
                        color: '#FFFFFF',
                        fontWeight: '800',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      🔄 Reset ({selectedEnrollments.length})
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── STATUS LEGEND GUIDE HEADER ── */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--card-border)',
              borderRadius: '10px',
              padding: '8px 10px',
              marginBottom: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--title-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📌 Status Legend:</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500' }}>Hover for details</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '10.5px', fontWeight: '800' }}>
                <span title="Marks have been entered" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', border: '1px solid rgba(34, 197, 94, 0.35)', padding: '2px 6px', borderRadius: '5px' }}>
                  🟢 Marks Entered
                </span>
                <span title="Marks are not entered yet" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '2px 6px', borderRadius: '5px' }}>
                  🟡 Marks Pending
                </span>
              </div>
            </div>

            {/* Student Scroll List */}
            <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredStudents.map((st) => {
                const actualIndex = students.findIndex(s => s.enrollment_no === st.enrollment_no);
                const isSelected = actualIndex === selectedStudentIndex;
                const isChecked = selectedEnrollments.includes(st.enrollment_no);

                // Compute Accessible Status Details
                let statusIcon = '🟡';
                let statusText = 'Marks Pending';
                let statusTooltip = 'Marks are not entered yet';
                let badgeBg = 'rgba(245, 158, 11, 0.14)';
                let badgeColor = '#F59E0B';
                let badgeBorder = 'rgba(245, 158, 11, 0.35)';
                let badgeSelectedBg = '#FEF3C7';
                let badgeSelectedColor = '#92400E';

                if (st.status === 'ABSENT_BOTH' || st.status === 'ABSENT_MST1' || st.status === 'ABSENT_MST2' || st.absence_type) {
                  statusIcon = '🔴';
                  statusText = st.absence_type === 'ABSENT_BOTH' ? 'Both Absent' : st.absence_type === 'ABSENT_MST1' ? 'MST-I Absent' : st.absence_type === 'ABSENT_MST2' ? 'MST-II Absent' : 'Student Absent';
                  statusTooltip = 'Student marked absent';
                  badgeBg = 'rgba(239, 68, 68, 0.14)';
                  badgeColor = '#EF4444';
                  badgeBorder = 'rgba(239, 68, 68, 0.35)';
                  badgeSelectedBg = '#FEE2E2';
                  badgeSelectedColor = '#B91C1C';
                } else if (st.status === 'SAVED') {
                  statusIcon = '🟢';
                  statusText = 'Marks Entered';
                  statusTooltip = 'Marks have been entered and saved';
                  badgeBg = 'rgba(34, 197, 94, 0.14)';
                  badgeColor = '#22C55E';
                  badgeBorder = 'rgba(34, 197, 94, 0.35)';
                  badgeSelectedBg = '#DCFCE7';
                  badgeSelectedColor = '#15803D';
                }

                return (
                  <div
                    key={st.enrollment_no}
                    onClick={() => setSelectedStudentIndex(actualIndex)}
                    className={`student-row-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleStudentSelection(st.enrollment_no);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ flexShrink: 0, cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="student-id-text" style={{ fontSize: '13px', fontWeight: '800', fontFamily: 'monospace', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          #{st.s_no} • {st.enrollment_no}
                        </span>

                        {/* Accessible Text Status Pill Label */}
                        <span 
                          title={statusTooltip}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10.5px',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: isSelected ? badgeSelectedBg : badgeBg,
                            color: isSelected ? badgeSelectedColor : badgeColor,
                            border: `1px solid ${badgeBorder}`,
                            width: 'fit-content',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                          }}
                        >
                          <span>{statusIcon}</span>
                          <span>{statusText}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* RIGHT PANEL: DEDICATED MARKS ENTRY FORM FOR CURRENT STUDENT */}
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-panel" style={{ padding: '24px' }}>
            
            {/* Student Info Card */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Student #{currentStudent.s_no} of {students.length}
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--title-color)', margin: '4px 0 0 0', fontFamily: 'monospace' }}>
                  Roll No: {currentStudent.enrollment_no}
                </h3>
              </div>

              {/* Status, Mark Absent & Autosave Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn"
                  type="button"
                  onClick={() => openAbsentModal([currentStudent.enrollment_no])}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#EF4444',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    fontWeight: '700'
                  }}
                >
                  🚫 Mark Absent
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn"
                  type="button"
                  onClick={() => handleResetStudentMarks([currentStudent.enrollment_no])}
                  title="Reset marks & absent status back to pending state"
                  style={{
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#F59E0B',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    fontWeight: '700'
                  }}
                >
                  🔄 Reset Marks
                </motion.button>

                <span style={{
                  fontSize: '11.5px',
                  fontWeight: '800',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: savingStatus === 'saving' ? 'rgba(245,158,11,0.15)' : savingStatus === 'saved' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                  color: savingStatus === 'saving' ? '#F59E0B' : savingStatus === 'saved' ? '#22C55E' : 'var(--text-muted)',
                  border: '1px solid var(--card-border)'
                }}>
                  {savingStatus === 'saving' ? '💾 Saving...' : savingStatus === 'saved' ? '✅ Saved' : '💾 Ready'}
                </span>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn btn-primary"
                  type="button"
                  onClick={saveCurrentStudentMarks}
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                >
                  💾 Save Marks
                </motion.button>
              </div>
            </div>

            {/* SUBJECT MARKS CARDS GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {subjects.map((subj, idx) => {
                const sCode = subj.subject_code;
                const sm = currentStudent.marks[sCode] || { mst1: null, mst2: null, total: null };

                return (
                  <div
                    key={subj.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--title-color)' }}>{subj.subject_code}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{subj.subject_name}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: marksType === 'all' ? '1fr 1fr 1fr' : '1fr', gap: '10px', alignItems: 'center' }}>
                      {(marksType === 'mst1' || marksType === 'all') && (
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            MST-I (Max {subj.mst1_max})
                          </label>
                          <input
                            id={`card-input-mst1-${idx}`}
                            type="number"
                            min="0"
                            max={subj.mst1_max}
                            step="0.5"
                            value={sm.mst1 !== null ? sm.mst1 : ''}
                            onChange={(e) => handleMarkChange(sCode, 'mst1', e.target.value)}
                            onKeyDown={(e) => handleCardKeyDown(e, idx, 'mst1')}
                            placeholder="0"
                            style={{ padding: '8px', fontSize: '13px', textAlign: 'center' }}
                          />
                        </div>
                      )}

                      {(marksType === 'mst2' || marksType === 'all') && (
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            MST-II (Max {subj.mst2_max})
                          </label>
                          <input
                            id={`card-input-mst2-${idx}`}
                            type="number"
                            min="0"
                            max={subj.mst2_max}
                            step="0.5"
                            value={sm.mst2 !== null ? sm.mst2 : ''}
                            onChange={(e) => handleMarkChange(sCode, 'mst2', e.target.value)}
                            onKeyDown={(e) => handleCardKeyDown(e, idx, 'mst2')}
                            placeholder="0"
                            style={{ padding: '8px', fontSize: '13px', textAlign: 'center' }}
                          />
                        </div>
                      )}

                      {marksType === 'all' && (
                        <div style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15))', border: '1px solid rgba(245, 158, 11, 0.45)', borderRadius: '10px', padding: '6px 8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '900', color: '#D97706', display: 'block', letterSpacing: '0.05em' }}>
                            TOTAL
                          </span>
                          <strong style={{ fontSize: '16px', fontWeight: '900', color: '#B45309', marginTop: '2px', display: 'block' }}>
                            {sm.total !== null ? sm.total : '—'} <span style={{ fontSize: '10px', opacity: 0.8, color: '#D97706' }}>/ {subj.total_max}</span>
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PREVIOUS / NEXT NAVIGATION BUTTONS */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--card-border)',
              paddingTop: '16px',
              marginTop: '16px'
            }}>
              <button
                className="btn btn-secondary"
                disabled={selectedStudentIndex <= 0}
                onClick={() => {
                  saveCurrentStudentMarks();
                  setSelectedStudentIndex(prev => Math.max(0, prev - 1));
                }}
                style={{
                  fontSize: '13px',
                  padding: '10px 20px',
                  flex: '1 1 140px',
                  justifyContent: 'center',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                ⬅️ Previous Student
              </button>

              <span style={{
                fontSize: '13px',
                fontWeight: '800',
                color: 'var(--title-color)',
                padding: '6px 16px',
                background: 'rgba(255, 255, 255, 0.07)',
                borderRadius: '20px',
                border: '1px solid var(--card-border)',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                Student {selectedStudentIndex + 1} of {students.length}
              </span>

              <button
                id="btn-next-student"
                className="btn btn-primary"
                disabled={selectedStudentIndex >= students.length - 1}
                onClick={() => {
                  saveCurrentStudentMarks();
                  setSelectedStudentIndex(prev => Math.min(students.length - 1, prev + 1));
                }}
                style={{
                  fontSize: '13px',
                  padding: '10px 20px',
                  flex: '1 1 140px',
                  justifyContent: 'center',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                Next Student ➡️
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── BATCH SPREADSHEET VIEW ── */}
      {activeTab === 'batch_spreadsheet' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--title-color)', margin: 0 }}>
                Spreadsheet Batch Marks Grid
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                View and edit MST marks for all students simultaneously.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {selectedEnrollments.length > 0 && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => openAbsentModal(selectedEnrollments)}
                  style={{
                    fontSize: '12.5px',
                    padding: '6px 14px',
                    background: '#EF4444',
                    color: '#FFFFFF',
                    fontWeight: '800'
                  }}
                >
                  🚫 Mark Selected Absent ({selectedEnrollments.length})
                </button>
              )}

              <button className="btn btn-primary" onClick={saveAllStudentMarks} style={{ fontSize: '12.5px', padding: '6px 14px' }}>
                💾 Save All Student Marks
              </button>
            </div>
          </div>

          <div className="table-wrapper" style={{ maxHeight: '550px', overflow: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th rowSpan="2" style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedEnrollments.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={toggleSelectAllStudents}
                    />
                  </th>
                  <th rowSpan="2">S.No.</th>
                  <th rowSpan="2">Enrollment No.</th>
                  {subjects.map(s => (
                    <th key={s.id} colSpan={marksType === 'all' ? 3 : 1} style={{ textAlign: 'center', background: 'rgba(124, 58, 237, 0.2)' }}>
                      {s.subject_code}
                    </th>
                  ))}
                </tr>
                <tr>
                  {subjects.map(s => (
                    <React.Fragment key={s.id}>
                      {(marksType === 'mst1' || marksType === 'all') && (
                        <th style={{ fontSize: '10px' }}>MST-I</th>
                      )}
                      {(marksType === 'mst2' || marksType === 'all') && (
                        <th style={{ fontSize: '10px' }}>MST-II</th>
                      )}
                      {marksType === 'all' && (
                        <th style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.25)', color: '#D97706', fontWeight: '900' }}>TOT</th>
                      )}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((st, idx) => {
                  const isChecked = selectedEnrollments.includes(st.enrollment_no);
                  return (
                    <tr key={st.enrollment_no}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudentSelection(st.enrollment_no)}
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>{st.s_no}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>
                        {st.enrollment_no}
                        {st.absence_type && (
                          <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: '800', marginLeft: '8px' }}>
                            ({st.absence_type === 'ABSENT_BOTH' ? '🔴 Both Absent' : st.absence_type === 'ABSENT_MST1' ? '🔴 MST-I Absent' : '🔴 MST-II Absent'})
                          </span>
                        )}
                      </td>
                      {subjects.map((s, sIdx) => {
                        const sCode = s.subject_code;
                        const sm = st.marks[sCode] || { mst1: null, mst2: null, total: null };
                        return (
                          <React.Fragment key={s.id}>
                            {(marksType === 'mst1' || marksType === 'all') && (
                              <td style={{ padding: '2px' }}>
                                <input
                                  id={`grid-input-${idx}-${sIdx}-mst1`}
                                  type="number"
                                  min="0"
                                  max={s.mst1_max}
                                  step="0.5"
                                  value={sm.mst1 !== null ? sm.mst1 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                    const updated = [...students];
                                    const targetSt = { ...updated[idx] };
                                    const targetMarks = { ...targetSt.marks };
                                    targetMarks[sCode] = { ...targetMarks[sCode], mst1: val, total: (val || 0) + (targetMarks[sCode].mst2 || 0) };
                                    targetSt.marks = targetMarks;
                                    updated[idx] = targetSt;
                                    setStudents(updated);
                                  }}
                                  onKeyDown={(e) => handleGridKeyDown(e, idx, sIdx, 'mst1')}
                                  style={{ width: '50px', padding: '4px', textAlign: 'center', fontSize: '12px' }}
                                />
                              </td>
                            )}

                            {(marksType === 'mst2' || marksType === 'all') && (
                              <td style={{ padding: '2px' }}>
                                <input
                                  id={`grid-input-${idx}-${sIdx}-mst2`}
                                  type="number"
                                  min="0"
                                  max={s.mst2_max}
                                  step="0.5"
                                  value={sm.mst2 !== null ? sm.mst2 : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                    const updated = [...students];
                                    const targetSt = { ...updated[idx] };
                                    const targetMarks = { ...targetSt.marks };
                                    targetMarks[sCode] = { ...targetMarks[sCode], mst2: val, total: (targetMarks[sCode].mst1 || 0) + (val || 0) };
                                    targetSt.marks = targetMarks;
                                    updated[idx] = targetSt;
                                    setStudents(updated);
                                  }}
                                  onKeyDown={(e) => handleGridKeyDown(e, idx, sIdx, 'mst2')}
                                  style={{ width: '50px', padding: '4px', textAlign: 'center', fontSize: '12px' }}
                                />
                              </td>
                            )}

                            {marksType === 'all' && (
                              <td style={{ textAlign: 'center', fontWeight: '900', color: '#D97706', background: 'rgba(245, 158, 11, 0.12)' }}>
                                {sm.total !== null ? sm.total : '—'}
                              </td>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── SUBJECT ADMIN PANEL ── */}
      {activeTab === 'subject_admin' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--title-color)', margin: 0 }}>
                Branch Subject Configuration Admin
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Manage subject codes, subject titles, display order, and maximum MST marks for {branch} Semester {semester}.
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingSubject({
                  id: null,
                  branch,
                  semester,
                  program,
                  subject_code: '',
                  subject_name: '',
                  mst1_max: 10.0,
                  mst2_max: 10.0,
                  display_order: subjects.length + 1,
                  is_active: true
                });
                setShowSubjectModal(true);
              }}
              style={{ fontSize: '12.5px', padding: '6px 14px' }}
            >
              ➕ Add Subject
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>MST-I Max</th>
                  <th>MST-II Max</th>
                  <th>Total Max</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subj) => (
                  <tr key={subj.id}>
                    <td style={{ textAlign: 'center', fontWeight: '700' }}>{subj.display_order}</td>
                    <td className="subject-code">{subj.subject_code}</td>
                    <td>{subj.subject_name || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{subj.mst1_max}</td>
                    <td style={{ textAlign: 'center' }}>{subj.mst2_max}</td>
                    <td style={{ textAlign: 'center', fontWeight: '800', color: 'var(--primary)' }}>{subj.total_max}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge pass">{subj.is_active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => { setEditingSubject(subj); setShowSubjectModal(true); }}
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── SUBJECT MARKS MANAGER TAB VIEW ── */}
      {activeTab === 'subject_marks_manager' && (
        <SubjectMarksManager theme={theme} />
      )}

      {/* ── PREVIEW & EXPORT MODAL ── */}
      <AnimatePresence>
        {showPreviewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px' }}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '900' }}>Mid-Sem Marks Sheet Preview</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{branch} Semester {semester} · {academicSession}</p>
                </div>
                <button className="modal-close" onClick={() => setShowPreviewModal(false)}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '16px 0' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Students</span>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: 'var(--title-color)', margin: 0 }}>{validationSummary.totalStudents}</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Marks Completion</span>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: '#22C55E', margin: 0 }}>{validationSummary.completionPercentage}%</p>
                </div>
              </div>

              {validationSummary.missingMarksCount > 0 ? (
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '12px', borderRadius: '10px', marginBottom: '16px', color: '#F59E0B', fontSize: '12.5px' }}>
                  ⚠️ <strong>Warning:</strong> {validationSummary.missingMarksCount} subject marks are still missing. You can generate the sheet anyway or go back to complete entry.
                </div>
              ) : (
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '12px', borderRadius: '10px', marginBottom: '16px', color: '#22C55E', fontSize: '12.5px' }}>
                  ✅ All student marks are complete and verified! Ready for official Excel & PDF generation.
                </div>
              )}

              {/* ── MARKS TYPE SCOPE SUMMARY ── */}
              <div style={{ background: '#F3E8FF', border: '1px solid #DDD6FE', padding: '12px 16px', borderRadius: '12px', marginBottom: '14px', color: '#5B21B6', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', opacity: 1 }}>
                <span style={{ fontWeight: '800', color: '#5B21B6', opacity: 1 }}>
                  📊 Exporting Scope: <strong style={{ color: '#4C1D95', fontWeight: '900', opacity: 1 }}>{marksType === 'mst1' ? 'MST-I Only' : marksType === 'mst2' ? 'MST-II Only' : 'Full Result (MST-I + MST-II)'}</strong>
                </span>
                <span style={{ fontSize: '11.5px', color: '#6D28D9', fontWeight: '600', opacity: 1 }}>(Selected at Step 2 start)</span>
              </div>

              {/* ── PRINT HEADER SETTINGS SUMMARY & QUICK EDIT ── */}
              <div style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px dashed var(--primary)', padding: '10px 14px', borderRadius: '12px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-main)' }}>
                  🏛️ <strong>Print Header:</strong> {headerSettings.collegeName || 'ORIENTAL INSTITUTE...'} | {headerSettings.departmentName}
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setShowHeaderSettingsModal(true)} style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                  ✏️ Edit Header
                </button>
              </div>

              <div className="midsem-preview-modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => setShowPreviewModal(false)} style={{ flex: 1 }}>
                  ✏️ Continue Editing
                </button>
                <button className="btn btn-primary" disabled={isExporting} onClick={handleGenerateExcel} style={{ flex: 1, background: 'linear-gradient(135deg, #10B981, #059669)' }}>
                  {isExporting ? '⏳ Exporting...' : '📄 Generate Excel (.xlsx)'}
                </button>
                <button className="btn btn-secondary" disabled={isExporting} onClick={handleGeneratePDF} style={{ flex: 1 }}>
                  {isExporting ? '⏳ Exporting...' : '🔴 Generate PDF'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT SUBJECT MODAL ── */}
      <AnimatePresence>
        {showSubjectModal && editingSubject && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowSubjectModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '16px', fontWeight: '800' }}>
                  {editingSubject.id ? 'Edit Subject Configuration' : 'Add New Subject'}
                </h3>
                <button className="modal-close" onClick={() => setShowSubjectModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveSubjectAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                <div className="form-group">
                  <label htmlFor="modalSubjCode">Subject Code</label>
                  <input
                    id="modalSubjCode"
                    type="text"
                    value={editingSubject.subject_code}
                    onChange={(e) => setEditingSubject({ ...editingSubject, subject_code: e.target.value })}
                    placeholder="e.g. CS 402 ADA"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="modalSubjName">Subject Name</label>
                  <input
                    id="modalSubjName"
                    type="text"
                    value={editingSubject.subject_name}
                    onChange={(e) => setEditingSubject({ ...editingSubject, subject_name: e.target.value })}
                    placeholder="e.g. Analysis & Design of Algorithms"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="modalMst1">MST-I Max Marks</label>
                    <input
                      id="modalMst1"
                      type="number"
                      min="0"
                      value={editingSubject.mst1_max}
                      onChange={(e) => setEditingSubject({ ...editingSubject, mst1_max: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="modalMst2">MST-II Max Marks</label>
                    <input
                      id="modalMst2"
                      type="number"
                      min="0"
                      value={editingSubject.mst2_max}
                      onChange={(e) => setEditingSubject({ ...editingSubject, mst2_max: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="modalOrder">Display Order</label>
                    <input
                      id="modalOrder"
                      type="number"
                      min="1"
                      value={editingSubject.display_order}
                      onChange={(e) => setEditingSubject({ ...editingSubject, display_order: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', margin: '4px 0 10px 0', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', color: 'var(--title-color)', fontWeight: '700' }}>
                    <input
                      type="checkbox"
                      checked={editingSubject.mst_enabled !== false}
                      onChange={(e) => setEditingSubject({ ...editingSubject, mst_enabled: e.target.checked })}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    MST Enabled (Theory Exam)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', color: 'var(--title-color)', fontWeight: '700' }}>
                    <input
                      type="checkbox"
                      checked={!!editingSubject.is_elective}
                      onChange={(e) => setEditingSubject({ ...editingSubject, is_elective: e.target.checked })}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    Elective Subject Slot
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSubjectModal(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Save Configuration
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ABSENT CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {showAbsentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowAbsentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '520px' }}
            >
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#EF4444' }}>
                    Mark Student(s) Absent
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                    Quick Zero Marks Action for Unattended Examinations
                  </p>
                </div>
                <button className="modal-close" onClick={() => setShowAbsentModal(false)}>✕</button>
              </div>

              <div style={{ margin: '18px 0' }}>
                <p style={{ fontSize: '13.5px', color: 'var(--text-main)', marginBottom: '14px' }}>
                  Mark <strong>{absentTargetEnrollments.length}</strong> selected student(s) absent? Choose absence scope:
                </p>

                {/* Radio Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>
                    <input
                      type="radio"
                      name="absentScope"
                      value="both"
                      checked={absentOption === 'both'}
                      onChange={() => setAbsentOption('both')}
                      style={{ accentColor: '#EF4444' }}
                    />
                    <div>
                      <strong>Both MST-I & MST-II</strong> (Default)
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Sets MST-I = 0, MST-II = 0, TOT = 0 across all subjects</span>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>
                    <input
                      type="radio"
                      name="absentScope"
                      value="mst1"
                      checked={absentOption === 'mst1'}
                      onChange={() => setAbsentOption('mst1')}
                      style={{ accentColor: '#EF4444' }}
                    />
                    <div>
                      <strong>MST-I only</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Sets MST-I = 0 for all subjects; preserves MST-II marks</span>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>
                    <input
                      type="radio"
                      name="absentScope"
                      value="mst2"
                      checked={absentOption === 'mst2'}
                      onChange={() => setAbsentOption('mst2')}
                      style={{ accentColor: '#EF4444' }}
                    />
                    <div>
                      <strong>MST-II only</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Sets MST-II = 0 for all subjects; preserves MST-I marks</span>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>
                    <input
                      type="radio"
                      name="absentScope"
                      value="reset"
                      checked={absentOption === 'reset'}
                      onChange={() => setAbsentOption('reset')}
                      style={{ accentColor: '#F59E0B' }}
                    />
                    <div>
                      <strong>🔄 Reset Marks / Unmark Absent</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Clears absent status & resets marks back to pending state</span>
                    </div>
                  </label>
                </div>

                {/* Safety Warning Box */}
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  marginTop: '16px',
                  color: '#FCA5A5',
                  fontSize: '12px',
                  lineHeight: '1.5'
                }}>
                  ⚠️ <strong>WARNING:</strong> You are about to set marks to 0 for:
                  <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                    <li><strong>{absentTargetEnrollments.length}</strong> student(s)</li>
                    <li><strong>{subjects.length}</strong> subjects each</li>
                    <li>Modifying <strong>{absentTargetEnrollments.length * subjects.length * (absentOption === 'both' ? 2 : 1)}</strong> mark values</li>
                  </ul>
                  An immediate <strong>[ Undo ]</strong> action will be available after confirming.
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAbsentModal(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={handleConfirmMarkAbsent}
                  style={{
                    flex: 1,
                    background: '#EF4444',
                    color: '#FFFFFF',
                    fontWeight: '800',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  Confirm & Mark Absent
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SCOPE CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {pendingScope !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setPendingScope(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--title-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️</span> Change Marks Scope?
                </h3>
                <button className="modal-close" onClick={() => setPendingScope(null)}>✕</button>
              </div>

              <div style={{ margin: '16px 0' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: '1.5', margin: 0 }}>
                  Changing the scope to <strong>{pendingScope === 'mst1' ? 'MST-I Only' : pendingScope === 'mst2' ? 'MST-II Only' : 'MST-I + MST-II (Full)'}</strong> will adjust visible input fields for all students.
                </p>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: '8px 0 0 0', fontWeight: '500' }}>
                  Existing marks data will be preserved in application state.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPendingScope(null)}
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                >
                  Keep Current
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmScopeChange}
                  style={{ padding: '8px 20px', fontSize: '13px' }}
                >
                  Change Scope
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COLLEGE & HEADER SETTINGS MODAL ── */}
      <AnimatePresence>
        {showHeaderSettingsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => setShowHeaderSettingsModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
              <div className="modal-header">
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--title-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🏛️</span> College & Header Settings
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '3px 0 0 0' }}>
                    Customize header fields printed on generated Excel & PDF marksheets
                  </p>
                </div>
                <button className="modal-close" onClick={() => setShowHeaderSettingsModal(false)}>✕</button>
              </div>

              <form onSubmit={handleSaveHeaderSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                <div className="form-group">
                  <label htmlFor="hdrCollege">College / Institute Name</label>
                  <input
                    id="hdrCollege"
                    type="text"
                    value={headerSettings.collegeName}
                    onChange={(e) => setHeaderSettings({ ...headerSettings, collegeName: e.target.value })}
                    placeholder="e.g. ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="hdrDept">Department Name</label>
                  <input
                    id="hdrDept"
                    type="text"
                    value={headerSettings.departmentName}
                    onChange={(e) => setHeaderSettings({ ...headerSettings, departmentName: e.target.value })}
                    placeholder="e.g. DEPARTMENT OF INFORMATION TECHNOLOGY"
                    required
                  />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label htmlFor="hdrSubjCode">Subject Code (Optional Override)</label>
                    <input
                      id="hdrSubjCode"
                      type="text"
                      value={headerSettings.subjectCode}
                      onChange={(e) => setHeaderSettings({ ...headerSettings, subjectCode: e.target.value.toUpperCase() })}
                      placeholder="e.g. CS402 (Auto if blank)"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="hdrSubjName">Subject Name (Optional Override)</label>
                    <input
                      id="hdrSubjName"
                      type="text"
                      value={headerSettings.subjectName}
                      onChange={(e) => setHeaderSettings({ ...headerSettings, subjectName: e.target.value })}
                      placeholder="e.g. Analysis & Design of Algorithms"
                    />
                  </div>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label htmlFor="hdrSem">Semester</label>
                    <input
                      id="hdrSem"
                      type="text"
                      value={headerSettings.semester}
                      onChange={(e) => setHeaderSettings({ ...headerSettings, semester: e.target.value })}
                      placeholder="e.g. IV"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="hdrSession">Session</label>
                    <input
                      id="hdrSession"
                      type="text"
                      value={headerSettings.session}
                      onChange={(e) => setHeaderSettings({ ...headerSettings, session: e.target.value })}
                      placeholder="e.g. Jan - Jun 2026"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="hdrExam">Exam Title</label>
                    <input
                      id="hdrExam"
                      type="text"
                      value={headerSettings.examTitle}
                      onChange={(e) => setHeaderSettings({ ...headerSettings, examTitle: e.target.value })}
                      placeholder="e.g. OFFICIAL MID-SEM MARKS"
                      required
                    />
                  </div>
                </div>

                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', color: '#38BDF8' }}>
                  💡 <strong>Note:</strong> These settings customize only the top banner of generated Excel & PDF marksheets. Marks data, formulas, and pass/fail calculations remain untouched.
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleResetHeaderSettings}>
                    🔄 Reset Default
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    💾 Save Header Settings
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MOBILE STICKY BOTTOM DOWNLOAD BAR ── */}
      {students && students.length > 0 && (
        <div className="midsem-mobile-bottom-bar">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowPreviewModal(true)}
            style={{
              width: '100%',
              padding: '12px 18px',
              fontSize: '14px',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              color: '#FFFFFF',
              boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              border: 'none',
              borderRadius: '12px'
            }}
          >
            <span>📥</span> Download Marks Sheet (PDF / Excel)
          </button>
        </div>
      )}

    </div>
  );
}
