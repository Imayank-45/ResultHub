"""
gpa_analytics.py
----------------
Computes SGPA, CGPA, best/weakest semester, consecutive semester trends, and grade distributions.
"""

from typing import List, Dict, Any, Tuple
from backend.student_academic_analyzer.models.academic_models import SemesterRecord, SubjectRecord

GRADE_POINTS = {
    "O": 10.0,
    "A+": 9.0,
    "A": 8.0,
    "B+": 7.0,
    "B": 6.0,
    "C": 5.0,
    "D": 4.0,
    "P": 4.0,
    "PASS": 8.0,
    "F": 0.0,
    "FAIL": 0.0,
    "ABS": 0.0,
    "AB": 0.0,
    "-": 0.0
}


def compute_semester_sgpa(subjects: List[SubjectRecord]) -> Tuple[float, float]:
    """
    Computes (sgpa, total_credits) from subjects list using standard credit weighting.
    """
    total_credits = 0.0
    weighted_points = 0.0

    for sub in subjects:
        cr = sub.credits if sub.credits > 0 else 4.0
        total_credits += cr
        gp = GRADE_POINTS.get(sub.grade.upper(), 8.0 if sub.status == "PASS" else 0.0)
        weighted_points += gp * cr

    sgpa = round(weighted_points / total_credits, 2) if total_credits > 0 else 0.0
    return sgpa, total_credits


def analyze_gpa_trends(semesters: List[SemesterRecord]) -> Dict[str, Any]:
    """
    Analyzes multi-semester GPA progression, CGPA, best/weakest sem, and trends.
    """
    if not semesters:
        return {
            "cgpa": 0.0,
            "best_semester": None,
            "weakest_semester": None,
            "gpa_trend": [],
            "semester_comparison": [],
            "overall_trend": "Stable"
        }

    gpa_trend = []
    sem_comparisons = []
    total_cum_credits = 0.0
    total_cum_weighted = 0.0

    prev_sgpa = None

    for sem in sorted(semesters, key=lambda s: s.semester_number):
        calculated_sgpa, sem_credits = compute_semester_sgpa(sem.subjects)
        final_sgpa = sem.sgpa if (sem.sgpa and sem.sgpa > 0) else calculated_sgpa
        sem.sgpa = final_sgpa
        sem.credits = sem_credits

        total_cum_credits += sem_credits
        total_cum_weighted += final_sgpa * sem_credits

        cum_cgpa = round(total_cum_weighted / total_cum_credits, 2) if total_cum_credits > 0 else final_sgpa

        gpa_trend.append({
            "semester_number": sem.semester_number,
            "title": f"Semester {sem.semester_number}",
            "sgpa": final_sgpa,
            "cgpa": cum_cgpa,
            "credits": sem_credits,
            "passed_subjects": sum(1 for s in sem.subjects if s.status == "PASS"),
            "total_subjects": len(sem.subjects)
        })

        if prev_sgpa is not None:
            diff = round(final_sgpa - prev_sgpa, 2)
            trend_label = "Improvement" if diff > 0.1 else ("Decline" if diff < -0.1 else "Stable")
            sem_comparisons.append({
                "from_sem": sem.semester_number - 1,
                "to_sem": sem.semester_number,
                "diff": diff,
                "trend": trend_label,
                "formatted_text": f"Sem {sem.semester_number - 1} → Sem {sem.semester_number}: SGPA {diff:+.2f} ({trend_label})"
            })

        prev_sgpa = final_sgpa

    final_cgpa = round(total_cum_weighted / total_cum_credits, 2) if total_cum_credits > 0 else 0.0

    # Best & Weakest semester
    best_sem = max(gpa_trend, key=lambda x: x["sgpa"]) if gpa_trend else None
    weakest_sem = min(gpa_trend, key=lambda x: x["sgpa"]) if gpa_trend else None

    # Determine overall trend
    if len(gpa_trend) >= 2:
        first_sgpa = gpa_trend[0]["sgpa"]
        last_sgpa = gpa_trend[-1]["sgpa"]
        if last_sgpa - first_sgpa >= 0.3:
            overall_trend = "Improving"
        elif last_sgpa - first_sgpa <= -0.3:
            overall_trend = "Declining"
        else:
            overall_trend = "Consistent"
    else:
        overall_trend = "Baseline"

    return {
        "cgpa": final_cgpa,
        "best_semester": best_sem,
        "weakest_semester": weakest_sem,
        "gpa_trend": gpa_trend,
        "semester_comparison": sem_comparisons,
        "overall_trend": overall_trend
    }


def compute_grade_distribution(semesters: List[SemesterRecord]) -> Dict[str, int]:
    dist = {"O": 0, "A+": 0, "A": 0, "B+": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for sem in semesters:
        for sub in sem.subjects:
            g = sub.grade.upper()
            if g in dist:
                dist[g] += 1
            elif g in ["PASS", "P"]:
                dist["A"] += 1
            elif g in ["FAIL", "ABS", "AB", "RL"]:
                dist["F"] += 1
            else:
                dist["B"] += 1
    return dist
