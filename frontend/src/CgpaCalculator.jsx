import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { useToast } from './context/ToastContext';
import {
  Calculator,
  BookOpen,
  Plus,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  Download,
  ChevronDown,
  ChevronUp,
  Award,
  BarChart2,
  Info,
  Layers,
  Settings
} from 'lucide-react';

const DEFAULT_CREDITS_PER_SEM = 20;
const DEFAULT_SUBJECT_CREDITS = 4;

const DEFAULT_GRADE_TABLE = [
  { grade: "A+", points: 10, label: "Outstanding" },
  { grade: "A", points: 9, label: "Excellent" },
  { grade: "B+", points: 8, label: "Very Good" },
  { grade: "B", points: 7, label: "Good" },
  { grade: "C+", points: 6, label: "Average" },
  { grade: "C", points: 5, label: "Satisfactory" },
  { grade: "D", points: 4, label: "Pass" },
  { grade: "F", points: 0, label: "Fail / Absent" },
];

const PRESETS = {
  rgpv_btech: {
    name: "RGPV B.Tech (8 Semesters)",
    semesters: [
      { semester: 1, credits: 20 },
      { semester: 2, credits: 20 },
      { semester: 3, credits: 20 },
      { semester: 4, credits: 20 },
      { semester: 5, credits: 20 },
      { semester: 6, credits: 20 },
      { semester: 7, credits: 20 },
      { semester: 8, credits: 20 },
    ]
  },
  rgpv_mca: {
    name: "RGPV MCA / M.Tech (4 Semesters)",
    semesters: [
      { semester: 1, credits: 24 },
      { semester: 2, credits: 24 },
      { semester: 3, credits: 24 },
      { semester: 4, credits: 24 },
    ]
  }
};

function getDivisionHonor(cgpa) {
  if (cgpa === null || isNaN(cgpa)) return { title: "N/A", color: "var(--text-muted)", bg: "rgba(148, 163, 184, 0.1)" };
  if (cgpa >= 7.5) return { title: "First Class with Distinction", color: "#10B981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)" };
  if (cgpa >= 6.5) return { title: "First Division", color: "#6366F1", bg: "rgba(99, 102, 241, 0.12)", border: "rgba(99, 102, 241, 0.3)" };
  if (cgpa >= 5.0) return { title: "Second Division", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)" };
  return { title: "Pass / Below Average", color: "#EF4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.3)" };
}

let idCounter = 0;
function makeId() {
  idCounter += 1;
  return idCounter;
}

