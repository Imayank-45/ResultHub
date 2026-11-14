# ResultAI - RGPV Result Analytics & Dashboard Platform
## Technical Specification, Product Design & Current Implementation Status

> **Last Updated:** 2026-08-18  
> **Status:** Production Ready — Scraper Engine + Database Persistence + JWT Auth + AI Report Generator + Mid Sem Studio (DS & CSBS Supported) + Live Progress Dashboard + Result Compare Studio + Scrape History Audit Logs + Mobile-First Phone UI (320px–430px) Fully Integrated

---

## 🔧 TECH STACK (Current Implementation)

### Backend & Automation
| Layer | Technology | Version | Description |
|---|---|---|---|
| Web Framework | **FastAPI** | ≥ 0.110.0 | High-performance asynchronous REST API framework |
| ASGI Server | **Uvicorn** | ≥ 0.28.0 | Lightning-fast ASGI web server |
| Database & ORM | **SQLAlchemy** | ≥ 2.0.0 | SQL toolkit and Object-Relational Mapper (SQLite / PostgreSQL) |
| Database Driver | **psycopg2-binary** | ≥ 2.9.0 | PostgreSQL database connector |
| Authentication | **PyJWT / python-jose** | ≥ 3.3.0 | Secure JSON Web Token (JWT) access & refresh token engine |
| Password Security | **Passlib + Bcrypt** | ≥ 1.7.4 | Password hashing & salt encryption with real-time strength checklist |
| Browser Automation | **Playwright (Sync API)** | ≥ 1.44.0 | Headless/Headed Chromium web automation |
| CAPTCHA Solver | **ddddocr** | ≥ 1.6.0 | Local AI-based OCR engine for CAPTCHA solving |
| Image Processing | **Pillow** | ≥ 10.0.0 | Image manipulation & CAPTCHA preprocessing |
| HTML Parser | **BeautifulSoup4** | ≥ 4.12.0 | RGPV result HTML sheet scraping & DOM extraction |
| HTML Parser Backend | **lxml** | ≥ 5.2.0 | C-optimized XML/HTML parser engine |
| User Agent Parser | **user-agents** | ≥ 2.2.0 | Client IP, browser name, and OS detection for audit logs |
| Excel Processing | **openpyxl** | ≥ 3.1.0 | Formatted `.xlsx` spreadsheet & Mid-Sem marksheet workbook generator |
| Data Handling | **pandas** | ≥ 2.2.0 | High-performance data structures & analytics |
| Numerical Analytics | **NumPy** | ≥ 1.26.0 | Array computation & statistical metrics |
| PDF Document Engine | **ReportLab** | ≥ 4.0 | Enterprise publication-quality PDF report builder |
| Data Visualization | **Matplotlib** | ≥ 3.8.0 | High-DPI (200 DPI) chart & graph rendering |
| Real-time Comm | **WebSockets** | ≥ 12.0 | Bidirectional live progress & stdout log streaming |
| Language | **Python 3.10+** | — | Core backend programming language |

### Frontend & Analytics UI
| Layer | Technology | Version | Description |
|---|---|---|---|
| UI Framework | **React** | ^19.2.7 | Declarative component-based UI library |
| Build Tool | **Vite** | ^8.1.1 | Modern high-speed frontend compiler & dev server |
| Animations | **Framer Motion** | ^12.42.2 | Smooth UI transitions, mobile nav drawer spring animations, particle effects |
| Iconography | **Lucide React** | ^1.16.0 | Modern SVG icon library |
| Client-Side PDF Gen | **jsPDF** | ^4.2.1 | Client-side synthetic marksheet & comparison PDF generator |
| Client-Side Excel | **xlsx** | ^0.18.5 | In-browser Excel file parser & processor |
| Client PDF Parsing | **pdf.js** | CDN (v2.16.105) | In-browser PDF extraction for Result Compare Studio |
| Custom Select Portal | **React Portals** | React 19 API | Non-clipping viewport-bounded dropdown portals with `z-index: 99999` |
| Language | **JavaScript (JSX)** | ES Module | React frontend logic |
| Styling | **Vanilla CSS** | Custom System | Modern Glassmorphism, CSS variables, Light/Dark themes, Mobile-First Phone Rules (320–430px) |
| Fonts | **Google Fonts** | Outfit, Inter, Fira Code | Modern typography design system |
| Linter | **oxlint** | ^1.71.0 | Fast Rust-based JavaScript linter |

