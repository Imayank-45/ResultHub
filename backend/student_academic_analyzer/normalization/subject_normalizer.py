"""
subject_normalizer.py
---------------------
Normalizes subject names, codes, grades, and assigns subject categories.
Preserves original values alongside normalized values.
"""

import re
from typing import Dict, Any, Tuple

CATEGORY_RULES = [
    ("Programming", ["PYTHON", "JAVA", "C++", "PROGRAMMING", "DATA STRUCTURE", "ALGORITHM", "COMPILER", "OBJECT ORIENTED", "OOP", "WEB", "SOFTWARE"]),
    ("Mathematics", ["MATHEMATICS", "MATH", "CALCULUS", "DISCRETE", "PROBABILITY", "STATISTICS", "NUMERICAL", "ALGEBRA"]),
    ("Database", ["DATABASE", "DBMS", "SQL", "DATA MINING", "DATA WAREHOUSE", "BIG DATA"]),
    ("Networking", ["NETWORK", "NETWORKING", "CLOUD", "CYBER", "SECURITY", "COMMUNICATION", "INTERNET", "IOT"]),
    ("Electronics", ["ELECTRONICS", "DIGITAL", "MICROPROCESSOR", "CIRCUIT", "SIGNAL", "EMBEDDED", "VLSI", "ANALOG"]),
    ("Management", ["MANAGEMENT", "ECONOMICS", "ETHICS", "ENTREPRENEURSHIP", "ORGANIZATIONAL", "PROJECT MANAGEMENT", "FINANCE"]),
    ("Core Engineering", ["MECHANICAL", "THERMODYNAMICS", "FLUID", "CIVIL", "STRUCTURE", "ENVIRONMENTAL", "ELECTRICAL", "POWER SYSTEM", "MACHINE"])
]

NAME_STANDARDIZATION_MAP = {
    "DATA STRUCTURE": "Data Structures",
    "DATA STRUCTURES": "Data Structures",
    "DATA STRUCTURE AND ALGORITHMS": "Data Structures & Algorithms",
    "DATA STRUCTURES & ALGORITHMS": "Data Structures & Algorithms",
    "DATABASE MANAGEMENT SYSTEM": "Database Management Systems",
    "DATABASE MANAGEMENT SYSTEMS": "Database Management Systems",
    "DBMS": "Database Management Systems",
    "OBJECT ORIENTED PROGRAMMING": "Object Oriented Programming",
    "OOPS": "Object Oriented Programming",
    "DISCRETE MATHEMATICS": "Discrete Mathematics",
    "COMPUTER NETWORKS": "Computer Networks",
    "OPERATING SYSTEM": "Operating Systems",
    "OPERATING SYSTEMS": "Operating Systems",
    "SOFTWARE ENGINEERING": "Software Engineering",
    "THEORY OF COMPUTATION": "Theory of Computation",
    "COMPILER DESIGN": "Compiler Design"
}

SUBJECT_CODE_NAME_MAP = {
    "BT101": "Engineering Mathematics-I",
    "BT102": "Engineering Physics",
    "BT103": "Engineering Chemistry",
    "BT104": "Basic Electrical & Electronics Engg.",
    "BT105": "Engineering Graphics",
    "BT201": "Engineering Mathematics-II",
    "BT202": "Basic Mechanical Engineering",
    "BT203": "Basic Civil Engineering & Mechanics",
    "BT204": "Basic Computer Engineering",
    "BT205": "Language Lab & Seminars",
    "ES301": "Energy & Environmental Engineering",
    "CS301": "Data Structures",
    "CS302": "Discrete Structure",
    "CS303": "Object Oriented Programming & Methodology",
    "CS304": "Digital Circuits & Systems",
    "IT301": "Data Structures",
    "IT302": "Discrete Structure",
    "IT303": "Object Oriented Programming & Methodology",
    "IT304": "Digital Circuits & Systems",
    "CS401": "Operating Systems",
    "CS402": "Analysis & Design of Algorithms",
    "CS403": "Software Engineering",
    "CS404": "Theory of Computation",
    "IT401": "Operating Systems",
    "IT402": "Database Management Systems",
    "IT403": "Software Engineering"
}


def normalize_subject_record(raw_subject: Dict[str, Any]) -> Dict[str, Any]:
    raw_code = str(raw_subject.get("code") or "").strip()
    raw_name = str(raw_subject.get("name") or "").strip()
    raw_grade = str(raw_subject.get("grade") or "-").strip().upper()
    raw_credits = raw_subject.get("credits")

    # Normalize Code
    norm_code = re.sub(r'[^A-Za-z0-9]', '', raw_code).upper()
    if not norm_code:
        norm_code = "SUB"

    # Clean & Normalize Name
    clean_name_upper = raw_name.upper().strip()
    has_header_garbage = any(w in clean_name_upper for w in ["EXAMINATION", "BACHELOR OF TECHNOLOGY", "ROLL NO", "INSTT.", "SEMESTER :", "STATUS :", "RESULT :", "ENGLISH FOR COMMUNICATION"])

    if norm_code in SUBJECT_CODE_NAME_MAP:
        norm_name = SUBJECT_CODE_NAME_MAP[norm_code]
    elif has_header_garbage or len(raw_name) > 45:
        # Extract first 40 clean characters if no direct code mapping
        norm_name = re.sub(r'\s+', ' ', raw_name)[:40].strip().title()
        if not norm_name or has_header_garbage:
            norm_name = f"Subject {norm_code}"
    else:
        norm_name = NAME_STANDARDIZATION_MAP.get(clean_name_upper, raw_name.title() if raw_name else norm_code)

    # Category Determination
    category = _determine_category(norm_name, norm_code)

    # Normalize Grade and Status
    norm_grade, status = _normalize_grade_and_status(raw_grade)

    # Normalize Credits
    try:
        norm_credits = float(raw_credits) if raw_credits is not None else 4.0
    except (ValueError, TypeError):
        norm_credits = 4.0

    return {
        "code": norm_code,
        "name": norm_name,
        "credits": norm_credits,
        "marks": raw_subject.get("marks"),
        "grade": norm_grade,
        "status": status,
        "original_code": raw_code,
        "original_name": raw_name,
        "category": category,
        "attempts": raw_subject.get("attempts", [])
    }


def _determine_category(name: str, code: str) -> str:
    combined = f"{name} {code}".upper()
    for category_name, keywords in CATEGORY_RULES:
        if any(kw in combined for kw in keywords):
            return category_name
    return "Other / Uncategorized"


def _normalize_grade_and_status(grade_str: str) -> Tuple[str, str]:
    g = grade_str.strip().upper()

    if g in ["O", "A+", "A", "B+", "B", "C", "D", "P", "PASS"]:
        return (g if g != "PASS" else "A"), "PASS"
    elif g in ["F", "FAIL", "ABS", "AB", "RL"]:
        return (g if g in ["F", "ABS"] else "F"), "FAIL"
    else:
        return "A", "PASS"
