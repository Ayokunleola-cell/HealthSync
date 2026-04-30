"""
HealthSync Comprehensive API
Multi-role healthcare platform supporting Patients, Caregivers, Physicians, and Family/Guardians
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from functools import wraps
from datetime import datetime, timezone, timedelta
import jwt
import logging
import os
import uuid
import sqlite3

from config import settings
from database import db
from agents import SleepAgent, MedicationAgent, MLAgent, AssistantAgent, ReminderAgent
from utils import send_email, send_whatsapp, make_call, ErrorHandler
from utils.security import (
    hash_password, verify_password, rate_limit, rate_limiter,
    sanitize_string, sanitize_email, sanitize_username,
    generate_totp_secret, verify_totp, get_totp_uri,
    generate_password_reset_token
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = settings.SECRET_KEY
CORS(app, origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003"])
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Initialize AI agents (using patient1 as default for legacy compatibility)
sleep_agent = SleepAgent("sleep_agent_001", "pat_001")
medication_agent = MedicationAgent("med_agent_001", "pat_001")
assistant_agent = AssistantAgent("assistant_agent_001")
reminder_agent = ReminderAgent("reminder_agent_001", "pat_001")
ml_agent = MLAgent("ml_agent_001", "pat_001")


# ============ Helper Functions ============

def get_client_ip():
    """Get client IP address"""
    return request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'


def audit_log(user_id, action, resource_type=None, resource_id=None, details=None):
    """Log an audit event"""
    try:
        db.log_audit(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=get_client_ip(),
            user_agent=request.headers.get('User-Agent', '')[:500]
        )
    except Exception as e:
        logger.error(f"Failed to log audit event: {e}")


# ============ Auth Middleware ============

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        try:
            data = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user = db.get_user(data['sub'])
            if not user:
                return jsonify({'error': 'User not found'}), 401
            if user.get('locked_until'):
                if datetime.fromisoformat(user['locked_until']) > datetime.now():
                    return jsonify({'error': 'Account is locked'}), 403
            request.current_user = user
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def role_required(*roles):
    """Decorator to require specific user roles"""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if request.current_user['role'] not in roles:
                return jsonify({'error': 'Access denied for your role'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# ============ Auth Endpoints ============

@app.route('/api/token', methods=['POST'])
@rate_limit(max_requests=10, window_seconds=60)
def login():
    """Authenticate user and return JWT token (with rate limiting and audit logging)"""
    data = request.json
    username = sanitize_string(data.get('username', ''), 50)
    password = data.get('password', '')
    totp_code = data.get('totp_code', '')
    
    ip_address = get_client_ip()
    
    # Get user
    user = db.get_user(username)
    if not user:
        db.log_login_attempt(username, ip_address, False)
        audit_log(None, 'login_failed', details=f'Unknown user: {username}')
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Check if account is locked
    if user.get('locked_until'):
        locked_until = datetime.fromisoformat(user['locked_until'])
        if locked_until > datetime.now():
            return jsonify({'error': 'Account is locked. Try again later.'}), 403
    
    # Check password - supports both hashed and plain text (for migration)
    password_valid = False
    if user['password'].startswith('$2'):
        # bcrypt hash
        password_valid = verify_password(password, user['password'])
    else:
        # Plain text (legacy) - will be hashed on next login
        password_valid = (user['password'] == password)
    
    if not password_valid:
        db.log_login_attempt(username, ip_address, False)
        db.update_failed_login(user['id'], increment=True)
        
        # Lock account after 5 failed attempts
        if user.get('failed_login_attempts', 0) >= 4:
            lock_until = (datetime.now() + timedelta(minutes=15)).isoformat()
            db.lock_user(user['id'], lock_until)
            audit_log(user['id'], 'account_locked', details='Too many failed login attempts')
        
        audit_log(user['id'], 'login_failed', details='Invalid password')
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Check 2FA if enabled
    if user.get('totp_enabled') and user.get('totp_secret'):
        if not totp_code:
            return jsonify({'error': '2FA required', 'requires_2fa': True}), 401
        if not verify_totp(user['totp_secret'], totp_code):
            audit_log(user['id'], 'login_failed', details='Invalid 2FA code')
            return jsonify({'error': 'Invalid 2FA code'}), 401
    
    # Successful login
    db.log_login_attempt(username, ip_address, True)
    db.update_failed_login(user['id'], increment=False)  # Reset failed attempts
    
    token = jwt.encode(
        {'sub': username, 'exp': datetime.now(timezone.utc).timestamp() + 86400},
        settings.SECRET_KEY,
        algorithm='HS256'
    )
    
    audit_log(user['id'], 'login_success')
    logger.info(f"User {username} logged in successfully")
    
    return jsonify({
        'access_token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'full_name': user['full_name'],
            'role': user['role'],
            'email': user['email'],
            'totp_enabled': bool(user.get('totp_enabled'))
        }
    })


@app.route('/api/auth/register', methods=['POST'])
@rate_limit(max_requests=5, window_seconds=60)
def register():
    """Register a new user with hashed password"""
    data = request.json
    required = ['username', 'password', 'email', 'full_name', 'role']
    
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Sanitize inputs
    username = sanitize_username(data['username'])
    email = sanitize_email(data['email'])
    full_name = sanitize_string(data['full_name'], 100)
    
    if not username or not email:
        return jsonify({'error': 'Invalid username or email format'}), 400
    
    if data['role'] not in ['patient', 'caregiver', 'physician', 'family']:
        return jsonify({'error': 'Invalid role'}), 400
    
    if len(data['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    existing = db.get_user(username)
    if existing:
        return jsonify({'error': 'Username already exists'}), 400
    
    # Hash password
    hashed_password = hash_password(data['password'])
    
    user_id = db.create_user(
        username, hashed_password, email,
        full_name, data['role'], sanitize_string(data.get('phone', ''), 20)
    )
    
    audit_log(user_id, 'user_registered')
    return jsonify({'message': 'User registered', 'user_id': user_id}), 201


@app.route('/api/organizations/register', methods=['POST'])
@rate_limit(max_requests=3, window_seconds=60)
def register_organization():
    """Register a new healthcare organization with admin account"""
    data = request.json
    
    if 'organization' not in data or 'admin' not in data:
        return jsonify({'error': 'organization and admin data are required'}), 400
    
    org = data['organization']
    admin = data['admin']
    
    # Validate organization data
    if not org.get('organization_name'):
        return jsonify({'error': 'Organization name is required'}), 400
    if not org.get('email'):
        return jsonify({'error': 'Organization email is required'}), 400
    if not org.get('phone'):
        return jsonify({'error': 'Organization phone is required'}), 400
    
    # Validate admin data
    if not admin.get('full_name'):
        return jsonify({'error': 'Administrator name is required'}), 400
    if not admin.get('email'):
        return jsonify({'error': 'Administrator email is required'}), 400
    if not admin.get('password') or len(admin['password']) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    # Sanitize inputs
    org_name = sanitize_string(org['organization_name'], 200)
    org_email = sanitize_email(org['email'])
    admin_email = sanitize_email(admin['email'])
    admin_name = sanitize_string(admin['full_name'], 100)
    
    # Create username from admin email
    admin_username = admin_email.split('@')[0].lower().replace('.', '_')
    
    # Check if admin username or email already exists
    existing = db.get_user(admin_username)
    if existing:
        # Try adding a number suffix
        for i in range(1, 100):
            test_username = f"{admin_username}{i}"
            if not db.get_user(test_username):
                admin_username = test_username
                break
        else:
            return jsonify({'error': 'Could not create unique username. Please try a different email.'}), 400
    
    # Check if email already exists
    conn = db.get_connection()
    existing_email = conn.execute("SELECT id FROM users WHERE email = ?", (admin_email,)).fetchone()
    conn.close()
    if existing_email:
        return jsonify({'error': 'An account with this email already exists'}), 400
    
    # Generate organization ID
    org_id = f"org_{uuid.uuid4().hex[:12]}"
    
    # Create organization record
    conn = db.get_connection()
    try:
        conn.execute('''
            INSERT INTO organizations (id, name, type, email, phone, address, city, state, zip_code, website, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            org_id,
            org_name,
            org.get('organization_type', 'clinic'),
            org_email,
            sanitize_string(org.get('phone', ''), 20),
            sanitize_string(org.get('address', ''), 200),
            sanitize_string(org.get('city', ''), 100),
            sanitize_string(org.get('state', ''), 50),
            sanitize_string(org.get('zip_code', ''), 20),
            sanitize_string(org.get('website', ''), 200),
            datetime.now(timezone.utc).isoformat()
        ))
        conn.commit()
    except sqlite3.OperationalError:
        # Table might not exist, create it
        conn.execute('''
            CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'clinic',
                email TEXT,
                phone TEXT,
                address TEXT,
                city TEXT,
                state TEXT,
                zip_code TEXT,
                website TEXT,
                created_at TEXT,
                is_active INTEGER DEFAULT 1
            )
        ''')
        conn.execute('''
            INSERT INTO organizations (id, name, type, email, phone, address, city, state, zip_code, website, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            org_id,
            org_name,
            org.get('organization_type', 'clinic'),
            org_email,
            sanitize_string(org.get('phone', ''), 20),
            sanitize_string(org.get('address', ''), 200),
            sanitize_string(org.get('city', ''), 100),
            sanitize_string(org.get('state', ''), 50),
            sanitize_string(org.get('zip_code', ''), 20),
            sanitize_string(org.get('website', ''), 200),
            datetime.now(timezone.utc).isoformat()
        ))
        conn.commit()
    finally:
        conn.close()
    
    # Hash password and create admin user
    hashed_password = hash_password(admin['password'])
    
    user_id = db.create_user(
        admin_username, 
        hashed_password, 
        admin_email,
        admin_name, 
        'admin',
        sanitize_string(admin.get('phone', ''), 20)
    )
    
    # Link admin to organization
    conn = db.get_connection()
    try:
        conn.execute('''
            UPDATE users SET organization_id = ? WHERE id = ?
        ''', (org_id, user_id))
        conn.commit()
    except sqlite3.OperationalError:
        # Column might not exist, add it
        try:
            conn.execute('ALTER TABLE users ADD COLUMN organization_id TEXT')
            conn.execute('UPDATE users SET organization_id = ? WHERE id = ?', (org_id, user_id))
            conn.commit()
        except:
            pass  # Column might already exist
    finally:
        conn.close()
    
    logger.info(f"New organization registered: {org_name} (ID: {org_id})")
    audit_log(user_id, 'organization_registered', 'organization', org_id)
    
    return jsonify({
        'message': 'Organization registered successfully',
        'organization_id': org_id,
        'admin_username': admin_username,
        'admin_user_id': user_id
    }), 201


@app.route('/api/auth/forgot-password', methods=['POST'])
@rate_limit(max_requests=3, window_seconds=60)
def forgot_password():
    """Request password reset email"""
    data = request.json
    email = sanitize_email(data.get('email', ''))
    
    if not email:
        return jsonify({'error': 'Valid email is required'}), 400
    
    # Find user by email
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()
    
    # Always return success to prevent email enumeration
    if user:
        token = generate_password_reset_token()
        expires_at = (datetime.now() + timedelta(hours=1)).isoformat()
        db.create_password_reset_token(user['id'], token, expires_at)
        
        # In production, send email here
        # send_email(email, "Password Reset", f"Reset link: /reset-password?token={token}")
        logger.info(f"Password reset token generated for {user['username']}: {token}")
        audit_log(user['id'], 'password_reset_requested')
    
    return jsonify({'message': 'If an account exists, a reset email has been sent'})


@app.route('/api/auth/reset-password', methods=['POST'])
@rate_limit(max_requests=5, window_seconds=60)
def reset_password():
    """Reset password with token"""
    data = request.json
    token = data.get('token', '')
    new_password = data.get('password', '')
    
    if not token or not new_password:
        return jsonify({'error': 'Token and password are required'}), 400
    
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    
    # Verify token
    token_data = db.verify_password_reset_token(token)
    if not token_data:
        return jsonify({'error': 'Invalid or expired reset token'}), 400
    
    # Update password
    hashed_password = hash_password(new_password)
    db.update_user(token_data['user_id'], password=hashed_password)
    db.use_password_reset_token(token)
    
    audit_log(token_data['user_id'], 'password_reset_completed')
    return jsonify({'message': 'Password has been reset successfully'})


@app.route('/api/auth/2fa-status', methods=['GET'])
@token_required
def get_2fa_status():
    """Get 2FA status for current user"""
    user = request.current_user
    status = db.get_2fa_status(user['id'])
    return jsonify({
        'enabled': status.get('enabled', False) if status else False
    })


@app.route('/api/auth/setup-2fa', methods=['POST'])
@token_required
def setup_2fa():
    """Generate TOTP secret for 2FA setup"""
    user = request.current_user
    
    # Generate new secret
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, user['username'])
    
    # Don't enable yet - user needs to verify first
    return jsonify({
        'secret': secret,
        'uri': uri,
        'message': 'Scan the QR code with your authenticator app, then verify with a code'
    })


@app.route('/api/auth/verify-2fa', methods=['POST'])
@token_required
def verify_2fa():
    """Verify TOTP code and enable 2FA"""
    user = request.current_user
    data = request.json
    secret = data.get('secret', '')
    code = data.get('code', '')
    
    if not secret or not code:
        return jsonify({'error': 'Secret and code are required'}), 400
    
    if not verify_totp(secret, code):
        return jsonify({'error': 'Invalid verification code'}), 400
    
    # Enable 2FA
    db.enable_2fa(user['id'], secret)
    audit_log(user['id'], '2fa_enabled')
    
    return jsonify({'message': '2FA has been enabled successfully'})


@app.route('/api/auth/disable-2fa', methods=['POST'])
@token_required
def disable_2fa():
    """Disable 2FA"""
    user = request.current_user
    data = request.json
    password = data.get('password', '')
    
    # Verify password first
    password_valid = False
    if user['password'].startswith('$2'):
        password_valid = verify_password(password, user['password'])
    else:
        password_valid = (user['password'] == password)
    
    if not password_valid:
        return jsonify({'error': 'Invalid password'}), 401
    
    db.disable_2fa(user['id'])
    audit_log(user['id'], '2fa_disabled')
    
    return jsonify({'message': '2FA has been disabled'})


@app.route('/api/admin/audit-logs', methods=['GET'])
@token_required
@role_required('admin')
def get_audit_logs():
    """Get audit logs (admin only)"""
    user_id = request.args.get('user_id')
    action = request.args.get('action')
    limit = request.args.get('limit', 100, type=int)
    
    logs = db.get_audit_logs(user_id=user_id, action=action, limit=min(limit, 500))
    return jsonify({'audit_logs': logs})


@app.route('/api/users/me', methods=['GET'])
@token_required
def get_current_user():
    """Get current user profile"""
    user = request.current_user
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'full_name': user['full_name'],
        'role': user['role'],
        'email': user['email'],
        'phone': user['phone']
    })


# ============ Admin Endpoints ============

@app.route('/api/admin/dashboard', methods=['GET'])
@token_required
@role_required('admin')
def admin_dashboard():
    """Get admin dashboard stats"""
    stats = db.get_admin_stats()
    return jsonify(stats)


@app.route('/api/admin/users', methods=['GET'])
@token_required
@role_required('admin')
def admin_get_users():
    """Get all users"""
    users = db.get_all_users()
    return jsonify({'users': users})


@app.route('/api/admin/users', methods=['POST'])
@token_required
@role_required('admin')
def admin_create_user():
    """Create a new user - Family members must be assigned to a patient"""
    data = request.json
    required = ['username', 'password', 'email', 'full_name', 'role']
    
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    if data['role'] not in ['patient', 'caregiver', 'physician', 'family', 'admin']:
        return jsonify({'error': 'Invalid role'}), 400
    
    existing = db.get_user(data['username'])
    if existing:
        return jsonify({'error': 'Username already exists'}), 400
    
    # Family members MUST be assigned to at least one patient
    patient_ids = data.get('patient_ids', [])
    if isinstance(patient_ids, str):
        patient_ids = [patient_ids]
    
    if data['role'] == 'family' and not patient_ids:
        return jsonify({'error': 'Family members must be assigned to at least one patient'}), 400
    
    user_id = db.create_user(
        data['username'], data['password'], data['email'],
        data['full_name'], data['role'], data.get('phone')
    )
    
    # Only assign family members to patients at registration
    # Caregivers and physicians are assigned separately through Staff Assignment
    if data['role'] == 'family':
        for patient_id in patient_ids:
            db.assign_user_to_patient(patient_id, user_id, 'view', data.get('relationship', 'Family Member'))
    
    audit_log(request.current_user['id'], 'user_created', 'user', user_id)
    return jsonify({'message': 'User created', 'user_id': user_id}), 201


@app.route('/api/admin/users/<user_id>', methods=['GET'])
@token_required
@role_required('admin')
def admin_get_user(user_id):
    """Get single user details"""
    user = db.get_user_by_id(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user})


@app.route('/api/admin/users/<user_id>', methods=['PUT'])
@token_required
@role_required('admin')
def admin_update_user(user_id):
    """Update user details"""
    data = request.json
    db.update_user(user_id, **data)
    return jsonify({'message': 'User updated'})


@app.route('/api/admin/users/<user_id>', methods=['DELETE'])
@token_required
@role_required('admin')
def admin_delete_user(user_id):
    """Delete a user"""
    # Don't allow deleting self
    if user_id == request.current_user['id']:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    db.delete_user(user_id)
    return jsonify({'message': 'User deleted'})


@app.route('/api/admin/patients', methods=['GET'])
@token_required
@role_required('admin')
def admin_get_patients():
    """Get all patients for admin"""
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM patients ORDER BY created_at DESC")
    patients = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({'patients': patients})


# ============ Video Call Contacts Endpoint ============

@app.route('/api/video-call-contacts', methods=['GET'])
@token_required
def get_video_call_contacts():
    """Get available contacts for video calls based on user role"""
    user = request.current_user
    user_role = user['role']
    
    contacts = []
    conn = db.get_connection()
    
    try:
        if user_role == 'caregiver':
            # Caregivers can call: physicians, family members, and patients they care for
            # Get physicians
            cursor = conn.execute("""
                SELECT DISTINCT u.id, u.full_name, u.role, u.email, u.phone
                FROM users u WHERE u.role = 'physician' AND u.is_active = 1
            """)
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': 'physician'})
            
            # Get family members linked to same patients
            cursor = conn.execute("""
                SELECT DISTINCT u.id, u.full_name, u.role, u.email, u.phone
                FROM users u
                JOIN patient_access pa ON u.id = pa.user_id
                WHERE pa.patient_id IN (
                    SELECT patient_id FROM patient_access WHERE user_id = ?
                ) AND u.role = 'family' AND u.is_active = 1
            """, (user['id'],))
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': 'family'})
            
            # Get patients they care for
            cursor = conn.execute("""
                SELECT DISTINCT p.id, p.name as full_name, 'patient' as role
                FROM patients p
                JOIN patient_access pa ON p.id = pa.patient_id
                WHERE pa.user_id = ? AND pa.access_level IN ('full', 'medical')
            """, (user['id'],))
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': 'patient'})
        
        elif user_role == 'physician':
            # Physicians can call: patients, caregivers, and family members
            # Get patients
            cursor = conn.execute("""
                SELECT DISTINCT p.id, p.name as full_name, 'patient' as role
                FROM patients p
                JOIN patient_access pa ON p.id = pa.patient_id
                WHERE pa.user_id = ?
            """, (user['id'],))
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': 'patient'})
            
            # Get caregivers for those patients
            cursor = conn.execute("""
                SELECT DISTINCT u.id, u.full_name, u.role, u.email, u.phone
                FROM users u
                JOIN patient_access pa ON u.id = pa.user_id
                WHERE pa.patient_id IN (
                    SELECT patient_id FROM patient_access WHERE user_id = ?
                ) AND u.role = 'caregiver' AND u.is_active = 1
            """, (user['id'],))
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': 'caregiver'})
            
            # Get family members for those patients
            cursor = conn.execute("""
                SELECT DISTINCT u.id, u.full_name, u.role, u.email, u.phone
                FROM users u
                JOIN patient_access pa ON u.id = pa.user_id
                WHERE pa.patient_id IN (
                    SELECT patient_id FROM patient_access WHERE user_id = ?
                ) AND u.role = 'family' AND u.is_active = 1
            """, (user['id'],))
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': 'family'})
        
        elif user_role == 'family':
            # Family can call: caregivers and physicians linked to their patient
            # Get caregivers
            cursor = conn.execute("""
                SELECT DISTINCT u.id, u.full_name, u.role, u.email, u.phone
                FROM users u
                JOIN patient_access pa ON u.id = pa.user_id
                WHERE pa.patient_id IN (
                    SELECT patient_id FROM patient_access WHERE user_id = ?
                ) AND u.role = 'caregiver' AND u.is_active = 1
            """, (user['id'],))
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': 'caregiver'})
            
            # Get physicians
            cursor = conn.execute("""
                SELECT DISTINCT u.id, u.full_name, u.role, u.email, u.phone
                FROM users u
                JOIN patient_access pa ON u.id = pa.user_id
                WHERE pa.patient_id IN (
                    SELECT patient_id FROM patient_access WHERE user_id = ?
                ) AND u.role = 'physician' AND u.is_active = 1
            """, (user['id'],))
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': 'physician'})
        
        elif user_role == 'patient':
            # Patients can call: their caregivers and physicians
            cursor = conn.execute("""
                SELECT DISTINCT u.id, u.full_name, u.role, u.email, u.phone
                FROM users u
                JOIN patient_access pa ON u.id = pa.user_id
                JOIN patients p ON pa.patient_id = p.id
                WHERE p.user_id = ? AND u.role IN ('caregiver', 'physician') AND u.is_active = 1
            """, (user['id'],))
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': row['role']})
        
        elif user_role == 'admin':
            # Admins can call anyone
            cursor = conn.execute("""
                SELECT id, full_name, role, email, phone
                FROM users WHERE is_active = 1 AND id != ?
            """, (user['id'],))
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': row['role']})
            
            # Also include patients
            cursor = conn.execute("""
                SELECT id, name as full_name, 'patient' as role FROM patients
            """)
            for row in cursor.fetchall():
                contacts.append({**dict(row), 'contact_type': 'patient'})
    
    finally:
        conn.close()
    
    return jsonify({'contacts': contacts})


# ============ Patient Endpoints ============

@app.route('/api/patients', methods=['GET'])
@token_required
def get_patients():
    """Get patients accessible to current user"""
    user = request.current_user
    patients = db.get_patients_for_user(user['id'], user['role'])
    return jsonify({'patients': patients})


@app.route('/api/patients/<patient_id>', methods=['GET'])
@token_required
def get_patient(patient_id):
    """Get patient details"""
    patient = db.get_patient(patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404
    
    # Get latest vitals
    vitals = db.get_latest_vitals(patient_id)
    
    # Get medications
    medications = db.get_medications(patient_id)
    
    # Get upcoming appointments
    appointments = db.get_appointments(patient_id=patient_id)
    
    return jsonify({
        'patient': patient,
        'vitals': vitals,
        'medications': medications,
        'appointments': appointments[:5]  # Next 5 appointments
    })


@app.route('/api/patients/<patient_id>/status', methods=['GET'])
@token_required
def get_patient_status(patient_id):
    """Get comprehensive patient status (legacy + enhanced)"""
    patient = db.get_patient(patient_id)
    vitals = db.get_latest_vitals(patient_id)
    medications = db.get_medications(patient_id)
    
    # Format vitals for response
    vitals_data = None
    if vitals:
        vitals_data = {
            'heart_rate': vitals['heart_rate'],
            'blood_pressure': f"{vitals['blood_pressure_systolic']}/{vitals['blood_pressure_diastolic']}",
            'temperature': vitals['temperature'],
            'oxygen_saturation': vitals['oxygen_saturation'],
            'respiratory_rate': vitals['respiratory_rate'],
            'recorded_at': vitals['recorded_at']
        }
    
    # Calculate medication adherence
    adherence_rate = medication_agent.get_adherence_rate() if hasattr(medication_agent, 'get_adherence_rate') else 0.85
    
    return jsonify({
        'patient': patient,
        'sleep': sleep_agent.get_latest_data(),
        'medication': {
            'schedule': [{'name': m['name'], 'dosage': m['dosage'], 'time': m['time_of_day']} for m in medications],
            'adherence_rate': adherence_rate,
            'missed': medication_agent.get_missed_doses() if hasattr(medication_agent, 'get_missed_doses') else [],
            'adherence_forecast': 'Good'
        },
        'vitals': vitals_data,
        'assistant_response': assistant_agent.process_request("Provide a health summary")
    })


# ============ Vitals Endpoints ============

@app.route('/api/patients/<patient_id>/vitals', methods=['GET'])
@token_required
def get_vitals_history(patient_id):
    """Get patient vitals history"""
    limit = request.args.get('limit', 20, type=int)
    vitals = db.get_vitals_history(patient_id, limit)
    return jsonify({'vitals': vitals})


@app.route('/api/patients/<patient_id>/vitals', methods=['POST'])
@token_required
@role_required('caregiver', 'physician', 'admin')
def add_vitals(patient_id):
    """Add new vital signs reading"""
    data = request.json
    user = request.current_user
    
    vital_id = db.add_vitals(
        patient_id=patient_id,
        recorded_by=user['id'],
        heart_rate=data.get('heart_rate'),
        bp_systolic=data.get('blood_pressure_systolic'),
        bp_diastolic=data.get('blood_pressure_diastolic'),
        temperature=data.get('temperature'),
        oxygen_sat=data.get('oxygen_saturation'),
        resp_rate=data.get('respiratory_rate'),
        notes=data.get('notes')
    )
    
    # Broadcast vitals update via WebSocket
    vitals_data = {
        'id': vital_id,
        'patient_id': patient_id,
        'heart_rate': data.get('heart_rate'),
        'blood_pressure_systolic': data.get('blood_pressure_systolic'),
        'blood_pressure_diastolic': data.get('blood_pressure_diastolic'),
        'temperature': data.get('temperature'),
        'oxygen_saturation': data.get('oxygen_saturation'),
        'respiratory_rate': data.get('respiratory_rate'),
        'recorded_at': datetime.now(timezone.utc).isoformat(),
        'recorded_by': user['id']
    }
    broadcast_vitals_update(patient_id, vitals_data)
    
    # Check for anomalies
    anomaly = ml_agent.detect_vital_anomaly(data)
    if anomaly:
        # Create alert for caregivers and family
        patients_users = db.get_connection().execute(
            "SELECT user_id FROM patient_access WHERE patient_id = ?", (patient_id,)
        ).fetchall()
        for pu in patients_users:
            db.create_alert(pu['user_id'], patient_id, 'vital', 
                          'Vital Sign Alert', anomaly, 'high')
        
        # Broadcast alert via WebSocket
        alert_data = {
            'alert_type': 'vital',
            'title': 'Vital Sign Alert',
            'message': anomaly,
            'patient_id': patient_id,
            'priority': 'high'
        }
        broadcast_alert(alert_data, [pu['user_id'] for pu in patients_users])
    
    return jsonify({
        'message': 'Vitals recorded',
        'vital_id': vital_id,
        'anomaly': anomaly
    })


# ============ Medication Endpoints ============

@app.route('/api/patients/<patient_id>/medications', methods=['GET'])
@token_required
def get_medications(patient_id):
    """Get patient medications"""
    active_only = request.args.get('active', 'true').lower() == 'true'
    medications = db.get_medications(patient_id, active_only)
    return jsonify({'medications': medications})


@app.route('/api/patients/<patient_id>/medications', methods=['POST'])
@token_required
@role_required('physician', 'caregiver')
def add_medication(patient_id):
    """Add new medication"""
    data = request.json
    
    med_id = db.add_medication(
        patient_id=patient_id,
        name=data['name'],
        dosage=data.get('dosage'),
        frequency=data.get('frequency'),
        time_of_day=data.get('time_of_day'),
        instructions=data.get('instructions')
    )
    
    return jsonify({'message': 'Medication added', 'medication_id': med_id}), 201


@app.route('/api/medications/<med_id>/log', methods=['POST'])
@token_required
def log_medication(med_id):
    """Log medication taken/missed"""
    data = request.json
    user = request.current_user
    
    log_id = db.log_medication(
        medication_id=med_id,
        patient_id=data['patient_id'],
        status=data['status'],  # 'taken', 'missed', 'skipped'
        recorded_by=user['id'],
        notes=data.get('notes')
    )
    
    return jsonify({'message': 'Medication logged', 'log_id': log_id})


@app.route('/api/patients/<patient_id>/medication-logs', methods=['GET'])
@token_required
def get_medication_logs(patient_id):
    """Get medication administration logs for a patient"""
    limit = request.args.get('limit', 20, type=int)
    logs = db.get_medication_logs(patient_id, limit)
    return jsonify({'medication_logs': logs})


@app.route('/api/patients/<patient_id>/medication-logs', methods=['POST'])
@token_required
@role_required('caregiver', 'physician', 'admin')
def add_medication_log(patient_id):
    """Log medication administration"""
    data = request.json
    user = request.current_user
    
    log_id = db.log_medication(
        medication_id=data['medication_id'],
        patient_id=patient_id,
        status='taken',
        recorded_by=user['id'],
        notes=data.get('notes')
    )
    
    return jsonify({
        'message': 'Medication administered and logged',
        'log_id': log_id,
        'administered_at': data.get('administered_at'),
        'dosage_given': data.get('dosage_given')
    }), 201

# ============ Appointment Endpoints ============

@app.route('/api/appointments', methods=['GET'])
@token_required
def get_appointments():
    """Get appointments for current user"""
    user = request.current_user
    patient_id = request.args.get('patient_id')
    status = request.args.get('status')
    
    if user['role'] == 'patient':
        # Get patient ID for this user
        patients = db.get_patients_for_user(user['id'], 'patient')
        if patients:
            patient_id = patients[0]['id']
    
    appointments = db.get_appointments(
        user_id=user['id'] if user['role'] in ['physician', 'caregiver'] else None,
        patient_id=patient_id,
        status=status
    )
    
    return jsonify({'appointments': appointments})


@app.route('/api/appointments', methods=['POST'])
@token_required
@role_required('physician', 'caregiver', 'admin')
def create_appointment():
    """Create new appointment"""
    data = request.json
    user = request.current_user
    
    apt_id = db.create_appointment(
        patient_id=data['patient_id'],
        physician_id=data.get('physician_id') or (user['id'] if user['role'] == 'physician' else None),
        caregiver_id=data.get('caregiver_id') or (user['id'] if user['role'] == 'caregiver' else None),
        title=data['title'],
        scheduled_at=data['scheduled_at'],
        duration_mins=data.get('duration_mins', 30),
        appointment_type=data.get('appointment_type', 'checkup')
    )
    
    # Create alerts for relevant users
    patient = db.get_patient(data['patient_id'])
    # Alert family members
    conn = db.get_connection()
    family = conn.execute(
        "SELECT user_id FROM patient_access WHERE patient_id = ? AND access_level = 'view'",
        (data['patient_id'],)
    ).fetchall()
    conn.close()
    
    for f in family:
        db.create_alert(f['user_id'], data['patient_id'], 'appointment',
                       'New Appointment Scheduled', 
                       f"Appointment: {data['title']} on {data['scheduled_at']}")
    
    return jsonify({'message': 'Appointment created', 'appointment_id': apt_id}), 201


@app.route('/api/appointments/<apt_id>', methods=['PUT'])
@token_required
def update_appointment(apt_id):
    """Update appointment status or notes"""
    data = request.json
    db.update_appointment(apt_id, data.get('status'), data.get('notes'))
    return jsonify({'message': 'Appointment updated'})


# ============ Care Log Endpoints ============

@app.route('/api/patients/<patient_id>/care-logs', methods=['GET'])
@token_required
def get_care_logs(patient_id):
    """Get care logs for patient"""
    limit = request.args.get('limit', 20, type=int)
    logs = db.get_care_logs(patient_id, limit)
    return jsonify({'care_logs': logs})


@app.route('/api/patients/<patient_id>/care-logs', methods=['POST'])
@token_required
@role_required('caregiver', 'admin')
def add_care_log(patient_id):
    """Add care log entry"""
    data = request.json
    user = request.current_user
    
    log_id = db.add_care_log(
        patient_id=patient_id,
        caregiver_id=user['id'],
        log_type=data['log_type'],
        title=data.get('title'),
        details=data['details']
    )
    
    # Broadcast care log update via WebSocket
    care_log_data = {
        'id': log_id,
        'patient_id': patient_id,
        'caregiver_id': user['id'],
        'caregiver_name': user.get('full_name', 'Caregiver'),
        'log_type': data['log_type'],
        'title': data.get('title'),
        'details': data['details'],
        'recorded_at': datetime.now(timezone.utc).isoformat()
    }
    broadcast_care_log_added(patient_id, care_log_data)
    
    return jsonify({'message': 'Care log added', 'log_id': log_id}), 201


# ============ Medical Notes Endpoints ============

@app.route('/api/patients/<patient_id>/medical-notes', methods=['GET'])
@token_required
def get_medical_notes(patient_id):
    """Get medical notes for patient"""
    user = request.current_user
    include_private = user['role'] == 'physician'
    notes = db.get_medical_notes(patient_id, include_private)
    return jsonify({'medical_notes': notes})


@app.route('/api/patients/<patient_id>/medical-notes', methods=['POST'])
@token_required
@role_required('physician', 'admin')
def add_medical_note(patient_id):
    """Add medical note"""
    data = request.json
    user = request.current_user
    
    note_id = db.add_medical_note(
        patient_id=patient_id,
        physician_id=user['id'],
        note_type=data['note_type'],
        title=data.get('title'),
        content=data['content'],
        is_private=data.get('is_private', False)
    )
    
    return jsonify({'message': 'Medical note added', 'note_id': note_id}), 201


# ============ Alert Endpoints ============

@app.route('/api/alerts', methods=['GET'])
@token_required
def get_alerts():
    """Get alerts for current user"""
    user = request.current_user
    unread_only = request.args.get('unread', 'false').lower() == 'true'
    alerts = db.get_alerts(user['id'], unread_only)
    return jsonify({'alerts': alerts})


@app.route('/api/alerts/<alert_id>/read', methods=['PUT'])
@token_required
def mark_alert_read(alert_id):
    """Mark alert as read"""
    db.mark_alert_read(alert_id)
    return jsonify({'message': 'Alert marked as read'})


@app.route('/api/emergency', methods=['POST'])
@token_required
def send_emergency_alert():
    """Send emergency alert to all caregivers and family"""
    data = request.json
    patient_id = data['patient_id']
    message = data.get('message', 'Emergency alert triggered!')
    
    # Get all users with access to this patient
    conn = db.get_connection()
    users = conn.execute(
        "SELECT user_id FROM patient_access WHERE patient_id = ?", (patient_id,)
    ).fetchall()
    conn.close()
    
    for u in users:
        db.create_alert(u['user_id'], patient_id, 'emergency', 
                       'EMERGENCY ALERT', message, 'urgent')
    
    # Broadcast emergency via WebSocket
    emergency_data = {
        'patient_id': patient_id,
        'message': message,
        'alert_type': 'emergency',
        'priority': 'urgent'
    }
    broadcast_emergency(patient_id, emergency_data)
    
    logger.warning(f"Emergency alert sent for patient {patient_id}")
    return jsonify({'message': 'Emergency alert sent to all contacts'})


# ============ AI Recommendations Endpoint ============

@app.route('/api/patients/<patient_id>/recommendations', methods=['GET'])
@token_required
def get_recommendations(patient_id):
    """Get AI-generated recommendations"""
    vitals = db.get_latest_vitals(patient_id)
    medications = db.get_medications(patient_id)
    
    recommendations = []
    
    # Vital-based recommendations
    if vitals:
        if vitals['heart_rate'] and vitals['heart_rate'] > 100:
            recommendations.append("Heart rate is elevated. Consider rest and hydration.")
        if vitals['blood_pressure_systolic'] and vitals['blood_pressure_systolic'] > 140:
            recommendations.append("Blood pressure is high. Review salt intake and stress levels.")
        if vitals['oxygen_saturation'] and vitals['oxygen_saturation'] < 95:
            recommendations.append("Oxygen levels are low. Ensure proper breathing exercises.")
    
    # Medication reminders
    if medications:
        recommendations.append(f"Patient has {len(medications)} active medications. Ensure timely administration.")
    
    # General recommendations
    recommendations.extend([
        "Maintain consistent sleep schedule for cognitive health",
        "Engage in light physical activity daily",
        "Keep the living environment well-lit and safe"
    ])
    
    return jsonify({'recommendations': recommendations})


# ============ Communication Endpoints ============

@app.route('/api/patients/<patient_id>/communicate', methods=['POST'])
@token_required
def communicate(patient_id):
    """Send communication to patient or caregiver"""
    data = request.json
    method = data.get('method')
    message = data.get('message')
    recipient = data.get('recipient')
    
    try:
        if method == 'email':
            send_email(recipient, "HealthSync Notification", message)
        elif method == 'whatsapp':
            send_whatsapp(recipient, message)
        elif method == 'phone':
            make_phone_call(recipient, message)
        else:
            return jsonify({'error': 'Invalid communication method'}), 400
        
        return jsonify({'message': f'{method} sent successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ Legacy Endpoints (Backward Compatibility) ============

@app.route('/api/patient/<patient_id>/status', methods=['GET'])
@token_required
def legacy_get_status(patient_id):
    """Legacy status endpoint - redirects to new format"""
    # Map old patient IDs to new format
    if patient_id == 'patient1':
        patient_id = 'pat_001'
    return get_patient_status(patient_id)


@app.route('/api/patient/<patient_id>/sleep', methods=['POST'])
@token_required
def update_sleep(patient_id):
    """Update sleep data"""
    data = request.json
    sleep_agent.update_data(data)
    return jsonify({'message': 'Sleep data updated', 'quality': sleep_agent.assess_quality()})


@app.route('/api/patient/<patient_id>/medication', methods=['POST'])
@token_required
def schedule_medication(patient_id):
    """Schedule medication (legacy)"""
    if patient_id == 'patient1':
        patient_id = 'pat_001'
    data = request.json
    med_id = db.add_medication(
        patient_id, data['name'], data.get('dose'),
        'As directed', data.get('time'), None
    )
    return jsonify({'message': 'Medication scheduled', 'medication_id': med_id})


@app.route('/api/patient/<patient_id>/events', methods=['GET'])
@token_required
def get_events(patient_id):
    """Get patient events"""
    if patient_id == 'patient1':
        patient_id = 'pat_001'
    start = request.args.get('start_date', '2020-01-01')
    end = request.args.get('end_date', '2030-12-31')
    events = db.get_events(patient_id, start, end)
    return jsonify({'events': events})


@app.route('/api/events/<int:event_id>', methods=['PUT'])
@token_required
def update_event(event_id):
    """Update event status"""
    data = request.json
    db.update_event(event_id, data.get('completed', False))
    return jsonify({'message': 'Event updated'})


@app.route('/api/patient/<patient_id>/recommendations', methods=['GET'])
@token_required
def legacy_recommendations(patient_id):
    """Legacy recommendations endpoint"""
    if patient_id == 'patient1':
        patient_id = 'pat_001'
    return get_recommendations(patient_id)


# ============ Document Endpoints ============

import os
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/documents', methods=['GET'])
@token_required
def list_documents():
    """List documents accessible to user"""
    patient_id = request.args.get('patient_id')
    category = request.args.get('category')
    docs = db.get_documents(patient_id=patient_id, category=category)
    return jsonify({'documents': docs})


@app.route('/api/documents', methods=['POST'])
@token_required
def upload_document():
    """Upload a new document"""
    user = request.current_user
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400
    
    # Save file
    import uuid as uuid_mod
    safe_filename = f"{uuid_mod.uuid4().hex}_{file.filename}"
    storage_path = os.path.join(UPLOAD_FOLDER, safe_filename)
    file.save(storage_path)
    
    # Get metadata
    patient_id = request.form.get('patient_id')
    category = request.form.get('category', 'other')
    description = request.form.get('description', '')
    
    doc_id = db.create_document(
        patient_id=patient_id,
        uploaded_by=user['id'],
        filename=file.filename,
        file_type=file.content_type,
        file_size=os.path.getsize(storage_path),
        storage_path=storage_path,
        category=category,
        description=description
    )
    
    audit_log(user['id'], 'document_uploaded', 'document', doc_id)
    return jsonify({'message': 'Document uploaded', 'document_id': doc_id}), 201


@app.route('/api/documents/<doc_id>', methods=['GET'])
@token_required
def get_document(doc_id):
    """Get document metadata"""
    doc = db.get_document(doc_id)
    if not doc:
        return jsonify({'error': 'Document not found'}), 404
    return jsonify({'document': doc})


@app.route('/api/documents/<doc_id>/download', methods=['GET'])
@token_required
def download_document(doc_id):
    """Download document file"""
    from flask import send_file
    doc = db.get_document(doc_id)
    if not doc:
        return jsonify({'error': 'Document not found'}), 404
    
    audit_log(request.current_user['id'], 'document_downloaded', 'document', doc_id)
    return send_file(doc['storage_path'], download_name=doc['filename'])


@app.route('/api/documents/<doc_id>', methods=['DELETE'])
@token_required
def delete_document(doc_id):
    """Delete a document"""
    doc = db.get_document(doc_id)
    if not doc:
        return jsonify({'error': 'Document not found'}), 404
    
    # Delete file
    if os.path.exists(doc['storage_path']):
        os.remove(doc['storage_path'])
    
    db.delete_document(doc_id)
    audit_log(request.current_user['id'], 'document_deleted', 'document', doc_id)
    return jsonify({'message': 'Document deleted'})


# ============ Shift Scheduling Endpoints ============

@app.route('/api/shifts', methods=['GET'])
@token_required
def list_shifts():
    """List shifts with flexible filtering"""
    user = request.current_user
    staff_id = request.args.get('staff_id')
    staff_type = request.args.get('staff_type')
    patient_id = request.args.get('patient_id')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    status = request.args.get('status')
    
    # Staff see their own shifts by default unless admin
    if user['role'] in ['caregiver', 'physician'] and not staff_id:
        staff_id = user['id']
    
    # Convert status to list if multiple
    if status and ',' in status:
        status = status.split(',')
    
    shifts = db.get_shifts(
        staff_id=staff_id, 
        staff_type=staff_type,
        patient_id=patient_id,
        date_from=date_from, 
        date_to=date_to,
        status=status
    )
    return jsonify({'shifts': shifts})


@app.route('/api/shifts/today', methods=['GET'])
@token_required
def get_todays_shifts():
    """Get today's shifts for current user or all (admin)"""
    user = request.current_user
    staff_type = request.args.get('staff_type')
    
    if user['role'] in ['caregiver', 'physician']:
        shifts = db.get_todays_shifts(staff_id=user['id'])
    else:
        shifts = db.get_todays_shifts(staff_type=staff_type)
    
    return jsonify({'shifts': shifts})


