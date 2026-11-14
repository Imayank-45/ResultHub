"""
excel_report_generator.py
--------------------------
Generates a multi-sheet structured Excel report for Student Academic Profile.
Sheets: Student Overview, Semester Summary, Subject Performance, Backlogs, Grade Distribution, Analysis.
"""

import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from backend.student_academic_analyzer.models.academic_models import AcademicProfile


def generate_student_excel_report(profile: AcademicProfile, output_path: str) -> str:
    """
    Generates a multi-sheet Excel workbook for AcademicProfile and saves to output_path.
    """
    wb = openpyxl.Workbook()
    # Remove default sheet
    default_sheet = wb.active
    wb.remove(default_sheet)

    # Styles
    header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="0F172A")
    bold_font = Font(name="Calibri", size=11, bold=True)
    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # 1. Sheet: Student Overview
    ws_ov = wb.create_sheet(title="Student Overview")
    ws_ov.views.sheetView[0].showGridLines = True
    ws_ov.append(["Student Academic Profile Overview"])
    ws_ov.cell(row=1, column=1).font = title_font
    ws_ov.append([])

    id_info = profile.identity
    ov_data = [
        ["Student Name", id_info.name],
        ["Enrollment Number", id_info.enrollment],
        ["Branch", id_info.branch],
        ["Course", id_info.course],
        ["Overall CGPA", profile.cgpa],
        ["Semesters Analyzed", len(profile.semesters)],
        ["Active Backlogs", profile.backlogs.active_backlogs],
        ["Cleared Backlogs", profile.backlogs.cleared_backlogs],
        ["Academic Risk Level", profile.analytics.risk_analysis.risk_level],
        ["Academic Consistency Score", f"{profile.analytics.consistency_score.score}/100"]
    ]

    for label, val in ov_data:
        r_idx = ws_ov.max_row + 1
        ws_ov.cell(row=r_idx, column=1, value=label).font = bold_font
        ws_ov.cell(row=r_idx, column=2, value=val)
        ws_ov.cell(row=r_idx, column=1).border = border_thin
        ws_ov.cell(row=r_idx, column=2).border = border_thin

    # 2. Sheet: Semester Summary
    ws_sem = wb.create_sheet(title="Semester Summary")
    ws_sem.views.sheetView[0].showGridLines = True
    ws_sem.append(["Semester", "SGPA", "CGPA", "Credits", "Passed Subjects", "Total Subjects"])
    for col_i in range(1, 7):
        cell = ws_sem.cell(row=1, column=col_i)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    for g in profile.analytics.gpa_trend:
        ws_sem.append([
            f"Semester {g['semester_number']}",
            g['sgpa'],
            g['cgpa'],
            g['credits'],
            g['passed_subjects'],
            g['total_subjects']
        ])

    # 3. Sheet: Subject Performance
    ws_sub = wb.create_sheet(title="Subject Performance")
    ws_sub.views.sheetView[0].showGridLines = True
    ws_sub.append(["Semester", "Subject Code", "Subject Name", "Category", "Credits", "Grade", "Status"])
    for col_i in range(1, 8):
        cell = ws_sub.cell(row=1, column=col_i)
        cell.fill = header_fill
        cell.font = header_font

    for sem in sorted(profile.semesters, key=lambda s: s.semester_number):
        for sub in sem.subjects:
            ws_sub.append([
                f"Sem {sem.semester_number}",
                sub.code,
                sub.name,
                sub.category,
                sub.credits,
                sub.grade,
                sub.status
            ])

    # 4. Sheet: Backlogs
    ws_back = wb.create_sheet(title="Backlogs")
    ws_back.views.sheetView[0].showGridLines = True
    ws_back.append(["Subject Code", "Subject Name", "First Fail Semester", "Total Attempts", "Current Status"])
    for col_i in range(1, 6):
        cell = ws_back.cell(row=1, column=col_i)
        cell.fill = header_fill
        cell.font = header_font

    for item in profile.backlogs.active_list:
        ws_back.append([
            item["code"],
            item["name"],
            f"Sem {item['first_fail_semester']}",
            item["total_attempts"],
            "ACTIVE BACKLOG"
        ])
    for item in profile.backlogs.cleared_list:
        ws_back.append([
            item["code"],
            item["name"],
            f"Sem {item['first_fail_semester']}",
            item["total_attempts"],
            f"CLEARED (Sem {item['cleared_semester']})"
        ])

    # Adjust Column Widths across all sheets
    for sheet in wb.worksheets:
        for col in sheet.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = get_column_letter(col[0].column)
            sheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

    wb.save(output_path)
    return output_path
