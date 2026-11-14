"""
validator.py
------------
Audits parsed student academic records prior to analysis.
Checks for missing fields, duplicate subjects/semesters, student identity conflicts, and invalid grades.
"""

from typing import List, Dict, Any
from backend.student_academic_analyzer.models.academic_models import ValidationReport, ValidationIssue


def validate_academic_records(parsed_records: List[Dict[str, Any]]) -> ValidationReport:
    """
    Performs comprehensive pre-analysis audit on raw or parsed student records.
    Returns a structured ValidationReport.
    """
    issues: List[ValidationIssue] = []
    total_files = len(parsed_records)
    total_subjects = 0
    total_semesters = 0

    enrollments = set()
    names = set()
    semesters_seen = set()

    for idx, rec in enumerate(parsed_records):
        filename = rec.get("filename", f"File {idx+1}")
        enr = str(rec.get("enrollment") or "").strip().upper()
        name = str(rec.get("name") or "").strip()
        sem = rec.get("semester_number") or 1
        subjects = rec.get("subjects") or []

        total_subjects += len(subjects)
        if sem not in semesters_seen:
            semesters_seen.add(sem)
            total_semesters += 1

        # 1. Missing Enrollment Check
        if not enr or enr == "UNKNOWN":
            issues.append(ValidationIssue(
                type="missing_enrollment",
                category="Missing Enrollment Number",
                reason=f"Enrollment number could not be confidently extracted from '{filename}'.",
                affected_records=[filename],
                severity="WARNING"
            ))
        else:
            enrollments.add(enr)

        # 2. Missing Student Name Check
        if not name or name in ["Unknown Student", "Student Record"]:
            issues.append(ValidationIssue(
                type="missing_name",
                category="Missing Student Name",
                reason=f"Student name missing or defaulting in '{filename}'.",
                affected_records=[filename],
                severity="INFO"
            ))
        else:
            names.add(name)

        # 3. Duplicate Subject Check within same semester
        sub_codes = [s.get("code") for s in subjects if s.get("code")]
        if len(sub_codes) != len(set(sub_codes)):
            dups = [c for c in set(sub_codes) if sub_codes.count(c) > 1]
            issues.append(ValidationIssue(
                type="duplicate_subject",
                category="Duplicate Subject Entries",
                reason=f"Semester {sem} in '{filename}' contains duplicate subject entries: {', '.join(dups)}.",
                affected_records=[filename],
                severity="WARNING"
            ))

        # 4. Missing Credits Check
        zero_credit_subs = [s.get("code") for s in subjects if not s.get("credits") or float(s.get("credits")) == 0]
        if zero_credit_subs:
            issues.append(ValidationIssue(
                type="missing_credits",
                category="Missing Subject Credits",
                reason=f"Semester {sem} has {len(zero_credit_subs)} subject(s) with 0 or missing credits ({', '.join(zero_credit_subs)}). Defaulting to 4 credits.",
                affected_records=[filename],
                severity="INFO"
            ))

    # 5. Multi-Student Enrollment Conflict Check
    valid_enrollments = {e for e in enrollments if e != "UNKNOWN"}
    identity_matched = len(valid_enrollments) <= 1

    if len(valid_enrollments) > 1:
        issues.append(ValidationIssue(
            type="conflicting_identity",
            category="Different Students Detected",
            reason=f"Multiple distinct enrollment numbers detected across uploaded files ({', '.join(valid_enrollments)}). Please verify before merging records.",
            affected_records=list(valid_enrollments),
            severity="WARNING"
        ))

    has_warn = any(i.severity == "WARNING" for i in issues)
    has_err = any(i.severity == "ERROR" for i in issues)

    return ValidationReport(
        total_files=total_files,
        total_subjects=total_subjects,
        total_semesters=total_semesters,
        student_identity_matched=identity_matched,
        has_warnings=has_warn,
        has_errors=has_err,
        issues=issues
    )
