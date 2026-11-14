import time
import threading
from typing import Dict, List
from fastapi import Request, HTTPException, status

class LoginRateLimiter:
    def __init__(self, max_failed_attempts: int = 5, window_seconds: int = 60):
        self.max_failed_attempts = max_failed_attempts
        self.window_seconds = window_seconds
        self._failed_attempts: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def get_client_ip(self, request: Request) -> str:
        """Safely extract client IP address, supporting reverse proxies."""
        ip = "127.0.0.1"
        if request.client and request.client.host:
            ip = request.client.host
        
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
            
        return ip

    def check_rate_limit(self, request: Request):
        """Check if client IP has exceeded the allowed failed attempts limit."""
        ip = self.get_client_ip(request)
        now = time.time()

        with self._lock:
            if ip in self._failed_attempts:
                # Filter out attempts outside the sliding time window
                timestamps = [t for t in self._failed_attempts[ip] if now - t < self.window_seconds]
                self._failed_attempts[ip] = timestamps

                if len(timestamps) >= self.max_failed_attempts:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Too many failed login attempts. Please try again after 1 minute.",
                        headers={"Retry-After": str(self.window_seconds)}
                    )

    def record_failed_attempt(self, request: Request):
        """Record a failed login attempt for the client IP."""
        ip = self.get_client_ip(request)
        now = time.time()

        with self._lock:
            if ip not in self._failed_attempts:
                self._failed_attempts[ip] = []
            
            # Prune old timestamps
            self._failed_attempts[ip] = [t for t in self._failed_attempts[ip] if now - t < self.window_seconds]
            self._failed_attempts[ip].append(now)

    def reset_failed_attempts(self, request: Request):
        """Reset failed login attempt counters for the client IP upon successful login."""
        ip = self.get_client_ip(request)
        with self._lock:
            if ip in self._failed_attempts:
                del self._failed_attempts[ip]


# Singleton instance
login_rate_limiter = LoginRateLimiter(max_failed_attempts=5, window_seconds=60)
