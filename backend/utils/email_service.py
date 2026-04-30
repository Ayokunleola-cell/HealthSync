"""
Email Service for HealthSync
Handles all email notifications including password resets, alerts, and reports
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
import os

logger = logging.getLogger(__name__)

# Email configuration from environment
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PASS = os.getenv('SMTP_PASS', '')
FROM_EMAIL = os.getenv('FROM_EMAIL', 'noreply@healthsync.com')
FROM_NAME = os.getenv('FROM_NAME', 'HealthSync')


def is_email_configured():
    """Check if email is properly configured"""
    return bool(SMTP_USER and SMTP_PASS)


def send_email(to_email, subject, body, html_body=None):
    """
    Send an email. Falls back to logging if SMTP not configured.
    """
    if not is_email_configured():
        logger.info(f"[EMAIL MOCK] To: {to_email}, Subject: {subject}")
        logger.info(f"[EMAIL MOCK] Body: {body[:200]}...")
        return True
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'{FROM_NAME} <{FROM_EMAIL}>'
        msg['To'] = to_email
        
        # Plain text version
        part1 = MIMEText(body, 'plain')
        msg.attach(part1)
        
        # HTML version (if provided)
        if html_body:
            part2 = MIMEText(html_body, 'html')
            msg.attach(part2)
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


# ============ Email Templates ============

def send_password_reset_email(to_email, username, reset_token, base_url='http://localhost:3000'):
    """Send password reset email"""
    reset_link = f"{base_url}/reset-password?token={reset_token}"
    
    subject = "HealthSync - Password Reset Request"
    
    body = f"""
Hello {username},

You have requested to reset your password for your HealthSync account.

Click the following link to reset your password:
{reset_link}

This link will expire in 1 hour.

If you did not request this password reset, please ignore this email or contact support.

Best regards,
The HealthSync Team
"""
    
    html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: #38a169; color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; background: #f7fafc; }}
        .button {{ display: inline-block; background: #38a169; color: white; padding: 12px 24px; 
                   text-decoration: none; border-radius: 6px; margin: 20px 0; }}
        .footer {{ padding: 20px; text-align: center; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>HealthSync</h1>
        </div>
        <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hello {username},</p>
            <p>You have requested to reset your password for your HealthSync account.</p>
            <p><a href="{reset_link}" class="button">Reset Your Password</a></p>
            <p>Or copy this link: {reset_link}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you did not request this password reset, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; HealthSync - Comprehensive Home Care Platform</p>
        </div>
    </div>
</body>
</html>
"""
    
    return send_email(to_email, subject, body, html_body)


def send_alert_email(to_email, alert_type, patient_name, message):
    """Send alert notification email"""
    subject = f"HealthSync Alert: {alert_type} - {patient_name}"
    
    priority_colors = {
        'urgent': '#e53e3e',
        'high': '#dd6b20',
        'normal': '#3182ce',
        'low': '#38a169'
    }
    
    body = f"""
HEALTH ALERT

Patient: {patient_name}
Alert Type: {alert_type}

{message}

Please log in to HealthSync to view more details and take appropriate action.

HealthSync Team
"""
    
    return send_email(to_email, subject, body)


def send_medication_reminder(to_email, patient_name, medication_name, scheduled_time):
    """Send medication reminder email"""
    subject = f"HealthSync Reminder: Medication for {patient_name}"
    
    body = f"""
MEDICATION REMINDER

Patient: {patient_name}
Medication: {medication_name}
Scheduled Time: {scheduled_time}

Please ensure this medication is administered as scheduled.

HealthSync Team
"""
    
    return send_email(to_email, subject, body)


def send_2fa_setup_email(to_email, username):
    """Send 2FA setup confirmation email"""
    subject = "HealthSync - Two-Factor Authentication Enabled"
    
    body = f"""
Hello {username},

Two-factor authentication has been successfully enabled on your HealthSync account.

From now on, you will need to enter a verification code from your authenticator app when logging in.

If you did not enable this feature, please contact support immediately.

HealthSync Team
"""
    
    return send_email(to_email, subject, body)


def send_welcome_email(to_email, username, role):
    """Send welcome email to new users"""
    subject = "Welcome to HealthSync!"
    
    role_descriptions = {
        'caregiver': 'manage patient care, track medications, and monitor vitals',
        'physician': 'review patient records, write notes, and manage appointments',
        'family': 'stay informed about your loved one\'s care',
        'patient': 'track your health, medications, and communicate with your care team',
        'admin': 'manage users and oversee the entire clinic'
    }
    
    role_desc = role_descriptions.get(role, 'use the platform')
    
    body = f"""
Welcome to HealthSync, {username}!

Your account has been created successfully.

As a {role}, you can now {role_desc}.

Log in at: http://localhost:3000/login

If you have any questions, please contact your administrator.

Best regards,
The HealthSync Team
"""
    
    return send_email(to_email, subject, body)
