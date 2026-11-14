"""
pdf_parser.py
--------------
PDF parser for marksheets and result documents using pdfplumber and pypdf.
Extracts student metadata, semester info, SGPA/CGPA, and subject records.
"""

import re
import io
from typing import Dict, Any, List, Optional
import pdfplumber
from pypdf import PdfReader


def parse_pdf_file(file_bytes: bytes, filename: str = "") -> Dict[str, Any]:
    """
    Parses a PDF marksheet file and returns extracted student identity,
    semester information, SGPA/CGPA, and subject list.
    """
    text_content = ""
    tables = []

    # 1. Extract text using pypdf as quick fallback
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            text_content += (page.extract_text() or "") + "\n"
    except Exception as e:
        print(f"[pdf_parser] PyPDF warning: {e}")

    # 2. Extract detailed text and tables using pdfplumber
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            plumber_text = ""
            for page in pdf.pages:
                plumber_text += (page.extract_text() or "") + "\n"
                extracted_tables = page.extract_tables()
                if extracted_tables:
                    tables.extend(extracted_tables)
            if plumber_text.strip():
                text_content = plumber_text
    except Exception as e:
        print(f"[pdf_parser] pdfplumber warning: {e}")

    # 3. Parse Metadata (Enrollment, Name, Branch, Program, Semester)
    enrollment = _extract_enrollment(text_content, filename)
    name = _extract_student_name(text_content)
    branch = _extract_branch(text_content, enrollment)
    course = _extract_course(text_content)
    semester_num, semester_title = _extract_semester(text_content, filename)
    sgpa, cgpa = _extract_gpa(text_content)

    # 4. Extract Subjects from Tables or Text Lines
    subjects = _extract_subjects_from_tables(tables)
    if not subjects:
        subjects = _extract_subjects_from_text(text_content)

    return {
        "filename": filename,
        "enrollment": enrollment,
        "name": name,
        "branch": branch,
        "course": course,
        "semester_number": semester_num,
        "semester_title": semester_title,
        "sgpa": sgpa,
        "cgpa": cgpa,
        "subjects": subjects,
        "raw_text": text_content[:1000]
    }


def _extract_enrollment(text: str, filename: str) -> str:
    # Try RGPV / standard enrollment pattern e.g. 0105IT241001 or 0105CS211045 or ENR12345
    m = re.search(r'\b[0-9]{4}[A-Za-z]{2,4}[0-9]{4,6}\b', text)
    if m:
        return m.group(0).upper()

    m_generic = re.search(r'(?:Enrollment|Roll|Enrolment)\s*(?:No|Num|Number)?[:\s\.-]+([A-Za-z0-9]+)', text, re.IGNORECASE)
    if m_generic:
        return m_generic.group(1).upper()

    # Search in filename
    m_fn = re.search(r'\b[0-9]{4}[A-Za-z]{2,4}[0-9]{4,6}\b', filename)
    if m_fn:
        return m_fn.group(0).upper()

    return "UNKNOWN"


def _extract_student_name(text: str) -> str:
    patterns = [
        r"(?:Name|Student Name|Candidate Name|Name of Student)[:\s\.-]+([A-Za-z\s]{3,40})",
        r"NAME\s*:\s*([A-Z\s]{3,40})"
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            clean_name = m.group(1).split("\n")[0].strip()
            # Stop word check
            if len(clean_name) >= 3 and not any(w in clean_name.lower() for w in ["enrollment", "roll", "semester", "branch", "father", "mother"]):
                return clean_name.title()

    return "Unknown Student"


def _extract_branch(text: str, enrollment: str) -> str:
    if "IT" in enrollment:
        return "IT"
    elif "CS" in enrollment or "CSE" in enrollment:
        return "CS"
    elif "ME" in enrollment:
        return "ME"
    elif "EC" in enrollment:
        return "EC"
    elif "CE" in enrollment:
        return "CE"
    elif "EX" in enrollment or "EE" in enrollment:
        return "EE"

    branch_map = {
        "INFORMATION TECHNOLOGY": "IT",
        "COMPUTER SCIENCE": "CS",
        "MECHANICAL": "ME",
        "ELECTRONICS": "EC",
        "CIVIL": "CE",
        "ELECTRICAL": "EE"
    }
    upper_text = text.upper()
    for key, val in branch_map.items():
        if key in upper_text:
            return val

    return "IT"


def _extract_course(text: str) -> str:
    if "B.PHARM" in text.upper() or "PHARMACY" in text.upper():
        return "B.Pharmacy"
    elif "MCA" in text.upper():
        return "MCA"
    elif "M.TECH" in text.upper():
        return "M.Tech"
    elif "MBA" in text.upper():
        return "MBA"
    return "B.Tech."


def _extract_semester(text: str, filename: str) -> tuple:
    # Match patterns like Semester 3, Sem III, 4th Sem, Sem-5, etc.
    combined = f"{filename} {text}"

    # Integer sem pattern
    m1 = re.search(r'(?:Semester|Sem|SEMESTER|SEM)[\s:-]*([1-8])\b', combined, re.IGNORECASE)
    if m1:
        s_num = int(m1.group(1))
        return s_num, f"Semester {s_num}"

    m2 = re.search(r'\b([1-8])(?:st|nd|rd|th)?[\s_-]*(?:Semester|Sem)\b', combined, re.IGNORECASE)
    if m2:
        s_num = int(m2.group(1))
        return s_num, f"Semester {s_num}"

    roman_map = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8}
    m3 = re.search(r'(?:Semester|Sem)[\s:-]*(VIII|VII|VI|V|IV|III|II|I)\b', combined, re.IGNORECASE)
    if m3:
        r_val = m3.group(1).upper()
        if r_val in roman_map:
            s_num = roman_map[r_val]
            return s_num, f"Semester {s_num}"

    return 1, "Semester 1"


