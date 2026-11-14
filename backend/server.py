# server.py
import asyncio
import contextvars
import io
import os
import queue
import sys
import threading
import uuid
from typing import List, Optional, Any, Dict
import re
import json

# Add parent directory to sys.path to resolve root and backend module imports correctly
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import backend.utils.env_loader
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Import existing modules
from automation.scraper import RGPVScraper
from automation.parser import parse_result_html, ResultNotFound
from automation.excel_writer import write_excel
from automation.validator import validate_scraped_records
from report_generator.api import report_router
from backend.support_router import support_router
from backend.converters.converter_router import router as converter_router
from backend.mid_sem_router import router as mid_sem_router
from backend.subject_marks_router import router as subject_marks_router


# Import Database & Auth modules
from sqlalchemy import text
from backend.db.database import Base, engine, SessionLocal
from backend.db.models import User, ScrapeJob, ScrapeJobHistory
from backend.db.auth import get_password_hash, get_current_user, decode_token, SECRET_KEY
from backend.auth_router import auth_router

Base.metadata.create_all(bind=engine)
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 1"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE mid_sem_student_marks ADD COLUMN absence_type VARCHAR(30)"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE mid_sem_subjects ADD COLUMN mst_enabled BOOLEAN DEFAULT 1"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE mid_sem_subjects ADD COLUMN is_elective BOOLEAN DEFAULT 0"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("ALTER TABLE mid_sem_subjects ADD COLUMN updated_at DATETIME"))
        conn.commit()
    except Exception:
        pass
    try:
        conn.execute(text("DELETE FROM mid_sem_subjects WHERE branch = 'CSBS' AND subject_code NOT LIKE 'CB%'"))
        conn.commit()
    except Exception:
        pass

# Initialize FastAPI
app = FastAPI(title="ResultAI API", version="1.0.0")

# Mount Routers
app.include_router(auth_router)
app.include_router(report_router, prefix="/api/report")
app.include_router(support_router, prefix="/api/support")
app.include_router(converter_router, prefix="/api/tools")
app.include_router(mid_sem_router, prefix="/api/mid-sem")
app.include_router(subject_marks_router, prefix="/api/subject-marks")


# Enable CORS for frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
update_queue = queue.Queue()
runner_lock = threading.Lock()
scrape_runners: Dict[str, 'ScrapeJobRunner'] = {}
background_tasks = set()
_current_job_runner = contextvars.ContextVar("current_job_runner", default=None)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[WebSocket, tuple[int, Optional[str]]] = {}

    async def connect(self, websocket: WebSocket, user_id: int, job_id: Optional[str]):
        await websocket.accept(subprotocol="resultai")
        self.active_connections[websocket] = (user_id, job_id)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.pop(websocket, None)

    async def send_to_owner(self, user_id: int, job_id: str, message: dict):
        for connection, (connection_user_id, subscribed_job_id) in list(self.active_connections.items()):
            if connection_user_id != user_id or (subscribed_job_id and subscribed_job_id != job_id):
                continue
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

# WebLogger captures standard output and streams it to the web UI
class WebLogger(io.TextIOBase):
    def __init__(self, original_stdout, log_callback):
        self.original_stdout = original_stdout
        self.log_callback = log_callback
        self._line_buffer = ""

    def write(self, s):
        self.original_stdout.write(s)
        self.original_stdout.flush()
        self._line_buffer += s
        if "\n" in self._line_buffer:
            lines = self._line_buffer.split("\n")
            for line in lines[:-1]:
                clean_line = line.strip()
                if clean_line:
                    self.log_callback(clean_line)
            self._line_buffer = lines[-1]
        return len(s)

    def flush(self):
        self.original_stdout.flush()

def log_callback(line: str):
    runner = _current_job_runner.get()
    if runner:
        runner.logs.append(line)
        # Only keep last 500 logs to conserve memory
        if len(runner.logs) > 500:
            runner.logs.pop(0)
        if runner.user_id is not None:
            update_queue.put({
                "type": "log",
                "user_id": runner.user_id,
                "job_id": runner.job_id,
                "message": line
            })

# Redirect sys.stdout to our custom logger
original_stdout = sys.stdout
sys.stdout = WebLogger(original_stdout, log_callback)