@app.route('/api/shifts/upcoming', methods=['GET'])
@token_required
def get_upcoming_shifts():
    """Get upcoming shifts"""
    user = request.current_user
    days = int(request.args.get('days', 7))
    
    if user['role'] in ['caregiver', 'physician']:
        shifts = db.get_upcoming_shifts(staff_id=user['id'], days=days)
    else:
        shifts = db.get_upcoming_shifts(days=days)
    
    return jsonify({'shifts': shifts})


@app.route('/api/shifts/active', methods=['GET'])
@token_required
def get_active_shift():
    """Get current user's active shift (clocked in)"""
    user = request.current_user
    shift = db.get_active_shift(user['id'])
    return jsonify({'active_shift': shift})


@app.route('/api/shifts/summary', methods=['GET'])
@token_required
def get_shift_summary():
    """Get shift statistics"""
    user = request.current_user
    staff_id = request.args.get('staff_id')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    
    # Non-admin users can only see their own summary
    if user['role'] not in ['admin'] and not staff_id:
        staff_id = user['id']
    
    summary = db.get_shift_summary(staff_id=staff_id, date_from=date_from, date_to=date_to)
    return jsonify(summary)


@app.route('/api/shifts', methods=['POST'])
@token_required
@role_required('admin', 'physician')
def create_shift():
    """Create a new shift for caregiver or physician"""
    user = request.current_user
    data = request.json
    
    required = ['staff_id', 'staff_type', 'patient_id', 'shift_date', 'start_time', 'end_time']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    if data['staff_type'] not in ['caregiver', 'physician']:
        return jsonify({'error': 'staff_type must be caregiver or physician'}), 400
    
    shift_id = db.create_shift(
        staff_id=data['staff_id'],
        staff_type=data['staff_type'],
        patient_id=data['patient_id'],
        shift_date=data['shift_date'],
        start_time=data['start_time'],
        end_time=data['end_time'],
        created_by=user['id'],
        notes=data.get('notes')
    )
    
    # Create alert for the assigned staff
    db.create_alert(
        data['staff_id'], 
        data['patient_id'],
        'appointment',
        'New Shift Assigned',
        f"You have been assigned a shift on {data['shift_date']} from {data['start_time']} to {data['end_time']}"
    )
    
    audit_log(user['id'], 'shift_created', 'shift', shift_id)
    return jsonify({'message': 'Shift created', 'shift_id': shift_id}), 201


