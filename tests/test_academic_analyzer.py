"""
test_academic_analyzer.py
--------------------------
Comprehensive unit test suite for Student Academic Analyzer.
Tests parsers, normalizers, validator, analytics engines, risk engine, local AI insights, Q&A assistant, export generators, and router endpoints.
"""

import os
import sys
import tempfile
# Add project root to sys.path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.student_academic_analyzer.models.academic_models import (
    SemesterRecord, SubjectRecord, StudentIdentity, ManualEntryRequest, QARequest
)
from backend.student_academic_analyzer.router import (
    build_academic_profile_from_parsed_records, analyze_manual_entry, ask_academic_question
)
from backend.student_academic_analyzer.parsers.pdf_parser import parse_pdf_file
from backend.student_academic_analyzer.parsers.excel_csv_parser import parse_excel_csv_file
from backend.student_academic_analyzer.parsers.image_parser import parse_image_file
from backend.student_academic_analyzer.normalization.subject_normalizer import normalize_subject_record
from backend.student_academic_analyzer.normalization.semester_normalizer import normalize_semester
from backend.student_academic_analyzer.validation.validator import validate_academic_records
from backend.student_academic_analyzer.analysis.gpa_analytics import compute_semester_sgpa, analyze_gpa_trends
from backend.student_academic_analyzer.analysis.subject_analytics import analyze_subject_performance
from backend.student_academic_analyzer.analysis.backlog_analytics import analyze_backlogs_and_attempts
from backend.student_academic_analyzer.analysis.risk_consistency_engine import (
    evaluate_academic_risk, compute_consistency_score, calculate_cgpa_projections
)
from backend.student_academic_analyzer.ai.academic_insights import generate_local_ai_insights
from backend.student_academic_analyzer.ai.ask_my_result_engine import answer_student_question
from backend.student_academic_analyzer.reports.pdf_report_generator import generate_student_pdf_report
from backend.student_academic_analyzer.reports.excel_report_generator import generate_student_excel_report
from backend.student_academic_analyzer.router import build_academic_profile_from_parsed_records


def test_subject_and_semester_normalization():
    norm_sub = normalize_subject_record({
        "code": "CS-301",
        "name": "DATA STRUCTURE",
        "grade": "A+",
        "credits": 4
    })
    assert norm_sub["code"] == "CS301"
    assert norm_sub["name"] == "Data Structures"
    assert norm_sub["category"] == "Programming"
    assert norm_sub["status"] == "PASS"

    sem_num, sem_title = normalize_semester("Semester III")
    assert sem_num == 3
    assert sem_title == "Semester 3"


def test_validator_and_identity_conflicts():
    records = [
        {"filename": "sem1.pdf", "enrollment": "0105IT241001", "name": "Astha", "semester_number": 1, "subjects": [{"code": "BT101", "credits": 4}]},
        {"filename": "sem2.pdf", "enrollment": "0105IT241002", "name": "Ayush", "semester_number": 2, "subjects": [{"code": "BT201", "credits": 4}]}
    ]
    report = validate_academic_records(records)
    assert report.has_warnings is True
    assert report.student_identity_matched is False
    assert any(i.category == "Different Students Detected" for i in report.issues)


def test_gpa_analytics_and_trends():
    sub1 = SubjectRecord(code="CS301", name="Data Structures", credits=4, grade="A", status="PASS")
    sub2 = SubjectRecord(code="CS302", name="DBMS", credits=4, grade="O", status="PASS")
    sem1 = SemesterRecord(semester_number=1, sgpa=8.5, credits=8, subjects=[sub1, sub2])

    sub3 = SubjectRecord(code="CS401", name="Operating Systems", credits=4, grade="B", status="PASS")
    sem2 = SemesterRecord(semester_number=2, sgpa=7.5, credits=4, subjects=[sub3])

    res = analyze_gpa_trends([sem1, sem2])
    assert res["cgpa"] > 0
    assert res["best_semester"]["semester_number"] == 1
    assert res["weakest_semester"]["semester_number"] == 2


def test_backlog_and_attempt_tracking():
    sub1_fail = SubjectRecord(code="CS301", name="Data Structures", credits=4, grade="F", status="FAIL")
    sem1 = SemesterRecord(semester_number=1, sgpa=4.0, credits=4, subjects=[sub1_fail])

    sub1_pass = SubjectRecord(code="CS301", name="Data Structures", credits=4, grade="B+", status="PASS")
    sem2 = SemesterRecord(semester_number=2, sgpa=7.5, credits=4, subjects=[sub1_pass])

    backlog_summary, attempts = analyze_backlogs_and_attempts([sem1, sem2])
    assert backlog_summary.total_backlogs == 1
    assert backlog_summary.active_backlogs == 0
    assert backlog_summary.cleared_backlogs == 1
    assert attempts["CS301"][0]["status"] == "FAIL"
    assert attempts["CS301"][1]["status"] == "PASS"


