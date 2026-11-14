"""
support_router.py
------------------
FastAPI router for the AI-powered Support Assistant.

Refactored Intent-First NLP Pipeline:
1. Detect Intent FIRST
2. Run Intent-Scoped Entity Extraction (Only RESULT_LOOKUP and ROLL_SEARCH extract student_name)
3. Strict Stop-Word Filtering for Student Names
4. Connected Intents: RESULT_LOOKUP, ROLL_SEARCH, START_EXTRACTION, LIVE_STATUS, HISTORY, RESUME, EXPORT, JOB_STATS, TOTAL_STUDENTS, CAPABILITY, HELP
5. Detailed Debug Pipeline Console Logging (Intent, Entities, Ignored Tokens, Backend Function)
"""

from __future__ import annotations

import os
import re
import json
import time
import glob
import urllib.request
import urllib.error
from typing import List, Optional, Dict, Any, Tuple
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from openpyxl import load_workbook

from backend.db.auth import get_current_user
from backend.db.models import User, ScrapeJobHistory
from backend.db.database import SessionLocal
from backend.utils.groq_service import groq_service

support_router = APIRouter(tags=["Support Assistant"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class SupportChatRequest(BaseModel):
    messages: List[ChatMessage]
    user_query: str
    client_context: Optional[Dict[str, Any]] = None


class SupportChatResponse(BaseModel):
    reply: str
    source: str  # "intent_action", "ai", "fallback_faq", "clarification"
    intent: Optional[str] = None
    confidence: Optional[float] = None
    suggested_actions: Optional[List[str]] = None
    live_job_banner: Optional[Dict[str, Any]] = None
    job_id: Optional[str] = None
    is_job_card: Optional[bool] = None


# ═══════════════════════════════════════════════════════════════════════
#  STOP WORDS & TYPO MAP DICTIONARIES
# ═══════════════════════════════════════════════════════════════════════

STOP_WORDS = {
    "result", "search", "show", "history", "student", "total", "kitne", "complete", "completed",
    "status", "scrape", "scraping", "extraction", "extract", "branch", "btech", "semester", "sem",
    "roll", "number", "enrollment", "view", "live", "speed", "eta", "nika", "nikal", "do", "de",
    "bata", "ka", "ke", "ki", "tak", "taka", "job", "jobs", "failed", "count", "please", "pls",
    "bhai", "sir", "for", "of", "the", "in", "is", "a", "an", "tum", "tere", "pass", "ho", "hai",
    "hain", "kuch", "sab", "apne", "me", "mein", "aur", "ko", "se", "par", "koee", "kaun"
}

TYPO_MAP = {
    "reuslt": "result", "rsult": "result", "rasult": "result", "resut": "result", "reslt": "result", "resutl": "result",
    "rol": "roll", "rolno": "roll", "rool": "roll", "enroll": "enrollment", "enrolment": "enrollment", "enrol": "enrollment",
    "ststus": "status", "staus": "status", "statas": "status", "stuts": "status",
    "histry": "history", "histroy": "history", "histor": "history", "histryy": "history",
    "scaerp": "scrape", "skrape": "scrape", "scraep": "scrape", "skrap": "scrape",
    "extaction": "extraction", "extrakshn": "extraction", "extract": "extraction", "extrakion": "extraction",
    "bteck": "btech", "b-tech": "btech", "b.tech": "btech", "b.t": "btech",
    "pharmacy": "pharmacy", "bpharm": "bpharmacy", "b.pharm": "bpharmacy",
}


def normalize_text(text: str) -> str:
    """Normalizes text: lowercase, punctuation removal, space collapsing, and typo auto-correction."""
    clean = text.lower().strip()
    clean = re.sub(r'[^a-z0-9\s\-]', ' ', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()

    words = clean.split()
    corrected_words = [TYPO_MAP.get(w, w) for w in words]
    return " ".join(corrected_words)


def extract_student_name(raw_query: str, norm_text: str) -> Tuple[Optional[str], List[str]]:
    """
    Strips stop words, numbers, and short tokens to extract student name.
    Returns (student_name or None, ignored_tokens_list).
    """
    tokens = re.findall(r'[a-zA-Z]+', norm_text)
    ignored_tokens = []
    name_tokens = []

    for tok in tokens:
        if tok.lower() in STOP_WORDS or len(tok) < 2:
            ignored_tokens.append(tok)
        else:
            name_tokens.append(tok.capitalize())

    if name_tokens:
        return " ".join(name_tokens), ignored_tokens
    return None, ignored_tokens


# ═══════════════════════════════════════════════════════════════════════
#  LIVE JOB CONTEXT & BANNER
# ═══════════════════════════════════════════════════════════════════════

def get_live_job_context() -> Optional[Dict[str, Any]]:
    """Reads active job status directly from server module safely."""
    try:
        from backend.server import active_runner, last_job_status
        if active_runner:
            return active_runner.get_status_dict()
        elif last_job_status:
            return last_job_status
    except Exception as e:
        print(f"[SupportAssistant] Error reading live job context: {e}")
    return None


def format_job_banner(job_info: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Formats a concise live job status banner dictionary for chat UI."""
    if not job_info:
        return {"status": "idle", "message": "No active scraping job currently running."}

    excel_path = job_info.get("excel_file_path")
    real_excel = excel_path if (excel_path and os.path.exists(excel_path)) else None

    val_report = job_info.get("validation_report") or {}

    return {
        "status": job_info.get("status", "idle"),
        "job_id": job_info.get("job_id", ""),
        "start_time": job_info.get("start_time"),
        "end_time": job_info.get("end_time"),
        "processing_time_seconds": job_info.get("processing_time_seconds"),
        "total": job_info.get("total", 0),
        "processed": job_info.get("processed", 0),
        "pass_count": job_info.get("pass_count", 0),
        "fail_count": job_info.get("fail_count", 0),
        "not_found_count": job_info.get("not_found_count", 0),
        "error_count": job_info.get("error_count", 0),
        "current_enrollment": job_info.get("current_enrollment", ""),
        "has_validation_issues": bool(val_report.get("has_suspicious_data")),
        "excel_file_path": real_excel,
        "captcha_mode": job_info.get("captcha_mode", "ocr")
    }


# ═══════════════════════════════════════════════════════════════════════
#  STUDENT RESULT SEARCH ENGINE
# ═══════════════════════════════════════════════════════════════════════

def search_student_records(query: str, semester_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Searches for student result records in active memory and saved Excel files in data/."""
    clean_q = query.strip().upper()
    if not clean_q:
        return []

    results: List[Dict[str, Any]] = []
    seen_enrollments = set()

    # 1. Search Active Job Runner in-memory records
    job_info = get_live_job_context()
    if job_info and "records" in job_info and job_info["records"]:
        sem_context = job_info.get("sem") or semester_filter or ""
        program_context = job_info.get("program") or "B.Tech."
        for rec in job_info["records"]:
            if rec.get("not_found"):
                continue
            enr = str(rec.get("enrollment", "")).strip().upper()
            name = str(rec.get("name", "")).strip().upper()

            if clean_q in enr or clean_q in name:
                key = f"{enr}_{sem_context}"
                if key not in seen_enrollments:
                    seen_enrollments.add(key)
                    results.append({
                        "enrollment": rec.get("enrollment", ""),
                        "name": rec.get("name", ""),
                        "semester": sem_context or "Latest",
                        "program": program_context,
                        "sgpa": rec.get("sgpa"),
                        "cgpa": rec.get("cgpa"),
                        "result": rec.get("result", "PASS" if rec.get("sgpa") else "UNKNOWN"),
                        "subjects": rec.get("subjects", {}),
                        "fail_subjects": rec.get("fail_subjects", []),
                        "source": "Active Session"
                    })

    # 2. Search saved Excel files in data/ and data/uploads/
    excel_files = glob.glob("data/*.xlsx") + glob.glob("data/uploads/*.xlsx")
    for fpath in excel_files:
        try:
            wb = load_workbook(fpath, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            wb.close()
            if not rows or len(rows) < 2:
                continue

            headers = [str(h).strip().upper() if h else "" for h in rows[0]]
            if "ENROLLMENT" not in headers:
                continue

            enr_idx = headers.index("ENROLLMENT")
            name_idx = headers.index("NAME") if "NAME" in headers else -1
            res_idx = headers.index("RESULT") if "RESULT" in headers else -1
            sgpa_idx = headers.index("SGPA") if "SGPA" in headers else -1
            cgpa_idx = headers.index("CGPA") if "CGPA" in headers else -1

            subject_start = (name_idx + 1) if name_idx >= 0 else 3
            subject_end = res_idx if res_idx >= 0 else len(headers) - 3
            subject_codes = headers[subject_start:subject_end] if subject_start < subject_end else []

            for row in rows[1:]:
                if not row or len(row) <= enr_idx:
                    continue
                enr_val = str(row[enr_idx] or "").strip()
                name_val = str(row[name_idx] or "").strip() if name_idx >= 0 and len(row) > name_idx else ""

                if not enr_val or "NOT FOUND" in name_val.upper():
                    continue

                if clean_q in enr_val.upper() or (name_val and clean_q in name_val.upper()):
                    key = f"{enr_val.upper()}_{semester_filter or 'All'}"
                    if key in seen_enrollments:
                        continue
                    seen_enrollments.add(key)

                    sgpa_val = row[sgpa_idx] if sgpa_idx >= 0 and len(row) > sgpa_idx else None
                    cgpa_val = row[cgpa_idx] if cgpa_idx >= 0 and len(row) > cgpa_idx else None
                    res_val = str(row[res_idx] or "PASS").strip() if res_idx >= 0 and len(row) > res_idx else "PASS"

                    subjects = {}
                    fail_subs = []
                    for i, code in enumerate(subject_codes):
                        col_i = subject_start + i
                        if col_i < len(row) and row[col_i]:
                            grade = str(row[col_i]).strip()
                            subjects[code] = grade
                            if grade.upper() in {"F", "FAIL", "AB", "ABSENT", "RL"}:
                                fail_subs.append(code)

                    results.append({
                        "enrollment": enr_val,
                        "name": name_val,
                        "semester": semester_filter or "Extracted Result",
                        "program": "B.Tech.",
                        "sgpa": float(sgpa_val) if sgpa_val and str(sgpa_val).replace('.', '', 1).isdigit() else sgpa_val,
                        "cgpa": float(cgpa_val) if cgpa_val and str(cgpa_val).replace('.', '', 1).isdigit() else cgpa_val,
                        "result": res_val,
                        "subjects": subjects,
                        "fail_subjects": fail_subs,
                        "source": os.path.basename(fpath)
                    })
        except Exception as err:
            print(f"[SupportAssistant] Error parsing Excel file {fpath}: {err}")

    return results


# ═══════════════════════════════════════════════════════════════════════
#  STEP 1: INTENT-FIRST CLASSIFIER
# ═══════════════════════════════════════════════════════════════════════

def classify_intent_first(norm_text: str, raw_query: str, chat_history: List[ChatMessage]) -> Tuple[str, float]:
    """
    Classifies intent FIRST before running entity extraction.
    Priority Cascade:
    1. Direct Roll Number regex match -> RESULT_LOOKUP (0.98)
    2. JOB_STATS -> kitne jobs complete, completed jobs, failed jobs, total history (0.95)
    3. TOTAL_STUDENTS -> total students, total student kitne hai, IT branch me total (0.95)
    4. START_EXTRACTION -> BTech IT 3 sem 3 se 7 tak nikal do, start extraction (0.95)
    5. LIVE_STATUS -> status, speed, eta, progress, kitna hua, running (0.95)
    6. HISTORY -> history, past, purani, jobs list, logs (0.95)
    7. RESUME -> resume, continue, unpause, dobara (0.90)
    8. ROLL_SEARCH -> roll number of X, Ayush ka roll no, enrollment of (0.92)
    9. RESULT_LOOKUP -> result, marksheet, score, sgpa, cgpa, pass/fail or student lookup (0.85)
    10. CAPABILITY -> tere pass kya data hai, tum kya kar sakte ho, features (0.92)
    11. HELP -> general help (0.50)
    """
    # 1. Roll Number Direct Regex Match -> RESULT_LOOKUP
    roll_match = re.search(r'\b[0-9]{4}[a-z]{2,4}[0-9]{4,6}\b', norm_text, re.IGNORECASE) or re.search(r'\b[0-9]{6,12}\b', norm_text)
    if roll_match:
        return "RESULT_LOOKUP", 0.98

    # Multi-turn context check for slot filling
    last_assistant_msg = ""
    for msg in reversed(chat_history):
        if msg.role in ["assistant", "model"]:
            last_assistant_msg = msg.content.lower()
            break

    if any(phrase in last_assistant_msg for phrase in ["roll number or student name", "provide the roll number", "specify roll number"]):
        return "RESULT_LOOKUP", 0.95

    # 2. JOB_STATS
    job_stats_keywords = ["kitne jobs", "jobs complete", "completed jobs", "failed jobs", "total history", "scraping count", "job stats", "jobs count", "how many jobs", "total jobs"]
    if any(k in norm_text for k in job_stats_keywords):
        return "JOB_STATS", 0.95

    # 3. TOTAL_STUDENTS
    total_students_keywords = ["total students", "total student", "student kitne", "total kitne hai", "total kitne", "student count", "kitne student", "kitne students"]
    if any(k in norm_text for k in total_students_keywords):
        return "TOTAL_STUDENTS", 0.95

    # 4. START_EXTRACTION
    start_keywords = ["start", "nikal", "nikalo", "scrape", "extraction", "chalu", "chalao", "fetch", "run job", "start job"]
    has_range_pattern = bool(re.search(r'(\d+)\s*(?:se|to|-)\s*(\d+)', norm_text))
    if (any(k in norm_text for k in start_keywords) and (has_range_pattern or "sem" in norm_text or "branch" in norm_text)) or ("nikal do" in norm_text or "chalu karo" in norm_text):
        return "START_EXTRACTION", 0.95 if has_range_pattern else 0.88

    # 5. LIVE_STATUS
    status_keywords = ["status", "speed", "eta", "progress", "kitna hua", "running", "live", "current job", "kitne students processed"]
    if any(k in norm_text for k in status_keywords):
        return "LIVE_STATUS", 0.95

    # 6. HISTORY
    history_keywords = ["history", "past", "purani", "jobs list", "logs", "previous extractions", "database history"]
    if any(k in norm_text for k in history_keywords):
        return "HISTORY", 0.95

    # 7. CANCEL_JOB / STOP
    cancel_keywords = ["stop", "cancel", "rok do", "band karo", "stop job", "cancel job", "stop scrape", "cancel scrape", "stop extraction", "scraping stop", "job stop", "rok do scrape"]
    if any(k in norm_text for k in cancel_keywords):
        return "CANCEL_JOB", 0.95

    # 8. RESUME
    resume_keywords = ["resume", "continue", "unpause", "dobara", "resume scrape"]
    if any(k in norm_text for k in resume_keywords):
        return "RESUME", 0.90

    # 8. ROLL_SEARCH (Asking specifically for roll number of student)
    roll_search_patterns = ["roll number", "roll no", "enrollment", "roll kya hai", "roll bata", "enrollment no"]
    if any(p in norm_text for p in roll_search_patterns):
        return "ROLL_SEARCH", 0.92

    # 9. RESULT_LOOKUP (General result query or student search)
    result_keywords = ["result", "marksheet", "score", "sgpa", "cgpa", "grade", "pass", "fail"]
    if any(k in norm_text for k in result_keywords):
        return "RESULT_LOOKUP", 0.85

    # 10. CAPABILITY
    capability_patterns = ["kya data hai", "kya kar sakte ho", "features", "capabilities", "kya kar sakte", "tere pass", "tum kya", "what can you do"]
    if any(p in norm_text for p in capability_patterns):
        return "CAPABILITY", 0.92

    # 11. HELP
    help_patterns = ["help", "guide", "instructions", "how to use"]
    if any(p in norm_text for p in help_patterns):
        return "HELP", 0.85

    # Check for general question indicators before fallback student name lookup
    general_q_words = {"what", "why", "how", "when", "where", "who", "which", "explain", "tell", "describe", "define", "kaise", "kyun", "kya", "kab", "kahan", "kon", "about", "tayari", "tips", "difference"}
    if any(w in norm_text.split() for w in general_q_words):
        return "GENERAL_QA", 0.30

    # Check if string looks like a student name search
    name_candidate, _ = extract_student_name(raw_query, norm_text)
    if name_candidate and len(name_candidate.split()) <= 4:
        return "RESULT_LOOKUP", 0.82

    return "GENERAL_QA", 0.30

# Alias for backward compatibility in tests
detect_intent = classify_intent_first


# ═══════════════════════════════════════════════════════════════════════
#  STEP 2: INTENT-SCOPED ENTITY EXTRACTION
# ═══════════════════════════════════════════════════════════════════════

def extract_intent_entities(intent: str, norm_text: str, raw_query: str) -> Tuple[Dict[str, Any], List[str]]:
    """
    Extracts entities based strictly on the detected intent.
    Rule: Only RESULT_LOOKUP and ROLL_SEARCH are permitted to extract student_name.
    All other intents set student_name = None.
    """
    entities: Dict[str, Any] = {
        "program": None,
        "branch": None,
        "semester": None,
        "prefix": None,
        "start_roll": None,
        "end_roll": None,
        "roll_number": None,
        "student_name": None
    }
    ignored_tokens: List[str] = []

    # 1. Roll Number (if applicable)
    roll_match = re.search(r'\b[0-9]{4}[a-z]{2,4}[0-9]{4,6}\b', norm_text, re.IGNORECASE) or re.search(r'\b[0-9]{6,12}\b', norm_text)
    if roll_match:
        entities["roll_number"] = roll_match.group(0).upper()

    # 2. Semester Extraction
    sem_match = re.search(r'(\d+)\s*(?:sem|semester|st|nd|rd|th)', norm_text) or re.search(r'(?:sem|semester)\s*(\d+)', norm_text)
    if sem_match:
        entities["semester"] = sem_match.group(1)

    # 3. Branch Extraction
    branches = {
        "it": "IT", "cs": "CS", "cse": "CS", "me": "ME", "mechanical": "ME",
        "ec": "EC", "electronics": "EC", "ce": "CE", "civil": "CE",
        "ee": "EE", "electrical": "EE", "ex": "EX"
    }
    for b_key, b_val in branches.items():
        if re.search(r'\b' + b_key + r'\b', norm_text):
            entities["branch"] = b_val
            break

    # 4. Program Extraction
    if any(p in norm_text for p in ["btech", "b tech", "be"]):
        entities["program"] = "B.Tech."
    elif any(p in norm_text for p in ["bpharmacy", "bpharm", "pharmacy"]):
        entities["program"] = "B.Pharmacy"
    elif "mca" in norm_text:
        entities["program"] = "MCA"
    elif "mtech" in norm_text:
        entities["program"] = "M.Tech"
    elif "mba" in norm_text:
        entities["program"] = "MBA"

    # 5. START_EXTRACTION Specific Entities (Roll Range & Prefix)
    if intent == "START_EXTRACTION":
        range_match = re.search(r'(\d+)\s*(?:se|to|-)\s*(\d+)', norm_text)
        if range_match:
            try:
                s_val = int(range_match.group(1))
                e_val = int(range_match.group(2))
                if s_val <= e_val:
                    entities["start_roll"] = s_val
                    entities["end_roll"] = e_val
            except (ValueError, TypeError):
                pass
        b_code = entities.get("branch") or "IT"
        entities["prefix"] = f"0105{b_code}2410"

    # 6. Student Name Extraction (STRICT RULE: ONLY FOR RESULT_LOOKUP AND ROLL_SEARCH)
    if intent in ["RESULT_LOOKUP", "ROLL_SEARCH"] and not entities.get("roll_number"):
        name_cand, ign_toks = extract_student_name(raw_query, norm_text)
        entities["student_name"] = name_cand
        ignored_tokens = ign_toks
    else:
        # For ALL OTHER intents (START_EXTRACTION, HISTORY, LIVE_STATUS, JOB_STATS, TOTAL_STUDENTS, RESUME, EXPORT, CAPABILITY, HELP)
        entities["student_name"] = None
        # Collect ignored tokens from norm_text
        ignored_tokens = [tok for tok in norm_text.split() if tok in STOP_WORDS]

    return entities, ignored_tokens


# ═══════════════════════════════════════════════════════════════════════
#  ENHANCED DEBUG CONSOLE LOGGING
# ═══════════════════════════════════════════════════════════════════════

def log_nlp_pipeline_debug(raw_query: str, norm_text: str, intent: str, confidence: float, entities: Dict[str, Any], ignored_tokens: List[str], handler_name: str):
    """Prints clean structured NLP debug log to server terminal."""
    try:
        print("\n" + "=" * 65)
        print("[ResultAI NLP Pipeline Debug Log]")
        print(f"  • Raw Query        : \"{raw_query}\"")
        print(f"  • Normalized Text  : \"{norm_text}\"")
        print(f"  • Detected Intent  : {intent} (Confidence: {confidence:.2f})")
        print(f"  • Extracted Entities: {json.dumps(entities)}")
        print(f"  • Ignored Tokens   : {json.dumps(ignored_tokens)}")
        print(f"  • Backend Function : {handler_name}")
        print("=" * 65 + "\n")
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════════════════
#  ACTION HANDLERS
# ═══════════════════════════════════════════════════════════════════════

def execute_result_lookup(entities: Dict[str, Any], raw_query: str) -> Dict[str, Any]:
    """Handles student result lookup, multi-student disambiguation, and result card generation."""
    roll = entities.get("roll_number")
    name = entities.get("student_name")
    sem = entities.get("semester")

    target_query = roll or name or raw_query.strip()

    if not roll and not name and any(word in target_query.lower() for word in ["result", "sem", "semester"]):
        sem_str = f"Semester {sem}" if sem else "the target semester"
        return {
            "reply": f"🔍 **Result Lookup**: Please provide the **Roll/Enrollment Number** or **Student Name** to search for {sem_str}.",
            "suggested_actions": ["⚡ Check Live Scrape Status", "📜 View History", "❓ Capabilities"]
        }

    matches = search_student_records(target_query, semester_filter=sem)

    if not matches:
        return {
            "reply": (
                f"🔍 **Result Lookup**: No student record found matching **'{target_query}'**.\n\n"
                f"**Tips**:\n"
                f"- Verify the enrollment number or name spelling (e.g. `0105IT241001` or `Astha`).\n"
                f"- If you haven't extracted results for this batch yet, type *'BTech IT 3 sem 1 se 60 tak nikal do'* to start extraction!"
            ),
            "suggested_actions": ["⚡ Check Live Status", "🚀 Start Extraction", "📜 View History"]
        }

    if len(matches) > 1:
        match_list_md = "\n".join([
            f"{i+1}. 👤 **{m['name']}** | Roll: `{m['enrollment']}` | Sem: `{m['semester']}` | SGPA: `{m['sgpa'] or 'N/A'}`"
            for i, m in enumerate(matches[:5])
        ])
        return {
            "reply": (
                f"🔍 Found **{len(matches)} students** matching **'{target_query}'**:\n\n"
                f"{match_list_md}\n\n"
                f"Please reply with the exact **Roll/Enrollment Number** (e.g. `{matches[0]['enrollment']}`) to view the detailed marksheet."
            ),
            "suggested_actions": [f"🔍 {m['enrollment']}" for m in matches[:3]]
        }

    rec = matches[0]
    res_badge = "✅ **PASS**" if rec['result'] == "PASS" else ("❌ **FAIL**" if rec['result'] == "FAIL" else "ℹ️ **UNKNOWN**")

    subjects_table = ""
    if rec.get("subjects"):
        subs_md = "\n".join([f"| `{code}` | **{grade}** |" for code, grade in rec["subjects"].items()])
        subjects_table = f"\n\n**Subject Breakdown**:\n| Subject Code | Grade |\n|---|---|\n{subs_md}"

    fail_warn = f"\n⚠️ **Failed Subjects**: {', '.join(rec['fail_subjects'])}" if rec.get("fail_subjects") else ""

    reply = (
        f"🎓 **Student Result Details**\n\n"
        f"- **Name**: **{rec['name']}**\n"
        f"- **Enrollment No**: `{rec['enrollment']}`\n"
        f"- **Semester**: `{rec['semester']}` | **Program**: `{rec['program']}`\n"
        f"- **Status**: {res_badge}\n"
        f"- **SGPA**: `{rec['sgpa'] if rec['sgpa'] is not None else 'N/A'}` | **CGPA**: `{rec['cgpa'] if rec['cgpa'] is not None else 'N/A'}`"
        f"{fail_warn}"
        f"{subjects_table}\n\n"
        f"📁 *Source*: `{rec['source']}`"
    )

    return {
        "reply": reply,
        "suggested_actions": ["⚡ Check Live Status", "📜 View History", "📊 Custom Export Studio"]
    }


def execute_roll_search(entities: Dict[str, Any], raw_query: str) -> Dict[str, Any]:
    """Handles ROLL_SEARCH queries like 'Ayush ka roll number' and returns matching enrollment numbers."""
    name = entities.get("student_name") or raw_query.strip()
    matches = search_student_records(name)

    if not matches:
        return {
            "reply": f"🆔 **Roll Number Search**: No student enrollment found matching **'{name}'** in local database or Excel files.",
            "suggested_actions": ["⚡ Check Live Status", "🚀 Start Extraction", "📜 View History"]
        }

    results_md = "\n".join([
        f"• 👤 **{m['name']}** $\\rightarrow$ Roll Number: `{m['enrollment']}` (Sem: `{m['semester']}`, Result: `{m['result']}`)"
        for m in matches[:5]
    ])

    return {
        "reply": f"🆔 **Enrollment Number Found**:\n\n{results_md}",
        "suggested_actions": [f"🔍 Result for {m['enrollment']}" for m in matches[:2]]
    }


def inspect_existing_records(prefix: str, start_roll: int, end_roll: int, pad: int = 2) -> Dict[str, Any]:
    """Inspects existing records in active memory and data/*.xlsx for rolls in range [start_roll, end_roll]."""
    total = max(1, end_roll - start_roll + 1)
    found_records = {}
    missing_rolls = []

    for roll in range(start_roll, end_roll + 1):
        enr = f"{prefix}{str(roll).zfill(pad)}"
        matches = search_student_records(enr)
        if matches:
            found_records[roll] = matches[0]
        else:
            missing_rolls.append(roll)

    return {
        "total": total,
        "found_count": len(found_records),
        "found_records": found_records,
        "missing_rolls": missing_rolls
    }


def auto_start_scraper_job(prefix: str, start_roll: int, end_roll: int, pad: int = 2, sem: Optional[str] = None, program: str = "B.Tech.") -> Tuple[bool, str, Any]:
    """Automatically launches ScrapeJobRunner in backend for requested parameters if runner is idle."""
    try:
        from backend.server import active_runner, runner_lock, ScrapeJobRunner
        import backend.server as server_mod

        if start_roll > end_roll:
            return False, "Start roll number must be less than or equal to end roll number.", None

        with runner_lock:
            if server_mod.active_runner is not None and server_mod.active_runner.status in ["running", "resumed", "starting"]:
                return False, f"A scraping job is already active in background (Job ID: {server_mod.active_runner.job_id}).", server_mod.active_runner

            runner = ScrapeJobRunner(
                prefix=prefix,
                start=start_roll,
                end=end_roll,
                pad=pad,
                sem=sem,
                program=program,
                headless=True
            )
            runner.start_job()
            server_mod.active_runner = runner
            runner.notify_progress()
            return True, f"Started extraction job for rolls {start_roll} to {end_roll}.", runner
    except Exception as e:
        print(f"[SupportAssistant] Auto-start scraper warning: {e}")
        return False, f"Could not auto-start scraper: {e}", None


def execute_start_extraction(entities: Dict[str, Any]) -> Dict[str, Any]:
    """Handles natural language extraction commands by launching a real backend ScrapeJobRunner."""
    program = entities.get("program", "B.Tech.")
    branch = entities.get("branch", "IT")
    sem = entities.get("semester", "3")
    start = entities.get("start_roll", 1)
    end = entities.get("end_roll", 5)
    pad = 2
    prefix = entities.get("prefix") or f"0105{branch}2410"

    success_flag, launch_msg, runner_obj = auto_start_scraper_job(
        prefix=prefix,
        start_roll=start,
        end_roll=end,
        pad=pad,
        sem=sem,
        program=program
    )

    if success_flag and runner_obj:
        total_students = end - start + 1
        reply = (
            f"🚀 **Scraping Job Started Successfully**\n\n"
            f"A real background extraction job has been initialized:\n"
            f"- **Job ID**: `{runner_obj.job_id}`\n"
            f"- **Prefix**: `{prefix}`\n"
            f"- **Roll Range**: `{start}` to `{end}` (**{total_students}** students)\n"
            f"- **Program / Sem**: `{program}` / Sem `{sem or 'All'}`\n\n"
            f"⚡ **Real-Time Synchronization Active**:\n"
            f"- Extracted records, progress %, current roll, CAPTCHA mode, and live logs are streaming live on your dashboard and live job banner above.\n"
            f"- The final Excel spreadsheet will be generated automatically upon completion."
        )
        return {
            "reply": reply,
            "job_id": runner_obj.job_id,
            "is_job_card": True,
            "suggested_actions": ["⚡ Check Live Scrape Status", "⏹️ Stop Scraping", "📜 View Scraping History"]
        }
    else:
        current_job_id = runner_obj.job_id if runner_obj else "Active Job"
        reply = (
            f"⚠️ **Cannot Start Extraction**\n\n"
            f"{launch_msg}\n\n"
            f"You can check live extraction progress, pause/resume, or cancel the running job before launching a new one."
        )
        return {
            "reply": reply,
            "suggested_actions": ["⚡ Check Live Scrape Status", "⏹️ Stop Scraping", "📜 View Scraping History"]
        }


def execute_cancel_job() -> Dict[str, Any]:
    """Handles CANCEL_JOB intent: stops active background extraction job safely."""
    try:
        import backend.server as server_mod
        if server_mod.active_runner and server_mod.active_runner.status in ["running", "resumed", "starting", "paused"]:
            job_id = server_mod.active_runner.job_id
            server_mod.active_runner.cancel()
            reply = (
                f"⏹️ **Scraping Job Cancelled**\n\n"
                f"The active background scraping job (`{job_id}`) has been stopped safely."
            )
            return {
                "reply": reply,
                "job_id": job_id,
                "is_job_card": True,
                "suggested_actions": ["🚀 Start New Scrape", "⚡ Check Live Status", "📜 View Scraping History"]
            }
        else:
            return {
                "reply": "ℹ️ **No Active Scrape Job**: There is currently no active scraping job running to stop.",
                "suggested_actions": ["🚀 Start New Scrape", "⚡ Check Live Status", "📜 View Scraping History"]
            }
    except Exception as e:
        return {
            "reply": f"⚠️ **Cancel Request Failed**: {e}",
            "suggested_actions": ["⚡ Check Live Status", "❓ Capabilities"]
        }


def execute_job_stats() -> Dict[str, Any]:
    """Handles JOB_STATS intent: queries SQLite database for aggregate job execution counts."""
    db = SessionLocal()
    try:
        histories = db.query(ScrapeJobHistory).all()
        if not histories:
            return {
                "reply": "📊 **Scraping Job Statistics**: No extraction jobs have been executed yet in the local database.",
                "suggested_actions": ["🚀 Start New Scrape", "❓ Capabilities"]
            }

        total_jobs = len(histories)
        completed_jobs = sum(1 for h in histories if h.status == "completed")
        failed_jobs = sum(1 for h in histories if h.status == "failed")
        cancelled_jobs = sum(1 for h in histories if h.status == "cancelled")
        total_students_scraped = sum(h.processed_students for h in histories)
        total_passed = sum(h.passed_count for h in histories)
        total_graded = sum(h.passed_count + h.failed_count for h in histories)
        avg_pass_rate = round((total_passed / total_graded * 100), 1) if total_graded > 0 else 0.0

        reply = (
            f"📊 **Scraping Job Statistics (Database Aggregate)**\n\n"
            f"- **Total Extraction Jobs**: **{total_jobs}**\n"
            f"- **Completed Jobs**: ✅ `{completed_jobs}`\n"
            f"- **Failed Jobs**: ❌ `{failed_jobs}`\n"
            f"- **Cancelled Jobs**: ⏹️ `{cancelled_jobs}`\n"
            f"- **Total Students Scraped**: **{total_students_scraped}**\n"
            f"- **Average Batch Pass Rate**: **{avg_pass_rate}%**\n\n"
            f"Navigate to **Scraping History** in the header menu to download individual Excel output files."
        )

        return {
            "reply": reply,
            "suggested_actions": ["📜 View Scraping History", "⚡ Check Live Status", "👥 Total Students"]
        }
    finally:
        db.close()


def execute_total_students(entities: Dict[str, Any]) -> Dict[str, Any]:
    """Handles TOTAL_STUDENTS intent: returns student count filtered by program/branch/semester."""
    branch = entities.get("branch")
    sem = entities.get("semester")
    program = entities.get("program")

    filter_desc = []
    if program: filter_desc.append(f"Program: `{program}`")
    if branch: filter_desc.append(f"Branch: `{branch}`")
    if sem: filter_desc.append(f"Semester: `{sem}`")

    filter_str = (" (" + ", ".join(filter_desc) + ")") if filter_desc else ""

    # Query active runner & Excel files
    excel_files = glob.glob("data/*.xlsx") + glob.glob("data/uploads/*.xlsx")
    total_count = 0
    passed_count = 0
    failed_count = 0

    seen_enrollments = set()

    for fpath in excel_files:
        try:
            wb = load_workbook(fpath, read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            wb.close()
            if not rows or len(rows) < 2: continue

            headers = [str(h).strip().upper() if h else "" for h in rows[0]]
            if "ENROLLMENT" not in headers: continue
            enr_i = headers.index("ENROLLMENT")
            res_i = headers.index("RESULT") if "RESULT" in headers else -1

            for row in rows[1:]:
                if not row or len(row) <= enr_i: continue
                enr = str(row[enr_i] or "").strip().upper()
                if not enr: continue

                # Filter branch if specified
                if branch and f"0105{branch}" not in enr and f"{branch}" not in enr:
                    continue

                if enr not in seen_enrollments:
                    seen_enrollments.add(enr)
                    total_count += 1
                    res_val = str(row[res_i] or "").strip().upper() if res_i >= 0 and len(row) > res_i else "PASS"
                    if "PASS" in res_val: passed_count += 1
                    elif "FAIL" in res_val: failed_count += 1
        except Exception:
            pass

    reply = (
        f"👥 **Total Student Database Count**{filter_str}\n\n"
        f"- **Total Extracted Students**: **{total_count}**\n"
        f"- **Passed Students**: ✅ `{passed_count}`\n"
        f"- **Failed Students**: ❌ `{failed_count}`\n\n"
        f"Type student name or roll number (e.g. `Astha` or `0105IT241001`) to view individual student marksheets."
    )

    return {
        "reply": reply,
        "suggested_actions": ["🔍 Search Student Result", "📊 Job Statistics", "📜 Scraping History"]
    }


def execute_live_status() -> Dict[str, Any]:
    """Calculates live scrape status, speed (students/min), and estimated remaining time (ETA)."""
    job_info = get_live_job_context()
    if not job_info:
        return {
            "reply": "ℹ️ **No Scrape Job Active**: There is currently no scrape job running. You can start a new extraction from the **Result Extractor** tab.",
            "suggested_actions": ["⚡ How to set roll range?", "🔄 Resume from Excel", "📜 View History"]
        }

    st = job_info.get("status", "idle")
    total = job_info.get("total", 0)
    proc = job_info.get("processed", 0)
    pass_c = job_info.get("pass_count", 0)
    fail_c = job_info.get("fail_count", 0)
    not_f = job_info.get("not_found_count", 0)
    err_c = job_info.get("error_count", 0)
    curr = job_info.get("current_enrollment", "")
    path = job_info.get("excel_file_path")

    speed_str = "Calculating..."
    eta_str = "Calculating..."

    start_time = job_info.get("start_time")
    if start_time and proc > 0 and st in ["running", "resumed"]:
        elapsed = max(1.0, time.time() - start_time)
        speed_per_min = round((proc / elapsed) * 60, 1)
        speed_str = f"{speed_per_min} students/min"

        remaining = max(0, total - proc)
        if speed_per_min > 0:
            eta_seconds = int((remaining / speed_per_min) * 60)
            mins, secs = divmod(eta_seconds, 60)
            eta_str = f"{mins}m {secs}s"
        else:
            eta_str = "Done"

    st_badge = "🟢 **Scraping Active**" if st in ["running", "resumed"] else ("⏸️ **Paused**" if st == "paused" else ("✅ **Completed**" if st == "completed" else f"ℹ️ **{st.upper()}**"))
    pct = int((proc / total * 100)) if total > 0 else 0

    reply = (
        f"⚡ **Live Extraction Progress**\n\n"
        f"- **Status**: {st_badge} ({pct}% complete)\n"
        f"- **Progress**: **{proc}** of **{total}** students\n"
        f"- **Processing Speed**: `{speed_str}` | **ETA**: `{eta_str}`\n"
        f"- **Current Roll**: `{curr or 'N/A'}`\n"
        f"- **Results**: ✅ `{pass_c}` Passed | ❌ `{fail_c}` Failed | 🔍 `{not_f}` Not Found | ⚠️ `{err_c}` Errors\n"
        f"{f'- **Output Excel**: `{path}`' if (path and os.path.exists(path)) else ''}"
    )

    return {
        "reply": reply,
        "suggested_actions": ["🔍 Search Student Result", "⏸️ Pause Job", "📜 View History", "🔄 Resume from Excel"]
    }


def execute_scrape_history() -> Dict[str, Any]:
    """Fetches past jobs from SQLite ScrapeJobHistory database table."""
    db = SessionLocal()
    try:
        histories = db.query(ScrapeJobHistory).order_by(ScrapeJobHistory.created_at.desc()).limit(5).all()
        if not histories:
            return {
                "reply": "📜 **Scraping History**: No past extraction jobs found in database.",
                "suggested_actions": ["🚀 Start New Scrape", "❓ Capabilities"]
            }

        rows_md = []
        for h in histories:
            date_str = h.created_at.strftime("%b %d, %H:%M")
            status_icon = "✅" if h.status == "completed" else ("❌" if h.status == "failed" else "⏸️")
            dl_link = f" | [📥 Excel](/api/scrape/download?path={h.excel_file_path})" if h.excel_file_path else ""
            rows_md.append(f"- **{h.job_id}** ({date_str}): Prefix `{h.prefix}` | Sem `{h.sem or 'All'}` | {status_icon} `{h.status}` | Students: **{h.processed_students}/{h.total_students}**{dl_link}")

        reply = (
            f"📜 **Recent Scraping History (SQLite Database)**\n\n" +
            "\n".join(rows_md) +
            f"\n\nNavigate to **Scraping History** in the header to view full records and export options."
        )

        return {
            "reply": reply,
            "suggested_actions": ["⚡ Live Status", "🔍 Search Student Result", "📊 Job Statistics"]
        }
    finally:
        db.close()


def execute_resume_job() -> Dict[str, Any]:
    """Handles job resume trigger guidance and live status check."""
    job_info = get_live_job_context()
    if job_info and job_info.get("status") == "paused":
        return {
            "reply": "⏸️ **Job is currently paused**. Click the **Resume Scrape** button on the dashboard header to continue extraction.",
            "suggested_actions": ["⚡ Check Live Status", "🔍 Search Student Result"]
        }

    return {
        "reply": (
            "🔄 **Resume Scraping (Continue Mode)**\n\n"
            "To resume or extend an existing extraction:\n"
            "1. Go to the **'Resume from Excel'** tab on dashboard.\n"
            "2. Upload your previously extracted `.xlsx` file.\n"
            "3. The system will auto-detect the last student roll number and continue smoothly."
        ),
        "suggested_actions": ["⚡ Live Scrape Status", "📜 View History"]
    }


def execute_export() -> Dict[str, Any]:
    """Handles Excel export guidance and download options."""
    job_info = get_live_job_context()
    path = job_info.get("excel_file_path") if job_info else None

    if path:
        return {
            "reply": f"📊 **Excel Export Available**: The latest extraction file is ready at `{path}`.\nClick below to download or use **Custom Export Studio** to filter columns.",
            "suggested_actions": [f"📥 Download Excel", "📊 Custom Export Studio", "📜 View History"]
        }

    return {
        "reply": (
            "📊 **Custom Export Studio**\n\n"
            "ResultAI allows you to customize Excel columns before exporting:\n"
            "- Filter by Pass/Fail status\n"
            "- Re-order subject columns\n"
            "- Export custom institutional spreadsheets instantly"
        ),
        "suggested_actions": ["📜 View History", "⚡ Check Live Status"]
    }


def execute_capability() -> Dict[str, Any]:
    """Displays supported backend AI actions instead of static welcome message."""
    reply = (
        f"🤖 **ResultAI AI Assistant Capabilities**\n\n"
        f"I am connected directly to your backend database & scraper engine. Here is what I can do:\n\n"
        f"1. 🔍 **Result Lookup**: Type a student name or roll number (e.g. `0105IT241001` or `Astha`).\n"
        f"2. 🆔 **Roll Number Search**: Ask for enrollment numbers (e.g. `Ayush ka roll number`).\n"
        f"3. 🚀 **Natural Language Scrape Starter**: Type e.g. `BTech IT 3 sem 1 se 60 tak nikal do`.\n"
        f"4. 📊 **Scraping Job Statistics**: Ask `kitne jobs complete hai` or `completed jobs`.\n"
        f"5. 👥 **Total Student Database Count**: Ask `total students` or `IT branch me total`.\n"
        f"6. ⚡ **Live Status & Speed/ETA**: Check active extraction progress and speed (students/min).\n"
        f"7. 📜 **Scraping History**: Retrieve past job records from SQLite database.\n"
        f"8. 🔄 **Resume Job**: Continue partial extractions from Excel.\n"
    )

    return {
        "reply": reply,
        "suggested_actions": [
            "⚡ Check Live Scrape Status",
            "🔍 Search Student Result",
            "📊 Job Statistics",
            "👥 Total Students"
        ]
    }


# ═══════════════════════════════════════════════════════════════════════
#  MAIN ROUTER ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@support_router.get("/faq")
def get_faq_categories():
    """Returns structured FAQ categories and quick suggestion prompts."""
    return {
        "categories": [
            {"id": "result_lookup", "title": "Student & Result Search", "icon": "🔍"},
            {"id": "live_status", "title": "Live Scrape & ETA", "icon": "⚡"},
            {"id": "job_stats", "title": "Job Statistics", "icon": "📊"},
            {"id": "history", "title": "Scraping History DB", "icon": "📜"},
            {"id": "troubleshooting", "title": "Errors & Troubleshooting", "icon": "⚠️"}
        ],
        "quick_prompts": [
            "⚡ Live status and speed",
            "📊 Kitne jobs complete hai?",
            "👥 Total students count",
            "🚀 BTech IT 3 sem 1 se 50 tak nikal do",
            "📜 View Scraping History",
            "❓ Assistant capabilities"
        ]
    }


@support_router.post("/chat", response_model=SupportChatResponse)
def handle_support_chat(req: SupportChatRequest):
    """
    Main Intent-First Support Chat endpoint.
    1. Detect Intent FIRST
    2. Extract Intent-Scoped Entities (Strict Name Stop-Word Filtering)
    3. Execute Backend Action Handler
    4. Print Structured Console Debug Logs
    """
    user_query = req.user_query.strip()
    if not user_query:
        raise HTTPException(status_code=400, detail="User query cannot be empty.")

    try:
        norm_text = normalize_text(user_query)

        # Step 1: Detect Intent FIRST
        intent_name, confidence = classify_intent_first(norm_text, user_query, req.messages)

        # Step 2: Extract Intent-Scoped Entities
        entities, ignored_tokens = extract_intent_entities(intent_name, norm_text, user_query)

        # Step 3: Execute Action Handler
        res = None
        handler_name = "execute_capability"

        if intent_name == "RESULT_LOOKUP":
            handler_name = "execute_result_lookup"
            res = execute_result_lookup(entities, user_query)
        elif intent_name == "ROLL_SEARCH":
            handler_name = "execute_roll_search"
            res = execute_roll_search(entities, user_query)
        elif intent_name == "START_EXTRACTION":
            handler_name = "execute_start_extraction"
            res = execute_start_extraction(entities)
        elif intent_name == "JOB_STATS":
            handler_name = "execute_job_stats"
            res = execute_job_stats()
        elif intent_name == "TOTAL_STUDENTS":
            handler_name = "execute_total_students"
            res = execute_total_students(entities)
        elif intent_name == "LIVE_STATUS":
            handler_name = "execute_live_status"
            res = execute_live_status()
        elif intent_name == "HISTORY":
            handler_name = "execute_scrape_history"
            res = execute_scrape_history()
        elif intent_name == "RESUME":
            handler_name = "execute_resume_job"
            res = execute_resume_job()
        elif intent_name == "CANCEL_JOB":
            handler_name = "execute_cancel_job"
            res = execute_cancel_job()
        elif intent_name == "EXPORT":
            handler_name = "execute_export"
            res = execute_export()
        elif intent_name == "CAPABILITY":
            handler_name = "execute_capability"
            res = execute_capability()
        elif intent_name == "HELP":
            handler_name = "execute_capability"
            res = execute_capability()
        else:  # GENERAL_QA / UNKNOWN -> Route to Groq LLM Service
            handler_name = "groq_service.generate_response"
            res = groq_service.generate_response(user_query, req.messages)
            if "suggested_actions" not in res:
                res["suggested_actions"] = ["⚡ Check Live Scrape Status", "🔍 Search Student Result", "❓ Capabilities"]

        # Re-evaluate live job context AFTER action handler execution (to capture newly launched jobs)
        job_info = get_live_job_context()
        live_banner = format_job_banner(job_info)

        # Step 4: Enhanced Console Debug Logging
        log_nlp_pipeline_debug(user_query, norm_text, intent_name, confidence, entities, ignored_tokens, handler_name)

        return SupportChatResponse(
            reply=res["reply"],
            source=res.get("source", "intent_action"),
            intent=intent_name,
            confidence=confidence,
            suggested_actions=res.get("suggested_actions"),
            live_job_banner=live_banner,
            job_id=res.get("job_id") or (live_banner.get("job_id") if live_banner else None),
            is_job_card=res.get("is_job_card") or (intent_name == "START_EXTRACTION")
        )
    except Exception as err:
        print(f"[SupportChat Error] Exception during chat handling: {err}")
        import traceback
        traceback.print_exc()
        job_info = get_live_job_context()
        live_banner = format_job_banner(job_info)
        return SupportChatResponse(
            reply=f"⚠️ **Assistant Handler Notice**: Encountered error processing request: `{err}`",
            source="error_fallback",
            intent="ERROR",
            confidence=0.0,
            suggested_actions=["⚡ Check Live Scrape Status", "🚀 Start Extraction", "📜 View Scraping History"],
            live_job_banner=live_banner,
            job_id=live_banner.get("job_id") if live_banner else None,
            is_job_card=False
        )
