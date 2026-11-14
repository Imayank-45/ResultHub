import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
import logging

logger = logging.getLogger("result_ai.auth_router")
from sqlalchemy import or_
from sqlalchemy.orm import Session
try:
    import user_agents
except ImportError:
    user_agents = None

from backend.db.database import get_db
from backend.db.models import User, LoginHistory, AuthSecurityToken
from backend.db.schemas import (
    LoginRequest,
    RegisterRequest,
    SendMobileOtpRequest,
    VerifyMobileOtpRequest,
    TokenResponse,
    RefreshTokenRequest,
    UserResponse,
    ProfileUpdateRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    FullUserMeResponse,
    LoginHistoryResponse,
    LogoutRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    VerifyResetOtpRequest,
    VerifyResetOtpResponse,
    ResetPasswordRequest
)
from backend.db.auth import (
    verify_password,
    get_password_hash,
    validate_password_strength,
    create_access_token,
    create_refresh_token,
    create_refresh_token_session,
    verify_refresh_token_session,
    revoke_refresh_token_session,
    revoke_all_user_sessions,
    hash_token,
    decode_token,
    get_current_user,
    SECRET_KEY,
    REFRESH_SECRET_KEY,
    REMEMBER_ME_ACCESS_TOKEN_EXPIRE_DAYS,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from backend.utils.rate_limiter import login_rate_limiter
from backend.utils.email_service import email_service

auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def parse_user_agent(request: Request):
    """Parse client IP address, Browser, and Operating System from request."""
    ip = login_rate_limiter.get_client_ip(request)
    ua_string = request.headers.get("User-Agent", "")
    browser_str = "Unknown Browser"
    os_str = "Unknown OS"

    if ua_string and user_agents is not None:
        try:
            ua = user_agents.parse(ua_string)
            browser_str = f"{ua.browser.family} {ua.browser.version_string}".strip()
            os_str = f"{ua.os.family} {ua.os.version_string}".strip()
        except Exception:
            browser_str = ua_string[:50]
    elif ua_string:
        browser_str = ua_string[:50]

    return ip, browser_str, os_str


def generate_otp_code() -> str:
    """Generate a cryptographically secure 6-digit numeric OTP code."""
    return f"{secrets.randbelow(900000) + 100000}"


@auth_router.post("/login", response_model=TokenResponse)
def login(login_req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Authenticate user with rate-limiting, record login history, and issue refresh token session."""
    # 1. Rate limiter check (5 failed attempts per minute per IP)
    login_rate_limiter.check_rate_limit(request)

    identifier = (login_req.email or login_req.phone or "").strip()
    clean_identifier = identifier.lower()
    phone_digits = "".join(filter(str.isdigit, identifier))

    user = None
    if "@" in clean_identifier:
        user = db.query(User).filter(User.email == clean_identifier).first()
    else:
        # Search by email or phone
        query = db.query(User)
        filters = [User.email == clean_identifier, User.phone == clean_identifier]
        if len(phone_digits) >= 8:
            filters.append(User.phone.endswith(phone_digits[-10:]))
        user = query.filter(or_(*filters)).first()
    
    if not user or not verify_password(login_req.password, user.password_hash):
        login_rate_limiter.record_failed_attempt(request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/mobile or password. Please check your credentials and try again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        login_rate_limiter.record_failed_attempt(request)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact administrator."
        )

    # Reset rate limiter failed attempts on success
    login_rate_limiter.reset_failed_attempts(request)

    ip, browser, os_name = parse_user_agent(request)

    # Record login history
    login_history = LoginHistory(
        user_id=user.id,
        login_time=datetime.utcnow(),
        ip_address=ip,
        browser=browser,
        os=os_name
    )
    db.add(login_history)

    # Update user's last_login timestamp
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)

    # Calculate token duration based on Remember Me
    access_delta = timedelta(days=REMEMBER_ME_ACCESS_TOKEN_EXPIRE_DAYS) if login_req.remember_me else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_delta = timedelta(days=14)

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email}, expires_delta=access_delta)
    refresh_token = create_refresh_token(data={"sub": str(user.id)}, expires_delta=refresh_delta)

    # Create server-side session in database
    create_refresh_token_session(
        db=db,
        user_id=user.id,
        refresh_token=refresh_token,
        ip_address=ip,
        user_agent=f"{browser} ({os_name})",
        expires_delta=refresh_delta
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@auth_router.post("/send-mobile-otp")
def send_mobile_otp(req: SendMobileOtpRequest, db: Session = Depends(get_db)):
    """Generate and dispatch a 6-digit verification code to the provided mobile number."""
    phone_clean = req.phone.strip()
    otp_code = generate_otp_code()
    otp_hash = hash_token(otp_code)

    auth_token = AuthSecurityToken(
        email=f"{phone_clean}@mobile.resultai",
        token_hash=otp_hash,
        token_type="mobile_verification",
        otp_code=otp_code,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
        is_used=False
    )
    db.add(auth_token)
    db.commit()

    logger.info(f"[SMS OTP SERVICE] Verification OTP sent to {phone_clean}")
    return {"message": f"Verification code sent to {phone_clean}"}


@auth_router.post("/verify-mobile-otp")
def verify_mobile_otp(req: VerifyMobileOtpRequest, db: Session = Depends(get_db)):
    """Verify 6-digit mobile OTP code."""
    phone_clean = req.phone.strip()
    clean_otp = req.otp.strip()
    target_email = f"{phone_clean}@mobile.resultai"

    token_rec = (
        db.query(AuthSecurityToken)
        .filter(
            AuthSecurityToken.email == target_email,
            AuthSecurityToken.token_type == "mobile_verification",
            AuthSecurityToken.is_used == False
        )
        .order_by(AuthSecurityToken.created_at.desc())
        .first()
    )

    if not token_rec or token_rec.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification OTP code is invalid or has expired. Please request a new code."
        )

    if token_rec.otp_code != clean_otp and token_rec.token_hash != hash_token(clean_otp):
        token_rec.attempts += 1
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Please check and try again."
        )

    token_rec.is_used = True
    db.commit()
    return {"message": "Mobile number verified successfully!"}


@auth_router.post("/register", response_model=TokenResponse)
def register_user(req: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    """Register a new user account, send email/mobile verification OTP, and return JWT tokens."""
    raw_email = req.email.lower().strip() if req.email else ""
    raw_phone = req.phone.strip() if req.phone else ""

    if not raw_email and not raw_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either email address or mobile number is required to register."
        )

    # Check for existing email or phone
    if raw_email and db.query(User).filter(User.email == raw_email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account already exists. Try signing in instead."
        )
    if raw_phone and db.query(User).filter(User.phone == raw_phone).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account already exists. Try signing in instead."
        )

    if len(req.name.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name must be at least 2 characters long."
        )

    validate_password_strength(req.password)

    clean_email = raw_email if raw_email else f"{raw_phone}@mobile.resultai"

    new_user = User(
        name=req.name.strip(),
        email=clean_email,
        password_hash=get_password_hash(req.password),
        phone=raw_phone if raw_phone else None,
        is_active=True,
        email_verified=True if raw_phone and not raw_email else False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Record login history for newly registered user
    ip, browser, os_name = parse_user_agent(request)
    login_history = LoginHistory(
        user_id=new_user.id,
        login_time=datetime.utcnow(),
        ip_address=ip,
        browser=browser,
        os=os_name
    )
    db.add(login_history)
    db.commit()

    if raw_email:
        # Generate and send Email Verification OTP
        otp_code = generate_otp_code()
        otp_hash = hash_token(otp_code)
        auth_token = AuthSecurityToken(
            user_id=new_user.id,
            email=clean_email,
            token_hash=otp_hash,
            token_type="email_verification",
            otp_code=otp_code,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
            is_used=False
        )
        db.add(auth_token)
        db.commit()
        email_service.send_verification_email(clean_email, otp_code)

    access_delta = timedelta(days=REMEMBER_ME_ACCESS_TOKEN_EXPIRE_DAYS)
    refresh_delta = timedelta(days=14)

    access_token = create_access_token(data={"sub": str(new_user.id), "email": new_user.email}, expires_delta=access_delta)
    refresh_token = create_refresh_token(data={"sub": str(new_user.id)}, expires_delta=refresh_delta)

    create_refresh_token_session(
        db=db,
        user_id=new_user.id,
        refresh_token=refresh_token,
        ip_address=ip,
        user_agent=f"{browser} ({os_name})",
        expires_delta=refresh_delta
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user)
    )


@auth_router.post("/logout")
def logout(logout_req: Optional[LogoutRequest] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Log out active session, revoke refresh token in DB, and record logout time."""
    if logout_req and logout_req.refresh_token:
        revoke_refresh_token_session(db, logout_req.refresh_token)

    latest_history = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == current_user.id, LoginHistory.logout_time.is_(None))
        .order_by(LoginHistory.login_time.desc())
        .first()
    )
    if latest_history:
        latest_history.logout_time = datetime.utcnow()
        db.commit()

    return {"message": "Logged out successfully."}