@app.route('/api/shifts/<shift_id>', methods=['GET'])
@token_required
def get_shift_details(shift_id):
    """Get shift details"""
    shift = db.get_shift(shift_id)
    if not shift:
        return jsonify({'error': 'Shift not found'}), 404
    return jsonify({'shift': shift})


@app.route('/api/shifts/<shift_id>', methods=['PUT'])
@token_required
@role_required('admin', 'physician')
def update_shift(shift_id):
    """Update shift details"""
    data = request.json
    db.update_shift(shift_id, **data)
    audit_log(request.current_user['id'], 'shift_updated', 'shift', shift_id)
    return jsonify({'message': 'Shift updated'})


@app.route('/api/shifts/<shift_id>/approve', methods=['POST'])
@token_required
@role_required('admin')
def approve_shift(shift_id):
    """Approve a shift"""
    user = request.current_user
    db.approve_shift(shift_id, user['id'])
    audit_log(user['id'], 'shift_approved', 'shift', shift_id)
    return jsonify({'message': 'Shift approved'})


@app.route('/api/shifts/<shift_id>/check-in', methods=['POST'])
@token_required
@role_required('caregiver', 'physician')
def check_in_to_shift(shift_id):
    """Clock in to a shift"""
    user = request.current_user
    data = request.json or {}
    
    # Verify this is the assigned staff
    shift = db.get_shift(shift_id)
    if not shift:
        return jsonify({'error': 'Shift not found'}), 404
    if shift['staff_id'] != user['id']:
        return jsonify({'error': 'This shift is not assigned to you'}), 403
    if shift['status'] not in ['scheduled', 'confirmed']:
        return jsonify({'error': f"Cannot clock in to a {shift['status']} shift"}), 400
    
    db.check_in_shift(shift_id, location=data.get('location'))
    audit_log(user['id'], 'shift_check_in', 'shift', shift_id)
    return jsonify({'message': 'Clocked in successfully', 'check_in_time': datetime.now().isoformat()})


