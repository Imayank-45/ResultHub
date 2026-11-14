# ResultAI — RGPV Result Analytics & Dashboard Platform

ResultAI is an enterprise-grade result scraper, analytics suite, AI report generation platform, Mid-Sem marksheet management suite, and mobile-first web application built for Rajiv Gandhi Proudyogiki Vishwavidyalaya (RGPV) student datasets.

It automatically fetches semester results across roll number ranges, solves CAPTCHAs using a local AI OCR engine, parses subject-wise grades, stores audit logs in a persistent database, manages college Mid-Sem internal exam marks, and exports beautifully formatted Excel workbooks, side-by-side comparison analytics, and McKinsey/Deloitte-style 40–50 page executive PDF reports.

---

## ✨ Key Features & Capability Matrix

### 🚀 1. Automated Web Scraper & Result Extractor
- **Automatic Program & Semester Selection:** Supports 18 RGPV degree programs (`B.Tech.`, `B.E.`, `B.Pharmacy`, `M.Tech.`, `MCA`, `MBA`, `Diploma`, `Ph.D.`, etc.) and semesters 1 to 8.
- **Local AI CAPTCHA Solver:** Powered by `ddddocr` with string normalization, noise filtering, and auto-retry logic. Switches smoothly between automatic OCR and manual user solving if needed.
- **Job Control Suite:** Live **Pause**, **Resume**, **Reset**, and **Cancel** controls for scraping runs. Scraper pauses safely without corrupting progress and resumes from exact roll numbers.
- **ASP.NET Postback Engine:** Client-side JavaScript DOM listeners monitor viewstate postbacks, automatically handling popups like "Incorrect Captcha" or skipping "Result Not Found" records.
- **Real Marksheet Extraction:** Extract real student marksheet PDFs directly from RGPV portal or generate client-side synthetic PDFs via `jsPDF`.

### 📝 2. Mid Sem Studio & Official College Marksheet Suite
- **9 Supported B.Tech Branches:** Full support for `CS`, `IT`, `EC`, `ME`, `CE`, `EX`, `AIML`, **`DS` (Data Science)**, and **`CSBS` (Computer Science & Business Systems)**.
- **Auto-Synced Department Headers:** Automatically resolves department titles (`DEPARTMENT OF DATA SCIENCE`, `DEPARTMENT OF COMPUTER SCIENCE & BUSINESS SYSTEMS`, etc.) for official document headers.
- **Roll Prefix Auto-Derivation:** Automatically infers RGPV enrollment prefixes (`0105DS2410` for DS, `0105CB2410` for CSBS, `0105AL2410` for AIML, `0105CS2410` for CS, etc.).
- **Official openpyxl Excel Exporter:** Generates formatted college spreadsheets with merged titles, dynamic subject headers, yellow total columns (`#FEF08A`), Excel `=SUM()` formulas, failing grade highlighting (`< 4` MST / `< 8` TOT in soft red `#FEE2E2`), landscape A4 print setup, and legend notes.
- **Marks Entry & Absent Management:** Single-student card view with keyboard navigation (Enter/Tab), batch spreadsheet grid view, bulk mark absent (MST-I, MST-II, or Both), reset marks, and 1-click snapshot undo.

### 📱 3. 100% Mobile-First Phone UI Architecture (320px–430px)
- **Compact 56px Sticky Header:** Single-row header on mobile with non-wrapping layout, compact logo icon (32px), active screen title, theme toggle (32×32px), and user avatar circle. Full user name and status badges hidden automatically on small phones.
- **Searchable Nav Drawer:** Top "Search tools…" input bar filtering all navigation sections dynamically with 1-click clear (`✕`).
- **Collapsible "Tools & Utilities" Section:** Accordion section with animated chevron (`transform: rotate(180deg)`), smooth Framer Motion spring transition, and inline expansion when searching.
- **52px Touch-Optimized Menu Items:** Compact 52–56px menu items with 22px icons (`.mn-icon`), 16px font size, and active state purple gradient highlight.
- **React Portal Dropdowns (`CustomSelect.jsx`):** Renders options panel directly into `document.body` with `position: fixed` and `z-index: 99999` to prevent clipping caused by parent `overflow: hidden/auto` containers.
- **Safe-Area Inset Support:** CSS `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` integration for bottom gesture bar clearance on Android and iOS devices.

