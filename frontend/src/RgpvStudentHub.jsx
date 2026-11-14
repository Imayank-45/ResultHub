import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  'All',
  '📌 My Saved Links',
  'Results & Portals',
  'Examinations & Forms',
  'Syllabus & Schemes',
  'Notifications',
  'Services & Support'
];

const OFFICIAL_RESOURCES = [
  // 1. Results & Portals
  {
    id: 'degree-result',
    title: 'RGPV Main Result Portal',
    category: 'Results & Portals',
    url: 'https://result.rgpv.ac.in/Result/ProgramSelect.aspx',
    description: 'Official portal to check B.Tech, B.E., B.Pharm, M.Tech, MCA, MBA & B.Arch semester results.',
    icon: '📊',
    tag: 'Degree & PG',
    badgeColor: '#10B981',
    isOfficial: true
  },
  {
    id: 'diploma-result',
    title: 'RGPV Diploma Result Portal',
    category: 'Results & Portals',
    url: 'https://result.rgpv.ac.in/Result/Diplomarslt.aspx',
    description: 'Official result portal for Polytechnic Diploma & D.Pharmacy students.',
    icon: '📜',
    tag: 'Diploma Wing',
    badgeColor: '#3B82F6',
    isOfficial: true
  },
  {
    id: 'student-portal',
    title: 'RGPV Student Login Portal',
    category: 'Results & Portals',
    url: 'https://www.rgpv.ac.in/',
    description: 'Official portal for online registration, enrollment, profile details, and student login.',
    icon: '👤',
    tag: 'Student Portal',
    badgeColor: '#8B5CF6',
    isOfficial: true
  },
  {
    id: 'main-website',
    title: 'RGPV Official University Portal',
    category: 'Results & Portals',
    url: 'https://www.rgpv.ac.in/',
    description: 'Official main website of Rajiv Gandhi Proudyogiki Vishwavidyalaya, Bhopal.',
    icon: '🏛️',
    tag: 'Main Portal',
    badgeColor: '#EC4899',
    isOfficial: true
  },
  {
    id: 'diploma-website',
    title: 'RGPV Diploma Wing Website',
    category: 'Results & Portals',
    url: 'https://rgpvdiploma.in/',
    description: 'Official portal for RGPV Polytechnic & Diploma institution activities and services.',
    icon: '🎓',
    tag: 'Diploma Wing',
    badgeColor: '#06B6D4',
    isOfficial: true
  },

  // 2. Examinations & Forms
  {
    id: 'time-table',
    title: 'Exam Time Table & Schedule',
    category: 'Examinations & Forms',
    url: 'https://www.rgpv.ac.in/AboutRGTU/Examination.aspx',
    description: 'Official datesheets and examination timetables for all ongoing and upcoming semester exams.',
    icon: '📅',
    tag: 'Date Sheet',
    badgeColor: '#F59E0B',
    isOfficial: true
  },
  {
    id: 'exam-form',
    title: 'Online Exam Form Submission',
    category: 'Examinations & Forms',
    url: 'https://www.rgpv.ac.in/Exam/DownloadForms.aspx',
    description: 'Download examination application forms, check form submission status, and guidelines.',
    icon: '✍️',
    tag: 'Exam Form',
    badgeColor: '#10B981',
    isOfficial: true
  },
  {
    id: 'admit-card',
    title: 'Admit Card Download',
    category: 'Examinations & Forms',
    url: 'https://www.rgpv.ac.in/',
    description: 'Download official examination hall tickets / admit cards prior to semester exams.',
    icon: '🎟️',
    tag: 'Hall Ticket',
    badgeColor: '#6366F1',
    isOfficial: true
  },
  {
    id: 'revaluation',
    title: 'Revaluation & Challenge Result',
    category: 'Examinations & Forms',
    url: 'https://result.rgpv.ac.in/Result/ProgramSelect.aspx',
    description: 'Apply online for answer sheet re-totalling, revaluation, or challenge marks inspection.',
    icon: '🔍',
    tag: 'Revaluation',
    badgeColor: '#EF4444',
    isOfficial: true
  },

  // 3. Syllabus & Schemes
  {
    id: 'scheme-syllabus',
    title: 'Scheme & Syllabus (All Courses)',
    category: 'Syllabus & Schemes',
    url: 'https://www.rgpv.ac.in/AboutRGTU/Examination.aspx',
    description: 'Download official course structure, subject codes, teaching schemes, and detailed syllabus.',
    icon: '📚',
    tag: 'Official Syllabus',
    badgeColor: '#8B5CF6',
    isOfficial: true
  },
  {
    id: 'academic-calendar',
    title: 'Academic Calendar',
    category: 'Syllabus & Schemes',
    url: 'https://www.rgpv.ac.in/academics/frm_AcademicCalender.aspx',
    description: 'University academic calendar specifying term dates, mid-semester exams, holidays, and session timelines.',
    icon: '🗓️',
    tag: 'Academic Schedule',
    badgeColor: '#14B8A6',
    isOfficial: true
  },

  // 4. Notifications & Circulars
  {
    id: 'notifications',
    title: 'RGPV Official Notifications & Circulars',
    category: 'Notifications',
    url: 'https://www.rgpv.ac.in/Uni/ImpNoticeArchive.aspx',
    description: 'Real-time official announcements, urgent circulars, guidelines, and university press notes.',
    icon: '📢',
    tag: 'Notifications',
    badgeColor: '#F43F5E',
    isOfficial: true
  },
  {
    id: 'diploma-circulars',
    title: 'Diploma Wing Circulars & Orders',
    category: 'Notifications',
    url: 'https://rgpvdiploma.in/',
    description: 'Official notifications, circulars, and academic guidelines for Polytechnic colleges.',
    icon: '🔔',
    tag: 'Diploma News',
    badgeColor: '#F59E0B',
    isOfficial: true
  },

  // 5. Services & Support
  {
    id: 'degree-services',
    title: 'Degree, Marksheet & Transcripts',
    category: 'Services & Support',
    url: 'https://www.rgpv.ac.in/Exam/DownloadForms.aspx',
    description: 'Apply online for Degree Certificates, Provisional Certificates, Duplicate Marksheets & Migration.',
    icon: '🎖️',
    tag: 'Student Services',
    badgeColor: '#10B981',
    isOfficial: true
  },
  {
    id: 'help-contact',
    title: 'RGPV Helpdesk & Contact Support',
    category: 'Services & Support',
    url: 'https://www.rgpv.ac.in/',
    description: 'Official phone numbers (0755-2678891), support email IDs (egov@rgpv.ac.in), and contact directory.',
    icon: '📞',
    tag: 'Support & Help',
    badgeColor: '#6366F1',
    isOfficial: true
  },
  {
    id: 'nptel-elearning',
    title: 'NPTEL & Digital Library Portal',
    category: 'Services & Support',
    url: 'https://nptel.ac.in/',
    description: 'Access online video lectures, SWAYAM course materials, and digital learning resources.',
    icon: '💻',
    tag: 'E-Learning',
    badgeColor: '#0EA5E9',
    isOfficial: true
  }
];

