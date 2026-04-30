import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class MedicationAgent:
    def __init__(self, name: str, patient_id: str):
        self.name = name
        self.patient_id = patient_id
        self.medications = []
        self.missed = []
        self.taken_count = 0
        self.total_count = 0
        logger.info(f"MedicationAgent {name} initialized for patient {patient_id}")

    def get_medication_status(self):
        adherence_rate = self.taken_count / max(self.total_count, 1)
        return {
            "medications": self.medications,
            "missed": self.missed,
            "adherence_rate": adherence_rate,
            "total_scheduled": self.total_count,
            "total_taken": self.taken_count
        }

    def update_medication_schedule(self, data: dict):
        medication = {
            "name": data.get("name"),
            "dose": data.get("dose"),
            "time": data.get("time"),
            "scheduled_at": datetime.now().isoformat()
        }
        self.medications.append(medication)
        self.total_count += 1
        logger.info(f"Medication scheduled for {self.patient_id}: {medication}")

    def mark_taken(self, medication_name: str):
        self.taken_count += 1
        logger.info(f"Medication {medication_name} marked as taken for {self.patient_id}")

    def mark_missed(self, medication_name: str):
        self.missed.append({"name": medication_name, "missed_at": datetime.now().isoformat()})
        logger.info(f"Medication {medication_name} marked as missed for {self.patient_id}")