### 🔐 4. Database Persistence & JWT Authentication
- **Dual Database Support:** Built-in support for **SQLite** (`data/result_ai.db`) out-of-the-box and **PostgreSQL** via `DATABASE_URL` environment configuration.
- **Dynamic Password Strength Meter:** 5-level real-time strength meter (Very Weak to Very Strong) with a dynamic progress bar and real-time password requirements checklist.
- **Subtle Purple-Blue Animated Background:** SaaS background with floating particles, soft gradient animations, and zero performance overhead.
- **JWT Security & Token Refresh:** Dual-token workflow (Access Tokens with "Remember Me" 7-day duration + 14-day Refresh Tokens) powered by `bcrypt` password hashing.
- **Default Admin Auto-Seeding:** Automatically seeds system administrator (`admin@resultai.com` / `Admin@123456`) on initial backend startup.

### 📊 5. Scraping History & Audit Logs
- **Comprehensive Audit Trail:** Logs every scrape run (`ScrapeJobHistory`), tracking Job ID, timestamp, roll ranges, pass/fail counts, duration, and excel file paths.
- **Interactive Audit Log View (`HistoryPage.jsx`):** Filter history by status (Completed, Paused, Cancelled, Failed), search by prefix or program, sort by duration/count, paginate, download Excel spreadsheets, or rerun past configurations in 1-click.
- **Client & IP Audit Tracking (`LoginHistory`):** Records login timestamp, logout timestamp, client IP address, browser family, and OS platform using `user-agents` parsing with individual record deletion and full history clear.

### ⚔️ 6. Result Compare Studio
- **Class vs Class Analytics:** Side-by-side comparison of 2 Excel/CSV/PDF datasets analyzing average SGPA, pass percentage, backlog totals, toppers, and grade distributions.
- **Student vs Student Mode:** Direct grade-by-grade comparison of individual students across all subjects with delta metrics.
- **Semester over Semester Cohort Tracking:** Track cohort progression over multiple semesters, highlighting improved (+0.05 SGPA) or declining students.
- **In-Browser File Parsing & Preview Cards:** Drag-and-drop support for `.xlsx`, `.csv`, and `.pdf` files with instant upload cards showing file size, total students detected, status badge, Replace, and Remove buttons.

### 📄 7. Automatic AI PDF Report Generator & Live Progress
- **Publication Quality PDF Engine:** Standalone ReportLab module generating 40–50 page executive analytics reports rivaling Power BI and Deloitte reports.
- **Live Generator Progress Dashboard:** Dynamic progress dashboard displaying current stage (*Reading Excel*, *Analyzing Data*, *Generating Charts*, *Writing PDF*), animated progress percentage, live step logs, and estimated time remaining.
- **Modular Sections:** Cover page, clickable Table of Contents with dot leaders, Executive Summary, Branch Analysis, Subject Analysis, Topper Rankings, Student Cards, Grade Distributions, Pass Gauges, Backlog Heatmaps, Risk Analysis, and Improvement Matrices.
- **200 DPI Matplotlib Charts:** Bar, donut, box plot, radar, heatmap, gauge, and histogram chart generation.
- **Report History Management:** Recent PDF Reports log with instant download, single item deletion, and Clear All functionality.

### 🤖 8. AI Support Assistant & Interactive Chatbot
- **Integrated Floating AI Assistant:** Accessible from anywhere in the app with subtle spring hover animation (`scale: 1.06`) and soft glow.
- **Context-Aware Quick Prompts:** Instant guidance for RGPV result extraction, CAPTCHA handling, PDF generation, and comparison analysis.

---

## 🛠️ Setup & Installation

### Prerequisites
- **Python:** 3.10 or higher
- **Node.js:** v18 or v20+ (for React Vite frontend)
- **PowerShell** (for Windows 1-click launcher)

---

### Quick Start (Option 1: Windows PowerShell 1-Click Launcher)

Run the included PowerShell script from the repository root:

```powershell
.\start.ps1
```

This script will automatically:
1. Create virtual environment `venv` if missing.
2. Install Python requirements (`pip install -r requirements.txt`).
3. Install Playwright Chromium browser binary.
4. Install frontend npm packages (`npm install` inside `/frontend`).
5. Build production frontend static bundle (`npm run build`).
6. Initialize database tables and seed default admin (`admin@resultai.com` / `Admin@123456`).
7. Start FastAPI server (`http://localhost:8000`) and Vite dev server (`http://localhost:5173`).

---

### Manual Setup (Option 2)

#### 1. Clone & Set Up Backend

```powershell
# Create & activate virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright Chromium browser
playwright install chromium

# Start FastAPI server
python -m uvicorn backend.server:app --reload --port 8000
```

#### 2. Set Up Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

### Docker Deployment (Option 3)

```bash
# Build multi-stage Docker container
docker build -t result-ai .

# Run container with volume mount for persistent database & generated files
docker run -p 8000:8000 -v $(pwd)/data:/app/data result-ai
```

