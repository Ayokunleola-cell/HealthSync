import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-32-chars-long123")
    AGENTVERSE_ENDPOINT = os.getenv("AGENTVERSE_ENDPOINT", "https://agentverse.ai/api")
    SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    EMAIL_FROM = os.getenv("EMAIL_FROM", "your-email@gmail.com")
    EMAIL_USER = os.getenv("EMAIL_USER", "your-email@gmail.com")
    EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "your-app-password")
    TWILIO_SID = os.getenv("TWILIO_SID", "your-twilio-sid")
    TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "your-twilio-auth-token")
    TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "+1234567890")
    TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "+1234567890")

settings = Settings()
