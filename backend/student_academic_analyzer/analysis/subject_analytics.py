"""
subject_analytics.py
---------------------
Analyzes individual subject performance, categorizes subjects into academic domains,
and identifies strong, weak, and critical subjects based on multi-semester consistency.
"""

from typing import List, Dict, Any
from backend.student_academic_analyzer.models.academic_models import SemesterRecord, SubjectCategoryAnalysis, SubjectRecord
from backend.student_academic_analyzer.analysis.gpa_analytics import GRADE_POINTS


def _is_valid_subject_code(code: str) -> bool:
    if not code:
        return False
    code_upper = code.upper()
    invalid_tokens = ["JUNE", "JULY", "DEC", "NOV", "MAY", "APR", "JAN", "FEB", "MAR", "AUG", "SEP", "OCT", "EXAM", "STATUS", "RESULT", "TOTAL", "SEM", "REMARK", "ROLL", "ENROLL"]
    if any(tok in code_upper for tok in invalid_tokens):
        return False
    import re
    if not re.search(r'\d', code_upper):
        return False
    return True


def analyze_subject_performance(semesters: List[SemesterRecord]) -> Dict[str, Any]:
    """
    Analyzes subject-level performance across all analyzed semesters.
    Returns categorized performance, strong subjects, weak subjects, and critical subjects.
    """
    subject_map: Dict[str, List[Dict[str, Any]]] = {}

    for sem in semesters:
        for sub in sem.subjects:
            code = sub.code
            if not _is_valid_subject_code(code):
                continue
            gp = GRADE_POINTS.get(sub.grade.upper(), 8.0 if sub.status == "PASS" else 0.0)
            if code not in subject_map:
                subject_map[code] = []
            subject_map[code].append({
                "semester": sem.semester_number,
                "name": sub.name,
                "credits": sub.credits,
                "grade": sub.grade,
                "grade_points": gp,
                "status": sub.status,
                "category": sub.category
            })

    strong_subjects = []
    weak_subjects = []
    critical_subjects = []
    category_totals: Dict[str, List[float]] = {}

    for code, occurrences in subject_map.items():
        avg_gp = sum(o["grade_points"] for o in occurrences) / len(occurrences)
        sub_name = occurrences[0]["name"]
        cat = occurrences[0]["category"]

        if cat not in category_totals:
            category_totals[cat] = []
        category_totals[cat].extend([o["grade_points"] for o in occurrences])

        has_fail = any(o["status"] == "FAIL" for o in occurrences)
        latest_status = occurrences[-1]["status"]

        item = {
            "code": code,
            "name": sub_name,
            "category": cat,
            "average_grade_points": round(avg_gp, 2),
            "occurrences": len(occurrences),
            "latest_grade": occurrences[-1]["grade"],
            "latest_status": latest_status
        }

        if latest_status == "FAIL" or has_fail or avg_gp < 5.0:
            critical_subjects.append(item)
        elif avg_gp >= 8.0:
            strong_subjects.append(item)
        elif avg_gp < 6.5:
            weak_subjects.append(item)

    # Build SubjectCategoryAnalysis list
    category_analysis_list: List[SubjectCategoryAnalysis] = []
    for cat_name, gps in category_totals.items():
        avg_cat_gp = round(sum(gps) / len(gps), 2) if gps else 0.0
        tier = "Excellent" if avg_cat_gp >= 8.5 else ("Good" if avg_cat_gp >= 7.0 else ("Average" if avg_cat_gp >= 5.5 else "Needs Attention"))
        category_analysis_list.append(SubjectCategoryAnalysis(
            category_name=cat_name,
            average_grade_points=avg_cat_gp,
            subject_count=len(gps),
            performance_tier=tier
        ))

    return {
        "strong_subjects": strong_subjects,
        "weak_subjects": weak_subjects,
        "critical_subjects": critical_subjects,
        "category_analysis": category_analysis_list,
        "subject_count": len(subject_map)
    }