Open `http://localhost:8000` in your browser.

---

## 🔑 Default Admin Credentials

Upon initial database creation, ResultAI automatically seeds a default system administrator account:

- **Email:** `admin@resultai.com`
- **Password:** `Admin@123456`

> [!NOTE]
> You can update your profile details, avatar, or change password with real-time validation from the **My Profile** page inside the application.

---

## ⚙️ Environment Variables

ResultAI supports environment configuration via a `.env` file in the root directory:

```env
# Database URL (SQLite default, PostgreSQL supported)
DATABASE_URL=sqlite:///./data/result_ai.db
# PostgreSQL Example:
# DATABASE_URL=postgresql://user:password@localhost:5432/result_ai_db

# Security Keys (Change in production)
JWT_SECRET_KEY=result_ai_secret_key_super_secure_2026_change_in_prod
JWT_REFRESH_SECRET_KEY=result_ai_refresh_secret_key_2026

# Server Port Configuration
PORT=8000
HOST=127.0.0.1
```

---

## 🚀 Usage Guide & Application Workflow

```mermaid
flowchart TD
    A[User Launch / Start.ps1] --> B{Authenticated?}
    B -- No --> C[LoginPage.jsx / Auth Router]
    B -- Yes --> D[ResultAI App Dashboard]
    
    D --> E[1. Result Extractor]
    D --> F[2. Mid Sem Studio]
    D --> G[3. Result Compare Studio]
    D --> H[4. AI Report Generator]
    D --> I[5. Utility Suite]
    
    E --> E1[Playwright Scraper + ddddocr CAPTCHA] --> E2[SQLite DB + Excel / PDF Export]
    F --> F1[Select Branch CS/IT/DS/CSBS + Sem] --> F2[Single Card / Grid Marks Entry] --> F3[Export Official College Excel/PDF]
    G --> G1[Class vs Class / Student vs Student] --> G2[Comparative Analytics & Delta Charts]
    H --> H1[Upload Excel Dataset] --> H2[ReportLab PDF Engine] --> H3[40-50 Page Publication PDF]
    I --> I1[Scraping History / Custom Export / File Converter / RGPV Hub]
```

### 1. Web Dashboard UI
- **Login / Create Account:** Sign in using `admin@resultai.com` / `Admin@123456` or register a new user account with real-time password strength checklist.
- **Result Extractor:** Select Program (e.g., `B.Tech.`), Semester, Prefix (e.g., `0105IT2410`), and Roll Range (e.g., `1` to `50`). Click **Start Result Extraction**.
- **Mid Sem Studio:** Select Branch (including new `DS` & `CSBS`), Semester, and Year. Generate student list, enter MST-I and MST-II marks using single card or batch grid view, mark absentees, and export official formatted college Excel sheets.
- **Scraper Controls:** Use **Pause**, **Resume**, **Reset**, or **Cancel** as needed during the run.
- **Download Excel & Marksheets:** Export formatted spreadsheets or download individual student PDF marksheets.
- **View History:** Navigate to **Scraping History** tab to view audit logs, filter, or rerun past jobs.
- **Result Compare Studio:** Upload 2 Excel/CSV/PDF files to compare classes, individual students, or semester cohorts with side-by-side mobile responsive cards.
- **AI PDF Report Generator:** Upload an Excel dataset to generate a multi-page executive PDF report with real-time progress indicators.
- **My Profile & Settings:** Manage profile details, change password, toggle headless mode, select UI themes, set default export formats, and view login history audit logs.

---

### 2. Command Line Interface (CLI)

#### Scrape Results via CLI:
```powershell
python main.py --prefix 0105IT2410 --start 1 --end 20 --pad 2 --sem 3 --program B.Tech.
```

##### CLI Options:
| Argument | Description | Default |
|---|---|---|
| `--prefix` | Roll number prefix (e.g. `0105IT2410`) | **Required** |
| `--start` | Starting roll number (e.g. `1`) | **Required** |
| `--end` | Ending roll number (e.g. `20`) | **Required** |
| `--pad` | Zero-padding width for roll number | `2` |
| `--sem` | Semester number (1 to 8) | Optional |
| `--program` | Program name (e.g. `B.Tech.`, `MCA`, `B.Pharmacy`) | `B.Tech.` |
| `--headless` | Run browser in headless mode | Off |

---

#### Generate AI PDF Report via CLI:
```powershell
# Single dataset report
python -m report_generator.generate_report --input data/RGPV_Result_0105IT2410_1-20.xlsx --college "RGPV Bhopal" --department "IT" --semester 3

# Semester-over-semester comparison report
python -m report_generator.generate_report --input data/sem4.xlsx --compare data/sem3.xlsx
```

