"""
router.py
---------
FastAPI router for Student Academic Analyzer.
Mounts isolated local endpoints for multi-file processing, manual entry, Q&A, and report exporting.
"""

import os
import time
import tempfile
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse

from backend.student_academic_analyzer.models.academic_models import (
    AcademicProfile, StudentIdentity, SemesterRecord, SubjectRecord,
    AcademicAnalytics, ManualEntryRequest, QARequest, ValidationReport
)
from backend.student_academic_analyzer.parsers.pdf_parser import parse_pdf_file
from backend.student_academic_analyzer.parsers.excel_csv_parser import parse_excel_csv_file
from backend.student_academic_analyzer.parsers.image_parser import parse_image_file
from backend.student_academic_analyzer.normalization.subject_normalizer import normalize_subject_record
from backend.student_academic_analyzer.normalization.semester_normalizer import normalize_semester
from backend.student_academic_analyzer.validation.validator import validate_academic_records
from backend.student_academic_analyzer.analysis.gpa_analytics import analyze_gpa_trends, compute_grade_distribution
from backend.student_academic_analyzer.analysis.subject_analytics import analyze_subject_performance
from backend.student_academic_analyzer.analysis.backlog_analytics import analyze_backlogs_and_attempts
from backend.student_academic_analyzer.analysis.risk_consistency_engine import (
    evaluate_academic_risk, compute_consistency_score, calculate_cgpa_projections
)
from backend.student_academic_analyzer.ai.academic_insights import generate_local_ai_insights
from backend.student_academic_analyzer.ai.ask_my_result_engine import answer_student_question
from backend.student_academic_analyzer.reports.pdf_report_generator import generate_student_pdf_report
from backend.student_academic_analyzer.reports.excel_report_generator import generate_student_excel_report


academic_analyzer_router = APIRouter(tags=["Student Academic Analyzer"])


def build_academic_profile_from_parsed_records(parsed_items: List[Dict[str, Any]]) -> AcademicProfile:
    """
    Core pipeline function: converts raw parsed file records into a normalized AcademicProfile.
    """
    if not parsed_items:
        raise HTTPException(status_code=400, detail="No valid academic records provided.")

    # Validation Audit Report
    val_report = validate_academic_records(parsed_items)

    # Detect Primary Enrollment, Name, Branch, Course
    first_item = parsed_items[0]
    enrollment = "UNKNOWN"
    for item in parsed_items:
        if item.get("enrollment") and item.get("enrollment") != "UNKNOWN":
            enrollment = item.get("enrollment")
            break

    name = first_item.get("name", "Student Record")
    for item in parsed_items:
        if item.get("name") and item.get("name") not in ["Unknown Student", "Student Record"]:
            name = item.get("name")
            break

    branch = first_item.get("branch", "IT")
    course = first_item.get("course", "B.Tech.")

    identity = StudentIdentity(
        enrollment=enrollment,
        name=name,
        branch=branch,
        course=course
    )

    # Group records by semester_number
    sem_groups: Dict[int, Dict[str, Any]] = {}

    for rec in parsed_items:
        raw_sem = rec.get("semester_number", 1)
        sem_num, sem_title = normalize_semester(raw_sem)

        if sem_num not in sem_groups:
            sem_groups[sem_num] = {
                "semester_number": sem_num,
                "raw_title": sem_title,
                "sgpa": rec.get("sgpa"),
                "credits": 0.0,
                "subjects": []
            }

        raw_subs = rec.get("subjects") or []
        for raw_s in raw_subs:
            norm_sub_dict = normalize_subject_record(raw_s)
            sub_obj = SubjectRecord(**norm_sub_dict)
            sem_groups[sem_num]["subjects"].append(sub_obj)

    # Build SemesterRecord objects
    semester_records: List[SemesterRecord] = []
    for sem_n, sem_data in sorted(sem_groups.items(), key=lambda x: x[0]):
        semester_records.append(SemesterRecord(
            semester_number=sem_n,
            raw_title=sem_data["raw_title"],
            sgpa=sem_data["sgpa"],
            credits=sem_data["credits"],
            subjects=sem_data["subjects"]
        ))

    # 1. Backlogs & Subject Attempt History Analysis
    backlog_summary, _ = analyze_backlogs_and_attempts(semester_records)

    # 2. GPA Analytics (SGPA, CGPA, Trends)
    gpa_res = analyze_gpa_trends(semester_records)
    cgpa = gpa_res["cgpa"]

    # 3. Subject Analytics & Category Performance
    subj_res = analyze_subject_performance(semester_records)

    # 4. Grade Distribution
    grade_dist = compute_grade_distribution(semester_records)

    # 5. Risk Engine Scoring
    risk_res = evaluate_academic_risk(cgpa, gpa_res["gpa_trend"], backlog_summary, semester_records)

    # 6. Consistency Score
    consistency_res = compute_consistency_score(gpa_res["gpa_trend"], backlog_summary)

    # 7. CGPA Projections
    projection_res = calculate_cgpa_projections(cgpa, semester_records)

    # Assemble Analytics object
    analytics = AcademicAnalytics(
        overview={
            "total_semesters": len(semester_records),
            "total_subjects": sum(len(s.subjects) for s in semester_records),
            "cgpa": cgpa,
            "overall_trend": gpa_res["overall_trend"]
        },
        gpa_trend=gpa_res["gpa_trend"],
        subject_analysis={
            "strong_subjects": subj_res["strong_subjects"],
            "weak_subjects": subj_res["weak_subjects"],
            "critical_subjects": subj_res["critical_subjects"]
        },
        category_analysis=subj_res["category_analysis"],
        backlog_summary=backlog_summary,
        grade_distribution=grade_dist,
        credit_summary={
            "total_credits_attempted": sum(s.credits for s in semester_records),
            "total_credits_earned": sum(sum(sub.credits for sub in s.subjects if sub.status == "PASS") for s in semester_records)
        },
        semester_comparison=gpa_res["semester_comparison"],
        risk_analysis=risk_res,
        consistency_score=consistency_res,
        cgpa_projection=projection_res,
        best_worst_analysis={
            "best_semester": gpa_res["best_semester"],
            "weakest_semester": gpa_res["weakest_semester"]
        },
        timeline=[{"semester": s.semester_number, "sgpa": s.sgpa, "subjects": len(s.subjects)} for s in semester_records]
    )

    # 8. Generate Local AI Insights
    ai_insights = generate_local_ai_insights(cgpa, analytics, backlog_summary, identity.name)

    return AcademicProfile(
        identity=identity,
        semesters=semester_records,
        cgpa=cgpa,
        backlogs=backlog_summary,
        analytics=analytics,
        ai_insights=ai_insights,
        validation_report=val_report
    )