@app.route('/api/shifts/<shift_id>/check-out', methods=['POST'])
@token_required
@role_required('caregiver', 'physician')
def check_out_of_shift(shift_id):
    """Clock out of a shift"""
    user = request.current_user
    data = request.json or {}
    
    # Verify this is the assigned staff
    shift = db.get_shift(shift_id)
    if not shift:
        return jsonify({'error': 'Shift not found'}), 404
    if shift['staff_id'] != user['id']:
        return jsonify({'error': 'This shift is not assigned to you'}), 403
    if shift['status'] != 'in_progress':
        return jsonify({'error': 'You must clock in first'}), 400
    
    db.check_out_shift(shift_id, location=data.get('location'))
    updated_shift = db.get_shift(shift_id)
    audit_log(user['id'], 'shift_check_out', 'shift', shift_id)
    return jsonify({
        'message': 'Clocked out successfully',
        'check_out_time': updated_shift.get('check_out_time'),
        'actual_hours': updated_shift.get('actual_hours')
    })


@app.route('/api/shifts/<shift_id>/cancel', methods=['POST'])
@token_required
@role_required('admin', 'physician')
def cancel_shift(shift_id):
    """Cancel a shift"""
    user = request.current_user
    data = request.json or {}
    db.update_shift(shift_id, status='cancelled', notes=data.get('reason'))
    audit_log(user['id'], 'shift_cancelled', 'shift', shift_id)
    return jsonify({'message': 'Shift cancelled'})


