import sys
import os
# Set test JWT secrets if not provided
os.environ.setdefault('JWT_SECRET_KEY', 'test_secret_key')
os.environ.setdefault('JWT_REFRESH_SECRET_KEY', 'test_refresh_secret_key')

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROJECT_ROOT)
sys.path.insert(0, PROJECT_ROOT)

from fastapi import Request, HTTPException
from backend.db.database import Base, engine, SessionLocal
from backend.db.models import User, RefreshTokenSession, AuthSecurityToken
from backend.db.auth import get_password_hash, hash_token
from backend.db.schemas import (
    LoginRequest, RegisterRequest, RefreshTokenRequest, LogoutRequest,
    VerifyEmailRequest, ResendVerificationRequest, ForgotPasswordRequest,
    VerifyResetOtpRequest, ResetPasswordRequest
)
from backend.auth_router import (
    login, register_user, logout, logout_all_devices, refresh_token,
    verify_email, resend_verification, forgot_password, verify_reset_otp, reset_password
)
from backend.utils.rate_limiter import login_rate_limiter

class MockClient:
    def __init__(self, host: str = "192.168.1.100"):
        self.host = host

class MockRequest:
    def __init__(self, ip: str = "192.168.1.100", user_agent: str = "TestBrowser/1.0 (TestOS 10)"):
        self.client = MockClient(ip)
        self.headers = {"User-Agent": user_agent, "X-Forwarded-For": ip}

def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    db.query(AuthSecurityToken).delete()
    db.query(RefreshTokenSession).delete()
    db.query(User).filter(User.email.like("%@testsecurity.com")).delete()
    db.commit()
    db.close()