---

## 🔌 API Reference Overview

### Auth API (`/api/auth`)
- `POST /api/auth/login` — User login & JWT token generation
- `POST /api/auth/logout` — Terminate active session
- `POST /api/auth/refresh` — Refresh expired access token
- `GET /api/auth/me` — Get user profile & login audit history
- `PUT /api/auth/profile` — Update user details / avatar
- `PUT /api/auth/change-password` — Update user password
- `DELETE /api/auth/login-history/{id}` — Delete individual login history record
- `DELETE /api/auth/login-history` — Clear all login history audit records

### Scraper API (`/api/scrape`)
- `POST /api/scrape/start` — Launch scraping job
- `POST /api/scrape/cancel` — Cancel scraping job
- `POST /api/scrape/pause` — Pause scraping job
- `POST /api/scrape/resume` — Resume paused job
- `POST /api/scrape/reset` — Reset scraper session state
- `GET /api/scrape/status` — Get active job status
- `GET /api/scrape/history` — Query scrape job audit history
- `DELETE /api/scrape/history/{id}` — Delete history entry
- `GET /api/scrape/download?path=...` — Download output Excel file
- `GET /api/scrape/download_pdf?enrollment=...` — Download student PDF marksheet
- `WS /api/ws` — Real-time progress & terminal log WebSocket

### Mid Sem Studio API (`/api/mid-sem`)
- `GET /api/mid-sem/config` — Metadata configuration choices (Branches: CS, IT, EC, ME, CE, EX, AIML, DS, CSBS)
- `GET /api/mid-sem/subjects` — Active & MST-enabled subject list per branch/sem
- `POST /api/mid-sem/subjects` — Add/update subject configuration
- `POST /api/mid-sem/sessions` — Create or load mid-sem session
- `GET /api/mid-sem/resolve-students` — Resolve student list from roll ranges
- `POST /api/mid-sem/marks` — Save individual student marks
- `POST /api/mid-sem/batch-marks` — Save batch student marks
- `POST /api/mid-sem/mark-absent` — Bulk mark students absent (MST-I, MST-II, Both)
- `POST /api/mid-sem/reset-marks` — Reset student marks and absence status
- `POST /api/mid-sem/export-excel` — Generate official formatted college Mid-Sem Marks Excel spreadsheet

### Report Generator API (`/api/report`)
- `POST /api/report/upload` — Upload Excel file & parse sample metadata
- `POST /api/report/generate` — Generate AI PDF report with progress updates
- `GET /api/report/download?path=...` — Download PDF report
- `GET /api/report/status` — Query report status

### AI Support Assistant API (`/api/support`)
- `POST /api/support/chat` — Send query to AI support chatbot
- `GET /api/support/quick-prompts` — Fetch context-aware quick suggestion prompts

---

## 📁 Repository Directory Structure

```text
RESULT_AI/
├── main.py                    # CLI entry point for web scraper
├── start.ps1                  # PowerShell 1-click launch script (Frontend + Backend)
├── Dockerfile                 # Multi-stage Docker deployment script
├── requirements.txt           # Python dependencies
├── README.md                  # Comprehensive setup & user documentation
├── backend/                   # FastAPI server, auth router, mid-sem router, support router, database models
├── frontend/                  # React Vite Single Page Application
├── automation/                # Playwright scraper, BeautifulSoup parser, openpyxl writer
├── report_generator/          # AI PDF Report Generator & 19 section renderers
├── data/                      # Persistent storage (SQLite DB, reports, marksheets, uploads)
├── scripts/                   # DB seeding, branch consolidation & maintenance scripts
├── tests/                     # Automated unit, endpoint & marks sheet test suite
├── tools/                     # Developer scratch scripts & inspection tools
└── outputs/                   # Technical specifications & documentation outputs
```

---

## ⚠️ Known Limitations & Notes

1. **Single Active Scraper Lock:** The system enforces a single active scraper job per server node to prevent IP blocking by the RGPV result portal.
2. **ASP.NET Selector Dependencies:** Web extraction relies on RGPV portal DOM structures (`#ctl00_ContentPlaceHolder1_...`).
3. **Headless OCR Mode:** Uses local `ddddocr` engine in headless mode for reliable CAPTCHA solving.

---

## 🗺️ Future Roadmap

- [ ] **Celery + Redis Queue:** Multi-worker distributed task processing.
- [ ] **Proxy Pool Rotation:** High-volume scraping proxy rotation system.
- [ ] **Custom CAPTCHA CNN Model:** Fine-tuned deep learning model for RGPV CAPTCHAs.
- [ ] **Automated Alerts:** Email and WhatsApp completion notifications.
