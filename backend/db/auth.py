import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db.models import User

import hashlib
from backend.db.models import User, RefreshTokenSession

# Secret Keys & Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY")
# Provide default insecure keys for development if not set, but raise warning
if not SECRET_KEY:
    SECRET_KEY = "dev_secret_key"
    print("[WARNING] JWT_SECRET_KEY not set; using default development key. Set JWT_SECRET_KEY in environment for production.")
if not REFRESH_SECRET_KEY:
    REFRESH_SECRET_KEY = "dev_refresh_secret_key"
    print("[WARNING] JWT_REFRESH_SECRET_KEY not set; using default development key. Set JWT_REFRESH_SECRET_KEY in environment for production.")
ALGORITHM = "HS256"

# Token Expirations
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # Default 1 hour
REMEMBER_ME_ACCESS_TOKEN_EXPIRE_DAYS = 7  # 7 days if Remember Me is checked
REFRESH_TOKEN_EXPIRE_DAYS = 14

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def hash_token(token: str) -> str:
    """Calculate SHA-256 hash of token to prevent storing raw tokens."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if not plain_password or not hashed_password:
            return False
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def validate_password_strength(password: str):
    """Validate password strength rules."""
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long."
        )
    if not any(c.isupper() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter."
        )
    if not any(c.isdigit() or not c.isalnum() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number or special character."
        )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token_session(
    db: Session,
    user_id: int,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    expires_delta: Optional[timedelta] = None
) -> RefreshTokenSession:
    """Create and persist a hashed RefreshTokenSession record in the database."""
    token_h = hash_token(refresh_token)
    expires_at = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    
    session = RefreshTokenSession(
        user_id=user_id,
        token_hash=token_h,
        created_at=datetime.utcnow(),
        expires_at=expires_at,
        is_revoked=False,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def verify_refresh_token_session(db: Session, refresh_token: str) -> RefreshTokenSession:
    """Verify refresh token payload and check server-side revocation status in database."""
    payload = decode_token(refresh_token, REFRESH_SECRET_KEY)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for refresh."
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token payload."
        )

    token_h = hash_token(refresh_token)
    session = db.query(RefreshTokenSession).filter(
        RefreshTokenSession.token_hash == token_h,
        RefreshTokenSession.user_id == int(user_id)
    ).first()

    if not session or session.is_revoked or session.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked or expired. Please log in again."
        )

    return session

def revoke_refresh_token_session(db: Session, refresh_token: str) -> bool:
    """Revoke a single refresh token session in database."""
    if not refresh_token:
        return False
    token_h = hash_token(refresh_token)
    session = db.query(RefreshTokenSession).filter(RefreshTokenSession.token_hash == token_h).first()
    if session:
        session.is_revoked = True
        db.commit()
        return True
    return False

def revoke_all_user_sessions(db: Session, user_id: int) -> int:
    """Revoke all active refresh token sessions for a user (Logout from all devices)."""
    count = db.query(RefreshTokenSession).filter(
        RefreshTokenSession.user_id == user_id,
        RefreshTokenSession.is_revoked == False
    ).update({"is_revoked": True})
    db.commit()
    return count

def decode_token(token: str, secret: str) -> dict:
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(token, SECRET_KEY)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id: int = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )
    return user


def get_optional_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    """Returns authenticated user if token present, otherwise returns None.
    No fallback to a default user is performed for security.
    """
    if token:
        try:
            payload = decode_token(token, SECRET_KEY)
            if payload.get("type") == "access":
                user_id = payload.get("sub")
                if user_id is not None:
                    user = db.query(User).filter(User.id == int(user_id)).first()
                    if user and user.is_active:
                        return user
        except Exception:
            pass
    # No user found or token missing
    return None