export default function CgpaCalculator() {
  const { success, info } = useToast();
  const [tab, setTab] = useState('cgpa'); // 'cgpa' | 'sgpa'

  // Tab 1: Semesters
  const [semRows, setSemRows] = useState([
    { id: makeId(), semester: 1, sgpa: "", credits: DEFAULT_CREDITS_PER_SEM },
    { id: makeId(), semester: 2, sgpa: "", credits: DEFAULT_CREDITS_PER_SEM },
    { id: makeId(), semester: 3, sgpa: "", credits: DEFAULT_CREDITS_PER_SEM },
    { id: makeId(), semester: 4, sgpa: "", credits: DEFAULT_CREDITS_PER_SEM },
  ]);

  // Tab 2: Subjects & Grade Scale
  const [gradeTable, setGradeTable] = useState(DEFAULT_GRADE_TABLE);
  const [showGradeTable, setShowGradeTable] = useState(false);
  const [subjectRows, setSubjectRows] = useState([
    { id: makeId(), name: "Theory Subject 1", grade: "A", credits: DEFAULT_SUBJECT_CREDITS },
    { id: makeId(), name: "Theory Subject 2", grade: "B+", credits: DEFAULT_SUBJECT_CREDITS },
    { id: makeId(), name: "Lab / Practical 1", grade: "A+", credits: 2 },
    { id: makeId(), name: "Project / Seminar", grade: "A", credits: 2 },
  ]);

  // Settings: Percentage Formula Mode ('rgpv' = (CGPA - 0.75) * 10 | 'standard' = CGPA * 10)
  const [pctFormula, setPctFormula] = useState('rgpv');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // --- ACROSS SEMESTERS CALCULATION ---
  const cgpaResult = useMemo(() => {
    let weightedSum = 0, creditSum = 0, count = 0;
    for (const r of semRows) {
      const sgpa = parseFloat(r.sgpa);
      const credits = parseFloat(r.credits);
      if (!isNaN(sgpa) && !isNaN(credits) && credits > 0) {
        weightedSum += sgpa * credits;
        creditSum += credits;
        count += 1;
      }
    }
    const val = creditSum > 0 ? weightedSum / creditSum : null;
    return { value: val, totalCredits: creditSum, count };
  }, [semRows]);

  // --- THIS SEMESTER CALCULATION ---
  const gradePointsMap = useMemo(() => {
    const map = {};
    for (const g of gradeTable) {
      if (g.grade && g.grade.trim()) {
        map[g.grade.trim().toUpperCase()] = parseFloat(g.points);
      }
    }
    return map;
  }, [gradeTable]);

  const sgpaResult = useMemo(() => {
    let weightedSum = 0, creditSum = 0, count = 0;
    const distribution = {};
    for (const r of subjectRows) {
      const key = (r.grade || "").trim().toUpperCase();
      const points = gradePointsMap[key];
      const credits = parseFloat(r.credits);
      if (points !== undefined && !isNaN(points) && !isNaN(credits) && credits > 0) {
        weightedSum += points * credits;
        creditSum += credits;
        count += 1;
        distribution[key] = (distribution[key] || 0) + 1;
      }
    }
    const val = creditSum > 0 ? weightedSum / creditSum : null;
    return { value: val, totalCredits: creditSum, count, distribution };
  }, [subjectRows, gradePointsMap]);

  // Current active main score
  const activeScore = useMemo(() => {
    if (tab === 'cgpa') return cgpaResult.value;
    if (tab === 'sgpa') return sgpaResult.value;
    return null;
  }, [tab, cgpaResult, sgpaResult]);

  // Calculate percentage based on chosen formula
  const activePercentage = useMemo(() => {
    if (activeScore === null || isNaN(activeScore)) return null;
    if (pctFormula === 'rgpv') {
      return Math.max(0, (activeScore - 0.75) * 10);
    }
    return activeScore * 10;
  }, [activeScore, pctFormula]);

  const activeHonor = useMemo(() => getDivisionHonor(activeScore), [activeScore]);

  // Actions
  function updateSemRow(id, field, value) {
    setSemRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addSemRow() {
    const nextSem = semRows.length ? Number(semRows[semRows.length - 1].semester || semRows.length) + 1 : 1;
    setSemRows((prev) => [...prev, { id: makeId(), semester: nextSem, sgpa: "", credits: DEFAULT_CREDITS_PER_SEM }]);
  }

  function removeSemRow(id) {
    setSemRows((prev) => prev.filter((r) => r.id !== id));
  }

  function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    setSemRows(
      preset.semesters.map((s) => ({
        id: makeId(),
        semester: s.semester,
        sgpa: "",
        credits: s.credits
      }))
    );
    info(`Loaded preset: ${preset.name}`);
  }

  function resetSemRows() {
    setSemRows([
      { id: makeId(), semester: 1, sgpa: "", credits: DEFAULT_CREDITS_PER_SEM },
      { id: makeId(), semester: 2, sgpa: "", credits: DEFAULT_CREDITS_PER_SEM },
      { id: makeId(), semester: 3, sgpa: "", credits: DEFAULT_CREDITS_PER_SEM },
      { id: makeId(), semester: 4, sgpa: "", credits: DEFAULT_CREDITS_PER_SEM },
    ]);
  }

  function updateSubjectRow(id, field, value) {
    setSubjectRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addSubjectRow() {
    setSubjectRows((prev) => [
      ...prev,
      { id: makeId(), name: `Subject ${prev.length + 1}`, grade: gradeTable[1]?.grade || "A", credits: DEFAULT_SUBJECT_CREDITS },
    ]);
  }

  function removeSubjectRow(id) {
    setSubjectRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateGradeTableRow(index, field, value) {
    setGradeTable((prev) => prev.map((g, i) => (i === index ? { ...g, [field]: value } : g)));
  }

  function addGradeTableRow() {
    setGradeTable((prev) => [...prev, { grade: "", points: 0, label: "Custom Grade" }]);
  }

  function removeGradeTableRow(index) {
    setGradeTable((prev) => prev.filter((_, i) => i !== index));
  }

  // Export & Copy Helpers
  const copySummaryText = () => {
    let text = `=== ResultAI Academic Calculation Summary ===\n`;
    if (tab === 'cgpa') {
      text += `Calculation Type: Across Semesters (CGPA)\n`;
      text += `Calculated CGPA: ${cgpaResult.value !== null ? cgpaResult.value.toFixed(2) : 'N/A'} / 10\n`;
      text += `Total Credits: ${cgpaResult.totalCredits}\n`;
      text += `Semesters Entered: ${cgpaResult.count}\n`;
    } else if (tab === 'sgpa') {
      text += `Calculation Type: Projected Semester SGPA\n`;
      text += `Projected SGPA: ${sgpaResult.value !== null ? sgpaResult.value.toFixed(2) : 'N/A'} / 10\n`;
      text += `Total Credits: ${sgpaResult.totalCredits}\n`;
      text += `Subjects Count: ${sgpaResult.count}\n`;
    }
    if (activePercentage !== null) {
      text += `Equivalent Percentage: ${activePercentage.toFixed(2)}% (${pctFormula === 'rgpv' ? 'RGPV Formula' : 'Standard 10x'})\n`;
    }
    text += `Division / Honor: ${activeHonor.title}\n`;
    text += `Generated on ResultAI Dashboard: ${new Date().toLocaleDateString()}`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    success("Calculation summary copied to clipboard!");
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const exportPDFReport = () => {
    const doc = new jsPDF();
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 10, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text("ResultAI Academic Grade Summary", 14, 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 32);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 36, 196, 36);

    let y = 46;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229);

    if (tab === 'cgpa') {
      doc.text("Cumulative Grade Point Average (CGPA) Breakdown", 14, y);
      y += 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);

      doc.text(`Final CGPA Score  : ${cgpaResult.value !== null ? cgpaResult.value.toFixed(2) : 'N/A'} / 10.0`, 14, y); y += 7;
      doc.text(`Total Credits     : ${cgpaResult.totalCredits}`, 14, y); y += 7;
      doc.text(`Semesters Count   : ${cgpaResult.count}`, 14, y); y += 12;

      doc.setFont("helvetica", "bold");
      doc.text("Semester Details:", 14, y); y += 8;
      doc.setFont("helvetica", "normal");
      semRows.forEach(r => {
        if (r.sgpa) {
          doc.text(`- Semester ${r.semester}: SGPA = ${r.sgpa} (${r.credits} Credits)`, 18, y);
          y += 6;
        }
      });
    } else if (tab === 'sgpa') {
      doc.text("Semester SGPA Prediction Breakdown", 14, y);
      y += 10;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);

      doc.text(`Projected SGPA    : ${sgpaResult.value !== null ? sgpaResult.value.toFixed(2) : 'N/A'} / 10.0`, 14, y); y += 7;
      doc.text(`Total Credits     : ${sgpaResult.totalCredits}`, 14, y); y += 7;
      doc.text(`Total Subjects    : ${sgpaResult.count}`, 14, y); y += 12;

      doc.setFont("helvetica", "bold");
      doc.text("Subject Details:", 14, y); y += 8;
      doc.setFont("helvetica", "normal");
      subjectRows.forEach(r => {
        doc.text(`- ${r.name || 'Subject'}: Grade ${r.grade} (${r.credits} Credits)`, 18, y);
        y += 6;
      });
    }

    y += 8;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y, 196, y);
    y += 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Performance Summary & Percentage:", 14, y); y += 8;
    doc.setFont("helvetica", "normal");
    if (activePercentage !== null) {
      doc.text(`- Equivalent Percentage : ${activePercentage.toFixed(2)}% (${pctFormula === 'rgpv' ? 'RGPV Formula: (CGPA - 0.75) * 10' : 'Standard: CGPA * 10'})`, 18, y); y += 6;
    }
    doc.text(`- Division Classification : ${activeHonor.title}`, 18, y); y += 12;

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("ResultAI Academic Planner — Official Grade & CGPA Calculator Report", 105, 285, { align: "center" });

    doc.save("ResultAI_Academic_Planner_Summary.pdf");
    info("Academic summary PDF downloaded successfully!");
  };

  return (
    <div style={{ width: '100%', maxWidth: '1120px', margin: '0 auto' }}>
      {/* HEADER BAR */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '20px',
        padding: '20px 24px',
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-base)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
            flexShrink: 0
          }}>
            <Calculator size={24} />
          </div>
          <div>
            <h1 style={{
              fontSize: '20px',
              fontWeight: '800',
              color: 'var(--title-color)',
              letterSpacing: '-0.02em',
              margin: 0
            }}>
              Academic Planner & CGPA Calculator
            </h1>
            <p style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              margin: '3px 0 0 0'
            }}>
              Calculate credit-weighted CGPA across semesters or predict semester SGPA.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={copySummaryText}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '10px',
              background: copiedSummary ? 'rgba(34, 197, 94, 0.15)' : 'var(--input-bg)',
              border: `1px solid ${copiedSummary ? 'var(--success)' : 'var(--card-border)'}`,
              color: copiedSummary ? 'var(--success)' : 'var(--text-main)',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {copiedSummary ? <Check size={15} /> : <Copy size={15} />}
            {copiedSummary ? "Copied!" : "Copy Summary"}
          </button>

          <button
            onClick={exportPDFReport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '10px',
              background: 'var(--primary-gradient)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            <Download size={15} />
            Export PDF
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* LEFT COLUMN: CONTROLS & INPUT SUITE */}
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: 'var(--shadow-base)'
        }}>
          {/* TAB STRIP */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
            padding: '5px',
            background: 'var(--input-bg)',
            borderRadius: '12px',
            marginBottom: '24px',
            border: '1px solid var(--card-border)'
          }}>
            <button
              onClick={() => setTab('cgpa')}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                background: tab === 'cgpa' ? 'var(--primary-gradient)' : 'transparent',
                color: tab === 'cgpa' ? '#FFFFFF' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <Layers size={14} />
              Semesters
            </button>

            <button
              onClick={() => setTab('sgpa')}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                background: tab === 'sgpa' ? 'var(--primary-gradient)' : 'transparent',
                color: tab === 'sgpa' ? '#FFFFFF' : 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <BookOpen size={14} />
              This Sem
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* TAB 1: ACROSS SEMESTERS (CGPA) */}
            {tab === 'cgpa' && (
              <motion.div
                key="tab-cgpa"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* Presets & Toolbar */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  marginBottom: '16px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Quick Presets:
                    </span>
                    <button
                      onClick={() => applyPreset('rgpv_btech')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(124, 58, 237, 0.1)',
                        border: '1px solid rgba(124, 58, 237, 0.25)',
                        color: 'var(--primary)',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      8-Sem B.Tech
                    </button>
                    <button
                      onClick={() => applyPreset('rgpv_mca')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'rgba(124, 58, 237, 0.1)',
                        border: '1px solid rgba(124, 58, 237, 0.25)',
                        color: 'var(--primary)',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      4-Sem MCA
                    </button>
                  </div>

                  <button
                    onClick={resetSemRows}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={13} />
                    Reset
                  </button>
                </div>

                {/* Sem Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr 1fr 34px',
                  gap: '10px',
                  padding: '0 4px 8px',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  <div>Semester</div>
                  <div>SGPA</div>
                  <div>Credits</div>
                  <div></div>
                </div>

                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {semRows.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '70px 1fr 1fr 34px',
                        gap: '10px',
                        alignItems: 'center'
                      }}
                    >
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={row.semester}
                        onChange={(e) => updateSemRow(row.id, "semester", e.target.value)}
                        style={{
                          padding: '9px 11px',
                          borderRadius: '10px',
                          border: '1px solid var(--card-border)',
                          background: 'var(--input-bg)',
                          color: 'var(--title-color)',
                          fontSize: '13.5px',
                          fontWeight: '700',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        placeholder="e.g. 8.25"
                        value={row.sgpa}
                        onChange={(e) => updateSemRow(row.id, "sgpa", e.target.value)}
                        style={{
                          padding: '9px 11px',
                          borderRadius: '10px',
                          border: '1px solid var(--card-border)',
                          background: 'var(--input-bg)',
                          color: 'var(--title-color)',
                          fontSize: '13.5px',
                          fontWeight: '600',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                      <input
                        type="number"
                        min="0"
                        value={row.credits}
                        onChange={(e) => updateSemRow(row.id, "credits", e.target.value)}
                        style={{
                          padding: '9px 11px',
                          borderRadius: '10px',
                          border: '1px solid var(--card-border)',
                          background: 'var(--input-bg)',
                          color: 'var(--title-color)',
                          fontSize: '13.5px',
                          fontWeight: '600',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        onClick={() => removeSemRow(row.id)}
                        title="Remove Semester"
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                          e.currentTarget.style.color = '#EF4444';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addSemRow}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px dashed var(--card-border)',
                    background: 'transparent',
                    color: 'var(--primary)',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--card-border)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Plus size={15} /> Add Semester
                </button>
              </motion.div>
            )}

            {/* TAB 2: THIS SEMESTER (SGPA PREDICTOR) */}
            {tab === 'sgpa' && (
              <motion.div
                key="tab-sgpa"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* Subject Table Header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 90px 76px 34px',
                  gap: '10px',
                  padding: '0 4px 8px',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em'
                }}>
                  <div>Subject Name</div>
                  <div>Grade</div>
                  <div>Credits</div>
                  <div></div>
                </div>

                {/* Subject Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {subjectRows.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 90px 76px 34px',
                        gap: '10px',
                        alignItems: 'center'
                      }}
                    >
                      <input
                        type="text"
                        placeholder="e.g. Data Structures"
                        value={row.name}
                        onChange={(e) => updateSubjectRow(row.id, "name", e.target.value)}
                        style={{
                          padding: '9px 11px',
                          borderRadius: '10px',
                          border: '1px solid var(--card-border)',
                          background: 'var(--input-bg)',
                          color: 'var(--title-color)',
                          fontSize: '13px',
                          fontWeight: '600',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                      <select
                        value={row.grade}
                        onChange={(e) => updateSubjectRow(row.id, "grade", e.target.value)}
                        style={{
                          padding: '9px 8px',
                          borderRadius: '10px',
                          border: '1px solid var(--card-border)',
                          background: 'var(--input-bg)',
                          color: 'var(--title-color)',
                          fontSize: '13px',
                          fontWeight: '800',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      >
                        {gradeTable.map((g) => (
                          <option key={g.grade} value={g.grade}>
                            {g.grade} ({g.points} pts)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={row.credits}
                        onChange={(e) => updateSubjectRow(row.id, "credits", e.target.value)}
                        style={{
                          padding: '9px 11px',
                          borderRadius: '10px',
                          border: '1px solid var(--card-border)',
                          background: 'var(--input-bg)',
                          color: 'var(--title-color)',
                          fontSize: '13.5px',
                          fontWeight: '600',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        onClick={() => removeSubjectRow(row.id)}
                        title="Remove Subject"
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                          e.currentTarget.style.color = '#EF4444';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addSubjectRow}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1.5px dashed var(--card-border)',
                    background: 'transparent',
                    color: 'var(--primary)',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    marginBottom: '18px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'rgba(124, 58, 237, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--card-border)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Plus size={15} /> Add Subject
                </button>

                {/* Grade Scale Toggle */}
                <button
                  onClick={() => setShowGradeTable((s) => !s)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <Settings size={14} />
                  {showGradeTable ? "Hide" : "Customize"} Grade-Point Scale Table
                  {showGradeTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showGradeTable && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{
                      marginTop: '12px',
                      padding: '14px',
                      borderRadius: '12px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--card-border)'
                    }}
                  >
                    <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
                      Default 10-point grading scale. Adjust grade point values below if your specific university regulations differ.
                    </p>
                    {gradeTable.map((g, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 70px 30px',
                          gap: '8px',
                          marginBottom: '6px'
                        }}
                      >
                        <input
                          value={g.grade}
                          onChange={(e) => updateGradeTableRow(i, "grade", e.target.value)}
                          placeholder="Grade (A+)"
                          style={{
                            padding: '6px 9px',
                            borderRadius: '8px',
                            border: '1px solid var(--card-border)',
                            background: 'var(--card-bg)',
                            color: 'var(--title-color)',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}
                        />
                        <input
                          type="number"
                          value={g.points}
                          onChange={(e) => updateGradeTableRow(i, "points", e.target.value)}
                          placeholder="Points"
                          style={{
                            padding: '6px 9px',
                            borderRadius: '8px',
                            border: '1px solid var(--card-border)',
                            background: 'var(--card-bg)',
                            color: 'var(--title-color)',
                            fontSize: '12px',
                            fontWeight: '700'
                          }}
                        />
                        <button
                          onClick={() => removeGradeTableRow(i)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addGradeTableRow}
                      style={{
                        marginTop: '8px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'none',
                        border: '1px solid var(--card-border)',
                        color: 'var(--text-main)',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Grade Scale Row
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: LIVE ANALYTICS & VISUAL SCOREBOARD */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {/* Main Score & Gauge Card */}
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '20px',
            padding: '24px',
            boxShadow: 'var(--shadow-base)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '800',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: '16px'
            }}>
              {tab === 'cgpa' ? 'Cumulative Performance (CGPA)' : 'Semester Projection (SGPA)'}
            </span>

            {/* Circular Gauge */}
            <div style={{ position: 'relative', width: '130px', height: '130px', margin: '8px 0 16px' }}>
              <svg width="130" height="130" viewBox="0 0 130 130">
                <circle
                  cx="65"
                  cy="65"
                  r="54"
                  fill="none"
                  stroke="var(--card-border)"
                  strokeWidth="10"
                />
                {activeScore !== null && (
                  <circle
                    cx="65"
                    cy="65"
                    r="54"
                    fill="none"
                    stroke={activeHonor.color}
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 54}
                    strokeDashoffset={2 * Math.PI * 54 * (1 - Math.min(Math.max(activeScore / 10, 0), 1))}
                    strokeLinecap="round"
                    transform="rotate(-90 65 65)"
                    style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.5s ease" }}
                  />
                )}
              </svg>

              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: '28px',
                  fontWeight: '900',
                  color: activeHonor.color,
                  fontFamily: 'monospace',
                  lineHeight: '1'
                }}>
                  {activeScore !== null ? activeScore.toFixed(2) : "—"}
                </span>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginTop: '2px' }}>
                  out of 10
                </span>
              </div>
            </div>

            {/* Division / Status Badge */}
            <div style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: activeHonor.bg,
              border: `1px solid ${activeHonor.border || 'transparent'}`,
              color: activeHonor.color,
              fontSize: '12.5px',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '16px'
            }}>
              <Award size={15} />
              {activeHonor.title}
            </div>

            {/* Details Stats Row */}
            <div style={{
              width: '100%',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid var(--card-border)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                  Total Credits
                </span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--title-color)', marginTop: '2px', display: 'block' }}>
                  {tab === 'cgpa' ? cgpaResult.totalCredits : sgpaResult.totalCredits}
                </span>
              </div>

              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                  Entries Count
                </span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--title-color)', marginTop: '2px', display: 'block' }}>
                  {tab === 'cgpa' ? `${cgpaResult.count} Sems` : `${sgpaResult.count} Subjects`}
                </span>
              </div>
            </div>
          </div>

          {/* RGPV Percentage Converter Module */}
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: 'var(--shadow-base)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={16} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)' }}>
                  Percentage Equivalent
                </span>
              </div>

              <div style={{ display: 'flex', gap: '4px', background: 'var(--input-bg)', padding: '2px', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <button
                  onClick={() => setPctFormula('rgpv')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: pctFormula === 'rgpv' ? 'var(--primary)' : 'transparent',
                    color: pctFormula === 'rgpv' ? '#FFFFFF' : 'var(--text-muted)',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  RGPV Formula
                </button>
                <button
                  onClick={() => setPctFormula('standard')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: pctFormula === 'standard' ? 'var(--primary)' : 'transparent',
                    color: pctFormula === 'standard' ? '#FFFFFF' : 'var(--text-muted)',
                    fontSize: '10.5px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  10x Standard
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--input-bg)',
              border: '1px solid var(--card-border)'
            }}>
              <div>
                <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--primary)', fontFamily: 'monospace' }}>
                  {activePercentage !== null ? `${activePercentage.toFixed(2)}%` : '— %'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {pctFormula === 'rgpv' ? 'Formula: (CGPA - 0.75) × 10' : 'Formula: CGPA × 10'}
                </div>
              </div>

              <Info size={16} style={{ color: 'var(--text-muted)' }} title="Used by RGPV Bhopal for official grade percentage conversion." />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