def run_all_security_tests():
    print("=" * 65)
    print("RUNNING RESULTAI PRIORITY 1 AUTH SECURITY SUITE")
    print("=" * 65)

    setup_db()

    # 1. Rate Limiting Test
    print("\n[TEST 1/6] Testing Login Rate Limiting (Brute-Force Protection)...")
    test_ip = "192.168.1.200"
    mock_req = MockRequest(ip=test_ip)
    login_rate_limiter._failed_attempts[test_ip] = []

    for i in range(5):
        try:
            db = SessionLocal()
            login(LoginRequest(email="bad@testsecurity.com", password="wrong"), mock_req, db)
            db.close()
        except HTTPException as e:
            db.close()
            assert e.status_code == 401

    # 6th attempt must trigger HTTP 429
    rate_exceeded = False
    try:
        db = SessionLocal()
        login(LoginRequest(email="bad@testsecurity.com", password="wrong"), mock_req, db)
        db.close()
    except HTTPException as e:
        db.close()
        if e.status_code == 429:
            rate_exceeded = True

    assert rate_exceeded, "Rate limiter failed to trigger HTTP 429 on 6th failed attempt."
    print("  [OK] Rate limiting passed: 5 failed attempts triggered HTTP 429 Too Many Requests.")

    # 2. Valid Login & Refresh Token Session Test
    print("\n[TEST 2/6] Testing Valid Login & Server-side Session Persistence...")
    db = SessionLocal()
    user = User(
        name="Security Test User",
        email="validuser@testsecurity.com",
        password_hash=get_password_hash("Password123!"),
        is_active=True,
        email_verified=True
    )
    db.add(user)
    db.commit()
    db.close()

    db = SessionLocal()
    login_res = login(LoginRequest(email="validuser@testsecurity.com", password="Password123!"), MockRequest(), db)
    db.close()

    assert login_res.access_token is not None
    assert login_res.refresh_token is not None
    assert login_res.user.email == "validuser@testsecurity.com"
    assert login_res.user.email_verified is True

    # Verify token session stored in DB (hashed)
    db = SessionLocal()
    ref_hash = hash_token(login_res.refresh_token)
    session = db.query(RefreshTokenSession).filter(RefreshTokenSession.token_hash == ref_hash).first()
    assert session is not None
    assert session.is_revoked is False
    db.close()
    print("  [OK] Valid login passed: Issued tokens and persisted hashed session in database.")

    # 3. Single Logout & Refresh Token Revocation Test
    print("\n[TEST 3/6] Testing Server-Side Refresh Token Revocation on Logout...")
    db = SessionLocal()
    current_u = db.query(User).filter(User.email == "validuser@testsecurity.com").first()
    logout(LogoutRequest(refresh_token=login_res.refresh_token), current_u, db)
    db.close()

    # Verify refresh attempt fails
    refresh_blocked = False
    try:
        db = SessionLocal()
        refresh_token(RefreshTokenRequest(refresh_token=login_res.refresh_token), db)
        db.close()
    except HTTPException as e:
        db.close()
        if e.status_code == 401:
            refresh_blocked = True

    assert refresh_blocked, "Revoked refresh token was improperly accepted."
    print("  [OK] Refresh token revocation passed: Revoked session rejected on /refresh.")

    # 4. Logout From All Devices Test
    print("\n[TEST 4/6] Testing Logout From All Devices (/api/auth/logout-all)...")
    db = SessionLocal()
    s1 = login(LoginRequest(email="validuser@testsecurity.com", password="Password123!"), MockRequest(), db)
    s2 = login(LoginRequest(email="validuser@testsecurity.com", password="Password123!"), MockRequest(), db)
    db.close()

    db = SessionLocal()
    current_u = db.query(User).filter(User.email == "validuser@testsecurity.com").first()
    l_all_res = logout_all_devices(current_u, db)
    db.close()

    assert "Successfully logged out" in l_all_res["message"]

    # Both tokens must fail refresh
    for tok in [s1.refresh_token, s2.refresh_token]:
        blocked = False
        try:
            db = SessionLocal()
            refresh_token(RefreshTokenRequest(refresh_token=tok), db)
            db.close()
        except HTTPException as e:
            db.close()
            if e.status_code == 401:
                blocked = True
        assert blocked, "Active token was not revoked by logout-all."
    print("  [OK] Logout-all devices passed: Revoked all active sessions across devices.")

    # 5. Email Verification OTP Flow Test
    print("\n[TEST 5/6] Testing Email Verification Registration & OTP Flow...")
    db = SessionLocal()
    reg_res = register_user(RegisterRequest(name="Verify Me User", email="verifyme@testsecurity.com", password="Password123!"), MockRequest(), db)
    db.close()
    assert reg_res.user.email_verified is False

    db = SessionLocal()
    token_rec = db.query(AuthSecurityToken).filter(
        AuthSecurityToken.email == "verifyme@testsecurity.com",
        AuthSecurityToken.token_type == "email_verification"
    ).first()
    assert token_rec is not None
    otp_code = token_rec.otp_code
    db.close()

    db = SessionLocal()
    v_res = verify_email(VerifyEmailRequest(email="verifyme@testsecurity.com", otp=otp_code), db)
    db.close()
    assert "verified successfully" in v_res["message"].lower()

    db = SessionLocal()
    u = db.query(User).filter(User.email == "verifyme@testsecurity.com").first()
    assert u.email_verified is True
    db.close()
    print("  [OK] Email verification passed: Account verified with single-use OTP.")

    # 6. Forgot Password OTP & Password Reset Flow Test
    print("\n[TEST 6/6] Testing Forgot Password OTP, Password Reset & Session Invalidation...")
    db = SessionLocal()
    user = User(
        name="Forgot Pwd User",
        email="forgotpwd@testsecurity.com",
        password_hash=get_password_hash("OldPassword123!"),
        is_active=True,
        email_verified=True
    )
    db.add(user)
    db.commit()
    db.close()

    # Create active session
    db = SessionLocal()
    s_old = login(LoginRequest(email="forgotpwd@testsecurity.com", password="OldPassword123!"), MockRequest(), db)
    db.close()

    # Request forgot password OTP
    db = SessionLocal()
    forgot_password(ForgotPasswordRequest(email="forgotpwd@testsecurity.com"), db)
    db.close()

    db = SessionLocal()
    token_rec = db.query(AuthSecurityToken).filter(
        AuthSecurityToken.email == "forgotpwd@testsecurity.com",
        AuthSecurityToken.token_type == "password_reset",
        AuthSecurityToken.is_used == False
    ).order_by(AuthSecurityToken.created_at.desc()).first()
    assert token_rec is not None
    reset_otp = token_rec.otp_code
    db.close()

    # Verify reset OTP
    db = SessionLocal()
    vo_res = verify_reset_otp(VerifyResetOtpRequest(email="forgotpwd@testsecurity.com", otp=reset_otp), db)
    db.close()
    reset_token_str = vo_res.reset_token

    # Reset Password
    db = SessionLocal()
    reset_password(ResetPasswordRequest(
        email="forgotpwd@testsecurity.com",
        reset_token=reset_token_str,
        new_password="NewPassword999!",
        confirm_password="NewPassword999!"
    ), db)
    db.close()

    # Old refresh token must be revoked
    old_blocked = False
    try:
        db = SessionLocal()
        refresh_token(RefreshTokenRequest(refresh_token=s_old.refresh_token), db)
        db.close()
    except HTTPException as e:
        db.close()
        if e.status_code == 401:
            old_blocked = True
    assert old_blocked, "Old session token was not revoked upon password reset."

    # Login with new password must succeed
    db = SessionLocal()
    new_login = login(LoginRequest(email="forgotpwd@testsecurity.com", password="NewPassword999!"), MockRequest(), db)
    db.close()
    assert new_login.access_token is not None
    print("  [OK] Forgot password & reset passed: Password updated and old sessions invalidated.")

    print("\n" + "=" * 65)
    print("ALL 6 PRIORITY 1 SECURITY TEST SUITES PASSED SUCCESSFULLY!")
    print("=" * 65)


if __name__ == "__main__":
    run_all_security_tests()
