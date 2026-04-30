import os
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class MLAgent:
    def __init__(self, name: str, patient_id: str):
        self.name = name
        self.patient_id = patient_id
        self.vital_history = []
        self.sleep_model = None
        self.adherence_model = None
        self.anomaly_model = None
        self.vital_predictor = None
        self._initialize_models()
        logger.info(f"MLAgent {name} initialized for patient {patient_id}")

    def _initialize_models(self):
        """Initialize ML models - in production, load trained models"""
        os.makedirs("models", exist_ok=True)
        # Models would be loaded here in production
        # For now, we use simple heuristics
        logger.info("ML models initialized (using heuristics)")

    def predict_sleep_quality(self, data: pd.DataFrame) -> list:
        """Predict sleep quality based on duration and awakenings"""
        predictions = []
        for _, row in data.iterrows():
            duration = row.get("duration", 0)
            awakenings = row.get("awakenings", 0)
            if duration >= 7 and awakenings <= 2:
                predictions.append("good")
            elif duration >= 5:
                predictions.append("fair")
            else:
                predictions.append("poor")
        return predictions

    def predict_adherence(self, data: pd.DataFrame) -> list:
        """Predict medication adherence"""
        predictions = []
        for _, row in data.iterrows():
            missed_last = row.get("missed_last", 0)
            if missed_last == 0:
                predictions.append("taken")
            else:
                predictions.append("missed")
        return predictions

    def detect_anomalies(self, data: pd.DataFrame) -> str:
        """Detect anomalies in vital signs"""
        for _, row in data.iterrows():
            heart_rate = row.get("heart_rate", 0)
            respiratory_rate = row.get("respiratory_rate", 0)
            
            if heart_rate < 50 or heart_rate > 120:
                return f"Anomaly detected: Heart rate {heart_rate} BPM is abnormal"
            if respiratory_rate < 10 or respiratory_rate > 25:
                return f"Anomaly detected: Respiratory rate {respiratory_rate} is abnormal"
        return ""

    def update_vital_signs(self, data: dict):
        """Update vital signs history and check for anomalies"""
        self.vital_history.append(data)
        vital_df = pd.DataFrame([data])
        
        if "heart_rate" in data and "respiratory_rate" in data:
            anomaly = self.detect_anomalies(vital_df[["heart_rate", "respiratory_rate"]])
            if anomaly:
                logger.warning(f"Vital anomaly for {self.patient_id}: {anomaly}")
                return anomaly
        return None

    def get_vital_status(self) -> dict:
        """Get current vital status with predictions"""
        if not self.vital_history:
            return {
                "heart_rate": 72,
                "respiratory_rate": 16,
                "blood_pressure": "120/80",
                "next_heart_rate_pred": 72.0,
                "status": "No recent data"
            }
        
        last_vital = self.vital_history[-1]
        # Simple prediction: average of last few readings
        recent_hr = [v.get("heart_rate", 72) for v in self.vital_history[-5:]]
        next_hr_pred = sum(recent_hr) / len(recent_hr)
        
        return {
            "heart_rate": last_vital.get("heart_rate", 72),
            "respiratory_rate": last_vital.get("respiratory_rate", 16),
            "blood_pressure": last_vital.get("blood_pressure", "120/80"),
            "next_heart_rate_pred": float(next_hr_pred)
        }

    def retrain_models(self):
        """Retrain models with new data - placeholder for production"""
        logger.info("Model retraining triggered (placeholder)")
