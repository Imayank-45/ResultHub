import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { useToast } from './context/ToastContext';
import CustomSelect from './components/CustomSelect';

// Helper to format bytes into readable KB/MB
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Dynamic helper to parse PDF files via CDN-loaded pdf.js
async function parsePDFText(file) {
  const arrayBuffer = await file.arrayBuffer();
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

// Extract student details from pdf.js parsed text using Regex
function parseStudentPDFText(text) {
  const nameMatch = text.match(/Student Name\s*:\s*([^:\n\r\t]+?)(?=\s*(Enrollment|Program|Semester|$))/i);
  const name = nameMatch ? nameMatch[1].trim() : "Unknown Student";

  const enrollMatch = text.match(/Enrollment No\s*:\s*([a-zA-Z0-9]+)/i);
  const enrollment = enrollMatch ? enrollMatch[1].trim().toUpperCase() : "Unknown";

  const programMatch = text.match(/Program\s*:\s*([^:\n\r\t]+?)(?=\s*(Semester|Enrollment|$))/i);
  const program = programMatch ? programMatch[1].trim() : "B.Tech.";

  const semMatch = text.match(/Semester\s*:\s*Semester\s*(\d+)/i);
  const semester = semMatch ? semMatch[1].trim() : "Unknown";

  const sgpaMatch = text.match(/Semester Grade Point Average\s*\(SGPA\)\s*:\s*([\d\.]+)/i);
  const sgpa = sgpaMatch ? parseFloat(sgpaMatch[1]) : 0.0;

  const cgpaMatch = text.match(/Cumulative Grade Point Average\s*\(CGPA\)\s*:\s*([\d\.]+)/i);
  const cgpa = cgpaMatch ? parseFloat(cgpaMatch[1]) : 0.0;

  const resMatch = text.match(/RESULT STATUS\s*:\s*(PASS|FAIL|UNKNOWN)/i);
  const result = resMatch ? resMatch[1].trim().toUpperCase() : "UNKNOWN";

  const subjects = {};
  const backlogs = [];
  const regex = /([A-Z]{2,5}-?\d{3,4})\s+([O|A\+|A|B\+|B|C\+|C|D|P|F|FAIL|AB|ABSENT|RL|W|I]{1,6})/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const code = match[1].toUpperCase();
    const grade = match[2].toUpperCase();
    subjects[code] = grade;
    if (["F", "FAIL", "AB", "ABSENT", "RL"].includes(grade)) {
      backlogs.push(code);
    }
  }

  let branch = "Unknown";
  if (enrollment !== "Unknown" && enrollment.length >= 8) {
    const charMatch = enrollment.match(/[A-Z]+/i);
    if (charMatch) {
      branch = charMatch[0].toUpperCase();
    }
  }

  return {
    name,
    enrollment,
    program,
    semester,
    branch,
    sgpa,
    cgpa,
    result,
    subjects,
    backlogs
  };
}

