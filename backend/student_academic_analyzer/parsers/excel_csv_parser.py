"""
excel_csv_parser.py
-------------------
Parses XLSX, XLS, and CSV files containing student academic records.
Supports both single-student multi-subject marksheets and multi-student batch spreadsheets.
"""

import io
import re
import pandas as pd
from openpyxl import load_workbook
from typing import Dict, Any, List, Optional


def parse_excel_csv_file(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Parses an Excel or CSV file and returns a list of student records.
    Each item in the returned list corresponds to a student record:
    {
       "filename": str,
       "is_batch": bool,
       "enrollment": str,
       "name": str,
       "branch": str,
       "course": str,
       "semester_number": int,
       "semester_title": str,
       "sgpa": Optional[float],
       "cgpa": Optional[float],
       "subjects": List[Dict[str, Any]]
    }
    """
    fn_lower = filename.lower()

    if fn_lower.endswith(".csv"):
        try:
            df = pd.read_csv(io.BytesIO(file_bytes))
        except Exception:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="latin-1")
    else:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
        except Exception as e:
            print(f"[excel_csv_parser] pandas read_excel error: {e}")
            return _parse_excel_with_openpyxl(file_bytes, filename)

    if df.empty:
        return []

    return _process_dataframe(df, filename)


def _process_dataframe(df: pd.DataFrame, filename: str) -> List[Dict[str, Any]]:
    df.columns = [str(c).strip().upper() for c in df.columns]
    cols = list(df.columns)

    # Check if batch mode (contains ENROLLMENT column)
    is_enrollment_col = any(c in cols for c in ["ENROLLMENT", "ROLL", "ENROLLMENT_NO", "ROLL_NO", "ENROLLMENT NUMBER"])

    sem_from_fn, sem_title_from_fn = _extract_semester_from_string(filename)

    if is_enrollment_col:
        return _parse_batch_dataframe(df, filename, sem_from_fn, sem_title_from_fn)
    else:
        return [_parse_single_student_dataframe(df, filename, sem_from_fn, sem_title_from_fn)]


def _parse_batch_dataframe(df: pd.DataFrame, filename: str, default_sem: int, default_sem_title: str) -> List[Dict[str, Any]]:
    records = []
    cols = list(df.columns)

    enr_col = next((c for c in ["ENROLLMENT", "ROLL", "ENROLLMENT_NO", "ROLL_NO", "ENROLLMENT NUMBER"] if c in cols), cols[0])
    name_col = next((c for c in ["NAME", "STUDENT_NAME", "CANDIDATE_NAME", "STUDENT NAME"] if c in cols), None)
    res_col = next((c for c in ["RESULT", "STATUS", "FINAL_RESULT"] if c in cols), None)
    sgpa_col = next((c for c in ["SGPA", "S.G.P.A", "SEM_GPA"] if c in cols), None)
    cgpa_col = next((c for c in ["CGPA", "C.G.P.A", "OVERALL_GPA"] if c in cols), None)
    sem_col = next((c for c in ["SEMESTER", "SEM"] if c in cols), None)

    # Subject columns are those not in standard metadata
    skip_cols = {enr_col, name_col, res_col, sgpa_col, cgpa_col, sem_col, "S.NO", "SNO", "SR.NO", "SR_NO", "BRANCH", "COURSE", "FATHER_NAME"}
    subject_cols = [c for c in cols if c and c not in skip_cols and not c.startswith("UNNAMED")]

    for idx, row in df.iterrows():
        enr_val = str(row[enr_col]).strip().upper() if pd.notna(row[enr_col]) else ""
        if not enr_val or enr_val == "NAN" or "TOTAL" in enr_val:
            continue

        name_val = str(row[name_col]).strip().title() if (name_col and pd.notna(row[name_col])) else "Unknown Student"
        res_val = str(row[res_col]).strip().upper() if (res_col and pd.notna(row[res_col])) else "PASS"

        sgpa = float(row[sgpa_col]) if (sgpa_col and pd.notna(row[sgpa_col]) and str(row[sgpa_col]).replace(".", "", 1).isdigit()) else None
        cgpa = float(row[cgpa_col]) if (cgpa_col and pd.notna(row[cgpa_col]) and str(row[cgpa_col]).replace(".", "", 1).isdigit()) else None

        sem_num = default_sem
        sem_title = default_sem_title
        if sem_col and pd.notna(row[sem_col]):
            s_val = str(row[sem_col]).strip()
            s_parsed, st_parsed = _extract_semester_from_string(s_val)
            if s_parsed:
                sem_num = s_parsed
                sem_title = st_parsed

        branch = "IT"
        if "IT" in enr_val: branch = "IT"
        elif "CS" in enr_val or "CSE" in enr_val: branch = "CS"
        elif "ME" in enr_val: branch = "ME"
        elif "EC" in enr_val: branch = "EC"
        elif "CE" in enr_val: branch = "CE"

        subjects = []
        for code in subject_cols:
            val = str(row[code]).strip().upper() if pd.notna(row[code]) else "-"
            if val in ["", "NAN", "-"]:
                continue

            status = "FAIL" if val in ["F", "FAIL", "ABS", "AB", "RL"] else "PASS"
            grade = val if val in ["O", "A+", "A", "B+", "B", "C", "D", "F", "ABS"] else ("F" if status == "FAIL" else "A")

            subjects.append({
                "code": code.replace("-", "").replace(" ", "").upper(),
                "name": code,
                "credits": 4.0,
                "marks": 75.0 if status == "PASS" else 25.0,
                "grade": grade,
                "status": status
            })

        records.append({
            "filename": filename,
            "is_batch": True,
            "enrollment": enr_val,
            "name": name_val,
            "branch": branch,
            "course": "B.Tech.",
            "semester_number": sem_num,
            "semester_title": sem_title,
            "sgpa": sgpa,
            "cgpa": cgpa,
            "subjects": subjects
        })

    return records


def _parse_single_student_dataframe(df: pd.DataFrame, filename: str, sem_from_fn: int, sem_title_from_fn: str) -> Dict[str, Any]:
    # Parse marksheets structured row-by-row (Code, Subject Name, Credits, Grade, Marks)
    subjects = []
    cols = list(df.columns)

    code_col = next((c for c in cols if any(k in c for k in ["CODE", "SUB_CODE", "SUBJECT_CODE"])), None)
    name_col = next((c for c in cols if any(k in c for k in ["NAME", "SUB_NAME", "SUBJECT", "TITLE"])), None)
    grade_col = next((c for c in cols if any(k in c for k in ["GRADE", "MARK_GRADE"])), None)
    credit_col = next((c for c in cols if any(k in c for k in ["CREDIT", "CREDITS"])), None)
    marks_col = next((c for c in cols if any(k in c for k in ["MARKS", "OBTAINED", "TOTAL"])), None)

    for idx, row in df.iterrows():
        c_val = str(row[code_col]).strip().upper() if (code_col and pd.notna(row[code_col])) else ""
        if not c_val or c_val == "NAN":
            continue

        n_val = str(row[name_col]).strip() if (name_col and pd.notna(row[name_col])) else c_val
        g_val = str(row[grade_col]).strip().upper() if (grade_col and pd.notna(row[grade_col])) else "A"
        cr_val = float(row[credit_col]) if (credit_col and pd.notna(row[credit_col]) and str(row[credit_col]).replace(".", "", 1).isdigit()) else 4.0
        m_val = float(row[marks_col]) if (marks_col and pd.notna(row[marks_col]) and str(row[marks_col]).replace(".", "", 1).isdigit()) else None

        status = "FAIL" if g_val in ["F", "FAIL", "ABS", "AB"] else "PASS"

        subjects.append({
            "code": c_val.replace(" ", "").replace("-", ""),
            "name": n_val,
            "credits": cr_val,
            "marks": m_val,
            "grade": g_val if g_val != "NAN" else "A",
            "status": status
        })

    enr_match = re.search(r'\b[0-9]{4}[A-Za-z]{2,4}[0-9]{4,6}\b', filename)
    enr = enr_match.group(0).upper() if enr_match else "UNKNOWN"

    return {
        "filename": filename,
        "is_batch": False,
        "enrollment": enr,
        "name": "Student Record",
        "branch": "IT",
        "course": "B.Tech.",
        "semester_number": sem_from_fn,
        "semester_title": sem_title_from_fn,
        "sgpa": None,
        "cgpa": None,
        "subjects": subjects
    }


def _parse_excel_with_openpyxl(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    try:
        wb = load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        wb.close()
        if not rows or len(rows) < 2:
            return []

        headers = [str(h or "").strip().upper() for h in rows[0]]
        df = pd.DataFrame(rows[1:], columns=headers)
        return _process_dataframe(df, filename)
    except Exception as err:
        print(f"[excel_csv_parser] openpyxl error: {err}")
        return []


def _extract_semester_from_string(text: str) -> tuple:
    m = re.search(r'(?:Semester|Sem|SEM)[\s_-]*([1-8])\b', text, re.IGNORECASE)
    if m:
        s_num = int(m.group(1))
        return s_num, f"Semester {s_num}"

    m2 = re.search(r'\b([1-8])(?:st|nd|rd|th)?[\s_-]*(?:Semester|Sem)\b', text, re.IGNORECASE)
    if m2:
        s_num = int(m2.group(1))
        return s_num, f"Semester {s_num}"

    return 1, "Semester 1"