@app.route('/api/shifts/<shift_id>', methods=['DELETE'])
@token_required
@role_required('admin')
def delete_shift(shift_id):
    """Delete a shift"""
    db.delete_shift(shift_id)
    audit_log(request.current_user['id'], 'shift_deleted', 'shift', shift_id)
    return jsonify({'message': 'Shift deleted'})


# ============ User Assignment Endpoints ============

@app.route('/api/users/by-role/<role>', methods=['GET'])
@token_required
def get_users_by_role(role):
    """Get all users with a specific role"""
    if role not in ['patient', 'caregiver', 'physician', 'family', 'admin']:
        return jsonify({'error': 'Invalid role'}), 400
    users = db.get_users_by_role(role)
    return jsonify({'users': users})


@app.route('/api/patients/<patient_id>/care-team', methods=['GET'])
@token_required
def get_patient_care_team(patient_id):
    """Get all users assigned to a patient"""
    care_team = db.get_patient_care_team(patient_id)
    family = db.get_patient_family_members(patient_id)
    return jsonify({'care_team': care_team, 'family': family})


@app.route('/api/patients/<patient_id>/care-team', methods=['POST'])
@token_required
@role_required('admin', 'physician')
def assign_to_care_team(patient_id):
    """Assign a caregiver or physician to a patient (also links them to patient's family)"""
    data = request.json
    
    if not data.get('user_id'):
        return jsonify({'error': 'user_id is required'}), 400
    
    user_info = db.get_user_by_id(data['user_id'])
    if not user_info:
        return jsonify({'error': 'User not found'}), 404
    
    if user_info['role'] in ['caregiver', 'physician']:
        # Use the special staff assignment that links to family too
        result = db.assign_staff_to_patient(patient_id, data['user_id'], user_info['role'])
        audit_log(request.current_user['id'], 'staff_assigned_to_patient', 'patient', patient_id,
                  f"Assigned {user_info['role']} {data['user_id']}, linked to {result['family_members_linked']} family members")
        return jsonify({
            'message': 'Staff assigned to patient and linked to family',
            'family_members_linked': result['family_members_linked']
        }), 201
    else:
        # For family members, just assign directly
        db.assign_user_to_patient(patient_id, data['user_id'], 'view', data.get('relationship'))
        audit_log(request.current_user['id'], 'user_assigned_to_patient', 'patient', patient_id)
        return jsonify({'message': 'User assigned to care team'}), 201


@app.route('/api/patients/<patient_id>/care-team/<user_id>', methods=['DELETE'])
@token_required
@role_required('admin')
def remove_from_care_team(patient_id, user_id):
    """Remove a user from a patient's care team"""
    db.unassign_staff_from_patient(patient_id, user_id)
    audit_log(request.current_user['id'], 'user_removed_from_patient', 'patient', patient_id)
    return jsonify({'message': 'User removed from care team'})


# ============ Staff Assignment Endpoints ============

@app.route('/api/staff-assignments', methods=['GET'])
@token_required
@role_required('admin')
def get_all_staff_assignments():
    """Get all staff assignments - admin view"""
    staff_type = request.args.get('staff_type')
    patient_id = request.args.get('patient_id')
    staff_id = request.args.get('staff_id')
    
    assignments = db.get_staff_assignments(staff_id=staff_id, patient_id=patient_id, staff_type=staff_type)
    return jsonify({'assignments': assignments})


@app.route('/api/staff-assignments', methods=['POST'])
@token_required
@role_required('admin')
def create_staff_assignment():
    """Assign a caregiver or physician to a patient"""
    data = request.json
    
    staff_id = data.get('staff_id')
    patient_id = data.get('patient_id')
    
    if not staff_id or not patient_id:
        return jsonify({'error': 'staff_id and patient_id are required'}), 400
    
    # Get staff info
    staff = db.get_user_by_id(staff_id)
    if not staff:
        return jsonify({'error': 'Staff member not found'}), 404
    if staff['role'] not in ['caregiver', 'physician']:
        return jsonify({'error': 'User is not a caregiver or physician'}), 400
    
    # Assign staff to patient (automatically links to family)
    result = db.assign_staff_to_patient(patient_id, staff_id, staff['role'])
    
    audit_log(request.current_user['id'], 'staff_assigned', 'patient', patient_id,
              f"Assigned {staff['role']} {staff['full_name']} to patient")
    
    return jsonify({
        'message': f"{staff['role'].title()} assigned to patient",
        'family_members_linked': result['family_members_linked']
    }), 201


@app.route('/api/staff-assignments/<patient_id>/<staff_id>', methods=['DELETE'])
@token_required
@role_required('admin')
def delete_staff_assignment(patient_id, staff_id):
    """Remove a staff assignment"""
    db.unassign_staff_from_patient(patient_id, staff_id)
    audit_log(request.current_user['id'], 'staff_unassigned', 'patient', patient_id)
    return jsonify({'message': 'Staff assignment removed'})


@app.route('/api/patients/<patient_id>/family', methods=['GET'])
@token_required
def get_patient_family(patient_id):
    """Get family members linked to a patient"""
    family = db.get_patient_family_members(patient_id)
    return jsonify({'family': family})


@app.route('/api/staff/available', methods=['GET'])
@token_required
@role_required('admin', 'physician')
def get_available_staff():
    """Get staff available for a shift"""
    staff_type = request.args.get('staff_type', 'caregiver')
    shift_date = request.args.get('shift_date')
    start_time = request.args.get('start_time')
    end_time = request.args.get('end_time')
    
    if not all([shift_date, start_time, end_time]):
        return jsonify({'error': 'shift_date, start_time, and end_time are required'}), 400
    
    staff = db.get_available_staff(staff_type, shift_date, start_time, end_time)
    return jsonify({'available_staff': staff})


# ============ Patient Care History Endpoints ============

@app.route('/api/patients/<patient_id>/history', methods=['GET'])
@token_required
def get_patient_history(patient_id):
    """Get complete patient care history"""
    limit = request.args.get('limit', 50, type=int)
    history = db.get_patient_history(patient_id, limit=limit)
    return jsonify(history)


# ---- Prescriptions ----
@app.route('/api/prescriptions', methods=['GET'])
@token_required
def get_prescriptions():
    """Get prescriptions"""
    patient_id = request.args.get('patient_id')
    status = request.args.get('status')
    prescriptions = db.get_prescriptions(patient_id=patient_id, status=status)
    return jsonify({'prescriptions': prescriptions})


@app.route('/api/prescriptions', methods=['POST'])
@token_required
@role_required('physician')
def create_prescription():
    """Create a new prescription - Physician only"""
    data = request.json
    user = request.current_user
    
    required = ['patient_id', 'medication_name']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    rx_id = db.create_prescription(
        data['patient_id'], user['id'], data['medication_name'],
        dosage=data.get('dosage'), frequency=data.get('frequency'),
        duration=data.get('duration'), quantity=data.get('quantity'),
        refills_allowed=data.get('refills_allowed', 0),
        instructions=data.get('instructions'), reason=data.get('reason'),
        start_date=data.get('start_date'), end_date=data.get('end_date'),
        pharmacy_notes=data.get('pharmacy_notes')
    )
    audit_log(user['id'], 'prescription_created', 'prescription', rx_id)
    return jsonify({'message': 'Prescription created', 'prescription_id': rx_id}), 201


# ---- Diagnoses ----
@app.route('/api/diagnoses', methods=['GET'])
@token_required
def get_diagnoses():
    """Get diagnoses and test results"""
    patient_id = request.args.get('patient_id')
    diagnosis_type = request.args.get('type')
    diagnoses = db.get_diagnoses(patient_id=patient_id, diagnosis_type=diagnosis_type)
    return jsonify({'diagnoses': diagnoses})