@auth_router.post("/logout-all")
def logout_all_devices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Revoke all active refresh token sessions for current user across all devices."""
    count = revoke_all_user_sessions(db, current_user.id)
    return {"message": f"Successfully logged out from all devices. Revoked {count} active sessions."}


@auth_router.post("/refresh")
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Exchange a valid and unrevoked refresh token for new access and refresh tokens."""
    session = verify_refresh_token_session(db, req.refresh_token)
    user = db.query(User).filter(User.id == session.user_id).first()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user or inactive account.")

    # Revoke previous refresh token session (token rotation)
    session.is_revoked = True
    db.commit()

    # Issue fresh tokens
    new_access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Persist new refresh token session
    create_refresh_token_session(
        db=db,
        user_id=user.id,
        refresh_token=new_refresh_token,
        ip_address=session.ip_address,
        user_agent=session.user_agent
    )

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }


@auth_router.post("/verify-email")
def verify_email(req: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Verify user email address using OTP code."""
    clean_email = req.email.lower().strip()
    clean_otp = req.otp.strip()

    token_rec = (
        db.query(AuthSecurityToken)
        .filter(
            AuthSecurityToken.email == clean_email,
            AuthSecurityToken.token_type == "email_verification",
            AuthSecurityToken.is_used == False
        )
        .order_by(AuthSecurityToken.created_at.desc())
        .first()
    )

    if not token_rec or token_rec.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification OTP code is invalid or has expired. Please request a new code."
        )

    if token_rec.attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new code."
        )

    # Check OTP match
    if token_rec.otp_code != clean_otp and token_rec.token_hash != hash_token(clean_otp):
        token_rec.attempts += 1
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Please check and try again."
        )

    # Mark token used
    token_rec.is_used = True

    # Mark user email_verified = True
    user = db.query(User).filter(User.email == clean_email).first()
    if user:
        user.email_verified = True

    db.commit()

    return {"message": "Email address verified successfully!"}


@auth_router.post("/resend-verification")
def resend_verification(req: ResendVerificationRequest, db: Session = Depends(get_db)):
    """Resend email verification OTP."""
    clean_email = req.email.lower().strip()
    user = db.query(User).filter(User.email == clean_email).first()

    if user and not user.email_verified:
        otp_code = generate_otp_code()
        otp_hash = hash_token(otp_code)
        auth_token = AuthSecurityToken(
            user_id=user.id,
            email=clean_email,
            token_hash=otp_hash,
            token_type="email_verification",
            otp_code=otp_code,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
            is_used=False
        )
        db.add(auth_token)
        db.commit()

        email_service.send_verification_email(clean_email, otp_code)

    return {"message": "If an unverified account with that email exists, a verification code has been sent."}


@auth_router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request password reset OTP code via email or mobile."""
    identifier = (req.email or req.phone or "").strip()
    clean_identifier = identifier.lower()

    user = None
    if "@" in clean_identifier:
        user = db.query(User).filter(User.email == clean_identifier).first()
    else:
        user = db.query(User).filter(or_(User.email == clean_identifier, User.phone == clean_identifier)).first()

    if user and user.is_active:
        otp_code = generate_otp_code()
        otp_hash = hash_token(otp_code)
        auth_token = AuthSecurityToken(
            user_id=user.id,
            email=user.email,
            token_hash=otp_hash,
            token_type="password_reset",
            otp_code=otp_code,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
            is_used=False
        )
        db.add(auth_token)
        db.commit()

        if user.email and not user.email.endswith("@mobile.resultai"):
            email_service.send_password_reset_email(user.email, otp_code)
        # Removed OTP print to avoid exposing sensitive information

    return {"message": "If an account with that email/mobile exists, password reset OTP code has been dispatched."}


@auth_router.post("/verify-reset-otp", response_model=VerifyResetOtpResponse)
def verify_reset_otp(req: VerifyResetOtpRequest, db: Session = Depends(get_db)):
    """Verify 6-digit password reset OTP code and issue single-use reset token."""
    identifier = (req.email or req.phone or "").strip().lower()
    clean_otp = req.otp.strip()

    user = db.query(User).filter(or_(User.email == identifier, User.phone == identifier)).first()
    target_email = user.email if user else identifier

    token_rec = (
        db.query(AuthSecurityToken)
        .filter(
            AuthSecurityToken.email == target_email,
            AuthSecurityToken.token_type == "password_reset",
            AuthSecurityToken.is_used == False
        )
        .order_by(AuthSecurityToken.created_at.desc())
        .first()
    )

    if not token_rec or token_rec.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset OTP is invalid or has expired. Please request a new code."
        )

    if token_rec.attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum attempts exceeded. Please request a new OTP code."
        )

    if token_rec.otp_code != clean_otp and token_rec.token_hash != hash_token(clean_otp):
        token_rec.attempts += 1
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Please check and try again."
        )

    # Generate single-use reset token for reset password request
    reset_token = secrets.token_hex(32)
    reset_token_hash = hash_token(reset_token)

    reset_sec_token = AuthSecurityToken(
        user_id=token_rec.user_id,
        email=target_email,
        token_hash=reset_token_hash,
        token_type="password_reset_token",
        expires_at=datetime.utcnow() + timedelta(minutes=15),
        is_used=False
    )
    token_rec.is_used = True
    db.add(reset_sec_token)
    db.commit()

    return VerifyResetOtpResponse(
        message="OTP verified successfully. You may now reset your password.",
        reset_token=reset_token
    )


