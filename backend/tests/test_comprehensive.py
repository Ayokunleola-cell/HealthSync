"""
HealthSync Comprehensive Test Suite v2
Optimized to avoid rate limiting issues
"""

import requests
import json
import time

BASE_URL = "http://localhost:5000"

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
    
    def add(self, category, test_name, passed, message=""):
        status = "PASS" if passed else "FAIL"
        self.results.append({"category": category, "test": test_name, "status": status, "message": message})
        if passed:
            self.passed += 1
        else:
            self.failed += 1
        print(f"  [{status}] {test_name}" + (f" - {message}" if message and not passed else ""))
    
    def summary(self):
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total: {self.passed + self.failed} | Passed: {self.passed} | Failed: {self.failed}")
        rate = (self.passed/(self.passed+self.failed)*100) if (self.passed+self.failed) > 0 else 0
        print(f"Success Rate: {rate:.1f}%")
        print("="*60)

results = TestResults()

# ============ GET AUTH TOKEN FIRST ============
print("\n" + "="*60)
print("AUTHENTICATION")
print("="*60)

token = None
r = requests.post(f"{BASE_URL}/api/token", json={"username": "admin", "password": "admin123"})
if r.status_code == 200 and "access_token" in r.json():
    token = r.json()["access_token"]
    results.add("Auth", "Admin Login", True)
else:
    results.add("Auth", "Admin Login", False, f"Status: {r.status_code}")
    print("Cannot proceed without authentication!")
    exit(1)

def auth_headers():
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# ============ SECURITY TESTS ============
print("\n" + "="*60)
print("SECURITY TESTS")
print("="*60)

# Test API health
r = requests.get(f"{BASE_URL}/api/health")
results.add("Security", "API Health Check", r.status_code == 200)

# Test unauthenticated access
for endpoint in ["/api/patients", "/api/appointments", "/api/admin/users"]:
    r = requests.get(f"{BASE_URL}{endpoint}")
    results.add("Security", f"Auth Required: {endpoint}", r.status_code in [401, 403])

# Test invalid JWT
r = requests.get(f"{BASE_URL}/api/patients", headers={"Authorization": "Bearer invalid_token"})
results.add("Security", "Invalid JWT Rejected", r.status_code in [401, 403, 422])

# Test SQL injection (just one)
r = requests.post(f"{BASE_URL}/api/token", json={"username": "admin' OR '1'='1", "password": "test"})
results.add("Security", "SQL Injection Blocked", r.status_code in [400, 401, 403])

# ============ UNIT TESTS ============
print("\n" + "="*60)
print("UNIT TESTS - API Endpoints")
print("="*60)

# Patients
r = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers())
patient_check = r.status_code == 200 and "patients" in r.json()
results.add("Unit", "GET /api/patients", patient_check)
patients = r.json().get("patients", []) if r.status_code == 200 else []

# Appointments
r = requests.get(f"{BASE_URL}/api/appointments", headers=auth_headers())
results.add("Unit", "GET /api/appointments", r.status_code == 200)

# Shifts
r = requests.get(f"{BASE_URL}/api/shifts", headers=auth_headers())
results.add("Unit", "GET /api/shifts", r.status_code == 200)

# Documents
r = requests.get(f"{BASE_URL}/api/documents", headers=auth_headers())
results.add("Unit", "GET /api/documents", r.status_code == 200)

# Admin endpoints
r = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers())
results.add("Unit", "GET /api/admin/users", r.status_code == 200)

r = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=auth_headers())
results.add("Unit", "GET /api/admin/dashboard", r.status_code == 200)

r = requests.get(f"{BASE_URL}/api/admin/audit-logs", headers=auth_headers())
results.add("Unit", "GET /api/admin/audit-logs", r.status_code == 200)

# ============ AI ENDPOINT TESTS ============
print("\n" + "="*60)
print("AI ENDPOINT TESTS")
print("="*60)

r = requests.get(f"{BASE_URL}/api/ai/care-protocol/diabetes", headers=auth_headers())
results.add("AI", "Care Protocol (Diabetes)", r.status_code == 200 and "protocol" in r.json())

r = requests.post(f"{BASE_URL}/api/ai/drug-interactions", headers=auth_headers(),
    json={"medications": ["warfarin", "aspirin"]})
