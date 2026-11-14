"""
risk_consistency_engine.py
---------------------------
Transparent rule-based Risk Engine (LOW, MODERATE, HIGH, CRITICAL),
Academic Consistency Score (0-100), and scenario-based CGPA Projections.
"""

from typing import List, Dict, Any
from backend.student_academic_analyzer.models.academic_models import (
    SemesterRecord, AcademicRisk, ConsistencyScore, CGPAProjection, BacklogSummary
)


def evaluate_academic_risk(
    cgpa: float,
    gpa_trend: List[Dict[str, Any]],
    backlog_summary: BacklogSummary,
    semesters: List[SemesterRecord]
) -> AcademicRisk:
    """
    Transparent rule-based Risk Engine.
    Evaluates active backlogs, repeated failures, continuous SGPA decline, low SGPA.
    Returns AcademicRisk with risk_level, score, and explicit reasoning list.
    """
    reasons = []
    penalty_score = 0.0

    # 1. Active Backlogs Check
    active_b = backlog_summary.active_backlogs
    if active_b >= 3:
        penalty_score += 40.0
        reasons.append(f"Critical backlog count: {active_b} active backlogs currently unresolved.")
    elif active_b == 2:
        penalty_score += 25.0
        reasons.append(f"Multiple active backlogs ({active_b} subjects currently failing).")
    elif active_b == 1:
        penalty_score += 12.0
        reasons.append("1 active backlog present.")

    # 2. Repeated Failures Check
    repeated_fails = sum(1 for item in backlog_summary.active_list if item["total_attempts"] > 1)
    if repeated_fails > 0:
        penalty_score += 15.0
        reasons.append(f"{repeated_fails} subject(s) with repeated fail attempts.")

    # 3. CGPA Level Check
    if cgpa < 5.0 and cgpa > 0:
        penalty_score += 35.0
        reasons.append(f"Overall CGPA is critically low ({cgpa:.2f} < 5.00).")
    elif cgpa < 6.0 and cgpa > 0:
        penalty_score += 20.0
        reasons.append(f"Overall CGPA is below recommended target ({cgpa:.2f} < 6.00).")
    elif cgpa < 7.0 and cgpa > 0:
        penalty_score += 8.0
        reasons.append(f"CGPA is in moderate range ({cgpa:.2f}).")

    # 4. Continuous SGPA Decline Check
    if len(gpa_trend) >= 3:
        s1 = gpa_trend[-3]["sgpa"]
        s2 = gpa_trend[-2]["sgpa"]
        s3 = gpa_trend[-1]["sgpa"]
        if s3 < s2 and s2 < s1:
            penalty_score += 18.0
            reasons.append(f"Continuous SGPA decline observed over last 3 semesters ({s1:.2f} → {s2:.2f} → {s3:.2f}).")
    elif len(gpa_trend) == 2:
        s1 = gpa_trend[0]["sgpa"]
        s2 = gpa_trend[1]["sgpa"]
        if s2 - s1 <= -0.5:
            penalty_score += 12.0
            reasons.append(f"Significant drop in SGPA between Sem {gpa_trend[0]['semester_number']} and Sem {gpa_trend[1]['semester_number']} ({s1:.2f} → {s2:.2f}).")

    # Calculate final risk score and level
    risk_score = min(100.0, max(0.0, penalty_score))

    if risk_score >= 50.0 or active_b >= 3 or (cgpa < 5.0 and cgpa > 0):
        level = "CRITICAL"
    elif risk_score >= 30.0 or active_b >= 2 or (cgpa < 6.0 and cgpa > 0):
        level = "HIGH"
    elif risk_score >= 15.0 or active_b == 1:
        level = "MODERATE"
    else:
        level = "LOW"
        if not reasons:
            reasons.append("No active backlogs. Consistent academic performance maintained.")

    return AcademicRisk(
        risk_level=level,
        score=round(risk_score, 1),
        reasons=reasons
    )