### Runtime & DevOps
| Component | Tech | Description |
|---|---|---|
| Containerization | **Docker** | Multi-stage Node 20 + Python 3.10-slim container image |
| System Libraries | `build-essential`, `libgl1`, `libglib2.0-0` | Linux OpenCV & Pillow native dependencies |
| One-Click Launcher | **PowerShell** (`start.ps1`) | Windows automated builder & dual-server launcher |
| Data Storage | SQLite (`/data/result_ai.db`), Excel (`/data`), Reports (`/data/reports`), Marksheets (`/data/marksheets`), Uploads (`/data/uploads`) | Local file & database storage system |
| Real-time Protocol | WebSocket (`/api/ws`) + REST APIs | Asynchronous real-time updates and control endpoints |

---

## 📁 CURRENT PROJECT STRUCTURE (Actual)

```
RESULT_AI/
├── main.py                    # CLI entry point for RGPV web scraper
├── requirements.txt           # Primary Python dependencies (SQLAlchemy, JWT, Playwright, etc.)
├── README.md                  # Comprehensive user & developer setup guide
├── Dockerfile                 # Multi-stage Docker deployment script (Node 20 + Python 3.10)
├── .dockerignore              # Docker build exclusions
├── start.ps1                  # One-click PowerShell launcher script
├── copy_logo.py               # Utility script to sync brand logo artifacts
├── generate_logo_js.py        # Utility script to encode brand logo as Base64 JS module
├── benchmark_ocr.py           # OCR accuracy benchmarking tool
├── move_files.py              # Script consolidation & cleanup tool
├── venv/                      # Python virtual environment
├── data/                      # Persistent data storage directory
│   ├── result_ai.db           # SQLite database file (users, logins, scrape histories, mid-sem records)
│   ├── marksheets/            # Extracted real student PDF marksheets (.pdf)
│   ├── reports/               # Generated AI PDF reports (.pdf)
│   └── uploads/               # User-uploaded Excel files (.xlsx)
├── automation/                # Core scraping & parsing engine
│   ├── __init__.py
│   ├── scraper.py             # Playwright Chromium browser automation & ddddocr CAPTCHA engine
│   ├── parser.py              # BeautifulSoup HTML result sheet parser & grade extractor
│   └── excel_writer.py        # openpyxl Excel exporter with customized styling
├── backend/                   # FastAPI web server & backend application
│   ├── __init__.py
│   ├── server.py              # Unified FastAPI server (REST APIs, WebSockets, static file mounts)
│   ├── auth_router.py         # Authentication API router (/api/auth/login, /me, /profile, etc.)
│   ├── mid_sem_router.py      # Mid Sem Studio API router (/api/mid-sem/config, /subjects, /sessions, etc.)
│   ├── mid_sem_excel_writer.py# openpyxl writer for official college Mid-Sem Marks spreadsheets
│   ├── support_router.py      # AI Support Assistant API router (/api/support/chat, /quick-prompts)
│   └── db/                    # Database & Security Layer
│       ├── __init__.py
│       ├── database.py        # SQLAlchemy engine, session maker, and DATABASE_URL loader
│       ├── models.py          # SQLAlchemy ORM models (User, LoginHistory, ScrapeJobHistory)
│       ├── mid_sem_models.py  # SQLAlchemy ORM models for Mid-Sem (Sessions, Subjects, StudentMarks)
│       ├── schemas.py         # Pydantic data schemas for requests and API responses
│       └── auth.py            # JWT token creation/decoding, bcrypt password hashing & security
├── report_generator/          # Standalone AI PDF Report Generator Module
│   ├── __init__.py            # Module entry & public export API
│   ├── config.py              # Report design system, brand colors, and typography config
│   ├── data_loader.py         # Data parser for single/dual Excel files & in-memory records
│   ├── analytics_engine.py    # Multi-dimensional academic statistical analysis engine
│   ├── chart_renderer.py     # Matplotlib 200-DPI publication chart rendering engine
│   ├── ai_insights.py         # Rule-based natural language insight & recommendation generator
│   ├── pdf_builder.py         # ReportLab canvas builder with dynamic running headers/footers
│   ├── generate_report.py    # Orchestrator & CLI runner for PDF report generation
│   ├── api.py                 # FastAPI router (/api/report) for upload, generate & download
│   └── report_sections/       # Modular ReportLab section renderers (19 sections)
│       ├── cover_page.py
│       ├── table_of_contents.py
│       ├── executive_summary.py
│       ├── overall_statistics.py
│       ├── branch_analysis.py
│       ├── semester_analysis.py
│       ├── subject_analysis.py
│       ├── topper_analysis.py
│       ├── student_pages.py
│       ├── grade_distribution.py
│       ├── pass_percentage.py
│       ├── backlog_analysis.py
│       ├── heatmaps.py
│       ├── risk_analysis.py
│       ├── improvement_analysis.py
│       ├── comparison_analysis.py
│       ├── ai_insights_section.py
│       └── ai_recommendations.py
├── scripts/                   # DB seeding, branch consolidation & verification scripts
│   ├── seed_aiml_subjects.py  # DB seeder for AIML branch subjects
│   ├── verify_aiml_subjects.py# Verification script for AIML branch subjects
│   ├── consolidate_branches.py# Database branch name consolidation utility
│   └── consolidate_aiml.py    # Duplicate AIML branch record cleaner
├── tools/                     # Developer scratch scripts & OCR testing tools
│   ├── inspect_rgpv_script.py # RGPV DOM inspection tool
│   └── test_ocr_fix_verify.py # CAPTCHA OCR verification script
├── outputs/                   # Technical specifications & documentation outputs
│   └── temp.md                # Technical Specification & System Architecture (This file)
└── frontend/                  # React Vite Single Page Application
    ├── index.html             # HTML entry point with viewport-fit=cover & PWA meta tags
    ├── package.json           # Frontend dependencies and npm build scripts
    ├── vite.config.js         # Vite compiler configuration
    ├── .gitignore             # Frontend build exclusions
    ├── .oxlintrc.json         # Oxlint configuration
    ├── dist/                  # Production frontend build output (served by FastAPI)
    ├── public/                # Static public assets (logo.png, logo.jpg, favicon)
    └── src/
        ├── main.jsx           # React root mounting script
        ├── App.jsx            # Main Extractor Dashboard, navigation, header & mobile drawer (3280+ lines)
        ├── App.css            # Component-specific layout styles
        ├── index.css          # Global design system, glassmorphism & mobile rules (4350+ lines)
        ├── ResultCompareStudio.jsx # Academic Comparison & PDF Parsing Studio (1800+ lines)
        ├── CgpaCalculator.jsx # RGPV SGPA/CGPA Target & Grade Projection Calculator
        ├── assets/            # Project image assets & Base64 encoded logo modules
        ├── components/        # Reusable UI Components
        │   ├── MidSemStudio.jsx       # Mid Sem Studio Marks Entry & Official College Generator (2920+ lines)
        │   ├── SubjectMarksManager.jsx# Subject Admin & Maximum Marks Configuration Manager
        │   ├── CustomSelect.jsx       # React Portal dropdown component
        │   ├── AiReportGenerator.jsx  # AI PDF Report Generator & Live Dashboard
        │   ├── SupportAssistant.jsx   # AI Support Assistant Floating Chatbot (Safe-Area Aware)
        │   ├── SessionExpiryModal.jsx # Graceful JWT token expiration modal
        │   └── ToastContainer.jsx     # Animated toast notification manager
        ├── context/           # React Context Providers
        │   ├── AuthContext.jsx        # Authentication state, JWT refresh, login/logout context
        │   └── ToastContext.jsx       # Global notification toast context provider
        ├── pages/             # Application View Pages
        │   ├── AboutPage.jsx          # Architecture & platform documentation view
        │   ├── CustomExportPage.jsx   # Custom Excel Export Studio page
        │   ├── FileConverterPage.jsx  # PDF/Excel/CSV File Converter page
        │   ├── HistoryPage.jsx        # Scraping History & Audit Logs table view
        │   ├── LoginPage.jsx          # Login & Create Account view
        │   ├── ProfilePage.jsx        # User Profile, Password Change & Login Audit log view
        │   └── RgpvHubPage.jsx        # RGPV Student Hub utility page
        └── utils/             # Utility Functions
            └── scraperSettings.js     # Scraper execution settings
```

