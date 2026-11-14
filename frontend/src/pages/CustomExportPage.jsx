import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// Field Definitions grouped by category
export const FIELD_GROUPS = [
  {
    id: 'student',
    title: 'Student Details',
    icon: '👤',
    color: '#3B82F6',
    fields: [
      { id: 'student_roll', label: 'Roll No. (Enrollment)', defaultChecked: true },
      { id: 'student_name', label: 'Student Name', defaultChecked: true },
      { id: 'student_course', label: 'Course (Degree)', defaultChecked: true },
      { id: 'student_branch', label: 'Branch', defaultChecked: true },
      { id: 'student_semester', label: 'Semester', defaultChecked: true },
      { id: 'student_status', label: 'Status (Regular/EX)', defaultChecked: true },
    ]
  },
  {
    id: 'subject',
    title: 'Subject Details',
    icon: '📚',
    color: '#8B5CF6',
    fields: [
      { id: 'subject_code', label: 'Subject Code', defaultChecked: true },
      { id: 'subject_grade', label: 'Grade Obtained', defaultChecked: true },
      { id: 'subject_total_credit', label: 'Total Credit', defaultChecked: true },
      { id: 'subject_earned_credit', label: 'Earned Credit', defaultChecked: true },
    ]
  },
  {
    id: 'result',
    title: 'Result Details',
    icon: '📊',
    color: '#10B981',
    fields: [
      { id: 'result_status', label: 'Result Status (PASS/FAIL)', defaultChecked: true },
      { id: 'result_sgpa', label: 'SGPA', defaultChecked: true },
      { id: 'result_cgpa', label: 'CGPA', defaultChecked: true },
    ]
  },
  {
    id: 'additional',
    title: 'Additional Details',
    icon: '🗓️',
    color: '#F59E0B',
    fields: [
      { id: 'reval_date', label: 'Revaluation Date', defaultChecked: true },
      { id: 'reval_date_late', label: 'Revaluation Date with Late Fee', defaultChecked: true },
    ]
  }
];

// All Field IDs
const ALL_FIELD_IDS = FIELD_GROUPS.flatMap(g => g.fields.map(f => f.id));

// Presets mapping
export const PRESETS = {
  FULL: {
    id: 'full',
    name: 'Full Marksheet',
    icon: '📜',
    description: 'Includes all student, subject, result, and revaluation details.',
    fields: [...ALL_FIELD_IDS]
  },
  SUMMARY: {
    id: 'summary',
    name: 'Result Summary',
    icon: '📋',
    description: 'Roll No, Name, Course, Branch, Semester, Status, Result, SGPA, CGPA.',
    fields: ['student_roll', 'student_name', 'student_course', 'student_branch', 'student_semester', 'student_status', 'result_status', 'result_sgpa', 'result_cgpa']
  },
  SUBJECT_GRADES: {
    id: 'subject_grades',
    name: 'Subject-wise Grades',
    icon: '📑',
    description: 'Roll No, Name, Subject Codes & Grades, SGPA, CGPA.',
    fields: ['student_roll', 'student_name', 'subject_code', 'subject_grade', 'result_status', 'result_sgpa', 'result_cgpa']
  },
  CUSTOM: {
    id: 'custom',
    name: 'Custom',
    icon: '⚙️',
    description: 'Tailored field selection chosen manually by user.',
    fields: []
  }
};

