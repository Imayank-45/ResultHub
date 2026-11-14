"""
mid_sem_excel_writer.py
------------------------
Generates an official college Mid-Sem Marks Excel spreadsheet using openpyxl.
Follows the reference structure with merged titles, dynamic subject headers,
highlighted yellow TOT columns, Excel formulas, and auto-adjusted column widths.
"""

from __future__ import annotations

import os
from typing import List, Dict, Any, Optional

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

BRANCH_FULL_NAMES = {
    "CSE": "COMPUTER SCIENCE AND ENGINEERING",
    "CS": "COMPUTER SCIENCE AND ENGINEERING",
    "IT": "INFORMATION TECHNOLOGY",
    "ECE": "ELECTRONICS & COMMUNICATION ENGINEERING",
    "EC": "ELECTRONICS & COMMUNICATION ENGINEERING",
    "ME": "MECHANICAL ENGINEERING",
    "CE": "CIVIL ENGINEERING",
    "EX": "ELECTRICAL & ELECTRONICS ENGINEERING",
    "EEE": "ELECTRICAL & ELECTRONICS ENGINEERING",
    "AI": "ARTIFICIAL INTELLIGENCE & DATA SCIENCE",
    "AIML": "ARTIFICIAL INTELLIGENCE & DATA SCIENCE",
    "DS": "DATA SCIENCE",
    "CSBS": "COMPUTER SCIENCE & BUSINESS SYSTEMS",
}


