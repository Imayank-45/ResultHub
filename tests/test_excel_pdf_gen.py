from backend.mid_sem_excel_writer import generate_mid_sem_excel

session_info = {
    "academic_session": "Jan - Jun 2026",
    "year": "2nd Year",
    "semester": "IV",
    "branch": "CS",
    "program": "B.Tech."
}

subjects = [
    {"id": 1, "subject_code": "BT401", "subject_name": "Maths-III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1},
    {"id": 2, "subject_code": "CS402", "subject_name": "Analysis & Design of Alg", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2}
]

students_data = [
    {
        "s_no": 1,
        "enrollment_no": "0105CS241001",
        "student_name": "Aadil Shah",
        "marks": {
            "BT401": {"mst1": 8, "mst2": 9, "total": 17},
            "CS402": {"mst1": 3, "mst2": 5, "total": 8}
        }
    }
]

try:
    path = generate_mid_sem_excel(session_info, subjects, students_data, "data/test_out.xlsx", "all")
    print("Excel Success:", path)
except Exception as e:
    import traceback
    print("Excel Error:")
    traceback.print_exc()