---

## ✅ WHAT IS CURRENTLY IMPLEMENTED & INTEGRATED

### 1. `backend/db/` & `backend/auth_router.py` — Database & Security Layer
- **`User` & Audit Models (`models.py`):** Stores user credentials, hashed passwords (`bcrypt`), profile metadata, login history audit logs (`LoginHistory`), and scraping history (`ScrapeJobHistory`).
- **Audit Record Deletion APIs (`auth_router.py`):** Supports individual login history entry deletion (`DELETE /api/auth/login-history/{id}`) and full account audit history clear (`DELETE /api/auth/login-history`).
- **Dynamic Password Strength Checklist & Validation:** Backend and frontend validation enforcing 8+ characters, uppercase, lowercase, numbers, and special characters.

### 2. `frontend/src/components/MidSemStudio.jsx` — Official College Mid-Sem Marks Suite
- **9 Supported B.Tech Branches:** `CS`, `IT`, `EC`, `ME`, `CE`, `EX`, `AIML`, **`DS` (Data Science)**, and **`CSBS` (Computer Science & Business Systems)**.
- **Department Name Auto-Sync:** Automatically maps selected branch to official department header (`DEPARTMENT OF DATA SCIENCE`, `DEPARTMENT OF COMPUTER SCIENCE & BUSINESS SYSTEMS`, etc.).
- **Roll Prefix Auto-Derivation:** Generates standard RGPV roll code prefixes (`0105DS2410` for DS, `0105CB2410` for CSBS, `0105AL2410` for AIML, etc.).
- **Official openpyxl Excel Exporter:** Generates formatted college spreadsheets with merged titles, dynamic subject headers, yellow total columns (`#FEF08A`), Excel `=SUM()` formulas, failing grade highlighting (`< 4` MST / `< 8` TOT in soft red `#FEE2E2`), landscape A4 setup, and legend notes.
- **Marks Entry & Absent Management:** Single-student card view with keyboard navigation (Enter/Tab), batch spreadsheet grid view, bulk mark absent (MST-I, MST-II, or Both), reset marks, and 1-click snapshot undo.

