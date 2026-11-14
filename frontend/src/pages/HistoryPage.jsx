import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, API_BASE } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import CustomSelect from '../components/CustomSelect';
import {
  History,
  RotateCcw,
  Download,
  Trash2,
  Search,
  Filter,
  ArrowUpDown,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
  Layers
} from 'lucide-react';

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export default function HistoryPage({ onBackToDashboard, onRerunJob }) {
  const { authFetch } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({
    total_jobs: 0,
    total_students_scraped: 0,
    avg_pass_rate: 0,
    total_excel_files: 0
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;

  const [selectedJobDetails, setSelectedJobDetails] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: sortBy
      });
      if (search.trim()) queryParams.append('search', search.trim());
      if (statusFilter !== 'ALL') queryParams.append('status', statusFilter);

      const res = await authFetch(`${API_BASE}/scrape/history?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch scraping history.");
      const data = await res.json();

      setHistory(data.history || []);
      setTotalCount(data.total_count || 0);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      toastError(err.message || "Error loading history records.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, sortBy, search, statusFilter, toastError]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDeleteItem = async (id, jobId) => {
    if (!window.confirm(`Are you sure you want to delete history record ${jobId}?`)) return;
    try {
      const res = await authFetch(`${API_BASE}/scrape/history/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete record.");
      success(data.message || `History entry ${jobId} deleted.`);
      fetchHistory();
    } catch (err) {
      toastError(err.message);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear ALL extraction history records?")) return;
    try {
      const res = await authFetch(`${API_BASE}/scrape/history/clear`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to clear history.");
      success(data.message || "All extraction history cleared.");
      setPage(1);
      fetchHistory();
    } catch (err) {
      toastError(err.message);
    }
  };

  const handleDownloadExcel = (path) => {
    if (!path) return;
    info("Downloading Excel spreadsheet...");
    const url = `${API_BASE}/scrape/download?path=${encodeURIComponent(path)}`;
    window.open(url, "_blank");
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-container"
      style={{ padding: '0 0 40px 0', gap: '24px' }}
    >
      {/* HEADER BAR */}
      <div className="table-section-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
            }}>
              <History size={20} />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '850', background: 'linear-gradient(135deg, var(--title-color), #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Scraping History & Audit Logs
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            View past result extraction jobs, re-run previous configurations, and download generated reports.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={onBackToDashboard}
          style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* SUMMARY STAT CARDS */}
      <div className="history-summary-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.12)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={22} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Jobs Executed</span>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--title-color)', marginTop: '2px' }}>{summary.total_jobs}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.12)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={22} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Students Scraped</span>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--title-color)', marginTop: '2px' }}>{summary.total_students_scraped}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.12)', color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Pass Rate</span>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#22C55E', marginTop: '2px' }}>{summary.avg_pass_rate}%</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Excel Reports</span>
            <div style={{ fontSize: '22px', fontWeight: '900', color: 'var(--title-color)', marginTop: '2px' }}>{summary.total_excel_files}</div>
          </div>
        </div>
      </div>

      {/* FILTER & TOOLBAR SECTION */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="history-toolbar-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          {/* Search Box */}
          <div className="history-search-wrap" style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by prefix (e.g. 0105IT), program, or Job ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                borderRadius: '10px',
                border: '1px solid var(--card-border)',
                background: 'var(--input-bg)',
                color: 'var(--title-color)',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Status & Sort Controls */}
          <div className="history-controls-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="history-control-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <CustomSelect
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'completed', label: '✅ Completed' },
                  { value: 'paused', label: '⏸️ Paused' },
                  { value: 'cancelled', label: '⛔ Cancelled' },
                  { value: 'failed', label: '❌ Failed' }
                ]}
                style={{ minWidth: '150px' }}
              />
            </div>

            <div className="history-control-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
              <CustomSelect
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'oldest', label: 'Oldest First' },
                  { value: 'most_students', label: 'Most Students' },
                  { value: 'fastest', label: 'Fastest Duration' }
                ]}
                style={{ minWidth: '160px' }}
              />
            </div>

            {history.length > 0 && (
              <button
                onClick={handleClearAll}
                className="btn btn-secondary history-clear-btn"
                style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}
              >
                Clear History
              </button>
            )}
          </div>
        </div>

        {/* TABLE DISPLAY */}
        {loading ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Job ID & Date</th>
                  <th>Configuration</th>
                  <th>Student Stats</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i}>
                    <td><div className="skeleton skeleton-text" style={{ width: '130px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '150px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '120px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '60px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '80px' }}></div></td>
                    <td><div className="skeleton skeleton-text" style={{ width: '100px' }}></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <Layers size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
            <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--title-color)', marginBottom: '4px' }}>No Scraping History Records Found</h4>
            <p style={{ fontSize: '13px' }}>Start an extraction job from the dashboard control room to log jobs here.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Job ID & Date</th>
                  <th>Configuration</th>
                  <th>Student Stats</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const startStr = `${h.prefix}${String(h.start_roll).padStart(h.pad, '0')}`;
                  const endStr = `${h.prefix}${String(h.end_roll).padStart(h.pad, '0')}`;
                  const dateStr = new Date(h.created_at).toLocaleString();

                  return (
                    <tr key={h.id}>
                      {/* Job ID & Date */}
                      <td>
                        <div style={{ fontWeight: '800', color: 'var(--title-color)', fontSize: '13px', fontFamily: 'monospace' }}>
                          {h.job_id}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {dateStr}
                        </div>
                      </td>

                      {/* Config */}
                      <td>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--title-color)' }}>
                          {h.program} {h.sem ? `· Sem ${h.sem}` : ''}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                          {startStr} → {endStr} ({h.total_students} rolls)
                        </div>
                      </td>

                      {/* Stats */}
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="badge pass" style={{ fontSize: '10.5px' }}>
                            {h.passed_count} Pass
                          </span>
                          {h.failed_count > 0 && (
                            <span className="badge fail" style={{ fontSize: '10.5px' }}>
                              {h.failed_count} Fail
                            </span>
                          )}
                          {h.not_found_count > 0 && (
                            <span className="badge not-found" style={{ fontSize: '10.5px' }}>
                              {h.not_found_count} N/F
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Duration */}
                      <td style={{ fontSize: '12.5px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                          {formatDuration(h.processing_time_seconds)}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {h.status === 'completed' && (
                          <span className="badge pass">✅ Completed</span>
                        )}
                        {h.status === 'paused' && (
                          <span className="badge warning" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            ⏸️ Paused
                          </span>
                        )}
                        {h.status === 'cancelled' && (
                          <span className="badge fail" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
                            ⛔ Cancelled
                          </span>
                        )}
                        {h.status === 'failed' && (
                          <span className="badge fail">❌ Failed</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {/* Rerun Button */}
                          <button
                            onClick={() => onRerunJob(h)}
                            className="btn btn-primary"
                            title="Rerun this extraction job"
                            style={{ padding: '5px 9px', fontSize: '11.5px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <RotateCcw size={13} />
                            Rerun
                          </button>

                          {/* Excel Download Button */}
                          {h.excel_file_path && (
                            <button
                              onClick={() => handleDownloadExcel(h.excel_file_path)}
                              className="btn btn-secondary"
                              title="Download Excel Spreadsheet"
                              style={{ padding: '5px 8px', fontSize: '11.5px', borderRadius: '7px', color: '#10B981', borderColor: 'rgba(16,185,129,0.3)' }}
                            >
                              <Download size={13} />
                            </button>
                          )}

                          {/* Details Modal Trigger */}
                          <button
                            onClick={() => setSelectedJobDetails(h)}
                            className="btn btn-secondary"
                            title="View Full Breakdown Details"
                            style={{ padding: '5px 8px', fontSize: '11.5px', borderRadius: '7px' }}
                          >
                            <Eye size={13} />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteItem(h.id, h.job_id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#EF4444',
                              padding: '5px 8px',
                              borderRadius: '7px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Delete History Record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION BAR */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
              Showing Page {page} of {totalPages} ({totalCount} total entries)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* JOB DETAILS MODAL */}
      <AnimatePresence>
        {selectedJobDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setSelectedJobDetails(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '520px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '12px',
                  background: 'var(--primary-gradient)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF'
                }}>
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--title-color)', margin: 0 }}>
                    Job Details & Audit breakdown
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {selectedJobDetails.job_id} · {new Date(selectedJobDetails.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prefix</span>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--title-color)', fontFamily: 'monospace' }}>{selectedJobDetails.prefix}</div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Program / Sem</span>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--title-color)' }}>{selectedJobDetails.program} {selectedJobDetails.sem ? `Sem ${selectedJobDetails.sem}` : ''}</div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Roll Range</span>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--title-color)', fontFamily: 'monospace' }}>
                    {selectedJobDetails.prefix}{String(selectedJobDetails.start_roll).padStart(selectedJobDetails.pad, '0')} → {selectedJobDetails.prefix}{String(selectedJobDetails.end_roll).padStart(selectedJobDetails.pad, '0')}
                  </div>
                </div>

                <div style={{ background: 'var(--input-bg)', padding: '12px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Processing Duration</span>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--title-color)', fontFamily: 'monospace' }}>{formatDuration(selectedJobDetails.processing_time_seconds)}</div>
                </div>
              </div>

              <div style={{ background: 'var(--input-bg)', padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', marginBottom: '20px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Student Outcome Metrics
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Processed</span>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--title-color)' }}>{selectedJobDetails.processed_students}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--success)' }}>Passed</span>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--success)' }}>{selectedJobDetails.passed_count}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--danger)' }}>Failed</span>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--danger)' }}>{selectedJobDetails.failed_count}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--warning)' }}>Not Found</span>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--warning)' }}>{selectedJobDetails.not_found_count}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedJobDetails(null)}
                  style={{ flex: 1 }}
                >
                  Close
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const job = selectedJobDetails;
                    setSelectedJobDetails(null);
                    onRerunJob(job);
                  }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <RotateCcw size={14} />
                  Rerun Job
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