@app.route('/api/diagnoses', methods=['POST'])
@token_required
@role_required('physician')
def create_diagnosis():
    """Create a new diagnosis/test result - Physician only"""
    data = request.json
    user = request.current_user
    
    required = ['patient_id', 'diagnosis_type', 'title']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    dx_id = db.create_diagnosis(
        data['patient_id'], user['id'], data['diagnosis_type'], data['title'],
        description=data.get('description'), icd_code=data.get('icd_code'),
        severity=data.get('severity'), test_name=data.get('test_name'),
        test_results=data.get('test_results'), test_date=data.get('test_date'),
        normal_range=data.get('normal_range'), is_abnormal=data.get('is_abnormal', 0),
        follow_up_required=data.get('follow_up_required', 0),
        follow_up_date=data.get('follow_up_date'), notes=data.get('notes')
    )
    audit_log(user['id'], 'diagnosis_created', 'diagnosis', dx_id)
    return jsonify({'message': 'Diagnosis created', 'diagnosis_id': dx_id}), 201


# ---- Consultations ----
@app.route('/api/consultations', methods=['GET'])
@token_required
def get_consultations():
    """Get consultations"""
    patient_id = request.args.get('patient_id')
    consultation_type = request.args.get('type')
    consultations = db.get_consultations(patient_id=patient_id, consultation_type=consultation_type)
    return jsonify({'consultations': consultations})


@app.route('/api/consultations', methods=['POST'])
@token_required
@role_required('physician')
def create_consultation():
    """Create a new consultation record - Physician only"""
    data = request.json
    user = request.current_user
    
    required = ['patient_id', 'consultation_type', 'visit_date']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    consult_id = db.create_consultation(
        data['patient_id'], user['id'], data['consultation_type'], data['visit_date'],
        chief_complaint=data.get('chief_complaint'), present_illness=data.get('present_illness'),
        physical_examination=data.get('physical_examination'), assessment=data.get('assessment'),
        treatment_plan=data.get('treatment_plan'), recommendations=data.get('recommendations'),
        follow_up_instructions=data.get('follow_up_instructions'),
        next_appointment=data.get('next_appointment'), duration_minutes=data.get('duration_minutes'),
        video_call_id=data.get('video_call_id')
    )
    audit_log(user['id'], 'consultation_created', 'consultation', consult_id)
    return jsonify({'message': 'Consultation created', 'consultation_id': consult_id}), 201


# ---- Patient Issues ----
@app.route('/api/patient-issues', methods=['GET'])
@token_required
def get_patient_issues():
    """Get patient issues and concerns"""
    patient_id = request.args.get('patient_id')
    status = request.args.get('status')
    severity = request.args.get('severity')
    issues = db.get_patient_issues(patient_id=patient_id, status=status, severity=severity)
    return jsonify({'issues': issues})


@app.route('/api/patient-issues', methods=['POST'])
@token_required
def create_patient_issue():
    """Create a new patient issue - Any staff can report"""
    data = request.json
    user = request.current_user
    
    required = ['patient_id', 'issue_type', 'title']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    issue_id = db.create_patient_issue(
        data['patient_id'], user['id'], data['issue_type'], data['title'],
        description=data.get('description'), severity=data.get('severity', 'medium'),
        onset_date=data.get('onset_date')
    )
    audit_log(user['id'], 'issue_reported', 'patient_issue', issue_id)
    return jsonify({'message': 'Issue reported', 'issue_id': issue_id}), 201


@app.route('/api/patient-issues/<issue_id>/resolve', methods=['POST'])
@token_required
@role_required('physician', 'admin')
def resolve_patient_issue(issue_id):
    """Resolve a patient issue - Physician/Admin only"""
    data = request.json
    user = request.current_user
    
    if not data.get('resolution'):
        return jsonify({'error': 'resolution is required'}), 400
    
    db.resolve_patient_issue(issue_id, user['id'], data['resolution'])
    audit_log(user['id'], 'issue_resolved', 'patient_issue', issue_id)
    return jsonify({'message': 'Issue resolved'})


# ---- Video Call Notes ----
@app.route('/api/video-call-notes', methods=['GET'])
@token_required
def get_video_call_notes():
    """Get video call notes"""
    video_call_id = request.args.get('video_call_id')
    patient_id = request.args.get('patient_id')
    notes = db.get_video_call_notes(video_call_id=video_call_id, patient_id=patient_id)
    return jsonify({'notes': notes})


@app.route('/api/video-call-notes', methods=['POST'])
@token_required
def create_video_call_note():
    """Create a video call note"""
    data = request.json
    user = request.current_user
    
    required = ['video_call_id', 'patient_id', 'note_type', 'content']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    note_id = db.create_video_call_note(
        data['video_call_id'], data['patient_id'], user['id'],
        data['note_type'], data['content'],
        timestamp_start=data.get('timestamp_start'),
        timestamp_end=data.get('timestamp_end'),
        is_important=data.get('is_important', 0)
    )
    audit_log(user['id'], 'video_note_created', 'video_call_note', note_id)
    return jsonify({'message': 'Note created', 'note_id': note_id}), 201


# ---- Caregiver Daily Reports ----
@app.route('/api/caregiver-reports', methods=['GET'])
@token_required
def get_caregiver_reports():
    """Get caregiver daily reports"""
    patient_id = request.args.get('patient_id')
    caregiver_id = request.args.get('caregiver_id')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    reports = db.get_caregiver_reports(patient_id=patient_id, caregiver_id=caregiver_id,
                                        date_from=date_from, date_to=date_to)
    return jsonify({'reports': reports})


@app.route('/api/caregiver-reports', methods=['POST'])
@token_required
@role_required('caregiver')
def create_caregiver_report():
    """Create a caregiver daily report - Caregiver only"""
    data = request.json
    user = request.current_user
    
    required = ['patient_id', 'report_date']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    report_id = db.create_caregiver_report(
        data['patient_id'], user['id'], data['report_date'],
        shift_id=data.get('shift_id'), overall_status=data.get('overall_status'),
        mood_assessment=data.get('mood_assessment'), appetite=data.get('appetite'),
        sleep_quality=data.get('sleep_quality'), mobility_status=data.get('mobility_status'),
        pain_level=data.get('pain_level'), activities_completed=data.get('activities_completed'),
        meals_given=data.get('meals_given'), medications_administered=data.get('medications_administered'),
        vital_signs_summary=data.get('vital_signs_summary'), incidents=data.get('incidents'),
        concerns=data.get('concerns'), recommendations=data.get('recommendations'),
        family_communication=data.get('family_communication'),
        next_shift_notes=data.get('next_shift_notes')
    )
    audit_log(user['id'], 'caregiver_report_created', 'caregiver_report', report_id)
    return jsonify({'message': 'Report submitted', 'report_id': report_id}), 201


# ---- Doctor Reports ----
@app.route('/api/doctor-reports', methods=['GET'])
@token_required
def get_doctor_reports():
    """Get doctor reports"""
    patient_id = request.args.get('patient_id')
    physician_id = request.args.get('physician_id')
    report_type = request.args.get('report_type')
    reports = db.get_doctor_reports(patient_id=patient_id, physician_id=physician_id,
                                     report_type=report_type)
    return jsonify({'reports': reports})


@app.route('/api/doctor-reports', methods=['POST'])
@token_required
@role_required('physician')
def create_doctor_report():
    """Create a doctor report - Physician only"""
    data = request.json
    user = request.current_user
    
    required = ['patient_id', 'report_type', 'report_date']
    for field in required:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    report_id = db.create_doctor_report(
        data['patient_id'], user['id'], data['report_type'], data['report_date'],
        visit_type=data.get('visit_type'), chief_complaint=data.get('chief_complaint'),
        history_of_present_illness=data.get('history_of_present_illness'),
        review_of_systems=data.get('review_of_systems'), physical_exam=data.get('physical_exam'),
        current_medications=data.get('current_medications'), allergies=data.get('allergies'),
        diagnosis=data.get('diagnosis'), icd_codes=data.get('icd_codes'),
        assessment=data.get('assessment'), treatment_plan=data.get('treatment_plan'),
        prescriptions_issued=data.get('prescriptions_issued'), tests_ordered=data.get('tests_ordered'),
        referrals=data.get('referrals'), patient_education=data.get('patient_education'),
        follow_up_plan=data.get('follow_up_plan'), prognosis=data.get('prognosis'),
        restrictions=data.get('restrictions'), work_status=data.get('work_status'),
        caregiver_instructions=data.get('caregiver_instructions'),
        family_instructions=data.get('family_instructions')
    )
    audit_log(user['id'], 'doctor_report_created', 'doctor_report', report_id)
    return jsonify({'message': 'Report created', 'report_id': report_id}), 201


@app.route('/api/doctor-reports/<report_id>/sign', methods=['POST'])
@token_required
@role_required('physician')
def sign_doctor_report(report_id):
    """Sign/finalize a doctor report - Physician only"""
    user = request.current_user
    db.sign_doctor_report(report_id)
    audit_log(user['id'], 'doctor_report_signed', 'doctor_report', report_id)
    return jsonify({'message': 'Report signed'})



# ============ Video Call WebSocket ============

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected to video stream")
    emit('status', {'message': 'Connected to HealthSync video'})


@socketio.on('join_call')
def handle_join_call(data):
    room = data.get('room')
    if room:
        emit('user_joined', {'message': 'User joined the call'}, room=room)


@socketio.on('video_frame')
def handle_video_frame(data):
    room = data.get('room')
    frame = data.get('frame')
    if room and frame:
        emit('video_frame', {'frame': frame}, room=room, include_self=False)


@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected from video stream")


# ============ Health Check ============

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})


# ============ AI Endpoints ============

from utils.ai_service import ai_service