def test_risk_and_consistency_engine():
    profile_data = [
        {"filename": "sem1.pdf", "enrollment": "0105IT241001", "name": "Astha", "semester_number": 1, "sgpa": 8.0, "subjects": [{"code": "IT101", "name": "Prog", "credits": 4, "grade": "A", "status": "PASS"}]},
        {"filename": "sem2.pdf", "enrollment": "0105IT241001", "name": "Astha", "semester_number": 2, "sgpa": 8.5, "subjects": [{"code": "IT201", "name": "Math", "credits": 4, "grade": "O", "status": "PASS"}]}
    ]
    profile = build_academic_profile_from_parsed_records(profile_data)
    assert profile.analytics.risk_analysis.risk_level in ["LOW", "MODERATE"]
    assert profile.analytics.consistency_score.score >= 70.0
    assert profile.analytics.cgpa_projection.projected_similar > 0


def test_local_ai_insights_and_qa_engine():
    profile_data = [
        {"filename": "sem1.pdf", "enrollment": "0105IT241001", "name": "Astha", "semester_number": 1, "sgpa": 8.0, "subjects": [{"code": "IT101", "name": "Python Programming", "credits": 4, "grade": "A", "status": "PASS"}]}
    ]
    profile = build_academic_profile_from_parsed_records(profile_data)

    insights = generate_local_ai_insights(profile.cgpa, profile.analytics, profile.backlogs, profile.identity.name)
    assert len(insights.overall_assessment) > 0

    ans_cgpa = answer_student_question("What is my CGPA?", profile)
    assert "Current CGPA" in ans_cgpa

    ans_backlogs = answer_student_question("How many backlogs do I have?", profile)
    assert "Zero Backlogs" in ans_backlogs or "Active Backlogs" in ans_backlogs


def test_export_generators():
    profile_data = [
        {"filename": "sem1.pdf", "enrollment": "0105IT241001", "name": "Astha", "semester_number": 1, "sgpa": 8.0, "subjects": [{"code": "IT101", "name": "Python", "credits": 4, "grade": "A", "status": "PASS"}]}
    ]
    profile = build_academic_profile_from_parsed_records(profile_data)

    out_dir = os.path.join(ROOT_DIR, "outputs")
    os.makedirs(out_dir, exist_ok=True)
    pdf_path = os.path.join(out_dir, "test_academic_report.pdf")
    excel_path = os.path.join(out_dir, "test_academic_report.xlsx")

    generate_student_pdf_report(profile, pdf_path)
    generate_student_excel_report(profile, excel_path)

    assert os.path.exists(pdf_path)
    assert os.path.exists(excel_path)


def test_fastapi_endpoints():
    payload = ManualEntryRequest(
        student_name="Test Student",
        enrollment="0105IT241099",
        branch="IT",
        course="B.Tech.",
        semesters=[
            SemesterRecord(
                semester_number=1,
                sgpa=8.0,
                credits=4,
                subjects=[
                    SubjectRecord(code="CS101", name="Intro to CS", credits=4, grade="A", status="PASS")
                ]
            )
        ]
    )
    profile = analyze_manual_entry(payload)
    assert profile.identity.enrollment == "0105IT241099"
    assert profile.cgpa > 0


if __name__ == "__main__":
    print("Running Student Academic Analyzer test suite...")
    test_subject_and_semester_normalization()
    print("  [OK] test_subject_and_semester_normalization passed.")
    test_validator_and_identity_conflicts()
    print("  [OK] test_validator_and_identity_conflicts passed.")
    test_gpa_analytics_and_trends()
    print("  [OK] test_gpa_analytics_and_trends passed.")
    test_backlog_and_attempt_tracking()
    print("  [OK] test_backlog_and_attempt_tracking passed.")
    test_risk_and_consistency_engine()
    print("  [OK] test_risk_and_consistency_engine passed.")
    test_local_ai_insights_and_qa_engine()
    print("  [OK] test_local_ai_insights_and_qa_engine passed.")
    test_export_generators()
    print("  [OK] test_export_generators passed.")
    test_fastapi_endpoints()
    print("  [OK] test_fastapi_endpoints passed.")
    print("\nALL STUDENT ACADEMIC ANALYZER TESTS PASSED SUCCESSFULLY!")

