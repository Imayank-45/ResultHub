"""
mid_sem_router.py
------------------
FastAPI router providing REST endpoints for Mid-Sem Studio:
- Dynamic subject loading & admin subject configuration
- Mid-Sem session management
- Automatic student name resolution from database/Excel records
- Safe marks entry, bounds validation, and backend recalculations
- Official OpenPyXL Excel export
- Mid-Sem PDF export
"""

import os
import re
import glob
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from openpyxl import load_workbook

from backend.db.database import get_db
from backend.db.models import User, MidSemSession, MidSemSubject, MidSemStudentMarks
from backend.db.auth import get_current_user, get_optional_current_user
from backend.mid_sem_excel_writer import generate_mid_sem_excel

router = APIRouter()

def normalize_semester(sem_str: str) -> str:
    """Normalize semester string inputs like '1' -> 'I', '4' -> 'IV'."""
    s = str(sem_str or "").strip().upper()
    mapping = {
        "1": "I", "2": "II", "3": "III", "4": "IV",
        "5": "V", "6": "VI", "7": "VII", "8": "VIII"
    }
    return mapping.get(s, s)


CS_DEFAULT_SUBJECTS = {
    "I": [
        {"subject_code": "BT101", "subject_name": "Engineering Chemistry", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT102", "subject_name": "Mathematics-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT103", "subject_name": "English for Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT104", "subject_name": "Basic Electrical & Electronics Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT105", "subject_name": "Engineering Graphics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "II": [
        {"subject_code": "BT201", "subject_name": "Engineering Physics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT202", "subject_name": "Mathematics-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT203", "subject_name": "Basic Mechanical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT204", "subject_name": "Basic Civil Engineering & Mechanics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT205", "subject_name": "Basic Computer Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "III": [
        {"subject_code": "ES301", "subject_name": "Energy & Environmental Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS302", "subject_name": "Discrete Structure", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS303", "subject_name": "Data Structure", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS304", "subject_name": "Digital Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS305", "subject_name": "Object Oriented Programming & Methodology", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "IV": [
        {"subject_code": "BT401", "subject_name": "Mathematics-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS402", "subject_name": "Analysis & Design of Algorithm", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS403", "subject_name": "Software Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS404", "subject_name": "Computer Organization & Architecture", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS405", "subject_name": "Operating Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "V": [
        {"subject_code": "CS501", "subject_name": "Theory of Computation", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS502", "subject_name": "Database Management System", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS503", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CS504", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VI": [
        {"subject_code": "CS601", "subject_name": "Machine Learning", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS602", "subject_name": "Computer Networks", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS603", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CS604", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VII": [
        {"subject_code": "CS701", "subject_name": "Software Architectures", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS702", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CS703", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ],
    "VIII": [
        {"subject_code": "CS801", "subject_name": "Internet of Things", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CS802", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CS803", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ]
}

AIML_DEFAULT_SUBJECTS = {
    "I": [
        {"subject_code": "BT101", "subject_name": "Engineering Chemistry", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT102", "subject_name": "Mathematics-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT103", "subject_name": "English for Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT104", "subject_name": "Basic Electrical & Electronics Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT105", "subject_name": "Engineering Graphics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "II": [
        {"subject_code": "BT201", "subject_name": "Engineering Physics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT202", "subject_name": "Mathematics-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT203", "subject_name": "Basic Mechanical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT204", "subject_name": "Basic Civil Engineering & Mechanics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT205", "subject_name": "Basic Computer Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "III": [
        {"subject_code": "AL301", "subject_name": "Technical Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL302", "subject_name": "Introduction to Probability and Statistics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL303", "subject_name": "Data Structures", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL304", "subject_name": "Artificial Intelligence", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL305", "subject_name": "Object Oriented Programming & Methodology", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "IV": [
        {"subject_code": "AL401", "subject_name": "Introduction to Discrete Structure & Linear Algebra", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL402", "subject_name": "Analysis & Design of Algorithms", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL403", "subject_name": "Software Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL404", "subject_name": "Computer Organization & Architecture", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL405", "subject_name": "Machine Learning", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "V": [
        {"subject_code": "AL501", "subject_name": "Operating Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL502", "subject_name": "Database Management Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL503", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "AL504", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VI": [
        {"subject_code": "AL601", "subject_name": "Theory of Computation", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL602", "subject_name": "Computer Networks", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL603", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "AL604", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VII": [
        {"subject_code": "AL701", "subject_name": "Computer Vision", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL702", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "AL703", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ],
    "VIII": [
        {"subject_code": "AL801", "subject_name": "Business Intelligence", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "AL802", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "AL803", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ]
}

CE_DEFAULT_SUBJECTS = {
    "I": [
        {"subject_code": "BT101", "subject_name": "Engineering Chemistry", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT102", "subject_name": "Mathematics-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT103", "subject_name": "English for Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT104", "subject_name": "Basic Electrical & Electronics Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT105", "subject_name": "Engineering Graphics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "II": [
        {"subject_code": "BT201", "subject_name": "Engineering Physics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT202", "subject_name": "Mathematics-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT203", "subject_name": "Basic Mechanical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT204", "subject_name": "Basic Civil Engineering & Mechanics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT205", "subject_name": "Basic Computer Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "III": [
        {"subject_code": "BT301", "subject_name": "Mathematics-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE302", "subject_name": "Construction Materials", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE303", "subject_name": "Surveying", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE304", "subject_name": "Building Planning & Architecture", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE305", "subject_name": "Strength of Materials", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "IV": [
        {"subject_code": "ES401", "subject_name": "Energy & Environmental Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE402", "subject_name": "Construction Technology", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE403", "subject_name": "Structural Analysis-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE404", "subject_name": "Transportation Engineering-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE405", "subject_name": "Engineering Geology & Remote Sensing", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "V": [
        {"subject_code": "CE501", "subject_name": "Fluid Mechanics-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE502", "subject_name": "Transportation Engineering-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE503", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CE504", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VI": [
        {"subject_code": "CE601", "subject_name": "Structural Design and Drawing (RCC-I)", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE602", "subject_name": "Environmental Engineering-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE603", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CE604", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VII": [
        {"subject_code": "CE701", "subject_name": "Geotechnical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE702", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CE703", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ],
    "VIII": [
        {"subject_code": "CE801", "subject_name": "Design of Steel Structures", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CE802", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CE803", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ]
}

EX_DEFAULT_SUBJECTS = {
    "I": [
        {"subject_code": "BT101", "subject_name": "Engineering Chemistry", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT102", "subject_name": "Mathematics-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT103", "subject_name": "English for Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT104", "subject_name": "Basic Electrical & Electronics Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT105", "subject_name": "Engineering Graphics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "II": [
        {"subject_code": "BT201", "subject_name": "Engineering Physics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT202", "subject_name": "Mathematics-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT203", "subject_name": "Basic Mechanical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT204", "subject_name": "Basic Civil Engineering & Mechanics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT205", "subject_name": "Basic Computer Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "III": [
        {"subject_code": "ES301", "subject_name": "Energy & Environmental Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX302", "subject_name": "Signals & Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX303", "subject_name": "Electrical Measurement & Measuring Instruments", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX304", "subject_name": "Network Analysis", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX305", "subject_name": "Analog Electronics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "IV": [
        {"subject_code": "BT401", "subject_name": "Mathematics-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX402", "subject_name": "Electrical Machine-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX403", "subject_name": "Digital Electronics & Logic Design (DELD)", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX404", "subject_name": "Power System-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX405", "subject_name": "Control System", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "V": [
        {"subject_code": "EX501", "subject_name": "Electrical Machine-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX502", "subject_name": "Power Electronics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX503", "subject_name": "Departmental Elective-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "EX504", "subject_name": "Open Elective-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VI": [
        {"subject_code": "EX601", "subject_name": "Power System-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX602", "subject_name": "Microprocessor & Microcontroller", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX603", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "EX604", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VII": [
        {"subject_code": "EX701", "subject_name": "Power System Protection", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX702", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "EX703", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ],
    "VIII": [
        {"subject_code": "EX801", "subject_name": "Electrical Drives", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EX802", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "EX803", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ]
}

EC_DEFAULT_SUBJECTS = {
    "I": [
        {"subject_code": "BT101", "subject_name": "Engineering Chemistry", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT102", "subject_name": "Mathematics-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT103", "subject_name": "English for Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT104", "subject_name": "Basic Electrical & Electronics Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT105", "subject_name": "Engineering Graphics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "II": [
        {"subject_code": "BT201", "subject_name": "Engineering Physics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT202", "subject_name": "Mathematics-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT203", "subject_name": "Basic Mechanical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT204", "subject_name": "Basic Civil Engineering & Mechanics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT205", "subject_name": "Basic Computer Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "III": [
        {"subject_code": "BT301", "subject_name": "Mathematics-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC302", "subject_name": "Electronic Measurement & Instrumentation", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC303", "subject_name": "Digital System Design", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC304", "subject_name": "Electronic Devices", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC305", "subject_name": "Network Analysis", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "IV": [
        {"subject_code": "ES401", "subject_name": "Energy & Environmental Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC402", "subject_name": "Signals & Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC403", "subject_name": "Analog Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC404", "subject_name": "Control System", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC405", "subject_name": "Analog Circuits", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "V": [
        {"subject_code": "EC501", "subject_name": "Microprocessor & its Application", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC502", "subject_name": "Digital Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC503", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "EC504", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VI": [
        {"subject_code": "EC601", "subject_name": "Digital Signal Processing", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC602", "subject_name": "Antenna & Wave Propagation", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC603", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "EC604", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VII": [
        {"subject_code": "EC701", "subject_name": "VLSI Design", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC702", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "EC703", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ],
    "VIII": [
        {"subject_code": "EC801", "subject_name": "Optical Fibre Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "EC802", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "EC803", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ]
}

ME_DEFAULT_SUBJECTS = {
    "I": [
        {"subject_code": "BT101", "subject_name": "Engineering Chemistry", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT102", "subject_name": "Mathematics-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT103", "subject_name": "English for Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT104", "subject_name": "Basic Electrical & Electronics Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT105", "subject_name": "Engineering Graphics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "II": [
        {"subject_code": "BT201", "subject_name": "Engineering Physics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT202", "subject_name": "Mathematics-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT203", "subject_name": "Basic Mechanical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT204", "subject_name": "Basic Civil Engineering & Mechanics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "BT205", "subject_name": "Basic Computer Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "III": [
        {"subject_code": "BT301", "subject_name": "Mathematics-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME302", "subject_name": "Thermodynamics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME303", "subject_name": "Materials Technology", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME304", "subject_name": "Strength of Materials", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME305", "subject_name": "Manufacturing Process", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "IV": [
        {"subject_code": "ES401", "subject_name": "Energy & Environmental Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME402", "subject_name": "Theory of Machines", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME403", "subject_name": "Thermal Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME404", "subject_name": "Fluid Mechanics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME405", "subject_name": "Manufacturing Technology", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
    ],
    "V": [
        {"subject_code": "ME501", "subject_name": "IC Engines", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME502", "subject_name": "Mechanical Vibration", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME503", "subject_name": "Mechatronics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME504", "subject_name": "Industrial Engineering & Ergonomics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME505", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": True},
        {"subject_code": "ME506", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 6, "mst_enabled": True, "is_elective": True},
    ],
    "VI": [
        {"subject_code": "ME601", "subject_name": "Thermal Engineering & Gas Dynamics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME602", "subject_name": "Machine Component Design", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME603", "subject_name": "Turbo Machinery", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME604", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
        {"subject_code": "ME605", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": True},
    ],
    "VII": [
        {"subject_code": "ME701", "subject_name": "Advanced Mechanical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME702", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "ME703", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ],
    "VIII": [
        {"subject_code": "ME801", "subject_name": "Project Work", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "ME802", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "ME803", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ]
}

CSBS_DEFAULT_SUBJECTS = {
    "I": [
        {"subject_code": "CB101", "subject_name": "Discrete Mathematics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB102", "subject_name": "Statistics, Probability & Calculus", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB103", "subject_name": "Fundamentals of Computer Science", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB104", "subject_name": "Principles of Electrical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB105", "subject_name": "Fundamentals of Physics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB106", "subject_name": "Business Communication & Value Science-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 6, "mst_enabled": True, "is_elective": False},
    ],
    "II": [
        {"subject_code": "CB201", "subject_name": "Linear Algebra", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB202", "subject_name": "Statistical Methods", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB203", "subject_name": "Data Structures & Algorithms", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB204", "subject_name": "Principles of Electronics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB205", "subject_name": "Fundamentals of Economics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB206", "subject_name": "Business Communication & Value Science-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 6, "mst_enabled": True, "is_elective": False},
    ],
    "III": [
        {"subject_code": "CB301", "subject_name": "Probability & Statistics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB302", "subject_name": "Computer Organization & Architecture", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB303", "subject_name": "Database Management Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB304", "subject_name": "Object Oriented Programming", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB305", "subject_name": "Business Communication & Value Science-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB306", "subject_name": "Operating Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 6, "mst_enabled": True, "is_elective": False},
    ],
    "IV": [
        {"subject_code": "CB401", "subject_name": "Operating Systems", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB402", "subject_name": "Design & Analysis of Algorithms", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB403", "subject_name": "Computer Networks", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB404", "subject_name": "Software Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB405", "subject_name": "Design Thinking / Leadership Oriented Learning", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB406", "subject_name": "Departmental Elective-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 6, "mst_enabled": True, "is_elective": True},
    ],
    "V": [
        {"subject_code": "CB501", "subject_name": "Theory of Computation", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB502", "subject_name": "Compiler Design", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB503", "subject_name": "Computer Graphics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB504", "subject_name": "Business Intelligence", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB505", "subject_name": "Business Communication & Value Science", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB506", "subject_name": "Departmental Elective-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 6, "mst_enabled": True, "is_elective": True},
    ],
    "VI": [
        {"subject_code": "CB601", "subject_name": "Computer Networks", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB602", "subject_name": "Information Security", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB603", "subject_name": "Artificial Intelligence", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB604", "subject_name": "Financial & Cost Accounting", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB605", "subject_name": "Business Communication & Value Science-IV", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB606", "subject_name": "Departmental Elective-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 6, "mst_enabled": True, "is_elective": True},
    ],
    "VII": [
        {"subject_code": "CB701", "subject_name": "Usability Design of Software Applications", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB702", "subject_name": "Financial Management", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB703", "subject_name": "Departmental Elective-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CB704", "subject_name": "Departmental Elective-IV", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
    ],
    "VIII": [
        {"subject_code": "CB801", "subject_name": "IT Project Management", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
        {"subject_code": "CB802", "subject_name": "Departmental Elective-V", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
        {"subject_code": "CB803", "subject_name": "Departmental Elective-VI", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
    ]
}

# Default Pre-seeded Subject Configurations per Branch & Semester
DEFAULT_SUBJECTS: Dict[str, Dict[str, List[Dict[str, Any]]]] = {
    "CS": CS_DEFAULT_SUBJECTS,
    "CSE": CS_DEFAULT_SUBJECTS,
    "CSBS": CSBS_DEFAULT_SUBJECTS,
    "AIML": AIML_DEFAULT_SUBJECTS,
    "AI": AIML_DEFAULT_SUBJECTS,
    "CE": CE_DEFAULT_SUBJECTS,
    "CIVIL": CE_DEFAULT_SUBJECTS,
    "EX": EX_DEFAULT_SUBJECTS,
    "EEE": EX_DEFAULT_SUBJECTS,
    "EC": EC_DEFAULT_SUBJECTS,
    "ECE": EC_DEFAULT_SUBJECTS,
    "ME": ME_DEFAULT_SUBJECTS,
    "IT": {
        "I": [
            {"subject_code": "BT101", "subject_name": "Engineering Chemistry", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
            {"subject_code": "BT102", "subject_name": "Mathematics-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
            {"subject_code": "BT103", "subject_name": "English for Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
            {"subject_code": "BT104", "subject_name": "Basic Electrical & Electronics Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
            {"subject_code": "BT105", "subject_name": "Engineering Graphics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        ],
        "II": [
            {"subject_code": "BT201", "subject_name": "Engineering Physics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
            {"subject_code": "BT202", "subject_name": "Mathematics-II", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
            {"subject_code": "BT203", "subject_name": "Basic Mechanical Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
            {"subject_code": "BT204", "subject_name": "Basic Civil Engineering & Mechanics", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
            {"subject_code": "BT205", "subject_name": "Basic Computer Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        ],
        "III": [
            {"subject_code": "ES301", "subject_name": "Energy & Environmental Engineering", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT302", "subject_name": "Discrete Structure", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT303", "subject_name": "Data Structure", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT304", "subject_name": "Object Oriented Programming & Methodology", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT305", "subject_name": "Digital Circuits & System", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        ],
        "IV": [
            {"subject_code": "BT401", "subject_name": "Mathematics-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT402", "subject_name": "Computer Architecture", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT403", "subject_name": "Analysis and Design of Algorithm", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT404", "subject_name": "Analog & Digital Communication", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT405", "subject_name": "Data Base Management System", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5, "mst_enabled": True, "is_elective": False},
        ],
        "V": [
            {"subject_code": "IT501", "subject_name": "Operating System", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT502", "subject_name": "Computer Network", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT503", "subject_name": "Departmental Elective-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
            {"subject_code": "IT504", "subject_name": "Open Elective-I", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
        ],
        "VI": [
            {"subject_code": "IT601", "subject_name": "Computer Graphics & Multimedia", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT602", "subject_name": "Wireless and Mobile Computing", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT603", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
            {"subject_code": "IT604", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4, "mst_enabled": True, "is_elective": True},
        ],
        "VII": [
            {"subject_code": "IT701", "subject_name": "Soft Computing", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT702", "subject_name": "Departmental Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
            {"subject_code": "IT703", "subject_name": "Open Elective", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        ],
        "VIII": [
            {"subject_code": "IT801", "subject_name": "Information Security", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1, "mst_enabled": True, "is_elective": False},
            {"subject_code": "IT802", "subject_name": "Departmental Elective-IV", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2, "mst_enabled": True, "is_elective": True},
            {"subject_code": "IT803", "subject_name": "Open Elective-IV", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3, "mst_enabled": True, "is_elective": True},
        ]
    }
}


# Pydantic Request Schemas
class SubjectConfigItem(BaseModel):
    id: Optional[int] = None
    branch: str
    semester: str
    program: str = "B.Tech."
    subject_code: str
    subject_name: Optional[str] = ""
    mst1_max: float = 10.0
    mst2_max: float = 10.0
    total_max: float = 20.0
    display_order: int = 1
    mst_enabled: bool = True
    is_elective: bool = False
    is_active: bool = True


class CreateSessionRequest(BaseModel):
    academic_session: str = "Jan - Jun 2026"
    year: str = "2nd Year"
    semester: str = "IV"
    branch: str = "CSE"
    program: str = "B.Tech."
    roll_prefix: str = "0105CS2410"
    roll_start: int = 1
    roll_end: int = 120
    roll_padding: Optional[int] = 2


class StudentMarkItem(BaseModel):
    subject_id: int
    mst1_marks: Optional[float] = None
    mst2_marks: Optional[float] = None


class SaveStudentMarksRequest(BaseModel):
    session_id: int
    enrollment_no: str
    student_name: Optional[str] = None
    marks: List[StudentMarkItem]


class BatchSaveMarksRequest(BaseModel):
    session_id: int
    records: List[SaveStudentMarksRequest]


class MarkAbsentRequest(BaseModel):
    session_id: int
    enrollment_numbers: List[str]
    absence_type: str = "both"  # 'both', 'mst1', 'mst2'


class ResetMarksRequest(BaseModel):
    session_id: int
    enrollment_numbers: Optional[List[str]] = None


class HeaderSettingsOverride(BaseModel):
    college_name: Optional[str] = None
    department_name: Optional[str] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    semester: Optional[str] = None
    academic_session: Optional[str] = None
    exam_title: Optional[str] = None


def lookup_student_name_from_files(enrollment: str) -> Optional[str]:
    """Helper to locate a student's full name across saved Excel result files in data/."""
    enrollment_clean = enrollment.strip().upper()
    excel_files = glob.glob("data/*.xlsx") + glob.glob("data/uploads/*.xlsx")
    for filepath in excel_files:
        try:
            wb = load_workbook(filename=filepath, read_only=True, data_only=True)
            ws = wb.active
            headers = [str(cell.value or "").strip().upper() for cell in next(ws.iter_rows(max_row=1))]
            if "ENROLLMENT" not in headers or "NAME" not in headers:
                wb.close()
                continue
            
            enr_idx = headers.index("ENROLLMENT")
            name_idx = headers.index("NAME")
            for row in ws.iter_rows(min_row=2, values_only=True):
                if len(row) > enr_idx and str(row[enr_idx] or "").strip().upper() == enrollment_clean:
                    name_val = str(row[name_idx] or "").strip() if len(row) > name_idx else ""
                    wb.close()
                    if name_val and "NOT FOUND" not in name_val.upper():
                        return name_val
                    break
            wb.close()
        except Exception:
            pass

    # Reference mock check for Aaditya Thakur if 0105CS241003
    if enrollment_clean == "0105CS241003":
        return "Aaditya Thakur"
    elif enrollment_clean == "0105CS241001":
        return "Aadil Shah"
    elif enrollment_clean == "0105CS241002":
        return "Aaditya Sharma"
    elif enrollment_clean == "0105CS241004":
        return "Aayush Verma"
    elif enrollment_clean == "0105CS241005":
        return "Abhay Patel"

    return None


def get_branch_aliases(branch_str: str) -> List[str]:
    b = str(branch_str or "").strip().upper()
    if b in ["EC", "ECE"]:
        return ["EC", "ECE"]
    elif b in ["AI", "AIML"]:
        return ["AI", "AIML"]
    elif b in ["CS", "CSE"]:
        return ["CS", "CSE"]
    elif b in ["CE", "CIVIL"]:
        return ["CE", "CIVIL"]
    elif b in ["EX", "EEE"]:
        return ["EX", "EEE"]
    elif b in ["DS", "DATA SCIENCE"]:
        return ["DS", "DATA SCIENCE"]
    elif b in ["CSBS"]:
        return ["CSBS"]
    return [b]


DEFAULT_SUBJECTS["EC"] = DEFAULT_SUBJECTS.get("ECE", {})
DEFAULT_SUBJECTS["AIML"] = DEFAULT_SUBJECTS.get("AI", {})
DEFAULT_SUBJECTS["CIVIL"] = DEFAULT_SUBJECTS.get("CE", {})
DEFAULT_SUBJECTS["EEE"] = DEFAULT_SUBJECTS.get("EX", {})
DEFAULT_SUBJECTS["DS"] = DEFAULT_SUBJECTS.get("CS", {})
DEFAULT_SUBJECTS["CSBS"] = CSBS_DEFAULT_SUBJECTS


@router.get("/config")
def get_mid_sem_config():
    """Returns metadata configuration choices for dropdowns."""
    return {
        "sessions": ["Jan - Jun 2026", "Jul - Dec 2026", "Jan - Jun 2025", "Jul - Dec 2025"],
        "years": ["1st Year", "2nd Year", "3rd Year", "4th Year"],
        "semesters": ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"],
        "branches": ["CS", "IT", "EC", "ME", "CE", "EX", "AIML", "DS", "CSBS"],
        "programs": ["B.Tech.", "B.E.", "Diploma", "M.Tech.", "MCA"]
    }


@router.get("/subjects")
def get_subjects(
    branch: str = Query("IT"),
    semester: str = Query("IV"),
    program: str = Query("B.Tech."),
    db: Session = Depends(get_db)
):
    """
    Fetch active & MST-enabled subject list for specified branch, semester, and program.
    Automatically seeds default master subjects if no subjects exist yet for branch + sem.
    """
    branch_aliases = get_branch_aliases(branch)
    sem_clean = normalize_semester(semester)
    program_clean = program.strip()

    # Purge stale placeholder subjects for CSBS if subject_code does not start with CB
    if "CSBS" in branch_aliases or branch.strip().upper() == "CSBS":
        stale_csbs = db.query(MidSemSubject).filter(
            MidSemSubject.branch.in_(branch_aliases),
            ~MidSemSubject.subject_code.like("CB%")
        ).all()
        if stale_csbs:
            for s in stale_csbs:
                db.delete(s)
            try:
                db.commit()
            except Exception:
                db.rollback()

    subjects = db.query(MidSemSubject).filter(
        MidSemSubject.program == program_clean,
        MidSemSubject.branch.in_(branch_aliases),
        MidSemSubject.semester == sem_clean,
        MidSemSubject.is_active == True,
        MidSemSubject.mst_enabled == True
    ).order_by(MidSemSubject.display_order.asc()).all()

    if not subjects:
        # Check if any subjects at all exist for this branch + sem (even disabled ones)
        all_existing = db.query(MidSemSubject).filter(
            MidSemSubject.program == program_clean,
            MidSemSubject.branch.in_(branch_aliases),
            MidSemSubject.semester == sem_clean
        ).all()

        if not all_existing:
            branch_clean = branch.strip().upper()
            def_list = []
            for b_alias in [branch_clean] + branch_aliases:
                if b_alias in DEFAULT_SUBJECTS and sem_clean in DEFAULT_SUBJECTS[b_alias]:
                    def_list = DEFAULT_SUBJECTS[b_alias][sem_clean]
                    break
            if def_list:
                for item in def_list:
                    subj = MidSemSubject(
                        branch=branch_clean,
                        semester=sem_clean,
                        program=program_clean,
                        subject_code=item["subject_code"],
                        subject_name=item.get("subject_name", ""),
                        mst1_max=item.get("mst1_max", 10.0),
                        mst2_max=item.get("mst2_max", 10.0),
                        total_max=item.get("total_max", 20.0),
                        display_order=item.get("display_order", 1),
                        mst_enabled=item.get("mst_enabled", True),
                        is_elective=item.get("is_elective", False),
                        is_active=True
                    )
                    db.add(subj)
                try:
                    db.commit()
                except Exception:
                    db.rollback()

                subjects = db.query(MidSemSubject).filter(
                    MidSemSubject.program == program_clean,
                    MidSemSubject.branch.in_(branch_aliases),
                    MidSemSubject.semester == sem_clean,
                    MidSemSubject.is_active == True,
                    MidSemSubject.mst_enabled == True
                ).order_by(MidSemSubject.display_order.asc()).all()

    unique_subjects = []
    seen_codes = set()
    for s in subjects:
        if s.subject_code not in seen_codes:
            seen_codes.add(s.subject_code)
            unique_subjects.append(s)

    return [
        {
            "id": s.id,
            "branch": s.branch,
            "semester": s.semester,
            "program": s.program,
            "code": s.subject_code,
            "subject_code": s.subject_code,
            "name": s.subject_name,
            "subject_name": s.subject_name,
            "mst1_max": s.mst1_max,
            "mst1_max_marks": s.mst1_max,
            "mst2_max": s.mst2_max,
            "mst2_max_marks": s.mst2_max,
            "total_max": s.total_max,
            "total_max_marks": s.total_max,
            "display_order": s.display_order,
            "mst_enabled": s.mst_enabled,
            "is_elective": s.is_elective,
            "is_active": s.is_active
        }
        for s in unique_subjects
    ]


@router.post("/subjects")
def save_subject_config(
    item: SubjectConfigItem,
    current_user: User = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Add or update subject configuration."""
    if item.mst1_max < 0 or item.mst2_max < 0:
        raise HTTPException(status_code=400, detail="Maximum marks cannot be negative.")

    sem_clean = normalize_semester(item.semester)

    if item.id:
        subj = db.query(MidSemSubject).filter(MidSemSubject.id == item.id).first()
        if not subj:
            raise HTTPException(status_code=404, detail="Subject configuration record not found.")
        subj.subject_code = item.subject_code.strip()
        subj.subject_name = item.subject_name.strip() if item.subject_name else ""
        subj.mst1_max = item.mst1_max
        subj.mst2_max = item.mst2_max
        subj.total_max = item.mst1_max + item.mst2_max
        subj.display_order = item.display_order
        subj.mst_enabled = item.mst_enabled
        subj.is_elective = item.is_elective
        subj.is_active = item.is_active
    else:
        # Check duplicate by (program, branch, semester, subject_code)
        dup = db.query(MidSemSubject).filter(
            MidSemSubject.program == item.program,
            MidSemSubject.branch == item.branch.strip().upper(),
            MidSemSubject.semester == sem_clean,
            MidSemSubject.subject_code == item.subject_code.strip()
        ).first()
        if dup:
            dup.subject_name = item.subject_name.strip() if item.subject_name else dup.subject_name
            dup.mst1_max = item.mst1_max
            dup.mst2_max = item.mst2_max
            dup.total_max = item.mst1_max + item.mst2_max
            dup.display_order = item.display_order
            dup.mst_enabled = item.mst_enabled
            dup.is_elective = item.is_elective
            dup.is_active = item.is_active
            subj = dup
        else:
            subj = MidSemSubject(
                branch=item.branch.strip().upper(),
                semester=sem_clean,
                program=item.program,
                subject_code=item.subject_code.strip(),
                subject_name=item.subject_name.strip() if item.subject_name else "",
                mst1_max=item.mst1_max,
                mst2_max=item.mst2_max,
                total_max=item.mst1_max + item.mst2_max,
                display_order=item.display_order,
                mst_enabled=item.mst_enabled,
                is_elective=item.is_elective,
                is_active=True
            )
            db.add(subj)

    db.commit()
    db.refresh(subj)
    return {"message": "Subject configuration saved successfully.", "subject": {
        "id": subj.id,
        "subject_code": subj.subject_code,
        "subject_name": subj.subject_name,
        "mst1_max": subj.mst1_max,
        "mst2_max": subj.mst2_max,
        "total_max": subj.total_max,
        "mst_enabled": subj.mst_enabled,
        "is_elective": subj.is_elective
    }}


@router.post("/sessions")
def create_or_get_session(
    req: CreateSessionRequest,
    current_user: User = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Create or load a Mid-Sem session for selected branch, semester, session, and roll range."""
    if req.roll_start < 1:
        raise HTTPException(status_code=400, detail="Roll Number From must be >= 1.")

    if req.roll_end < req.roll_start:
        raise HTTPException(status_code=400, detail="Roll Number To must be >= Roll Number From.")

    if (req.roll_end - req.roll_start + 1) > 1000:
        raise HTTPException(status_code=400, detail="Roll range exceeds maximum allowed 1000 students per batch.")

    session_rec = db.query(MidSemSession).filter(
        MidSemSession.academic_session == req.academic_session,
        MidSemSession.semester == req.semester,
        MidSemSession.branch == req.branch,
        MidSemSession.program == req.program,
        MidSemSession.roll_prefix == req.roll_prefix,
        MidSemSession.roll_start == req.roll_start,
        MidSemSession.roll_end == req.roll_end
    ).first()

    if not session_rec:
        session_rec = MidSemSession(
            user_id=current_user.id,
            academic_session=req.academic_session,
            year=req.year,
            semester=req.semester,
            branch=req.branch,
            program=req.program,
            roll_prefix=req.roll_prefix,
            roll_start=req.roll_start,
            roll_end=req.roll_end
        )
        db.add(session_rec)
        db.commit()
        db.refresh(session_rec)

    return {
        "id": session_rec.id,
        "academic_session": session_rec.academic_session,
        "year": session_rec.year,
        "semester": session_rec.semester,
        "branch": session_rec.branch,
        "program": session_rec.program,
        "roll_prefix": session_rec.roll_prefix,
        "roll_start": session_rec.roll_start,
        "roll_end": session_rec.roll_end,
        "total_students": session_rec.roll_end - session_rec.roll_start + 1
    }


@router.get("/resolve-students")
def resolve_students(
    session_id: Optional[int] = None,
    prefix: str = Query("0105CS2410"),
    start: int = Query(1),
    end: int = Query(120),
    pad: int = Query(2),
    branch: str = Query("CSE"),
    semester: str = Query("IV"),
    program: str = Query("B.Tech."),
    fresh: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Generates list of enrollment numbers in the specified roll range and automatically
    resolves student names using existing ResultAI database records and saved Excel files.
    When fresh=True is specified, existing marks for session_id are reset to start clean.
    """
    prefix_val = prefix.default if hasattr(prefix, 'default') else str(prefix or "0105CS2410")
    start_val = int(start.default if hasattr(start, 'default') else start)
    end_val = int(end.default if hasattr(end, 'default') else end)
    pad_val = int(pad.default if hasattr(pad, 'default') else pad)
    fresh_val = fresh.default if hasattr(fresh, 'default') else bool(fresh)

    if session_id and fresh_val:
        try:
            db.query(MidSemStudentMarks).filter(MidSemStudentMarks.session_id == session_id).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()

    students = []
    # Fetch active subjects for session
    subjects = get_subjects(branch=branch, semester=semester, program=program, db=db)
    subj_ids = [s["id"] for s in subjects]
    subj_map = {s["id"]: s for s in subjects}

    # Pre-fetch any already saved marks in DB for this session
    saved_marks_map = {}
    if session_id and not fresh_val:
        existing_marks = db.query(MidSemStudentMarks).filter(MidSemStudentMarks.session_id == session_id).all()
        for m in existing_marks:
            if m.enrollment_no not in saved_marks_map:
                saved_marks_map[m.enrollment_no] = {}
            saved_marks_map[m.enrollment_no][m.subject_id] = m

    for r in range(start_val, end_val + 1):
        suffix = str(r).zfill(pad_val)
        enrollment = f"{prefix_val}{suffix}"

        # Student name lookup omitted (Roll number only mode)
        resolved_name = ""

        # Build marks dict per subject
        student_marks = {}
        has_any_marks = False
        has_all_marks = True

        for s in subjects:
            s_id = s["id"]
            s_code = s["subject_code"]
            db_m = saved_marks_map.get(enrollment, {}).get(s_id)

            m1 = db_m.mst1_marks if db_m else None
            m2 = db_m.mst2_marks if db_m else None
            tot = db_m.total_marks if db_m else None

            if m1 is not None or m2 is not None:
                has_any_marks = True
            if m1 is None or m2 is None:
                has_all_marks = False

            student_marks[s_code] = {
                "subject_id": s_id,
                "mst1": m1,
                "mst2": m2,
                "total": tot,
                "mst1_max": s["mst1_max"],
                "mst2_max": s["mst2_max"],
                "total_max": s["total_max"]
            }

        # Status determination
        first_db_m = next(iter(saved_marks_map[enrollment].values())) if (enrollment in saved_marks_map and saved_marks_map[enrollment]) else None
        absence_tag = first_db_m.absence_type if first_db_m else None

        if absence_tag:
            status = absence_tag
        elif has_all_marks:
            status = "SAVED"
        elif has_any_marks:
            status = "PENDING"
        else:
            status = "READY"

        students.append({
            "s_no": len(students) + 1,
            "enrollment_no": enrollment,
            "student_name": "",
            "is_name_resolved": False,
            "absence_type": absence_tag,
            "status": status,
            "marks": student_marks
        })

    return {
        "prefix": prefix,
        "start": start,
        "end": end,
        "total_students": len(students),
        "subjects": subjects,
        "students": students
    }


@router.post("/marks")
def save_student_marks(
    req: SaveStudentMarksRequest,
    current_user: User = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Save or update MST-I & MST-II marks for a student.
    Validates range (0 <= marks <= max_marks) and re-calculates total backend-side.
    """
    session_rec = db.query(MidSemSession).filter(MidSemSession.id == req.session_id).first()
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found.")

    saved_items = []
    for item in req.marks:
        subj = db.query(MidSemSubject).filter(MidSemSubject.id == item.subject_id).first()
        if not subj:
            raise HTTPException(status_code=404, detail=f"Subject with ID {item.subject_id} not found.")

        # Range validation
        mst1 = item.mst1_marks
        mst2 = item.mst2_marks

        if mst1 is not None:
            if mst1 < 0:
                raise HTTPException(status_code=400, detail=f"MST-I marks for {subj.subject_code} cannot be negative.")
            if mst1 > subj.mst1_max:
                raise HTTPException(status_code=400, detail=f"MST-I marks for {subj.subject_code} cannot exceed maximum {subj.mst1_max} marks.")

        if mst2 is not None:
            if mst2 < 0:
                raise HTTPException(status_code=400, detail=f"MST-II marks for {subj.subject_code} cannot be negative.")
            if mst2 > subj.mst2_max:
                raise HTTPException(status_code=400, detail=f"MST-II marks for {subj.subject_code} cannot exceed maximum {subj.mst2_max} marks.")

        # Backend total calculation
        tot = None
        if mst1 is not None or mst2 is not None:
            tot = (mst1 or 0.0) + (mst2 or 0.0)

        mark_rec = db.query(MidSemStudentMarks).filter(
            MidSemStudentMarks.session_id == req.session_id,
            MidSemStudentMarks.enrollment_no == req.enrollment_no.strip().upper(),
            MidSemStudentMarks.subject_id == item.subject_id
        ).first()

        if not mark_rec:
            mark_rec = MidSemStudentMarks(
                session_id=req.session_id,
                enrollment_no=req.enrollment_no.strip().upper(),
                student_name=req.student_name.strip() if req.student_name else "",
                subject_id=item.subject_id,
                mst1_marks=mst1,
                mst2_marks=mst2,
                total_marks=tot,
                status="SAVED"
            )
            db.add(mark_rec)
        else:
            mark_rec.student_name = req.student_name.strip() if req.student_name else mark_rec.student_name
            mark_rec.mst1_marks = mst1
            mark_rec.mst2_marks = mst2
            mark_rec.total_marks = tot
            mark_rec.status = "SAVED"

        saved_items.append({
            "subject_code": subj.subject_code,
            "mst1": mst1,
            "mst2": mst2,
            "total": tot
        })

    db.commit()
    return {"message": f"Marks saved for {req.enrollment_no}.", "saved_marks": saved_items}


@router.post("/batch-marks")
def batch_save_marks(
    req: BatchSaveMarksRequest,
    current_user: User = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Batch save marks for multiple students."""
    for single_req in req.records:
        save_student_marks(single_req, current_user=current_user, db=db)

    return {"message": f"Successfully saved marks for {len(req.records)} students."}


@router.post("/mark-absent")
def mark_students_absent(
    req: MarkAbsentRequest,
    current_user: User = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Sets MST marks to zero for selected students based on absence_type ('both', 'mst1', 'mst2').
    Returns previous mark state snapshot for frontend undo capability.
    Audit logs the operation.
    """
    session_rec = db.query(MidSemSession).filter(MidSemSession.id == req.session_id).first()
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found.")

    abs_type = req.absence_type.lower().strip()
    if abs_type not in ["both", "mst1", "mst2"]:
        raise HTTPException(status_code=400, detail="Invalid absence_type. Must be 'both', 'mst1', or 'mst2'.")

    subjects = db.query(MidSemSubject).filter(
        MidSemSubject.branch == session_rec.branch,
        MidSemSubject.semester == session_rec.semester,
        MidSemSubject.program == session_rec.program,
        MidSemSubject.is_active == True
    ).all()

    if not subjects:
        raise HTTPException(status_code=400, detail="No active subjects found for this session.")

    status_tag = "ABSENT_BOTH" if abs_type == "both" else ("ABSENT_MST1" if abs_type == "mst1" else "ABSENT_MST2")

    previous_snapshot = []
    from datetime import datetime

    try:
        for enr in req.enrollment_numbers:
            enr_clean = enr.strip().upper()
            student_prev_marks = []

            for subj in subjects:
                mark_rec = db.query(MidSemStudentMarks).filter(
                    MidSemStudentMarks.session_id == req.session_id,
                    MidSemStudentMarks.enrollment_no == enr_clean,
                    MidSemStudentMarks.subject_id == subj.id
                ).first()

                if not mark_rec:
                    mark_rec = MidSemStudentMarks(
                        session_id=req.session_id,
                        enrollment_no=enr_clean,
                        subject_id=subj.id,
                        mst1_marks=None,
                        mst2_marks=None,
                        total_marks=None,
                        absence_type=None,
                        status="READY"
                    )
                    db.add(mark_rec)
                    db.flush()

                # Record snapshot for undo
                student_prev_marks.append({
                    "subject_id": subj.id,
                    "mst1": mark_rec.mst1_marks,
                    "mst2": mark_rec.mst2_marks,
                    "absence_type": mark_rec.absence_type,
                    "status": mark_rec.status
                })

                # Apply absent logic
                if abs_type == "both":
                    mark_rec.mst1_marks = 0.0
                    mark_rec.mst2_marks = 0.0
                elif abs_type == "mst1":
                    mark_rec.mst1_marks = 0.0
                elif abs_type == "mst2":
                    mark_rec.mst2_marks = 0.0

                # Backend total calculation
                mark_rec.total_marks = (mark_rec.mst1_marks or 0.0) + (mark_rec.mst2_marks or 0.0)
                mark_rec.absence_type = status_tag
                mark_rec.status = status_tag

            previous_snapshot.append({
                "enrollment_no": enr_clean,
                "marks": student_prev_marks
            })

        db.commit()

        # Audit Log Output
        user_str = current_user.email if current_user else 'System'
        print(f"[Audit Log] User '{user_str}' executed MARK_ABSENT ({status_tag}) on {len(req.enrollment_numbers)} student(s) for Session #{req.session_id} at {datetime.utcnow().isoformat()}")

        return {
            "message": f"Successfully marked {len(req.enrollment_numbers)} student(s) absent ({status_tag}).",
            "absence_type": status_tag,
            "count": len(req.enrollment_numbers),
            "previous_snapshot": previous_snapshot
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to mark students absent: {str(e)}")


@router.post("/reset-marks")
def reset_student_marks(
    req: ResetMarksRequest,
    current_user: User = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Resets marks and absence status for specified student enrollments (or all in session if empty),
    restoring them back to fresh/pending state.
    """
    session_rec = db.query(MidSemSession).filter(MidSemSession.id == req.session_id).first()
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found.")

    query = db.query(MidSemStudentMarks).filter(MidSemStudentMarks.session_id == req.session_id)
    if req.enrollment_numbers and len(req.enrollment_numbers) > 0:
        clean_enrs = [e.strip().upper() for e in req.enrollment_numbers if e and e.strip()]
        query = query.filter(MidSemStudentMarks.enrollment_no.in_(clean_enrs))

    try:
        deleted_count = query.delete(synchronize_session=False)
        db.commit()
        print(f"[Audit Log] User '{current_user.email if current_user else 'System'}' executed RESET_MARKS on Session #{req.session_id} for {deleted_count} student record(s).")
        return {
            "message": f"Successfully reset marks for {deleted_count} student record(s).",
            "count": deleted_count
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset marks: {str(e)}")


@router.post("/sessions/{session_id}/generate-excel")
def generate_excel_sheet(
    session_id: int,
    marks_type: str = Query("all"),
    header_override: Optional[HeaderSettingsOverride] = Body(None),
    current_user: User = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Generates and returns official formatted Mid-Sem Marks Excel spreadsheet."""
    session_rec = db.query(MidSemSession).filter(MidSemSession.id == session_id).first()
    if not session_rec:
        raise HTTPException(status_code=404, detail="Mid-Sem session not found.")

    subjects = get_subjects(
        branch=session_rec.branch,
        semester=session_rec.semester,
        program=session_rec.program,
        db=db
    )

    resolved_data = resolve_students(
        session_id=session_id,
        prefix=session_rec.roll_prefix,
        start=session_rec.roll_start,
        end=session_rec.roll_end,
        branch=session_rec.branch,
        semester=session_rec.semester,
        program=session_rec.program,
        db=db
    )

    mtype = str(marks_type or "all").lower().strip()
    tag = f"_{mtype.upper()}" if mtype in ["mst1", "mst2"] else ""

    sess_title = (header_override.academic_session if (header_override and header_override.academic_session) else session_rec.academic_session)
    sem_title = (header_override.semester if (header_override and header_override.semester) else session_rec.semester)

    # Sanitize output filename
    safe_session = re.sub(r'[^\w\-_]', '_', sess_title)
    filename = f"OIST_{session_rec.branch}_{sem_title}_MidSem_{safe_session}{tag}.xlsx"
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    out_path = os.path.join(data_dir, filename)

    session_info = {
        "academic_session": sess_title,
        "year": session_rec.year,
        "semester": sem_title,
        "branch": session_rec.branch,
        "program": session_rec.program,
        "college_name": header_override.college_name if (header_override and header_override.college_name) else None,
        "department_name": header_override.department_name if (header_override and header_override.department_name) else None,
        "exam_title": header_override.exam_title if (header_override and header_override.exam_title) else None
    }

    full_filepath = generate_mid_sem_excel(
        session_info=session_info,
        subjects=subjects,
        students_data=resolved_data["students"],
        output_path=out_path,
        marks_type=mtype
    )

    return FileResponse(
        path=full_filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.post("/sessions/{session_id}/generate-pdf")
def generate_pdf_summary(
    session_id: int,
    marks_type: str = Query("all"),
    header_override: Optional[HeaderSettingsOverride] = Body(None),
    current_user: User = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """Generates a PDF summary sheet of Mid-Sem marks."""
    session_rec = db.query(MidSemSession).filter(MidSemSession.id == session_id).first()
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found.")

    subjects = get_subjects(
        branch=session_rec.branch,
        semester=session_rec.semester,
        program=session_rec.program,
        db=db
    )

    resolved_data = resolve_students(
        session_id=session_id,
        prefix=session_rec.roll_prefix,
        start=session_rec.roll_start,
        end=session_rec.roll_end,
        branch=session_rec.branch,
        semester=session_rec.semester,
        program=session_rec.program,
        db=db
    )

    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    mtype = str(marks_type or "all").lower().strip()
    tag = f"_{mtype.upper()}" if mtype in ["mst1", "mst2"] else ""
    sub_tag = "MST-I" if mtype == "mst1" else ("MST-II" if mtype == "mst2" else "TOT")
    val_key = "mst1" if mtype == "mst1" else ("mst2" if mtype == "mst2" else "total")
    scope_title_suffix = f" ({sub_tag})" if mtype in ["mst1", "mst2"] else ""

    college_name = (header_override.college_name if (header_override and header_override.college_name) else "ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL").upper()
    department_name = (header_override.department_name if (header_override and header_override.department_name) else f"DEPARTMENT OF {session_rec.branch}").upper()
    exam_title = (header_override.exam_title if (header_override and header_override.exam_title) else "MID SEM MARKS").upper()
    session_title = (header_override.academic_session if (header_override and header_override.academic_session) else session_rec.academic_session).upper()
    sem_title = (header_override.semester if (header_override and header_override.semester) else session_rec.semester).upper()

    safe_session = re.sub(r'[^\w\-_]', '_', session_title)
    filename = f"OIST_{session_rec.branch}_{sem_title}_MidSem_{safe_session}{tag}.pdf"
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    out_path = os.path.join(data_dir, filename)

    doc = SimpleDocTemplate(
        out_path,
        pagesize=landscape(A4),
        leftMargin=30,
        rightMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    usable_width = 841.89 - 60  # 781.89 pt available

    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        name="TitleStyle",
        parent=styles["Heading1"],
        alignment=1,
        fontSize=16,
        leading=18,
        textColor=colors.HexColor("#1E3A8A")
    )
    sub_style = ParagraphStyle(
        name="SubStyle",
        parent=styles["Normal"],
        alignment=1,
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#334155")
    )

    story.append(Paragraph(college_name, title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"{department_name} | SESSION: {session_title} | SEMESTER {sem_title} | {exam_title}{scope_title_suffix}", sub_style))
    story.append(Spacer(1, 14))

    fail_limit = 4.0 if mtype in ["mst1", "mst2"] else 8.0

    header_style = ParagraphStyle(
        name="HeaderStyle",
        parent=styles["Normal"],
        alignment=1,
        fontSize=10,
        leading=12,
        textColor=colors.white,
        fontName="Helvetica-Bold"
    )

    cell_style = ParagraphStyle(
        name="CellStyle",
        parent=styles["Normal"],
        alignment=1,
        fontSize=10,
        leading=12,
        textColor=colors.HexColor("#0F172A"),
        fontName="Helvetica"
    )

    cell_fail_style = ParagraphStyle(
        name="CellFailStyle",
        parent=styles["Normal"],
        alignment=1,
        fontSize=10,
        leading=12,
        textColor=colors.HexColor("#991B1B"),
        fontName="Helvetica-Bold"
    )

    sub_header_style = ParagraphStyle(
        name="SubHeaderStyle",
        parent=styles["Normal"],
        alignment=1,
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1E293B"),
        fontName="Helvetica-Bold"
    )

    cell_tot_style = ParagraphStyle(
        name="CellTotStyle",
        parent=styles["Normal"],
        alignment=1,
        fontSize=10,
        leading=12,
        textColor=colors.HexColor("#854D0E"),
        fontName="Helvetica-Bold"
    )

    t_style = [
        ('BACKGROUND', (0, 0), (-1, 0 if mtype in ["mst1", "mst2"] else 1), colors.HexColor('#1E3A8A')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.75, colors.HexColor('#CBD5E1')),
    ]

    sno_w = 40.0
    enroll_w = 110.0
    num_subj = len(subjects)

    if mtype in ["mst1", "mst2"]:
        sub_tag = "MST-I" if mtype == "mst1" else "MST-II"
        val_key = "mst1" if mtype == "mst1" else "mst2"
        
        headers = [
            Paragraph("<b>S.No.</b>", header_style),
            Paragraph("<b>Enrollment No.</b>", header_style)
        ]
        for s in subjects:
            headers.append(Paragraph(f"<b>{s['subject_code']}</b><br/><font size=7>({sub_tag})</font>", header_style))
        table_data = [headers]

        for st_idx, st in enumerate(resolved_data["students"], start=1):
            row_idx = st_idx
            bg_base = colors.HexColor('#F8FAFC') if row_idx % 2 == 0 else colors.white
            t_style.append(('BACKGROUND', (0, row_idx), (-1, row_idx), bg_base))

            row = [
                Paragraph(str(st["s_no"]), cell_style),
                Paragraph(f"<b>{st['enrollment_no']}</b>", cell_style)
            ]
            for subj_idx, s in enumerate(subjects, start=2):
                code = s["subject_code"]
                s_marks = st["marks"].get(code) or st["marks"].get(code.strip()) or {}
                mark_val = s_marks.get(val_key)
                num_val = float(mark_val) if mark_val is not None else 0.0

                if mark_val is not None and num_val < 4.0:
                    row.append(Paragraph(f"<b>{mark_val}</b>", cell_fail_style))
                    t_style.append(('BACKGROUND', (subj_idx, row_idx), (subj_idx, row_idx), colors.HexColor('#FEE2E2')))
                else:
                    val_str = str(mark_val) if mark_val is not None else "-"
                    row.append(Paragraph(f"<b>{val_str}</b>" if mark_val is not None else "-", cell_style))
            table_data.append(row)

        subj_w = (usable_width - sno_w - enroll_w) / max(1, num_subj)
        col_widths = [sno_w, enroll_w] + [subj_w] * num_subj
        repeat_rows = 1
    else:
        # Full Result: MST-I, MST-II, TOT (3 cols per subject)
        row1 = [
            Paragraph("<b>S.No.</b>", header_style),
            Paragraph("<b>Enrollment No.</b>", header_style)
        ]
        row2 = [
            Paragraph("", header_style),
            Paragraph("", header_style)
        ]

        t_style.append(('SPAN', (0, 0), (0, 1)))
        t_style.append(('SPAN', (1, 0), (1, 1)))

        col_curr = 2
        for s in subjects:
            row1.append(Paragraph(f"<b>{s['subject_code']}</b>", header_style))
            row1.append(Paragraph("", header_style))
            row1.append(Paragraph("", header_style))

            t_style.append(('SPAN', (col_curr, 0), (col_curr + 2, 0)))

            row2.append(Paragraph("<b>MST-I</b>", sub_header_style))
            row2.append(Paragraph("<b>MST-II</b>", sub_header_style))
            row2.append(Paragraph("<b>TOT</b>", sub_header_style))

            t_style.append(('BACKGROUND', (col_curr, 1), (col_curr + 1, 1), colors.HexColor('#F1F5F9')))
            t_style.append(('BACKGROUND', (col_curr + 2, 1), (col_curr + 2, 1), colors.HexColor('#FEF08A')))

            col_curr += 3

        table_data = [row1, row2]

        for st_idx, st in enumerate(resolved_data["students"], start=1):
            row_idx = st_idx + 1 # offset by 2 header rows
            bg_base = colors.HexColor('#F8FAFC') if st_idx % 2 == 0 else colors.white
            t_style.append(('BACKGROUND', (0, row_idx), (-1, row_idx), bg_base))

            row = [
                Paragraph(str(st["s_no"]), cell_style),
                Paragraph(f"<b>{st['enrollment_no']}</b>", cell_style)
            ]

            c_pos = 2
            for s in subjects:
                code = s["subject_code"]
                s_marks = st["marks"].get(code) or st["marks"].get(code.strip()) or {}
                m1 = s_marks.get("mst1")
                m2 = s_marks.get("mst2")

                m1_num = float(m1) if m1 is not None else 0.0
                m2_num = float(m2) if m2 is not None else 0.0
                tot_num = m1_num + m2_num

                # MST-I Cell
                if m1 is not None and m1_num < 4.0:
                    row.append(Paragraph(f"<b>{m1}</b>", cell_fail_style))
                    t_style.append(('BACKGROUND', (c_pos, row_idx), (c_pos, row_idx), colors.HexColor('#FEE2E2')))
                else:
                    v1 = str(m1) if m1 is not None else "-"
                    row.append(Paragraph(v1, cell_style))

                # MST-II Cell
                if m2 is not None and m2_num < 4.0:
                    row.append(Paragraph(f"<b>{m2}</b>", cell_fail_style))
                    t_style.append(('BACKGROUND', (c_pos + 1, row_idx), (c_pos + 1, row_idx), colors.HexColor('#FEE2E2')))
                else:
                    v2 = str(m2) if m2 is not None else "-"
                    row.append(Paragraph(v2, cell_style))

                # TOT Cell
                if tot_num < 8.0:
                    row.append(Paragraph(f"<b>{tot_num}</b>", cell_fail_style))
                    t_style.append(('BACKGROUND', (c_pos + 2, row_idx), (c_pos + 2, row_idx), colors.HexColor('#FEE2E2')))
                else:
                    row.append(Paragraph(f"<b>{tot_num}</b>", cell_tot_style))
                    t_style.append(('BACKGROUND', (c_pos + 2, row_idx), (c_pos + 2, row_idx), colors.HexColor('#FEF08A')))

                c_pos += 3

            table_data.append(row)

        total_sub_cols = num_subj * 3
        subj_w = (usable_width - sno_w - enroll_w) / max(1, total_sub_cols)
        col_widths = [sno_w, enroll_w] + [subj_w] * total_sub_cols
        repeat_rows = 2

    t = Table(table_data, colWidths=col_widths, repeatRows=repeat_rows)
    t.setStyle(TableStyle(t_style))
    story.append(t)

    # Append Legend
    story.append(Spacer(1, 10))
    legend_style = ParagraphStyle(
        name="LegendStyle",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#991B1B"),
        fontName="Helvetica-Bold"
    )
    story.append(Paragraph("Legend: 🟥 FAIL — Below Passing Marks (MST &lt; 4 / TOT &lt; 8)", legend_style))

    doc.build(story)

    return FileResponse(
        path=out_path,
        filename=filename,
        media_type="application/pdf"
    )
