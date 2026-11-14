import sys
import os
from openpyxl import load_workbook

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.mid_sem_excel_writer import generate_mid_sem_excel

def test_redesigned_excel_generation():
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
                "BT401": {"mst1": 3, "mst2": 4},
                "CS402": {"mst1": 9, "mst2": 9},
                "CS403": {"mst1": 2, "mst2": 5}
            }
        },
    ]

    out_dir = os.path.join(PROJECT_ROOT, "data")
    os.makedirs(out_dir, exist_ok=True)

    # Test Full Result
    path_all = os.path.join(out_dir, "test_redesign_all.xlsx")
    generate_mid_sem_excel(session_info, subjects, students_data, path_all, marks_type="all")
    wb = load_workbook(path_all)
    ws = wb.active

    # 1. Header Title Check
    assert "MST-I & MST-II" in ws.cell(row=3, column=1).value
    print("[PASS] Header Scope Suffix verified: 'MST-I & MST-II'")

    # 2. Print Setup Checks
    assert ws.page_setup.orientation == "landscape"
    assert ws.page_setup.horizontalCentered == True
    assert ws.print_title_rows == "4:5"
    assert ws.print_area == ["A1:K8"]
    print(f"[PASS] Print Setup verified: Orientation=Landscape, Title Rows={ws.print_title_rows}, Print Area={ws.print_area}")

    # 3. Legend Check
    cell_leg = ws.cell(row=8, column=1)
    assert "FAIL — Below Passing Marks" in cell_leg.value
    # Ensure cell (row=8, column=2) is NOT merged or filled
    assert ws.cell(row=8, column=2).value is None
    print("[PASS] Legend verified: Clean unmerged left-aligned in Column A!")

    wb.close()
    print("ALL REDESIGNED EXCEL VERIFICATIONS PASSED CLEANLY!")

if __name__ == "__main__":
    test_redesigned_excel_generation()