class ScrapeJobRunner:
    def __init__(self, prefix: str, start: int, end: int, pad: int, sem: Optional[str], program: str,
                 headless: bool = True, user_id: Optional[int] = None, job_id: Optional[str] = None,
                 continue_mode: bool = False, import_file_path: Optional[str] = None,
                 preloaded_records: Optional[List[Any]] = None,
                 selected_fields: Optional[List[str]] = None):
        import time
        self.prefix = prefix
        self.start = start
        self.end = end
        self.pad = pad
        self.sem = sem
        self.program = program
        self.headless = headless
        self.user_id = user_id
        self.job_id = job_id or f"JOB-{uuid.uuid4().hex}"
        self.continue_mode = continue_mode
        self.import_file_path = import_file_path
        self.selected_fields = selected_fields

        self.start_time = time.time()
        self.status = "running"
        self.total = end - start + 1
        self.processed = 0
        self.current_roll = start
        # Pre-load existing records when continuing from an imported Excel
        self.records = list(preloaded_records) if preloaded_records else []
        self.logs = []
        self.pass_count = 0
        self.fail_count = 0
        self.not_found_count = 0
        self.error_count = 0
        self.current_enrollment = f"{self.prefix}{str(self.start).zfill(self.pad)}"
        self.excel_file_path = import_file_path if (import_file_path and os.path.exists(import_file_path)) else None  # set upon excel creation or valid import
        self.captcha_mode = "ocr"
        self.validation_report = None
        self.end_time = None
        self.processing_time_seconds = None

        self._cancel_requested = False
        self._pause_requested = False
        self._scraper = None
        self._thread = None

    def start_job(self):
        self.status = "running"
        self._thread = threading.Thread(target=self._run)
        self._thread.start()

    def pause(self):
        self._pause_requested = True
        print("[System] Pause requested. Will pause safely after current student processing finishes...")
        self.notify_progress()

    def resume(self):
        if self.status != "paused":
            return
        self._pause_requested = False
        self.status = "resumed"
        print(f"[System] Resuming bulk fetch from roll number {self.current_roll}...")
        self.notify_progress()
        self._thread = threading.Thread(target=self._run)
        self._thread.start()

    def cancel(self):
        self._cancel_requested = True
        print("[System] Cancellation requested. Stopping scraper safely...")
        self.status = "cancelled"
        self.notify_progress()

    def notify_progress(self):
        status = self.get_status_dict()
        self._persist_status(status)
        if self.user_id is not None:
            update_queue.put({
                "type": "status",
                "user_id": self.user_id,
                "job_id": self.job_id,
                "data": status
            })

    def _persist_status(self, status: Optional[dict] = None):
        if self.user_id is None:
            return
        db = SessionLocal()
        try:
            job = db.query(ScrapeJob).filter(
                ScrapeJob.job_id == self.job_id,
                ScrapeJob.user_id == self.user_id
            ).first()
            if job:
                job.status = self.status
                job.status_json = json.dumps(status or self.get_status_dict(), ensure_ascii=False)
                job.excel_file_path = self.excel_file_path
                db.commit()
        except Exception as exc:
            db.rollback()
            print("[System] Job status persistence warning.")
        finally:
            db.close()

    def get_status_dict(self):
        return {
            "status": self.status,
            "prefix": self.prefix,
            "start": self.start,
            "end": self.end,
            "pad": self.pad,
            "sem": self.sem,
            "program": self.program,
            "job_id": self.job_id,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "processing_time_seconds": self.processing_time_seconds,
            "total": self.total,
            "processed": self.processed,
            "pass_count": self.pass_count,
            "fail_count": self.fail_count,
            "not_found_count": self.not_found_count,
            "error_count": self.error_count,
            "current_enrollment": self.current_enrollment,
            "excel_file_path": self.excel_file_path,
            "captcha_mode": self.captcha_mode,
            "records": self.records,
            "logs": self.logs,
            "validation_report": self.validation_report,
            "selected_fields": self.selected_fields
        }

    def _on_captcha_mode_change(self, mode: str):
        self.captcha_mode = mode
        self.notify_progress()

    def _run(self):
        context_token = _current_job_runner.set(self)
        print(f"\n[System] Running bulk fetch: Prefix={self.prefix}, Range={self.start}-{self.end} (Start Roll={self.current_roll}), Sem={self.sem or 'All'}, Program={self.program}")
        self.notify_progress()
        
        try:
            self._scraper = RGPVScraper(
                headless=self.headless,
                on_captcha_mode_change=self._on_captcha_mode_change,
            )
            with self._scraper as scraper:
                while self.current_roll <= self.end:
                    if self._cancel_requested:
                        self.status = "cancelled"
                        break

                    if self._pause_requested:
                        self.status = "paused"
                        print(f"[System] Scraper paused safely at roll number {self.current_roll}.")
                        break

                    roll = self.current_roll
                    enrollment = f"{self.prefix}{str(roll).zfill(self.pad)}"
                    self.current_enrollment = enrollment
                    self.notify_progress()

                    print(f"\n[Scraper] Fetching {enrollment} ({self.processed + 1}/{self.total})...")
                    fetch_result = scraper.fetch_result_html(enrollment, sem=self.sem, program=self.program)

                    if self._cancel_requested:
                        self.status = "cancelled"
                        break

                    if self._pause_requested:
                        self.status = "paused"
                        print(f"[System] Scraper paused safely at roll number {self.current_roll}.")
                        break

                    if fetch_result.error:
                        if "browser closed" in fetch_result.error.lower() or "closed by user" in fetch_result.error.lower():
                            self.status = "cancelled"
                            print("[System] Browser was closed by user. Terminating job...")
                            break
                        
                        print(f"[{enrollment}] Fetch failed: {fetch_result.error}")
                        self.records.append({"enrollment": enrollment, "not_found": True})
                        self.error_count += 1
                        self.processed += 1
                        self.current_roll += 1
                        self.notify_progress()
                        continue

                    try:
                        record = parse_result_html(fetch_result.html, enrollment)
                        self.records.append(record)
                        if record["result"] == "PASS":
                            self.pass_count += 1
                        elif record["result"] == "FAIL":
                            self.fail_count += 1
                        print(f"[{enrollment}] Success: Result={record['result']} | SGPA={record['sgpa']} | CGPA={record['cgpa']}")
                    except ResultNotFound:
                        print(f"[{enrollment}] No result record found.")
                        self.records.append({"enrollment": enrollment, "not_found": True})
                        self.not_found_count += 1
                    except Exception as e:
                        print(f"[{enrollment}] Error parsing HTML: {e}")
                        self.records.append({"enrollment": enrollment, "not_found": True})
                        self.error_count += 1

                    self.processed += 1
                    self.current_roll += 1
                    self.notify_progress()

            if not self._cancel_requested and not self._pause_requested and self.status in ["running", "resumed"]:
                if self.current_roll > self.end:
                    print("\n[System] Running Data Validation step...")
                    self.validation_report = validate_scraped_records(self.records)
                    if self.validation_report["has_suspicious_data"]:
                        print(f"[System] ⚠️ Data Validation Warning: Found {self.validation_report['suspicious_count']} suspicious record(s) across {len(self.validation_report['issues'])} issues.")
                    else:
                        print("[System] ✅ Data Validation Success: No suspicious data detected.")

                    print("[System] Compiling results to Excel spreadsheet...")
                    if self.user_id is not None:
                        output_dir = user_job_directory(self.user_id, self.job_id)
                    else:
                        output_dir = "data"
                    os.makedirs(output_dir, exist_ok=True)
                    if self.continue_mode and self.import_file_path:
                        # Overwrite the imported file with all records (original + new)
                        out_path = self.import_file_path
                        print(f"[System] Continue mode: appending new records to imported file: {out_path}")
                    else:
                        out_path = os.path.join(output_dir, f"RGPV_Result_{self.prefix}_{self.start}-{self.end}.xlsx")
                    write_excel(self.records, out_path, selected_fields=self.selected_fields)
                    self.excel_file_path = out_path
                    self.status = "completed"
                    print(f"[System] Job finished successfully! Excel file saved to: {out_path}")

        except Exception as e:
            self.status = "failed"
            print("[System] Scrape job failed due to an internal error.")
        finally:
            import time
            self.end_time = time.time()
            self.processing_time_seconds = int(self.end_time - self.start_time)
            self.current_enrollment = ""
            self.notify_progress()
            self._persist_status()
            
            # Save or update job history record in SQLite database
            try:
                db = SessionLocal()
                duration = int(time.time() - self.start_time)
                history = db.query(ScrapeJobHistory).filter(
                    ScrapeJobHistory.job_id == self.job_id,
                    ScrapeJobHistory.user_id == self.user_id
                ).first()
                if not history:
                    history = ScrapeJobHistory(
                        job_id=self.job_id,
                        user_id=self.user_id,
                        prefix=self.prefix,
                        start_roll=self.start,
                        end_roll=self.end,
                        pad=self.pad,
                        sem=self.sem,
                        program=self.program,
                        total_students=self.total,
                        processed_students=self.processed,
                        passed_count=self.pass_count,
                        failed_count=self.fail_count,
                        not_found_count=self.not_found_count,
                        error_count=self.error_count,
                        processing_time_seconds=duration,
                        status=self.status,
                        excel_file_path=self.excel_file_path
                    )
                    db.add(history)
                else:
                    history.processed_students = self.processed
                    history.passed_count = self.pass_count
                    history.failed_count = self.fail_count
                    history.not_found_count = self.not_found_count
                    history.error_count = self.error_count
                    history.processing_time_seconds = duration
                    history.status = self.status
                    history.excel_file_path = self.excel_file_path
                db.commit()
                db.close()
                print(f"[System] Scrape job history saved to database (Job ID: {self.job_id}).")
            except Exception as db_err:
                print("[System] Scrape history persistence warning.")

            if self.status in ["completed", "cancelled", "failed"]:
                with runner_lock:
                    scrape_runners.pop(self.job_id, None)
            _current_job_runner.reset(context_token)


