"""
excel_writer.py
---------------
Generates a professionally styled Excel spreadsheet from student result records using openpyxl.
"""

from __future__ import annotations

import os
from typing import List, Dict, Any

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter


def write_excel(
    records: List[Dict[str, Any]], 
    output_path: str,
    selected_fields: Optional[List[str]] = None
) -> None:
    """
    Writes student records to an Excel file formatted with headers, 
    dynamic subject columns, and auto-adjusted column widths.

    :param records: List of student record dictionaries (from parser or scraper)
    :param output_path: File path where the .xlsx file should be saved
    :param selected_fields: Optional list of field keys to include in custom export
    """
    # Create parent directories if needed
    dirname = os.path.dirname(output_path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)

    wb = Workbook()
    ws = wb.active
    ws.title = "RGPV Results"

    # Collect all unique subject codes in insertion order (excluding NC301)
    subject_codes: List[str] = []
    for rec in records:
        if not rec.get("not_found") and "subjects" in rec and isinstance(rec["subjects"], dict):
            for code in rec["subjects"].keys():
                if code and isinstance(code, str) and code.strip():
                    clean_code = code.strip()
                    if "NC301" in clean_code.upper():
                        continue
                    if clean_code not in subject_codes:
                        subject_codes.append(clean_code)

    # Standard Default Headers
    default_headers = ["S.NO", "ENROLLMENT", "NAME"] + subject_codes + ["RESULT", "SGPA", "CGPA"]

    if not selected_fields:
        headers = default_headers
        custom_mode = False
    else:
        custom_mode = True
        headers = ["S.NO"]
        field_set = set(selected_fields)

        # Student details
        if "student_roll" in field_set:
            headers.append("ROLL NO")
        if "student_name" in field_set:
            headers.append("NAME")
        if "student_course" in field_set:
            headers.append("COURSE")
        if "student_branch" in field_set:
            headers.append("BRANCH")
        if "student_semester" in field_set:
            headers.append("SEMESTER")
        if "student_status" in field_set:
            headers.append("STATUS")

        # Subject details
        include_subject_grade = "subject_grade" in field_set or "subject_code" in field_set
        include_total_credit = "subject_total_credit" in field_set
        include_earned_credit = "subject_earned_credit" in field_set

        for sc in subject_codes:
            if include_subject_grade and not include_total_credit and not include_earned_credit:
                headers.append(sc)
            else:
                if include_subject_grade:
                    headers.append(f"{sc} (Grade)")
                if include_total_credit:
                    headers.append(f"{sc} (Total Credit)")
                if include_earned_credit:
                    headers.append(f"{sc} (Earned Credit)")

        # Result details
        if "result_status" in field_set:
            headers.append("RESULT")
        if "result_sgpa" in field_set:
            headers.append("SGPA")
        if "result_cgpa" in field_set:
            headers.append("CGPA")

        # Additional details
        if "reval_date" in field_set:
            headers.append("REVALUATION DATE")
        if "reval_date_late" in field_set:
            headers.append("REVALUATION DATE (LATE FEE)")

        # If user deselected everything, fall back to default
        if len(headers) == 1:
            headers = default_headers
            custom_mode = False

    ws.append(headers)

    # Styling definitions
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=False)

    thin_border = Border(
        left=Side(style="thin", color="D3D3D3"),
        right=Side(style="thin", color="D3D3D3"),
        top=Side(style="thin", color="D3D3D3"),
        bottom=Side(style="thin", color="D3D3D3")
    )

    pass_fill = PatternFill(start_color="D1E7DD", end_color="D1E7DD", fill_type="solid")
    pass_font = Font(name="Calibri", size=11, bold=True, color="0F5132")
    
    fail_fill = PatternFill(start_color="F8D7DA", end_color="F8D7DA", fill_type="solid")
    fail_font = Font(name="Calibri", size=11, bold=True, color="842029")

    not_found_fill = PatternFill(start_color="E9ECEF", end_color="E9ECEF", fill_type="solid")
    not_found_font = Font(name="Calibri", size=11, bold=True, color="495057")

    data_font = Font(name="Calibri", size=11, color="0F172A")
    
    # High-contrast bold styling for SGPA and CGPA metrics
    metric_font = Font(name="Calibri", size=11, bold=True, color="0F172A")
    metric_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    # Style Header Row
    ws.row_dimensions[1].height = 32
    for col_num in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_num)
        cell.value = headers[col_num - 1]
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    # Write Data Rows
    for idx, rec in enumerate(records, start=1):
        row_num = idx + 1
        ws.row_dimensions[row_num].height = 20

        if not custom_mode:
            if rec.get("not_found"):
                enrollment = rec.get("enrollment", "")
                row_data = [idx, enrollment, "NOT FOUND"] + ["-"] * len(subject_codes) + ["NOT FOUND", "-", "-"]
            else:
                enrollment = rec.get("enrollment", "")
                name = rec.get("name", "")
                subjects_map = rec.get("subjects", {}) if isinstance(rec.get("subjects"), dict) else {}
                grades = [subjects_map.get(sc, "-") for sc in subject_codes]
                result = str(rec.get("result", "UNKNOWN")).upper()
                sgpa = rec.get("sgpa") if rec.get("sgpa") is not None else "-"
                cgpa = rec.get("cgpa") if rec.get("cgpa") is not None else "-"

                row_data = [idx, enrollment, name] + grades + [result, sgpa, cgpa]
        else:
            is_nf = bool(rec.get("not_found"))
            subjects_map = rec.get("subjects") if isinstance(rec.get("subjects"), dict) else {}
            sub_credits_map = rec.get("subject_credits") if isinstance(rec.get("subject_credits"), dict) else {}
            
            row_data = [idx]
            for h in headers[1:]:
                if h in ["ROLL NO", "ENROLLMENT"]:
                    row_data.append(rec.get("enrollment", "-"))
                elif h == "NAME":
                    row_data.append("NOT FOUND" if is_nf else rec.get("name", "-"))
                elif h == "COURSE":
                    row_data.append(rec.get("course", rec.get("program", "B.Tech.")))
                elif h == "BRANCH":
                    row_data.append(rec.get("branch", "IT"))
                elif h == "SEMESTER":
                    row_data.append(str(rec.get("semester", rec.get("sem", "3"))))
                elif h == "STATUS":
                    row_data.append(rec.get("status", "REGULAR"))
                elif h == "RESULT":
                    row_data.append("NOT FOUND" if is_nf else str(rec.get("result", "UNKNOWN")).upper())
                elif h == "SGPA":
                    row_data.append("-" if is_nf or rec.get("sgpa") is None else rec.get("sgpa"))
                elif h == "CGPA":
                    row_data.append("-" if is_nf or rec.get("cgpa") is None else rec.get("cgpa"))
                elif h == "REVALUATION DATE":
                    row_data.append(rec.get("reval_date", "N/A"))
                elif h == "REVALUATION DATE (LATE FEE)":
                    row_data.append(rec.get("reval_date_late", "N/A"))
                else:
                    # Subject columns
                    matched_sc = None
                    for sc in subject_codes:
                        if h == sc or h == f"{sc} (Grade)":
                            row_data.append("-" if is_nf else subjects_map.get(sc, "-"))
                            matched_sc = sc
                            break
                        elif h == f"{sc} (Total Credit)":
                            sc_info = sub_credits_map.get(sc) if isinstance(sub_credits_map.get(sc), dict) else {}
                            row_data.append("-" if is_nf else sc_info.get("total", 4))
                            matched_sc = sc
                            break
                        elif h == f"{sc} (Earned Credit)":
                            grade_val = str(subjects_map.get(sc, "-"))
                            is_fail = grade_val.upper() in ["F", "FAIL", "AB", "ABSENT", "RL"]
                            sc_info = sub_credits_map.get(sc) if isinstance(sub_credits_map.get(sc), dict) else {}
                            earned = 0 if is_fail or is_nf else sc_info.get("earned", 4)
                            row_data.append("-" if is_nf else earned)
                            matched_sc = sc
                            break
                    if not matched_sc:
                        row_data.append("-")

        ws.append(row_data)

        # Style row cells
        result_idx = headers.index("RESULT") + 1 if "RESULT" in headers else -1
        result_str = str(ws.cell(row=row_num, column=result_idx).value).upper() if result_idx > 0 else ""

        for col_idx in range(1, len(row_data) + 1):
            cell = ws.cell(row=row_num, column=col_idx)
            cell.font = data_font
            cell.border = thin_border

            # Alignment
            header_name = headers[col_idx - 1]
            if header_name in ["NAME", "STUDENT NAME"]:
                cell.alignment = Alignment(horizontal="left", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="center", vertical="center")

            # Conditional formatting & high-contrast styling for summary columns (RESULT, SGPA, CGPA)
            if header_name == "RESULT":
                if "PASS" in result_str:
                    cell.fill = pass_fill
                    cell.font = pass_font
                elif "FAIL" in result_str:
                    cell.fill = fail_fill
                    cell.font = fail_font
                elif "NOT FOUND" in result_str:
                    cell.fill = not_found_fill
                    cell.font = not_found_font
            elif header_name in ["SGPA", "CGPA"]:
                cell.fill = metric_fill
                cell.font = metric_font

    # Auto-adjust column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 6, 14)

    wb.save(output_path)

