import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db.database import SessionLocal
from backend.db.models import MidSemSession, MidSemStudentMarks
from backend.mid_sem_router import reset_student_marks, ResetMarksRequest, mark_students_absent, MarkAbsentRequest, resolve_students

def test_reset_marks_endpoint():
    db = SessionLocal()
    try:
        print("Running Reset Marks API Unit Test...")
        # 1. Resolve students to ensure subjects & session exist
        res_data = resolve_students(
            session_id=None,
            prefix="0105CS2410",
            start=1,
            end=5,
            branch="CS",
            semester="III",
            program="B.Tech.",
            db=db
        )
        sess = db.query(MidSemSession).filter(MidSemSession.branch == "CS", MidSemSession.semester == "III").order_by(MidSemSession.id.desc()).first()
        assert sess is not None, "Failed to resolve session."

        # 2. Mark student 0105CS241001 absent
        mark_req = MarkAbsentRequest(
            session_id=sess.id,
            enrollment_numbers=["0105CS241001"],
            absence_type="both"
        )
        mark_students_absent(mark_req, current_user=None, db=db)

        # Verify DB has absent records
        absent_count = db.query(MidSemStudentMarks).filter(
            MidSemStudentMarks.session_id == sess.id,
            MidSemStudentMarks.enrollment_no == "0105CS241001"
        ).count()
        assert absent_count > 0, "Failed to set absent records."
        print(f"[PASS] Set {absent_count} absent records in DB.")

        # 3. Reset student marks
        reset_req = ResetMarksRequest(
            session_id=sess.id,
            enrollment_numbers=["0105CS241001"]
        )
        res = reset_student_marks(reset_req, current_user=None, db=db)
        print("[PASS] Reset Marks API response:", res)

        # 4. Verify records deleted from DB
        remaining_count = db.query(MidSemStudentMarks).filter(
            MidSemStudentMarks.session_id == sess.id,
            MidSemStudentMarks.enrollment_no == "0105CS241001"
        ).count()
        assert remaining_count == 0, f"Expected 0 records after reset, found {remaining_count}"
        print("[PASS] Reset Marks DB state verified successfully!")

    finally:
        db.close()

if __name__ == "__main__":
    test_reset_marks_endpoint()
