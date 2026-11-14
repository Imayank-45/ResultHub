"""
academic_insights.py
--------------------
Deterministic local AI insights generator.
Produces structured natural language evaluation strictly grounded in analyzed student records.
No external calls, no hallucinations.
"""

from typing import Dict, Any, List
from backend.student_academic_analyzer.models.academic_models import AIInsights, AcademicAnalytics, BacklogSummary


def generate_local_ai_insights(
    cgpa: float,
    analytics: AcademicAnalytics,
    backlogs: BacklogSummary,
    student_name: str
) -> AIInsights:
    """
    Generates structured AI Insights strictly grounded in student academic data.
    """
    gpa_trend = analytics.gpa_trend
    best_worst = analytics.best_worst_analysis
    subj_analysis = analytics.subject_analysis
    risk = analytics.risk_analysis
    consistency = analytics.consistency_score

    # Overall Assessment
    if cgpa >= 8.5:
        overall = f"{student_name} demonstrates exceptional academic excellence with an impressive CGPA of {cgpa:.2f}. Overall performance across analyzed semesters is highly strong."
    elif cgpa >= 7.5:
        overall = f"{student_name} maintains a solid academic standing with a CGPA of {cgpa:.2f}, demonstrating consistent grasp of core engineering subjects."
    elif cgpa >= 6.0:
        overall = f"{student_name} exhibits satisfactory academic performance (CGPA {cgpa:.2f}). Targeted effort in weaker subject areas will help boost overall SGPA."
    else:
        overall = f"Academic performance for {student_name} requires immediate focused attention (CGPA {cgpa:.2f}). Systematic revision and backlog resolution are recommended."

    # Strengths
    strengths = []
    strong_subs = subj_analysis.get("strong_subjects", [])
    if strong_subs:
        s_names = [s["name"] for s in strong_subs[:3]]
        strengths.append(f"Strong performance in subjects: {', '.join(s_names)}.")

    cat_analysis = analytics.category_analysis
    top_cats = sorted([c for c in cat_analysis if c.average_grade_points >= 7.5], key=lambda c: c.average_grade_points, reverse=True)
    if top_cats:
        c_names = [c.category_name for c in top_cats[:2]]
        strengths.append(f"High proficiency in domain categories: {', '.join(c_names)}.")

    if not strengths:
        strengths.append("Maintains regular passing attendance in core semester modules.")

    # Weaknesses
    weaknesses = []
    weak_subs = subj_analysis.get("weak_subjects", [])
    if weak_subs:
        w_names = [w["name"] for w in weak_subs[:3]]
        weaknesses.append(f"Lower relative grades observed in: {', '.join(w_names)}.")

    if backlogs.active_backlogs > 0:
        weaknesses.append(f"{backlogs.active_backlogs} active backlog(s) pending clearance.")

    if not weaknesses:
        weaknesses.append("No major academic weaknesses identified in analyzed records.")

    # Performance Trend
    overall_trend_type = analytics.overview.get("overall_trend", "Stable")
    if overall_trend_type == "Improving":
        trend_text = "Positive trajectory: SGPA shows a clear upward trend across analyzed semesters."
    elif overall_trend_type == "Declining":
        trend_text = "Noticeable downward trend: SGPA has decreased in recent semesters."
    else:
        trend_text = "Stable trajectory: SGPA performance remains consistent across semesters."

    # Critical Subjects
    crit_subs = subj_analysis.get("critical_subjects", [])
    critical_list = [c["name"] for c in crit_subs] if crit_subs else ["None"]

    # Backlog Situation
    if backlogs.active_backlogs > 0:
        backlog_text = f"Attention Required: {backlogs.active_backlogs} active backlog(s) pending ({', '.join([b['name'] for b in backlogs.active_list])})."
    elif backlogs.cleared_backlogs > 0:
        backlog_text = f"Good Progress: {backlogs.cleared_backlogs} backlog(s) successfully cleared in subsequent attempts."
    else:
        backlog_text = "Clean Record: Zero active or historical backlogs."

    # Academic Consistency
    consistency_text = f"Consistency Score: {consistency.score}/100 ({consistency.rating}). {consistency.explanation}"

    # Recommended Focus Areas
    focus_areas = []
    if crit_subs:
        focus_areas.append(f"Prioritize preparation for critical subject(s): {', '.join(critical_list[:2])}.")
    if weak_subs:
        focus_areas.append(f"Dedicate extra practice to weaker domain modules ({weak_subs[0]['name']}).")
    focus_areas.append("Maintain steady study schedules for upcoming semester examinations.")

    return AIInsights(
        overall_assessment=overall,
        strengths=strengths,
        weaknesses=weaknesses,
        performance_trend=trend_text,
        critical_subjects=critical_list,
        backlog_situation=backlog_text,
        academic_consistency=consistency_text,
        major_improvements=[f"Best Semester: Sem {best_worst.get('best_semester', {}).get('semester_number', 1)} (SGPA {best_worst.get('best_semester', {}).get('sgpa', 0.0)})"] if best_worst.get('best_semester') else [],
        major_declines=[f"Weakest Semester: Sem {best_worst.get('weakest_semester', {}).get('semester_number', 1)} (SGPA {best_worst.get('weakest_semester', {}).get('sgpa', 0.0)})"] if best_worst.get('weakest_semester') else [],
        recommended_focus_areas=focus_areas
    )
