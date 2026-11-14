from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class LoginRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    remember_me: bool = False

class RegisterRequest(BaseModel):
    name: str
    email: Optional[str] = None
    password: str
    phone: Optional[str] = None

class SendMobileOtpRequest(BaseModel):
    phone: str

class VerifyMobileOtpRequest(BaseModel):
    phone: str
    otp: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    profile_image: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    is_active: bool
    email_verified: bool = True

    class Config:
        from_attributes = True

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None

class VerifyEmailRequest(BaseModel):
    email: str
    otp: str

class ResendVerificationRequest(BaseModel):
    email: str

class VerifyResetOtpRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    otp: str

class VerifyResetOtpResponse(BaseModel):
    message: str
    reset_token: str

class ResetPasswordRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    reset_token: str
    new_password: str
    confirm_password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    profile_image: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class ForgotPasswordRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None

class LoginHistoryResponse(BaseModel):
    id: int
    login_time: datetime
    logout_time: Optional[datetime] = None
    ip_address: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None

    class Config:
        from_attributes = True

class FullUserMeResponse(BaseModel):
    user: UserResponse
    recent_login_history: List[LoginHistoryResponse] = []

