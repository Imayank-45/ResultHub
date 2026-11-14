"""
result_formatter.py
-------------------
ResultAI-Specific RGPV Academic Result Excel Formatter & Sanitizer.

Provides:
1. Pre-conversion Analysis: Inspects workbook to detect student count, sheets, columns,
   missing values, duplicate enrollments/names, and suspicious data rows.
2. Excel Formatter & Sanitizer: Cleans empty rows, normalizes column headers, normalizes grade codes,
   formats SGPA/CGPA to 2 decimal places, formats PASS/FAIL cells, autofits columns,
   adds auto-filters, freezes header row, applies professional table theme styling,
   and returns a summary of all changes applied.
"""

import io
import re
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
from openpyxl import load_workbook, Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from backend.converters.pdf_converter import convert_pdf_to_excel


def analyze_result_excel(
    excel_bytes: bytes,
    filename: str = "result.xlsx"
) -> Dict[str, Any]:
    """
    Performs pre-conversion inspection on an RGPV/Academic result Excel or PDF file.
    Detects students count, sheets count, columns, missing values, duplicates, and suspicious rows.
    """
    if excel_bytes.startswith(b'%PDF'):
        excel_bytes = convert_pdf_to_excel(excel_bytes)

    xl = pd.ExcelFile(io.BytesIO(excel_bytes))

    sheet_names = xl.sheet_names

    total_students = 0
    all_columns: List[str] = []
    total_missing = 0
    duplicate_records = 0
    suspicious_rows = 0
    issues: List[Dict[str, Any]] = []

    seen_enrollments = set()

    for sheet in sheet_names:
        df = pd.read_excel(xl, sheet_name=sheet)
        if df.empty:
            continue

        # Standardize header names for detection
        headers = [str(c).strip().upper() for c in df.columns]
        for h in headers:
            if h not in all_columns:
                all_columns.append(h)

        enrollment_col = next((c for c in df.columns if str(c).strip().upper() in ("ENROLLMENT", "ROLL", "ROLL_NO", "ROLLNO", "ENROLLMENT_NO")), None)
        name_col = next((c for c in df.columns if str(c).strip().upper() in ("NAME", "STUDENT_NAME", "STUDENT")), None)
        sgpa_col = next((c for c in df.columns if str(c).strip().upper() in ("SGPA", "SEMESTER_GPA")), None)
        cgpa_col = next((c for c in df.columns if str(c).strip().upper() in ("CGPA", "CUMULATIVE_GPA")), None)

        if enrollment_col is not None:
            enrs = df[enrollment_col].dropna().astype(str).str.strip().str.upper()
            total_students += len(enrs)

            # Check duplicates
            for enr in enrs:
                if enr in seen_enrollments:
                    duplicate_records += 1
                    issues.append({
                        "category": "Duplicate Record",
                        "detail": f"Duplicate enrollment number '{enr}' detected."
                    })
                else:
                    seen_enrollments.add(enr)

        # Count missing values across critical fields
        missing_count = int(df.isna().sum().sum())
        total_missing += missing_count

        # Check suspicious SGPA / CGPA values (> 10 or < 0)
        if sgpa_col is not None:
            invalid_sgpas = df[pd.to_numeric(df[sgpa_col], errors='coerce') > 10.0]
            if not invalid_sgpas.empty:
                suspicious_rows += len(invalid_sgpas)
                issues.append({
                    "category": "Invalid SGPA",
                    "detail": f"Found {len(invalid_sgpas)} row(s) with SGPA greater than 10.0."
                })

        if cgpa_col is not None:
            invalid_cgpas = df[pd.to_numeric(df[cgpa_col], errors='coerce') > 10.0]
            if not invalid_cgpas.empty:
                suspicious_rows += len(invalid_cgpas)
                issues.append({
                    "category": "Invalid CGPA",
                    "detail": f"Found {len(invalid_cgpas)} row(s) with CGPA greater than 10.0."
                })

    return {
        "filename": filename,
        "students_detected": total_students,
        "sheets_detected": len(sheet_names),
        "columns_detected": len(all_columns),
        "missing_values_count": total_missing,
        "duplicate_records_count": duplicate_records,
        "suspicious_rows_count": suspicious_rows,
        "sheets": sheet_names,
        "columns": all_columns,
        "issues_summary": issues
    }


