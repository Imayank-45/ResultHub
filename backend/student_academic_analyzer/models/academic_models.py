"""
academic_models.py
-------------------
Data models for Student Academic Analyzer module.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class SubjectAttempt(BaseModel):
    attempt_number: int = 1
    semester: int
    grade: str
    marks: Optional[float] = None
    status: str = "PASS"  # PASS, FAIL, ABSENT, PENDING
    term_or_date: Optional[str] = None


class SubjectRecord(BaseModel):
    code: str
    name: str
    credits: float = 0.0
    marks: Optional[float] = None
    grade: str = "-"
    status: str = "PASS"  # PASS, FAIL, ABSENT
    original_code: Optional[str] = None
    original_name: Optional[str] = None
    category: str = "Other / Uncategorized"
    attempts: List[SubjectAttempt] = Field(default_factory=list)


class SemesterRecord(BaseModel):
    semester_number: int
    raw_title: Optional[str] = None
    sgpa: Optional[float] = None
    credits: float = 0.0
    subjects: List[SubjectRecord] = Field(default_factory=list)


class StudentIdentity(BaseModel):
    enrollment: str
    name: str = "Unknown Student"
    branch: str = "Unknown Branch"
    course: str = "B.Tech."


class AcademicRisk(BaseModel):
    risk_level: str = "LOW"  # LOW, MODERATE, HIGH, CRITICAL
    score: float = 0.0  # 0 to 100
    reasons: List[str] = Field(default_factory=list)


class ConsistencyScore(BaseModel):
    score: float = 100.0  # 0 to 100
    rating: str = "Excellent"  # Excellent, Good, Average, Inconsistent, Critical
    explanation: str = ""


class CGPAProjection(BaseModel):
    current_cgpa: float = 0.0
    projected_similar: float = 0.0
    projected_improved: float = 0.0
    projected_decline: float = 0.0
    is_estimate: bool = True
    note: str = "Projections are scenario-based mathematical estimates."


class SubjectCategoryAnalysis(BaseModel):
    category_name: str
    average_grade_points: float = 0.0
    subject_count: int = 0
    performance_tier: str = "Average"


class BacklogSummary(BaseModel):
    total_backlogs: int = 0
    active_backlogs: int = 0
    cleared_backlogs: int = 0
    cleared_list: List[Dict[str, Any]] = Field(default_factory=list)
    active_list: List[Dict[str, Any]] = Field(default_factory=list)


class AcademicAnalytics(BaseModel):
    overview: Dict[str, Any] = Field(default_factory=dict)
    gpa_trend: List[Dict[str, Any]] = Field(default_factory=list)
    subject_analysis: Dict[str, Any] = Field(default_factory=dict)
    category_analysis: List[SubjectCategoryAnalysis] = Field(default_factory=list)
    backlog_summary: BacklogSummary = Field(default_factory=BacklogSummary)
    grade_distribution: Dict[str, int] = Field(default_factory=dict)
    credit_summary: Dict[str, Any] = Field(default_factory=dict)
    semester_comparison: List[Dict[str, Any]] = Field(default_factory=list)
    risk_analysis: AcademicRisk = Field(default_factory=AcademicRisk)
    consistency_score: ConsistencyScore = Field(default_factory=ConsistencyScore)
    cgpa_projection: CGPAProjection = Field(default_factory=CGPAProjection)
    best_worst_analysis: Dict[str, Any] = Field(default_factory=dict)
    timeline: List[Dict[str, Any]] = Field(default_factory=list)


class AIInsights(BaseModel):
    overall_assessment: str = ""
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    performance_trend: str = ""
    critical_subjects: List[str] = Field(default_factory=list)
    backlog_situation: str = ""
    academic_consistency: str = ""
    major_improvements: List[str] = Field(default_factory=list)
    major_declines: List[str] = Field(default_factory=list)
    recommended_focus_areas: List[str] = Field(default_factory=list)


class ValidationIssue(BaseModel):
    type: str
    category: str
    reason: str
    affected_records: List[str] = Field(default_factory=list)
    severity: str = "WARNING"  # WARNING, ERROR, INFO


class ValidationReport(BaseModel):
    total_files: int = 0
    total_subjects: int = 0
    total_semesters: int = 0
    student_identity_matched: bool = True
    has_warnings: bool = False
    has_errors: bool = False
    issues: List[ValidationIssue] = Field(default_factory=list)


class AcademicProfile(BaseModel):
    identity: StudentIdentity
    semesters: List[SemesterRecord] = Field(default_factory=list)
    cgpa: float = 0.0
    backlogs: BacklogSummary = Field(default_factory=BacklogSummary)
    analytics: AcademicAnalytics = Field(default_factory=AcademicAnalytics)
    ai_insights: AIInsights = Field(default_factory=AIInsights)
    validation_report: ValidationReport = Field(default_factory=ValidationReport)


class ManualEntryRequest(BaseModel):
    student_name: str
    enrollment: str
    branch: Optional[str] = "IT"
    course: Optional[str] = "B.Tech."
    semesters: List[SemesterRecord]


class QARequest(BaseModel):
    question: str
    profile: AcademicProfile
