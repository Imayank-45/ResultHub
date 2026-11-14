// AboutPage.jsx
// Modern, premium, theme-adaptive "About ResultAI" page.
// Features glassmorphism, responsive CSS grid, interactive quick-nav, animated counters,
// developer skill badges, tech stack breakdown, interactive FAQ accordion, and timeline.

import { useEffect, useRef, useState } from "react";
import {
  ScanLine, BarChart3, Users, FileText, TrendingUp, FileSpreadsheet,
  Github, Linkedin, Globe, Mail, Lightbulb, Search, BookOpen, Code2,
  TestTube2, Brain, Rocket, ShieldCheck, ClipboardList, Trophy,
  MonitorCheck, Quote, Sparkles, ChevronDown, CheckCircle2, Cpu,
  Layers, Lock, Database, ArrowUpRight, HelpCircle, Activity, Award
} from "lucide-react";

// Developer profiles configuration
const DEVELOPERS = [
  {
    id: "mayank",
    name: "Mayank Mishra",
    role: "Lead Developer & Creator",
    bio: "Passionate about Artificial Intelligence, Computer Vision, Automation, OCR Systems, and Educational Software. Designed and architected ResultAI from concept to full-stack automation platform.",
    avatarGradient: "linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)",
    skills: ["Python", "FastAPI", "React", "Tesseract OCR", "ReportLab PDF", "OpenCV", "Scraping", "Data Analytics"],
    links: {
      github: "https://github.com",
      linkedin: "https://linkedin.com",
      portfolio: "",
      email: "mayank@example.com"
    }
  },
  {
    id: "divy",
    name: "Divy Kothari",
    role: "Project Contributor & Co-Developer",
    bio: "Contributed to system testing, backend integration, feature implementation, and UX enhancements. Worked closely to refine academic comparison metrics and automated workflows.",
    avatarGradient: "linear-gradient(135deg, #059669 0%, #0CA5A5 100%)",
    skills: ["Python", "FastAPI", "React", "Testing & QA", "Excel Parser", "UI Design", "System Audit"],
    links: {
      github: "https://github.com",
      linkedin: "https://linkedin.com",
      portfolio: "",
      email: ""
    }
  }
];

// Stat Counters Data
const STATS = [
  { value: "100–200", label: "Students / Batch", desc: "Automated extraction speed" },
  { value: "98%+", label: "OCR Accuracy", desc: "Smart CAPTCHA & Image parsing" },
  { value: "8-12s", label: "Avg. Processing Time", desc: "Per student result page" },
  { value: "45+", label: "PDF Report Pages", desc: "Comprehensive AI Analytics" },
  { value: "15+", label: "Analytics Modules", desc: "Compare, Scrape, CGPA & Reports" },
  { value: "100%", label: "Local & Private", desc: "Zero cloud data leakage" },
];

// Core Platform Features
const CORE_PILLARS = [
  { icon: ScanLine, title: "OCR Result Extraction", desc: "Automated extraction of student marks from web portals with OCR fallback." },
  { icon: BarChart3, title: "AI Analytics Dashboard", desc: "Real-time visualization of pass percentages, SGPA trends, and grade distributions." },
  { icon: Users, title: "Compare Studio", desc: "Side-by-side student performance comparison across subjects and semesters." },
  { icon: FileText, title: "AI PDF Report Generator", desc: "Generates multi-page institutional reports complete with charts and AI insights." },
  { icon: FileSpreadsheet, title: "Excel Automation", desc: "Auto-populates formatted Excel spreadsheets ready for academic record submission." },
  { icon: ShieldCheck, title: "Local Security & Audit", desc: "All data stays stored locally on your machine with full operation logging." },
];


// Timeline Journey Data
const JOURNEY = [
  { step: "01", icon: Lightbulb, title: "Idea & Problem Identification", sub: "Struggled with manual, error-prone result entry into Excel sheets during 3rd semester." },
  { step: "02", icon: Search, title: "Research & Feasibility", sub: "Explored OCR engines, web scrapers, and automated PDF report generation tools." },
  { step: "03", icon: BookOpen, title: "Learning OCR & Automation", sub: "Mastered Python automation, OpenCV image preprocessing, and FastAPI backends." },
  { step: "04", icon: Code2, title: "Core Scraper & Parser Engine", sub: "Built automated scrapers with CAPTCHA handling and multi-page result parsing." },
  { step: "05", icon: TestTube2, title: "Testing & Validation", sub: "Tested result extraction across hundreds of real student roll numbers for accuracy." },
  { step: "06", icon: Brain, title: "AI Analytics & Compare Studio", sub: "Added AI report generation, student-versus-student comparison studio, and CGPA calculator." },
  { step: "07", icon: Rocket, title: "ResultAI v1.0 Release", sub: "Launched full platform featuring local storage, dark/light themes, and security audit logs." },
];