### 3. Mobile-First Phone Architecture (320px–430px Viewports)
- **Compact 56px Sticky Header:** Single-row header on mobile with non-wrapping layout, compact logo icon (32px), active screen title, theme toggle (32×32px), and user avatar circle. Full user name and status badges hidden automatically on small phones.
- **Searchable Nav Drawer:** Top "Search tools…" input bar filtering all navigation sections dynamically with 1-click clear (`✕`).
- **Collapsible "Tools & Utilities" Section:** Accordion section with animated chevron (`transform: rotate(180deg)`), smooth Framer Motion spring transition, and inline expansion when searching.
- **52px Touch-Optimized Menu Items:** Compact 52–56px menu items with 22px icons (`.mn-icon`), 16px font size, and active state purple gradient highlight.
- **React Portal Dropdowns (`CustomSelect.jsx`):** Renders options panel directly into `document.body` with `position: fixed` and `z-index: 99999` to prevent clipping caused by parent `overflow: hidden/auto` containers.
- **Safe-Area Inset Support:** CSS `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` integration for bottom gesture bar clearance on Android and iOS devices.

### 4. `frontend/src/ResultCompareStudio.jsx` — Academic Comparison Studio
- **Vertical Upload Stacking on Mobile:** Switches to single-column vertical layout on screens $<767\text{px}$ with the **"VS" Badge** centered between Upload Card 1 and Upload Card 2.
- **File Preview Cards:** Upload placeholder replaced with a file preview card displaying filename, student count, file size, status badge, Replace, and Remove buttons.
- **Comparison Overview Section:** Displays empty-state card before upload, and automatically swaps to full comparison metrics dashboard upon execution.
- **3 Comparison Modes:** Class vs Class, Student vs Student, and Semester over Semester progress tracking.

