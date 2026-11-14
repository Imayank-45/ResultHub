import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger("result_ai.email_service")

class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "").strip()
        self.smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
        self.smtp_from = os.getenv("SMTP_FROM", "ResultAI <noreply@resultai.com>")
        self.smtp_tls = os.getenv("SMTP_TLS", "true").lower() in ("true", "1", "yes")

    def _is_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    def _log_dev_otp(self, otp_type: str, to_email: str, otp_code: str) -> None:
        """Log OTP generation in development mode without exposing the actual code.
        Uses logger.debug to indicate an OTP was generated for the recipient.
        """
        logger.debug(f"[DEV OTP] {otp_type} generated for {to_email} (code hidden)" )

    def _send_raw_email(self, to_email: str, subject: str, body_html: str, body_text: str, otp_type: str = "OTP", otp_code: str = ""):
        if not self._is_configured():
            # Development fallback: log that email would have been sent without exposing OTPs.
            if otp_code:
                self._log_dev_otp(otp_type, to_email, otp_code)
            logger.info(f"[EmailService DEV] SMTP not configured. Skipping actual send to {to_email}. Subject: {subject}")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.smtp_from
            msg["To"] = to_email

            part_text = MIMEText(body_text, "plain")
            part_html = MIMEText(body_html, "html")

            msg.attach(part_text)
            msg.attach(part_html)

            server = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10)
            if self.smtp_tls:
                server.starttls()
            server.login(self.smtp_user, self.smtp_password)
            server.sendmail(self.smtp_from, [to_email], msg.as_string())
            server.quit()
            logger.info(f"[EmailService] Email successfully sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"[EmailService ERROR] Failed to send email to {to_email}: {e}")
            if otp_code:
                self._log_dev_otp(otp_type, to_email, otp_code)
            else:
                logger.debug(f"[EmailService DEV FALLBACK] TO: {to_email} | SUBJECT: {subject}")
                logger.debug(f"[EmailService DEV FALLBACK] BODY TEXT:\n{body_text}")
            return False

    def send_verification_email(self, to_email: str, otp_code: str) -> bool:
        subject = "Verify Your ResultAI Account - OTP Code"
        body_text = f"Welcome to ResultAI!\n\nYour 6-digit email verification OTP code is: {otp_code}\nThis code is valid for 15 minutes.\n\nIf you did not request this, please ignore this email."
        body_html = f"""
        <html>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px;">
                <div style="max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 30px; border: 1px solid #334155; text-align: center;">
                    <h2 style="color: #38bdf8; margin-top: 0;">ResultAI Account Verification</h2>
                    <p style="color: #94a3b8;">Use the verification code below to verify your email address:</p>
                    <div style="background: #0f172a; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; border: 1px dashed #0284c7;">
                        {otp_code}
                    </div>
                    <p style="color: #64748b; font-size: 14px;">This OTP is valid for 15 minutes. Do not share this code with anyone.</p>
                </div>
            </body>
        </html>
        """
        return self._send_raw_email(to_email, subject, body_html, body_text, otp_type="Email Verification", otp_code=otp_code)

    def send_password_reset_email(self, to_email: str, otp_code: str) -> bool:
        subject = "Reset Your ResultAI Password - OTP Code"
        body_text = f"ResultAI Password Reset Request\n\nYour 6-digit password reset OTP code is: {otp_code}\nThis code is valid for 15 minutes.\n\nIf you did not request a password reset, please secure your account immediately."
        body_html = f"""
        <html>
            <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px;">
                <div style="max-width: 500px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 30px; border: 1px solid #334155; text-align: center;">
                    <h2 style="color: #f43f5e; margin-top: 0;">Password Reset Request</h2>
                    <p style="color: #94a3b8;">You requested to reset your password. Use the OTP code below:</p>
                    <div style="background: #0f172a; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #f43f5e; border: 1px dashed #e11d48;">
                        {otp_code}
                    </div>
                    <p style="color: #64748b; font-size: 14px;">This OTP is valid for 15 minutes. If you did not request this reset, you can safely ignore this email.</p>
                </div>
            </body>
        </html>
        """
        return self._send_raw_email(to_email, subject, body_html, body_text, otp_type="Password Reset", otp_code=otp_code)


# Singleton instance
email_service = EmailService()
