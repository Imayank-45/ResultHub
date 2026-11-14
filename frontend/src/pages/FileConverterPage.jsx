import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const CONVERTER_TYPES = [
  { id: 'excel_to_pdf', title: 'Excel → PDF', category: 'core', leftIcon: '📊', rightIcon: '📄', accept: '.xlsx,.xls', desc: 'Convert spreadsheets into printable PDF documents with custom orientation & scaling.' },
  { id: 'pdf_to_excel', title: 'PDF → Excel', category: 'core', leftIcon: '📄', rightIcon: '📊', accept: '.pdf', desc: 'Extract structured tables from PDF into an editable Excel spreadsheet.' },
  { id: 'image_to_pdf', title: 'Image → PDF', category: 'core', leftIcon: '🖼️', rightIcon: '📄', accept: '.png,.jpg,.jpeg,.webp', desc: 'Convert single image (PNG, JPG, WEBP) into a PDF document.' },
  { id: 'pdf_compress', title: 'Compress PDF', category: 'pdf', leftIcon: '🗜️', rightIcon: '', accept: '.pdf', desc: 'Reduce PDF file size while maintaining readability.' },
  { id: 'result_format', title: 'Result Formatter', category: 'resultai', leftIcon: '✨', rightIcon: '', accept: '.xlsx,.xls,.pdf', desc: 'Clean empty rows, normalize headers, format SGPA/CGPA, PASS/FAIL badges, autofilters & freeze panes for RGPV Excel and PDF result files.', fullWidth: true },
];