results.add("AI", "Drug Interaction Check", r.status_code == 200)
if r.status_code == 200:
    has_interaction = r.json().get("has_interactions", False)
    results.add("AI", "Drug Interaction Detected (warfarin+aspirin)", has_interaction == True)

r = requests.post(f"{BASE_URL}/api/ai/analyze-vitals", headers=auth_headers(),
    json={"heart_rate": 85, "blood_pressure": "120/80", "oxygen_saturation": 98})
results.add("AI", "Vital Analysis", r.status_code == 200 and "risk_level" in r.json())

r = requests.post(f"{BASE_URL}/api/ai/analyze-vitals", headers=auth_headers(),
    json={"heart_rate": 130, "blood_pressure": "190/110", "oxygen_saturation": 88})
if r.status_code == 200:
    risk = r.json().get("risk_level", "")
    results.add("AI", "Critical Vitals Detection", risk in ["moderate", "high"])

# ============ REGRESSION TESTS ============
print("\n" + "="*60)
print("REGRESSION TESTS")
print("="*60)

if patients:
    patient_id = patients[0]["id"]
    
    # Get patient medications
    r = requests.get(f"{BASE_URL}/api/patients/{patient_id}/medications", headers=auth_headers())
    results.add("Regression", "Get Patient Medications", r.status_code == 200)
    
    # Record vitals
    r = requests.post(f"{BASE_URL}/api/patients/{patient_id}/vitals", headers=auth_headers(),
        json={"heart_rate": 72, "blood_pressure": "118/76", "temperature": 98.6})
    results.add("Regression", "Record Patient Vitals", r.status_code in [200, 201])
    
    # Create appointment
    r = requests.post(f"{BASE_URL}/api/appointments", headers=auth_headers(),
        json={"patient_id": patient_id, "scheduled_at": "2026-01-20T14:00:00", "description": "Checkup"})
    results.add("Regression", "Create Appointment", r.status_code in [200, 201])
    
    # Get patient risk
    r = requests.get(f"{BASE_URL}/api/ai/patient-risk/{patient_id}", headers=auth_headers())
    results.add("Regression", "Patient Risk Assessment", r.status_code == 200)
    
    # Generate care note
    r = requests.post(f"{BASE_URL}/api/ai/generate-care-note", headers=auth_headers(),
        json={"patient_id": patient_id, "heart_rate": 72, "blood_pressure": "120/80",
              "observations": "Patient alert and comfortable"})
    results.add("Regression", "AI Care Note Generation", r.status_code == 200 and "care_note" in r.json())
else:
    results.add("Regression", "Patient Data Available", False, "No patients in system")

# ============ FUNCTIONALITY TESTS ============
print("\n" + "="*60)
print("FUNCTIONALITY TESTS")
print("="*60)

# Test different user logins
for username, password, role in [("sarah", "caregiver123", "caregiver"), ("drsmith", "doctor123", "physician")]:
    r = requests.post(f"{BASE_URL}/api/token", json={"username": username, "password": password})
    if r.status_code == 200:
        user_role = r.json().get("user", {}).get("role", "")
        results.add("Functional", f"Login as {role}", user_role == role)
    else:
        results.add("Functional", f"Login as {role}", False, f"Status: {r.status_code}")

# Test password reset flow with valid admin email
r = requests.post(f"{BASE_URL}/api/auth/forgot-password", headers={"Content-Type": "application/json"},
    json={"email": "admin@healthsync.com"})
results.add("Functional", "Password Reset Request", r.status_code == 200)

# Test 2FA setup
r = requests.post(f"{BASE_URL}/api/auth/setup-2fa", headers=auth_headers())
results.add("Functional", "2FA Setup Endpoint", r.status_code == 200 and "secret" in r.json())

# Test role-based access control
caregiver_login = requests.post(f"{BASE_URL}/api/token", json={"username": "sarah", "password": "caregiver123"})
if caregiver_login.status_code == 200:
    caregiver_token = caregiver_login.json()["access_token"]
    # Try admin endpoint with caregiver token
    r = requests.get(f"{BASE_URL}/api/admin/users", 
        headers={"Authorization": f"Bearer {caregiver_token}"})
    results.add("Functional", "RBAC: Caregiver denied admin access", r.status_code in [401, 403])

# ============ PRINT SUMMARY ============
results.summary()

if results.failed > 0:
    print("\nFAILED TESTS:")
    for r in results.results:
        if r["status"] == "FAIL":
            print(f"  - [{r['category']}] {r['test']}: {r['message']}")
