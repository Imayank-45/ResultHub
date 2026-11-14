import sys
import os
from openpyxl import load_workbook

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.mid_sem_excel_writer import generate_mid_sem_excel

def test_excel_marks_types():
    session_info = {
        "academic_session": "Jan - Jun 2026",
        "semester": "IV",
        "branch": "CSE",
        "program": "B.Tech."
    }
    subjects = [
        {"subject_code": "BT401", "display_order": 1},
        {"subject_code": "CS402", "display_order": 2},
        {"subject_code": "CS403", "display_order": 3},
    ]
    students_data = [
        {
            "enrollment_no": "0105CS241001",
            "marks": {
                "BT401": {"mst1": 8, "mst2": 9},
                "CS402": {"mst1": 7, "mst2": 8},
                "CS403": {"mst1": 9, "mst2": 9}
            }
        },
        {
            "enrollment_no": "0105CS241002",
            "marks": {
                "BT401": {"mst1": 10, "mst2": 10},
                "CS402": {"mst1": 9, "mst2": 9},
                "CS403": {"mst1": 8, "mst2": 8}
            }
        },
        {
            "enrollment_no": "0105CS241003",
            "marks": {
                "BT401": {"mst1": 3, "mst2": 4},
                "CS402": {"mst1": 2, "mst2": 5},
                "CS403": {"mst1": 5, "mst2": 2}
            }
        },
    ]

    out_dir = os.path.join(PROJECT_ROOT, "data")
    os.makedirs(out_dir, exist_ok=True)

    # 1. Test MST-I Only
    path_mst1 = os.path.join(out_dir, "test_out_mst1.xlsx")
    generate_mid_sem_excel(session_info, subjects, students_data, path_mst1, marks_type="mst1")
    wb1 = load_workbook(path_mst1)
    ws1 = wb1.active
    # Expected columns: S.No (Col 1), Enrollment No (Col 2), BT401 (Col 3), CS402 (Col 4), CS403 (Col 5) -> Total 5 cols
    assert ws1.max_column == 5, f"Expected 5 cols for MST-I Only, got {ws1.max_column}"
    assert ws1.cell(row=4, column=3).value == "BT401"
    assert ws1.cell(row=5, column=3).value == "MST-I"
    assert ws1.cell(row=6, column=3).value == 8
    # Check student 3 failing mark cell formatting (mst1 = 3 < 4)
    c_fail = ws1.cell(row=8, column=3)
    assert c_fail.value == 3
    assert c_fail.fill.start_color.rgb == "00FEE2E2"
    assert c_fail.font.color.rgb == "00991B1B"
    wb1.close()
    print("[PASS] Test 1: MST-I Only Excel generated correctly with FAIL cell formatting!")

    # 2. Test MST-II Only
    path_mst2 = os.path.join(out_dir, "test_out_mst2.xlsx")
    generate_mid_sem_excel(session_info, subjects, students_data, path_mst2, marks_type="mst2")
    wb2 = load_workbook(path_mst2)
    ws2 = wb2.active
    assert ws2.max_column == 5, f"Expected 5 cols for MST-II Only, got {ws2.max_column}"
    assert ws2.cell(row=4, column=3).value == "BT401"
    assert ws2.cell(row=5, column=3).value == "MST-II"
    assert ws2.cell(row=6, column=3).value == 9
    wb2.close()
    print("[PASS] Test 2: MST-II Only Excel generated correctly!")

    # 3. Test Full Result (MST-I + MST-II + Total)
    path_all = os.path.join(out_dir, "test_out_all.xlsx")
    generate_mid_sem_excel(session_info, subjects, students_data, path_all, marks_type="all")
    wb3 = load_workbook(path_all)
    ws3 = wb3.active
    assert ws3.max_column == 11, f"Expected 11 cols for Full Result, got {ws3.max_column}"
    assert ws3.cell(row=4, column=3).value == "BT401"
    assert ws3.cell(row=5, column=3).value == "MST-I"
    assert ws3.cell(row=5, column=4).value == "MST-II"
    assert ws3.cell(row=5, column=5).value == "TOT"
    assert ws3.cell(row=6, column=5).value == "=SUM(C6:D6)"
    
    # Check student 3 TOT cell (mst1=3, mst2=4 -> tot=7 < 8 -> FAIL fill FEE2E2)
    c_tot_fail = ws3.cell(row=8, column=5)
    assert c_tot_fail.fill.start_color.rgb == "00FEE2E2"
    assert c_tot_fail.font.color.rgb == "00991B1B"

    # Check legend row (row 9)
    c_leg = ws3.cell(row=9, column=1)
    assert "FAIL" in c_leg.value
    wb3.close()
    print("[PASS] Test 3: Full Result Excel generated correctly with legend row!")

if __name__ == "__main__":
    test_excel_marks_types()