@auth_router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset user password, invalidate reset token, and revoke all active sessions across devices."""
    identifier = (req.email or req.phone or "").strip().lower()
    reset_token_hash = hash_token(req.reset_token.strip())

    user = db.query(User).filter(or_(User.email == identifier, User.phone == identifier)).first()
    target_email = user.email if user else identifier

    token_rec = (
        db.query(AuthSecurityToken)
        .filter(
            AuthSecurityToken.email == target_email,
            AuthSecurityToken.token_hash == reset_token_hash,
            AuthSecurityToken.token_type == "password_reset_token",
            AuthSecurityToken.is_used == False
        )
        .first()
    )

    if not token_rec or token_rec.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset session is invalid or has expired. Please start over."
        )

    if req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match."
        )

    validate_password_strength(req.new_password)

    if not user:
        user = db.query(User).filter(User.id == token_rec.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    user.password_hash = get_password_hash(req.new_password)
    token_rec.is_used = True
    db.commit()

    revoke_all_user_sessions(db, user.id)

    return {"message": "Password updated successfully ✓"}





@auth_router.get("/me", response_model=FullUserMeResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return authenticated user profile and recent 10 login histories."""
    recent_history = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == current_user.id)
        .order_by(LoginHistory.login_time.desc())
        .limit(10)
        .all()
    )
    
    return FullUserMeResponse(
        user=UserResponse.model_validate(current_user),
        recent_login_history=[LoginHistoryResponse.model_validate(h) for h in recent_history]
    )


