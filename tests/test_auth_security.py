import os
import sys
import time
import pytest
from fastapi.testclient import TestClient

# Ensure root directory is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.server import app
from backend.db.database import Base, engine, SessionLocal
from backend.db.models import User, RefreshTokenSession, AuthSecurityToken
from backend.db.auth import get_password_hash, hash_token
from backend.utils.rate_limiter import login_rate_limiter

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Clean test users
    db.query(AuthSecurityToken).delete()
    db.query(RefreshTokenSession).delete()
    db.query(User).filter(User.email.like("%@testsecurity.com")).delete()
    db.commit()
    db.close()
    yield

def test_01_rate_limiting_login_brute_force():
    """Verify that 5 failed attempts trigger HTTP 429 Too Many Requests."""
    test_ip = "192.168.1.100"
    headers = {"X-Forwarded-For": test_ip}

    # Reset rate limiter state for test IP
    login_rate_limiter._failed_attempts[test_ip] = []

    # Send 5 failed login attempts
    for i in range(5):
        resp = client.post("/api/auth/login", json={"email": "nonexistent@testsecurity.com", "password": "wrongpassword123"}, headers=headers)
        assert resp.status_code == 401

    # 6th attempt must return HTTP 429
    resp = client.post("/api/auth/login", json={"email": "nonexistent@testsecurity.com", "password": "wrongpassword123"}, headers=headers)
    assert resp.status_code == 429
    assert "Too many failed login attempts" in resp.json()["detail"]

    # Clean up rate limiter
    login_rate_limiter._failed_attempts[test_ip] = []