def user_job_directory(user_id: int, job_id: Optional[str] = None) -> str:
    user_dir = os.path.join(ROOT_DIR, "data", "users", str(user_id))
    if job_id:
        return os.path.join(user_dir, "jobs", job_id)
    return user_dir


def idle_job_status() -> dict:
    return {
        "status": "idle",
        "job_id": None,
        "total": 0,
        "processed": 0,
        "pass_count": 0,
        "fail_count": 0,
        "not_found_count": 0,
        "error_count": 0,
        "current_enrollment": "",
        "excel_file_path": None,
        "validation_report": None,
        "records": [],
        "logs": []
    }


def get_owned_job_row(user_id: int, job_id: str, db=None) -> Optional[ScrapeJob]:
    owns_session = db is None
    db = db or SessionLocal()
    try:
        return db.query(ScrapeJob).filter(
            ScrapeJob.job_id == job_id,
            ScrapeJob.user_id == user_id
        ).first()
    finally:
        if owns_session:
            db.close()


def get_user_job_status(user_id: int, job_id: Optional[str] = None) -> dict:
    db = SessionLocal()
    try:
        query = db.query(ScrapeJob).filter(ScrapeJob.user_id == user_id)
        if job_id:
            query = query.filter(ScrapeJob.job_id == job_id)
            job = query.first()
        else:
            job = query.order_by(ScrapeJob.created_at.desc()).first()
        if not job:
            if job_id:
                raise HTTPException(status_code=404, detail="Scrape job not found.")
            return idle_job_status()

        with runner_lock:
            runner = scrape_runners.get(job.job_id)
        if runner and runner.user_id == user_id:
            return runner.get_status_dict()
        try:
            return json.loads(job.status_json)
        except (TypeError, json.JSONDecodeError):
            return idle_job_status()
    finally:
        db.close()


def start_user_scrape_job(user_id: int, **runner_args) -> tuple[ScrapeJobRunner, dict]:
    runner = ScrapeJobRunner(user_id=user_id, job_id=f"JOB-{uuid.uuid4().hex}", **runner_args)
    status = runner.get_status_dict()
    db = SessionLocal()
    try:
        db.add(ScrapeJob(
            job_id=runner.job_id,
            user_id=user_id,
            status=runner.status,
            status_json=json.dumps(status, ensure_ascii=False),
            excel_file_path=runner.excel_file_path
        ))
        db.commit()
    finally:
        db.close()

    with runner_lock:
        scrape_runners[runner.job_id] = runner
        runner.start_job()
    return runner, runner.get_status_dict()


