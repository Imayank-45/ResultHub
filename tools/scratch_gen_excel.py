import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.mid_sem_excel_writer import generate_mid_sem_excel

def main():
    session_info = {
        "academic_session": "Jan - Jun 2026",
        "semester": "IV",
        "branch": "CSE",
        "program": "B.Tech."
    }
    subjects = [
        {"subject_code": "BT401", "display_order": 1},
        {"subject_code": "AL302", "display_order": 2},
        {"subject_code": "AL303", "display_order": 3},
    ]
    students_data = [
        {"enrollment_no": "0105CS241001", "marks": {"BT401": {"mst1": 8, "mst2": 9}, "AL302": {"mst1": 7, "mst2": 8}, "AL303": {"mst1": 9, "mst2": 9}}},
        {"enrollment_no": "0105CS241002", "marks": {"BT401": {"mst1": 10, "mst2": 10}, "AL302": {"mst1": 9, "mst2": 9}, "AL303": {"mst1": 8, "mst2": 8}}},
    ]
    output_path = os.path.join(PROJECT_ROOT, "test_excel_output_v2.xlsx")
    res = generate_mid_sem_excel(session_info, subjects, students_data, output_path)
    print("Excel generated successfully at:", res)

if __name__ == "__main__":
    main()
