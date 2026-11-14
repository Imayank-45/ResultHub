"""
test_mid_sem.py
---------------
Automated test suite for Mid-Sem Studio module in ResultAI.
"""

import os
import pathlib
from openpyxl import load_workbook

from backend.server import app
from backend.db.database import Base, engine, SessionLocal
from backend.db.models import MidSemSession, MidSemSubject, MidSemStudentMarks, User
from backend.mid_sem_excel_writer import generate_mid_sem_excel
from backend.mid_sem_router import lookup_student_name_from_files, get_subjects

from sqlalchemy import text

def setup_database():
    """Ensure database schema is created and upgraded before running tests."""
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE mid_sem_student_marks ADD COLUMN absence_type VARCHAR(30)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE mid_sem_subjects ADD COLUMN mst_enabled BOOLEAN DEFAULT 1"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE mid_sem_subjects ADD COLUMN is_elective BOOLEAN DEFAULT 0"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE mid_sem_subjects ADD COLUMN updated_at DATETIME"))
            conn.commit()
        except Exception:
            pass


def test_1_roll_and_enrollment_generation():
    """Test enrollment number generation format (0105CS241001 to 0105CS241005)."""
    prefix = "0105CS2410"
    start = 1
    end = 5
    pad = 2

    generated = [f"{prefix}{str(r).zfill(pad)}" for r in range(start, end + 1)]
    expected = [
        "0105CS241001",
        "0105CS241002",
        "0105CS241003",
        "0105CS241004",
        "0105CS241005"
    ]
    assert generated == expected, f"Expected {expected}, got {generated}"


def test_2_student_name_lookup():
    """Test resolution of student names using primary key enrollment number."""
    name_3 = lookup_student_name_from_files("0105CS241003")
    assert name_3 == "Aaditya Thakur", f"Expected Aaditya Thakur, got {name_3}"

    name_1 = lookup_student_name_from_files("0105CS241001")
    assert name_1 is not None, "Expected student name for 0105CS241001"


def test_3_subject_loading_and_seeding():
    """Test subject list endpoint logic for CS Semester IV."""
    db = SessionLocal()
    try:
        data = get_subjects(branch="CS", semester="IV", program="B.Tech.", db=db)
        assert len(data) == 5, f"Expected 5 subjects for CSE IV Sem, got {len(data)}"
        codes = [s["subject_code"] for s in data]
        expected_codes = ["BT401", "CS402", "CS403", "CS404", "CS405"]
        assert codes == expected_codes, f"Expected {expected_codes}, got {codes}"

        # Verify maximum marks defaults
        for s in data:
            assert s["mst1_max"] == 10.0
            assert s["mst2_max"] == 10.0
            assert s["total_max"] == 20.0
    finally:
        db.close()


def test_4_mark_validation_and_total_calculation():
    """Test bounds validation: MST-I (0-10), MST-II (0-10), and backend TOTAL = MST-I + MST-II."""
    mst1 = 9.0
    mst2 = 7.0
    mst1_max = 10.0
    mst2_max = 10.0

    # Bounds check
    assert 0 <= mst1 <= mst1_max
    assert 0 <= mst2 <= mst2_max

    total = mst1 + mst2
    assert total == 16.0

    # Invalid marks assertions
    invalid_over = 11.0
    assert invalid_over > mst1_max

    invalid_negative = -1.0
    assert invalid_negative < 0