export default function ResultCompareStudio() {
  const { success, error: toastError, info } = useToast();
  const [mode, setMode] = useState('class'); // student, class, semester
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [dataA, setDataA] = useState(null); // Array of students
  const [dataB, setDataB] = useState(null); // Array of students
  const [loadingA, setLoadingA] = useState(0); // Upload/Parse progress
  const [loadingB, setLoadingB] = useState(0);
  const [errorA, setErrorA] = useState('');
  const [errorB, setErrorB] = useState('');
  
  // Explicit compare trigger state
  const [hasCompared, setHasCompared] = useState(false);

  // Selection states for Student vs Student mode
  const [selectedStudentA, setSelectedStudentA] = useState('');
  const [selectedStudentB, setSelectedStudentB] = useState('');

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropzone references
  const fileInputRefA = useRef(null);
  const fileInputRefB = useRef(null);
  const resultsRef = useRef(null);

  // Reset file states when changing mode
  useEffect(() => {
    setFileA(null);
    setFileB(null);
    setDataA(null);
    setDataB(null);
    setLoadingA(0);
    setLoadingB(0);
    setErrorA('');
    setErrorB('');
    setSelectedStudentA('');
    setSelectedStudentB('');
    setHasCompared(false);
  }, [mode]);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleFileDrop = (e, target) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file, target);
    }
  };

  const handleFileSelect = (e, target) => {
    const file = e.target.files[0];
    if (file) {
      processFile(file, target);
    }
  };

  const processFile = async (file, target) => {
    const extension = file.name.split('.').pop().toLowerCase();
    const isExcel = ['xlsx', 'xls'].includes(extension);
    const isPDF = extension === 'pdf';
    const isCSV = extension === 'csv';

    if (target === 'A') {
      setFileA(file);
      setErrorA('');
      setLoadingA(10);
    } else {
      setFileB(file);
      setErrorB('');
      setLoadingB(10);
    }

    setHasCompared(false);

    if (!isExcel && !isPDF && !isCSV) {
      const errMsg = "Format not supported! Please upload .xlsx, .pdf or .csv files.";
      if (target === 'A') { setErrorA(errMsg); setLoadingA(0); setFileA(null); }
      else { setErrorB(errMsg); setLoadingB(0); setFileB(null); }
      return;
    }

    const setProgress = target === 'A' ? setLoadingA : setLoadingB;
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) {
          clearInterval(progressTimer);
          return prev;
        }
        return prev + 15;
      });
    }, 120);

    try {
      if (isPDF) {
        const text = await parsePDFText(file);
        const record = parseStudentPDFText(text);

        clearInterval(progressTimer);
        setProgress(100);

        if (target === 'A') {
          setDataA([record]);
          setSelectedStudentA(record.enrollment);
          success(`File 1 loaded: ${file.name}`);
        } else {
          setDataB([record]);
          setSelectedStudentB(record.enrollment);
          success(`File 2 loaded: ${file.name}`);
        }
      } else if (isExcel || isCSV) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const studentsList = [];
        rows.forEach(row => {
          let enrollment = "";
          let name = "";
          let result = "UNKNOWN";
          let sgpa = 0.0;
          let cgpa = 0.0;
          const subjects = {};
          const backlogs = [];

          Object.entries(row).forEach(([col, val]) => {
            const cleanCol = col.trim().toUpperCase();
            const valStr = String(val).trim();
            if (cleanCol.includes("ENROLL")) {
              enrollment = valStr.toUpperCase();
            } else if (cleanCol.includes("NAME")) {
              name = valStr;
            } else if (cleanCol.includes("RESULT") || cleanCol === "STATUS") {
              result = valStr.toUpperCase();
            } else if (cleanCol.includes("SGPA")) {
              sgpa = parseFloat(valStr) || 0.0;
            } else if (cleanCol.includes("CGPA")) {
              cgpa = parseFloat(valStr) || 0.0;
            } else if (cleanCol !== "S.NO" && cleanCol !== "S.NO." && cleanCol !== "SNO" && !cleanCol.startsWith("__EMPTY")) {
              if (valStr && valStr !== "nan" && valStr !== "None" && valStr !== "-") {
                subjects[col] = valStr;
                if (["F", "FAIL", "AB", "ABSENT", "RL"].includes(valStr.toUpperCase())) {
                  backlogs.push(col);
                }
              }
            }
          });

          if (enrollment && name) {
            let branch = "Unknown";
            const charMatch = enrollment.match(/[A-Z]+/i);
            if (charMatch) {
              branch = charMatch[0].toUpperCase();
            }

            studentsList.push({
              name,
              enrollment,
              branch,
              sgpa,
              cgpa,
              result,
              subjects,
              backlogs,
              semester: "Unknown"
            });
          }
        });

        clearInterval(progressTimer);
        setProgress(100);

        if (studentsList.length === 0) {
          throw new Error("No valid student rows found. Ensure columns like 'Enrollment' and 'Name' exist.");
        }

        if (target === 'A') {
          setDataA(studentsList);
          setSelectedStudentA(studentsList[0].enrollment);
          success(`File 1 loaded: ${studentsList.length} student records detected.`);
        } else {
          setDataB(studentsList);
          setSelectedStudentB(studentsList[0].enrollment);
          success(`File 2 loaded: ${studentsList.length} student records detected.`);
        }
      }
    } catch (e) {
      console.error(e);
      clearInterval(progressTimer);
      setProgress(0);
      const errMsg = `Error parsing file: ${e.message}`;
      if (target === 'A') { setErrorA(errMsg); setFileA(null); setDataA(null); }
      else { setErrorB(errMsg); setFileB(null); setDataB(null); }
      toastError(errMsg);
    }
  };

  const handleStartComparison = () => {
    if (!dataA || !dataB) return;
    setHasCompared(true);
    success("Comparison generated successfully!", { title: "Result Compare Studio" });
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Helper to get matching student objects
  const getStudentDetails = (enroll, data) => {
    if (!data || !enroll) return null;
    return data.find(s => s.enrollment === enroll) || null;
  };

  const studentA = getStudentDetails(selectedStudentA, dataA);
  const studentB = getStudentDetails(selectedStudentB, dataB);

  // Compute Class-level Comparison aggregates
  const computeClassAggregates = (studentsList) => {
    if (!studentsList || studentsList.length === 0) return null;

    const total = studentsList.length;
    let passed = 0;
    let failed = 0;
    let totalSgpa = 0;
    let totalCgpa = 0;
    let highestSgpa = 0;
    let lowestSgpa = 10;
    let totalBacklogs = 0;
    let topper = null;

    const subjectStats = {};

    studentsList.forEach(s => {
      if (s.result === 'PASS') passed++;
      else if (s.result === 'FAIL') failed++;

      totalSgpa += s.sgpa;
      totalCgpa += s.cgpa;
      totalBacklogs += s.backlogs.length;

      if (s.sgpa > highestSgpa) {
        highestSgpa = s.sgpa;
        topper = s;
      }
      if (s.sgpa < lowestSgpa && s.sgpa > 0) {
        lowestSgpa = s.sgpa;
      }

      Object.entries(s.subjects).forEach(([subj, grade]) => {
        if (!subjectStats[subj]) {
          subjectStats[subj] = { total: 0, failed: 0 };
        }
        subjectStats[subj].total++;
        if (["F", "FAIL", "AB", "ABSENT", "RL"].includes(grade.toUpperCase())) {
          subjectStats[subj].failed++;
        }
      });
    });

    const avgSgpa = totalSgpa / total;
    const avgCgpa = totalCgpa / total;
    const passPercentage = (passed / total) * 100;
    const failPercentage = (failed / total) * 100;

    let weakestSubject = "None";
    let highestFailRate = -1;
    let bestSubject = "None";
    let lowestFailRate = 101;

    Object.entries(subjectStats).forEach(([subj, stats]) => {
      const failRate = (stats.failed / stats.total) * 100;
      if (failRate > highestFailRate) {
        highestFailRate = failRate;
        weakestSubject = subj;
      }
      if (failRate < lowestFailRate) {
        lowestFailRate = failRate;
        bestSubject = subj;
      }
    });

    const sortedToppers = [...studentsList]
      .sort((x, y) => y.sgpa - x.sgpa)
      .slice(0, 10);

    return {
      total,
      passPercentage,
      failPercentage,
      avgSgpa,
      avgCgpa,
      highestSgpa,
      lowestSgpa: lowestSgpa === 10 ? 0 : lowestSgpa,
      totalBacklogs,
      topperName: topper ? topper.name : 'N/A',
      topperSgpa: topper ? topper.sgpa : 0.0,
      weakestSubject,
      bestSubject,
      toppersList: sortedToppers,
      subjectStats
    };
  };

  const classStatsA = computeClassAggregates(dataA);
  const classStatsB = computeClassAggregates(dataB);

  // Compute Semester comparison aggregates
  const computeSemesterAggregates = () => {
    if (!dataA || !dataB) return null;

    const mapB = new Map();
    dataB.forEach(s => mapB.set(s.enrollment, s));

    let totalMatched = 0;
    let improvedCount = 0;
    let droppedCount = 0;
    let sameCount = 0;
    let sumSgpaDiff = 0;

    const studentShifts = [];

    dataA.forEach(studentPrev => {
      const studentCurr = mapB.get(studentPrev.enrollment);
      if (studentCurr) {
        totalMatched++;
        const sgpaDiff = studentCurr.sgpa - studentPrev.sgpa;
        sumSgpaDiff += sgpaDiff;

        if (sgpaDiff > 0.05) improvedCount++;
        else if (sgpaDiff < -0.05) droppedCount++;
        else sameCount++;

        studentShifts.push({
          enrollment: studentPrev.enrollment,
          name: studentPrev.name,
          sgpaPrev: studentPrev.sgpa,
          sgpaCurr: studentCurr.sgpa,
          diff: sgpaDiff
        });
      }
    });

    const avgSgpaDiff = totalMatched > 0 ? (sumSgpaDiff / totalMatched) : 0;
    const sortedShifts = [...studentShifts].sort((x, y) => y.diff - x.diff);

    return {
      totalMatched,
      improvedCount,
      droppedCount,
      sameCount,
      avgSgpaDiff,
      shifts: sortedShifts
    };
  };

  const semStats = mode === 'semester' ? computeSemesterAggregates() : null;

  // Export comparison report as PDF
  const exportPDFReport = () => {
    const doc = new jsPDF();

    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 8, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text("RESULT COMPARE STUDIO", 105, 22, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("ResultAI Premium Academic Analytics Report", 105, 28, { align: "center" });

    doc.setDrawColor(203, 213, 225);
    doc.line(15, 33, 195, 33);

    let y = 42;

    if (mode === 'student' && studentA && studentB) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Student Performance Analysis (Side-by-Side)", 15, y);
      y += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Student A: ${studentA.name} (${studentA.enrollment})`, 15, y);
      doc.text(`Student B: ${studentB.name} (${studentB.enrollment})`, 110, y);
      y += 6;
      doc.text(`SGPA: ${studentA.sgpa}  |  CGPA: ${studentA.cgpa}`, 15, y);
      doc.text(`SGPA: ${studentB.sgpa}  |  CGPA: ${studentB.cgpa}`, 110, y);
      y += 6;
      doc.text(`Status: ${studentA.result} | Backlogs: ${studentA.backlogs.length}`, 15, y);
      doc.text(`Status: ${studentB.result} | Backlogs: ${studentB.backlogs.length}`, 110, y);
      y += 12;

      doc.setFont("helvetica", "bold");
      doc.text("Subject Grade Comparison:", 15, y);
      y += 8;

      doc.setFillColor(241, 245, 249);
      doc.rect(15, y - 4, 180, 7, 'F');
      doc.setFontSize(9);
      doc.text("SUBJECT CODE", 20, y.toFixed(0));
      doc.text("STUDENT A GRADE", 90, y.toFixed(0));
      doc.text("STUDENT B GRADE", 150, y.toFixed(0));
      y += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const allSubjects = Array.from(new Set([...Object.keys(studentA.subjects), ...Object.keys(studentB.subjects)]));

      allSubjects.forEach(subj => {
        doc.text(subj, 20, y);
        doc.text(studentA.subjects[subj] || '—', 95, y);
        doc.text(studentB.subjects[subj] || '—', 155, y);
        y += 7;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });

      y += 10;
      doc.setFont("helvetica", "bold");
      doc.text("AI Summary Insights:", 15, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);

      const sgpaDiff = studentB.sgpa - studentA.sgpa;
      doc.text(`• Student B SGPA is ${sgpaDiff >= 0 ? '+' : ''}${sgpaDiff.toFixed(2)} compared to Student A.`, 18, y);
      y += 6;

      let passStatusStr = "";
      if (studentA.result === studentB.result) passStatusStr = `Both students finished with ${studentA.result} status.`;
      else passStatusStr = `Student A finished as ${studentA.result} while Student B finished as ${studentB.result}.`;
      doc.text(`• Result Status: ${passStatusStr}`, 18, y);
      y += 6;

    } else if (mode === 'class' && classStatsA && classStatsB) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Class Performance Dashboard Metrics", 15, y);
      y += 10;

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      const metrics = [
        ["Total Students", classStatsA.total, classStatsB.total],
        ["Pass Percentage", `${classStatsA.passPercentage.toFixed(1)}%`, `${classStatsB.passPercentage.toFixed(1)}%`],
        ["Average SGPA", classStatsA.avgSgpa.toFixed(2), classStatsB.avgSgpa.toFixed(2)],
        ["Average CGPA", classStatsA.avgCgpa.toFixed(2), classStatsB.avgCgpa.toFixed(2)],
        ["Highest SGPA", classStatsA.highestSgpa.toFixed(2), classStatsB.highestSgpa.toFixed(2)],
        ["Total Backlogs", classStatsA.totalBacklogs, classStatsB.totalBacklogs],
        ["Topper", `${classStatsA.topperName} (${classStatsA.topperSgpa})`, `${classStatsB.topperName} (${classStatsB.topperSgpa})`],
        ["Best Subject", classStatsA.bestSubject, classStatsB.bestSubject],
        ["Weakest Subject", classStatsA.weakestSubject, classStatsB.weakestSubject],
      ];

      doc.setFillColor(241, 245, 249);
      doc.rect(15, y - 4, 180, 7, 'F');
      doc.setFont("helvetica", "bold");
      doc.text("METRIC DESCRIPTION", 20, y.toFixed(0));
      doc.text("CLASS A / FILE 1", 90, y.toFixed(0));
      doc.text("CLASS B / FILE 2", 150, y.toFixed(0));
      y += 8;

      doc.setFont("helvetica", "normal");
      metrics.forEach(row => {
        doc.text(String(row[0]), 20, y);
        doc.text(String(row[1]), 90, y);
        doc.text(String(row[2]), 150, y);
        y += 7;
      });

      y += 10;
      doc.setFont("helvetica", "bold");
      doc.text("AI Summary Insights:", 15, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      const sgpaDiff = classStatsB.avgSgpa - classStatsA.avgSgpa;
      doc.text(`• Class B average SGPA is ${sgpaDiff >= 0 ? '+' : ''}${sgpaDiff.toFixed(2)} compared to Class A.`, 18, y);
      y += 6;
      doc.text(`• Class A topper is ${classStatsA.topperName} (SGPA ${classStatsA.topperSgpa}) vs Class B topper ${classStatsB.topperName} (SGPA ${classStatsB.topperSgpa}).`, 18, y);
      y += 6;
      doc.text(`• Class A has ${classStatsA.totalBacklogs} total backlogs vs ${classStatsB.totalBacklogs} in Class B.`, 18, y);
      y += 6;

    } else if (mode === 'semester' && semStats) {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Semester Over Semester Student Analysis", 15, y);
      y += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total Matched Students: ${semStats.totalMatched}`, 15, y);
      y += 6;
      doc.text(`Students showing Improvement (+0.05 SGPA): ${semStats.improvedCount}`, 15, y);
      y += 6;
      doc.text(`Students showing Decline (-0.05 SGPA): ${semStats.droppedCount}`, 15, y);
      y += 6;
      doc.text(`Average SGPA shift: ${semStats.avgSgpaDiff >= 0 ? '+' : ''}${semStats.avgSgpaDiff.toFixed(3)}`, 15, y);
      y += 12;

      doc.setFont("helvetica", "bold");
      doc.text("Rank Changes / Student Progress Summary (Top shifts):", 15, y);
      y += 8;

      doc.setFillColor(241, 245, 249);
      doc.rect(15, y - 4, 180, 7, 'F');
      doc.setFontSize(9);
      doc.text("NAME", 20, y.toFixed(0));
      doc.text("ENROLLMENT", 90, y.toFixed(0));
      doc.text("SGPA SHIFT", 150, y.toFixed(0));
      y += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      semStats.shifts.slice(0, 15).forEach(s => {
        doc.text(s.name, 20, y);
        doc.text(s.enrollment, 90, y);
        doc.text(`${s.diff >= 0 ? '+' : ''}${s.diff.toFixed(2)} (${s.sgpaPrev} -> ${s.sgpaCurr})`, 150, y);
        y += 7;
      });
    }

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Disclaimer: Computer generated Result Comparison Studio analytics report from RGPV portal data.", 105, 280, { align: "center" });

    doc.save(`ResultCompareStudio_Report_${mode}.pdf`);
    info(`Exported Comparison Report PDF (${mode} mode)`);
  };

  const getFilteredRecords = (studentsList) => {
    if (!studentsList) return [];
    return studentsList.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.enrollment.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBranch = branchFilter ? s.branch === branchFilter : true;
      const matchStatus = statusFilter ? s.result === statusFilter : true;
      return matchSearch && matchBranch && matchStatus;
    });
  };

  const filteredA = getFilteredRecords(dataA);
  const filteredB = getFilteredRecords(dataB);

  const getBranches = () => {
    const list = [];
    if (dataA) dataA.forEach(s => list.push(s.branch));
    if (dataB) dataB.forEach(s => list.push(s.branch));
    return Array.from(new Set(list));
  };
  const allBranches = getBranches();

  // Both files uploaded readiness check
  const bothUploaded = !!(dataA && dataB && fileA && fileB);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="app-container"
      style={{ padding: '0 0 20px 0', gap: '24px' }}
    >
      {/* Page Header */}
      <div className="table-section-header" style={{ marginBottom: '8px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
              color: '#FFF'
            }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 1318 4m0 0l-4 4m4-4H3m18-6H7m0 0l4-4m-4 4l4 4"/>
              </svg>
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '850', background: 'linear-gradient(135deg, var(--title-color), #7C3AED, #2563EB)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.3px' }}>
              Result Compare Studio
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px', fontWeight: '500' }}>
            Compare branches, classes, student PDF results, or track semester-wise progress in real-time.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="compare-mode-switcher" style={{ display: 'flex', gap: '6px', background: 'var(--card-bg)', padding: '5px', borderRadius: '12px', border: '1px solid var(--card-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
          {[
            { id: 'class', label: 'Class Comparison', icon: '🏫' },
            { id: 'student', label: 'Student Comparison', icon: '👤' },
            { id: 'semester', label: 'Semester Comparison', icon: '📈' }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="btn compare-mode-btn"
              style={{
                width: 'auto',
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '750',
                background: mode === m.id ? 'var(--primary-gradient)' : 'transparent',
                color: mode === m.id ? '#FFFFFF' : 'var(--text-muted)',
                boxShadow: mode === m.id ? '0 4px 14px rgba(124,58,237,0.35)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* DRAG AND DROP FILE UPLOAD ZONES & PROFESSIONAL FILE PREVIEW CARDS */}
      <div className="compare-upload-grid">
        {/* Hidden inputs for File A & File B */}
        <input 
          type="file" 
          ref={fileInputRefA} 
          style={{ display: 'none' }} 
          onChange={(e) => handleFileSelect(e, 'A')} 
        />
        <input 
          type="file" 
          ref={fileInputRefB} 
          style={{ display: 'none' }} 
          onChange={(e) => handleFileSelect(e, 'B')} 
        />

        {/* ZONE A: PREVIEW CARD OR UPLOAD DROPZONE */}
        <AnimatePresence mode="wait">
          {fileA && dataA ? (
            <motion.div
              key="fileA-preview"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="glass-panel"
              style={{
                height: '100%',
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                background: 'rgba(34, 197, 94, 0.03)',
                borderRadius: '20px',
                boxShadow: '0 10px 30px rgba(34, 197, 94, 0.08)'
              }}
            >
              <div>
                <div className="compare-file-preview-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span className="badge pass" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E' }}>
                    Class A / File 1
                  </span>
                  <span style={{ fontSize: '11.5px', fontWeight: '750', color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Uploaded Successfully
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'var(--primary-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    flexShrink: 0,
                    boxShadow: '0 6px 18px rgba(124,58,237,0.3)'
                  }}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
                    </svg>
                  </div>

                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--title-color)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={fileA.name}>
                      {fileA.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                      <span>{formatFileSize(fileA.size)}</span>
                      <span>•</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '750' }}>
                        {dataA ? `${dataA.length} ${dataA.length === 1 ? 'Student' : 'Students'} Detected` : 'Parsing...'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Replace & Remove */}
              <div className="compare-file-preview-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--card-border)' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => fileInputRefA.current.click()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '750',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--title-color)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Replace File
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setFileA(null);
                    setDataA(null);
                    setLoadingA(0);
                    setErrorA('');
                    setHasCompared(false);
                  }}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '750',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#EF4444',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Remove
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="fileA-dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-panel"
              onDragOver={handleDragOver}
              onDrop={(e) => handleFileDrop(e, 'A')}
              style={{
                height: '100%',
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '36px 24px',
                textAlign: 'center',
                border: '2px dashed var(--card-border)',
                borderRadius: '20px',
                cursor: 'pointer',
                background: 'var(--card-bg)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                position: 'relative',
                transition: 'border-color 0.2s, background 0.2s'
              }}
              onClick={() => fileInputRefA.current.click()}
            >
              {loadingA > 0 ? (
                <div style={{ width: '100%', maxWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div className="spinner-small" style={{ borderTopColor: 'var(--primary)' }}></div>
                    <p style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '14px' }}>Parsing File 1 ({loadingA}%)...</p>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                    <div style={{ height: '100%', width: `${loadingA}%`, background: 'var(--primary-gradient)', transition: 'width 0.2s', borderRadius: '6px' }}></div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    width: '58px',
                    height: '58px',
                    borderRadius: '16px',
                    background: 'rgba(124, 58, 237, 0.08)',
                    border: '1px solid rgba(124, 58, 237, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                    color: 'var(--primary)',
                    boxShadow: '0 6px 20px rgba(124, 58, 237, 0.15)'
                  }}>
                    <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                    </svg>
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--title-color)' }}>
                    Upload {mode === 'student' ? 'Student PDF / Excel' : 'Class A Excel / CSV'}
                  </h4>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>
                    Drag & Drop or <span style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'underline' }}>Click to Browse</span>
                  </p>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '16px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--card-border)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>.XLSX</span>
                    <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--card-border)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>.CSV</span>
                    <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--card-border)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>.PDF</span>
                  </div>
                </div>
              )}
              {errorA && <p style={{ color: 'var(--danger)', fontSize: '11.5px', marginTop: '12px', fontWeight: '700', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: '8px' }}>{errorA}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* VS CIRCLE */}
        <div className="compare-vs-badge-container" style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <div className="compare-vs-badge" style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED, #3B82F6)',
            border: '3px solid var(--card-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '900',
            fontSize: '13px',
            color: '#FFFFFF',
            boxShadow: '0 0 25px rgba(124, 58, 237, 0.5)',
            zIndex: 2
          }}>
            VS
          </div>
        </div>

        {/* ZONE B: PREVIEW CARD OR UPLOAD DROPZONE */}
        <AnimatePresence mode="wait">
          {fileB && dataB ? (
            <motion.div
              key="fileB-preview"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="glass-panel"
              style={{
                height: '100%',
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                background: 'rgba(34, 197, 94, 0.03)',
                borderRadius: '20px',
                boxShadow: '0 10px 30px rgba(34, 197, 94, 0.08)'
              }}
            >
              <div>
                <div className="compare-file-preview-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span className="badge pass" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22C55E' }}>
                    Class B / File 2
                  </span>
                  <span style={{ fontSize: '11.5px', fontWeight: '750', color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Uploaded Successfully
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'var(--primary-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF',
                    flexShrink: 0,
                    boxShadow: '0 6px 18px rgba(124,58,237,0.3)'
                  }}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
                    </svg>
                  </div>

                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--title-color)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={fileB.name}>
                      {fileB.name}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                      <span>{formatFileSize(fileB.size)}</span>
                      <span>•</span>
                      <span style={{ color: 'var(--primary)', fontWeight: '750' }}>
                        {dataB ? `${dataB.length} ${dataB.length === 1 ? 'Student' : 'Students'} Detected` : 'Parsing...'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Replace & Remove */}
              <div className="compare-file-preview-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--card-border)' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => fileInputRefB.current.click()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '750',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--title-color)',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Replace File
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setFileB(null);
                    setDataB(null);
                    setLoadingB(0);
                    setErrorB('');
                    setHasCompared(false);
                  }}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '750',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#EF4444',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Remove
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="fileB-dropzone"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-panel"
              onDragOver={handleDragOver}
              onDrop={(e) => handleFileDrop(e, 'B')}
              style={{
                height: '100%',
                minHeight: '260px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '36px 24px',
                textAlign: 'center',
                border: '2px dashed var(--card-border)',
                borderRadius: '20px',
                cursor: 'pointer',
                background: 'var(--card-bg)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                position: 'relative',
                transition: 'border-color 0.2s, background 0.2s'
              }}
              onClick={() => fileInputRefB.current.click()}
            >
              {loadingB > 0 ? (
                <div style={{ width: '100%', maxWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div className="spinner-small" style={{ borderTopColor: 'var(--primary)' }}></div>
                    <p style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '14px' }}>Parsing File 2 ({loadingB}%)...</p>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                    <div style={{ height: '100%', width: `${loadingB}%`, background: 'var(--primary-gradient)', transition: 'width 0.2s', borderRadius: '6px' }}></div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    width: '58px',
                    height: '58px',
                    borderRadius: '16px',
                    background: 'rgba(124, 58, 237, 0.08)',
                    border: '1px solid rgba(124, 58, 237, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                    color: 'var(--primary)',
                    boxShadow: '0 6px 20px rgba(124, 58, 237, 0.15)'
                  }}>
                    <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                    </svg>
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--title-color)' }}>
                    Upload {mode === 'student' ? 'Student PDF / Excel' : 'Class B Excel / CSV'}
                  </h4>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>
                    Drag & Drop or <span style={{ color: 'var(--primary)', fontWeight: '700', textDecoration: 'underline' }}>Click to Browse</span>
                  </p>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '16px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--card-border)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>.XLSX</span>
                    <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--card-border)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>.CSV</span>
                    <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--card-border)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>.PDF</span>
                  </div>
                </div>
              )}
              {errorB && <p style={{ color: 'var(--danger)', fontSize: '11.5px', marginTop: '12px', fontWeight: '700', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: '8px' }}>{errorB}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* LARGE COMPARE FILES ACTION BUTTON BAR */}
      <AnimatePresence>
        {bothUploaded && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="compare-action-banner"
          >
            <button
              type="button"
              onClick={handleStartComparison}
              className="compare-btn-large"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
              </svg>
              <span>Compare Files & Generate Results</span>
            </button>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: '500' }}>
              Both files ready! Click to generate real-time metrics, grade charts & side-by-side analysis.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMPARISON OVERVIEW SECTION */}
      <div style={{ marginTop: '10px' }} ref={resultsRef}>
        <div className="compare-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '850', color: 'var(--title-color)' }}>
            Comparison Overview
          </h3>
          {hasCompared && dataA && dataB && (
            <button 
              onClick={exportPDFReport}
              className="btn btn-primary"
              style={{ width: 'auto', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', background: 'var(--primary-gradient)' }}
            >
              Export PDF Comparison Report
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!hasCompared || !dataA || !dataB ? (
            /* EMPTY STATE BEFORE COMPARISON GENERATION */
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="compare-empty-state"
            >
              <div className="compare-empty-icon-wrap">
                <svg width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 1318 4m0 0l-4 4m4-4H3m18-6H7m0 0l4-4m-4 4l4 4"/>
                </svg>
              </div>
              <h4 className="compare-empty-title">No files uploaded yet.</h4>
              <p className="compare-empty-subtitle">
                Upload two files to compare student performance.
              </p>
            </motion.div>
          ) : (
            /* COMPARISON RESULTS DASHBOARD */
            <motion.div
              key="comparison-results"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
            >
              {/* ========================================================================= */}
              {/* STUDENT VS STUDENT COMPARISON MODE */}
              {/* ========================================================================= */}
              {mode === 'student' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {(dataA.length > 1 || dataB.length > 1) && (
                    <div className="glass-panel compare-side-by-side-grid" style={{ padding: '16px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Select Student A (File 1)</label>
                        <CustomSelect
                          value={selectedStudentA}
                          onChange={(e) => setSelectedStudentA(e.target.value)}
                          options={dataA.map(s => ({ value: s.enrollment, label: `${s.name} (${s.enrollment})` }))}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Select Student B (File 2)</label>
                        <CustomSelect
                          value={selectedStudentB}
                          onChange={(e) => setSelectedStudentB(e.target.value)}
                          options={dataB.map(s => ({ value: s.enrollment, label: `${s.name} (${s.enrollment})` }))}
                        />
                      </div>
                    </div>
                  )}

                  {studentA && studentB && (
                    <>
                      <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <div className="metric-card" style={{ '--accent-color': 'var(--primary)', '--icon-bg-color': 'rgba(124, 58, 237, 0.15)' }}>
                          <span className="metric-label">Winner Performance</span>
                          <div className="metric-value" style={{ fontSize: '20px', marginTop: '10px' }}>
                            {studentA.sgpa === studentB.sgpa ? "It's a Tie!" : studentA.sgpa > studentB.sgpa ? studentA.name : studentB.name}
                          </div>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Based on highest SGPA
                          </p>
                        </div>

                        {(() => {
                          const diff = studentB.sgpa - studentA.sgpa;
                          return (
                            <div className="metric-card" style={{ '--accent-color': diff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              <span className="metric-label">SGPA Difference</span>
                              <div className="metric-value" style={{ color: diff >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '10px' }}>
                                {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                              </div>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Student B vs Student A
                              </p>
                            </div>
                          );
                        })()}

                        {(() => {
                          const diff = studentB.cgpa - studentA.cgpa;
                          return (
                            <div className="metric-card" style={{ '--accent-color': diff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              <span className="metric-label">CGPA Difference</span>
                              <div className="metric-value" style={{ color: diff >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '10px' }}>
                                {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                              </div>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Student B vs Student A
                              </p>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="compare-side-by-side-grid">
                        <div className="glass-panel" style={{ borderLeft: '4px solid var(--primary)' }}>
                          <span className="badge pass" style={{ marginBottom: '12px' }}>Student A</span>
                          <h3 style={{ fontSize: '18px', color: 'var(--title-color)' }}>{studentA.name}</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '4px' }}>Enrollment: {studentA.enrollment}</p>

                          <div className="compare-student-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                            <div>
                              <p style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>SGPA</p>
                              <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--title-color)' }}>{studentA.sgpa}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>CGPA</p>
                              <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--title-color)' }}>{studentA.cgpa}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</p>
                              <p style={{ fontSize: '14px', fontWeight: '800', color: studentA.result === 'PASS' ? 'var(--success)' : 'var(--danger)' }}>{studentA.result}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Backlogs</p>
                              <p style={{ fontSize: '14px', fontWeight: '800', color: studentA.backlogs.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{studentA.backlogs.length}</p>
                            </div>
                          </div>
                        </div>

                        <div className="glass-panel" style={{ borderLeft: '4px solid var(--secondary)' }}>
                          <span className="badge pass" style={{ marginBottom: '12px', background: 'rgba(79, 70, 229, 0.15)', color: 'var(--secondary)' }}>Student B</span>
                          <h3 style={{ fontSize: '18px', color: 'var(--title-color)' }}>{studentB.name}</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '4px' }}>Enrollment: {studentB.enrollment}</p>

                          <div className="compare-student-stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                            <div>
                              <p style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>SGPA</p>
                              <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--title-color)' }}>{studentB.sgpa}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>CGPA</p>
                              <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--title-color)' }}>{studentB.cgpa}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</p>
                              <p style={{ fontSize: '14px', fontWeight: '800', color: studentB.result === 'PASS' ? 'var(--success)' : 'var(--danger)' }}>{studentB.result}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Backlogs</p>
                              <p style={{ fontSize: '14px', fontWeight: '800', color: studentB.backlogs.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{studentB.backlogs.length}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="glass-panel">
                        <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="18" height="18" fill="none" stroke="var(--primary)" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 12 18.713l2.188-2.81m-6.375-5.468L12 7.626l4.188 2.809M12 2.25c5.385 0 9.75 4.365 9.75 9.75s-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12 6.615 2.25 12 2.25Z" />
                          </svg>
                          AI Insights Summary
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', lineHeight: '1.6' }}>
                          {(() => {
                            const sgpaDiff = studentB.sgpa - studentA.sgpa;
                            const cgpaDiff = studentB.cgpa - studentA.cgpa;

                            return (
                              <>
                                <p style={{ color: sgpaDiff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  • Student B SGPA is {sgpaDiff >= 0 ? `higher by +${sgpaDiff.toFixed(2)}` : `lower by ${sgpaDiff.toFixed(2)}`} points compared to Student A.
                                </p>
                                <p style={{ color: cgpaDiff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                  • CGPA trend: Student B shows a {cgpaDiff >= 0 ? `positive gain of +${cgpaDiff.toFixed(2)}` : `decline of ${cgpaDiff.toFixed(2)}`} compared to Student A.
                                </p>
                                {studentB.backlogs.length > studentA.backlogs.length ? (
                                  <p style={{ color: 'var(--danger)' }}>
                                    • Warning: Student B has {studentB.backlogs.length - studentA.backlogs.length} more backlog subjects than Student A.
                                  </p>
                                ) : studentB.backlogs.length < studentA.backlogs.length ? (
                                  <p style={{ color: 'var(--success)' }}>
                                    • Student B has cleared more subjects, with {studentA.backlogs.length - studentB.backlogs.length} fewer backlogs.
                                  </p>
                                ) : (
                                  <p style={{ color: 'var(--text-muted)' }}>
                                    • Both students have the same number of backlog subjects ({studentA.backlogs.length}).
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="glass-panel">
                        <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '14px' }}>Subject-wise Grade comparison</h3>
                        <div className="table-wrapper">
                          <table>
                            <thead>
                              <tr>
                                <th>Subject Code</th>
                                <th>Student A Grade</th>
                                <th>Student B Grade</th>
                                <th>Comparison Shift</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const allSubjects = Array.from(new Set([...Object.keys(studentA.subjects), ...Object.keys(studentB.subjects)]));
                                const gradeWeight = { 'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C+': 5, 'C': 4, 'D': 3, 'P': 2, 'F': 0, 'FAIL': 0, 'AB': 0, 'ABSENT': 0 };

                                return allSubjects.map(subj => {
                                  const gradeA = studentA.subjects[subj] || '—';
                                  const gradeB = studentB.subjects[subj] || '—';

                                  const weightA = gradeWeight[gradeA.toUpperCase()] ?? -1;
                                  const weightB = gradeWeight[gradeB.toUpperCase()] ?? -1;

                                  let shift = "Neutral";
                                  let shiftColor = "var(--text-muted)";

                                  if (weightA !== -1 && weightB !== -1) {
                                    if (weightB > weightA) {
                                      shift = `Improved (${gradeA} -> ${gradeB})`;
                                      shiftColor = "var(--success)";
                                    } else if (weightB < weightA) {
                                      shift = `Declined (${gradeA} -> ${gradeB})`;
                                      shiftColor = "var(--danger)";
                                    } else {
                                      shift = "No Change";
                                    }
                                  } else {
                                    shift = "Subject Absent in one record";
                                  }

                                  return (
                                    <tr key={subj}>
                                      <td className="subject-code">{subj}</td>
                                      <td style={{ fontWeight: '600' }}>{gradeA}</td>
                                      <td style={{ fontWeight: '600' }}>{gradeB}</td>
                                      <td style={{ color: shiftColor, fontWeight: '700' }}>{shift}</td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* CLASS VS CLASS COMPARISON MODE */}
              {/* ========================================================================= */}
              {mode === 'class' && classStatsA && classStatsB && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="glass-panel compare-banner-grid" style={{ borderLeft: '5px solid var(--primary)' }}>
                    <div>
                      <span className="badge pass" style={{ marginBottom: '8px' }}>Studio Analysis Summary</span>
                      <h3 style={{ fontSize: '20px', color: 'var(--title-color)' }}>
                        {classStatsA.avgSgpa === classStatsB.avgSgpa ? "Both classes performed equally!" : classStatsA.avgSgpa > classStatsB.avgSgpa ? `${fileA.name} Outperformed` : `${fileB.name} Outperformed`}
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px', lineHeight: '1.5' }}>
                        Based on Class Average SGPA comparison. File 2 got average SGPA of {classStatsB.avgSgpa.toFixed(2)} vs File 1 average SGPA of {classStatsA.avgSgpa.toFixed(2)}.
                      </p>
                    </div>
                    <div className="compare-summary-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <div>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Avg SGPA Difference</span>
                        <p style={{ fontSize: '18px', fontWeight: '800', color: classStatsB.avgSgpa >= classStatsA.avgSgpa ? 'var(--success)' : 'var(--danger)' }}>
                          {(classStatsB.avgSgpa - classStatsA.avgSgpa) >= 0 ? `+${(classStatsB.avgSgpa - classStatsA.avgSgpa).toFixed(2)}` : (classStatsB.avgSgpa - classStatsA.avgSgpa).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Pass % Difference</span>
                        <p style={{ fontSize: '18px', fontWeight: '800', color: classStatsB.passPercentage >= classStatsA.passPercentage ? 'var(--success)' : 'var(--danger)' }}>
                          {(classStatsB.passPercentage - classStatsA.passPercentage) >= 0 ? `+${(classStatsB.passPercentage - classStatsA.passPercentage).toFixed(1)}%` : `${(classStatsB.passPercentage - classStatsA.passPercentage).toFixed(1)}%`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: 0 }}>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Metric Description</th>
                            <th>File 1 ({fileA.name})</th>
                            <th>File 2 ({fileB.name})</th>
                            <th>Difference Shift</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const metricsList = [
                              { label: "Total Students", valA: classStatsA.total, valB: classStatsB.total, suffix: "", isHigherBetter: null },
                              { label: "Pass Percentage", valA: classStatsA.passPercentage, valB: classStatsB.passPercentage, suffix: "%", isHigherBetter: true },
                              { label: "Fail Percentage", valA: classStatsA.failPercentage, valB: classStatsB.failPercentage, suffix: "%", isHigherBetter: false },
                              { label: "Average SGPA", valA: classStatsA.avgSgpa, valB: classStatsB.avgSgpa, suffix: "", isHigherBetter: true },
                              { label: "Average CGPA", valA: classStatsA.avgCgpa, valB: classStatsB.avgCgpa, suffix: "", isHigherBetter: true },
                              { label: "Highest SGPA", valA: classStatsA.highestSgpa, valB: classStatsB.highestSgpa, suffix: "", isHigherBetter: true },
                              { label: "Lowest SGPA", valA: classStatsA.lowestSgpa, valB: classStatsB.lowestSgpa, suffix: "", isHigherBetter: true },
                              { label: "Total Backlogs", valA: classStatsA.totalBacklogs, valB: classStatsB.totalBacklogs, suffix: "", isHigherBetter: false },
                            ];

                            return metricsList.map(m => {
                              const diff = m.valB - m.valA;
                              let shiftText = "Neutral";
                              let color = "var(--text-muted)";

                              if (m.isHigherBetter !== null) {
                                if (diff > 0) {
                                  shiftText = `+${diff.toFixed(m.suffix ? 1 : 2)}${m.suffix}`;
                                  color = m.isHigherBetter ? "var(--success)" : "var(--danger)";
                                } else if (diff < 0) {
                                  shiftText = `${diff.toFixed(m.suffix ? 1 : 2)}${m.suffix}`;
                                  color = m.isHigherBetter ? "var(--danger)" : "var(--success)";
                                } else {
                                  shiftText = "No difference";
                                }
                              } else {
                                shiftText = diff >= 0 ? `+${diff}` : `${diff}`;
                              }

                              return (
                                <tr key={m.label}>
                                  <td style={{ fontWeight: '600' }}>{m.label}</td>
                                  <td>{m.valA.toFixed ? m.valA.toFixed(m.suffix ? 1 : 2) : m.valA}{m.suffix}</td>
                                  <td>{m.valB.toFixed ? m.valB.toFixed(m.suffix ? 1 : 2) : m.valB}{m.suffix}</td>
                                  <td style={{ color: color, fontWeight: '800' }}>{shiftText}</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="compare-banner-grid">
                    <div className="glass-panel">
                      <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '14px' }}>Average SGPA Comparison</h3>
                      <div className="compare-bar-chart-wrap" style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '40px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '45px', height: `${classStatsA.avgSgpa * 15}px`, background: 'var(--primary-gradient)', borderRadius: '6px 6px 0 0' }}></div>
                          <span style={{ fontSize: '12px', fontWeight: '700', marginTop: '8px' }}>File 1 ({classStatsA.avgSgpa.toFixed(2)})</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '45px', height: `${classStatsB.avgSgpa * 15}px`, background: 'linear-gradient(135deg, #22C55E 0%, #4ade80 100%)', borderRadius: '6px 6px 0 0' }}></div>
                          <span style={{ fontSize: '12px', fontWeight: '700', marginTop: '8px' }}>File 2 ({classStatsB.avgSgpa.toFixed(2)})</span>
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '14px', textAlign: 'center' }}>Pass rate Comparison</h3>
                      <div className="compare-donut-chart-wrap" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <svg viewBox="0 0 100 100" style={{ width: '80px', height: '80px', transform: 'rotate(-90deg)' }}>
                            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
                            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeWidth="8" strokeDasharray="251" strokeDashoffset={251 - (251 * classStatsA.passPercentage) / 100} strokeLinecap="round" />
                          </svg>
                          <p style={{ fontWeight: '800', marginTop: '8px', fontSize: '13px' }}>{classStatsA.passPercentage.toFixed(1)}%</p>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>File 1 Pass</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <svg viewBox="0 0 100 100" style={{ width: '80px', height: '80px', transform: 'rotate(-90deg)' }}>
                            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#22C55E" strokeWidth="8" strokeDasharray="251" strokeDashoffset={251 - (251 * classStatsB.passPercentage) / 100} strokeLinecap="round" />
                          </svg>
                          <p style={{ fontWeight: '800', marginTop: '8px', fontSize: '13px' }}>{classStatsB.passPercentage.toFixed(1)}%</p>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>File 2 Pass</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="compare-side-by-side-grid">
                    <div className="glass-panel">
                      <h3 style={{ fontSize: '14.5px', fontWeight: '800', marginBottom: '12px' }}>File 1 Top Toppers</h3>
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Rank</th>
                              <th>Name</th>
                              <th>SGPA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classStatsA.toppersList.slice(0, 5).map((t, idx) => (
                              <tr key={t.enrollment}>
                                <td style={{ fontWeight: '800' }}>#{idx + 1}</td>
                                <td>{t.name}</td>
                                <td style={{ fontWeight: '750' }}>{t.sgpa}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="glass-panel">
                      <h3 style={{ fontSize: '14.5px', fontWeight: '800', marginBottom: '12px' }}>File 2 Top Toppers</h3>
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Rank</th>
                              <th>Name</th>
                              <th>SGPA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classStatsB.toppersList.slice(0, 5).map((t, idx) => (
                              <tr key={t.enrollment}>
                                <td style={{ fontWeight: '800' }}>#{idx + 1}</td>
                                <td>{t.name}</td>
                                <td style={{ fontWeight: '750' }}>{t.sgpa}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* SEMESTER VS SEMESTER COMPARISON MODE */}
              {/* ========================================================================= */}
              {mode === 'semester' && semStats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="metrics-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <div className="metric-card" style={{ '--accent-color': 'var(--primary)', '--icon-bg-color': 'rgba(124, 58, 237, 0.15)' }}>
                      <span className="metric-label">Matched Students</span>
                      <div className="metric-value" style={{ marginTop: '10px' }}>{semStats.totalMatched}</div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Identified in both semesters</p>
                    </div>
                    <div className="metric-card" style={{ '--accent-color': 'var(--success)', '--icon-bg-color': 'rgba(34, 197, 94, 0.15)' }}>
                      <span className="metric-label">Improved SGPA</span>
                      <div className="metric-value" style={{ color: 'var(--success)', marginTop: '10px' }}>{semStats.improvedCount}</div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Gain larger than +0.05</p>
                    </div>
                    <div className="metric-card" style={{ '--accent-color': 'var(--danger)', '--icon-bg-color': 'rgba(239, 68, 68, 0.15)' }}>
                      <span className="metric-label">Declined SGPA</span>
                      <div className="metric-value" style={{ color: 'var(--danger)', marginTop: '10px' }}>{semStats.droppedCount}</div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Decline larger than -0.05</p>
                    </div>
                    <div className="metric-card" style={{ '--accent-color': semStats.avgSgpaDiff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      <span className="metric-label">Average Shift</span>
                      <div className="metric-value" style={{ color: semStats.avgSgpaDiff >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: '10px' }}>
                        {semStats.avgSgpaDiff >= 0 ? `+${semStats.avgSgpaDiff.toFixed(3)}` : semStats.avgSgpaDiff.toFixed(3)}
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Net batch SGPA drift</p>
                    </div>
                  </div>

                  <div className="glass-panel">
                    <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px' }}>Detailed Student Progress Shift</h3>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Student Name</th>
                            <th>Enrollment</th>
                            <th>Prev SGPA (File 1)</th>
                            <th>Curr SGPA (File 2)</th>
                            <th>Difference Shift</th>
                          </tr>
                        </thead>
                        <tbody>
                          {semStats.shifts.map(s => {
                            let color = "var(--text-muted)";
                            if (s.diff > 0.05) color = "var(--success)";
                            else if (s.diff < -0.05) color = "var(--danger)";

                            return (
                              <tr key={s.enrollment}>
                                <td style={{ fontWeight: '500', color: 'var(--title-color)' }}>{s.name}</td>
                                <td className="subject-code">{s.enrollment}</td>
                                <td>{s.sgpaPrev.toFixed(2)}</td>
                                <td>{s.sgpaCurr.toFixed(2)}</td>
                                <td style={{ color: color, fontWeight: '800' }}>
                                  {s.diff >= 0 ? `+${s.diff.toFixed(2)}` : s.diff.toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* SEARCH, FILTERS, AND DETAILED RECORDS LIST */}
              {/* ========================================================================= */}
              {mode !== 'student' && (
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '800' }}>Detailed Records Directory</h3>

                  <div className="compare-filter-toolbar">
                    <input 
                      type="text" 
                      placeholder="Search student by name or enrollment..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />

                    <CustomSelect
                      value={branchFilter}
                      onChange={(e) => setBranchFilter(e.target.value)}
                      options={[
                        { value: '', label: 'All Branches' },
                        ...allBranches.map(b => ({ value: b, label: b }))
                      ]}
                    />

                    <CustomSelect
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      options={[
                        { value: '', label: 'All Results' },
                        { value: 'PASS', label: 'PASS' },
                        { value: 'FAIL', label: 'FAIL' }
                      ]}
                    />
                  </div>

                  <div className="compare-side-by-side-grid">
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '750', marginBottom: '8px', color: 'var(--text-muted)' }}>File A ({filteredA.length} records)</h4>
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Enrollment</th>
                              <th>Name</th>
                              <th>SGPA</th>
                              <th>Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredA.slice(0, 10).map(s => (
                              <tr key={s.enrollment}>
                                <td className="subject-code" style={{ fontSize: '12px' }}>{s.enrollment}</td>
                                <td style={{ fontSize: '12.5px' }}>{s.name}</td>
                                <td style={{ fontWeight: '700' }}>{s.sgpa}</td>
                                <td>
                                  <span className={`badge ${s.result === 'PASS' ? 'pass' : 'fail'}`} style={{ fontSize: '8.5px', padding: '2px 6px' }}>
                                    {s.result}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '750', marginBottom: '8px', color: 'var(--text-muted)' }}>File B ({filteredB.length} records)</h4>
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Enrollment</th>
                              <th>Name</th>
                              <th>SGPA</th>
                              <th>Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredB.slice(0, 10).map(s => (
                              <tr key={s.enrollment}>
                                <td className="subject-code" style={{ fontSize: '12px' }}>{s.enrollment}</td>
                                <td style={{ fontSize: '12.5px' }}>{s.name}</td>
                                <td style={{ fontWeight: '700' }}>{s.sgpa}</td>
                                <td>
                                  <span className={`badge ${s.result === 'PASS' ? 'pass' : 'fail'}`} style={{ fontSize: '8.5px', padding: '2px 6px' }}>
                                    {s.result}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