def _extract_gpa(text: str) -> tuple:
    sgpa = None
    cgpa = None

    m_sgpa = re.search(r'(?:SGPA|S\.G\.P\.A|Sem GPA)[:\s=]+([0-9]\.[0-9]{1,2})', text, re.IGNORECASE)
    if m_sgpa:
        try:
            sgpa = float(m_sgpa.group(1))
        except (ValueError, TypeError):
            pass

    m_cgpa = re.search(r'(?:CGPA|C\.G\.P\.A|Overall GPA)[:\s=]+([0-9]\.[0-9]{1,2})', text, re.IGNORECASE)
    if m_cgpa:
        try:
            cgpa = float(m_cgpa.group(1))
        except (ValueError, TypeError):
            pass

    return sgpa, cgpa


def _extract_subjects_from_tables(tables: List[List[List[str]]]) -> List[Dict[str, Any]]:
    subjects = []
    grade_tokens = {"O", "A+", "A", "B+", "B", "C", "D", "F", "ABS", "AB", "FAIL", "PASS"}

    for table in tables:
        if not table or len(table) < 2:
            continue

        for row in table:
            if not row or len(row) < 3:
                continue

            row_str = " ".join([str(c or "").strip() for c in row if c])
            if any(h in row_str.upper() for h in ["SUBJECT CODE", "SUB CODE", "CREDIT", "GRADE", "SR.NO", "MAX MARKS"]):
                continue

            # Check if any cell looks like a subject code (e.g. CS301, IT402, BT101)
            code_match = re.search(r'\b[A-Za-z]{2,4}[-_\s]?[0-9]{3,4}[A-Za-z]?\b', row_str)
            if not code_match:
                continue

            code = code_match.group(0).replace(" ", "").replace("-", "").upper()

            # Ignore month/year tokens e.g. JUNE2025, DEC2024, MAY2023
            if any(m in code for m in ["JUNE", "JULY", "DEC", "NOV", "MAY", "APR", "JAN", "FEB", "MAR", "AUG", "SEP", "OCT"]):
                continue

            # Find grade in row cells
            grade = "-"
            marks = None
            credits_val = 4.0
            status = "PASS"

            for cell in row:
                c_clean = str(cell or "").strip().upper()
                if c_clean in grade_tokens:
                    grade = c_clean
                    if grade in ["F", "FAIL", "ABS", "AB"]:
                        status = "FAIL"
                elif c_clean.replace(".", "", 1).isdigit() and float(c_clean) <= 100:
                    val = float(c_clean)
                    if val <= 10.0 and credits_val == 4.0:
                        credits_val = val
                    elif val > 10.0 and marks is None:
                        marks = val

            # Extract subject name if present
            sub_name = code
            for cell in row:
                c_str = str(cell or "").strip()
                if len(c_str) > 4 and not re.match(r'^[0-9.]+$', c_str) and code not in c_str.upper():
                    sub_name = c_str
                    break

            subjects.append({
                "code": code,
                "name": sub_name,
                "credits": credits_val,
                "marks": marks,
                "grade": grade if grade != "-" else ("F" if status == "FAIL" else "A"),
                "status": status
            })

    return subjects


def _extract_subjects_from_text(text: str) -> List[Dict[str, Any]]:
    subjects = []
    lines = text.split("\n")
    for line in lines:
        code_match = re.search(r'\b[A-Za-z]{2,4}[-_\s]?[0-9]{3,4}[A-Za-z]?\b', line)
        if code_match:
            code = code_match.group(0).replace(" ", "").replace("-", "").upper()
            if any(m in code for m in ["JUNE", "JULY", "DEC", "NOV", "MAY", "APR", "JAN", "FEB", "MAR", "AUG", "SEP", "OCT"]):
                continue
            grade_match = re.search(r'\b(O|A\+|A|B\+|B|C|D|F|ABS|FAIL|PASS)\b', line, re.IGNORECASE)
            grade = grade_match.group(1).upper() if grade_match else "A"
            status = "FAIL" if grade in ["F", "FAIL", "ABS"] else "PASS"

            subjects.append({
                "code": code,
                "name": code,
                "credits": 4.0,
                "marks": 75.0 if status == "PASS" else 25.0,
                "grade": grade,
                "status": status
            })

    return subjects