export function validateAndFormatUrl(urlInput) {
  if (!urlInput || !urlInput.trim()) {
    return { valid: false, message: 'URL is required.' };
  }
  let str = urlInput.trim();
  // Check for forbidden/malicious schemes
  if (/^(javascript|data|vbscript|file):/i.test(str)) {
    return { valid: false, message: 'Invalid or forbidden URL scheme.' };
  }
  if (!/^https?:\/\//i.test(str)) {
    str = 'https://' + str;
  }
  try {
    const parsed = new URL(str);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, message: 'Only http:// or https:// URLs are allowed.' };
    }
    return { valid: true, url: parsed.href };
  } catch (err) {
    return { valid: false, message: 'Please enter a valid website URL.' };
  }
}

export default function RgpvStudentHub({ theme }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Custom Links state with LocalStorage persistence
  const [customLinks, setCustomLinks] = useState(() => {
    try {
      const saved = localStorage.getItem('rgpv_hub_custom_links');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Modal State for Adding/Editing Custom Link
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCategory, setFormCategory] = useState('Services & Support');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState('');

  // Persist custom links whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('rgpv_hub_custom_links', JSON.stringify(customLinks));
    } catch (e) {
      console.error('Failed to persist custom links to localStorage:', e);
    }
  }, [customLinks]);

  const handleOpenAddModal = () => {
    setEditingLinkId(null);
    setFormTitle('');
    setFormUrl('');
    setFormCategory('Services & Support');
    setFormDesc('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (link) => {
    setEditingLinkId(link.id);
    setFormTitle(link.title);
    setFormUrl(link.url);
    setFormCategory(link.category || 'Services & Support');
    setFormDesc(link.description || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveCustomLink = (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Please enter a link title.');
      return;
    }

    const validation = validateAndFormatUrl(formUrl);
    if (!validation.valid) {
      setFormError(validation.message);
      return;
    }

    if (editingLinkId) {
      // Edit existing link
      setCustomLinks(prev => prev.map(item => {
        if (item.id === editingLinkId) {
          return {
            ...item,
            title: formTitle.trim(),
            url: validation.url,
            category: formCategory,
            description: formDesc.trim() || 'User added bookmark link',
            updatedAt: Date.now()
          };
        }
        return item;
      }));
    } else {
      // Add new link
      const newLink = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        title: formTitle.trim(),
        url: validation.url,
        category: formCategory,
        description: formDesc.trim() || 'User added bookmark link',
        icon: '📌',
        tag: 'User Added',
        badgeColor: '#F59E0B',
        isOfficial: false,
        createdAt: Date.now()
      };
      setCustomLinks(prev => [newLink, ...prev]);
    }

    setIsModalOpen(false);
  };

  const handleDeleteCustomLink = (id) => {
    if (window.confirm('Are you sure you want to delete this custom link?')) {
      setCustomLinks(prev => prev.filter(item => item.id !== id));
    }
  };

  // Combine official resources & custom links
  const allResources = useMemo(() => {
    return [...customLinks, ...OFFICIAL_RESOURCES];
  }, [customLinks]);

  const filteredResources = useMemo(() => {
    return allResources.filter(res => {
      let matchesCategory = true;
      if (selectedCategory === '📌 My Saved Links') {
        matchesCategory = !res.isOfficial;
      } else if (selectedCategory !== 'All') {
        matchesCategory = res.category === selectedCategory;
      }

      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        res.title.toLowerCase().includes(term) ||
        res.description.toLowerCase().includes(term) ||
        res.category.toLowerCase().includes(term) ||
        res.tag.toLowerCase().includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [allResources, searchTerm, selectedCategory]);

  return (
    <div className="rgpv-hub-container" style={{ paddingBottom: '60px' }}>
      {/* 1. Hero Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rgpv-hub-hero"
        style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
          border: '1px solid var(--card-border)',
          borderRadius: '20px',
          padding: '32px 24px',
          marginBottom: '28px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(16px)'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(124, 58, 237, 0.2)',
            border: '1px solid rgba(124, 58, 237, 0.4)',
            color: '#A78BFA',
            padding: '6px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '800',
            marginBottom: '14px',
            letterSpacing: '0.04em'
          }}>
            <span>🎓 OFFICIAL RGPV RESOURCE DIRECTORY</span>
          </div>

          <h1 style={{
            fontSize: '32px',
            fontWeight: '900',
            color: 'var(--title-color)',
            margin: '0 0 10px 0',
            lineHeight: '1.2'
          }}>
            RGPV Student Hub
          </h1>
          <p style={{
            fontSize: '14.5px',
            color: 'var(--text-muted)',
            margin: '0 0 24px 0',
            lineHeight: '1.5'
          }}>
            Verified one-stop access portal for RGPV Results, Date Sheets, Exam Forms, Schemes, Syllabus & Saved Links.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <button
              onClick={handleOpenAddModal}
              style={{
                background: 'var(--primary-gradient)',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 6px 18px rgba(124, 58, 237, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>➕ Add Custom Link</span>
            </button>
          </div>

          {/* Live Search Input */}
          <div style={{ position: 'relative', maxWidth: '560px', margin: '0 auto' }}>
            <span style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: 'var(--text-muted)'
            }}>
              🔍
            </span>
            <input 
              type="text"
              placeholder="Search RGPV resources (e.g. Result, Time Table, Syllabus, Admit Card)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rgpv-hub-search-input"
              style={{
                width: '100%',
                background: 'var(--input-bg, rgba(15, 23, 42, 0.7))',
                border: '1px solid var(--card-border)',
                borderRadius: '14px',
                padding: '14px 44px 14px 48px',
                color: 'var(--text-main)',
                fontSize: '14px',
                outline: 'none',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                transition: 'all 0.2s ease'
              }}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* 2. Urgent Announcements / Quick Links Bar */}
      <div style={{
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '14px',
        padding: '14px 18px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⚡</span>
          <div>
            <strong style={{ fontSize: '13.5px', color: '#F59E0B', display: 'block' }}>
              Quick Direct Links (Official Portal)
            </strong>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Direct access to RGPV Result Portal, Time Table, and Online Exam Forms
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a
            href="https://result.rgpv.ac.in/Result/ProgramSelect.aspx"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#10B981',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '750',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Check Results ↗
          </a>
          <a
            href="https://www.rgpv.ac.in/AboutRGTU/Examination.aspx"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--text-main)',
              border: '1px solid var(--card-border)',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '750',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Time Table ↗
          </a>
        </div>
      </div>

      {/* 3. Category Filter Pills */}
      <div className="rgpv-hub-pills" style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginBottom: '24px',
        scrollbarWidth: 'none'
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              background: selectedCategory === cat ? 'var(--primary-gradient)' : 'rgba(255, 255, 255, 0.04)',
              color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-muted)',
              border: selectedCategory === cat ? 'none' : '1px solid var(--card-border)',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              boxShadow: selectedCategory === cat ? '0 4px 12px rgba(124, 58, 237, 0.3)' : 'none'
            }}
          >
            {cat} {cat === '📌 My Saved Links' && customLinks.length > 0 && `(${customLinks.length})`}
          </button>
        ))}
      </div>

      {/* 4. Resource Cards Grid */}
      <AnimatePresence mode="wait">
        {filteredResources.length > 0 ? (
          <motion.div 
            key={selectedCategory + searchTerm}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="rgpv-hub-card-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '18px'
            }}
          >
            {filteredResources.map(res => (
              <div
                key={res.id}
                className="rgpv-hub-card"
                style={{
                  background: res.isOfficial ? 'var(--card-bg)' : 'rgba(245, 158, 11, 0.04)',
                  border: res.isOfficial ? '1px solid var(--card-border)' : '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.25s ease',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Top Badge & Icon */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      border: '1px solid var(--card-border)'
                    }}>
                      {res.icon || '🔗'}
                    </div>

                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      background: res.isOfficial ? `${res.badgeColor || '#10B981'}20` : 'rgba(245, 158, 11, 0.2)',
                      color: res.isOfficial ? (res.badgeColor || '#10B981') : '#F59E0B',
                      border: res.isOfficial ? `1px solid ${res.badgeColor || '#10B981'}40` : '1px solid rgba(245, 158, 11, 0.4)'
                    }}>
                      {res.isOfficial ? (res.tag || 'Official Portal') : 'User Added / Custom Resource'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '800',
                    color: 'var(--title-color)',
                    margin: '0 0 8px 0',
                    lineHeight: '1.3'
                  }}>
                    {res.title}
                  </h3>

                  <p style={{
                    fontSize: '12.5px',
                    color: 'var(--text-muted)',
                    margin: '0 0 18px 0',
                    lineHeight: '1.5'
                  }}>
                    {res.description}
                  </p>
                </div>

                {/* Actions Bar */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontSize: '12.5px',
                      fontWeight: '750',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--primary-gradient)';
                      e.currentTarget.style.color = '#FFFFFF';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = 'var(--text-main)';
                    }}
                  >
                    Open Resource ↗
                  </a>

                  {/* Edit & Delete Controls for Custom Links */}
                  {!res.isOfficial && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(res)}
                        title="Edit Custom Link"
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--card-border)',
                          borderRadius: '10px',
                          padding: '10px',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomLink(res.id)}
                        title="Delete Custom Link"
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '10px',
                          padding: '10px',
                          color: '#EF4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '48px 20px',
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--card-border)',
            color: 'var(--text-muted)'
          }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
            <h3 style={{ fontSize: '16px', color: 'var(--title-color)', margin: '0 0 6px 0' }}>No matching resources found</h3>
            <p style={{ fontSize: '13px', margin: 0 }}>Try adjusting your search keyword or selected category filter.</p>
          </div>
        )}
      </AnimatePresence>

      {/* 5. ADD / EDIT CUSTOM LINK MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="rgpv-hub-modal-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rgpv-hub-modal"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--title-color)', margin: 0 }}>
                  {editingLinkId ? 'Edit Custom Link' : 'Add Custom Link'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '18px'
                  }}
                >
                  ✕
                </button>
              </div>

              {formError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#EF4444',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  marginBottom: '16px'
                }}>
                  ⚠️ {formError}
                </div>
              )}

              <form onSubmit={handleSaveCustomLink}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '750', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Link Name / Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My College Exam Portal"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--input-bg, rgba(15, 23, 42, 0.8))',
                      border: '1px solid var(--card-border)',
                      borderRadius: '10px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '750', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    URL (http:// or https://) *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://college.ac.in/portal"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--input-bg, rgba(15, 23, 42, 0.8))',
                      border: '1px solid var(--card-border)',
                      borderRadius: '10px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '750', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--input-bg, rgba(15, 23, 42, 0.8))',
                      border: '1px solid var(--card-border)',
                      borderRadius: '10px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  >
                    <option value="Results & Portals">Results & Portals</option>
                    <option value="Examinations & Forms">Examinations & Forms</option>
                    <option value="Syllabus & Schemes">Syllabus & Schemes</option>
                    <option value="Notifications">Notifications</option>
                    <option value="Services & Support">Services & Support</option>
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '750', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Description (Optional)
                  </label>
                  <textarea
                    placeholder="Brief details about this link..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--input-bg, rgba(15, 23, 42, 0.8))',
                      border: '1px solid var(--card-border)',
                      borderRadius: '10px',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--card-border)',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: 'var(--primary-gradient)',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '8px 20px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    {editingLinkId ? 'Update Link' : 'Save Custom Link'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