def generate_mid_sem_excel(
    session_info: Dict[str, Any],
    subjects: List[Dict[str, Any]],
    students_data: List[Dict[str, Any]],
    output_path: str,
    marks_type: str = "all"
) -> str:
    """
    Generates a formatted Mid-Sem Marks Excel spreadsheet.

    :param session_info: Dict containing academic_session, year, semester, branch, program
    :param subjects: List of subject dicts (subject_code, subject_name, mst1_max, mst2_max, total_max)
    :param students_data: List of student records with enrollment_no, student_name, marks dict
    :param output_path: Destination file path for .xlsx
    :param marks_type: Export scope: 'mst1' (MST-I Only), 'mst2' (MST-II Only), or 'all' (MST-I + MST-II + Total)
    :return: Absolute path to the generated Excel file
    """
    abs_output_path = os.path.abspath(output_path)
    dirname = os.path.dirname(abs_output_path)
    if dirname and not os.path.exists(dirname):
        try:
            os.makedirs(dirname, exist_ok=True)
        except OSError:
            pass

    wb = Workbook()
    ws = wb.active
    ws.title = "Mid-Sem Marks"

    marks_type_clean = str(marks_type or "all").lower().strip()
    if marks_type_clean not in ["mst1", "mst2", "all"]:
        marks_type_clean = "all"

    # Extract session & header details
    college_name = (session_info.get("college_name") or "ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL").upper()
    department_name = (session_info.get("department_name") or f"DEPARTMENT OF {branch_full}").upper()
    exam_title = (session_info.get("exam_title") or "MID SEM MARKS").upper()
    session_name = session_info.get("academic_session", "JAN - JUN 2026").upper()
    semester = session_info.get("semester", "IV").upper()
    branch_code = session_info.get("branch", "CSE").upper()
    branch_full = BRANCH_FULL_NAMES.get(branch_code, f"{branch_code} DEPARTMENT")

    # Sort subjects by display_order if present
    sorted_subjects = sorted(subjects, key=lambda s: s.get("display_order", 1))
    num_subjects = len(sorted_subjects)

    # Columns: Col A = S.No, Col B = Enrollment, then dynamic subject columns
    if marks_type_clean in ["mst1", "mst2"]:
        total_cols = 2 + num_subjects
    else:
        total_cols = 2 + (num_subjects * 3)
    last_col_letter = get_column_letter(total_cols)

    # Styles
    font_title = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
    font_subtitle = Font(name="Calibri", size=12, bold=True, color="1E293B")
    font_session = Font(name="Calibri", size=11, bold=True, color="334155")
    
    font_header_main = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    font_subject_header = Font(name="Calibri", size=11, bold=True, color="0F172A")
    font_sub_header = Font(name="Calibri", size=10, bold=True, color="0F172A")
    font_tot_header = Font(name="Calibri", size=10, bold=True, color="854D0E")

    font_data = Font(name="Calibri", size=10, color="0F172A")
    font_tot_data = Font(name="Calibri", size=10, bold=True, color="854D0E")
    
    font_fail = Font(name="Calibri", size=10, bold=True, color="991B1B")
    fill_fail = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid") # Soft red fill
    font_legend = Font(name="Calibri", size=10, bold=True, color="991B1B")

    fill_header_blue = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    fill_subject = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
    fill_yellow = PatternFill(start_color="FEF08A", end_color="FEF08A", fill_type="solid") # Soft yellow fill
    fill_sub_header = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    thin_side = Side(style="thin", color="CBD5E1")
    dark_side = Side(style="thin", color="475569")
    thin_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
    header_border = Border(left=dark_side, right=dark_side, top=dark_side, bottom=dark_side)

    align_center = Alignment(horizontal="center", vertical="center")

    # Row 1-3 Header Titles merged ONCE across full width (Cols 1 to total_cols)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=total_cols)
    cell_r1 = ws.cell(row=1, column=1, value=college_name)
    cell_r1.font = font_title
    cell_r1.alignment = align_center
    ws.row_dimensions[1].height = 28

    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=total_cols)
    cell_r2 = ws.cell(row=2, column=1, value=department_name)
    cell_r2.font = font_subtitle
    cell_r2.alignment = align_center
    ws.row_dimensions[2].height = 24

    scope_title_suffix = " (MST-I)" if marks_type_clean == "mst1" else (" (MST-II)" if marks_type_clean == "mst2" else " (MST-I & MST-II)")
    ws.merge_cells(start_row=3, start_column=1, end_row=3, end_column=total_cols)
    cell_r3 = ws.cell(row=3, column=1, value=f"SESSION: {session_name} | {semester} SEM {exam_title}{scope_title_suffix}")
    cell_r3.font = font_session
    cell_r3.alignment = align_center
    ws.row_dimensions[3].height = 22

    # Empty spacer / Row 4 & 5 heights
    ws.row_dimensions[4].height = 24
    ws.row_dimensions[5].height = 22

    # Column A: S.NO. (Rows 4-5 merged)
    ws.merge_cells("A4:A5")
    cell_sno = ws.cell(row=4, column=1, value="S.NO.")
    cell_sno.font = font_header_main
    cell_sno.fill = fill_header_blue
    cell_sno.alignment = align_center
    cell_sno.border = header_border
    ws.cell(row=5, column=1).border = header_border
    ws.cell(row=5, column=1).fill = fill_header_blue

    # Column B: ENROLLMENT NO. (Rows 4-5 merged)
    ws.merge_cells("B4:B5")
    cell_enr = ws.cell(row=4, column=2, value="ENROLLMENT NO.")
    cell_enr.font = font_header_main
    cell_enr.fill = fill_header_blue
    cell_enr.alignment = align_center
    cell_enr.border = header_border
    ws.cell(row=5, column=2).border = header_border
    ws.cell(row=5, column=2).fill = fill_header_blue

    # Subject Columns starting at Column C (col=3)
    cur_col = 3
    for subj in sorted_subjects:
        code = subj.get("subject_code", "SUBJ")

        if marks_type_clean in ["mst1", "mst2"]:
            # Single column header per subject
            cell_sub = ws.cell(row=4, column=cur_col, value=code)
            cell_sub.font = font_subject_header
            cell_sub.fill = fill_subject
            cell_sub.alignment = align_center
            cell_sub.border = header_border

            sub_label = "MST-I" if marks_type_clean == "mst1" else "MST-II"
            cell_m = ws.cell(row=5, column=cur_col, value=sub_label)
            cell_m.font = font_sub_header
            cell_m.fill = fill_sub_header
            cell_m.alignment = align_center
            cell_m.border = header_border
            cur_col += 1
        else:
            start_c = cur_col
            end_c = cur_col + 2

            # Row 4: Merge 3 columns for Subject Code
            ws.merge_cells(start_row=4, start_column=start_c, end_row=4, end_column=end_c)
            cell_sub = ws.cell(row=4, column=start_c, value=code)
            cell_sub.font = font_subject_header
            cell_sub.fill = fill_subject
            cell_sub.alignment = align_center
            cell_sub.border = header_border
            for col_i in range(start_c, end_c + 1):
                ws.cell(row=4, column=col_i).border = header_border
                ws.cell(row=4, column=col_i).fill = fill_subject

            # Row 5: MST-I, MST-II, TOT
            cell_m1 = ws.cell(row=5, column=start_c, value="MST-I")
            cell_m1.font = font_sub_header
            cell_m1.fill = fill_sub_header
            cell_m1.alignment = align_center
            cell_m1.border = header_border

            cell_m2 = ws.cell(row=5, column=start_c + 1, value="MST-II")
            cell_m2.font = font_sub_header
            cell_m2.fill = fill_sub_header
            cell_m2.alignment = align_center
            cell_m2.border = header_border

            cell_tot = ws.cell(row=5, column=start_c + 2, value="TOT")
            cell_tot.font = font_tot_header
            cell_tot.fill = fill_yellow
            cell_tot.alignment = align_center
            cell_tot.border = header_border

            cur_col += 3

    # Write Data Rows (Starting Row 6)
    start_row = 6
    for idx, student in enumerate(students_data, start=1):
        r_num = start_row + idx - 1
        ws.row_dimensions[r_num].height = 20

        # S.No
        c_sno = ws.cell(row=r_num, column=1, value=idx)
        c_sno.font = font_data
        c_sno.alignment = align_center
        c_sno.border = thin_border

        # Enrollment No
        enr_no = str(student.get("enrollment_no", "")).upper()
        c_enr = ws.cell(row=r_num, column=2, value=enr_no)
        c_enr.font = font_data
        c_enr.alignment = align_center
        c_enr.border = thin_border

        marks_map = student.get("marks", {})
        sub_col = 3
        for subj in sorted_subjects:
            code = subj.get("subject_code", "")
            s_marks = marks_map.get(code) or marks_map.get(code.strip()) or {}

            mst1 = s_marks.get("mst1")
            mst2 = s_marks.get("mst2")

            m1_val = mst1 if mst1 is not None else 0
            m2_val = mst2 if mst2 is not None else 0
            tot_val = m1_val + m2_val

            if marks_type_clean == "mst1":
                c_m1 = ws.cell(row=r_num, column=sub_col, value=m1_val)
                c_m1.alignment = align_center
                c_m1.border = thin_border
                if m1_val < 4:
                    c_m1.font = font_fail
                    c_m1.fill = fill_fail
                else:
                    c_m1.font = font_data
                sub_col += 1
            elif marks_type_clean == "mst2":
                c_m2 = ws.cell(row=r_num, column=sub_col, value=m2_val)
                c_m2.alignment = align_center
                c_m2.border = thin_border
                if m2_val < 4:
                    c_m2.font = font_fail
                    c_m2.fill = fill_fail
                else:
                    c_m2.font = font_data
                sub_col += 1
            else:
                # Col MST-I
                c_m1 = ws.cell(row=r_num, column=sub_col, value=m1_val)
                c_m1.alignment = align_center
                c_m1.border = thin_border
                if m1_val < 4:
                    c_m1.font = font_fail
                    c_m1.fill = fill_fail
                else:
                    c_m1.font = font_data

                # Col MST-II
                c_m2 = ws.cell(row=r_num, column=sub_col + 1, value=m2_val)
                c_m2.alignment = align_center
                c_m2.border = thin_border
                if m2_val < 4:
                    c_m2.font = font_fail
                    c_m2.fill = fill_fail
                else:
                    c_m2.font = font_data

                # Col TOT with Excel Formula
                col_m1_let = get_column_letter(sub_col)
                col_m2_let = get_column_letter(sub_col + 1)
                formula_str = f"=SUM({col_m1_let}{r_num}:{col_m2_let}{r_num})"

                c_tot = ws.cell(row=r_num, column=sub_col + 2)
                c_tot.value = formula_str
                c_tot.alignment = align_center
                c_tot.border = thin_border
                if tot_val < 8:
                    c_tot.font = font_fail
                    c_tot.fill = fill_fail
                else:
                    c_tot.font = font_tot_data
                    c_tot.fill = fill_yellow

                sub_col += 3

    # Add Clean Unmerged Legend below student data (with 1 row gap)
    legend_row = start_row + len(students_data) + 1
    ws.row_dimensions[legend_row].height = 18

    cell_leg = ws.cell(row=legend_row, column=1, value="■ FAIL — Below Passing Marks (MST < 4 / TOT < 8)")
    cell_leg.font = Font(name="Calibri", size=9, bold=True, color="991B1B")
    cell_leg.alignment = Alignment(horizontal="left", vertical="center")

    # Auto-adjust Column Widths
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        if col[0].column == 1:
            ws.column_dimensions[col_letter].width = 8
        elif col[0].column == 2:
            ws.column_dimensions[col_letter].width = 20
        else:
            ws.column_dimensions[col_letter].width = 13 if marks_type_clean in ["mst1", "mst2"] else 11

    # Page Setup & Print Optimization for Official College Submissions & PDF Export
    ws.page_setup.orientation = ws.ORIENTATION_LANDSCAPE
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_title_rows = "4:5"
    ws.page_setup.horizontalCentered = True
    ws.print_area = f"A1:{last_col_letter}{legend_row}"

    ws.page_margins.left = 0.5
    ws.page_margins.right = 0.5
    ws.page_margins.top = 0.5
    ws.page_margins.bottom = 0.5

    abs_output_path = os.path.abspath(output_path)
    wb.save(abs_output_path)
    return abs_output_path
