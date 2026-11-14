"""
validator.py
------------
Performs Data Validation on scraped student result records prior to Excel spreadsheet generation.
Identifies suspicious data issues such as duplicate enrollments, duplicate names across distinct enrollments,
identical academic records, invalid enrollment formats, suspicious GPA values, and missing grades.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import List, Dict, Any


def validate_scraped_records(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyzes a list of scraped student result dictionaries for suspicious data patterns.

    :param records: List of student record dicts from scraper/parser
    :return: A dictionary containing:
        - total_records (int)
        - suspicious_count (int)
        - has_suspicious_data (bool)
        - issues (list of dicts describing each detected anomaly)
        - summary_counts (dict of issue category counts)
    """
    total_records = len(records)
    issues: List[Dict[str, Any]] = []
    suspicious_enrollments = set()

    if not records:
        return {
            "total_records": 0,
            "suspicious_count": 0,
            "has_suspicious_data": False,
            "issues": [],
            "summary_counts": {}
        }

    # 1. Check Duplicate Enrollments
    enrollment_counts = defaultdict(list)
    for idx, rec in enumerate(records):
        enr = str(rec.get("enrollment", "")).strip().upper()
        if enr:
            enrollment_counts[enr].append(idx)

    for enr, indices in enrollment_counts.items():
        if len(indices) > 1:
            suspicious_enrollments.add(enr)
            issues.append({
                "type": "duplicate_enrollment",
                "category": "Duplicate Enrollment",
                "reason": f"Duplicate enrollment number '{enr}' found {len(indices)} times in records.",
                "affected_enrollments": [enr]
            })

    # 2. Check Invalid Enrollment Formats
    enrollment_pattern = re.compile(r"^[A-Z0-9]{6,20}$", re.IGNORECASE)
    for rec in records:
        enr = str(rec.get("enrollment", "")).strip()
        if not enr or not enrollment_pattern.match(enr):
            suspicious_enrollments.add(enr or "UNKNOWN")
            issues.append({
                "type": "invalid_enrollment_format",
                "category": "Invalid Enrollment Format",
                "reason": f"Enrollment '{enr or 'EMPTY'}' does not conform to valid alphanumeric enrollment format.",
                "affected_enrollments": [enr or "UNKNOWN"]
            })

    # Filter valid student records (not marked as not_found)
    valid_records = [r for r in records if not r.get("not_found")]

    # 3. Check Duplicate Student Names across distinct enrollments
    name_to_enrollments = defaultdict(set)
    for rec in valid_records:
        enr = str(rec.get("enrollment", "")).strip().upper()
        name = str(rec.get("name", "")).strip().upper()
        if name and name != "NOT FOUND":
            name_to_enrollments[name].add(enr)

    for name, enr_set in name_to_enrollments.items():
        if len(enr_set) > 1:
            enr_list = sorted(list(enr_set))
            for e in enr_list:
                suspicious_enrollments.add(e)
            issues.append({
                "type": "duplicate_name",
                "category": "Duplicate Student Name",
                "reason": f"Identical student name '{name}' shared across {len(enr_list)} distinct enrollments ({', '.join(enr_list)}).",
                "affected_enrollments": enr_list
            })

    # 4. Check Identical Academic Performance Records across distinct enrollments
    fingerprint_to_enrollments = defaultdict(set)
    for rec in valid_records:
        enr = str(rec.get("enrollment", "")).strip().upper()
        name = str(rec.get("name", "")).strip().upper()
        sgpa = str(rec.get("sgpa") or "").strip()
        cgpa = str(rec.get("cgpa") or "").strip()
        result = str(rec.get("result") or "").strip().upper()
        subj_map = rec.get("subjects")
        subj_tuple = tuple(sorted(subj_map.items())) if isinstance(subj_map, dict) else ()

        if name and (sgpa or cgpa or subj_tuple):
            fingerprint = (name, sgpa, cgpa, result, subj_tuple)
            fingerprint_to_enrollments[fingerprint].add(enr)

    for (name, sgpa, cgpa, result, subj_tuple), enr_set in fingerprint_to_enrollments.items():
        if len(enr_set) > 1:
            enr_list = sorted(list(enr_set))
            for e in enr_list:
                suspicious_enrollments.add(e)
            issues.append({
                "type": "identical_academic_record",
                "category": "Identical Academic Record",
                "reason": f"Exact duplicate academic grade profile for '{name}' found across multiple enrollments ({', '.join(enr_list)}).",
                "affected_enrollments": enr_list
            })

    # 5. Check Suspicious / Out-of-Range GPA Values
    for rec in valid_records:
        enr = str(rec.get("enrollment", "")).strip().upper()
        sgpa_str = rec.get("sgpa")
        cgpa_str = rec.get("cgpa")
        
        for gpa_name, gpa_val in [("SGPA", sgpa_str), ("CGPA", cgpa_str)]:
            if gpa_val is not None and str(gpa_val).strip() not in ["", "-"]:
                try:
                    val_float = float(gpa_val)
                    if val_float < 0.0 or val_float > 10.0:
                        suspicious_enrollments.add(enr)
                        issues.append({
                            "type": "suspicious_gpa",
                            "category": "Suspicious GPA Value",
                            "reason": f"Out-of-range {gpa_name} value '{gpa_val}' detected for enrollment '{enr}'.",
                            "affected_enrollments": [enr]
                        })
                except ValueError:
                    suspicious_enrollments.add(enr)
                    issues.append({
                        "type": "suspicious_gpa",
                        "category": "Invalid GPA Format",
                        "reason": f"Unparseable {gpa_name} value '{gpa_val}' detected for enrollment '{enr}'.",
                        "affected_enrollments": [enr]
                    })

    # 6. Check Missing Subject Grades for Valid Records
    for rec in valid_records:
        enr = str(rec.get("enrollment", "")).strip().upper()
        subjects = rec.get("subjects")
        if not subjects or not isinstance(subjects, dict) or len(subjects) == 0:
            suspicious_enrollments.add(enr)
            issues.append({
                "type": "missing_grades",
                "category": "Missing Grade Data",
                "reason": f"Valid student record '{enr}' contains no extracted subject grades.",
                "affected_enrollments": [enr]
            })

    # Calculate summary counts per category
    summary_counts: Dict[str, int] = defaultdict(int)
    for issue in issues:
        summary_counts[issue["category"]] += 1

    suspicious_count = len(suspicious_enrollments)

    return {
        "total_records": total_records,
        "suspicious_count": suspicious_count,
        "has_suspicious_data": suspicious_count > 0 or len(issues) > 0,
        "issues": issues,
        "summary_counts": dict(summary_counts)
    }
