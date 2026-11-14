"""
ask_my_result_engine.py
-------------------------
Local conversational Q&A assistant for Student Academic Analyzer.
Answers questions strictly using the student's analyzed dataset offline.
"""

import re
from typing import Dict, Any
from backend.student_academic_analyzer.models.academic_models import AcademicProfile


def answer_student_question(question: str, profile: AcademicProfile) -> str:
    """
    Answers user queries strictly from the analyzed student dataset.
    If information is not present in the dataset, returns a clear offline notice.
    """
    q_lower = question.lower().strip()
    identity = profile.identity
    analytics = profile.analytics
    cgpa = profile.cgpa
    backlogs = profile.backlogs

    # 1. Weakest Subject
    if any(k in q_lower for k in ["weakest subject", "weak subject", "lowest subject", "kamzor subject", "weakest"]):
        weak_subs = analytics.subject_analysis.get("weak_subjects", [])
        crit_subs = analytics.subject_analysis.get("critical_subjects", [])
        all_weak = crit_subs + weak_subs
        if all_weak:
            w = all_weak[0]
            return f"📌 **Weakest Subject**: `{w['name']}` ({w['code']}) with an average grade point of `{w['average_grade_points']}` (Latest Grade: `{w['latest_grade']}`)."
        else:
            return f"🎉 **No Weak Subjects**: Great job! All analyzed subjects have solid performance grades above 6.5."

    # 2. Best Semester
    elif any(k in q_lower for k in ["best semester", "highest sem", "best sem", "top sem"]):
        best_sem = analytics.best_worst_analysis.get("best_semester")
        if best_sem:
            return f"🏆 **Best Semester**: **Semester {best_sem['semester_number']}** with your highest SGPA of **`{best_sem['sgpa']}`** ({best_sem['passed_subjects']} subjects passed)."
        else:
            return "ℹ️ Semester performance data is not available."

    # 3. Weakest Semester
    elif any(k in q_lower for k in ["weakest semester", "lowest sem", "worst sem"]):
        weakest_sem = analytics.best_worst_analysis.get("weakest_semester")
        if weakest_sem:
            return f"📉 **Weakest Semester**: **Semester {weakest_sem['semester_number']}** with an SGPA of **`{weakest_sem['sgpa']}`**."
        else:
            return "ℹ️ Semester performance data is not available."

    # 4. Backlogs Query
    elif any(k in q_lower for k in ["backlog", "backlogs", "kt", "failed subject"]):
        if backlogs.active_backlogs > 0:
            active_names = ", ".join([f"`{b['name']}` ({b['code']})" for b in backlogs.active_list])
            return f"⚠️ **Active Backlogs**: You currently have **{backlogs.active_backlogs} active backlog(s)**:\n- {active_names}\nTotal historical backlogs: {backlogs.total_backlogs} (Cleared: {backlogs.cleared_backlogs})."
        elif backlogs.cleared_backlogs > 0:
            return f"✅ **Zero Active Backlogs**: You have cleared all {backlogs.cleared_backlogs} historical backlog(s)! Active backlogs: **0**."
        else:
            return "🎉 **Zero Backlogs**: You have 0 active or historical backlogs across all analyzed semesters!"

    # 5. SGPA Improvement / Trend Query
    elif any(k in q_lower for k in ["improved", "improvement", "sgpa trend", "trend", "performance trend"]):
        trend = analytics.overview.get("overall_trend", "Stable")
        gpa_trend = analytics.gpa_trend
        gpa_str = " → ".join([f"Sem {g['semester_number']}: `{g['sgpa']}`" for g in gpa_trend])
        return f"📈 **SGPA Trend Analysis**: Overall trajectory is **{trend}**.\n- Progression: {gpa_str}."

    # 6. Focus Subjects
    elif any(k in q_lower for k in ["focus", "which subject should i focus", "recommendation"]):
        focus_list = profile.ai_insights.recommended_focus_areas
        if focus_list:
            items_md = "\n".join([f"• {item}" for item in focus_list])
            return f"🎯 **Recommended Focus Areas**:\n\n{items_md}"
        else:
            return "🎯 Keep maintaining your current steady study routines across all modules."

    # 7. CGPA Query
    elif any(k in q_lower for k in ["cgpa", "overall gpa", "grade point average"]):
        proj = analytics.cgpa_projection
        return f"🎓 **Current CGPA**: **`{cgpa:.2f}`**\n- Scenario Projection (Maintain Current): `~{proj.projected_similar:.2f}`\n- Scenario Projection (With Improvement): `~{proj.projected_improved:.2f}`."

    # 8. Risk Query
    elif any(k in q_lower for k in ["risk", "why high risk", "risk level", "academic risk"]):
        risk = analytics.risk_analysis
        reasons_md = "\n".join([f"• {r}" for r in risk.reasons])
        return f"⚠️ **Academic Risk Level**: **`{risk.risk_level}`** (Risk Penalty Score: `{risk.score}/100`)\n\n**Contributing Factors**:\n{reasons_md}"

    # 9. General Summary Query
    elif any(k in q_lower for k in ["summary", "overview", "who am i", "student details"]):
        return (
            f"👤 **Student Academic Profile**\n"
            f"- **Name**: **{identity.name}** | **Enrollment**: `{identity.enrollment}`\n"
            f"- **Branch**: `{identity.branch}` | **Course**: `{identity.course}`\n"
            f"- **CGPA**: **`{cgpa:.2f}`** | **Semesters Analyzed**: `{len(profile.semesters)}`\n"
            f"- **Active Backlogs**: `{backlogs.active_backlogs}` | **Consistency Score**: `{analytics.consistency_score.score}/100`"
        )

    # Fallback for unrecognized questions
    return (
        f"🤖 **Student Dataset Assistant**\n\n"
        f"This information is not directly available in the uploaded student dataset for query: *'{question}'*.\n\n"
        f"💡 **Suggested Questions You Can Ask**:\n"
        f"- `What is my weakest subject?`\n"
        f"- `Which semester was my best?`\n"
        f"- `How many backlogs do I have?`\n"
        f"- `Has my SGPA improved?`\n"
        f"- `What is my current CGPA?`\n"
        f"- `Why is my academic risk marked high?`"
    )
