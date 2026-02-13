"""
Security service - validation, sanitization, hardening
"""
from typing import Optional, Dict, Any
import re
import hashlib
import secrets
from datetime import datetime, timedelta
from config.db import fetch_one, execute


# Input validation patterns
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
PHONE_PATTERN = re.compile(r'^\+?1?\d{10,15}$')
SQL_INJECTION_PATTERN = re.compile(r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)", re.IGNORECASE)
XSS_PATTERN = re.compile(r'(<script|javascript:|onerror=|onload=)', re.IGNORECASE)

# File upload constraints
ALLOWED_FILE_TYPES = {
    'image': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    'document': ['.pdf', '.doc', '.docx', '.txt'],
    'spreadsheet': ['.xls', '.xlsx', '.csv'],
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def sanitize_input(value: str) -> str:
    """Sanitize user input to prevent XSS"""
    if not value:
        return value
    
    # Remove HTML tags
    value = re.sub(r'<[^>]*>', '', value)
    
    # Remove JavaScript
    value = re.sub(r'javascript:', '', value, flags=re.IGNORECASE)
    
    # Remove event handlers
    value = re.sub(r'on\w+\s*=', '', value, flags=re.IGNORECASE)
    
    return value.strip()


def validate_email(email: str) -> bool:
    """Validate email format"""
    if not email:
        return False
    return EMAIL_PATTERN.match(email) is not None


def validate_phone(phone: str) -> bool:
    """Validate phone number format"""
    if not phone:
        return False
    return PHONE_PATTERN.match(phone) is not None


def detect_sql_injection(value: str) -> bool:
    """Detect potential SQL injection attempts"""
    if not value:
        return False
    return SQL_INJECTION_PATTERN.search(value) is not None


def detect_xss(value: str) -> bool:
    """Detect potential XSS attempts"""
    if not value:
        return False
    return XSS_PATTERN.search(value) is not None


def validate_file_upload(filename: str, file_size: int, file_type: str) -> tuple[bool, Optional[str]]:
    """Validate file upload"""
    # Check file size
    if file_size > MAX_FILE_SIZE:
        return False, f"File size exceeds maximum of {MAX_FILE_SIZE / 1024 / 1024}MB"
    
    # Check file extension
    file_ext = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    
    allowed_extensions = []
    for extensions in ALLOWED_FILE_TYPES.values():
        allowed_extensions.extend(extensions)
    
    if file_ext not in allowed_extensions:
        return False, f"File type {file_ext} not allowed"
    
    # Check for double extensions (e.g., file.php.jpg)
    if filename.count('.') > 1:
        return False, "Multiple file extensions not allowed"
    
    return True, None


def hash_password(password: str) -> str:
    """Hash password securely"""
    # In production, use bcrypt or argon2
    # import bcrypt
    # return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    
    # Mock implementation
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    # In production, use bcrypt.checkpw()
    return hash_password(password) == hashed


def generate_secure_token(length: int = 32) -> str:
    """Generate a secure random token"""
    return secrets.token_urlsafe(length)


def generate_csrf_token() -> str:
    """Generate CSRF token"""
    return secrets.token_hex(32)


async def log_security_event(
    event_type: str,
    severity: str,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    endpoint: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    user_agent: Optional[str] = None,
):
    """Log security event"""
    import json
    
    query = """
        INSERT INTO security_events (
            event_type, severity, user_id, ip_address, endpoint, details, user_agent
        )
        VALUES (:event_type, :severity, :user_id, :ip_address, :endpoint, CAST(:details AS jsonb), :user_agent)
    """
    
    await execute(query, {
        "event_type": event_type,
        "severity": severity,
        "user_id": user_id,
        "ip_address": ip_address,
        "endpoint": endpoint,
        "details": json.dumps(details) if details else None,
        "user_agent": user_agent[:1000] if user_agent else None,
    })


async def check_rate_limit(identifier: str, endpoint: str, limit: int = 100, window_seconds: int = 60) -> tuple[bool, Optional[int]]:
    """Check if request is within rate limit"""
    now = datetime.now()
    window_start = now - timedelta(seconds=window_seconds)
    
    # Check existing rate limit
    query = """
        SELECT id, request_count, blocked_until
        FROM rate_limits
        WHERE identifier = :identifier 
        AND endpoint = :endpoint
        AND window_start > :window_start
    """
    
    row = await fetch_one(query, {
        "identifier": identifier,
        "endpoint": endpoint,
        "window_start": window_start,
    })
    
    if row:
        # Check if blocked
        if row[2] and row[2] > now:  # blocked_until
            remaining = int((row[2] - now).total_seconds())
            return False, remaining
        
        # Check if over limit
        if row[1] >= limit:  # request_count
            # Block for 1 minute
            blocked_until = now + timedelta(seconds=60)
            await execute(
                "UPDATE rate_limits SET blocked_until = :blocked_until WHERE id = :id",
                {"blocked_until": blocked_until, "id": row[0]}
            )
            return False, 60
        
        # Increment counter
        await execute(
            "UPDATE rate_limits SET request_count = request_count + 1 WHERE id = :id",
            {"id": row[0]}
        )
        return True, None
    else:
        # Create new rate limit entry
        await execute("""
            INSERT INTO rate_limits (identifier, endpoint, request_count, window_start)
            VALUES (:identifier, :endpoint, 1, NOW())
        """, {"identifier": identifier, "endpoint": endpoint})
        return True, None


async def validate_session(session_token: str) -> Optional[Dict[str, Any]]:
    """Validate session token"""
    query = """
        SELECT id, homeowner_id, expires_at
        FROM portal_sessions
        WHERE session_token = :session_token
        AND expires_at > NOW()
        AND is_active = true
    """
    
    row = await fetch_one(query, {"session_token": session_token})
    
    if row:
        return {
            "session_id": row[0],
            "homeowner_id": row[1],
            "expires_at": row[2],
        }
    
    return None


async def invalidate_session(session_token: str):
    """Invalidate a session"""
    await execute(
        "UPDATE portal_sessions SET is_active = false WHERE session_token = :session_token",
        {"session_token": session_token}
    )


def escape_html(text: str) -> str:
    """Escape HTML to prevent XSS"""
    if not text:
        return text
    
    html_escape_table = {
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#x27;",
        ">": "&gt;",
        "<": "&lt;",
    }
    
    return "".join(html_escape_table.get(c, c) for c in text)
