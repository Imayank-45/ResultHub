from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Index, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    profile_image = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    email_verified = Column(Boolean, default=True, nullable=False)

    # Relationships
    login_histories = relationship("LoginHistory", back_populates="user", cascade="all, delete-orphan")
    scrape_histories = relationship("ScrapeJobHistory", back_populates="user", cascade="all, delete-orphan")
    conversion_histories = relationship("FileConversionHistory", back_populates="user", cascade="all, delete-orphan")
    refresh_sessions = relationship("RefreshTokenSession", back_populates="user", cascade="all, delete-orphan")
    auth_tokens = relationship("AuthSecurityToken", back_populates="user", cascade="all, delete-orphan")


class RefreshTokenSession(Base):
    __tablename__ = "refresh_token_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)

    # Relationship to user
    user = relationship("User", back_populates="refresh_sessions")


class AuthSecurityToken(Base):
    __tablename__ = "auth_security_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    email = Column(String(150), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, index=True)
    token_type = Column(String(30), nullable=False)  # "email_verification" or "password_reset"
    otp_code = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)

    # Relationship to user
    user = relationship("User", back_populates="auth_tokens")


class LoginHistory(Base):
    __tablename__ = "login_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    login_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    logout_time = Column(DateTime, nullable=True)
    ip_address = Column(String(50), nullable=True)
    browser = Column(String(100), nullable=True)
    os = Column(String(100), nullable=True)

    # Relationship to user
    user = relationship("User", back_populates="login_histories")



class ScrapeJobHistory(Base):
    __tablename__ = "scrape_job_histories"
    __table_args__ = (
        Index("ix_scrape_job_histories_user_job", "user_id", "job_id"),
        Index("ix_scrape_job_histories_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    job_id = Column(String(50), index=True, nullable=False)
    prefix = Column(String(50), nullable=False)
    start_roll = Column(Integer, nullable=False)
    end_roll = Column(Integer, nullable=False)
    pad = Column(Integer, default=2)
    sem = Column(String(20), nullable=True)
    program = Column(String(50), default="B.Tech.")
    total_students = Column(Integer, default=0)
    processed_students = Column(Integer, default=0)
    passed_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    not_found_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    processing_time_seconds = Column(Integer, default=0)
    status = Column(String(30), nullable=False)
    excel_file_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship to user
    user = relationship("User", back_populates="scrape_histories")


class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"
    __table_args__ = (
        Index("ix_scrape_jobs_user_job", "user_id", "job_id"),
    )

    job_id = Column(String(64), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(30), nullable=False, index=True)
    status_json = Column(Text, nullable=False)
    excel_file_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User")


class FileConversionHistory(Base):
    __tablename__ = "file_conversion_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    operation = Column(String(50), nullable=False)  # e.g., 'excel_to_pdf', 'pdf_merge', etc.
    original_filename = Column(String(255), nullable=False)
    output_filename = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    output_path = Column(String(500), nullable=True)
    status = Column(String(30), default="completed")  # completed, failed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship to user
    user = relationship("User", back_populates="conversion_histories")


class MidSemSession(Base):
    __tablename__ = "mid_sem_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    academic_session = Column(String(50), nullable=False)  # e.g. "Jan - Jun 2026"
    year = Column(String(20), nullable=False)              # e.g. "2nd Year"
    semester = Column(String(20), nullable=False)          # e.g. "IV"
    branch = Column(String(50), nullable=False)            # e.g. "CSE"
    program = Column(String(50), default="B.Tech.")
    roll_prefix = Column(String(50), nullable=False)       # e.g. "0105CS2410"
    roll_start = Column(Integer, nullable=False)
    roll_end = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    student_marks = relationship("MidSemStudentMarks", back_populates="session", cascade="all, delete-orphan")


from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, UniqueConstraint

class MidSemSubject(Base):
    __tablename__ = "mid_sem_subjects"
    __table_args__ = (
        UniqueConstraint('program', 'branch', 'semester', 'subject_code', name='uix_program_branch_sem_subjcode'),
    )

    id = Column(Integer, primary_key=True, index=True)
    branch = Column(String(50), nullable=False, index=True)
    semester = Column(String(20), nullable=False, index=True)
    program = Column(String(50), default="B.Tech.", nullable=False)
    subject_code = Column(String(50), nullable=False)
    subject_name = Column(String(150), nullable=True)
    mst1_max = Column(Float, default=10.0, nullable=False)
    mst2_max = Column(Float, default=10.0, nullable=False)
    total_max = Column(Float, default=20.0, nullable=False)
    display_order = Column(Integer, default=1, nullable=False)
    mst_enabled = Column(Boolean, default=True, nullable=False)
    is_elective = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class MidSemStudentMarks(Base):
    __tablename__ = "mid_sem_student_marks"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("mid_sem_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    enrollment_no = Column(String(50), nullable=False, index=True)
    student_name = Column(String(150), nullable=True)
    subject_id = Column(Integer, ForeignKey("mid_sem_subjects.id"), nullable=False)
    mst1_marks = Column(Float, nullable=True)
    mst2_marks = Column(Float, nullable=True)
    total_marks = Column(Float, nullable=True)
    absence_type = Column(String(30), nullable=True) # None, 'ABSENT_BOTH', 'ABSENT_MST1', 'ABSENT_MST2'
    status = Column(String(30), default="READY", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    session = relationship("MidSemSession", back_populates="student_marks")
    subject = relationship("MidSemSubject")

    __table_args__ = (
        UniqueConstraint('session_id', 'enrollment_no', 'subject_id', name='uix_session_student_subject'),
    )