export default function FileConverterPage({ onBackToDashboard }) {
  const { authFetch } = useAuth();
  const { success, error: toastError, warning, info } = useToast();

  const [activeConverterId, setActiveConverterId] = useState('excel_to_pdf');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Converter Settings State
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('landscape');
  const [margin, setMargin] = useState(20);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [imageFit, setImageFit] = useState('fit');
  const [compressionLevel, setCompressionLevel] = useState('medium');

  // Result Formatter Options
  const [rfOptions, setRfOptions] = useState({
    clean_empty_rows: true,
    normalize_columns: true,
    format_sgpa_cgpa: true,
    format_pass_fail: true,
    autofit_columns: true,
    freeze_header: true,
    add_filters: true,
    remove_duplicates: false,
    table_style: 'indigo'
  });

  const [preAnalysis, setPreAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Processing & Flow State
  const [conversionState, setConversionState] = useState('idle'); // idle | uploading | processing | completed | error
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [conversionResult, setConversionResult] = useState(null);
  const [conversionErrorMessage, setConversionErrorMessage] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Conversion History & Pagination State
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Delete Modal State
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeConverter = CONVERTER_TYPES.find(c => c.id === activeConverterId) || CONVERTER_TYPES[0];

  // Fetch conversion history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await authFetch(`${API_BASE}/tools/convert/history`);
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data || []);
      }
    } catch (e) {
      console.error("Fetch conversion history error:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Auto-switch orientation default based on file converter type
  useEffect(() => {
    if (activeConverterId === 'excel_to_pdf') {
      setOrientation('landscape');
    } else if (activeConverterId === 'image_to_pdf') {
      setOrientation('portrait');
    }
  }, [activeConverterId]);

  const parseResponse = async (res) => {
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (e) {
      json = { detail: text || `Server error (HTTP ${res.status})` };
    }
    if (!res.ok) {
      throw new Error(json.detail || `Request failed with HTTP status ${res.status}`);
    }
    return json;
  };

  // Pre-analysis inspection for Result Formatter
  const runPreAnalysis = async (file) => {
    if (!file) return;
    setIsAnalyzing(true);
    setPreAnalysis(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await authFetch(`${API_BASE}/tools/result/analyze`, {
        method: 'POST',
        body: formData
      });
      const data = await parseResponse(res);
      setPreAnalysis(data);
    } catch (err) {
      console.error("Pre-analysis error:", err);
      toastError(`Inspection error: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileSelect = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);

    for (const f of filesArray) {
      if (f.size > 50 * 1024 * 1024) {
        toastError(`File "${f.name}" exceeds the 50MB maximum size limit.`);
        return;
      }
    }

    if (activeConverter.multi) {
      setSelectedFiles(prev => [...prev, ...filesArray]);
    } else {
      const singleFile = filesArray[0];
      setSelectedFiles([singleFile]);
      if (activeConverterId === 'result_format') {
        runPreAnalysis(singleFile);
      }
    }
    setConversionState('idle');
    setConversionResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeFileAt = (index) => {
    setSelectedFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        setPreAnalysis(null);
        setConversionState('idle');
      }
      return updated;
    });
  };

  const handleStartConversion = async () => {
    if (selectedFiles.length === 0) {
      warning('Please upload a file before converting.');
      return;
    }

    setConversionState('uploading');
    setProgressPercent(20);
    setProgressText('Uploading file securely...');

    try {
      let data = null;

      if (activeConverterId === 'pdf_compress') {
        setProgressPercent(45);
        setProgressText('Compressing PDF content streams...');
        const formData = new FormData();
        formData.append('file', selectedFiles[0]);
        formData.append('options', JSON.stringify({ compression_level: compressionLevel }));

        const res = await authFetch(`${API_BASE}/tools/pdf/compress`, {
          method: 'POST',
          body: formData
        });
        data = await parseResponse(res);

      } else if (activeConverterId === 'result_format') {
        setProgressPercent(50);
        setProgressText('Applying ResultAI academic cleaning & styling rules...');
        const formData = new FormData();
        formData.append('file', selectedFiles[0]);
        formData.append('options', JSON.stringify(rfOptions));

        const res = await authFetch(`${API_BASE}/tools/result/format`, {
          method: 'POST',
          body: formData
        });
        data = await parseResponse(res);

      } else {
        // Standard file conversion (excel_to_pdf, pdf_to_excel, image_to_pdf)
        setProgressPercent(55);
        setProgressText(`Converting file with ${activeConverter.title}...`);

        const formData = new FormData();
        formData.append('file', selectedFiles[0]);
        formData.append('operation', activeConverterId);
        formData.append('options', JSON.stringify({
          page_size: pageSize,
          orientation,
          margin,
          include_headers: includeHeaders,
          image_fit: imageFit
        }));

        const res = await authFetch(`${API_BASE}/tools/convert`, {
          method: 'POST',
          body: formData
        });
        data = await parseResponse(res);
      }

      setProgressPercent(100);
      setProgressText('Conversion completed!');
      setConversionResult(data);
      setConversionState('completed');
      success(`Successfully converted: ${data.output_filename || 'Output File'}`);
      fetchHistory(); // Refresh history list

    } catch (err) {
      console.error("Conversion error:", err);
      setConversionState('error');
      setConversionErrorMessage(err.message);
      toastError(`Conversion failed: ${err.message}`);
    }
  };

  // AUTHENTICATED BLOB FILE DOWNLOADER
  const handleDownloadFile = async (targetFilename = null) => {
    const filename = targetFilename || (conversionResult ? conversionResult.output_filename : null);
    if (!filename) {
      toastError("Download filename is missing.");
      return;
    }

    setIsDownloading(true);
    try {
      const downloadUrl = `${API_BASE}/tools/convert/download?filename=${encodeURIComponent(filename)}`;
      const res = await authFetch(downloadUrl);

      if (!res.ok) {
        throw new Error(`Server returned HTTP status ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 200);

      success(`Downloaded "${filename}" successfully!`);
    } catch (err) {
      console.error("Blob download error:", err);
      toastError(`Download failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // CONFIRMED DELETE HISTORY ITEM HANDLER
  const confirmDeleteHistoryItem = async (itemId) => {
    setIsDeleting(true);
    try {
      const res = await authFetch(`${API_BASE}/tools/convert/history/delete/${itemId}`, {
        method: 'POST'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setHistoryList(prev => prev.filter(item => item.id !== itemId));
        success("Conversion record deleted successfully.");
        setItemToDelete(null);
        fetchHistory();
      } else {
        toastError(data.detail || "Failed to remove conversion log.");
      }
    } catch (e) {
      console.error("Delete history error:", e);
      toastError(`Delete failed: ${e.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetAll = () => {
    setSelectedFiles([]);
    setConversionState('idle');
    setConversionResult(null);
    setPreAnalysis(null);
    setConversionErrorMessage('');
  };

  // Helper formatting for History Table Operation Badges
  const getOpBadgeStyle = (opKey) => {
    if (opKey === 'excel_to_pdf') return { bg: 'rgba(124, 58, 237, 0.12)', color: '#7C3AED', label: 'Excel → PDF', border: 'rgba(124, 58, 237, 0.3)' };
    if (opKey === 'result_format') return { bg: 'rgba(245, 158, 11, 0.12)', color: '#D97706', label: 'Result Formatter', border: 'rgba(245, 158, 11, 0.3)' };
    if (opKey === 'pdf_to_excel') return { bg: 'rgba(16, 185, 129, 0.12)', color: '#059669', label: 'PDF → Excel', border: 'rgba(16, 185, 129, 0.3)' };
    if (opKey === 'image_to_pdf') return { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563EB', label: 'Image → PDF', border: 'rgba(59, 130, 246, 0.3)' };
    return { bg: 'rgba(100, 116, 139, 0.12)', color: '#475569', label: opKey, border: 'rgba(100, 116, 139, 0.3)' };
  };

  // Helper formatting for File Type Icons
  const getFileTypeIcon = (fname) => {
    const ext = (fname || '').split('.').pop().toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) return '📊';
    if (['pdf'].includes(ext)) return '📕';
    if (['docx', 'doc'].includes(ext)) return '📘';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return '🖼️';
    return '📄';
  };

  // Date formatter for history table
  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' • ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoStr;
    }
  };

  // Pagination computations
  const totalResults = historyList.length;
  const totalPages = Math.ceil(totalResults / rowsPerPage) || 1;
  const paginatedHistory = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return historyList.slice(startIdx, startIdx + rowsPerPage);
  }, [historyList, currentPage, rowsPerPage]);

  return (
    <div className="fc-container">
      {/* EMBEDDED MOBILE SCOPED RESPONSIVE STYLES */}
      <style>{`
        .fc-container {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          padding: 0 0 40px 0;
          min-width: 0;
          overflow-x: hidden;
        }

        .fc-mode-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .fc-mode-btn {
          padding: 9px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
          min-height: 44px;
          box-sizing: border-box;
        }

        .fc-dropzone {
          position: relative;
          background: rgba(124, 58, 237, 0.02);
          border: 2px dashed rgba(124, 58, 237, 0.4);
          border-radius: 18px;
          padding: 48px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 220px;
          cursor: pointer;
          transition: all 0.25s ease;
          width: 100%;
          box-sizing: border-box;
        }

        .fc-max-size-badge {
          position: absolute;
          right: 24px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 12px 18px;
          text-align: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.03);
        }

        .fc-workspace-grid {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 24px;
        }

        .fc-desktop-table-container {
          display: block;
          width: 100%;
          overflow-x: auto;
        }

        .fc-mobile-cards-container {
          display: none;
        }

        /* MOBILE & TABLET RESPONSIVE RULES (< 768px) */
        @media (max-width: 767px) {
          .fc-container {
            padding: 0 4px 24px 4px !important;
          }

          .fc-card-panel {
            padding: 16px !important;
            border-radius: 14px !important;
            margin-bottom: 16px !important;
          }

          .fc-header {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 12px !important;
          }

          .fc-header-btn {
            width: 100% !important;
            justify-content: center !important;
          }

          /* MOBILE 2-COLUMN GRID FOR MODE BUTTONS */
          .fc-mode-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
            width: 100% !important;
          }

          .fc-mode-btn {
            width: 100% !important;
            min-height: 44px !important;
            justify-content: center !important;
            padding: 8px 6px !important;
            font-size: 11.5px !important;
            box-sizing: border-box !important;
            min-width: 0 !important;
          }

          .fc-mode-btn-full {
            grid-column: span 2 !important;
          }

          .fc-mode-btn span {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* MOBILE UPLOAD DROPZONE */
          .fc-dropzone {
            padding: 24px 14px !important;
            min-height: 190px !important;
          }

          .fc-max-size-badge {
            position: static !important;
            transform: none !important;
            margin-top: 16px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }

          /* MOBILE WORKSPACE GRID */
          .fc-workspace-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }

          /* RECENT ACTIVITY: REPLACE TABLE WITH STACKED CARDS */
          .fc-desktop-table-container {
            display: none !important;
          }

          .fc-mobile-cards-container {
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
          }

          .fc-mobile-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--card-border);
            border-radius: 14px;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            width: 100%;
            box-sizing: border-box;
            min-width: 0;
          }

          .fc-mobile-card-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
          }

          .fc-mobile-card-title {
            font-size: 13.5px;
            font-weight: 800;
            color: var(--title-color);
            overflow-wrap: anywhere;
            word-break: break-word;
            margin: 0;
          }

          .fc-mobile-card-badges {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .fc-mobile-card-sub {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11.5px;
            color: var(--text-muted);
            padding-top: 6px;
            border-top: 1px solid var(--card-border);
          }

          .fc-mobile-card-actions {
            display: flex;
            gap: 8px;
            margin-top: 4px;
          }

          .fc-mobile-card-actions button {
            flex: 1;
            justify-content: center;
            min-height: 40px;
          }

          /* MOBILE PAGINATION */
          .fc-pagination-footer {
            flex-direction: column !important;
            align-items: center !important;
            gap: 12px !important;
            text-align: center !important;
          }

          .fc-rows-select {
            width: 90px !important;
          }
        }

        /* EXTRA COMPACT MOBILE (< 380px) */
        @media (max-width: 380px) {
          .fc-mode-btn {
            font-size: 10.5px !important;
            padding: 6px 4px !important;
            gap: 4px !important;
          }
        }
      `}</style>
      
      {/* PAGE HEADER */}
      <div className="fc-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: '800',
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.35)',
              flexShrink: 0
            }}>
              🔄
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '850', color: 'var(--title-color)', margin: 0, letterSpacing: '-0.02em' }}>
                File Converter & Tools
              </h1>
              <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Convert, clean and optimize your academic result files in seconds.
              </p>
            </div>
          </div>
        </div>

        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="secondary-btn fc-header-btn"
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '750',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
              minHeight: '44px'
            }}
          >
            ← Back to Dashboard
          </button>
        )}
      </div>

      {/* STEP 1: SELECT CONVERSION MODE */}
      <div className="glass-panel fc-card-panel" style={{ padding: '20px', borderRadius: '18px', marginBottom: '24px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
          STEP 1: SELECT CONVERSION MODE
        </div>

        <div className="fc-mode-grid">
          {CONVERTER_TYPES.map(tool => {
            const isActive = tool.id === activeConverterId;
            return (
              <button
                key={tool.id}
                onClick={() => {
                  setActiveConverterId(tool.id);
                  resetAll();
                }}
                type="button"
                className={`fc-mode-btn ${tool.fullWidth ? 'fc-mode-btn-full' : ''}`}
                style={{
                  border: isActive ? '1px solid #7C3AED' : '1px solid var(--card-border)',
                  background: isActive ? 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)' : 'var(--card-bg)',
                  color: isActive ? '#FFFFFF' : 'var(--text-main)',
                  fontWeight: isActive ? '800' : '650',
                  boxShadow: isActive ? '0 6px 20px rgba(124, 58, 237, 0.35)' : 'none'
                }}
              >
                <span>{tool.leftIcon}</span>
                <span>{tool.title}</span>
                {tool.rightIcon && <span>{tool.rightIcon}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 2: UPLOAD FILES & WORKSPACE */}
      <div className="glass-panel fc-card-panel" style={{ padding: '24px', borderRadius: '18px', marginBottom: '24px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
          STEP 2: {selectedFiles.length > 0 ? 'CONVERSION WORKSPACE' : 'UPLOAD FILES'}
        </div>

        {/* MAIN DROPZONE WITH CLOUD ICON & MAX SIZE BADGE */}
        {selectedFiles.length === 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="fc-dropzone"
            style={{
              background: isDragOver ? 'rgba(124, 58, 237, 0.08)' : 'rgba(124, 58, 237, 0.02)',
              border: isDragOver ? '2px dashed #7C3AED' : '2px dashed rgba(124, 58, 237, 0.4)'
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple={activeConverter.multi}
              accept={activeConverter.accept}
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            {/* Glowing Cloud Upload Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              marginBottom: '16px',
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.35)'
            }}>
              ☁️
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '850', color: 'var(--title-color)', margin: '0 0 6px 0', textAlign: 'center' }}>
              Drag & drop your file here
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '0 0 14px 0', textAlign: 'center' }}>
              or <span style={{ color: '#7C3AED', fontWeight: '800', textDecoration: 'underline' }}>click to browse files</span>
            </p>

            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textAlign: 'center' }}>
              Supported: PDF • XLSX • XLS • PNG • JPG • JPEG • WEBP
            </span>

            {/* Max Size Badge */}
            <div className="fc-max-size-badge">
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '750', textTransform: 'uppercase', display: 'block' }}>
                Max File Size
              </span>
              <span style={{ fontSize: '18px', fontWeight: '850', color: '#7C3AED', display: 'block', marginTop: '2px' }}>
                50 MB
              </span>
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>per file</span>
            </div>
          </div>
        )}

        {/* WORKSPACE CONTENT WHEN FILES SELECTED */}
        {selectedFiles.length > 0 && (
          <div className="fc-workspace-grid">
            
            {/* LEFT: FILE CARDS & CONVERSION ACTION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '850', color: 'var(--title-color)' }}>
                  Selected File{selectedFiles.length > 1 ? 's' : ''} ({selectedFiles.length})
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {activeConverter.multi && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="secondary-btn"
                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', fontWeight: '750', minHeight: '36px' }}
                    >
                      + Add More
                    </button>
                  )}
                  <button
                    onClick={resetAll}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '750', cursor: 'pointer', minHeight: '36px' }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple={activeConverter.multi}
                accept={activeConverter.accept}
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelect(e.target.files)}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(124, 58, 237, 0.03)',
                      border: '1px solid rgba(124, 58, 237, 0.25)',
                      borderRadius: '14px',
                      padding: '14px 18px',
                      gap: '12px',
                      minWidth: 0
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', overflow: 'hidden', minWidth: 0 }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                        {getFileTypeIcon(file.name)}
                      </div>
                      <div style={{ overflow: 'hidden', minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--title-color)', overflowWrap: 'anywhere', wordBreak: 'break-all' }}>
                          {file.name}
                        </p>
                        <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {(file.size / (1024 * 1024)).toFixed(2)} MB • {file.type || 'Document'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFileAt(idx)}
                      style={{ background: 'rgba(239,68,68,0.12)', border: 'none', color: '#EF4444', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* RESULT FORMATTER PRE-ANALYSIS REPORT */}
              {activeConverterId === 'result_format' && (
                <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--card-border)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '850', color: 'var(--title-color)' }}>
                    🔍 Result Inspection Report
                  </h4>

                  {isAnalyzing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <span className="spinner" style={{ width: '18px', height: '18px' }}></span>
                      Analyzing result workbook structure & detecting anomalies...
                    </div>
                  )}

                  {preAnalysis && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
                        <div style={{ background: 'rgba(124, 58, 237, 0.08)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(124, 58, 237, 0.25)' }}>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '700' }}>Students</span>
                          <p style={{ margin: '3px 0 0 0', fontSize: '18px', fontWeight: '850', color: '#7C3AED' }}>{preAnalysis.students_detected}</p>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '700' }}>Sheets</span>
                          <p style={{ margin: '3px 0 0 0', fontSize: '18px', fontWeight: '850', color: 'var(--title-color)' }}>{preAnalysis.sheets_detected}</p>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '700' }}>Columns</span>
                          <p style={{ margin: '3px 0 0 0', fontSize: '18px', fontWeight: '850', color: 'var(--title-color)' }}>{preAnalysis.columns_detected}</p>
                        </div>
                        <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                          <span style={{ fontSize: '10.5px', color: '#D97706', fontWeight: '700' }}>Missing</span>
                          <p style={{ margin: '3px 0 0 0', fontSize: '18px', fontWeight: '850', color: '#D97706' }}>{preAnalysis.missing_values_count}</p>
                        </div>
                        <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                          <span style={{ fontSize: '10.5px', color: '#EF4444', fontWeight: '700' }}>Duplicates</span>
                          <p style={{ margin: '3px 0 0 0', fontSize: '18px', fontWeight: '850', color: '#EF4444' }}>{preAnalysis.duplicate_records_count}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PROGRESS & CONVERSION COMPLETE BANNER */}
              {conversionState !== 'idle' && (
                <div style={{ padding: '18px', borderRadius: '16px', background: 'rgba(124, 58, 237, 0.03)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '750', color: 'var(--title-color)' }}>
                      {progressText}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '850', color: '#7C3AED' }}>
                      {progressPercent}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${progressPercent}%`,
                        height: '100%',
                        background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>

                  {conversionState === 'completed' && conversionResult && (
                    <div style={{ marginTop: '16px', background: 'rgba(34, 197, 94, 0.08)', border: '1.5px solid rgba(34, 197, 94, 0.4)', borderRadius: '14px', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.2)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                          ✅
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', color: '#22C55E', fontWeight: '850' }}>
                            {activeConverterId === 'pdf_compress' ? 'PDF Compression Complete' : 'Conversion Complete'}
                          </h4>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--text-main)', fontWeight: '600', overflowWrap: 'anywhere' }}>
                            {conversionResult.output_filename} <span style={{ color: 'var(--text-muted)' }}>({((conversionResult.compressed_size || conversionResult.file_size_bytes || 0) / 1024).toFixed(1)} KB)</span>
                          </p>
                        </div>
                      </div>

                      {/* PDF COMPRESSION SPECIFIC METRICS */}
                      {activeConverterId === 'pdf_compress' && conversionResult.original_size && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', margin: '14px 0', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                          <div>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '750', textTransform: 'uppercase' }}>Original Size</span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: '850', color: 'var(--title-color)' }}>
                              {(conversionResult.original_size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '750', textTransform: 'uppercase' }}>Compressed Size</span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: '850', color: '#7C3AED' }}>
                              {(conversionResult.compressed_size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                          <div>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: '750', textTransform: 'uppercase' }}>Reduction</span>
                            <p style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: '850', color: conversionResult.saved_bytes > 0 ? '#22C55E' : '#D97706' }}>
                              {conversionResult.saved_bytes > 0 ? `🔥 -${conversionResult.saved_percent}%` : '0% (Already Optimized)'}
                            </p>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '14px' }}>
                        <button
                          onClick={() => handleDownloadFile(conversionResult.output_filename)}
                          disabled={isDownloading}
                          className="primary-btn"
                          style={{
                            padding: '10px 20px',
                            borderRadius: '9px',
                            fontSize: '13px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
                            boxShadow: '0 6px 18px rgba(124, 58, 237, 0.3)',
                            opacity: isDownloading ? 0.7 : 1,
                            minHeight: '44px'
                          }}
                        >
                          {isDownloading ? (
                            <>
                              <span className="spinner" style={{ width: '14px', height: '14px' }}></span> Downloading...
                            </>
                          ) : (
                            <>
                              <span>📥</span> Download File
                            </>
                          )}
                        </button>

                        <button
                          onClick={resetAll}
                          className="secondary-btn"
                          style={{ padding: '10px 16px', borderRadius: '9px', fontSize: '13px', fontWeight: '700', minHeight: '44px' }}
                        >
                          Convert Another
                        </button>
                      </div>
                    </div>
                  )}

                  {conversionState === 'error' && (
                    <div style={{ marginTop: '14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', padding: '14px', color: '#EF4444', fontSize: '13px' }}>
                      ❌ {conversionErrorMessage}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* RIGHT: CONVERSION SETTINGS & CONVERT ACTION */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'rgba(0,0,0,0.02)', padding: '18px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '850', color: 'var(--title-color)', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
                Conversion Settings
              </h3>

              {['excel_to_pdf', 'image_to_pdf'].includes(activeConverterId) && (
                <>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                      PAGE SIZE
                    </label>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '13px', fontWeight: '700', minHeight: '40px' }}
                    >
                      <option value="A4">A4 Standard</option>
                      <option value="Letter">US Letter</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                      ORIENTATION
                    </label>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '13px', fontWeight: '700', minHeight: '40px' }}
                    >
                      <option value="landscape">Landscape (Horizontal)</option>
                      <option value="portrait">Portrait (Vertical)</option>
                    </select>
                  </div>
                </>
              )}

              {activeConverterId === 'pdf_compress' && (
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    COMPRESSION LEVEL
                  </label>
                  <select
                    value={compressionLevel}
                    onChange={(e) => setCompressionLevel(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontSize: '13px', fontWeight: '700', minHeight: '40px' }}
                  >
                    <option value="medium">Medium Compression (Recommended - High Image & Stream Optimization)</option>
                    <option value="high">High Compression (Smallest Size - Maximum Image Downscaling)</option>
                    <option value="low">Low Compression (Best Quality - Minor Content Stream Cleanup)</option>
                  </select>
                </div>
              )}


              {/* ACTION CONVERT BUTTON */}
              <button
                onClick={handleStartConversion}
                disabled={conversionState === 'uploading' || conversionState === 'processing'}
                className="primary-btn"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '850',
                  marginTop: '6px',
                  background: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
                  boxShadow: '0 6px 20px rgba(124, 58, 237, 0.35)',
                  opacity: (conversionState === 'uploading' || conversionState === 'processing') ? 0.6 : 1,
                  minHeight: '48px'
                }}
              >
                {conversionState === 'uploading' || conversionState === 'processing' ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span> Converting...
                  </span>
                ) : (
                  `Convert File ${activeConverter.leftIcon}`
                )}
              </button>
            </div>

          </div>
        )}

      </div>

      {/* RECENT CONVERSION ACTIVITY (TABLE ON DESKTOP, CARDS ON MOBILE) */}
      <div className="glass-panel fc-card-panel" style={{ padding: '24px', borderRadius: '18px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '850', color: 'var(--title-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📜</span> Recent Conversion Activity
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Your recent file conversions
            </p>
          </div>

          <button
            onClick={fetchHistory}
            style={{ background: 'none', border: 'none', color: '#7C3AED', cursor: 'pointer', fontSize: '13px', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            ↻ Refresh
          </button>
        </div>

        {loadingHistory ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '20px 0' }}>Loading activity history...</p>
        ) : historyList.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '20px 0' }}>No recent file conversions found.</p>
        ) : (
          <>
            {/* DESKTOP TABLE VIEW (≥ 768px) */}
            <div className="fc-desktop-table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '12px 14px', fontWeight: '800' }}>File Name</th>
                    <th style={{ padding: '12px 14px', fontWeight: '800' }}>Conversion Type</th>
                    <th style={{ padding: '12px 14px', fontWeight: '800' }}>Status</th>
                    <th style={{ padding: '12px 14px', fontWeight: '800' }}>File Size</th>
                    <th style={{ padding: '12px 14px', fontWeight: '800' }}>Converted At</th>
                    <th style={{ padding: '12px 14px', fontWeight: '800', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((item) => {
                    const bStyle = getOpBadgeStyle(item.operation);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.2s' }}>
                        {/* File Name */}
                        <td style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '20px' }}>{getFileTypeIcon(item.original_filename)}</span>
                            <div>
                              <p style={{ margin: 0, fontWeight: '800', color: 'var(--title-color)', fontSize: '13.5px' }}>
                                {item.original_filename}
                              </p>
                              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {item.operation}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Conversion Type Badge */}
                        <td style={{ padding: '14px' }}>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: '800',
                            padding: '4px 12px',
                            borderRadius: '8px',
                            background: bStyle.bg,
                            color: bStyle.color,
                            border: `1px solid ${bStyle.border}`,
                            display: 'inline-block'
                          }}>
                            {bStyle.label}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px' }}>
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: '800',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            background: 'rgba(34, 197, 94, 0.12)',
                            color: '#059669',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ✓ Completed
                          </span>
                        </td>

                        {/* File Size */}
                        <td style={{ padding: '14px', color: 'var(--text-main)', fontWeight: '600' }}>
                          {(item.file_size_bytes / 1024).toFixed(1)} KB
                        </td>

                        {/* Converted At */}
                        <td style={{ padding: '14px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          📅 {formatDate(item.created_at)}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              onClick={() => handleDownloadFile(item.output_filename)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                background: 'rgba(124, 58, 237, 0.1)',
                                border: '1px solid rgba(124, 58, 237, 0.25)',
                                color: '#7C3AED',
                                fontWeight: '750',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                minHeight: '36px'
                              }}
                            >
                              <span>📥</span> Download
                            </button>

                            <button
                              onClick={() => setItemToDelete(item)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                background: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#EF4444',
                                fontWeight: '750',
                                fontSize: '12px',
                                cursor: 'pointer',
                                minHeight: '36px'
                              }}
                              title="Delete conversion log"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE STACKED CARDS VIEW (< 768px) */}
            <div className="fc-mobile-cards-container">
              {paginatedHistory.map((item) => {
                const bStyle = getOpBadgeStyle(item.operation);
                return (
                  <div key={item.id} className="fc-mobile-card">
                    <div className="fc-mobile-card-top">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ fontSize: '20px', flexShrink: 0 }}>{getFileTypeIcon(item.original_filename)}</span>
                        <h4 className="fc-mobile-card-title">{item.original_filename}</h4>
                      </div>
                      <button
                        onClick={() => setItemToDelete(item)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#EF4444', width: '34px', height: '34px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}
                        title="Delete conversion log"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="fc-mobile-card-badges">
                      <span style={{ fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '6px', background: bStyle.bg, color: bStyle.color, border: `1px solid ${bStyle.border}` }}>
                        {bStyle.label}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.12)', color: '#059669', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                        ✓ Completed
                      </span>
                    </div>

                    <div className="fc-mobile-card-sub">
                      <span>📅 {formatDate(item.created_at)}</span>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{(item.file_size_bytes / 1024).toFixed(1)} KB</span>
                    </div>

                    <div className="fc-mobile-card-actions">
                      <button
                        onClick={() => handleDownloadFile(item.output_filename)}
                        style={{ padding: '9px 14px', borderRadius: '8px', background: 'rgba(124, 58, 237, 0.12)', border: '1px solid rgba(124, 58, 237, 0.3)', color: '#7C3AED', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <span>📥</span> Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* PAGINATION FOOTER */}
        {historyList.length > 0 && (
          <div className="fc-pagination-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--card-border)', flexWrap: 'wrap', gap: '12px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            <div>
              Showing {Math.min((currentPage - 1) * rowsPerPage + 1, totalResults)}–{Math.min(currentPage * rowsPerPage, totalResults)} of {totalResults}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'default' : 'pointer', minHeight: '36px' }}
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: pageNum === currentPage ? '1px solid #7C3AED' : '1px solid var(--card-border)',
                    background: pageNum === currentPage ? 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)' : 'var(--card-bg)',
                    color: pageNum === currentPage ? '#FFF' : 'var(--text-main)',
                    fontWeight: pageNum === currentPage ? '800' : '600',
                    cursor: 'pointer',
                    minHeight: '36px'
                  }}
                >
                  {pageNum}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'default' : 'pointer', minHeight: '36px' }}
              >
                ›
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                className="fc-rows-select"
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '12px', minHeight: '36px', width: '90px' }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        )}

      </div>

      {/* CONFIRMATION DELETE MODAL */}
      <AnimatePresence>
        {itemToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setItemToDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '20px',
                padding: '24px',
                maxWidth: '420px',
                width: '100%',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                color: 'var(--text-main)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                  🗑️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '850', color: 'var(--title-color)' }}>
                    Delete this conversion?
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                    This will remove the conversion from your recent activity.
                  </p>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.03)', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '12.5px', border: '1px solid var(--card-border)', overflowWrap: 'anywhere' }}>
                <span style={{ fontWeight: '750', color: 'var(--title-color)' }}>{itemToDelete.original_filename}</span>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '3px' }}>
                  {itemToDelete.operation} • {(itemToDelete.file_size_bytes / 1024).toFixed(1)} KB
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="secondary-btn"
                  style={{ padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '750', minHeight: '44px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => confirmDeleteHistoryItem(itemToDelete.id)}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '850',
                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                    minHeight: '44px'
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