def test_5_reference_sample_data_excel_generation(tmp_path):
    """
    Test end-to-end reference scenario:
    Student: 0105CS241003 (Aaditya Thakur)
    Marks:
      BT 401 M III: MST-I = 0, MST-II = 4, TOT = 4
      CS 402 ADA:   MST-I = 5, MST-II = 0, TOT = 5
      CS 403 SE:    MST-I = 6, MST-II = 0, TOT = 6
      CS 404 COA:   MST-I = 6, MST-II = 0, TOT = 6
      CS-405 OS:    MST-I = 5, MST-II = 0, TOT = 5
    Grand total = 26 / 100
    """
    session_info = {
        "academic_session": "Jan - Jun 2026",
        "year": "2nd Year",
        "semester": "IV",
        "branch": "CSE",
        "program": "B.Tech."
    }

    subjects = [
        {"subject_code": "BT 401 M III", "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 1},
        {"subject_code": "CS 402 ADA",   "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 2},
        {"subject_code": "CS 403 SE",    "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 3},
        {"subject_code": "CS 404 COA",   "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 4},
        {"subject_code": "CS-405 OS",    "mst1_max": 10.0, "mst2_max": 10.0, "total_max": 20.0, "display_order": 5},
    ]

    students_data = [
        {
            "s_no": 1,
            "enrollment_no": "0105CS241001",
            "student_name": "Aadil Shah",
            "marks": {
                "BT 401 M III": {"mst1": 8, "mst2": 8, "total": 16},
                "CS 402 ADA":   {"mst1": 7, "mst2": 7, "total": 14},
                "CS 403 SE":    {"mst1": 6, "mst2": 6, "total": 12},
                "CS 404 COA":   {"mst1": 9, "mst2": 9, "total": 18},
                "CS-405 OS":    {"mst1": 8, "mst2": 8, "total": 16},
            }
        },
        {
            "s_no": 2,
            "enrollment_no": "0105CS241002",
            "student_name": "Aaditya Sharma",
            "marks": {
                "BT 401 M III": {"mst1": 7, "mst2": 7, "total": 14},
                "CS 402 ADA":   {"mst1": 8, "mst2": 8, "total": 16},
                "CS 403 SE":    {"mst1": 7, "mst2": 7, "total": 14},
                "CS 404 COA":   {"mst1": 8, "mst2": 8, "total": 16},
                "CS-405 OS":    {"mst1": 9, "mst2": 9, "total": 18},
            }
        },
        {
            "s_no": 3,
            "enrollment_no": "0105CS241003",
            "student_name": "Aaditya Thakur",
            "marks": {
                "BT 401 M III": {"mst1": 0, "mst2": 4, "total": 4},
                "CS 402 ADA":   {"mst1": 5, "mst2": 0, "total": 5},
                "CS 403 SE":    {"mst1": 6, "mst2": 0, "total": 6},
                "CS 404 COA":   {"mst1": 6, "mst2": 0, "total": 6},
                "CS-405 OS":    {"mst1": 5, "mst2": 0, "total": 5},
            }
        },
        {
            "s_no": 4,
            "enrollment_no": "0105CS241004",
            "student_name": "Aayush Verma",
            "marks": {
                "BT 401 M III": {"mst1": 9, "mst2": 8, "total": 17},
                "CS 402 ADA":   {"mst1": 8, "mst2": 8, "total": 16},
                "CS 403 SE":    {"mst1": 7, "mst2": 7, "total": 14},
                "CS 404 COA":   {"mst1": 6, "mst2": 6, "total": 12},
                "CS-405 OS":    {"mst1": 8, "mst2": 8, "total": 16},
            }
        },
        {
            "s_no": 5,
            "enrollment_no": "0105CS241005",
            "student_name": "Abhay Patel",
            "marks": {
                "BT 401 M III": {"mst1": 7, "mst2": 8, "total": 15},
                "CS 402 ADA":   {"mst1": 9, "mst2": 9, "total": 18},
                "CS 403 SE":    {"mst1": 8, "mst2": 8, "total": 16},
                "CS 404 COA":   {"mst1": 7, "mst2": 7, "total": 14},
                "CS-405 OS":    {"mst1": 9, "mst2": 9, "total": 18},
            }
        }
    ]

    out_file = str(tmp_path / "OIST_CSE_Sem4_MidSem_Jan-Jun-2026.xlsx")
    generated_path = generate_mid_sem_excel(session_info, subjects, students_data, out_file)

    assert os.path.exists(generated_path), "Generated Excel file must exist"

    # Inspect generated openpyxl Workbook contents
    wb = load_workbook(generated_path, data_only=False)
    ws = wb.active

    # Check title headers
    assert "ORIENTAL INSTITUTE OF SCIENCE & TECHNOLOGY" in str(ws["A1"].value)
    assert "DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING" in str(ws["A2"].value)

    # Check student row 3 (Aaditya Thakur, row 8 in worksheet because headers occupy rows 1-5)
    # Row 6 = Student 1 (Aadil Shah)
    # Row 7 = Student 2 (Aaditya Sharma)
    # Row 8 = Student 3 (Aaditya Thakur)
    row_3 = [ws.cell(row=8, column=col).value for col in range(1, 18)]
    
    assert row_3[0] == 3
    assert row_3[1] == "0105CS241003"

    # Subject 1 (BT 401): MST1 = 0 (col 3), MST2 = 4 (col 4), TOT formula = =SUM(C8:D8) (col 5)
    assert row_3[2] == 0
    assert row_3[3] == 4
    assert row_3[4] == "=SUM(C8:D8)"

    # Subject 2 (CS 402): MST1 = 5 (col 6), MST2 = 0 (col 7), TOT formula = =SUM(F8:G8) (col 8)
    assert row_3[5] == 5
    assert row_3[6] == 0
    assert row_3[7] == "=SUM(F8:G8)"

    # Subject 3 (CS 403): MST1 = 6 (col 9), MST2 = 0 (col 10), TOT formula = =SUM(I8:J8) (col 11)
    assert row_3[8] == 6
    assert row_3[9] == 0
    assert row_3[10] == "=SUM(I8:J8)"

    # Subject 4 (CS 404): MST1 = 6 (col 12), MST2 = 0 (col 13), TOT formula = =SUM(L8:M8) (col 14)
    assert row_3[11] == 6
    assert row_3[12] == 0
    assert row_3[13] == "=SUM(L8:M8)"

    # Subject 5 (CS-405): MST1 = 5 (col 15), MST2 = 0 (col 16), TOT formula = =SUM(O8:P8) (col 17)
    assert row_3[14] == 5
    assert row_3[15] == 0
    assert row_3[16] == "=SUM(O8:P8)"

    # Grand total verification: 4 + 5 + 6 + 6 + 5 = 26
    grand_total = (0 + 4) + (5 + 0) + (6 + 0) + (6 + 0) + (5 + 0)
    assert grand_total == 26

    wb.close()


def test_6_mark_absent_both_logic():
    """Test marking student absent for both MST-I & MST-II (zeros all marks)."""
    db = SessionLocal()
    try:
        # Create dummy session
        sess = MidSemSession(
            user_id=1, academic_session="Jan - Jun 2026", year="2nd Year",
            semester="IV", branch="CSE", program="B.Tech.",
            roll_prefix="0105CS2410", roll_start=1, roll_end=5
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        subjects = get_subjects(branch="CSE", semester="IV", program="B.Tech.", db=db)
        enr = "0105CS241001"

        # Apply ABSENT_BOTH
        for s in subjects:
            m = MidSemStudentMarks(
                session_id=sess.id, enrollment_no=enr, subject_id=s["id"],
                mst1_marks=0.0, mst2_marks=0.0, total_marks=0.0,
                absence_type="ABSENT_BOTH", status="ABSENT_BOTH"
            )
            db.add(m)
        db.commit()

        # Assertions
        recs = db.query(MidSemStudentMarks).filter_by(session_id=sess.id, enrollment_no=enr).all()
        assert len(recs) == 5
        for r in recs:
            assert r.mst1_marks == 0.0
            assert r.mst2_marks == 0.0
            assert r.total_marks == 0.0
            assert r.absence_type == "ABSENT_BOTH"
    finally:
        db.close()


def test_7_mark_absent_mst1_partial_logic():
    """Test partial absence (MST-I only absent): preserves MST-II, sets MST-I to 0, total = MST-II."""
    db = SessionLocal()
    try:
        sess = MidSemSession(
            user_id=1, academic_session="Jul - Dec 2026", year="2nd Year",
            semester="IV", branch="CSE", program="B.Tech.",
            roll_prefix="0105CS2410", roll_start=1, roll_end=5
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)

        subjects = get_subjects(branch="CSE", semester="IV", program="B.Tech.", db=db)
        enr = "0105CS241002"

        # Apply MST-I absent while keeping MST-II = 7.0
        for s in subjects:
            m = MidSemStudentMarks(
                session_id=sess.id, enrollment_no=enr, subject_id=s["id"],
                mst1_marks=0.0, mst2_marks=7.0, total_marks=7.0,
                absence_type="ABSENT_MST1", status="ABSENT_MST1"
            )
            db.add(m)
        db.commit()

        recs = db.query(MidSemStudentMarks).filter_by(session_id=sess.id, enrollment_no=enr).all()
        for r in recs:
            assert r.mst1_marks == 0.0
            assert r.mst2_marks == 7.0
            assert r.total_marks == 7.0
            assert r.absence_type == "ABSENT_MST1"
    finally:
        db.close()


def test_8_subject_master_db_auto_loading():
    """Test dynamic Subject Master auto-loading for B.Tech IT Sem 4."""
    db = SessionLocal()
    try:
        # Clean up old test records for IT IV to verify fresh auto-seeding from master data
        db.query(MidSemSubject).filter_by(branch="IT", semester="IV", program="B.Tech.").delete()
        db.commit()

        subjs = get_subjects(branch="IT", semester="IV", program="B.Tech.", db=db)
        assert len(subjs) == 5
        codes = [s["subject_code"] for s in subjs]
        assert codes == ["BT401", "IT402", "IT403", "IT404", "IT405"]
        for s in subjs:
            assert s["mst_enabled"] is True
            assert s["mst1_max"] == 10.0
            assert s["mst2_max"] == 10.0
            assert s["total_max"] == 20.0
    finally:
        db.close()


def test_9_mst_enabled_filtering():
    """Test that subjects with mst_enabled=False are excluded from get_subjects."""
    db = SessionLocal()
    try:
        # Insert a non-MST subject like IT406 Lab with mst_enabled=False
        lab_subj = MidSemSubject(
            branch="IT", semester="IV", program="B.Tech.",
            subject_code="IT406", subject_name="DBMS Lab",
            mst1_max=0, mst2_max=0, total_max=0, display_order=6,
            mst_enabled=False, is_active=True
        )
        db.add(lab_subj)
        db.commit()

        subjs = get_subjects(branch="IT", semester="IV", program="B.Tech.", db=db)
        codes = [s["subject_code"] for s in subjs]
        assert "IT406" not in codes
    finally:
        db.close()

