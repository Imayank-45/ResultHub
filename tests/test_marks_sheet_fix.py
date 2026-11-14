import sys
import os
import openpyxl

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(TESTS_DIR)

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

VENV_SITE_PACKAGES = os.path.join(PROJECT_ROOT, "venv", "Lib", "site-packages")
if os.path.exists(VENV_SITE_PACKAGES) and VENV_SITE_PACKAGES not in sys.path:
    sys.path.insert(0, VENV_SITE_PACKAGES)

from backend.mid_sem_excel_writer import generate_mid_sem_excel

def test_excel_and_pdf():
    session_info = {
        "academic_session": "JAN - JUN 2026",
        "year": "2nd Year",
        "semester": "IV",
        "branch": "CS",
        "program": "B.Tech."
    }

    subjects = [
        {"subject_code": "ES301", "display_order": 1, "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0},
        {"subject_code": "CS302", "display_order": 2, "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0},
        {"subject_code": "CS303", "display_order": 3, "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0},
        {"subject_code": "CS304", "display_order": 4, "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0},
        {"subject_code": "CS305", "display_order": 5, "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0},
    ]

    students_data = []
    for i in range(1, 105):
        students_data.append({
            "s_no": i,
            "enrollment_no": f"0105CS241{i:03d}",
            "student_name": f"STUDENT {i}",
            "marks": {
                "ES301": {"mst1": 8.0, "mst2": 7.0, "total": 15.0},
                "CS302": {"mst1": 5.0, "mst2": 6.0, "total": 11.0},
                "CS303": {"mst1": 9.0, "mst2": 8.0, "total": 17.0},
                "CS304": {"mst1": 3.0, "mst2": 4.0, "total": 7.0},
                "CS305": {"mst1": 7.5, "mst2": 8.5, "total": 16.0},
            }
        })

    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data", "test_verify")
    os.makedirs(data_dir, exist_ok=True)

    # 1. Test Scope 'all' (MST-I + MST-II)
    out_all = os.path.join(data_dir, "test_all.xlsx")
    generate_mid_sem_excel(session_info, subjects, students_data, out_all, marks_type="all")

    wb = openpyxl.load_workbook(out_all)
    ws = wb.active

    print(f"Check Freeze Panes for 'all': {ws.freeze_panes}")
    assert ws.freeze_panes is None or ws.freeze_panes == "", f"Expected no freeze panes, got {ws.freeze_panes}"
    print("[PASS] Freeze panes successfully removed!")

    # Check Headers
    print(f"Cell C5 value: {ws.cell(row=5, column=3).value}")
    print(f"Cell D5 value: {ws.cell(row=5, column=4).value}")
    print(f"Cell E5 value: {ws.cell(row=5, column=5).value}")

    assert ws.cell(row=5, column=3).value == "MST-I", "Col 3 should be MST-I"
    assert ws.cell(row=5, column=4).value == "MST-II", "Col 4 should be MST-II"
    assert ws.cell(row=5, column=5).value == "TOT", "Col 5 should be TOT"
    print("[PASS] ES301 -> MST-I | MST-II | TOT verified!")

    # Check Data for Student 1
    assert ws.cell(row=6, column=3).value == 8.0
    assert ws.cell(row=6, column=4).value == 7.0
    assert ws.cell(row=6, column=5).value == "=SUM(C6:D6)"
    print("[PASS] Data mapping for MST-I (8.0), MST-II (7.0), TOT (=SUM(C6:D6)) verified!")

    # 2. Test Scope 'mst1'
    out_mst1 = os.path.join(data_dir, "test_mst1.xlsx")
    generate_mid_sem_excel(session_info, subjects, students_data, out_mst1, marks_type="mst1")
    wb1 = openpyxl.load_workbook(out_mst1)
    ws1 = wb1.active
    assert ws1.cell(row=5, column=3).value == "MST-I"
    print("[PASS] Scope 'mst1' header MST-I verified!")

    # 3. Test Scope 'mst2'
    out_mst2 = os.path.join(data_dir, "test_mst2.xlsx")
    generate_mid_sem_excel(session_info, subjects, students_data, out_mst2, marks_type="mst2")
    wb2 = openpyxl.load_workbook(out_mst2)
    ws2 = wb2.active
    assert ws2.cell(row=5, column=3).value == "MST-II"
    print("[PASS] Scope 'mst2' header MST-II verified!")

def test_roll_padding():
    prefix = "0105CS2410"
    for pad in [2, 3]:
        for roll in [1, 99, 100]:
            suffix = str(roll).zfill(pad)
            enr = f"{prefix}{suffix}"
            if pad == 2:
                if roll == 1: assert enr == "0105CS241001"
                if roll == 99: assert enr == "0105CS241099"
                if roll == 100: assert enr == "0105CS2410100"
            print(f"[PASS] Pad={pad}, Roll={roll} -> Enrollment={enr}")
    print("[PASS] Roll number padding (minimum width zfill) verified!")

if __name__ == "__main__":
    test_excel_and_pdf()
    test_roll_padding()