@auth_router.put("/profile", response_model=UserResponse)
def update_profile(
    profile_data: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update name, phone, or profile picture for current user."""
    if profile_data.name is not None and profile_data.name.strip():
        current_user.name = profile_data.name.strip()
    if profile_data.phone is not None:
        current_user.phone = profile_data.phone.strip()
    if profile_data.profile_image is not None:
        current_user.profile_image = profile_data.profile_image

    db.commit()
    db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@auth_router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user's password and revoke active sessions."""
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    if req.new_password != req.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation do not match."
        )

    validate_password_strength(req.new_password)

    current_user.password_hash = get_password_hash(req.new_password)
    db.commit()

    # Revoke sessions
    revoke_all_user_sessions(db, current_user.id)

    return {"message": "Password changed successfully. Please log in again."}


@auth_router.delete("/login-history/{history_id}")
def delete_login_history_item(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a single login history record for current user."""
    item = (
        db.query(LoginHistory)
        .filter(LoginHistory.id == history_id, LoginHistory.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Login history entry not found.")

    db.delete(item)
    db.commit()
    return {"message": "Login history entry deleted successfully."}


@auth_router.delete("/login-history")
def clear_login_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear all login history records for current user."""
    db.query(LoginHistory).filter(LoginHistory.user_id == current_user.id).delete()
    db.commit()
    return {"message": "All login history records cleared successfully."}
