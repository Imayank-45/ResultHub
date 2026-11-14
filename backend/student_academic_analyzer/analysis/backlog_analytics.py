"""
backlog_analytics.py
---------------------
Tracks active, cleared, and total backlogs, subject-wise clearance timelines,
and attempt histories across multiple semesters.
"""

from typing import List, Dict, Any
from backend.student_academic_analyzer.models.academic_models import SemesterRecord, BacklogSummary


def analyze_backlogs_and_attempts(semesters: List[SemesterRecord]) -> Tuple_BacklogResult:
    """
    Analyzes active backlogs, cleared backlogs, and multi-attempt subject histories.
    """
    sorted_sems = sorted(semesters, key=lambda s: s.semester_number)
    subject_attempts: Dict[str, List[Dict[str, Any]]] = {}

    for sem in sorted_sems:
        for sub in sem.subjects:
            code = sub.code
            if code not in subject_attempts:
                subject_attempts[code] = []

            attempt_num = len(subject_attempts[code]) + 1
            att_entry = {
                "attempt_number": attempt_num,
                "semester": sem.semester_number,
                "name": sub.name,
                "grade": sub.grade,
                "marks": sub.marks,
                "status": sub.status,
                "credits": sub.credits
            }
            subject_attempts[code].append(att_entry)
            sub.attempts = [att_entry]

    total_backlogs = 0
    cleared_list = []
    active_list = []

    for code, attempts in subject_attempts.items():
        failed_attempts = [a for a in attempts if a["status"] == "FAIL"]
        if not failed_attempts:
            continue

        total_backlogs += 1
        latest_attempt = attempts[-1]
        first_fail_sem = failed_attempts[0]["semester"]
        sub_name = attempts[0]["name"]

        if latest_attempt["status"] == "PASS":
            cleared_list.append({
                "code": code,
                "name": sub_name,
                "first_fail_semester": first_fail_sem,
                "cleared_semester": latest_attempt["semester"],
                "total_attempts": len(attempts),
                "cleared_grade": latest_attempt["grade"],
                "attempt_history": attempts
            })
        else:
            active_list.append({
                "code": code,
                "name": sub_name,
                "first_fail_semester": first_fail_sem,
                "current_semester": latest_attempt["semester"],
                "total_attempts": len(attempts),
                "latest_grade": latest_attempt["grade"],
                "attempt_history": attempts
            })

    summary = BacklogSummary(
        total_backlogs=total_backlogs,
        active_backlogs=len(active_list),
        cleared_backlogs=len(cleared_list),
        cleared_list=cleared_list,
        active_list=active_list
    )

    return summary, subject_attempts


class Tuple_BacklogResult:
    pass