def test_02_valid_login_and_refresh_token_session():
    """Verify valid login registers session in DB and returns valid access token."""
    db = SessionLocal()
    user = User(
        name="Security Test User",
        email="testuser@testsecurity.com",
        password_hash=get_password_hash("Password123!"),
        is_active=True,
        email_verified=True
    )
    db.add(user)
    db.commit()
    db.close()

    # Valid login
    resp = client.post("/api/auth/login", json={"email": "testuser@testsecurity.com", "password": "Password123!"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "testuser@testsecurity.com"
    assert data["user"]["email_verified"] is True

    # Verify session is persisted in DB
    db = SessionLocal()
    ref_hash = hash_token(data["refresh_token"])
    session = db.query(RefreshTokenSession).filter(RefreshTokenSession.token_hash == ref_hash).first()
    assert session is not None
    assert session.is_revoked is False
    db.close()


def test_03_logout_revokes_current_refresh_token():
    """Verify logging out revokes the refresh token in database and blocks refresh."""
    db = SessionLocal()
    user = User(
        name="Logout Test User",
        email="logoutuser@testsecurity.com",
        password_hash=get_password_hash("Password123!"),
        is_active=True,
        email_verified=True
    )
    db.add(user)
    db.commit()
    db.close()

    # Login
    login_resp = client.post("/api/auth/login", json={"email": "logoutuser@testsecurity.com", "password": "Password123!"})
    tokens = login_resp.json()
    access = tokens["access_token"]
    refresh = tokens["refresh_token"]

    # Logout
    logout_resp = client.post("/api/auth/logout", json={"refresh_token": refresh}, headers={"Authorization": f"Bearer {access}"})
    assert logout_resp.status_code == 200

    # Attempting to refresh with revoked token must fail with 401
    ref_resp = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert ref_resp.status_code == 401
    assert "revoked or expired" in ref_resp.json()["detail"].lower()


def test_04_logout_all_devices():
    """Verify logout-all revokes all active refresh sessions for the user."""
    db = SessionLocal()
    user = User(
        name="LogoutAll Test User",
        email="logoutall@testsecurity.com",
        password_hash=get_password_hash("Password123!"),
        is_active=True,
        email_verified=True
    )
    db.add(user)
    db.commit()
    db.close()

    # Create 2 separate sessions (Device 1 & Device 2)
    s1 = client.post("/api/auth/login", json={"email": "logoutall@testsecurity.com", "password": "Password123!"}).json()
    s2 = client.post("/api/auth/login", json={"email": "logoutall@testsecurity.com", "password": "Password123!"}).json()

    # Logout from all devices using s1 access token
    logout_all_resp = client.post("/api/auth/logout-all", headers={"Authorization": f"Bearer {s1['access_token']}"})
    assert logout_all_resp.status_code == 200

    # Both refresh tokens must now be rejected
    r1 = client.post("/api/auth/refresh", json={"refresh_token": s1["refresh_token"]})
    r2 = client.post("/api/auth/refresh", json={"refresh_token": s2["refresh_token"]})
    assert r1.status_code == 401
    assert r2.status_code == 401


def test_05_email_verification_flow():
    """Verify registration sends OTP code and verify-email marks email_verified=True."""
    reg_resp = client.post("/api/auth/register", json={
        "name": "Verify Me User",
        "email": "verifyme@testsecurity.com",
        "password": "Password123!"
    })
    assert reg_resp.status_code == 200
    user_data = reg_resp.json()["user"]
    assert user_data["email_verified"] is False

    # Get OTP code from DB
    db = SessionLocal()
    token_rec = db.query(AuthSecurityToken).filter(
        AuthSecurityToken.email == "verifyme@testsecurity.com",
        AuthSecurityToken.token_type == "email_verification"
    ).first()
    assert token_rec is not None
    otp_code = token_rec.otp_code
    db.close()

    # Submit verification
    v_resp = client.post("/api/auth/verify-email", json={"email": "verifyme@testsecurity.com", "otp": otp_code})
    assert v_resp.status_code == 200
    assert "verified successfully" in v_resp.json()["message"].lower()

    # Verify user object now shows email_verified=True
    db = SessionLocal()
    u = db.query(User).filter(User.email == "verifyme@testsecurity.com").first()
    assert u.email_verified is True
    db.close()


def test_06_forgot_password_and_otp_reset_flow():
    """Verify full forgot password, OTP verification, password reset, and session revocation."""
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

    # 1. Login to get an active session
    s1 = client.post("/api/auth/login", json={"email": "forgotpwd@testsecurity.com", "password": "OldPassword123!"}).json()

    # 2. Request forgot password OTP
    forgot_resp = client.post("/api/auth/forgot-password", json={"email": "forgotpwd@testsecurity.com"})
    assert forgot_resp.status_code == 200

    # 3. Retrieve OTP from DB
    db = SessionLocal()
    token_rec = db.query(AuthSecurityToken).filter(
        AuthSecurityToken.email == "forgotpwd@testsecurity.com",
        AuthSecurityToken.token_type == "password_reset",
        AuthSecurityToken.is_used == False
    ).order_by(AuthSecurityToken.created_at.desc()).first()
    assert token_rec is not None
    otp_code = token_rec.otp_code
    db.close()

    # 4. Verify OTP
    v_otp_resp = client.post("/api/auth/verify-reset-otp", json={"email": "forgotpwd@testsecurity.com", "otp": otp_code})
    assert v_otp_resp.status_code == 200
    reset_token = v_otp_resp.json()["reset_token"]

    # 5. Reset Password
    reset_resp = client.post("/api/auth/reset-password", json={
        "email": "forgotpwd@testsecurity.com",
        "reset_token": reset_token,
        "new_password": "NewPassword999!",
        "confirm_password": "NewPassword999!"
    })
    assert reset_resp.status_code == 200

    # 6. Old session refresh token must now be revoked
    r_old = client.post("/api/auth/refresh", json={"refresh_token": s1["refresh_token"]})
    assert r_old.status_code == 401

    # 7. Login with old password must fail
    old_login = client.post("/api/auth/login", json={"email": "forgotpwd@testsecurity.com", "password": "OldPassword123!"})
    assert old_login.status_code == 401

    # 8. Login with new password must succeed
    new_login = client.post("/api/auth/login", json={"email": "forgotpwd@testsecurity.com", "password": "NewPassword999!"})
    assert new_login.status_code == 200
