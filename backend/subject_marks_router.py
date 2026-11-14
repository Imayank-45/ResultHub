"""
backend/subject_marks_router.py
--------------------------------
Independent FastAPI APIRouter for single-subject teacher marks entry & Excel generation.
Fully decoupled from Mid-Sem Studio session database.
"""

import os
import io
import re
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from backend.db.auth import get_optional_current_user
from backend.db.models import User

router = APIRouter(tags=["Subject Marks Manager"])


class SingleSubjectStudentItem(BaseModel):
    s_no: int
    enrollment_no: str
    mst1: Optional[float] = None
    mst2: Optional[float] = None
    total: Optional[float] = None
    mst1_absent: Optional[bool] = False
    mst2_absent: Optional[bool] = False
    is_absent: Optional[bool] = False


class SingleSubjectExcelRequest(BaseModel):
    subject_name: str
    subject_code: str
    semester: str
    academic_session: str
    marks_type: str = "both"  # 'mst1', 'mst2', 'both'
    students: List[SingleSubjectStudentItem]


@router.post("/generate-excel")
def generate_subject_marks_excel(
    req: SingleSubjectExcelRequest,
    current_user: User = Depends(get_optional_current_user)
):
    """
    Generates an official single-subject formatted Excel spreadsheet with luxury styling.
    """
    if not req.students:
        raise HTTPException(status_code=400, detail="No student records provided.")

    mtype = str(req.marks_type or "both").lower().strip()
    subj_code = req.subject_code.strip().upper()
    subj_name = req.subject_name.strip()
    sem = req.semester.strip().upper()
    session_title = req.academic_session.strip()

    wb = Workbook()
    ws = wb.active
    ws.title = f"{subj_code}_Marks"
    ws.views.sheetView[0].showGridLines = True

    # Luxury Font & Color Definitions
    title_font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    subtitle_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    info_font = Font(name="Calibri", size=10, bold=True, color="1E3A8A")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

    pass_font = Font(name="Calibri", size=11, color="0F172A", bold=False)
    fail_font = Font(name="Calibri", size=11, bold=True, color="991B1B")
    absent_font = Font(name="Calibri", size=11, bold=True, color="991B1B")

    title_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Deep Royal Navy
    subtitle_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid") # Bright Blue
    info_fill = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid") # Ice Blue
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    sub_header_fill = PatternFill(start_color="1D4ED8", end_color="1D4ED8", fill_type="solid")

    fail_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid") # Soft Red
    absent_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid") # Soft Red

    even_row_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    odd_row_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # Use A1:E1 for ALL modes so Department banner text never gets cut off
    max_col_range = "A1:E1"
    sub_col_range = "A2:E2"
    info_col_range = "A3:E3"

    # 1. College Header Banner
    ws.merge_cells(max_col_range)
    ws["A1"] = "ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL"
    ws["A1"].font = title_font
    ws["A1"].fill = title_fill
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 32

    ws.merge_cells(sub_col_range)
    ws["A2"] = "DEPARTMENT OF INFORMATION TECHNOLOGY — OFFICIAL MID-SEM MARKS"
    ws["A2"].font = subtitle_font
    ws["A2"].fill = subtitle_fill
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center", shrink_to_fit=True)
    ws.row_dimensions[2].height = 24

    ws.merge_cells(info_col_range)
    ws["A3"] = f"SUBJECT: {subj_code} – {subj_name}  |  SEMESTER: {sem}  |  SESSION: {session_title}"
    ws["A3"].font = info_font
    ws["A3"].fill = info_fill
    ws["A3"].alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[3].height = 22

    ws.append([]) # Row 4 Empty Spacer

    # 2. Table Column Headers & Data Rows
    if mtype == "mst1":
        ws.append(["S.No.", "Enrollment No.", f"{subj_code} – {subj_name} (MST-I)"])
        ws.row_dimensions[5].height = 26
        for col_i in range(1, 4):
            c = ws.cell(row=5, column=col_i)
            c.fill = header_fill
            c.font = header_font
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = thin_border

        for idx, st in enumerate(req.students, start=6):
            bg = even_row_fill if idx % 2 == 0 else odd_row_fill
            is_abs = bool(st.mst1_absent or st.is_absent)
            m1_val = st.mst1
            is_fail = not is_abs and m1_val is not None and m1_val < 4.0

            c1 = ws.cell(row=idx, column=1, value=st.s_no)
            c2 = ws.cell(row=idx, column=2, value=st.enrollment_no)
            c3 = ws.cell(row=idx, column=3, value="ABSENT" if is_abs else (m1_val if m1_val is not None else "-"))

            ws.row_dimensions[idx].height = 20
            for c in (c1, c2, c3):
                c.fill = bg
                c.font = pass_font
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.border = thin_border

            if is_abs:
                c3.fill = absent_fill
                c3.font = absent_font
            elif is_fail:
                c3.fill = fail_fill
                c3.font = fail_font

    elif mtype == "mst2":
        ws.append(["S.No.", "Enrollment No.", f"{subj_code} – {subj_name} (MST-II)"])
        ws.row_dimensions[5].height = 26
        for col_i in range(1, 4):
            c = ws.cell(row=5, column=col_i)
            c.fill = header_fill
            c.font = header_font
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = thin_border

        for idx, st in enumerate(req.students, start=6):
            bg = even_row_fill if idx % 2 == 0 else odd_row_fill
            is_abs = bool(st.mst2_absent or st.is_absent)
            m2_val = st.mst2
            is_fail = not is_abs and m2_val is not None and m2_val < 4.0

            c1 = ws.cell(row=idx, column=1, value=st.s_no)
            c2 = ws.cell(row=idx, column=2, value=st.enrollment_no)
            c3 = ws.cell(row=idx, column=3, value="ABSENT" if is_abs else (m2_val if m2_val is not None else "-"))

            ws.row_dimensions[idx].height = 20
            for c in (c1, c2, c3):
                c.fill = bg
                c.font = pass_font
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.border = thin_border

            if is_abs:
                c3.fill = absent_fill
                c3.font = absent_font
            elif is_fail:
                c3.fill = fail_fill
                c3.font = fail_font

    else:  # Both (MST-I + MST-II)
        # Row 5: Top Header
        ws.cell(row=5, column=1, value="S.No.")
        ws.cell(row=5, column=2, value="Enrollment No.")
        ws.merge_cells("C5:E5")
        ws.cell(row=5, column=3, value=f"{subj_code} – {subj_name}")
        ws.row_dimensions[5].height = 24

        for col_i in range(1, 6):
            c = ws.cell(row=5, column=col_i)
            c.fill = header_fill
            c.font = header_font
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = thin_border

        # Row 6 Subheaders: MST-I | MST-II | TOT
        ws.cell(row=6, column=1, value="")
        ws.cell(row=6, column=2, value="")
        ws.cell(row=6, column=3, value="MST-I (Max 10)")
        ws.cell(row=6, column=4, value="MST-II (Max 10)")
        ws.cell(row=6, column=5, value="TOT (Max 20)")
        ws.merge_cells("A5:A6")
        ws.merge_cells("B5:B6")
        ws.row_dimensions[6].height = 22

        for col_i in (3, 4, 5):
            c = ws.cell(row=6, column=col_i)
            c.fill = sub_header_fill
            c.font = header_font
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = thin_border

        for idx, st in enumerate(req.students, start=7):
            bg = even_row_fill if idx % 2 == 0 else odd_row_fill
            is_m1_abs = bool(st.mst1_absent or (st.is_absent and st.mst1 is None))
            is_m2_abs = bool(st.mst2_absent or (st.is_absent and st.mst2 is None))

            m1_val = st.mst1
            m2_val = st.mst2

            # Calculate total safely with granular absence
            if is_m1_abs and is_m2_abs:
                tot_val = None
                is_both_absent = True
            else:
                is_both_absent = False
                score1 = 0.0 if is_m1_abs else (m1_val if m1_val is not None else 0.0)
                score2 = 0.0 if is_m2_abs else (m2_val if m2_val is not None else 0.0)
                if m1_val is not None or m2_val is not None or is_m1_abs or is_m2_abs:
                    tot_val = score1 + score2
                else:
                    tot_val = None

            is_m1_fail = not is_m1_abs and m1_val is not None and m1_val < 4.0
            is_m2_fail = not is_m2_abs and m2_val is not None and m2_val < 4.0
            is_tot_fail = not is_both_absent and tot_val is not None and tot_val < 8.0

            c1 = ws.cell(row=idx, column=1, value=st.s_no)
            c2 = ws.cell(row=idx, column=2, value=st.enrollment_no)
            c3 = ws.cell(row=idx, column=3, value="ABSENT" if is_m1_abs else (m1_val if m1_val is not None else "-"))
            c4 = ws.cell(row=idx, column=4, value="ABSENT" if is_m2_abs else (m2_val if m2_val is not None else "-"))
            c5 = ws.cell(row=idx, column=5, value="ABSENT" if is_both_absent else (tot_val if tot_val is not None else "-"))

            ws.row_dimensions[idx].height = 20
            for c in (c1, c2, c3, c4, c5):
                c.fill = bg
                c.font = pass_font
                c.alignment = Alignment(horizontal="center", vertical="center")
                c.border = thin_border

            if is_m1_abs:
                c3.fill = absent_fill
                c3.font = absent_font
            elif is_m1_fail:
                c3.fill = fail_fill
                c3.font = fail_font

            if is_m2_abs:
                c4.fill = absent_fill
                c4.font = absent_font
            elif is_m2_fail:
                c4.fill = fail_fill
                c4.font = fail_font

            if is_both_absent:
                c5.fill = absent_fill
                c5.font = absent_font
            elif is_tot_fail:
                c5.fill = fail_fill
                c5.font = fail_font

    # Auto-fit column widths
    ws.column_dimensions['A'].width = 10
    ws.column_dimensions['B'].width = 24
    ws.column_dimensions['C'].width = 38 if mtype != "both" else 18
    if mtype == "both":
        ws.column_dimensions['D'].width = 18
        ws.column_dimensions['E'].width = 18

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR = os.path.join(BASE_DIR, "data")
    os.makedirs(DATA_DIR, exist_ok=True)
    safe_session = re.sub(r'[^\w\-_]', '_', session_title)
    filename = f"SubjectMarks_{subj_code}_{sem}_{mtype.upper()}_{safe_session}.xlsx"
    out_path = os.path.join(DATA_DIR, filename)

    wb.save(out_path)
    wb.close()

    return FileResponse(
        path=out_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