// Realistic RGPV Sample Data for Preview (when no active scraped records)
const MOCK_PREVIEW_RECORDS = [
  {
    enrollment: '0105IT241001',
    name: 'RAHUL SHARMA',
    course: 'B.Tech.',
    branch: 'IT',
    semester: '3',
    status: 'REGULAR',
    subjects: { 'IT301': 'A', 'IT302': 'B+', 'IT303': 'A+', 'IT304': 'B' },
    subject_credits: {
      'IT301': { total: 4, earned: 4 },
      'IT302': { total: 4, earned: 4 },
      'IT303': { total: 3, earned: 3 },
      'IT304': { total: 4, earned: 4 },
    },
    result: 'PASS',
    sgpa: 8.42,
    cgpa: 8.35,
    reval_date: '15-Aug-2026',
    reval_date_late: '22-Aug-2026'
  },
  {
    enrollment: '0105IT241002',
    name: 'ANANYA VERMA',
    course: 'B.Tech.',
    branch: 'IT',
    semester: '3',
    status: 'REGULAR',
    subjects: { 'IT301': 'A+', 'IT302': 'A+', 'IT303': 'A', 'IT304': 'A' },
    subject_credits: {
      'IT301': { total: 4, earned: 4 },
      'IT302': { total: 4, earned: 4 },
      'IT303': { total: 3, earned: 3 },
      'IT304': { total: 4, earned: 4 },
    },
    result: 'PASS',
    sgpa: 9.15,
    cgpa: 9.20,
    reval_date: '15-Aug-2026',
    reval_date_late: '22-Aug-2026'
  },
  {
    enrollment: '0105IT241003',
    name: 'VIKRAM SINGH',
    course: 'B.Tech.',
    branch: 'IT',
    semester: '3',
    status: 'REGULAR',
    subjects: { 'IT301': 'B', 'IT302': 'F', 'IT303': 'C', 'IT304': 'B+' },
    subject_credits: {
      'IT301': { total: 4, earned: 4 },
      'IT302': { total: 4, earned: 0 },
      'IT303': { total: 3, earned: 3 },
      'IT304': { total: 4, earned: 4 },
    },
    result: 'FAIL',
    sgpa: 5.60,
    cgpa: 6.10,
    reval_date: '15-Aug-2026',
    reval_date_late: '22-Aug-2026'
  }
];