# API Schemas
class StartJobRequest(BaseModel):
    prefix: str
    start: int
    end: int
    pad: int = 2
    sem: Optional[str] = None
    program: str = "B.Tech."
    headless: bool = True
    selected_fields: Optional[List[str]] = None


class ContinueJobRequest(BaseModel):
    prefix: str
    start: int       # next roll after last detected
    end: int
    pad: int = 2
    sem: Optional[str] = None
    program: str = "B.Tech."
    headless: bool = True
    import_file_path: str
    preloaded_records: List[Any] = []
    selected_fields: Optional[List[str]] = None


class CustomExportRequest(BaseModel):
    records: List[Dict[str, Any]]
    selected_fields: Optional[List[str]] = None


class FeedbackSubmitRequest(BaseModel):
    name: Optional[str] = "Anonymous"
    email: Optional[str] = "N/A"
    rating: str
    feedback_type: str
    message: str
    timestamp: Optional[str] = None


@app.post("/api/feedback")
def submit_user_feedback(req: FeedbackSubmitRequest):
    import requests
    import time

    os.makedirs("data", exist_ok=True)
    feedback_file = "data/feedback_submissions.json"
    existing = []
    if os.path.exists(feedback_file):
        try:
            with open(feedback_file, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = []

    payload = {
        "timestamp": req.timestamp or time.strftime("%Y-%m-%d %H:%M:%S"),
        "name": req.name or "Anonymous",
        "email": req.email or "N/A",
        "rating": req.rating,
        "feedback_type": req.feedback_type,
        "message": req.message
    }

    existing.append(payload)
    try:
        with open(feedback_file, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

    # Forward server-side to Google Apps Script Web App
    google_script_url = os.environ.get(
        "VITE_FEEDBACK_API_URL",
        "https://script.google.com/macros/s/AKfycbyKNzAWQ8QZWX695Ssv_5d-rYE6Xy2TCWnrOzldlz-DcEOofkeRe9loF4OjoZSUaG8/exec"
    )

    sheet_forwarded = False
    sheet_msg = ""
    if google_script_url and "YOUR_DEPLOYMENT_ID" not in google_script_url:
        try:
            resp = requests.post(
                google_script_url,
                data=json.dumps(payload),
                headers={"Content-Type": "text/plain;charset=utf-8"},
                timeout=10
            )
            if resp.status_code == 200:
                sheet_forwarded = True
                sheet_msg = "Successfully forwarded to Google Sheet."
            else:
                sheet_msg = f"Apps Script returned HTTP {resp.status_code}"
        except Exception as err:
            sheet_msg = f"Server forward note: {err}"

    return {
        "status": "success",
        "message": "Feedback submitted successfully.",
        "local_saved": True,
        "sheet_forwarded": sheet_forwarded,
        "detail": sheet_msg
    }


class LikeRequest(BaseModel):
    action: Optional[str] = "like"


@app.get("/api/likes")
def get_likes_count():
    os.makedirs("data", exist_ok=True)
    likes_file = "data/likes_data.json"
    total_likes = 128
    if os.path.exists(likes_file):
        try:
            with open(likes_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                total_likes = data.get("total_likes", 128)
        except Exception:
            pass
    return {"status": "success", "total_likes": total_likes}


@app.post("/api/likes")
def record_like(req: LikeRequest = LikeRequest()):
    import requests
    os.makedirs("data", exist_ok=True)
    likes_file = "data/likes_data.json"
    total_likes = 128
    if os.path.exists(likes_file):
        try:
            with open(likes_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                total_likes = data.get("total_likes", 128)
        except Exception:
            pass

    total_likes += 1
    try:
        with open(likes_file, "w", encoding="utf-8") as f:
            json.dump({"total_likes": total_likes}, f, indent=2)
    except Exception:
        pass

    # Forward to Google Apps Script
    google_script_url = os.environ.get(
        "VITE_FEEDBACK_API_URL",
        "https://script.google.com/macros/s/AKfycbyKNzAWQ8QZWX695Ssv_5d-rYE6Xy2TCWnrOzldlz-DcEOofkeRe9loF4OjoZSUaG8/exec"
    )

    if google_script_url and "YOUR_DEPLOYMENT_ID" not in google_script_url:
        try:
            requests.post(
                google_script_url,
                data=json.dumps({"action": "like"}),
                headers={"Content-Type": "text/plain;charset=utf-8"},
                timeout=5
            )
        except Exception:
            pass

    return {"status": "success", "total_likes": total_likes, "message": "Like recorded successfully."}




@app.post("/api/scrape/start")
def start_scraping_job(req: StartJobRequest, current_user: User = Depends(get_current_user)):
    if req.start > req.end:
        raise HTTPException(status_code=400, detail="Start roll number must be less than or equal to end roll number.")
    _, status = start_user_scrape_job(
        current_user.id,
        prefix=req.prefix,
        start=req.start,
        end=req.end,
        pad=req.pad,
        sem=req.sem,
        program=req.program,
        headless=req.headless,
        selected_fields=req.selected_fields
    )
    return {"message": "Scraping job started successfully.", "job": status}


@app.post("/api/scrape/custom_export")
def generate_custom_excel(req: CustomExportRequest, current_user: User = Depends(get_current_user)):
    if not req.records:
        raise HTTPException(status_code=400, detail="No records provided for export.")
    
    import time
    os.makedirs(user_job_directory(current_user.id), exist_ok=True)
    out_path = os.path.join(user_job_directory(current_user.id), f"RGPV_Custom_Export_{int(time.time())}_{uuid.uuid4().hex[:8]}.xlsx")
    write_excel(req.records, out_path, selected_fields=req.selected_fields)
    
    return FileResponse(
        path=out_path,
        filename=os.path.basename(out_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )



@app.post("/api/scrape/import_excel")
async def import_existing_excel(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """
    Accept an uploaded .xlsx file, validate it, extract the last enrollment number,
    save the file to data/, and return metadata for continue-extraction.
    """
    from openpyxl import load_workbook

    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Only .xlsx Excel files are supported.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        wb = load_workbook(filename=io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {e}")

    # Read headers from first row
    headers = []
    for cell in next(ws.iter_rows(max_row=1)):
        val = str(cell.value or "").strip().upper()
        headers.append(val)

    required_cols = {"ENROLLMENT", "NAME", "RESULT"}
    missing = required_cols - set(headers)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required columns: {', '.join(sorted(missing))}. Found: {', '.join(headers)}"
        )

    enrollment_col_idx = headers.index("ENROLLMENT")  # 0-based
    name_col_idx = headers.index("NAME") if "NAME" in headers else -1
    result_col_idx = headers.index("RESULT") if "RESULT" in headers else -1
    sgpa_col_idx = headers.index("SGPA") if "SGPA" in headers else -1
    cgpa_col_idx = headers.index("CGPA") if "CGPA" in headers else -1
    subject_codes = [h for h in headers if h not in {"S.NO", "ENROLLMENT", "NAME", "RESULT", "SGPA", "CGPA", ""}]

    # Collect existing records from all data rows
    existing_records = []
    last_enrollment = None
    for row in ws.iter_rows(min_row=2, values_only=True):
        enrollment = str(row[enrollment_col_idx] or "").strip().upper() if len(row) > enrollment_col_idx else ""
        if not enrollment:
            continue
        last_enrollment = enrollment

        name_val = str(row[name_col_idx] or "").strip() if name_col_idx >= 0 and len(row) > name_col_idx else ""
        result_val = str(row[result_col_idx] or "").strip().upper() if result_col_idx >= 0 and len(row) > result_col_idx else ""
        sgpa_val = row[sgpa_col_idx] if sgpa_col_idx >= 0 and len(row) > sgpa_col_idx else None
        cgpa_val = row[cgpa_col_idx] if cgpa_col_idx >= 0 and len(row) > cgpa_col_idx else None

        # Build subjects dict from subject code columns
        subjects = {}
        for code in subject_codes:
            col_i = headers.index(code)
            grade = str(row[col_i] or "-").strip() if len(row) > col_i else "-"
            subjects[code] = grade

        if "NOT FOUND" in name_val.upper() or "NOT FOUND" in result_val.upper():
            existing_records.append({"enrollment": enrollment, "not_found": True})
        else:
            rec = {
                "enrollment": enrollment,
                "name": name_val,
                "result": result_val,
                "subjects": subjects,
                "not_found": False
            }
            if sgpa_val is not None and str(sgpa_val) not in ("", "-", "None"):
                try:
                    rec["sgpa"] = float(sgpa_val)
                except (ValueError, TypeError):
                    rec["sgpa"] = None
            if cgpa_val is not None and str(cgpa_val) not in ("", "-", "None"):
                try:
                    rec["cgpa"] = float(cgpa_val)
                except (ValueError, TypeError):
                    rec["cgpa"] = None
            existing_records.append(rec)

    wb.close()

    if not existing_records:
        raise HTTPException(status_code=422, detail="The Excel file has no data rows. Upload a file with at least one student record.")

    if not last_enrollment:
        raise HTTPException(status_code=422, detail="Could not find any enrollment number in the file.")

    # Parse enrollment to detect prefix and numeric roll suffix
    match = re.match(r'^([A-Za-z0-9]*?)([0-9]+)$', last_enrollment)
    if not match:
        raise HTTPException(status_code=422, detail=f"Cannot parse enrollment number format: {last_enrollment}")

    detected_prefix = match.group(1).upper()
    numeric_suffix = match.group(2)
    pad = len(numeric_suffix)
    last_roll = int(numeric_suffix)
    next_start_roll = last_roll + 1

    # Save file to data/ directory
    import_dir = os.path.join(user_job_directory(current_user.id), "imports")
    os.makedirs(import_dir, exist_ok=True)
    safe_name = re.sub(r'[^\w\-_.]', '_', file.filename)
    save_path = os.path.join(import_dir, f"{uuid.uuid4().hex}_{safe_name}")
    with open(save_path, "wb") as f:
        f.write(file_bytes)

    return {
        "last_enrollment": last_enrollment,
        "last_roll": last_roll,
        "next_start_roll": next_start_roll,
        "prefix": detected_prefix,
        "pad": pad,
        "existing_count": len(existing_records),
        "file_path": save_path,
        "subject_codes": subject_codes,
        "existing_records": existing_records
    }


@app.post("/api/scrape/continue")
def continue_scraping_job(req: ContinueJobRequest, current_user: User = Depends(get_current_user)):
    """
    Start a new scraping job that begins from a detected next roll number
    and pre-loads existing records from a previously imported Excel.
    On completion, the job overwrites the imported file with all records.
    """
    if req.start > req.end:
        raise HTTPException(status_code=400, detail="Start roll must be <= end roll.")

    import_root = os.path.realpath(os.path.join(user_job_directory(current_user.id), "imports"))
    import_path = os.path.realpath(req.import_file_path)
    if os.path.commonpath([import_root, import_path]) != import_root or not os.path.isfile(import_path):
        raise HTTPException(status_code=404, detail="Imported Excel file not found.")

    _, status = start_user_scrape_job(
        current_user.id,
        prefix=req.prefix,
        start=req.start,
        end=req.end,
        pad=req.pad,
        sem=req.sem,
        program=req.program,
        headless=req.headless,
        continue_mode=True,
        import_file_path=import_path,
        preloaded_records=req.preloaded_records,
        selected_fields=req.selected_fields
    )
    return {"message": "Continue-extraction job started.", "job": status}


@app.post("/api/scrape/cancel")
def cancel_scraping_job(job_id: str, current_user: User = Depends(get_current_user)):
    with runner_lock:
        runner = scrape_runners.get(job_id)
        if not runner or runner.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Scrape job not found.")
        runner.cancel()
    return {"message": "Job cancellation triggered."}


@app.post("/api/scrape/pause")
def pause_scraping_job(job_id: str, current_user: User = Depends(get_current_user)):
    with runner_lock:
        runner = scrape_runners.get(job_id)
        if not runner or runner.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Scrape job not found.")
        runner.pause()
        return {"message": "Job pause requested.", "job": runner.get_status_dict()}


@app.post("/api/scrape/resume")
def resume_scraping_job(job_id: str, current_user: User = Depends(get_current_user)):
    with runner_lock:
        runner = scrape_runners.get(job_id)
        if not runner or runner.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Scrape job not found.")
        if runner.status != "paused":
            raise HTTPException(status_code=400, detail="Scrape job is not currently paused.")
        runner.resume()
        return {"message": "Job resumed.", "job": runner.get_status_dict()}


@app.post("/api/scrape/reset")
def reset_scraping_job(job_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    if not job_id:
        return {"message": "Scrape session reset successfully.", "job": idle_job_status()}
    db = SessionLocal()
    try:
        job = db.query(ScrapeJob).filter(
            ScrapeJob.job_id == job_id,
            ScrapeJob.user_id == current_user.id
        ).first()
        if not job:
            raise HTTPException(status_code=404, detail="Scrape job not found.")
        with runner_lock:
            runner = scrape_runners.get(job_id)
            if runner and runner.user_id != current_user.id:
                raise HTTPException(status_code=404, detail="Scrape job not found.")
            if runner and runner.status in ["running", "resumed", "starting"]:
                raise HTTPException(status_code=409, detail="Cannot reset while this job is active. Stop or pause it first.")
            reset_status = idle_job_status()
            reset_status["job_id"] = job_id
            job.status = "idle"
            job.status_json = json.dumps(reset_status)
            job.excel_file_path = None
            db.commit()
            return {"message": "Scrape session reset successfully.", "job": reset_status}
    finally:
        db.close()


@app.get("/api/scrape/status")
def get_scraping_status(job_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    return get_user_job_status(current_user.id, job_id)


# History API Endpoints
@app.get("/api/scrape/history")
def get_scraping_history(
    search: Optional[str] = None,
    status: Optional[str] = None,
    sort: str = "newest",
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    db = SessionLocal()
    try:
        query = db.query(ScrapeJobHistory).filter(ScrapeJobHistory.user_id == current_user.id)
        
        # Search filter
        if search and search.strip():
            s_clean = search.strip().lower()
            query = query.filter(
                (ScrapeJobHistory.prefix.ilike(f"%{s_clean}%")) |
                (ScrapeJobHistory.program.ilike(f"%{s_clean}%")) |
                (ScrapeJobHistory.job_id.ilike(f"%{s_clean}%"))
            )
            
        # Status filter
        if status and status.upper() != "ALL":
            query = query.filter(ScrapeJobHistory.status == status.lower())

        # Calculate summary statistics across all history
        all_histories = db.query(ScrapeJobHistory).filter(ScrapeJobHistory.user_id == current_user.id).all()
        total_jobs = len(all_histories)
        total_students_scraped = sum(h.processed_students for h in all_histories)
        total_passed = sum(h.passed_count for h in all_histories)
        total_graded = sum(h.passed_count + h.failed_count for h in all_histories)
        avg_pass_rate = round((total_passed / total_graded * 100), 1) if total_graded > 0 else 0
        total_excel_files = sum(1 for h in all_histories if h.excel_file_path)

        # Sorting
        if sort == "oldest":
            query = query.order_by(ScrapeJobHistory.created_at.asc())
        elif sort == "most_students":
            query = query.order_by(ScrapeJobHistory.processed_students.desc())
        elif sort == "fastest":
            query = query.order_by(ScrapeJobHistory.processing_time_seconds.asc())
        else: # newest
            query = query.order_by(ScrapeJobHistory.created_at.desc())

        total_count = query.count()
        offset = (page - 1) * limit
        items = query.offset(offset).limit(limit).all()

        history_list = []
        for h in items:
            history_list.append({
                "id": h.id,
                "job_id": h.job_id,
                "prefix": h.prefix,
                "start_roll": h.start_roll,
                "end_roll": h.end_roll,
                "pad": h.pad,
                "sem": h.sem,
                "program": h.program,
                "total_students": h.total_students,
                "processed_students": h.processed_students,
                "passed_count": h.passed_count,
                "failed_count": h.failed_count,
                "not_found_count": h.not_found_count,
                "error_count": h.error_count,
                "processing_time_seconds": h.processing_time_seconds,
                "status": h.status,
                "excel_file_path": h.excel_file_path,
                "created_at": h.created_at.isoformat(),
                "user_name": h.user.name if h.user else "System Admin"
            })

        return {
            "history": history_list,
            "total_count": total_count,
            "page": page,
            "limit": limit,
            "summary": {
                "total_jobs": total_jobs,
                "total_students_scraped": total_students_scraped,
                "avg_pass_rate": avg_pass_rate,
                "total_excel_files": total_excel_files
            }
        }
    finally:
        db.close()


@app.delete("/api/scrape/history/clear")
def clear_all_history(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        db.query(ScrapeJobHistory).filter(ScrapeJobHistory.user_id == current_user.id).delete(synchronize_session=False)
        db.commit()
        return {"message": "All scraping history cleared successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to clear history.")
    finally:
        db.close()


@app.delete("/api/scrape/history/{history_id}")
def delete_history_item(history_id: int, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    try:
        item = db.query(ScrapeJobHistory).filter(
            ScrapeJobHistory.id == history_id,
            ScrapeJobHistory.user_id == current_user.id
        ).first()
        if not item:
            raise HTTPException(status_code=404, detail="History record not found.")
        db.delete(item)
        db.commit()
        return {"message": "History record deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete history record.")
    finally:
        db.close()


@app.get("/api/scrape/download")
def download_excel_file(
    job_id: Optional[str] = None,
    path: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if not job_id and not path:
        raise HTTPException(status_code=400, detail="A scrape job ID is required.")

    db = SessionLocal()
    try:
        job = None
        history = None
        if job_id:
            job = db.query(ScrapeJob).filter(
                ScrapeJob.job_id == job_id,
                ScrapeJob.user_id == current_user.id
            ).first()
            if not job:
                history = db.query(ScrapeJobHistory).filter(
                    ScrapeJobHistory.job_id == job_id,
                    ScrapeJobHistory.user_id == current_user.id
                ).first()
        else:
            job = db.query(ScrapeJob).filter(
                ScrapeJob.user_id == current_user.id,
                ScrapeJob.excel_file_path == path
            ).first()
            if not job:
                history = db.query(ScrapeJobHistory).filter(
                    ScrapeJobHistory.user_id == current_user.id,
                    ScrapeJobHistory.excel_file_path == path
                ).first()
        stored_path = (job.excel_file_path if job else history.excel_file_path if history else None)
    finally:
        db.close()

    if not stored_path:
        raise HTTPException(status_code=404, detail="Scrape job or output not found.")
    full_path = os.path.realpath(stored_path)
    user_root = os.path.realpath(user_job_directory(current_user.id))
    if os.path.commonpath([user_root, full_path]) != user_root:
        raise HTTPException(status_code=404, detail="Scrape output not found.")
    base_name = os.path.basename(full_path)
    if not base_name.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Invalid file extension. Only Excel files are supported.")
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="Requested Excel file was not found.")

    return FileResponse(
        path=full_path, 
        filename=base_name, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

def find_student_record(enrollment: str, user_id: int) -> Optional[Dict[str, Any]]:
    """Locate a student result only in the authenticated user's jobs and files."""
    enrollment = enrollment.strip().upper()

    with runner_lock:
        active_runners = list(scrape_runners.values())
    for runner in active_runners:
        if runner.user_id == user_id:
            for record in runner.records:
                if str(record.get("enrollment", "")).upper() == enrollment:
                    return record

    # Search only files stored under the authenticated user's directory.
    import glob
    from openpyxl import load_workbook

    user_root = user_job_directory(user_id)
    excel_files = glob.glob(os.path.join(user_root, "**", "*.xlsx"), recursive=True)
    for filepath in excel_files:
        try:
            wb = load_workbook(filename=filepath, read_only=True, data_only=True)
            ws = wb.active
            headers = [str(cell.value or "").strip().upper() for cell in next(ws.iter_rows(max_row=1))]
            if "ENROLLMENT" not in headers:
                wb.close()
                continue

            enrollment_col_idx = headers.index("ENROLLMENT")
            name_col_idx = headers.index("NAME") if "NAME" in headers else -1
            result_col_idx = headers.index("RESULT") if "RESULT" in headers else -1
            sgpa_col_idx = headers.index("SGPA") if "SGPA" in headers else -1
            cgpa_col_idx = headers.index("CGPA") if "CGPA" in headers else -1
            subject_codes = [h for h in headers if h not in {"S.NO", "ENROLLMENT", "NAME", "RESULT", "SGPA", "CGPA", ""}]

            for row in ws.iter_rows(min_row=2, values_only=True):
                enr = str(row[enrollment_col_idx] or "").strip().upper() if len(row) > enrollment_col_idx else ""
                if enr == enrollment:
                    name_val = str(row[name_col_idx] or "").strip() if name_col_idx >= 0 and len(row) > name_col_idx else ""
                    result_val = str(row[result_col_idx] or "").strip().upper() if result_col_idx >= 0 and len(row) > result_col_idx else ""
                    sgpa_val = row[sgpa_col_idx] if sgpa_col_idx >= 0 and len(row) > sgpa_col_idx else None
                    cgpa_val = row[cgpa_col_idx] if cgpa_col_idx >= 0 and len(row) > cgpa_col_idx else None

                    subjects = {}
                    for code in subject_codes:
                        col_i = headers.index(code)
                        grade = str(row[col_i] or "-").strip() if len(row) > col_i else "-"
                        subjects[code] = grade

                    rec = {
                        "enrollment": enr,
                        "name": name_val,
                        "result": result_val,
                        "subjects": subjects,
                    }
                    if sgpa_val is not None:
                        try:
                            rec["sgpa"] = float(sgpa_val)
                        except (ValueError, TypeError):
                            pass
                    if cgpa_val is not None:
                        try:
                            rec["cgpa"] = float(cgpa_val)
                        except (ValueError, TypeError):
                            pass

                    wb.close()
                    return rec
            wb.close()
        except Exception:
            pass

    return None


@app.get("/api/scrape/download_pdf")
def download_marksheet_pdf(enrollment: str, current_user: User = Depends(get_current_user)):
    if not enrollment:
        raise HTTPException(status_code=400, detail="Enrollment number is required.")

    enrollment_clean = enrollment.strip().upper()
    filename = f"{enrollment_clean}.pdf"

    marksheet_dir = os.path.join(user_job_directory(current_user.id), "marksheets")
    os.makedirs(marksheet_dir, exist_ok=True)
    full_path = os.path.join(marksheet_dir, filename)

    # 2. If PDF does not exist on disk, generate on-demand from stored database/Excel records
    if not os.path.exists(full_path):
        record = find_student_record(enrollment_clean, current_user.id)
        if not record:
            raise HTTPException(
                status_code=404,
                detail=f"No record found for enrollment {enrollment_clean}. Please extract results first."
            )

        try:
            from report_generator.marksheet_pdf import generate_student_marksheet_pdf
            full_path = generate_student_marksheet_pdf(record, full_path)
            print(f"[On-Demand PDF] Generated marksheet for owner {current_user.id}.")
        except Exception as e:
            print(f"[On-Demand PDF Error] Failed for owner {current_user.id}: {e}")
            raise HTTPException(status_code=500, detail="Failed to generate marksheet PDF.")

    return FileResponse(
        path=full_path,
        filename=f"RGPV_Marksheet_{enrollment_clean}.pdf",
        media_type="application/pdf"
    )


# WebSocket communication loop
async def broadcast_updates():
    while True:
        while not update_queue.empty():
            try:
                message = update_queue.get_nowait()
                user_id = message.get("user_id")
                job_id = message.get("job_id")
                if user_id is not None and job_id:
                    await manager.send_to_owner(user_id, job_id, message)
            except queue.Empty:
                break
        await asyncio.sleep(0.15)


# WebSocket endpoint
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    protocols = websocket.scope.get("subprotocols", [])
    if len(protocols) < 2 or protocols[0] != "resultai":
        await websocket.close(code=4401)
        return
    try:
        payload = decode_token(protocols[1], SECRET_KEY)
        user_id = int(payload.get("sub"))
        if payload.get("type") != "access":
            raise ValueError("Invalid token type")
    except Exception:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    finally:
        db.close()
    if not user:
        await websocket.close(code=4401)
        return

    job_id = websocket.query_params.get("job_id")
    if job_id and not get_owned_job_row(user_id, job_id):
        await websocket.close(code=4404)
        return

    try:
        await manager.connect(websocket, user_id, job_id)
        status = get_user_job_status(user_id, job_id)
        await websocket.send_json({"type": "status", "data": status})
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)


# Start DB initialization and background broadcast task on startup
@app.on_event("startup")
async def startup_event():
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    

    # Copy brand logo artifact to frontend folders
    try:
        import shutil
        logo_artifact = r"C:\Users\mayan\.gemini\antigravity-ide\brain\14285cfe-ce6a-4f14-b649-95f140bfe626\media__1784561737544.jpg"
        if os.path.exists(logo_artifact):
            root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            public_dir = os.path.join(root_dir, "frontend", "public")
            src_assets = os.path.join(root_dir, "frontend", "src", "assets")
            dist_dir = os.path.join(root_dir, "frontend", "dist")
            
            for d in [public_dir, src_assets, dist_dir]:
                os.makedirs(d, exist_ok=True)
                shutil.copy(logo_artifact, os.path.join(d, "logo.png"))
                shutil.copy(logo_artifact, os.path.join(d, "logo.jpg"))
            
            import base64
            with open(logo_artifact, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            js_content = f'export const LOGO_BASE64 = "data:image/jpeg;base64,{b64}";\nexport default LOGO_BASE64;\n'
            with open(os.path.join(src_assets, "logoData.js"), "w", encoding="utf-8") as f:
                f.write(js_content)

            print("[System] Official ResultAI brand logo copied & logoData.js created!")
    except Exception as exc:
        print(f"[System] Logo sync warning: {exc}")

    task = asyncio.create_task(broadcast_updates())
    background_tasks.add(task)
    task.add_done_callback(background_tasks.discard)


# Serve static frontend files if built
script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_dist_path = os.path.join(script_dir, "frontend", "dist")
if not os.path.exists(frontend_dist_path):
    frontend_dist_path = os.path.abspath("frontend/dist")

if os.path.exists(frontend_dist_path):
    assets_dir = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow FastAPI API routes, WebSockets, and Swagger docs to pass through
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json") or full_path.startswith("redoc"):
            raise HTTPException(status_code=404, detail="API route not found.")
        
        target_file = os.path.join(frontend_dist_path, full_path)
        if full_path and os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)
            
        index_file = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
            
        raise HTTPException(status_code=404, detail="Frontend index.html not found.")
else:
    @app.get("/")
    def read_root():
        return {
            "message": "ResultAI Backend API is running successfully.",
            "frontend_instructions": "To view the user interface, open http://localhost:5173 or run 'npm run build' inside '/frontend' folder to serve statically.",
            "api_doc": "/docs"
        }


if __name__ == "__main__":
    import uvicorn
    # Start the server (will run on http://localhost:8000)
    uvicorn.run(app, host="127.0.0.1", port=8000)