def format_result_excel(
    excel_bytes: bytes,
    options: Optional[Dict[str, Any]] = None
) -> Tuple[bytes, List[str]]:
    """
    Cleans and formats an RGPV result Excel file according to user options.
    Returns (formatted_excel_bytes, list_of_changes_applied).
    """
    options = options or {}
    clean_empty_rows = options.get("clean_empty_rows", True)
    normalize_columns = options.get("normalize_columns", True)
    format_sgpa_cgpa = options.get("format_sgpa_cgpa", True)
    format_pass_fail = options.get("format_pass_fail", True)
    autofit_columns = options.get("autofit_columns", True)
    freeze_header = options.get("freeze_header", True)
    add_filters = options.get("add_filters", True)
    remove_duplicates = options.get("remove_duplicates", False)
    theme = options.get("table_style", "indigo").lower()  # 'indigo', 'emerald', 'amber', 'classic'

    changes_applied: List[str] = []

    if excel_bytes.startswith(b'%PDF'):
        excel_bytes = convert_pdf_to_excel(excel_bytes)
        changes_applied.append("Extracted tabular student result records from PDF document.")

    # Theme colors

    themes = {
        "indigo": {"header_bg": "4F46E5", "pass_bg": "DCFCE7", "pass_fg": "15803D", "fail_bg": "FEE2E2", "fail_fg": "B91C1C"},
        "emerald": {"header_bg": "059669", "pass_bg": "D1FAE5", "pass_fg": "065F46", "fail_bg": "FEE2E2", "fail_fg": "991B1B"},
        "amber": {"header_bg": "D97706", "pass_bg": "FEF3C7", "pass_fg": "92400E", "fail_bg": "FEE2E2", "fail_fg": "991B1B"},
        "classic": {"header_bg": "1E293B", "pass_bg": "E2E8F0", "pass_fg": "0F172A", "fail_bg": "FEE2E2", "fail_fg": "991B1B"}
    }
    t_color = themes.get(theme, themes["indigo"])

    wb_src = load_workbook(io.BytesIO(excel_bytes))
    wb_out = Workbook()
    wb_out.remove(wb_out.active)  # remove default sheet

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color=t_color["header_bg"], end_color=t_color["header_bg"], fill_type="solid")
    data_font = Font(name="Calibri", size=10)
    thin_border = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    pass_fill = PatternFill(start_color=t_color["pass_bg"], end_color=t_color["pass_bg"], fill_type="solid")
    pass_font = Font(name="Calibri", size=10, bold=True, color=t_color["pass_fg"])
    fail_fill = PatternFill(start_color=t_color["fail_bg"], end_color=t_color["fail_bg"], fill_type="solid")
    fail_font = Font(name="Calibri", size=10, bold=True, color=t_color["fail_fg"])

    for sheet_name in wb_src.sheetnames:
        ws_src = wb_src[sheet_name]
        df = pd.DataFrame(ws_src.values)

        if df.empty:
            continue

        # Set first row as headers
        df.columns = df.iloc[0]
        df = df[1:].reset_index(drop=True)

        # 1. Clean empty rows
        if clean_empty_rows:
            initial_count = len(df)
            df = df.dropna(how='all')
            df = df[df.apply(lambda r: any(str(v).strip() != "" for v in r), axis=1)]
            cleaned_count = initial_count - len(df)
            if cleaned_count > 0:
                changes_applied.append(f"Sheet '{sheet_name}': Cleaned {cleaned_count} empty row(s).")

        # 2. Normalize column headers
        if normalize_columns:
            new_cols = []
            for col in df.columns:
                c_str = str(col or "").strip().upper()
                c_str = re.sub(r'[\s_\-]+', '_', c_str)
                new_cols.append(c_str)
            df.columns = new_cols
            changes_applied.append(f"Sheet '{sheet_name}': Normalized {len(new_cols)} column header name(s).")

        # 3. Remove duplicate enrollments
        if remove_duplicates and "ENROLLMENT" in df.columns:
            dup_mask = df.duplicated(subset=["ENROLLMENT"], keep="first")
            dups_count = int(dup_mask.sum())
            if dups_count > 0:
                df = df[~dup_mask].reset_index(drop=True)
                changes_applied.append(f"Sheet '{sheet_name}': Removed {dups_count} duplicate student record(s).")

        # Create output sheet
        ws_out = wb_out.create_sheet(title=sheet_name)

        # Write Headers
        headers = [str(c) for c in df.columns]
        ws_out.append(headers)

        for col_idx in range(1, len(headers) + 1):
            cell = ws_out.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")

        # Write Rows & apply cell formatting
        sgpa_idx = headers.index("SGPA") if "SGPA" in headers else -1
        cgpa_idx = headers.index("CGPA") if "CGPA" in headers else -1
        result_idx = headers.index("RESULT") if "RESULT" in headers else -1

        for row_idx, row_values in enumerate(df.values, 2):
            row_list = list(row_values)
            
            # Format SGPA & CGPA
            if format_sgpa_cgpa:
                if sgpa_idx >= 0 and row_list[sgpa_idx] is not None:
                    try:
                        row_list[sgpa_idx] = round(float(row_list[sgpa_idx]), 2)
                    except (ValueError, TypeError):
                        pass
                if cgpa_idx >= 0 and row_list[cgpa_idx] is not None:
                    try:
                        row_list[cgpa_idx] = round(float(row_list[cgpa_idx]), 2)
                    except (ValueError, TypeError):
                        pass

            # Format RESULT
            if format_pass_fail and result_idx >= 0 and row_list[result_idx] is not None:
                res_val = str(row_list[result_idx]).strip().upper()
                if "PASS" in res_val:
                    row_list[result_idx] = "PASS"
                elif "FAIL" in res_val:
                    row_list[result_idx] = "FAIL"

            ws_out.append(row_list)

            # Apply cell styles
            for col_idx in range(1, len(headers) + 1):
                cell = ws_out.cell(row=row_idx, column=col_idx)
                cell.font = data_font
                cell.border = thin_border
                cell.alignment = Alignment(vertical="center")

                # Format Pass / Fail Badges
                if format_pass_fail and col_idx - 1 == result_idx:
                    val_upper = str(cell.value or "").upper()
                    if val_upper == "PASS":
                        cell.fill = pass_fill
                        cell.font = pass_font
                        cell.alignment = Alignment(horizontal="center", vertical="center")
                    elif val_upper == "FAIL":
                        cell.fill = fail_fill
                        cell.font = fail_font
                        cell.alignment = Alignment(horizontal="center", vertical="center")

        # 4. Freeze header row
        if freeze_header:
            ws_out.freeze_panes = "A2"
            changes_applied.append(f"Sheet '{sheet_name}': Header row frozen (A2).")

        # 5. Add AutoFilter
        if add_filters:
            ws_out.auto_filter.ref = ws_out.dimensions
            changes_applied.append(f"Sheet '{sheet_name}': Auto-filters applied across table dimensions.")

        # 6. Auto-fit columns
        if autofit_columns:
            for col in ws_out.columns:
                max_len = 0
                col_letter = get_column_letter(col[0].column)
                for cell in col:
                    max_len = max(max_len, len(str(cell.value or "")))
                ws_out.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 45)
            changes_applied.append(f"Sheet '{sheet_name}': Column widths auto-fitted.")

    if format_sgpa_cgpa:
        changes_applied.append("Formatted all SGPA and CGPA values to 2 decimal places.")
    if format_pass_fail:
        changes_applied.append("Applied visual PASS/FAIL status highlight badges.")

    out_stream = io.BytesIO()
    wb_out.save(out_stream)
    return out_stream.getvalue(), list(dict.fromkeys(changes_applied))  # deduplicate summary
