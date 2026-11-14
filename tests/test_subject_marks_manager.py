import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.subject_marks_router import (
    generate_subject_marks_excel,
    SingleSubjectExcelRequest,
    SingleSubjectStudentItem
)

def test_subject_marks_manager():
    print("============================================================")
    print("Testing Standalone Subject Marks Manager API (Granular Absent)...")
    print("============================================================")

    students_sample = [
        SingleSubjectStudentItem(s_no=1, enrollment_no="0105IT241001", mst1=8.5, mst2=9.0, total=17.5),
        SingleSubjectStudentItem(s_no=2, enrollment_no="0105IT241002", mst1=5.0, mst2_absent=True, total=5.0), # MST-2 Absent only
        SingleSubjectStudentItem(s_no=3, enrollment_no="0105IT241003", mst1_absent=True, mst2=7.0, total=7.0), # MST-1 Absent only
        SingleSubjectStudentItem(s_no=4, enrollment_no="0105IT241004", mst1_absent=True, mst2_absent=True, total=0), # Both Absent
        SingleSubjectStudentItem(s_no=5, enrollment_no="0105IT241005", mst1=10.0, mst2=10.0, total=20.0),
    ]

    # 1. Test BOTH mode
    req_both = SingleSubjectExcelRequest(
        subject_name="Data Structures",
        subject_code="IT401",
        semester="IV",
        academic_session="Jan - Jun 2026",
        marks_type="both",
        students=students_sample
    )
    resp_both = generate_subject_marks_excel(req_both, current_user=None)
    assert os.path.exists(resp_both.path), "Excel file for Both mode was not generated."
    print(f"[PASS] BOTH mode Excel generated: {resp_both.path}")

    # 2. Test MST-I mode
    req_mst1 = SingleSubjectExcelRequest(
        subject_name="Data Structures",
        subject_code="IT401",
        semester="IV",
        academic_session="Jan - Jun 2026",
        marks_type="mst1",
        students=students_sample
    )
    resp_mst1 = generate_subject_marks_excel(req_mst1, current_user=None)
    assert os.path.exists(resp_mst1.path), "Excel file for MST-I mode was not generated."
    print(f"[PASS] MST-I mode Excel generated: {resp_mst1.path}")

    # 3. Test MST-II mode
    req_mst2 = SingleSubjectExcelRequest(
        subject_name="Data Structures",
        subject_code="IT401",
        semester="IV",
        academic_session="Jan - Jun 2026",
        marks_type="mst2",
        students=students_sample
    )
    resp_mst2 = generate_subject_marks_excel(req_mst2, current_user=None)
    assert os.path.exists(resp_mst2.path), "Excel file for MST-II mode was not generated."
    print(f"[PASS] MST-II mode Excel generated: {resp_mst2.path}")

    print("============================================================")
    print("ALL SUBJECT MARKS MANAGER TESTS PASSED SUCCESSFULLY!")
    print("============================================================")

if __name__ == "__main__":
    test_subject_marks_manager()