### 5. `frontend/src/components/AiReportGenerator.jsx` — AI PDF Report Generator & Live Dashboard
- **File Preview & Data Preview Modal:** File preview card with instant Excel row preview modal (`Preview Data`).
- **Live Progress Dashboard:** Updates live stage (*Reading Excel*, *Analyzing Data*, *Generating Charts*, *Writing PDF*), animated progress percentage bar, live log console, and estimated time remaining.
- **PDF Report Output Preview:** Displays estimated pages ($40-50$), SVG charts ($8$), tables ($12$), and recommendations ($15+$).
- **Recent Reports Log:** Last generated PDF reports list with individual deletion (`🗑️`), Clear All button, and 1-click download.

---

## 📱 MOBILE RESPONSIVENESS MATRIX

| Page / Component | Mobile Responsive Adaptations | Status |
|---|---|---|
| **Sticky App Header** | 56px compact row, logo text hidden, avatar circle only, zero wrapping | ✅ Verified |
| **Mobile Nav Drawer** | `position: fixed` at top 66px (`z-index: 9999`), "Search tools…" bar, collapsible Tools section | ✅ Verified |
| **Menu Items** | 52px touch targets, 22px icons, 16px text, purple active gradient | ✅ Verified |
| **Floating AI Button** | Bottom offset `calc(20px + env(safe-area-inset-bottom))` for gesture bar clearance | ✅ Verified |
| **Authentication Pages** | Full screen layout, touch-friendly inputs, password strength meter | ✅ Verified |
| **Mid Sem Studio** | Compact form cards, scrollable batch grid, touch-friendly action buttons | ✅ Verified |
| **Result Compare Studio** | Vertical dropzone card stacking, VS badge centered between cards | ✅ Verified |
| **AI Report Generator** | Single-column flow, $2 \times 2$ output metrics grid, touch-friendly buttons | ✅ Verified |
| **My Profile Page** | Single-column settings flow, responsive audit tables with horizontal scroll | ✅ Verified |

---

## 🔌 API REFERENCE (Implemented)

### Authentication API (`/api/auth`)
| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate user, log IP/browser/OS, return JWT access & refresh tokens |
| `POST` | `/api/auth/logout` | Bearer Token | Terminate session and record logout time in audit history |
| `POST` | `/api/auth/refresh` | Public | Refresh expired access token using valid refresh token |
| `GET` | `/api/auth/me` | Bearer Token | Fetch authenticated user profile & recent 10 login history logs |
| `PUT` | `/api/auth/profile` | Bearer Token | Update user name, phone number, or profile avatar |
| `PUT` | `/api/auth/change-password` | Bearer Token | Change user password with strength validation |
| `DELETE` | `/api/auth/login-history/{id}` | Bearer Token | Delete a specific login audit log entry |
| `DELETE` | `/api/auth/login-history` | Bearer Token | Clear all login audit history records for active user |

