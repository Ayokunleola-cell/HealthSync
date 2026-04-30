import logging

logger = logging.getLogger(__name__)

class SleepAgent:
    def __init__(self, name: str, patient_id: str):
        self.name = name
        self.patient_id = patient_id
        self.sleep_data = {
            "duration": 7.5,
            "awakenings": 2,
            "heart_rate": 62,
            "quality": "good"
        }
        logger.info(f"SleepAgent {name} initialized for patient {patient_id}")

    def get_sleep_status(self):
        return self.sleep_data

    def update_sleep_data(self, data: dict):
        self.sleep_data.update(data)
        # Determine quality based on duration and awakenings
        if self.sleep_data.get("duration", 0) >= 7 and self.sleep_data.get("awakenings", 0) <= 2:
            self.sleep_data["quality"] = "good"
        elif self.sleep_data.get("duration", 0) >= 5:
            self.sleep_data["quality"] = "fair"
        else:
            self.sleep_data["quality"] = "poor"
        logger.info(f"Sleep data updated for {self.patient_id}: {self.sleep_data}")