def compute_consistency_score(
    gpa_trend: List[Dict[str, Any]],
    backlog_summary: BacklogSummary
) -> ConsistencyScore:
    """
    Computes Academic Consistency Score (0-100) based on SGPA variance, backlog history, and pass stability.
    """
    if not gpa_trend:
        return ConsistencyScore(score=100.0, rating="Baseline", explanation="Initial academic record baseline.")

    sgpas = [g["sgpa"] for g in gpa_trend]
    avg_sgpa = sum(sgpas) / len(sgpas)

    # Standard deviation calculation
    variance = sum((s - avg_sgpa) ** 2 for s in sgpas) / len(sgpas) if len(sgpas) > 1 else 0.0
    std_dev = variance ** 0.5

    # Base score 100
    base_score = 100.0 - (std_dev * 15.0) - (backlog_summary.active_backlogs * 10.0) - (backlog_summary.total_backlogs * 4.0)
    score = min(100.0, max(0.0, base_score))

    if score >= 85.0:
        rating = "Excellent"
        expl = f"High stability across analyzed semesters (Average SGPA: {avg_sgpa:.2f}, Low Variance: ±{std_dev:.2f})."
    elif score >= 70.0:
        rating = "Good"
        expl = f"Good academic consistency with minor SGPA fluctuations (Average SGPA: {avg_sgpa:.2f})."
    elif score >= 55.0:
        rating = "Average"
        expl = f"Moderate variance across semesters (Average SGPA: {avg_sgpa:.2f}, Std Dev: ±{std_dev:.2f})."
    elif score >= 40.0:
        rating = "Inconsistent"
        expl = f"Inconsistent performance with notable SGPA swings or backlogs."
    else:
        rating = "Critical"
        expl = f"High variance and unresolved backlogs impact academic stability."

    return ConsistencyScore(
        score=round(score, 1),
        rating=rating,
        explanation=expl
    )


def calculate_cgpa_projections(
    cgpa: float,
    semesters: List[SemesterRecord],
    total_curriculum_sems: int = 8
) -> CGPAProjection:
    """
    Generates mathematical scenario-based CGPA projections for remaining semesters.
    Calculates estimated CGPA if student maintains current performance, improves (+0.5 SGPA), or declines (-0.5 SGPA).
    """
    completed_sems = len(semesters)
    remaining_sems = max(0, total_curriculum_sems - completed_sems)

    if remaining_sems == 0 or completed_sems == 0:
        return CGPAProjection(
            current_cgpa=cgpa,
            projected_similar=cgpa,
            projected_improved=cgpa,
            projected_decline=cgpa,
            is_estimate=True,
            note="Curriculum completed or no future semesters remaining."
        )

    # Assume average credits per semester = 24
    completed_credits = completed_sems * 24.0
    remaining_credits = remaining_sems * 24.0
    total_credits = completed_credits + remaining_credits

    curr_points = cgpa * completed_credits

    # 1. Maintain similar performance
    proj_similar = round((curr_points + (cgpa * remaining_credits)) / total_credits, 2)

    # 2. Improvement scenario (+0.5 SGPA or max 10.0)
    target_imp_sgpa = min(10.0, cgpa + 0.6)
    proj_improved = round((curr_points + (target_imp_sgpa * remaining_credits)) / total_credits, 2)

    # 3. Decline scenario (-0.5 SGPA or min 4.0)
    target_dec_sgpa = max(4.0, cgpa - 0.6)
    proj_decline = round((curr_points + (target_dec_sgpa * remaining_credits)) / total_credits, 2)

    return CGPAProjection(
        current_cgpa=cgpa,
        projected_similar=proj_similar,
        projected_improved=proj_improved,
        projected_decline=proj_decline,
        is_estimate=True,
        note=f"Mathematical estimates based on remaining {remaining_sems} semester(s) of curriculum."
    )
