import logging

logger = logging.getLogger(__name__)

class ReminderAgent:
    def __init__(self, name: str, patient_id: str):
        self.name = name
        self.patient_id = patient_id
        self.reminders = []
        logger.info(f"ReminderAgent {name} initialized for patient {patient_id}")

    def add_reminder(self, reminder_type: str, message: str, priority: str = "normal"):
        reminder = {
            "type": reminder_type,
            "message": message,
            "priority": priority,
            "patient_id": self.patient_id
        }
        self.reminders.append(reminder)
        logger.info(f"Reminder added for {self.patient_id}: {reminder}")
        return reminder

    def get_reminders(self):
        return self.reminders

    def send_reminder(self, reminder_type: str, message: str, priority: str = "normal"):
        """Send a reminder notification"""
        reminder = self.add_reminder(reminder_type, message, priority)
        logger.info(f"Reminder sent: {reminder}")
        return reminder
