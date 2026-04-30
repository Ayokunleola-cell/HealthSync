"""
AI Service for HealthSync
Provides LLM integration, RAG pipeline, and AI-powered features
Supports Groq (fast, free tier) or OpenAI
"""

import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional
import hashlib

logger = logging.getLogger(__name__)

# Configuration - Groq is preferred (faster, free tier)
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
AI_MODEL = os.getenv('AI_MODEL', 'llama-3.3-70b-versatile')  # Groq model
USE_LOCAL_LLM = os.getenv('USE_LOCAL_LLM', 'false').lower() == 'true'


class AIService:
    """Main AI service for HealthSync"""
    
    def __init__(self):
        self.llm_client = None
        self.llm_provider = None
        self.embeddings_cache = {}
        self.knowledge_base = self._load_knowledge_base()
        self._initialize_llm()
        logger.info("AI Service initialized")
    
    def _initialize_llm(self):
        """Initialize LLM client - prefer Groq, fallback to OpenAI"""
        # Try Groq first (faster, free tier)
        if GROQ_API_KEY:
            try:
                from groq import Groq
                self.llm_client = Groq(api_key=GROQ_API_KEY)
                self.llm_provider = 'groq'
                logger.info("Groq LLM client initialized (model: llama-3.3-70b-versatile)")
                return
            except ImportError:
                logger.warning("Groq package not installed, trying OpenAI")
            except Exception as e:
                logger.warning(f"Groq init failed: {e}, trying OpenAI")
        
        # Fallback to OpenAI
        if OPENAI_API_KEY:
            try:
                import openai
                self.llm_client = openai.OpenAI(api_key=OPENAI_API_KEY)
                self.llm_provider = 'openai'
                logger.info("OpenAI client initialized")
                return
            except ImportError:
                logger.warning("OpenAI package not installed")
        
        logger.info("No LLM API key configured, using rule-based AI responses")
    
    def _load_knowledge_base(self) -> Dict:
        """Load care protocols and medical knowledge"""
        return {
            "care_protocols": {
                "alzheimers": {
                    "daily_care": [
                        "Maintain consistent daily routine",
                        "Use simple, clear communication",
                        "Ensure adequate hydration (8+ glasses/day)",
                        "Monitor for signs of confusion or agitation",
                        "Assist with medication reminders"
                    ],
                    "warning_signs": [
                        "Increased confusion or disorientation",
                        "Changes in eating or sleeping patterns",
                        "Mood swings or behavioral changes",
                        "Difficulty with familiar tasks"
                    ]
                },
                "diabetes": {
                    "daily_care": [
                        "Monitor blood glucose levels regularly",
                        "Ensure proper meal timing with medications",
                        "Check feet daily for wounds or sores",
                        "Encourage physical activity as tolerated"
                    ],
                    "warning_signs": [
                        "Blood glucose outside normal range",
                        "Signs of hypoglycemia (shakiness, sweating)",
                        "Wounds that don't heal",
                        "Changes in vision"
                    ]
                },
                "hypertension": {
                    "daily_care": [
                        "Monitor blood pressure twice daily",
                        "Ensure medication compliance",
                        "Limit sodium intake",
                        "Encourage stress management"
                    ],
                    "warning_signs": [
                        "Severe headache",
                        "Chest pain or shortness of breath",
                        "BP > 180/120 mmHg",
                        "Vision changes"
                    ]
                }
            },
            "drug_interactions": {
                "warfarin": ["aspirin", "ibuprofen", "vitamin_k", "ginkgo"],
                "metformin": ["alcohol", "contrast_dye"],
                "lisinopril": ["potassium_supplements", "nsaids"],
                "digoxin": ["amiodarone", "verapamil", "quinidine"]
            },
            "vital_ranges": {
                "heart_rate": {"low": 60, "high": 100, "critical_low": 50, "critical_high": 120},
                "blood_pressure_systolic": {"low": 90, "high": 140, "critical_low": 80, "critical_high": 180},
                "blood_pressure_diastolic": {"low": 60, "high": 90, "critical_low": 50, "critical_high": 120},
                "temperature": {"low": 97.0, "high": 99.5, "critical_low": 95.0, "critical_high": 103.0},
                "oxygen_saturation": {"low": 95, "high": 100, "critical_low": 90, "critical_high": 100}
            }
        }
    
    # ============ LLM Methods ============
    
    def _call_llm(self, prompt: str, system_prompt: str = None, max_tokens: int = 500) -> str:
        """Call LLM (Groq or OpenAI) with fallback to rule-based response"""
        if self.llm_client:
            try:
                messages = []
                if system_prompt:
                    messages.append({"role": "system", "content": system_prompt})
                messages.append({"role": "user", "content": prompt})
                
                # Both Groq and OpenAI use the same API interface
                response = self.llm_client.chat.completions.create(
                    model=AI_MODEL,
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=0.7
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"LLM call failed ({self.llm_provider}): {e}")
                return self._rule_based_response(prompt)
        else:
            return self._rule_based_response(prompt)
    
    def _rule_based_response(self, prompt: str) -> str:
        """Fallback rule-based AI responses when LLM not available"""
        prompt_lower = prompt.lower()
        
        if "care note" in prompt_lower or "summary" in prompt_lower:
            return "Based on today's observations, the patient appears stable. Continue current care plan with focus on medication adherence and hydration."
        
        if "recommendation" in prompt_lower:
            return "Recommendations: 1) Continue monitoring vitals twice daily. 2) Ensure medication compliance. 3) Encourage light physical activity. 4) Maintain consistent routine."
        
        if "risk" in prompt_lower:
            return "Current risk assessment: Moderate. Key factors: medication adherence, vital sign stability. Recommend close monitoring."
        
        return "AI analysis complete. Please consult care protocols for specific guidance."
    
    # ============ Care Notes AI ============
    
    def generate_care_note(self, patient_data: Dict) -> str:
        """Generate comprehensive care note from patient data"""
        system_prompt = """You are an experienced home care nurse writing clinical care notes.
Write concise, professional care notes based on the patient data provided.
Include observations, actions taken, patient response, and any concerns.
Use proper medical terminology but keep it readable."""
        
        prompt = f"""Generate a care note for the following patient data:

Patient: {patient_data.get('name', 'Unknown')}
Condition: {patient_data.get('condition', 'Not specified')}
Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}

Vitals:
- Heart Rate: {patient_data.get('heart_rate', 'N/A')} bpm
- Blood Pressure: {patient_data.get('blood_pressure', 'N/A')}
- Temperature: {patient_data.get('temperature', 'N/A')}°F
- O2 Saturation: {patient_data.get('oxygen_saturation', 'N/A')}%

Medications Given: {', '.join(patient_data.get('medications_given', [])) or 'None recorded'}
Meals: {patient_data.get('meals', 'Not recorded')}
Activities: {patient_data.get('activities', 'Not recorded')}
Sleep Quality: {patient_data.get('sleep_quality', 'Not recorded')}
Mood/Behavior: {patient_data.get('mood', 'Not recorded')}

Additional Observations: {patient_data.get('observations', 'None')}

Generate a structured care note including:
1. General Status
2. Vital Signs Assessment
3. Medication Adherence
4. Daily Activities
5. Concerns/Recommendations"""
        
        return self._call_llm(prompt, system_prompt, max_tokens=600)
    
    def summarize_daily_care(self, care_logs: List[Dict]) -> str:
        """Summarize multiple care logs into daily summary"""
        if not care_logs:
            return "No care logs recorded for today."
        
        logs_text = "\n".join([
            f"- {log.get('time', 'Unknown time')}: {log.get('activity', 'Activity')} - {log.get('notes', '')}"
            for log in care_logs
        ])
        
        prompt = f"""Summarize the following care activities into a brief daily summary:

{logs_text}

Provide a 3-4 sentence summary highlighting key events, patient status, and any concerns."""
        
        return self._call_llm(prompt, max_tokens=200)
    
    # ============ RAG / Knowledge Base ============
    
    def get_care_protocol(self, condition: str) -> Dict:
        """Get care protocol for a condition"""
        condition_key = condition.lower().replace("'s", "").replace(" ", "_").split("(")[0].strip()
        
        # Check knowledge base
        for key, protocol in self.knowledge_base["care_protocols"].items():
            if key in condition_key or condition_key in key:
                return protocol
        
        # Default generic protocol
        return {
            "daily_care": [
                "Monitor vital signs regularly",
                "Ensure medication compliance",
                "Maintain adequate hydration and nutrition",
                "Document any changes in condition"
            ],
            "warning_signs": [
                "Significant vital sign changes",
                "Changes in mental status",
                "New pain or discomfort",
                "Decreased appetite or fluid intake"
            ]
        }
    
    def check_drug_interactions(self, medications: List[str]) -> List[Dict]:
        """Check for potential drug interactions"""
        interactions = []
        med_lower = [m.lower() for m in medications]
        
        for drug, interacts_with in self.knowledge_base["drug_interactions"].items():
            if drug in med_lower:
                for interact in interacts_with:
                    if interact in med_lower:
                        interactions.append({
                            "drug1": drug,
                            "drug2": interact,
                            "severity": "moderate",
                            "recommendation": f"Monitor for interactions between {drug} and {interact}"
                        })
        
        return interactions
    
    def get_care_recommendation(self, patient_data: Dict, context: str = "") -> str:
        """Get AI-powered care recommendations"""
        condition = patient_data.get('condition', '')
        protocol = self.get_care_protocol(condition)
        
        system_prompt = """You are a clinical decision support system for home healthcare.
Provide evidence-based care recommendations based on patient data and care protocols.
Be specific and actionable. Prioritize safety."""
        
        prompt = f"""Patient: {patient_data.get('name', 'Unknown')}
Condition: {condition}
Recent Vitals: HR {patient_data.get('heart_rate', 'N/A')}, BP {patient_data.get('blood_pressure', 'N/A')}

Care Protocol Guidelines:
{json.dumps(protocol, indent=2)}

Context: {context or 'Routine care planning'}

Provide 3-5 specific, actionable care recommendations for today."""
        
        return self._call_llm(prompt, system_prompt, max_tokens=400)
    
    # ============ Predictive Alerts ============
    
    def analyze_vitals(self, vitals: Dict) -> Dict:
        """Analyze vitals and return risk assessment"""
        alerts = []
        risk_score = 0
        ranges = self.knowledge_base["vital_ranges"]
        
        # Heart rate check
        hr = vitals.get('heart_rate')
        if hr:
            if hr < ranges['heart_rate']['critical_low'] or hr > ranges['heart_rate']['critical_high']:
                alerts.append({"type": "critical", "message": f"Heart rate {hr} bpm is critical"})
                risk_score += 30
            elif hr < ranges['heart_rate']['low'] or hr > ranges['heart_rate']['high']:
                alerts.append({"type": "warning", "message": f"Heart rate {hr} bpm is outside normal range"})
                risk_score += 10
        
        # Blood pressure check
        bp = vitals.get('blood_pressure', '')
        if '/' in str(bp):
            try:
                systolic, diastolic = map(int, bp.split('/'))
                if systolic > ranges['blood_pressure_systolic']['critical_high']:
                    alerts.append({"type": "critical", "message": f"Blood pressure {bp} is critically high"})
                    risk_score += 30
                elif systolic > ranges['blood_pressure_systolic']['high']:
                    alerts.append({"type": "warning", "message": f"Blood pressure {bp} is elevated"})
                    risk_score += 10
            except ValueError:
                pass
        
        # Oxygen check
        o2 = vitals.get('oxygen_saturation')
        if o2:
            if o2 < ranges['oxygen_saturation']['critical_low']:
                alerts.append({"type": "critical", "message": f"Oxygen saturation {o2}% is critically low"})
                risk_score += 40
            elif o2 < ranges['oxygen_saturation']['low']:
                alerts.append({"type": "warning", "message": f"Oxygen saturation {o2}% is low"})
                risk_score += 15
        
        risk_level = "low" if risk_score < 20 else "moderate" if risk_score < 50 else "high"
        
        return {
            "risk_level": risk_level,
            "risk_score": min(risk_score, 100),
            "alerts": alerts,
            "recommendation": self._get_risk_recommendation(risk_level, alerts)
        }
    
    def _get_risk_recommendation(self, risk_level: str, alerts: List) -> str:
        """Get recommendation based on risk level"""
        if risk_level == "high":
            return "Immediate assessment required. Consider contacting physician or emergency services."
        elif risk_level == "moderate":
            return "Close monitoring recommended. Document observations and notify care team if condition worsens."
        else:
            return "Continue routine monitoring. No immediate concerns identified."
    
    def predict_patient_risk(self, patient_history: Dict) -> Dict:
        """Predict overall patient risk based on history"""
        risk_factors = []
        score = 0
        
        # Medication adherence
        adherence = patient_history.get('medication_adherence', 100)
        if adherence < 80:
            risk_factors.append("Low medication adherence")
            score += 20
        
        # Vital trends
        if patient_history.get('vital_anomalies', 0) > 2:
            risk_factors.append("Recent vital sign anomalies")
            score += 25
        
        # Missed appointments
        if patient_history.get('missed_appointments', 0) > 0:
            risk_factors.append("Missed appointments")
            score += 15
        
        # Falls history
        if patient_history.get('falls', 0) > 0:
            risk_factors.append("History of falls")
            score += 20
        
        return {
            "risk_score": min(score, 100),
            "risk_level": "low" if score < 30 else "moderate" if score < 60 else "high",
            "risk_factors": risk_factors,
            "recommendations": self._call_llm(
                f"Patient has these risk factors: {', '.join(risk_factors) or 'None'}. Provide 2-3 preventive care recommendations.",
                max_tokens=150
            ) if risk_factors else "Continue standard care protocols."
        }
    
    # ============ Video/Speech Processing ============
    
    def transcribe_notes(self, audio_text: str) -> Dict:
        """Process transcribed speech into structured notes"""
        prompt = f"""Convert the following spoken care notes into a structured format:

"{audio_text}"

Extract and format:
1. Patient observations
2. Actions taken
3. Concerns noted
4. Follow-up items

Return as structured text."""
        
        structured = self._call_llm(prompt, max_tokens=300)
        return {
            "original": audio_text,
            "structured": structured,
            "timestamp": datetime.now().isoformat()
        }
    
    def summarize_video_call(self, transcript: str) -> Dict:
        """Summarize a video call transcript"""
        prompt = f"""Summarize the following telehealth video call transcript:

{transcript[:2000]}

Provide:
1. Key Discussion Points (bullet points)
2. Patient Concerns Raised
3. Provider Recommendations
4. Follow-up Actions Required

Be concise but comprehensive."""
        
        summary = self._call_llm(prompt, max_tokens=400)
        return {
            "summary": summary,
            "timestamp": datetime.now().isoformat()
        }


# Singleton instance
ai_service = AIService()