export default function CustomExportPage({ 
  sessionRecords = [], 
  currentExportConfig = null, 
  onSaveExportConfig = null,
  onCloseModal = null 
}) {
  const { authFetch } = useAuth();
  const { success, error, info } = useToast();

  const [selectedFields, setSelectedFields] = useState(() => {
    if (currentExportConfig && Array.isArray(currentExportConfig)) {
      return currentExportConfig;
    }
    return [...ALL_FIELD_IDS];
  });

  const [activePreset, setActivePreset] = useState(() => {
    if (!currentExportConfig) return 'full';
    const currSet = new Set(currentExportConfig);
    for (const pKey of ['FULL', 'SUMMARY', 'SUBJECT_GRADES']) {
      const pFields = PRESETS[pKey].fields;
      if (pFields.length === currSet.size && pFields.every(f => currSet.has(f))) {
        return PRESETS[pKey].id;
      }
    }
    return 'custom';
  });

  const [isExporting, setIsExporting] = useState(false);

  // Field set helper
  const selectedSet = useMemo(() => new Set(selectedFields), [selectedFields]);

  // Select Preset Handler
  const handleSelectPreset = (presetKey) => {
    const preset = PRESETS[presetKey];
    setActivePreset(preset.id);
    if (preset.id !== 'custom') {
      setSelectedFields([...preset.fields]);
    }
  };

  // Field Checkbox Toggle
  const handleToggleField = (fieldId) => {
    setSelectedFields(prev => {
      let updated;
      if (prev.includes(fieldId)) {
        updated = prev.filter(id => id !== fieldId);
      } else {
        updated = [...prev, fieldId];
      }
      
      // Determine if matching a preset
      const updatedSet = new Set(updated);
      let matched = 'custom';
      for (const pKey of ['FULL', 'SUMMARY', 'SUBJECT_GRADES']) {
        const pFields = PRESETS[pKey].fields;
        if (pFields.length === updatedSet.size && pFields.every(f => updatedSet.has(f))) {
          matched = PRESETS[pKey].id;
          break;
        }
      }
      setActivePreset(matched);

      return updated;
    });
  };

  // Group Select/Deselect All
  const handleToggleGroup = (groupFields, checkAll) => {
    const groupFieldIds = groupFields.map(f => f.id);
    setSelectedFields(prev => {
      let updated;
      if (checkAll) {
        updated = Array.from(new Set([...prev, ...groupFieldIds]));
      } else {
        updated = prev.filter(id => !groupFieldIds.includes(id));
      }
      setActivePreset('custom');
      return updated;
    });
  };

  // Source records for live preview: use session records if available, otherwise sample mock data
  const previewRecords = useMemo(() => {
    if (sessionRecords && sessionRecords.length > 0) {
      return sessionRecords.slice(0, 5);
    }
    return MOCK_PREVIEW_RECORDS;
  }, [sessionRecords]);

  // Dynamic Subject list for preview
  const subjectCodes = useMemo(() => {
    const list = [];
    previewRecords.forEach(r => {
      if (r.subjects && typeof r.subjects === 'object') {
        Object.keys(r.subjects).forEach(c => {
          if (!list.includes(c)) list.push(c);
        });
      }
    });
    return list.length > 0 ? list : ['IT301', 'IT302', 'IT303', 'IT304'];
  }, [previewRecords]);

  // Compute live columns for preview table
  const previewColumns = useMemo(() => {
    const cols = [{ key: 'sno', title: 'S.NO' }];

    if (selectedSet.has('student_roll')) cols.push({ key: 'roll', title: 'ROLL NO' });
    if (selectedSet.has('student_name')) cols.push({ key: 'name', title: 'NAME' });
    if (selectedSet.has('student_course')) cols.push({ key: 'course', title: 'COURSE' });
    if (selectedSet.has('student_branch')) cols.push({ key: 'branch', title: 'BRANCH' });
    if (selectedSet.has('student_semester')) cols.push({ key: 'semester', title: 'SEMESTER' });
    if (selectedSet.has('student_status')) cols.push({ key: 'status', title: 'STATUS' });

    const includeGrade = selectedSet.has('subject_grade') || selectedSet.has('subject_code');
    const includeTotal = selectedSet.has('subject_total_credit');
    const includeEarned = selectedSet.has('subject_earned_credit');

    subjectCodes.forEach(sc => {
      if (includeGrade && !includeTotal && !includeEarned) {
        cols.push({ key: `subj_${sc}`, title: sc, isSubject: true, code: sc });
      } else {
        if (includeGrade) cols.push({ key: `subj_${sc}_grade`, title: `${sc} (Grade)`, isSubject: true, code: sc, subType: 'grade' });
        if (includeTotal) cols.push({ key: `subj_${sc}_total`, title: `${sc} (Total Credit)`, isSubject: true, code: sc, subType: 'total' });
        if (includeEarned) cols.push({ key: `subj_${sc}_earned`, title: `${sc} (Earned Credit)`, isSubject: true, code: sc, subType: 'earned' });
      }
    });

    if (selectedSet.has('result_status')) cols.push({ key: 'result', title: 'RESULT' });
    if (selectedSet.has('result_sgpa')) cols.push({ key: 'sgpa', title: 'SGPA' });
    if (selectedSet.has('result_cgpa')) cols.push({ key: 'cgpa', title: 'CGPA' });
    if (selectedSet.has('reval_date')) cols.push({ key: 'reval_date', title: 'REVALUATION DATE' });
    if (selectedSet.has('reval_date_late')) cols.push({ key: 'reval_date_late', title: 'REVALUATION DATE (LATE FEE)' });

    return cols;
  }, [selectedSet, subjectCodes]);

  // Compute live row cell values for preview
  const previewRows = useMemo(() => {
    return previewRecords.map((rec, idx) => {
      const isNf = Boolean(rec.not_found);
      const row = { id: idx, isNf, resultStr: isNf ? 'NOT FOUND' : String(rec.result || 'UNKNOWN').toUpperCase() };

      previewColumns.forEach(col => {
        if (col.key === 'sno') row[col.key] = idx + 1;
        else if (col.key === 'roll') row[col.key] = rec.enrollment || '-';
        else if (col.key === 'name') row[col.key] = isNf ? 'NOT FOUND' : (rec.name || '-');
        else if (col.key === 'course') row[col.key] = rec.course || rec.program || 'B.Tech.';
        else if (col.key === 'branch') row[col.key] = rec.branch || 'IT';
        else if (col.key === 'semester') row[col.key] = String(rec.semester || rec.sem || '3');
        else if (col.key === 'status') row[col.key] = rec.status || 'REGULAR';
        else if (col.key === 'result') row[col.key] = isNf ? 'NOT FOUND' : (rec.result || 'UNKNOWN').toUpperCase();
        else if (col.key === 'sgpa') row[col.key] = isNf ? '-' : (rec.sgpa ?? '-');
        else if (col.key === 'cgpa') row[col.key] = isNf ? '-' : (rec.cgpa ?? '-');
        else if (col.key === 'reval_date') row[col.key] = rec.reval_date || '15-Aug-2026';
        else if (col.key === 'reval_date_late') row[col.key] = rec.reval_date_late || '22-Aug-2026';
        else if (col.isSubject) {
          const sc = col.code;
          const grade = (rec.subjects && rec.subjects[sc]) || '-';
          if (!col.subType || col.subType === 'grade') {
            row[col.key] = isNf ? '-' : grade;
          } else if (col.subType === 'total') {
            const tot = rec.subject_credits && rec.subject_credits[sc] ? rec.subject_credits[sc].total : 4;
            row[col.key] = isNf ? '-' : tot;
          } else if (col.subType === 'earned') {
            const isFail = ['F', 'FAIL', 'AB', 'ABSENT', 'RL'].includes(grade.toUpperCase());
            const earn = isFail ? 0 : (rec.subject_credits && rec.subject_credits[sc] ? rec.subject_credits[sc].earned : 4);
            row[col.key] = isNf ? '-' : earn;
          }
        }
      });

      return row;
    });
  }, [previewRecords, previewColumns]);

  // Handle Download Custom Excel Action
  const handleDownloadCustomExcel = async () => {
    if (selectedFields.length === 0) {
      error('Please select at least one field to include in the export.');
      return;
    }

    setIsExporting(true);
    try {
      const recordsToExport = sessionRecords && sessionRecords.length > 0 ? sessionRecords : MOCK_PREVIEW_RECORDS;

      const res = await authFetch(`${API_BASE}/scrape/custom_export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: recordsToExport,
          selected_fields: selectedFields
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to generate custom Excel spreadsheet');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RGPV_Custom_Export_${activePreset}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      success('Custom Excel downloaded successfully!');
    } catch (err) {
      error('Export Error: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Save Template for Extraction Workflow
  const handleSaveAsDefault = () => {
    if (onSaveExportConfig) {
      onSaveExportConfig(selectedFields);
      success('Custom export template saved! Next extraction run will use these columns.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}
    >
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: 'var(--primary-gradient)', borderRadius: '10px', padding: '6px 10px', fontSize: '18px' }}>
              ⚙️
            </span>
            Custom Export Studio
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Customize RGPV marksheet columns for Excel export. Preview updates in real-time without starting scraper.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onSaveExportConfig && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSaveAsDefault}
              style={{ fontSize: '12.5px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              💾 Save for Extraction
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownloadCustomExcel}
            disabled={isExporting || selectedFields.length === 0}
            style={{ fontSize: '12.5px', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isExporting ? '⏳ Generating...' : '📥 Download Custom Excel'}
          </button>
          {onCloseModal && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCloseModal}
              style={{ fontSize: '12.5px', padding: '8px 12px' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Preset Templates Selector */}
      <section className="glass-panel" style={{ padding: '18px 22px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🎯</span> Export Preset Templates
          </h3>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
            {selectedFields.length} of {ALL_FIELD_IDS.length} columns selected
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
          {Object.keys(PRESETS).map((pKey) => {
            const p = PRESETS[pKey];
            const isSelected = activePreset === p.id;
            return (
              <motion.button
                key={p.id}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectPreset(pKey)}
                style={{
                  textAlign: 'left',
                  background: isSelected ? 'rgba(124, 58, 237, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--card-border)'}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 4px 18px rgba(124, 58, 237, 0.15)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: isSelected ? 'var(--primary)' : 'var(--title-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{p.icon}</span> {p.name}
                  </span>
                  {isSelected && (
                    <span style={{ fontSize: '10px', fontWeight: '900', background: 'var(--primary)', color: '#fff', padding: '2px 7px', borderRadius: '10px' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.35 }}>
                  {p.description}
                </p>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Field Customization Checkboxes (4 Distinct Categories) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {FIELD_GROUPS.map((group) => {
          const groupFieldIds = group.fields.map(f => f.id);
          const checkedCount = groupFieldIds.filter(id => selectedSet.has(id)).length;
          const allChecked = checkedCount === groupFieldIds.length;
          const someChecked = checkedCount > 0 && !allChecked;

          return (
            <div
              key={group.id}
              className="glass-panel"
              style={{
                padding: '18px',
                borderTop: `3px solid ${group.color}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{group.icon}</span>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--title-color)', margin: 0 }}>
                      {group.title}
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '750', padding: '2px 7px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: group.color }}>
                      {checkedCount}/{group.fields.length}
                    </span>
                  </div>
                </div>

                {/* Select / Deselect Group quick button */}
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleGroup(group.fields, !allChecked)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: group.color,
                      fontSize: '11px',
                      fontWeight: '750',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {allChecked ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Field Checkboxes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {group.fields.map((field) => {
                    const isChecked = selectedSet.has(field.id);
                    return (
                      <label
                        key={field.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '12.5px',
                          fontWeight: isChecked ? '700' : '500',
                          color: isChecked ? 'var(--text-main)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: isChecked ? 'rgba(255,255,255,0.03)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleField(field.id)}
                          style={{
                            width: '16px',
                            height: '16px',
                            accentColor: group.color,
                            cursor: 'pointer'
                          }}
                        />
                        <span>{field.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Duplicate Excel Preview Container */}
      <section className="glass-panel" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '850', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📊</span> Real-Time Excel Spreadsheet Preview
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Live preview reflecting active column selections. Instant preview without starting scraper job.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '750', padding: '4px 10px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              ⚡ Instant Sync ({previewColumns.length} Columns)
            </span>
            {sessionRecords && sessionRecords.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: '750', padding: '4px 10px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                Session Data ({sessionRecords.length} Records)
              </span>
            )}
          </div>
        </div>

        {/* Excel Spreadsheet Replica Grid */}
        <div
          style={{
            border: '1px solid var(--card-border)',
            borderRadius: '12px',
            overflow: 'auto',
            maxHeight: '400px',
            background: 'rgba(0, 0, 0, 0.25)'
          }}
        >
          {previewColumns.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              ⚠️ No columns selected. Please select at least one field above to generate the Excel table.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: '#1B365D', color: '#FFFFFF' }}>
                  {previewColumns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: '10px 14px',
                        fontWeight: '800',
                        fontSize: '11.5px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        textAlign: col.key === 'name' ? 'left' : 'center',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {col.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.id}
                    style={{
                      background: row.id % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {previewColumns.map((col) => {
                      const val = row[col.key];
                      const isResultCol = col.key === 'result';
                      const isPass = String(val).includes('PASS');
                      const isFail = String(val).includes('FAIL');
                      const isNf = String(val).includes('NOT FOUND');

                      let bg = 'transparent';
                      let color = 'var(--text-main)';
                      let fontWeight = '500';

                      if (col.key === 'sno' || col.key === 'roll') {
                        color = 'var(--text-muted)';
                        fontWeight = '700';
                      } else if (col.key === 'name') {
                        fontWeight = '750';
                      } else if (isResultCol) {
                        fontWeight = '800';
                        if (isPass) { bg = 'rgba(34, 197, 94, 0.18)'; color = '#22C55E'; }
                        else if (isFail) { bg = 'rgba(239, 68, 68, 0.18)'; color = '#EF4444'; }
                        else if (isNf) { bg = 'rgba(148, 163, 184, 0.18)'; color = '#94A3B8'; }
                      } else if (col.key === 'sgpa' || col.key === 'cgpa') {
                        fontWeight = '800';
                        color = 'var(--primary)';
                      }

                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: '9px 14px',
                            border: '1px solid var(--card-border)',
                            textAlign: col.key === 'name' ? 'left' : 'center',
                            background: bg,
                            color: color,
                            fontWeight: fontWeight
                          }}
                        >
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </motion.div>
  );
}
