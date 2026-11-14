import os
from openpyxl import Workbook
from backend.mid_sem_excel_writer import generate_mid_sem_excel

session_info = {
    "academic_session": "Jan - Jun 2026",
    "year": "2nd Year",
    "semester": "IV",
    "branch": "IT",
    "program": "B.Tech."
}

subjects = [
    {"subject_code": "BT401", "mst1_max": 10, "mst2_max": 10, "total_max": 20, "display_order": 1},
    {"subject_code": "IT402", "mst1_max": 10, "mst2_max": 10, "total_max": 20, "display_order": 2},
    {"subject_code": "IT403", "mst1_max": 10, "mst2_max": 10, "total_max": 20, "display_order": 3},
    {"subject_code": "IT404", "mst1_max": 10, "mst2_max": 10, "total_max": 20, "display_order": 4},
    {"subject_code": "IT405", "mst1_max": 10, "mst2_max": 10, "total_max": 20, "display_order": 5},
]

students_data = [
    {"s_no": 1, "enrollment_no": "0105IT241001", "student_name": "", "marks": {"BT401": {"mst1": 8, "mst2": 9, "total": 17}}},
    {"s_no": 2, "enrollment_no": "0105IT241002", "student_name": "", "marks": {"BT401": {"mst1": 7, "mst2": 8, "total": 15}}},
]

out_file = os.path.abspath("test_freeze_output.xlsx")
generate_mid_sem_excel(session_info, subjects, students_data, out_file)
print("Generated excel at:", out_file)