// FAQ Accordion Items
const FAQS = [
  {
    q: "What makes ResultAI different from traditional manual entry?",
    a: "ResultAI automates the entire flow: fetching student results, solving CAPTCHAs via OCR, parsing grades and SGPAs, populating Excel sheets, and building institutional PDF reports in seconds rather than hours."
  },
  {
    q: "Is student result data uploaded to external cloud servers?",
    a: "No. ResultAI is built on a Local-First architecture. Scraped results, exported Excel files, and generated PDF reports remain stored directly on your local system."
  },
  {
    q: "How accurate is the CAPTCHA and OCR recognition system?",
    a: "ResultAI uses optimized OpenCV image preprocessing alongside Tesseract OCR, reaching 98%+ accuracy. If a CAPTCHA fails, manual solve fallback modes ensure no scraping task stalls."
  },
  {
    q: "Can ResultAI generate PDF reports for custom college departments?",
    a: "Yes. The AI Report Generator allows specifying custom College Names, Departments, Programs, and Semesters to produce personalized institutional PDF documentation."
  }
];

// Intersection Observer Reveal wrapper for animations
function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`ab-reveal ${visible ? "visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Animated Stat Counter component
function AnimatedStatValue({ value }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (value.includes("–") || value.includes("-")) {
      setDisplay(value);
      return;
    }

    const match = value.match(/^(\d+)(.*)$/);
    if (!match || typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }
    const target = parseInt(match[1], 10);
    const suffix = match[2];
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const duration = 1000;
        const start = performance.now();
        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(target * eased) + suffix);
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return <div className="ab-stat-val" ref={ref}>{display}</div>;
}

// FAQ Accordion Item component
function FAQItem({ faq, index }) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className={`ab-faq-item ${open ? "open" : ""}`} onClick={() => setOpen(!open)}>
      <div className="ab-faq-question">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <HelpCircle size={18} className="ab-faq-icon" />
          <span>{faq.q}</span>
        </div>
        <ChevronDown size={18} className={`ab-faq-chevron ${open ? "rotated" : ""}`} />
      </div>
      {open && (
        <div className="ab-faq-answer">
          {faq.a}
        </div>
      )}
    </div>
  );
}

export default function AboutPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const scrollToSection = (id) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="ab-root-container">
      {/* Dynamic Inline CSS supporting dark/light mode via CSS Variables */}
      <style>{`
        .ab-root-container {
          max-width: 1140px;
          margin: 0 auto;
          padding: 12px 16px 60px 16px;
          color: var(--text-main);
          font-family: inherit;
        }

        .ab-hero-wrapper {
          position: relative;
          text-align: center;
          padding: 48px 20px 24px 20px;
          margin-bottom: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          backdrop-filter: blur(12px);
          overflow: hidden;
        }

        .ab-hero-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.25;
          pointer-events: none;
          z-index: 0;
          animation: abFloat 8s ease-in-out infinite alternate;
        }
        .ab-hero-blob.one {
          width: 260px; height: 260px;
          background: var(--primary, #7C3AED);
          top: -40px; left: 10%;
        }
        .ab-hero-blob.two {
          width: 280px; height: 280px;
          background: #3B82F6;
          bottom: -40px; right: 10%;
          animation-delay: -4s;
        }

        @keyframes abFloat {
          0% { transform: translateY(0) scale(1); }
          100% { transform: translateY(-20px) scale(1.08); }
        }

        .ab-badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 30px;
          background: rgba(124, 58, 237, 0.12);
          border: 1px solid rgba(124, 58, 237, 0.3);
          color: var(--primary, #7C3AED);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          margin-bottom: 16px;
          position: relative;
          z-index: 1;
        }

        .ab-badge-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #22C55E;
          box-shadow: 0 0 10px #22C55E;
          animation: pulseDot 2s infinite;
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .ab-hero-title {
          position: relative;
          z-index: 1;
          font-size: 40px;
          font-weight: 900;
          letter-spacing: -0.02em;
          background: var(--primary-gradient, linear-gradient(135deg, #7C3AED, #3B82F6));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 14px 0;
        }

        .ab-hero-desc {
          position: relative;
          z-index: 1;
          font-size: 15.5px;
          color: var(--text-muted);
          max-width: 680px;
          margin: 0 auto 24px auto;
          line-height: 1.6;
        }

        /* Quick Nav Pills */
        .ab-quick-nav {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
          position: relative;
          z-index: 1;
        }

        .ab-nav-pill {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--card-border);
          color: var(--text-muted);
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .ab-nav-pill:hover, .ab-nav-pill.active {
          background: var(--primary, #7C3AED);
          color: #FFFFFF;
          border-color: transparent;
          box-shadow: 0 4px 14px rgba(124, 58, 237, 0.3);
        }

        /* Reveal animation */
        .ab-reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ab-reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Card System */
        .ab-glass-card {
          background: var(--card-bg, rgba(255, 255, 255, 0.03));
          border: 1px solid var(--card-border);
          border-radius: 20px;
          padding: 28px;
          margin-bottom: 28px;
          box-shadow: var(--shadow-base, 0 8px 32px rgba(0, 0, 0, 0.12));
          backdrop-filter: blur(16px);
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .ab-glass-card:hover {
          border-color: rgba(124, 58, 237, 0.3);
        }

        .ab-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }

        .ab-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(124, 58, 237, 0.12);
          color: var(--primary, #7C3AED);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ab-card-heading {
          font-size: 22px;
          font-weight: 800;
          color: var(--title-color, var(--text-main));
          margin: 0;
          letter-spacing: -0.01em;
        }

        .ab-card-body-text {
          font-size: 14.5px;
          color: var(--text-main);
          line-height: 1.7;
        }

        /* Pillars Grid */
        .ab-pillars-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .ab-pillar-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 20px;
          transition: all 0.25s ease;
        }
        .ab-pillar-card:hover {
          transform: translateY(-4px);
          border-color: var(--primary, #7C3AED);
          box-shadow: 0 10px 24px rgba(124, 58, 237, 0.12);
        }
        .ab-pillar-card:hover .ab-icon-box {
          transform: rotate(-6deg) scale(1.08);
          transition: transform 0.2s ease;
        }

        .ab-pillar-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--title-color, var(--text-main));
          margin: 12px 0 6px 0;
        }

        .ab-pillar-desc {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
          margin: 0;
        }

        /* Story Quote */
        .ab-quote-box {
          position: relative;
          margin: 24px 0;
          padding: 24px 28px 24px 54px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(59, 130, 246, 0.05));
          border-left: 4px solid var(--primary, #7C3AED);
          overflow: hidden;
        }
        .ab-quote-mark-bg {
          position: absolute;
          top: 10px;
          left: 14px;
          opacity: 0.2;
          color: var(--primary, #7C3AED);
        }
        .ab-quote-phrase {
          font-size: 18px;
          font-weight: 700;
          font-style: italic;
          color: var(--title-color, var(--text-main));
          line-height: 1.5;
          margin: 0;
        }

        /* Developers Section */
        .ab-devs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
          margin-top: 16px;
        }

        .ab-dev-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          border-radius: 20px;
          padding: 24px;
          transition: all 0.25s ease;
          display: flex;
          flex-direction: column;
        }
        .ab-dev-card:hover {
          transform: translateY(-4px);
          border-color: var(--primary, #7C3AED);
          box-shadow: 0 12px 28px rgba(124, 58, 237, 0.15);
        }

        .ab-dev-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          color: #FFF;
          font-size: 22px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
        }

        .ab-dev-name {
          font-size: 19px;
          font-weight: 800;
          color: var(--title-color, var(--text-main));
          margin: 0 0 4px 0;
        }

        .ab-dev-role {
          font-size: 12px;
          font-weight: 700;
          color: var(--primary, #7C3AED);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 12px;
        }

        .ab-dev-bio {
          font-size: 13.5px;
          color: var(--text-main);
          line-height: 1.65;
          margin-bottom: 16px;
          flex-grow: 1;
        }

        .ab-skills-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 18px;
        }

        .ab-skill-chip {
          background: rgba(124, 58, 237, 0.08);
          border: 1px solid rgba(124, 58, 237, 0.2);
          color: var(--text-main);
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 12px;
        }

        .ab-social-row {
          display: flex;
          gap: 10px;
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid var(--card-border);
        }

        .ab-social-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--card-border);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          text-decoration: none;
        }
        .ab-social-btn:hover {
          background: var(--primary, #7C3AED);
          color: #FFF;
          border-color: transparent;
          transform: translateY(-2px);
        }

        /* Metrics Stats Grid */
        .ab-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 14px;
          margin-top: 16px;
        }

        .ab-stat-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 20px 14px;
          text-align: center;
          transition: all 0.25s ease;
        }
        .ab-stat-card:hover {
          border-color: var(--primary, #7C3AED);
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(124, 58, 237, 0.12);
        }

        .ab-stat-val {
          font-size: 26px;
          font-weight: 900;
          background: var(--primary-gradient, linear-gradient(135deg, #7C3AED, #3B82F6));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-family: monospace;
          margin-bottom: 4px;
        }

        .ab-stat-label {
          font-size: 12px;
          font-weight: 700;
          color: var(--title-color, var(--text-main));
          margin-bottom: 2px;
        }

        .ab-stat-subtext {
          font-size: 10.5px;
          color: var(--text-muted);
        }

        /* Tech Stack Grid */
        .ab-tech-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .ab-tech-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 20px;
        }

        .ab-tech-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .ab-tech-cat-name {
          font-size: 14.5px;
          font-weight: 800;
          color: var(--title-color, var(--text-main));
        }

        .ab-tech-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .ab-tech-tag {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--card-border);
          color: var(--text-main);
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 8px;
        }

        /* Timeline */
        .ab-timeline {
          position: relative;
          padding-left: 32px;
          margin-top: 20px;
        }
        .ab-timeline::before {
          content: "";
          position: absolute;
          left: 14px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: linear-gradient(180deg, var(--primary, #7C3AED), rgba(124, 58, 237, 0.15));
        }

        .ab-timeline-item {
          position: relative;
          padding-bottom: 24px;
        }
        .ab-timeline-item:last-child {
          padding-bottom: 0;
        }

        .ab-timeline-badge {
          position: absolute;
          left: -32px;
          top: 0;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: var(--card-bg);
          border: 2px solid var(--primary, #7C3AED);
          color: var(--primary, #7C3AED);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          box-shadow: 0 0 10px rgba(124, 58, 237, 0.2);
        }

        .ab-timeline-content {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 14px 18px;
        }

        .ab-timeline-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        .ab-timeline-title {
          font-size: 14.5px;
          font-weight: 700;
          color: var(--title-color, var(--text-main));
        }

        .ab-timeline-sub {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.5;
        }

        /* FAQ Accordion */
        .ab-faq-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }

        .ab-faq-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--card-border);
          border-radius: 14px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .ab-faq-item:hover {
          border-color: rgba(124, 58, 237, 0.3);
        }

        .ab-faq-question {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 14.5px;
          font-weight: 700;
          color: var(--title-color, var(--text-main));
        }

        .ab-faq-icon {
          color: var(--primary, #7C3AED);
          flex-shrink: 0;
        }

        .ab-faq-chevron {
          color: var(--text-muted);
          transition: transform 0.25s ease;
        }
        .ab-faq-chevron.rotated {
          transform: rotate(180deg);
        }

        .ab-faq-answer {
          font-size: 13.5px;
          color: var(--text-muted);
          line-height: 1.65;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--card-border);
        }

        /* Vision Banner */
        .ab-vision-banner {
          background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(59, 130, 246, 0.1));
          border: 1px solid rgba(124, 58, 237, 0.3);
          border-radius: 22px;
          padding: 36px 28px;
          text-align: center;
          position: relative;
          overflow: hidden;
          margin-bottom: 32px;
        }

        .ab-vision-title {
          font-size: 24px;
          font-weight: 900;
          color: var(--title-color, var(--text-main));
          margin-bottom: 12px;
        }

        .ab-vision-body {
          font-size: 14.5px;
          color: var(--text-main);
          line-height: 1.7;
          max-width: 640px;
          margin: 0 auto;
        }

        /* Footer Credits */
        .ab-page-footer {
          text-align: center;
          padding-top: 24px;
          border-top: 1px solid var(--card-border);
          color: var(--text-muted);
          font-size: 13px;
        }
        .ab-page-footer strong {
          color: var(--title-color, var(--text-main));
        }

        @media (max-width: 768px) {
          .ab-hero-title { font-size: 30px; }
          .ab-hero-wrapper { padding: 32px 16px 20px 16px; }
          .ab-glass-card { padding: 20px 16px; }
          .ab-pillars-grid, .ab-devs-grid { grid-template-columns: 1fr; }
          .ab-quote-box { padding: 18px 16px 18px 40px; }
          .ab-quote-phrase { font-size: 16px; }
        }
      `}</style>

      {/* HERO SECTION */}
      <Reveal>
        <div className="ab-hero-wrapper">
          <div className="ab-hero-blob one" />
          <div className="ab-hero-blob two" />

          <div className="ab-badge-pill">
            <span className="ab-badge-dot" />
            <span>ResultAI v1.0 • Academic Result Intelligence Platform</span>
          </div>

          <h1 className="ab-hero-title">About ResultAI</h1>
          <p className="ab-hero-desc">
            Learn about the vision, story, engineering architecture, and the developers driving ResultAI's academic automation platform.
          </p>

          {/* Quick Nav Links */}
          <div className="ab-quick-nav">
            {[
              { id: "overview", label: "Overview" },
              { id: "story", label: "Story" },
              { id: "developers", label: "Developers" },
              { id: "metrics", label: "Metrics" },
              { id: "journey", label: "Journey" },
              { id: "faq", label: "FAQ" },
              { id: "vision", label: "Vision" },
            ].map(({ id, label }) => (
              <button
                key={id}
                className={`ab-nav-pill ${activeSection === id ? "active" : ""}`}
                onClick={() => scrollToSection(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* SECTION 1 — OVERVIEW & PILLARS */}
      <div id="overview">
        <Reveal>
          <div className="ab-glass-card">
            <div className="ab-card-header">
              <div className="ab-icon-box"><Sparkles size={22} /></div>
              <h2 className="ab-card-heading">What is ResultAI?</h2>
            </div>
            <p className="ab-card-body-text">
              ResultAI is an end-to-end <strong>Academic Result Intelligence Platform</strong> designed for educational institutions, teachers, and student researchers. It automates repetitive result scraping, parses SGPA/CGPA marks, offers side-by-side student comparisons, and compiles professional 40+ page AI PDF institutional reports.
            </p>

            <div className="ab-pillars-grid">
              {CORE_PILLARS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="ab-pillar-card">
                  <div className="ab-icon-box"><Icon size={20} /></div>
                  <div className="ab-pillar-title">{title}</div>
                  <div className="ab-pillar-desc">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* SECTION 2 — THE STORY BEHIND RESULTAI */}
      <div id="story">
        <Reveal>
          <div className="ab-glass-card">
            <div className="ab-card-header">
              <div className="ab-icon-box"><BookOpen size={22} /></div>
              <h2 className="ab-card-heading">The Story Behind ResultAI</h2>
            </div>
            <p className="ab-card-body-text">
              During our 3rd semester, we were assigned the task of manually collecting and entering student examination results into an Excel worksheet. Opening individual result links, transcribing subject codes, grade points, and verifying totals line-by-line was overwhelmingly tedious and prone to manual error.
            </p>

            <div className="ab-quote-box">
              <Quote size={40} className="ab-quote-mark-bg" />
              <p className="ab-quote-phrase">
                "What if this entire multi-hour manual result entry process could be automated in under 10 seconds using AI & OCR?"
              </p>
            </div>

            <p className="ab-card-body-text">
              Driven by this challenge, we embarked on learning computer vision, web scraping frameworks, PDF engine design, and full-stack React/FastAPI engineering. What started as a simple script grew into ResultAI — a robust platform trusted for fast, reliable academic data processing.
            </p>
          </div>
        </Reveal>
      </div>

      {/* SECTION 3 — MEET THE DEVELOPERS */}
      <div id="developers">
        <Reveal>
          <div className="ab-glass-card">
            <div className="ab-card-header">
              <div className="ab-icon-box"><Users size={22} /></div>
              <h2 className="ab-card-heading">Meet the Developers</h2>
            </div>
            <p className="ab-card-body-text">
              ResultAI was engineered collaboratively with a focus on high performance, clean UI design, and security.
            </p>

            <div className="ab-devs-grid">
              {DEVELOPERS.map((dev) => {
                const initials = dev.name.split(" ").map(n => n[0]).join("");
                return (
                  <div key={dev.id} className="ab-dev-card">
                    <div className="ab-dev-avatar" style={{ background: dev.avatarGradient }}>
                      {initials}
                    </div>
                    <div className="ab-dev-name">{dev.name}</div>
                    <div className="ab-dev-role">{dev.role}</div>
                    <div className="ab-dev-bio">{dev.bio}</div>

                    <div className="ab-social-row">
                      {dev.links.github && (
                        <a href={dev.links.github} target="_blank" rel="noopener noreferrer" className="ab-social-btn" title="GitHub">
                          <Github size={16} />
                        </a>
                      )}
                      {dev.links.linkedin && (
                        <a href={dev.links.linkedin} target="_blank" rel="noopener noreferrer" className="ab-social-btn" title="LinkedIn">
                          <Linkedin size={16} />
                        </a>
                      )}
                      {dev.links.email && (
                        <a href={`mailto:${dev.links.email}`} className="ab-social-btn" title="Email">
                          <Mail size={16} />
                        </a>
                      )}
                      {dev.links.portfolio && (
                        <a href={dev.links.portfolio} target="_blank" rel="noopener noreferrer" className="ab-social-btn" title="Portfolio">
                          <Globe size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>

      {/* SECTION 4 — PROJECT METRICS & STATS */}
      <div id="metrics">
        <Reveal>
          <div className="ab-glass-card">
            <div className="ab-card-header">
              <div className="ab-icon-box"><TrendingUp size={22} /></div>
              <h2 className="ab-card-heading">Project Metrics & Performance</h2>
            </div>
            <p className="ab-card-body-text">
              Real-world benchmark statistics demonstrating ResultAI's speed and reliability.
            </p>

            <div className="ab-stats-grid">
              {STATS.map((s) => (
                <div key={s.label} className="ab-stat-card">
                  <AnimatedStatValue value={s.value} />
                  <div className="ab-stat-label">{s.label}</div>
                  <div className="ab-stat-subtext">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>


      {/* SECTION 6 — PROJECT JOURNEY TIMELINE */}
      <div id="journey">
        <Reveal>
          <div className="ab-glass-card">
            <div className="ab-card-header">
              <div className="ab-icon-box"><Rocket size={22} /></div>
              <h2 className="ab-card-heading">Development Journey</h2>
            </div>
            <p className="ab-card-body-text">
              Key milestones from initial concept to a full-featured academic intelligence platform.
            </p>

            <div className="ab-timeline">
              {JOURNEY.map(({ step, icon: Icon, title, sub }) => (
                <div key={title} className="ab-timeline-item">
                  <div className="ab-timeline-badge">{step}</div>
                  <div className="ab-timeline-content">
                    <div className="ab-timeline-title-row">
                      <span className="ab-timeline-title">{title}</span>
                      <Icon size={15} style={{ color: "var(--primary, #7C3AED)" }} />
                    </div>
                    <div className="ab-timeline-sub">{sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* SECTION 7 — FAQ ACCORDION */}
      <div id="faq">
        <Reveal>
          <div className="ab-glass-card">
            <div className="ab-card-header">
              <div className="ab-icon-box"><HelpCircle size={22} /></div>
              <h2 className="ab-card-heading">Frequently Asked Questions</h2>
            </div>

            <div className="ab-faq-list">
              {FAQS.map((faq, i) => (
                <FAQItem key={i} faq={faq} index={i} />
              ))}
            </div>
          </div>
        </Reveal>
      </div>

      {/* SECTION 8 — VISION & FOOTER */}
      <div id="vision">
        <Reveal>
          <div className="ab-vision-banner">
            <h2 className="ab-vision-title">Our Vision</h2>
            <p className="ab-vision-body">
              To empower educational institutions, educators, and administrators with intelligent, reliable, and privacy-focused AI automation tools that eliminate manual entry, elevate academic insights, and unlock potential.
            </p>
          </div>
        </Reveal>

        <footer className="ab-page-footer">
          <p>
            ResultAI v1.0 • Designed &amp; Developed by <strong>Mayank Mishra</strong> &amp; <strong>Divy Kothari</strong>
          </p>
          <p style={{ fontSize: '11.5px', marginTop: '4px', opacity: 0.7 }}>
            © {new Date().getFullYear()} ResultAI. All rights reserved. Local &amp; Private Academic Processing.
          </p>
        </footer>
      </div>
    </div>
  );
}
