"""
Security utilities for HealthSync
- Password hashing with bcrypt
- Rate limiting
- Input sanitization
- TOTP two-factor authentication
- Audit logging
"""

import bcrypt
import hashlib
import hmac
import time
import base64
import struct
import re
from functools import wraps
from datetime import datetime
from collections import defaultdict


# ============ Password Hashing ============

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


# ============ Rate Limiting ============

class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests = defaultdict(list)
        self.blocked = {}
    
    def is_allowed(self, key: str, max_requests: int = 5, window_seconds: int = 60) -> bool:
        """Check if request is allowed within rate limit"""
        now = time.time()
        
        # Check if blocked
        if key in self.blocked:
            if now < self.blocked[key]:
                return False
            del self.blocked[key]
        
        # Clean old requests
        self.requests[key] = [t for t in self.requests[key] if t > now - window_seconds]
        
        # Check limit
        if len(self.requests[key]) >= max_requests:
            # Block for 5 minutes after too many attempts
            self.blocked[key] = now + 300
            return False
        
        self.requests[key].append(now)
        return True
    
    def get_remaining(self, key: str, max_requests: int = 5, window_seconds: int = 60) -> int:
        """Get remaining requests allowed"""
        now = time.time()
        self.requests[key] = [t for t in self.requests[key] if t > now - window_seconds]
        return max(0, max_requests - len(self.requests[key]))


# Global rate limiter instance
rate_limiter = RateLimiter()


def rate_limit(max_requests: int = 5, window_seconds: int = 60, key_func=None):
    """Decorator to rate limit endpoints"""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            from flask import request, jsonify
            
            # Get rate limit key (default: IP address)
            if key_func:
                key = key_func()
            else:
                key = request.remote_addr or 'unknown'
            
            if not rate_limiter.is_allowed(key, max_requests, window_seconds):
                return jsonify({
                    'error': 'Too many requests. Please try again later.',
                    'retry_after': 300
                }), 429
            
            return f(*args, **kwargs)
        return decorated
    return decorator


# ============ Input Sanitization ============

def sanitize_string(value: str, max_length: int = 255) -> str:
    """Sanitize a string input"""
    if not isinstance(value, str):
        return ''
    # Remove null bytes and trim
    value = value.replace('\x00', '').strip()
    # Limit length
    value = value[:max_length]
    return value


def sanitize_email(email: str) -> str:
    """Validate and sanitize email"""
    email = sanitize_string(email, 255).lower()
    # Basic email pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if re.match(pattern, email):
        return email
    return ''


def sanitize_phone(phone: str) -> str:
    """Sanitize phone number"""
    # Keep only digits, plus, dashes, parentheses, spaces
    return re.sub(r'[^\d\+\-\(\)\s]', '', sanitize_string(phone, 20))


def sanitize_username(username: str) -> str:
    """Sanitize username - alphanumeric and underscores only"""
    username = sanitize_string(username, 50).lower()
    return re.sub(r'[^a-z0-9_]', '', username)


# ============ TOTP Two-Factor Authentication ============

def generate_totp_secret() -> str:
    """Generate a random TOTP secret"""
    import os
    random_bytes = os.urandom(20)
    return base64.b32encode(random_bytes).decode('utf-8')


def get_totp_code(secret: str, time_step: int = 30) -> str:
    """Generate current TOTP code"""
    # Decode secret
    key = base64.b32decode(secret.upper() + '=' * (8 - len(secret) % 8))
    
    # Get current time step
    counter = int(time.time() // time_step)
    counter_bytes = struct.pack('>Q', counter)
    
    # Generate HMAC-SHA1
    hmac_hash = hmac.new(key, counter_bytes, hashlib.sha1).digest()
    
    # Dynamic truncation
    offset = hmac_hash[-1] & 0x0F
    code = struct.unpack('>I', hmac_hash[offset:offset + 4])[0] & 0x7FFFFFFF
    
    return str(code % 1000000).zfill(6)


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """Verify a TOTP code with time window tolerance"""
    if not secret or not code:
        return False
    
    code = code.replace(' ', '')
    if not code.isdigit() or len(code) != 6:
        return False
    
    # Check current and adjacent time steps
    for i in range(-window, window + 1):
        offset_time = time.time() + (i * 30)
        counter = int(offset_time // 30)
        counter_bytes = struct.pack('>Q', counter)
        
        key = base64.b32decode(secret.upper() + '=' * (8 - len(secret) % 8))
        hmac_hash = hmac.new(key, counter_bytes, hashlib.sha1).digest()
        
        offset = hmac_hash[-1] & 0x0F
        expected = struct.unpack('>I', hmac_hash[offset:offset + 4])[0] & 0x7FFFFFFF
        expected_code = str(expected % 1000000).zfill(6)
        
        if code == expected_code:
            return True
    
    return False


def get_totp_uri(secret: str, username: str, issuer: str = 'HealthSync') -> str:
    """Generate TOTP URI for QR code"""
    return f'otpauth://totp/{issuer}:{username}?secret={secret}&issuer={issuer}'


# ============ Token Generation ============

def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token"""
    import os
    return base64.urlsafe_b64encode(os.urandom(length)).decode('utf-8')[:length]


def generate_password_reset_token() -> str:
    """Generate a password reset token"""
    return generate_secure_token(48)
