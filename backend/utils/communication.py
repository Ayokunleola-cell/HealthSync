import smtplib
from email.mime.text import MIMEText
import logging

logger = logging.getLogger(__name__)

def send_email(to_email: str, subject: str, body: str, settings):
    """Send an email using SMTP"""
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = to_email
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Email failed: {str(e)}")
        return False

def send_whatsapp(to_number: str, body: str, settings):
    """Send a WhatsApp message via Twilio"""
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_SID, settings.TWILIO_AUTH_TOKEN)
        message = client.messages.create(
            from_=f"whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}",
            body=body,
            to=f"whatsapp:{to_number}"
        )
        logger.info(f"WhatsApp sent to {to_number}: {message.sid}")
        return True
    except Exception as e:
        logger.error(f"WhatsApp failed: {str(e)}")
        return False

def make_call(to_number: str, message: str, settings):
    """Make a phone call via Twilio"""
    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_SID, settings.TWILIO_AUTH_TOKEN)
        call = client.calls.create(
            twiml=f'<Response><Say>{message}</Say></Response>',
            from_=settings.TWILIO_PHONE_NUMBER,
            to=to_number
        )
        logger.info(f"Call initiated to {to_number}: {call.sid}")
        return True
    except Exception as e:
        logger.error(f"Call failed: {str(e)}")
        return False