@academic_analyzer_router.post("/upload")
async def process_academic_files(files: List[UploadFile] = File(...)):
    """
    Main file upload processing endpoint.
    Accepts PDF, XLSX, CSV, JPG, PNG files across multiple semesters completely offline.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    parsed_records = []

    for file in files:
        filename = file.filename or "uploaded_file"
        file_bytes = await file.read()

        if not file_bytes:
            continue

        fn_lower = filename.lower()
        if fn_lower.endswith(".pdf"):
            res = parse_pdf_file(file_bytes, filename)
            parsed_records.append(res)
        elif fn_lower.endswith((".xlsx", ".xls", ".csv")):
            res_list = parse_excel_csv_file(file_bytes, filename)
            parsed_records.extend(res_list)
        elif fn_lower.endswith((".jpg", ".jpeg", ".png")):
            res = parse_image_file(file_bytes, filename)
            parsed_records.append(res)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format: {filename}. Supported: PDF, XLSX, XLS, CSV, JPG, PNG.")

    if not parsed_records:
        raise HTTPException(status_code=422, detail="Could not parse any student academic data from uploaded files.")

    profile = build_academic_profile_from_parsed_records(parsed_records)
    return profile


@academic_analyzer_router.post("/analyze-manual", response_model=AcademicProfile)
def analyze_manual_entry(req: ManualEntryRequest):
    """
    Manual entry processing endpoint.
    Builds academic profile from manually entered student and subject records.
    """
    raw_records = []
    for sem in req.semesters:
        subs = []
        for sub in sem.subjects:
            subs.append({
                "code": sub.code,
                "name": sub.name,
                "credits": sub.credits,
                "marks": sub.marks,
                "grade": sub.grade,
                "status": sub.status
            })
        raw_records.append({
            "filename": "Manual Entry",
            "enrollment": req.enrollment,
            "name": req.student_name,
            "branch": req.branch or "IT",
            "course": req.course or "B.Tech.",
            "semester_number": sem.semester_number,
            "semester_title": f"Semester {sem.semester_number}",
            "sgpa": sem.sgpa,
            "subjects": subs
        })

    profile = build_academic_profile_from_parsed_records(raw_records)
    return profile


@academic_analyzer_router.post("/qa")
def ask_academic_question(req: QARequest):
    """
    Ask My Result Q&A endpoint.
    Answers student questions strictly using analyzed profile dataset offline.
    """
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    answer_text = answer_student_question(req.question, req.profile)
    return {"reply": answer_text}


@academic_analyzer_router.post("/export/pdf")
def export_pdf_report(profile: AcademicProfile):
    """
    Generates downloadable PDF report ("Student Academic Profile Report").
    """
    os.makedirs("data/exports", exist_ok=True)
    out_path = os.path.abspath(f"data/exports/Academic_Profile_{profile.identity.enrollment}_{int(time.time())}.pdf")
    generate_student_pdf_report(profile, out_path)

    return FileResponse(
        path=out_path,
        filename=os.path.basename(out_path),
        media_type="application/pdf"
    )


@academic_analyzer_router.post("/export/excel")
def export_excel_report(profile: AcademicProfile):
    """
    Generates downloadable multi-sheet Excel report.
    """
    os.makedirs("data/exports", exist_ok=True)
    out_path = os.path.abspath(f"data/exports/Academic_Profile_{profile.identity.enrollment}_{int(time.time())}.xlsx")
    generate_student_excel_report(profile, out_path)

    return FileResponse(
        path=out_path,
        filename=os.path.basename(out_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