### Scraper & History API (`/api/scrape`)
| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `POST` | `/api/scrape/start` | Bearer Token | Launch bulk scraping job with job lock enforcement |
| `POST` | `/api/scrape/cancel` | Bearer Token | Cancel currently executing scrape job |
| `POST` | `/api/scrape/pause` | Bearer Token | Pause active scraper safely after current student finishes |
| `POST` | `/api/scrape/resume` | Bearer Token | Resume paused scraper job from exact saved roll number |
| `POST` | `/api/scrape/reset` | Bearer Token | Reset scrape session state for new extraction run |
| `GET` | `/api/scrape/status` | Public / Token | Get active or last completed job status dict |
| `GET` | `/api/scrape/history` | Bearer Token | Query scrape job history with search, status filter, sort & pagination |
| `DELETE` | `/api/scrape/history/{id}` | Bearer Token | Delete specific scrape job history record |
| `DELETE` | `/api/scrape/history/clear` | Bearer Token | Delete all scrape job history audit records |
| `GET` | `/api/scrape/download?path=...` | Public / Token | Download output `.xlsx` spreadsheet file |
| `GET` | `/api/scrape/download_pdf?enrollment=...` | Public / Token | Download extracted student marksheet PDF file |
| `WS` | `/api/ws` | Public | WebSocket for real-time progress updates & terminal log streaming |

### Mid Sem Studio API (`/api/mid-sem`)
| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `GET` | `/api/mid-sem/config` | Public / Token | Metadata configuration options for dropdowns (branches include CS, IT, EC, ME, CE, EX, AIML, DS, CSBS) |
| `GET` | `/api/mid-sem/subjects` | Public / Token | Get active & MST-enabled subject list for specified branch, semester, and program |
| `POST` | `/api/mid-sem/subjects` | Bearer Token | Add or update subject configuration (code, name, max marks, elective) |
| `POST` | `/api/mid-sem/sessions` | Bearer Token | Create or load mid-sem session record |
| `GET` | `/api/mid-sem/resolve-students` | Bearer Token | Resolve student list from roll ranges with DB/Excel name lookup |
| `POST` | `/api/mid-sem/marks` | Bearer Token | Save marks for an individual student |
| `POST` | `/api/mid-sem/batch-marks` | Bearer Token | Batch save marks for multiple students |
| `POST` | `/api/mid-sem/mark-absent` | Bearer Token | Bulk mark students absent (MST-I, MST-II, or Both) |
| `POST` | `/api/mid-sem/reset-marks` | Bearer Token | Reset student marks and absence status |
| `POST` | `/api/mid-sem/export-excel` | Bearer Token | Generate official formatted college Mid-Sem Marks Excel file |

### Report Generator API (`/api/report`)
| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `POST` | `/api/report/upload` | Bearer Token | Upload binary Excel file & parse sample metadata |
| `POST` | `/api/report/generate` | Bearer Token | Trigger AI PDF report generation pipeline with progress updates |
| `GET` | `/api/report/download?path=...` | Public / Token | Download generated PDF report |
| `GET` | `/api/report/status` | Public / Token | Query PDF generation job status |

### AI Support Assistant API (`/api/support`)
| Method | Endpoint | Protection | Description |
|---|---|---|---|
| `POST` | `/api/support/chat` | Public / Token | Send user query to AI support assistant chatbot |
| `GET` | `/api/support/quick-prompts` | Public / Token | Fetch context-aware quick suggestion prompts |

---

## 🚀 HOW TO RUN

### Option 1: One-Click Launcher (Windows PowerShell)
```powershell
.\start.ps1
```

### Option 2: Docker Containerization
```bash
docker build -t result-ai .
docker run -p 8000:8000 -v $(pwd)/data:/app/data result-ai
```

### Option 3: Manual Local Development
```powershell
# Backend
python -m uvicorn backend.server:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

---

## 🗺️ PLANNED FUTURE ENHANCEMENTS

- [ ] **Multi-Worker Job Queue:** Integrate Celery + Redis for asynchronous distributed queue processing.
- [ ] **Proxy Pool Rotation:** Support IP proxy rotation for high-volume batch scraping jobs.
- [ ] **Custom Fine-Tuned CAPTCHA Model:** Train custom CNN model specifically optimized for RGPV CAPTCHAs.
- [ ] **Automated Alerts:** Send WhatsApp / Email notifications on scrape job completion or backlog detection.