@app.route('/api/ai/generate-care-note', methods=['POST'])
@token_required
@role_required('caregiver', 'physician', 'admin')
def generate_care_note():
    """Generate AI care note from patient data"""
    data = request.json
    patient_id = data.get('patient_id')
    
    # Get patient and vital data
    patient = db.get_patient(patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404
    
    # Get recent vitals
    vitals = db.get_latest_vitals(patient_id) if hasattr(db, 'get_latest_vitals') else {}
    
    # Combine data for AI
    patient_data = {
        'name': patient.get('name'),
        'condition': patient.get('condition'),
        'heart_rate': data.get('heart_rate') or vitals.get('heart_rate'),
        'blood_pressure': data.get('blood_pressure') or vitals.get('blood_pressure'),
        'temperature': data.get('temperature') or vitals.get('temperature'),
        'oxygen_saturation': data.get('oxygen_saturation') or vitals.get('oxygen_saturation'),
        'medications_given': data.get('medications_given', []),
        'meals': data.get('meals'),
        'activities': data.get('activities'),
        'sleep_quality': data.get('sleep_quality'),
        'mood': data.get('mood'),
        'observations': data.get('observations')
    }
    
    care_note = ai_service.generate_care_note(patient_data)
    
    audit_log(request.current_user['id'], 'ai_care_note_generated', 'patient', patient_id)
    return jsonify({
        'care_note': care_note,
        'patient_id': patient_id,
        'generated_at': datetime.now().isoformat()
    })


@app.route('/api/ai/care-recommendations', methods=['POST'])
@token_required
def get_care_recommendations():
    """Get AI-powered care recommendations"""
    data = request.json
    patient_id = data.get('patient_id')
    context = data.get('context', '')
    
    patient = db.get_patient(patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404
    
    patient_data = {
        'name': patient.get('name'),
        'condition': patient.get('condition'),
        'heart_rate': data.get('heart_rate'),
        'blood_pressure': data.get('blood_pressure')
    }
    
    recommendation = ai_service.get_care_recommendation(patient_data, context)
    
    return jsonify({
        'recommendations': recommendation,
        'patient_id': patient_id
    })


@app.route('/api/ai/care-protocol/<condition>', methods=['GET'])
@token_required
def get_care_protocol(condition):
    """Get care protocol for a condition"""
    protocol = ai_service.get_care_protocol(condition)
    return jsonify({
        'condition': condition,
        'protocol': protocol
    })


@app.route('/api/ai/drug-interactions', methods=['POST'])
@token_required
def check_drug_interactions():
    """Check for drug interactions"""
    data = request.json
    medications = data.get('medications', [])
    
    if not medications:
        return jsonify({'error': 'Medications list required'}), 400
    
    interactions = ai_service.check_drug_interactions(medications)
    
    return jsonify({
        'medications': medications,
        'interactions': interactions,
        'has_interactions': len(interactions) > 0
    })


@app.route('/api/ai/analyze-vitals', methods=['POST'])
@token_required
def analyze_vitals():
    """Analyze vitals for risk assessment"""
    data = request.json
    
    vitals = {
        'heart_rate': data.get('heart_rate'),
        'blood_pressure': data.get('blood_pressure'),
        'temperature': data.get('temperature'),
        'oxygen_saturation': data.get('oxygen_saturation')
    }
    
    analysis = ai_service.analyze_vitals(vitals)
    
    return jsonify(analysis)


@app.route('/api/ai/patient-risk/<patient_id>', methods=['GET'])
@token_required
def get_patient_risk(patient_id):
    """Get patient risk score and factors"""
    patient = db.get_patient(patient_id)
    if not patient:
        return jsonify({'error': 'Patient not found'}), 404
    
    # Get patient history data
    history = {
        'medication_adherence': 85,  # Would come from medication logs
        'vital_anomalies': 0,        # Would come from vital tracking
        'missed_appointments': 0,    # Would come from appointments
        'falls': 0                   # Would come from incident reports
    }
    
    risk_assessment = ai_service.predict_patient_risk(history)
    
    return jsonify({
        'patient_id': patient_id,
        'patient_name': patient.get('name'),
        **risk_assessment
    })


@app.route('/api/ai/summarize-notes', methods=['POST'])
@token_required
def summarize_notes():
    """Summarize care logs into daily summary"""
    data = request.json
    care_logs = data.get('care_logs', [])
    
    summary = ai_service.summarize_daily_care(care_logs)
    
    return jsonify({
        'summary': summary,
        'logs_count': len(care_logs)
    })


@app.route('/api/ai/transcribe-note', methods=['POST'])
@token_required
def transcribe_note():
    """Process transcribed speech into structured notes"""
    data = request.json
    audio_text = data.get('text', '')
    
    if not audio_text:
        return jsonify({'error': 'Text required'}), 400
    
    result = ai_service.transcribe_notes(audio_text)
    
    return jsonify(result)



@app.route('/api/ai/summarize-call', methods=['POST'])
@token_required
def summarize_video_call():
    """Summarize video call transcript"""
    data = request.json
    transcript = data.get('transcript', '')
    
    if not transcript:
        return jsonify({'error': 'Transcript required'}), 400
    
    result = ai_service.summarize_video_call(transcript)
    
    return jsonify(result)


# ========== Video Call Scheduling ==========

@app.route('/api/video-calls', methods=['GET'])
@token_required
def get_video_calls():
    """Get scheduled video calls for current user"""
    user = request.current_user
    user_id = user['id']
    patient_id = request.args.get('patient_id')
    status = request.args.get('status')
    
    calls = db.get_video_calls(user_id=user_id, patient_id=patient_id, status=status)
    return jsonify({'video_calls': calls})


@app.route('/api/video-calls', methods=['POST'])
@token_required
@role_required('caregiver', 'physician', 'admin', 'family', 'patient')
def schedule_video_call():
    """Schedule a new video call - supports calls between various user roles"""
    data = request.json
    user = request.current_user
    user_id = user['id']
    
    # Either patient_id or participant_id is required
    if not data.get('patient_id') and not data.get('participant_id'):
        return jsonify({'error': 'Either patient_id or participant_id is required'}), 400
    
    if not data.get('scheduled_at'):
        return jsonify({'error': 'scheduled_at is required'}), 400
    
    call_id = db.create_video_call(
        patient_id=data.get('patient_id'),
        scheduled_by=user_id,
        scheduled_at=data['scheduled_at'],
        scheduled_with=data.get('participant_id') or data.get('scheduled_with'),
        duration_minutes=data.get('duration_minutes', 30),
        title=data.get('title', 'Video Consultation'),
        description=data.get('description', '')
    )
    
    # Create alert for the participant
    participant_id = data.get('participant_id') or data.get('scheduled_with')
    if participant_id:
        db.create_alert(
            participant_id, 
            data.get('patient_id'),
            'appointment',
            'Video Call Scheduled',
            f"{user['full_name']} scheduled a video call with you for {data['scheduled_at']}"
        )
    
    audit_log(user_id, 'video_call_scheduled', resource_id=call_id)
    return jsonify({'message': 'Video call scheduled', 'call_id': call_id}), 201


@app.route('/api/video-calls/<call_id>', methods=['GET'])
@token_required
def get_video_call(call_id):
    """Get video call details"""
    call = db.get_video_call(call_id)
    if not call:
        return jsonify({'error': 'Video call not found'}), 404
    return jsonify(call)


@app.route('/api/video-calls/<call_id>', methods=['PUT'])
@token_required
def update_video_call(call_id):
    """Update video call"""
    data = request.json
    db.update_video_call(call_id, **data)
    return jsonify({'message': 'Video call updated'})


@app.route('/api/video-calls/<call_id>', methods=['DELETE'])
@token_required
def cancel_video_call(call_id):
    """Cancel/delete video call - anyone who scheduled can cancel"""
    user = request.current_user
    user_id = user['id']
    db.update_video_call(call_id, status='cancelled')
    audit_log(user_id, 'video_call_cancelled', resource_id=call_id)
    return jsonify({'message': 'Video call cancelled'})


@app.route('/api/video-calls/upcoming', methods=['GET'])
@token_required
def get_upcoming_calls():
    """Get upcoming video calls for current user"""
    user = request.current_user
    user_id = user['id']
    hours = int(request.args.get('hours', 48))
    calls = db.get_upcoming_video_calls(user_id=user_id, hours=hours)
    return jsonify({'upcoming_calls': calls})



# ============ Messaging Endpoints ============

@app.route('/api/messages', methods=['GET'])
@token_required
def get_messages():
    """Get messages for current user"""
    user = request.current_user
    folder = request.args.get('folder', 'inbox')
    limit = int(request.args.get('limit', 50))
    messages = db.get_messages(user['id'], folder=folder, limit=limit)
    return jsonify({'messages': messages})


@app.route('/api/messages', methods=['POST'])
@token_required
def send_message():
    """Send a new message"""
    user = request.current_user
    data = request.json
    
    if 'content' not in data:
        return jsonify({'error': 'content is required'}), 400
    if 'recipient_id' not in data:
        return jsonify({'error': 'recipient_id is required'}), 400
    
    msg_id = db.create_message(
        user['id'], data['content'],
        recipient_id=data['recipient_id'],
        subject=data.get('subject'),
        patient_id=data.get('patient_id'),
        message_type=data.get('message_type', 'direct'),
        priority=data.get('priority', 'normal'),
        attachments=data.get('attachments')
    )
    return jsonify({'message': 'Message sent', 'message_id': msg_id}), 201


@app.route('/api/messages/<message_id>/read', methods=['POST'])
@token_required
def mark_message_read(message_id):
    """Mark a message as read"""
    db.mark_message_read(message_id)
    return jsonify({'message': 'Message marked as read'})


@app.route('/api/messages/unread-count', methods=['GET'])
@token_required
def get_unread_count():
    """Get count of unread messages"""
    user = request.current_user
    count = db.get_unread_count(user['id'])
    return jsonify({'unread_count': count})


# ============ Time Tracking Endpoints ============

@app.route('/api/time-entries', methods=['GET'])
@token_required
def get_time_entries():
    """Get time entries with filters"""
    user = request.current_user
    user_id = request.args.get('user_id', user['id'])
    
    # Non-admins can only see their own entries
    if user['role'] not in ['admin', 'physician'] and user_id != user['id']:
        user_id = user['id']
    
    entries = db.get_time_entries(
        user_id=user_id,
        patient_id=request.args.get('patient_id'),
        start_date=request.args.get('start_date'),
        end_date=request.args.get('end_date'),
        status=request.args.get('status')
    )
    return jsonify({'time_entries': entries})


@app.route('/api/time-entries/clock-in', methods=['POST'])
@token_required
@role_required('caregiver')
def clock_in():
    """Clock in for a shift"""
    user = request.current_user
    data = request.json or {}
    
    # Check if already clocked in
    active = db.get_active_time_entry(user['id'])
    if active:
        return jsonify({'error': 'Already clocked in', 'active_entry': active}), 400
    
    entry_id = db.clock_in(
        user['id'],
        patient_id=data.get('patient_id'),
        shift_id=data.get('shift_id'),
        location=data.get('location'),
        notes=data.get('notes')
    )
    audit_log(user['id'], 'clock_in', 'time_entry', entry_id)
    return jsonify({'message': 'Clocked in successfully', 'entry_id': entry_id}), 201


@app.route('/api/time-entries/clock-out', methods=['POST'])
@token_required
@role_required('caregiver')
def clock_out():
    """Clock out from current shift"""
    user = request.current_user
    data = request.json or {}
    
    active = db.get_active_time_entry(user['id'])
    if not active:
        return jsonify({'error': 'Not currently clocked in'}), 400
    
    db.clock_out(
        active['id'],
        location=data.get('location'),
        notes=data.get('notes')
    )
    audit_log(user['id'], 'clock_out', 'time_entry', active['id'])
    return jsonify({'message': 'Clocked out successfully', 'entry_id': active['id']})


@app.route('/api/time-entries/status', methods=['GET'])
@token_required
def get_time_entry_status():
    """Get current clock-in status"""
    user = request.current_user
    active = db.get_active_time_entry(user['id'])
    return jsonify({'is_clocked_in': active is not None, 'active_entry': active})


# ============ Care Plan Endpoints ============

@app.route('/api/care-plans', methods=['GET'])
@token_required
def get_care_plans():
    """Get care plans"""
    patient_id = request.args.get('patient_id')
    status = request.args.get('status')
    plans = db.get_care_plans(patient_id=patient_id, status=status)
    return jsonify({'care_plans': plans})


@app.route('/api/care-plans', methods=['POST'])
@token_required
@role_required('physician', 'admin')
def create_care_plan():
    """Create a new care plan"""
    user = request.current_user
    data = request.json
    
    if 'patient_id' not in data or 'name' not in data:
        return jsonify({'error': 'patient_id and name are required'}), 400
    
    plan_id = db.create_care_plan(
        data['patient_id'], data['name'], user['id'],
        template_id=data.get('template_id'),
        description=data.get('description'),
        start_date=data.get('start_date'),
        end_date=data.get('end_date'),
        status=data.get('status', 'draft'),
        goals=data.get('goals'),
        interventions=data.get('interventions'),
        review_date=data.get('review_date'),
        notes=data.get('notes')
    )
    audit_log(user['id'], 'care_plan_created', 'care_plan', plan_id)
    return jsonify({'message': 'Care plan created', 'care_plan_id': plan_id}), 201


# ============ Care Task Endpoints ============

@app.route('/api/care-tasks', methods=['GET'])
@token_required
def get_care_tasks():
    """Get care tasks"""
    user = request.current_user
    patient_id = request.args.get('patient_id')
    assigned_to = request.args.get('assigned_to')
    status = request.args.get('status')
    due_date = request.args.get('due_date')
    
    # Caregivers see tasks assigned to them by default
    if user['role'] == 'caregiver' and not assigned_to and not patient_id:
        assigned_to = user['id']
    
    tasks = db.get_care_tasks(
        patient_id=patient_id,
        assigned_to=assigned_to,
        status=status,
        due_date=due_date
    )
    return jsonify({'care_tasks': tasks})


@app.route('/api/care-tasks', methods=['POST'])
@token_required
@role_required('physician', 'admin', 'caregiver')
def create_care_task():
    """Create a care task"""
    user = request.current_user
    data = request.json
    
    if 'patient_id' not in data or 'title' not in data:
        return jsonify({'error': 'patient_id and title are required'}), 400
    
    task_id = db.create_care_task(
        data['patient_id'], data['title'],
        care_plan_id=data.get('care_plan_id'),
        assigned_to=data.get('assigned_to'),
        description=data.get('description'),
        category=data.get('category'),
        priority=data.get('priority', 'normal'),
        frequency=data.get('frequency'),
        scheduled_time=data.get('scheduled_time'),
        due_date=data.get('due_date'),
        verification_required=data.get('verification_required', 0)
    )
    audit_log(user['id'], 'care_task_created', 'care_task', task_id)
    return jsonify({'message': 'Task created', 'task_id': task_id}), 201


@app.route('/api/care-tasks/<task_id>/complete', methods=['POST'])
@token_required
def complete_care_task(task_id):
    """Mark a care task as completed"""
    user = request.current_user
    data = request.json or {}
    db.complete_care_task(task_id, user['id'], notes=data.get('notes'))
    audit_log(user['id'], 'care_task_completed', 'care_task', task_id)
    return jsonify({'message': 'Task completed'})


# ============ ADL Log Endpoints ============

@app.route('/api/patients/<patient_id>/adl-logs', methods=['GET'])
@token_required
def get_adl_logs(patient_id):
    """Get ADL logs for a patient"""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = int(request.args.get('limit', 30))
    logs = db.get_adl_logs(patient_id, start_date=start_date, end_date=end_date, limit=limit)
    return jsonify({'adl_logs': logs})


@app.route('/api/patients/<patient_id>/adl-logs', methods=['POST'])
@token_required
@role_required('caregiver')
def create_adl_log(patient_id):
    """Create an ADL log entry"""
    user = request.current_user
    data = request.json
    
    log_id = db.create_adl_log(
        patient_id, user['id'], data.get('log_date', datetime.now().strftime('%Y-%m-%d')),
        bathing=data.get('bathing'),
        dressing=data.get('dressing'),
        grooming=data.get('grooming'),
        toileting=data.get('toileting'),
        transferring=data.get('transferring'),
        ambulation=data.get('ambulation'),
        feeding=data.get('feeding'),
        continence=data.get('continence'),
        notes=data.get('notes')
    )
    audit_log(user['id'], 'adl_log_created', 'adl_log', log_id)
    return jsonify({'message': 'ADL log created', 'log_id': log_id}), 201


# ============ Invoice Endpoints ============

@app.route('/api/invoices', methods=['GET'])
@token_required
def get_invoices():
    """Get invoices"""
    user = request.current_user
    patient_id = request.args.get('patient_id')
    status = request.args.get('status')
    
    # Family members can only see their patient's invoices
    if user['role'] == 'family' and not patient_id:
        return jsonify({'error': 'patient_id required for family members'}), 400
    
    invoices = db.get_invoices(patient_id=patient_id, status=status)
    return jsonify({'invoices': invoices})


@app.route('/api/invoices', methods=['POST'])
@token_required
@role_required('admin')
def create_invoice():
    """Create an invoice"""
    user = request.current_user
    data = request.json
    
    if 'patient_id' not in data or 'total' not in data:
        return jsonify({'error': 'patient_id and total are required'}), 400
    
    invoice_id, invoice_number = db.create_invoice(
        data['patient_id'], data['total'], user['id'],
        billing_period_start=data.get('billing_period_start'),
        billing_period_end=data.get('billing_period_end'),
        subtotal=data.get('subtotal'),
        tax=data.get('tax', 0),
        discount=data.get('discount', 0),
        status=data.get('status', 'draft'),
        due_date=data.get('due_date'),
        notes=data.get('notes')
    )
    audit_log(user['id'], 'invoice_created', 'invoice', invoice_id)
    return jsonify({'message': 'Invoice created', 'invoice_id': invoice_id, 'invoice_number': invoice_number}), 201


# ============ Dashboard Stats Endpoint ============

@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats():
    """Get dashboard statistics based on user role"""
    user = request.current_user
    stats = {}
    
    if user['role'] == 'caregiver':
        # Get caregiver-specific stats
        active_time = db.get_active_time_entry(user['id'])
        pending_tasks = db.get_care_tasks(assigned_to=user['id'], status='pending')
        unread_messages = db.get_unread_count(user['id'])
        
        stats = {
            'is_clocked_in': active_time is not None,
            'active_time_entry': active_time,
            'pending_tasks_count': len(pending_tasks),
            'pending_tasks': pending_tasks[:5],
            'unread_messages': unread_messages
        }
    elif user['role'] == 'admin':
        # Get admin stats
        stats = {
            'pending_invoices': len(db.get_invoices(status='pending')),
            'active_caregivers': len(db.get_time_entries(status='active')),
            'unread_messages': db.get_unread_count(user['id'])
        }
    else:
        stats = {
            'unread_messages': db.get_unread_count(user['id'])
        }
    
    return jsonify(stats)


# ============ User Settings Endpoints ============

@app.route('/api/change-password', methods=['POST'])
@token_required
def change_password():
    """Change user password"""
    user = request.current_user
    data = request.json
    
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Current and new passwords required'}), 400
    
    if len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    # Verify current password
    db_user = db.get_user(user['id'])
    if not db_user or not check_password_hash(db_user['password_hash'], current_password):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    # Update password
    new_hash = generate_password_hash(new_password)
    db.update_user(user['id'], password_hash=new_hash)
    audit_log(user['id'], 'password_changed', 'user', user['id'])
    
    return jsonify({'message': 'Password changed successfully'})


@app.route('/api/users/<user_id>', methods=['PUT'])
@token_required
def update_user_profile(user_id):
    """Update user profile"""
    current_user = request.current_user
    
    # Users can only update their own profile (unless admin)
    if current_user['id'] != user_id and current_user['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.json
    allowed_fields = ['full_name', 'email', 'phone', 'address', 
                      'emergency_contact', 'emergency_phone']
    
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if update_data:
        db.update_user(user_id, **update_data)
        audit_log(current_user['id'], 'user_updated', 'user', user_id)
    
    return jsonify({'message': 'Profile updated successfully'})


# ============ WebSocket Events ============

# Store connected clients by room
connected_clients = {}

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'status': 'connected', 'sid': request.sid})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")
    # Remove from all rooms
    for room_id in list(connected_clients.keys()):
        if request.sid in connected_clients.get(room_id, []):
            connected_clients[room_id].remove(request.sid)


@socketio.on('join_room')
def handle_join_room(data):
    """Join a specific room for targeted updates"""
    from flask_socketio import join_room
    room = data.get('room')
    if room:
        join_room(room)
        if room not in connected_clients:
            connected_clients[room] = []
        connected_clients[room].append(request.sid)
        logger.info(f"Client {request.sid} joined room: {room}")
        emit('room_joined', {'room': room})


@socketio.on('leave_room')
def handle_leave_room(data):
    """Leave a specific room"""
    from flask_socketio import leave_room
    room = data.get('room')
    if room:
        leave_room(room)
        if room in connected_clients and request.sid in connected_clients[room]:
            connected_clients[room].remove(request.sid)
        logger.info(f"Client {request.sid} left room: {room}")


@socketio.on('subscribe_patient')
def handle_subscribe_patient(data):
    """Subscribe to patient-specific updates"""
    from flask_socketio import join_room
    patient_id = data.get('patient_id')
    if patient_id:
        room = f"patient_{patient_id}"
        join_room(room)
        logger.info(f"Client subscribed to patient: {patient_id}")
        emit('subscribed', {'type': 'patient', 'id': patient_id})


@socketio.on('subscribe_alerts')
def handle_subscribe_alerts(data):
    """Subscribe to alert updates"""
    from flask_socketio import join_room
    user_id = data.get('user_id')
    if user_id:
        room = f"alerts_{user_id}"
        join_room(room)
        logger.info(f"Client subscribed to alerts for user: {user_id}")
        emit('subscribed', {'type': 'alerts', 'user_id': user_id})


@socketio.on('subscribe_shifts')
def handle_subscribe_shifts(data):
    """Subscribe to shift updates"""
    from flask_socketio import join_room
    user_id = data.get('user_id')
    if user_id:
        room = f"shifts_{user_id}"
        join_room(room)
        logger.info(f"Client subscribed to shifts for user: {user_id}")
        emit('subscribed', {'type': 'shifts', 'user_id': user_id})


def broadcast_vitals_update(patient_id, vitals):
    """Broadcast vitals update to subscribers"""
    room = f"patient_{patient_id}"
    socketio.emit('vitals_update', {
        'patient_id': patient_id,
        'vitals': vitals,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, room=room)
    # Also send to general dashboard
    socketio.emit('vitals_update', {
        'patient_id': patient_id,
        'vitals': vitals,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, room='dashboard')


def broadcast_alert(alert_data, target_user_ids=None):
    """Broadcast alert to specific users or all"""
    if target_user_ids:
        for user_id in target_user_ids:
            room = f"alerts_{user_id}"
            socketio.emit('new_alert', alert_data, room=room)
    socketio.emit('new_alert', alert_data, room='dashboard')


def broadcast_shift_update(shift_data, user_id=None):
    """Broadcast shift update"""
    if user_id:
        room = f"shifts_{user_id}"
        socketio.emit('shift_update', shift_data, room=room)
    socketio.emit('shift_update', shift_data, room='admin_shifts')


def broadcast_medication_administered(patient_id, medication_log):
    """Broadcast medication administration event"""
    room = f"patient_{patient_id}"
    socketio.emit('medication_administered', {
        'patient_id': patient_id,
        'medication_log': medication_log,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, room=room)


def broadcast_care_log_added(patient_id, care_log):
    """Broadcast new care log entry"""
    room = f"patient_{patient_id}"
    socketio.emit('care_log_added', {
        'patient_id': patient_id,
        'care_log': care_log,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, room=room)


def broadcast_emergency(patient_id, emergency_data):
    """Broadcast emergency alert to all relevant parties"""
    socketio.emit('emergency_alert', {
        'patient_id': patient_id,
        'data': emergency_data,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, room='dashboard')
    # Room for emergency responders
    socketio.emit('emergency_alert', {
        'patient_id': patient_id,
        'data': emergency_data,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }, room='emergency_responders')


if __name__ == '__main__':
    logger.info("Starting HealthSync API server...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)

