import os
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

def test_excel_freeze():
    wb = Workbook()
    ws = wb.active
    ws.title = "Mid-Sem Marks"

    subjects = [
        {"subject_code": "BT401"},
        {"subject_code": "IT402"},
        {"subject_code": "IT403"},
        {"subject_code": "IT404"},
        {"subject_code": "IT405"},
    ]

    students_data = [
        {"s_no": 1, "enrollment_no": "0105IT241001", "student_name": ""},
        {"s_no": 2, "enrollment_no": "0105IT241002", "student_name": ""},
    ]

    total_cols = 3 + (len(subjects) * 3) + 1
    last_col_letter = get_column_letter(total_cols)

    # Styles
    font_title = Font(name="Calibri", size=13, bold=True, color="1E3A8A")
    font_subtitle = Font(name="Calibri", size=11, bold=True, color="1E293B")
    font_session = Font(name="Calibri", size=10, bold=True, color="334155")

    font_header_main = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    font_subject_header = Font(name="Calibri", size=11, bold=True, color="0F172A")
    font_sub_header = Font(name="Calibri", size=10, bold=True, color="0F172A")
    font_tot_header = Font(name="Calibri", size=10, bold=True, color="854D0E")

    fill_header_blue = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    fill_subject = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
    fill_yellow = PatternFill(start_color="FEF08A", end_color="FEF08A", fill_type="solid")
    fill_sub_header = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    dark_side = Side(style="thin", color="475569")
    header_border = Border(left=dark_side, right=dark_side, top=dark_side, bottom=dark_side)
    align_center = Alignment(horizontal="center", vertical="center")

    # Row 1-3 Titles: Merge A1:C1 for Frozen block, and D1:last_col for Subject block (NEVER cross C|D split)
    ws.merge_cells("A1:C1")
    ws.cell(row=1, column=1, value="OIST BHOPAL").font = font_title
    ws.cell(row=1, column=1).alignment = align_center

    ws.merge_cells(f"D1:{last_col_letter}1")
    ws.cell(row=1, column=4, value="ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY, BHOPAL").font = font_title
    ws.cell(row=1, column=4).alignment = align_center

    ws.merge_cells("A2:C2")
    ws.cell(row=2, column=1, value="MID-SEM MARKS").font = font_subtitle
    ws.cell(row=2, column=1).alignment = align_center

    ws.merge_cells(f"D2:{last_col_letter}2")
    ws.cell(row=2, column=4, value="DEPARTMENT OF INFORMATION TECHNOLOGY").font = font_subtitle
    ws.cell(row=2, column=4).alignment = align_center

    ws.merge_cells("A3:C3")
    ws.cell(row=3, column=1, value="SESSION 2026").font = font_session
    ws.cell(row=3, column=1).alignment = align_center

    ws.merge_cells(f"D3:{last_col_letter}3")
    ws.cell(row=3, column=4, value="SESSION: JAN - JUN 2026 | IV SEM MID SEM MARKS").font = font_session
    ws.cell(row=3, column=4).alignment = align_center

    # Row 4-5 Student Headers (Cols A:C)
    ws.merge_cells("A4:A5")
    cell_sno = ws.cell(row=4, column=1, value="S.NO.")
    cell_sno.font = font_header_main
    cell_sno.fill = fill_header_blue
    cell_sno.alignment = align_center
    cell_sno.border = header_border
    ws.cell(row=5, column=1).border = header_border
    ws.cell(row=5, column=1).fill = fill_header_blue

    ws.merge_cells("B4:B5")
    cell_enr = ws.cell(row=4, column=2, value="ENROLLMENT NO")
    cell_enr.font = font_header_main
    cell_enr.fill = fill_header_blue
    cell_enr.alignment = align_center
    cell_enr.border = header_border
    ws.cell(row=5, column=2).border = header_border
    ws.cell(row=5, column=2).fill = fill_header_blue

    ws.merge_cells("C4:C5")
    cell_name = ws.cell(row=4, column=3, value="NAME OF STUDENT")
    cell_name.font = font_header_main
    cell_name.fill = fill_header_blue
    cell_name.alignment = align_center
    cell_name.border = header_border
    ws.cell(row=5, column=3).border = header_border
    ws.cell(row=5, column=3).fill = fill_header_blue

    # Subject Columns starting at D (Col 4)
    cur_col = 4
    for subj in subjects:
        code = subj["subject_code"]
        start_c = cur_col
        end_c = cur_col + 2

        ws.merge_cells(start_row=4, start_column=start_c, end_row=4, end_column=end_c)
        cell_sub = ws.cell(row=4, column=start_c, value=code)
        cell_sub.font = font_subject_header
        cell_sub.fill = fill_subject
        cell_sub.alignment = align_center
        cell_sub.border = header_border
        for col_i in range(start_c, end_c + 1):
            ws.cell(row=4, column=col_i).border = header_border
            ws.cell(row=4, column=col_i).fill = fill_subject

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


    # Data Rows (starting row 6)
    for idx, student in enumerate(students_data, start=1):
        r_num = 6 + idx - 1
        ws.cell(row=r_num, column=1, value=idx)
        ws.cell(row=r_num, column=2, value=student["enrollment_no"])
        ws.cell(row=r_num, column=3, value=student["student_name"])

    # Freeze panes at D6 (Freeze cols A:C, rows 1:5)
    ws.freeze_panes = "D6"

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(BASE_DIR, "data")
    os.makedirs(data_dir, exist_ok=True)
    out_file = os.path.join(data_dir, "test_freeze_clean.xlsx")
    wb.save(out_file)
    print("Saved clean freeze file to:", out_file)
    print("Merged cell ranges in sheet:")
    for rng in ws.merged_cells.ranges:
        print(" -", rng)

if __name__ == "__main__":
    test_excel_freeze()
