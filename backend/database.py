import sqlite3
from datetime import datetime
import uuid

class Database:
    def __init__(self, db_path="healthsync.db"):
        self.db_path = db_path
        self.create_tables()
        self.seed_demo_data()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def create_tables(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Users table with roles and security fields
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT,
                full_name TEXT,
                role TEXT NOT NULL CHECK(role IN ('patient', 'caregiver', 'physician', 'family', 'admin')),
                phone TEXT,
                avatar_url TEXT,
                is_active INTEGER DEFAULT 1,
                totp_secret TEXT,
                totp_enabled INTEGER DEFAULT 0,
                failed_login_attempts INTEGER DEFAULT 0,
                locked_until TEXT,
                last_login TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Audit logs for HIPAA compliance
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                action TEXT NOT NULL,
                resource_type TEXT,
                resource_id TEXT,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Password reset tokens
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Login attempts tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS login_attempts (
                id TEXT PRIMARY KEY,
                username TEXT,
                ip_address TEXT,
                success INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Organizations table
        cursor.execute("""
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
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1
            )
        """)
        
        # Patients table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patients (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                name TEXT NOT NULL,
                date_of_birth TEXT,
                condition TEXT,
                condition_notes TEXT,
                emergency_contact_name TEXT,
                emergency_contact_phone TEXT,
                address TEXT,
                photo_url TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Patient access - links caregivers, physicians, family to patients
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patient_access (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                access_level TEXT DEFAULT 'view',
                relationship TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(patient_id, user_id)
            )
        """)
        
        # Appointments
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                physician_id TEXT,
                caregiver_id TEXT,
                title TEXT,
                description TEXT,
                scheduled_at TEXT NOT NULL,
                duration_mins INTEGER DEFAULT 30,
                status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
                appointment_type TEXT DEFAULT 'checkup',
                video_call_link TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (physician_id) REFERENCES users(id),
                FOREIGN KEY (caregiver_id) REFERENCES users(id)
            )
        """)
        
        # Vital signs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vitals (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                recorded_by TEXT,
                heart_rate INTEGER,
                blood_pressure_systolic INTEGER,
                blood_pressure_diastolic INTEGER,
                temperature REAL,
                oxygen_saturation INTEGER,
                respiratory_rate INTEGER,
                weight REAL,
                notes TEXT,
                recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (recorded_by) REFERENCES users(id)
            )
        """)
        
        # Medications
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS medications (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                name TEXT NOT NULL,
                dosage TEXT,
                frequency TEXT,
                time_of_day TEXT,
                instructions TEXT,
                prescribing_physician TEXT,
                start_date TEXT,
                end_date TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            )
        """)
        
        # Medication logs (tracking when medications are taken)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS medication_logs (
                id TEXT PRIMARY KEY,
                medication_id TEXT NOT NULL,
                patient_id TEXT NOT NULL,
                taken_at TEXT,
                status TEXT CHECK(status IN ('taken', 'missed', 'skipped')),
                notes TEXT,
                recorded_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (medication_id) REFERENCES medications(id),
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            )
        """)
        
        # Care logs (daily activities, notes from caregivers)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS care_logs (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                caregiver_id TEXT NOT NULL,
                log_type TEXT CHECK(log_type IN ('activity', 'meal', 'sleep', 'mood', 'incident', 'note')),
                title TEXT,
                details TEXT,
                recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (caregiver_id) REFERENCES users(id)
            )
        """)
        
        # Medical notes (from physicians)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS medical_notes (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                physician_id TEXT NOT NULL,
                note_type TEXT CHECK(note_type IN ('consultation', 'diagnosis', 'prescription', 'follow_up', 'general')),
                title TEXT,
                content TEXT,
                is_private INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (physician_id) REFERENCES users(id)
            )
        """)
        
        # Alerts/Notifications
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                patient_id TEXT,
                alert_type TEXT CHECK(alert_type IN ('medication', 'vital', 'appointment', 'emergency', 'system')),
                title TEXT,
                message TEXT,
                priority TEXT DEFAULT 'normal' CHECK(priority IN ('low', 'normal', 'high', 'urgent')),
                is_read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            )
        """)
        
        # Events (calendar events, general)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id TEXT,
                event_type TEXT,
                event_time TEXT,
                details TEXT,
                completed INTEGER DEFAULT 0,
                created_by TEXT,
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            )
        """)
        
        # Documents/file storage
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                patient_id TEXT,
                uploaded_by TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                storage_path TEXT NOT NULL,
                category TEXT CHECK(category IN ('prescription', 'lab_result', 'care_plan', 'insurance', 'consent', 'other')),
                description TEXT,
                is_private INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (uploaded_by) REFERENCES users(id)
            )
        """)
        
        # Shift scheduling for caregivers and physicians
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shifts (
                id TEXT PRIMARY KEY,
                staff_id TEXT NOT NULL,
                staff_type TEXT NOT NULL CHECK(staff_type IN ('caregiver', 'physician')),
                patient_id TEXT NOT NULL,
                shift_date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
                check_in_time TEXT,
                check_out_time TEXT,
                check_in_location TEXT,
                check_out_location TEXT,
                actual_hours REAL,
                notes TEXT,
                created_by TEXT,
                approved_by TEXT,
                approved_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT,
                FOREIGN KEY (staff_id) REFERENCES users(id),
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            )
        """)
        
        # Add legacy support column if not exists (for migration)
        try:
            cursor.execute("ALTER TABLE shifts ADD COLUMN staff_id TEXT")
        except: pass
        try:
            cursor.execute("ALTER TABLE shifts ADD COLUMN staff_type TEXT DEFAULT 'caregiver'")
        except: pass
        
        # Notification preferences
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_preferences (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL UNIQUE,
                email_alerts INTEGER DEFAULT 1,
                email_reminders INTEGER DEFAULT 1,
                email_reports INTEGER DEFAULT 0,
                push_enabled INTEGER DEFAULT 1,
                quiet_hours_start TEXT,
                quiet_hours_end TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        # Video call scheduling
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS video_calls (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                scheduled_by TEXT NOT NULL,
                scheduled_with TEXT,
                scheduled_at TEXT NOT NULL,
                duration_minutes INTEGER DEFAULT 30,
                title TEXT,
                description TEXT,
                status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'missed')),
                meeting_link TEXT,
                reminder_sent INTEGER DEFAULT 0,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (scheduled_by) REFERENCES users(id),
                FOREIGN KEY (scheduled_with) REFERENCES users(id)
            )
        """)
        
        # Prescriptions (detailed medication prescriptions from physicians)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prescriptions (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                physician_id TEXT NOT NULL,
                medication_name TEXT NOT NULL,
                dosage TEXT,
                frequency TEXT,
                duration TEXT,
                quantity INTEGER,
                refills_allowed INTEGER DEFAULT 0,
                refills_used INTEGER DEFAULT 0,
                instructions TEXT,
                reason TEXT,
                start_date TEXT,
                end_date TEXT,
                status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'discontinued', 'expired')),
                pharmacy_notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (physician_id) REFERENCES users(id)
            )
        """)
        
        # Diagnoses and test results
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS diagnoses (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                physician_id TEXT NOT NULL,
                diagnosis_type TEXT CHECK(diagnosis_type IN ('condition', 'test_result', 'lab_work', 'imaging', 'assessment')),
                title TEXT NOT NULL,
                description TEXT,
                icd_code TEXT,
                severity TEXT CHECK(severity IN ('mild', 'moderate', 'severe', 'critical')),
                test_name TEXT,
                test_results TEXT,
                test_date TEXT,
                normal_range TEXT,
                is_abnormal INTEGER DEFAULT 0,
                follow_up_required INTEGER DEFAULT 0,
                follow_up_date TEXT,
                notes TEXT,
                attachments TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (physician_id) REFERENCES users(id)
            )
        """)
        
        # Consultations (visit/encounter records)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS consultations (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                physician_id TEXT NOT NULL,
                consultation_type TEXT CHECK(consultation_type IN ('in_person', 'video_call', 'phone', 'follow_up', 'emergency')),
                visit_date TEXT NOT NULL,
                chief_complaint TEXT,
                present_illness TEXT,
                physical_examination TEXT,
                assessment TEXT,
                treatment_plan TEXT,
                recommendations TEXT,
                follow_up_instructions TEXT,
                next_appointment TEXT,
                duration_minutes INTEGER,
                video_call_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (physician_id) REFERENCES users(id),
                FOREIGN KEY (video_call_id) REFERENCES video_calls(id)
            )
        """)
        
        # Patient issues and concerns
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patient_issues (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                reported_by TEXT NOT NULL,
                issue_type TEXT CHECK(issue_type IN ('symptom', 'concern', 'side_effect', 'emergency', 'behavior', 'other')),
                title TEXT NOT NULL,
                description TEXT,
                severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'urgent')),
                onset_date TEXT,
                status TEXT DEFAULT 'open' CHECK(status IN ('open', 'investigating', 'resolved', 'ongoing')),
                resolution TEXT,
                resolved_by TEXT,
                resolved_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (reported_by) REFERENCES users(id),
                FOREIGN KEY (resolved_by) REFERENCES users(id)
            )
        """)
        
        # Video call notes and transcripts
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS video_call_notes (
                id TEXT PRIMARY KEY,
                video_call_id TEXT NOT NULL,
                patient_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                note_type TEXT CHECK(note_type IN ('summary', 'transcript', 'action_item', 'observation')),
                content TEXT NOT NULL,
                timestamp_start TEXT,
                timestamp_end TEXT,
                is_important INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (video_call_id) REFERENCES video_calls(id),
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        """)
        
        # Caregiver daily reports
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS caregiver_daily_reports (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                caregiver_id TEXT NOT NULL,
                report_date TEXT NOT NULL,
                shift_id TEXT,
                overall_status TEXT CHECK(overall_status IN ('excellent', 'good', 'fair', 'poor', 'critical')),
                mood_assessment TEXT,
                appetite TEXT CHECK(appetite IN ('excellent', 'good', 'fair', 'poor', 'none')),
                sleep_quality TEXT CHECK(sleep_quality IN ('excellent', 'good', 'fair', 'poor', 'none')),
                mobility_status TEXT,
                pain_level INTEGER CHECK(pain_level BETWEEN 0 AND 10),
                activities_completed TEXT,
                meals_given TEXT,
                medications_administered TEXT,
                vital_signs_summary TEXT,
                incidents TEXT,
                concerns TEXT,
                recommendations TEXT,
                family_communication TEXT,
                next_shift_notes TEXT,
                attachments TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (caregiver_id) REFERENCES users(id),
                FOREIGN KEY (shift_id) REFERENCES shifts(id)
            )
        """)
        
        # Doctor/Physician reports
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS doctor_reports (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                physician_id TEXT NOT NULL,
                report_type TEXT CHECK(report_type IN ('progress', 'assessment', 'discharge', 'referral', 'consultation', 'follow_up')),
                report_date TEXT NOT NULL,
                visit_type TEXT CHECK(visit_type IN ('in_person', 'video', 'phone', 'review')),
                chief_complaint TEXT,
                history_of_present_illness TEXT,
                review_of_systems TEXT,
                physical_exam TEXT,
                current_medications TEXT,
                allergies TEXT,
                diagnosis TEXT,
                icd_codes TEXT,
                assessment TEXT,
                treatment_plan TEXT,
                prescriptions_issued TEXT,
                tests_ordered TEXT,
                referrals TEXT,
                patient_education TEXT,
                follow_up_plan TEXT,
                prognosis TEXT,
                restrictions TEXT,
                work_status TEXT,
                caregiver_instructions TEXT,
                family_instructions TEXT,
                attachments TEXT,
                is_signed INTEGER DEFAULT 0,
                signed_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (physician_id) REFERENCES users(id)
            )
        """)
        
        # Documents table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                patient_id TEXT,
                uploaded_by TEXT NOT NULL,
                filename TEXT NOT NULL,
                original_filename TEXT,
                file_type TEXT,
                file_size INTEGER,
                category TEXT CHECK(category IN ('medical', 'legal', 'insurance', 'identification', 'consent', 'care_plan', 'report', 'photo', 'other')),
                description TEXT,
                tags TEXT,
                expiration_date TEXT,
                is_confidential INTEGER DEFAULT 0,
                version INTEGER DEFAULT 1,
                parent_document_id TEXT,
                signed_by TEXT,
                signed_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (uploaded_by) REFERENCES users(id),
                FOREIGN KEY (signed_by) REFERENCES users(id)
            )
        """)
        
        # Messages table for secure messaging
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                sender_id TEXT NOT NULL,
                recipient_id TEXT,
                thread_id TEXT,
                patient_id TEXT,
                subject TEXT,
                content TEXT NOT NULL,
                message_type TEXT CHECK(message_type IN ('direct', 'group', 'announcement', 'urgent')) DEFAULT 'direct',
                priority TEXT CHECK(priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
                is_read INTEGER DEFAULT 0,
                read_at TEXT,
                attachments TEXT,
                is_deleted INTEGER DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id),
                FOREIGN KEY (recipient_id) REFERENCES users(id),
                FOREIGN KEY (patient_id) REFERENCES patients(id)
            )
        """)
        
        # Message threads for organizing conversations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS message_threads (
                id TEXT PRIMARY KEY,
                title TEXT,
                patient_id TEXT,
                created_by TEXT NOT NULL,
                thread_type TEXT CHECK(thread_type IN ('direct', 'group', 'care_team')) DEFAULT 'direct',
                participants TEXT,
                is_archived INTEGER DEFAULT 0,
                last_message_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        """)
        
        # Time entries for clock in/out tracking
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS time_entries (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                patient_id TEXT,
                shift_id TEXT,
                clock_in TEXT NOT NULL,
                clock_out TEXT,
                clock_in_location TEXT,
                clock_out_location TEXT,
                clock_in_verified INTEGER DEFAULT 0,
                clock_out_verified INTEGER DEFAULT 0,
                break_start TEXT,
                break_end TEXT,
                total_hours REAL,
                overtime_hours REAL DEFAULT 0,
                status TEXT CHECK(status IN ('active', 'completed', 'pending_approval', 'approved', 'rejected')) DEFAULT 'active',
                approved_by TEXT,
                approved_at TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (shift_id) REFERENCES shifts(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            )
        """)
        
        # Care plan templates
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS care_plan_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT CHECK(category IN ('general', 'dementia', 'diabetes', 'cardiac', 'respiratory', 'mobility', 'wound_care', 'hospice', 'pediatric', 'mental_health', 'custom')),
                created_by TEXT,
                is_active INTEGER DEFAULT 1,
                tasks TEXT,
                adl_checklist TEXT,
                medications_guidance TEXT,
                vitals_schedule TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        """)
        
        # Patient care plans (instances of templates)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS patient_care_plans (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                template_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                start_date TEXT,
                end_date TEXT,
                status TEXT CHECK(status IN ('draft', 'active', 'on_hold', 'completed', 'discontinued')) DEFAULT 'draft',
                created_by TEXT NOT NULL,
                approved_by TEXT,
                approved_at TEXT,
                goals TEXT,
                interventions TEXT,
                review_date TEXT,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (template_id) REFERENCES care_plan_templates(id),
                FOREIGN KEY (created_by) REFERENCES users(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            )
        """)
        
        # Care tasks (individual tasks within a care plan)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS care_tasks (
                id TEXT PRIMARY KEY,
                care_plan_id TEXT,
                patient_id TEXT NOT NULL,
                assigned_to TEXT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT CHECK(category IN ('adl', 'medication', 'vitals', 'exercise', 'nutrition', 'therapy', 'monitoring', 'communication', 'other')),
                priority TEXT CHECK(priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
                frequency TEXT,
                scheduled_time TEXT,
                due_date TEXT,
                status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')) DEFAULT 'pending',
                completed_by TEXT,
                completed_at TEXT,
                completion_notes TEXT,
                verification_required INTEGER DEFAULT 0,
                verified_by TEXT,
                verified_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (care_plan_id) REFERENCES patient_care_plans(id),
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (assigned_to) REFERENCES users(id),
                FOREIGN KEY (completed_by) REFERENCES users(id),
                FOREIGN KEY (verified_by) REFERENCES users(id)
            )
        """)
        
        # ADL (Activities of Daily Living) logs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS adl_logs (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                caregiver_id TEXT NOT NULL,
                log_date TEXT NOT NULL,
                bathing TEXT CHECK(bathing IN ('independent', 'supervision', 'minimal_assist', 'moderate_assist', 'maximal_assist', 'total_assist', 'not_done')),
                dressing TEXT CHECK(dressing IN ('independent', 'supervision', 'minimal_assist', 'moderate_assist', 'maximal_assist', 'total_assist', 'not_done')),
                grooming TEXT CHECK(grooming IN ('independent', 'supervision', 'minimal_assist', 'moderate_assist', 'maximal_assist', 'total_assist', 'not_done')),
                toileting TEXT CHECK(toileting IN ('independent', 'supervision', 'minimal_assist', 'moderate_assist', 'maximal_assist', 'total_assist', 'not_done')),
                transferring TEXT CHECK(transferring IN ('independent', 'supervision', 'minimal_assist', 'moderate_assist', 'maximal_assist', 'total_assist', 'not_done')),
                ambulation TEXT CHECK(ambulation IN ('independent', 'supervision', 'minimal_assist', 'moderate_assist', 'maximal_assist', 'total_assist', 'not_done', 'wheelchair', 'bedbound')),
                feeding TEXT CHECK(feeding IN ('independent', 'supervision', 'minimal_assist', 'moderate_assist', 'maximal_assist', 'total_assist', 'tube_feeding')),
                continence TEXT CHECK(continence IN ('continent', 'occasional_incontinence', 'frequent_incontinence', 'incontinent', 'catheter')),
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (caregiver_id) REFERENCES users(id)
            )
        """)
        
        # Invoices table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                patient_id TEXT NOT NULL,
                invoice_number TEXT UNIQUE NOT NULL,
                billing_period_start TEXT,
                billing_period_end TEXT,
                subtotal REAL DEFAULT 0,
                tax REAL DEFAULT 0,
                discount REAL DEFAULT 0,
                total REAL NOT NULL,
                status TEXT CHECK(status IN ('draft', 'pending', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')) DEFAULT 'draft',
                due_date TEXT,
                paid_date TEXT,
                paid_amount REAL,
                payment_method TEXT,
                notes TEXT,
                created_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        """)
        
        # Invoice line items
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS invoice_items (
                id TEXT PRIMARY KEY,
                invoice_id TEXT NOT NULL,
                description TEXT NOT NULL,
                quantity REAL DEFAULT 1,
                unit_price REAL NOT NULL,
                total REAL NOT NULL,
                service_date TEXT,
                service_type TEXT,
                caregiver_id TEXT,
                time_entry_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (invoice_id) REFERENCES invoices(id),
                FOREIGN KEY (caregiver_id) REFERENCES users(id),
                FOREIGN KEY (time_entry_id) REFERENCES time_entries(id)
            )
        """)
        
        conn.commit()
        conn.close()



    def seed_demo_data(self):
        """Seed demo data for testing"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Check if demo data exists
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] > 0:
            conn.close()
            return
        
        # Create demo users
        users = [
            ('usr_admin1', 'admin', 'admin123', 'admin@healthsync.com', 'Clinic Admin', 'admin', '555-0100'),
            ('usr_patient1', 'margaret', 'patient123', 'margaret@email.com', 'Margaret Johnson', 'patient', '555-0101'),
            ('usr_caregiver1', 'sarah', 'caregiver123', 'sarah@email.com', 'Sarah Wilson', 'caregiver', '555-0102'),
            ('usr_physician1', 'drsmith', 'doctor123', 'drsmith@clinic.com', 'Dr. James Smith', 'physician', '555-0103'),
            ('usr_family1', 'michael', 'family123', 'michael@email.com', 'Michael Johnson', 'family', '555-0104'),
        ]
        
        for user in users:
            cursor.execute("""
                INSERT INTO users (id, username, password, email, full_name, role, phone)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, user)
        
        # Create demo patient
        cursor.execute("""
            INSERT INTO patients (id, user_id, name, date_of_birth, condition, condition_notes, 
                                  emergency_contact_name, emergency_contact_phone, address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            'pat_001', 'usr_patient1', 'Margaret Johnson', '1945-03-15', 
            'Alzheimer\'s Disease (Early Stage)', 
            'Diagnosed 2024. Mild cognitive impairment. Requires medication reminders and daily supervision.',
            'Michael Johnson (Son)', '555-0104', 
            '123 Oak Street, Springfield, IL 62701'
        ))
        
        # Link caregivers, physician, family to patient
        access_records = [
            ('acc_001', 'pat_001', 'usr_caregiver1', 'full', 'Primary Caregiver'),
            ('acc_002', 'pat_001', 'usr_physician1', 'medical', 'Primary Physician'),
            ('acc_003', 'pat_001', 'usr_family1', 'view', 'Son'),
        ]
        
        for access in access_records:
            cursor.execute("""
                INSERT INTO patient_access (id, patient_id, user_id, access_level, relationship)
                VALUES (?, ?, ?, ?, ?)
            """, access)
        
        # Add medications
        medications = [
            ('med_001', 'pat_001', 'Donepezil', '10mg', 'Once daily', 'Morning', 
             'Take with breakfast', 'Dr. James Smith', '2024-01-01', None),
            ('med_002', 'pat_001', 'Memantine', '10mg', 'Twice daily', 'Morning, Evening',
             'Take with food', 'Dr. James Smith', '2024-01-01', None),
            ('med_003', 'pat_001', 'Lisinopril', '5mg', 'Once daily', 'Morning',
             'For blood pressure', 'Dr. James Smith', '2024-01-01', None),
        ]
        
        for med in medications:
            cursor.execute("""
                INSERT INTO medications (id, patient_id, name, dosage, frequency, time_of_day,
                                        instructions, prescribing_physician, start_date, end_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, med)
        
        # Add sample vitals
        cursor.execute("""
            INSERT INTO vitals (id, patient_id, recorded_by, heart_rate, blood_pressure_systolic,
                               blood_pressure_diastolic, temperature, oxygen_saturation, respiratory_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('vit_001', 'pat_001', 'usr_caregiver1', 72, 128, 82, 98.4, 97, 16))
        
        # Add sample appointment
        cursor.execute("""
            INSERT INTO appointments (id, patient_id, physician_id, caregiver_id, title, 
                                      scheduled_at, duration_mins, status, appointment_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ('apt_001', 'pat_001', 'usr_physician1', 'usr_caregiver1', 
              'Monthly Check-up', '2026-01-15T10:00:00', 30, 'scheduled', 'checkup'))
        
        conn.commit()
        conn.close()

    # ============ User Methods ============
    
    def get_user(self, username):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def get_user_by_id(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def create_user(self, username, password, email, full_name, role, phone=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        user_id = f"usr_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO users (id, username, password, email, full_name, role, phone)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, username, password, email, full_name, role, phone))
        conn.commit()
        conn.close()
        return user_id
    
    # ============ Admin Methods ============
    
    def get_all_users(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, email, full_name, role, phone, is_active, created_at 
            FROM users ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def update_user(self, user_id, **kwargs):
        conn = self.get_connection()
        cursor = conn.cursor()
        allowed = ['email', 'full_name', 'role', 'phone', 'is_active', 'password']
        updates = [(k, v) for k, v in kwargs.items() if k in allowed and v is not None]
        if updates:
            set_clause = ', '.join([f"{k} = ?" for k, v in updates])
            values = [v for k, v in updates] + [user_id]
            cursor.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values)
            conn.commit()
        conn.close()
        return True
    
    def delete_user(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
        conn.close()
        return True
    
    def get_admin_stats(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        stats = {}
        cursor.execute("SELECT role, COUNT(*) as count FROM users GROUP BY role")
        stats['users_by_role'] = {row['role']: row['count'] for row in cursor.fetchall()}
        cursor.execute("SELECT COUNT(*) as count FROM patients")
        stats['total_patients'] = cursor.fetchone()['count']
        cursor.execute("SELECT COUNT(*) as count FROM appointments WHERE status = 'scheduled'")
        stats['active_appointments'] = cursor.fetchone()['count']
        cursor.execute("SELECT COUNT(*) as count FROM alerts WHERE is_read = 0")
        stats['unread_alerts'] = cursor.fetchone()['count']
        conn.close()
        return stats
    
    # ============ Audit Logging Methods ============
    
    def log_audit(self, user_id, action, resource_type=None, resource_id=None, 
                  details=None, ip_address=None, user_agent=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        log_id = f"audit_{uuid.uuid4().hex[:12]}"
        cursor.execute("""
            INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, 
                                   details, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (log_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent))
        conn.commit()
        conn.close()
        return log_id
    
    def get_audit_logs(self, user_id=None, action=None, limit=100):
        conn = self.get_connection()
        cursor = conn.cursor()
        query = "SELECT * FROM audit_logs WHERE 1=1"
        params = []
        if user_id:
            query += " AND user_id = ?"
            params.append(user_id)
        if action:
            query += " AND action = ?"
            params.append(action)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ============ Password Reset Methods ============
    
    def create_password_reset_token(self, user_id, token, expires_at):
        conn = self.get_connection()
        cursor = conn.cursor()
        token_id = f"prt_{uuid.uuid4().hex[:8]}"
        # Invalidate existing tokens for this user
        cursor.execute("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?", (user_id,))
        cursor.execute("""
            INSERT INTO password_reset_tokens (id, user_id, token, expires_at)
            VALUES (?, ?, ?, ?)
        """, (token_id, user_id, token, expires_at))
        conn.commit()
        conn.close()
        return token_id
    
    def verify_password_reset_token(self, token):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM password_reset_tokens 
            WHERE token = ? AND used = 0 AND expires_at > ?
        """, (token, datetime.now().isoformat()))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def use_password_reset_token(self, token):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE password_reset_tokens SET used = 1 WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    
    # ============ 2FA Methods ============
    
    def enable_2fa(self, user_id, totp_secret):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?
        """, (totp_secret, user_id))
        conn.commit()
        conn.close()
    
    def disable_2fa(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?
        """, (user_id,))
        conn.commit()
        conn.close()
    
    def get_user_2fa_status(self, user_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT totp_enabled, totp_secret FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {'enabled': bool(row['totp_enabled']), 'secret': row['totp_secret']}
        return None
    
    # ============ Login Tracking Methods ============
    
    def log_login_attempt(self, username, ip_address, success):
        conn = self.get_connection()
        cursor = conn.cursor()
        attempt_id = f"login_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO login_attempts (id, username, ip_address, success)
            VALUES (?, ?, ?, ?)
        """, (attempt_id, username, ip_address, 1 if success else 0))
        conn.commit()
        conn.close()
    
    def update_failed_login(self, user_id, increment=True):
        conn = self.get_connection()
        cursor = conn.cursor()
        if increment:
            cursor.execute("""
                UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?
            """, (user_id,))
        else:
            cursor.execute("""
                UPDATE users SET failed_login_attempts = 0, last_login = ? WHERE id = ?
            """, (datetime.now().isoformat(), user_id))
        conn.commit()
        conn.close()
    
    def lock_user(self, user_id, until):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET locked_until = ? WHERE id = ?", (until, user_id))
        conn.commit()
        conn.close()
    
    # ============ Patient Methods ============
    
    def get_patients_for_user(self, user_id, user_role):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if user_role == 'admin':
            # Admin can see all patients
            cursor.execute("SELECT * FROM patients")
        elif user_role == 'patient':
            cursor.execute("""
                SELECT p.* FROM patients p
                JOIN users u ON p.user_id = u.id
                WHERE u.id = ?
            """, (user_id,))
        else:
            cursor.execute("""
                SELECT p.* FROM patients p
                JOIN patient_access pa ON p.id = pa.patient_id
                WHERE pa.user_id = ?
            """, (user_id,))
        
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_patient(self, patient_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    # ============ Vitals Methods ============
    
    def get_latest_vitals(self, patient_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM vitals WHERE patient_id = ?
            ORDER BY recorded_at DESC LIMIT 1
        """, (patient_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def add_vitals(self, patient_id, recorded_by, heart_rate, bp_systolic, bp_diastolic, 
                   temperature=None, oxygen_sat=None, resp_rate=None, notes=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        vital_id = f"vit_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO vitals (id, patient_id, recorded_by, heart_rate, blood_pressure_systolic,
                               blood_pressure_diastolic, temperature, oxygen_saturation, 
                               respiratory_rate, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (vital_id, patient_id, recorded_by, heart_rate, bp_systolic, bp_diastolic,
              temperature, oxygen_sat, resp_rate, notes))
        conn.commit()
        conn.close()
        return vital_id
    
    def get_vitals_history(self, patient_id, limit=20):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM vitals WHERE patient_id = ?
            ORDER BY recorded_at DESC LIMIT ?
        """, (patient_id, limit))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ============ Medication Methods ============
    
    def get_medications(self, patient_id, active_only=True):
        conn = self.get_connection()
        cursor = conn.cursor()
        if active_only:
            cursor.execute("SELECT * FROM medications WHERE patient_id = ? AND is_active = 1", (patient_id,))
        else:
            cursor.execute("SELECT * FROM medications WHERE patient_id = ?", (patient_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def add_medication(self, patient_id, name, dosage, frequency, time_of_day, instructions=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        med_id = f"med_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO medications (id, patient_id, name, dosage, frequency, time_of_day, instructions)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (med_id, patient_id, name, dosage, frequency, time_of_day, instructions))
        conn.commit()
        conn.close()
        return med_id
    
    def log_medication(self, medication_id, patient_id, status, recorded_by, notes=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        log_id = f"mlog_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO medication_logs (id, medication_id, patient_id, status, recorded_by, 
                                        taken_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (log_id, medication_id, patient_id, status, recorded_by, 
              datetime.now().isoformat(), notes))
        conn.commit()
        conn.close()
        return log_id
    
    def get_medication_logs(self, patient_id, limit=20):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ml.*, m.name as medication_name, m.dosage, u.full_name as caregiver_name
            FROM medication_logs ml
            JOIN medications m ON ml.medication_id = m.id
            LEFT JOIN users u ON ml.recorded_by = u.id
            WHERE ml.patient_id = ?
            ORDER BY ml.taken_at DESC LIMIT ?
        """, (patient_id, limit))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ============ Appointment Methods ============
    
    def get_appointments(self, user_id=None, patient_id=None, status=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM appointments WHERE 1=1"
        params = []
        
        if patient_id:
            query += " AND patient_id = ?"
            params.append(patient_id)
        if user_id:
            query += " AND (physician_id = ? OR caregiver_id = ?)"
            params.extend([user_id, user_id])
        if status:
            query += " AND status = ?"
            params.append(status)
        
        query += " ORDER BY scheduled_at ASC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def create_appointment(self, patient_id, physician_id, caregiver_id, title, 
                          scheduled_at, duration_mins=30, appointment_type='checkup'):
        conn = self.get_connection()
        cursor = conn.cursor()
        apt_id = f"apt_{uuid.uuid4().hex[:8]}"
        video_link = f"https://meet.healthsync.app/{apt_id}"
        cursor.execute("""
            INSERT INTO appointments (id, patient_id, physician_id, caregiver_id, title,
                                      scheduled_at, duration_mins, appointment_type, video_call_link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (apt_id, patient_id, physician_id, caregiver_id, title, scheduled_at, 
              duration_mins, appointment_type, video_link))
        conn.commit()
        conn.close()
        return apt_id
    
    def update_appointment(self, apt_id, status=None, notes=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        if status:
            cursor.execute("UPDATE appointments SET status = ? WHERE id = ?", (status, apt_id))
        if notes:
            cursor.execute("UPDATE appointments SET notes = ? WHERE id = ?", (notes, apt_id))
        conn.commit()
        conn.close()
    
    # ============ Care Log Methods ============
    
    def add_care_log(self, patient_id, caregiver_id, log_type, title, details):
        conn = self.get_connection()
        cursor = conn.cursor()
        log_id = f"clog_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO care_logs (id, patient_id, caregiver_id, log_type, title, details)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (log_id, patient_id, caregiver_id, log_type, title, details))
        conn.commit()
        conn.close()
        return log_id
    
    def get_care_logs(self, patient_id, limit=20):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT cl.*, u.full_name as caregiver_name FROM care_logs cl
            JOIN users u ON cl.caregiver_id = u.id
            WHERE cl.patient_id = ?
            ORDER BY cl.recorded_at DESC LIMIT ?
        """, (patient_id, limit))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ============ Medical Notes Methods ============
    
    def add_medical_note(self, patient_id, physician_id, note_type, title, content, is_private=False):
        conn = self.get_connection()
        cursor = conn.cursor()
        note_id = f"note_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO medical_notes (id, patient_id, physician_id, note_type, title, content, is_private)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (note_id, patient_id, physician_id, note_type, title, content, int(is_private)))
        conn.commit()
        conn.close()
        return note_id
    
    def get_medical_notes(self, patient_id, include_private=False):
        conn = self.get_connection()
        cursor = conn.cursor()
        if include_private:
            cursor.execute("""
                SELECT mn.*, u.full_name as physician_name FROM medical_notes mn
                JOIN users u ON mn.physician_id = u.id
                WHERE mn.patient_id = ?
                ORDER BY mn.created_at DESC
            """, (patient_id,))
        else:
            cursor.execute("""
                SELECT mn.*, u.full_name as physician_name FROM medical_notes mn
                JOIN users u ON mn.physician_id = u.id
                WHERE mn.patient_id = ? AND mn.is_private = 0
                ORDER BY mn.created_at DESC
            """, (patient_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ============ Alerts Methods ============
    
    def create_alert(self, user_id, patient_id, alert_type, title, message, priority='normal'):
        conn = self.get_connection()
        cursor = conn.cursor()
        alert_id = f"alt_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO alerts (id, user_id, patient_id, alert_type, title, message, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (alert_id, user_id, patient_id, alert_type, title, message, priority))
        conn.commit()
        conn.close()
        return alert_id
    
    def get_alerts(self, user_id, unread_only=False):
        conn = self.get_connection()
        cursor = conn.cursor()
        if unread_only:
            cursor.execute("""
                SELECT * FROM alerts WHERE user_id = ? AND is_read = 0
                ORDER BY created_at DESC
            """, (user_id,))
        else:
            cursor.execute("""
                SELECT * FROM alerts WHERE user_id = ?
                ORDER BY created_at DESC LIMIT 50
            """, (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def mark_alert_read(self, alert_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE alerts SET is_read = 1 WHERE id = ?", (alert_id,))
        conn.commit()
        conn.close()
    
    # ============ Legacy Event Methods (for compatibility) ============
    
    def add_event(self, patient_id, event_type, event_time, details):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO events (patient_id, event_type, event_time, details) VALUES (?, ?, ?, ?)",
            (patient_id, event_type, event_time, details)
        )
        conn.commit()
        conn.close()

    def get_events(self, patient_id, start_date, end_date):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM events WHERE patient_id = ? AND event_time BETWEEN ? AND ?",
            (patient_id, start_date, end_date)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    def update_event(self, event_id, completed):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE events SET completed = ? WHERE id = ?", (completed, event_id))
        conn.commit()
        conn.close()

    # ============ Document Methods ============
    
    def create_document(self, patient_id, uploaded_by, filename, file_type, file_size, 
                        storage_path, category='other', description=None, is_private=0):
        conn = self.get_connection()
        cursor = conn.cursor()
        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO documents (id, patient_id, uploaded_by, filename, file_type, 
                                   file_size, storage_path, category, description, is_private)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (doc_id, patient_id, uploaded_by, filename, file_type, file_size, 
              storage_path, category, description, is_private))
        conn.commit()
        conn.close()
        return doc_id
    
    def get_documents(self, patient_id=None, uploaded_by=None, category=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        query = "SELECT * FROM documents WHERE 1=1"
        params = []
        if patient_id:
            query += " AND patient_id = ?"
            params.append(patient_id)
        if uploaded_by:
            query += " AND uploaded_by = ?"
            params.append(uploaded_by)
        if category:
            query += " AND category = ?"
            params.append(category)
        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_document(self, doc_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def delete_document(self, doc_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        conn.close()
    
    # ============ Shift Methods ============
    
    def create_shift(self, staff_id, staff_type, patient_id, shift_date, start_time, end_time, 
                     created_by, notes=None):
        """Create a new shift for caregiver or physician"""
        conn = self.get_connection()
        cursor = conn.cursor()
        shift_id = f"shift_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO shifts (id, staff_id, staff_type, patient_id, shift_date, start_time, 
                               end_time, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (shift_id, staff_id, staff_type, patient_id, shift_date, start_time, end_time, 
              notes, created_by))
        conn.commit()
        conn.close()
        return shift_id
    
    def get_shifts(self, staff_id=None, staff_type=None, patient_id=None, date_from=None, 
                   date_to=None, status=None, include_all=False):
        """Get shifts with various filters"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT s.*, u.full_name as staff_name, u.role as staff_role, p.name as patient_name,
                   creator.full_name as created_by_name
            FROM shifts s
            LEFT JOIN users u ON s.staff_id = u.id
            LEFT JOIN patients p ON s.patient_id = p.id
            LEFT JOIN users creator ON s.created_by = creator.id
            WHERE 1=1
        """
        params = []
        
        if staff_id:
            query += " AND s.staff_id = ?"
            params.append(staff_id)
        if staff_type:
            query += " AND s.staff_type = ?"
            params.append(staff_type)
        if patient_id:
            query += " AND s.patient_id = ?"
            params.append(patient_id)
        if date_from:
            query += " AND s.shift_date >= ?"
            params.append(date_from)
        if date_to:
            query += " AND s.shift_date <= ?"
            params.append(date_to)
        if status:
            if isinstance(status, list):
                placeholders = ','.join(['?' for _ in status])
                query += f" AND s.status IN ({placeholders})"
                params.extend(status)
            else:
                query += " AND s.status = ?"
                params.append(status)
        
        query += " ORDER BY s.shift_date DESC, s.start_time DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_shift(self, shift_id):
        """Get a single shift by ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.*, u.full_name as staff_name, u.role as staff_role, p.name as patient_name
            FROM shifts s
            LEFT JOIN users u ON s.staff_id = u.id
            LEFT JOIN patients p ON s.patient_id = p.id
            WHERE s.id = ?
        """, (shift_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def update_shift(self, shift_id, **kwargs):
        """Update shift details"""
        conn = self.get_connection()
        cursor = conn.cursor()
        allowed = ['status', 'check_in_time', 'check_out_time', 'check_in_location', 
                   'check_out_location', 'actual_hours', 'notes', 'approved_by', 'approved_at',
                   'shift_date', 'start_time', 'end_time', 'staff_id', 'patient_id']
        updates = [(k, v) for k, v in kwargs.items() if k in allowed and v is not None]
        if updates:
            set_clause = ', '.join([f"{k} = ?" for k, v in updates])
            values = [v for k, v in updates] + [shift_id]
            cursor.execute(f"UPDATE shifts SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)
            conn.commit()
        conn.close()
    
    def check_in_shift(self, shift_id, location=None):
        """Clock in to a shift"""
        from datetime import datetime
        self.update_shift(shift_id, status='in_progress', 
                         check_in_time=datetime.now().isoformat(),
                         check_in_location=location)
    
    def check_out_shift(self, shift_id, location=None):
        """Clock out of a shift and calculate hours"""
        from datetime import datetime
        
        shift = self.get_shift(shift_id)
        if shift and shift.get('check_in_time'):
            check_in = datetime.fromisoformat(shift['check_in_time'])
            check_out = datetime.now()
            hours = (check_out - check_in).total_seconds() / 3600
            self.update_shift(shift_id, status='completed', 
                             check_out_time=check_out.isoformat(),
                             check_out_location=location,
                             actual_hours=round(hours, 2))
        else:
            self.update_shift(shift_id, status='completed',
                             check_out_time=datetime.now().isoformat(),
                             check_out_location=location)
    
    def get_active_shift(self, staff_id):
        """Get the currently active shift for a staff member"""
        shifts = self.get_shifts(staff_id=staff_id, status='in_progress')
        return shifts[0] if shifts else None
    
    def get_todays_shifts(self, staff_id=None, staff_type=None):
        """Get all shifts scheduled for today"""
        from datetime import date
        today = date.today().isoformat()
        return self.get_shifts(staff_id=staff_id, staff_type=staff_type, 
                               date_from=today, date_to=today)
    
    def get_upcoming_shifts(self, staff_id=None, days=7):
        """Get upcoming shifts for the next N days"""
        from datetime import date, timedelta
        today = date.today()
        end_date = (today + timedelta(days=days)).isoformat()
        return self.get_shifts(staff_id=staff_id, date_from=today.isoformat(), date_to=end_date,
                               status=['scheduled', 'confirmed'])
    
    def approve_shift(self, shift_id, approved_by):
        """Approve a shift (for admin/manager)"""
        from datetime import datetime
        self.update_shift(shift_id, status='confirmed', approved_by=approved_by,
                         approved_at=datetime.now().isoformat())
    
    def delete_shift(self, shift_id):
        """Delete a shift"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM shifts WHERE id = ?", (shift_id,))
        conn.commit()
        conn.close()
    
    def get_shift_summary(self, staff_id=None, date_from=None, date_to=None):
        """Get shift summary statistics"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                COUNT(*) as total_shifts,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_shifts,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_shifts,
                SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) as no_shows,
                SUM(actual_hours) as total_hours
            FROM shifts WHERE 1=1
        """
        params = []
        if staff_id:
            query += " AND staff_id = ?"
            params.append(staff_id)
        if date_from:
            query += " AND shift_date >= ?"
            params.append(date_from)
        if date_to:
            query += " AND shift_date <= ?"
            params.append(date_to)
        
        cursor.execute(query, params)
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else {}
    
    # ============ Patient Access Methods ============
    
    def assign_user_to_patient(self, patient_id, user_id, access_level='view', relationship=None):
        """Assign a user (caregiver, physician, family) to a patient"""
        conn = self.get_connection()
        cursor = conn.cursor()
        access_id = f"acc_{uuid.uuid4().hex[:8]}"
        try:
            cursor.execute("""
                INSERT INTO patient_access (id, patient_id, user_id, access_level, relationship)
                VALUES (?, ?, ?, ?, ?)
            """, (access_id, patient_id, user_id, access_level, relationship))
            conn.commit()
        except Exception as e:
            # Update if already exists
            cursor.execute("""
                UPDATE patient_access SET access_level = ?, relationship = ?
                WHERE patient_id = ? AND user_id = ?
            """, (access_level, relationship, patient_id, user_id))
            conn.commit()
        conn.close()
        return access_id
    
    def assign_staff_to_patient(self, patient_id, staff_id, staff_role):
        """
        Assign a caregiver or physician to a patient.
        This also automatically grants them access to all family members linked to that patient.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Determine access level based on role
        access_level = 'full' if staff_role == 'caregiver' else 'medical'
        relationship = 'Caregiver' if staff_role == 'caregiver' else 'Physician'
        
        # 1. Assign staff to patient
        access_id = f"acc_{uuid.uuid4().hex[:8]}"
        try:
            cursor.execute("""
                INSERT INTO patient_access (id, patient_id, user_id, access_level, relationship)
                VALUES (?, ?, ?, ?, ?)
            """, (access_id, patient_id, staff_id, access_level, relationship))
        except:
            cursor.execute("""
                UPDATE patient_access SET access_level = ?, relationship = ?
                WHERE patient_id = ? AND user_id = ?
            """, (access_level, relationship, patient_id, staff_id))
        
        # 2. Get all family members linked to this patient
        cursor.execute("""
            SELECT pa.user_id, u.full_name 
            FROM patient_access pa
            JOIN users u ON pa.user_id = u.id
            WHERE pa.patient_id = ? AND u.role = 'family'
        """, (patient_id,))
        family_members = cursor.fetchall()
        
        # 3. Create bidirectional link: staff can contact family, family can contact staff
        # This is tracked via the patient_access table - if you're assigned to the same patient,
        # you can communicate with each other
        
        conn.commit()
        conn.close()
        
        return {
            'access_id': access_id,
            'patient_id': patient_id,
            'staff_id': staff_id,
            'family_members_linked': len(family_members)
        }
    
    def unassign_staff_from_patient(self, patient_id, staff_id):
        """Remove a caregiver or physician from a patient"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM patient_access WHERE patient_id = ? AND user_id = ?",
                      (patient_id, staff_id))
        conn.commit()
        conn.close()
    
    def get_staff_assignments(self, staff_id=None, patient_id=None, staff_type=None):
        """Get all staff assignments with patient and staff details"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT pa.*, p.name as patient_name, p.condition, 
                   u.full_name as staff_name, u.role as staff_role, u.email, u.phone
            FROM patient_access pa
            JOIN patients p ON pa.patient_id = p.id
            JOIN users u ON pa.user_id = u.id
            WHERE u.role IN ('caregiver', 'physician')
        """
        params = []
        
        if staff_id:
            query += " AND pa.user_id = ?"
            params.append(staff_id)
        if patient_id:
            query += " AND pa.patient_id = ?"
            params.append(patient_id)
        if staff_type:
            query += " AND u.role = ?"
            params.append(staff_type)
        
        query += " ORDER BY u.role, u.full_name"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_patient_family_members(self, patient_id):
        """Get all family members linked to a specific patient"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pa.*, u.full_name, u.email, u.phone
            FROM patient_access pa
            JOIN users u ON pa.user_id = u.id
            WHERE pa.patient_id = ? AND u.role = 'family'
            ORDER BY u.full_name
        """, (patient_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]


    def remove_user_from_patient(self, patient_id, user_id):
        """Remove user access from a patient"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM patient_access WHERE patient_id = ? AND user_id = ?",
                      (patient_id, user_id))
        conn.commit()
        conn.close()
    
    def get_patient_care_team(self, patient_id):
        """Get all users assigned to a patient"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pa.*, u.full_name, u.role, u.email, u.phone
            FROM patient_access pa
            JOIN users u ON pa.user_id = u.id
            WHERE pa.patient_id = ?
            ORDER BY u.role, u.full_name
        """, (patient_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_users_by_role(self, role):
        """Get all users with a specific role"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, email, full_name, role, phone, is_active
            FROM users WHERE role = ? AND is_active = 1
            ORDER BY full_name
        """, (role,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_available_staff(self, staff_type, shift_date, start_time, end_time, patient_id=None):
        """Get staff members available for a shift (not already scheduled)"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Get all active staff of the type
        cursor.execute("""
            SELECT id, full_name, email, phone FROM users
            WHERE role = ? AND is_active = 1
            AND id NOT IN (
                SELECT staff_id FROM shifts 
                WHERE shift_date = ? AND status NOT IN ('cancelled', 'completed')
                AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?))
            )
            ORDER BY full_name
        """, (staff_type, shift_date, start_time, start_time, end_time, end_time))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    

    # ========== Video Call Scheduling ==========
    
    def create_video_call(self, patient_id, scheduled_by, scheduled_at, **kwargs):
        call_id = f"vc_{uuid.uuid4().hex[:12]}"
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO video_calls (id, patient_id, scheduled_by, scheduled_with, scheduled_at, 
                duration_minutes, title, description, meeting_link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            call_id, patient_id, scheduled_by,
            kwargs.get('scheduled_with'),
            scheduled_at,
            kwargs.get('duration_minutes', 30),
            kwargs.get('title', 'Video Consultation'),
            kwargs.get('description', ''),
            f"/video?call={call_id}"
        ))
        conn.commit()
        conn.close()
        return call_id
    
    def get_video_calls(self, user_id=None, patient_id=None, status=None, date_from=None, date_to=None):
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT vc.*, p.name as patient_name, 
                   u1.full_name as scheduled_by_name, u1.role as scheduled_by_role,
                   u2.full_name as scheduled_with_name
            FROM video_calls vc
            LEFT JOIN patients p ON vc.patient_id = p.id
            LEFT JOIN users u1 ON vc.scheduled_by = u1.id
            LEFT JOIN users u2 ON vc.scheduled_with = u2.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND vc.patient_id = ?"
            params.append(patient_id)
        if user_id:
            query += " AND (vc.scheduled_by = ? OR vc.scheduled_with = ?)"
            params.extend([user_id, user_id])
        if status:
            query += " AND vc.status = ?"
            params.append(status)
        if date_from:
            query += " AND vc.scheduled_at >= ?"
            params.append(date_from)
        if date_to:
            query += " AND vc.scheduled_at <= ?"
            params.append(date_to)
        query += " ORDER BY vc.scheduled_at ASC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_video_call(self, call_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT vc.*, p.name as patient_name
            FROM video_calls vc
            LEFT JOIN patients p ON vc.patient_id = p.id
            WHERE vc.id = ?
        """, (call_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def update_video_call(self, call_id, **kwargs):
        conn = self.get_connection()
        cursor = conn.cursor()
        allowed = ['status', 'scheduled_at', 'duration_minutes', 'title', 'description', 'notes', 'reminder_sent']
        updates = [(k, v) for k, v in kwargs.items() if k in allowed and v is not None]
        if updates:
            set_clause = ', '.join([f"{k} = ?" for k, v in updates])
            values = [v for k, v in updates] + [call_id]
            cursor.execute(f"UPDATE video_calls SET {set_clause} WHERE id = ?", values)
            conn.commit()
        conn.close()
    
    def delete_video_call(self, call_id):
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM video_calls WHERE id = ?", (call_id,))
        conn.commit()
        conn.close()
    
    def get_upcoming_video_calls(self, user_id=None, hours=24):
        from datetime import datetime, timedelta
        now = datetime.now().isoformat()
        future = (datetime.now() + timedelta(hours=hours)).isoformat()
        return self.get_video_calls(user_id=user_id, date_from=now, date_to=future)
    
    # ============ Prescription Methods ============
    
    def create_prescription(self, patient_id, physician_id, medication_name, **kwargs):
        """Create a new prescription"""
        conn = self.get_connection()
        cursor = conn.cursor()
        rx_id = f"rx_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO prescriptions (id, patient_id, physician_id, medication_name, dosage,
                frequency, duration, quantity, refills_allowed, instructions, reason, 
                start_date, end_date, pharmacy_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (rx_id, patient_id, physician_id, medication_name,
              kwargs.get('dosage'), kwargs.get('frequency'), kwargs.get('duration'),
              kwargs.get('quantity'), kwargs.get('refills_allowed', 0),
              kwargs.get('instructions'), kwargs.get('reason'),
              kwargs.get('start_date'), kwargs.get('end_date'), kwargs.get('pharmacy_notes')))
        conn.commit()
        conn.close()
        return rx_id
    
    def get_prescriptions(self, patient_id=None, physician_id=None, status=None):
        """Get prescriptions with optional filters"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT p.*, u.full_name as physician_name, pt.name as patient_name
            FROM prescriptions p
            JOIN users u ON p.physician_id = u.id
            JOIN patients pt ON p.patient_id = pt.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND p.patient_id = ?"
            params.append(patient_id)
        if physician_id:
            query += " AND p.physician_id = ?"
            params.append(physician_id)
        if status:
            query += " AND p.status = ?"
            params.append(status)
        query += " ORDER BY p.created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def update_prescription(self, rx_id, **kwargs):
        """Update a prescription"""
        conn = self.get_connection()
        cursor = conn.cursor()
        allowed = ['status', 'refills_used', 'end_date', 'pharmacy_notes']
        updates = [(k, v) for k, v in kwargs.items() if k in allowed]
        if updates:
            set_clause = ', '.join([f"{k} = ?" for k, v in updates])
            values = [v for k, v in updates] + [rx_id]
            cursor.execute(f"UPDATE prescriptions SET {set_clause} WHERE id = ?", values)
            conn.commit()
        conn.close()
    
    # ============ Diagnosis Methods ============
    
    def create_diagnosis(self, patient_id, physician_id, diagnosis_type, title, **kwargs):
        """Create a new diagnosis or test result"""
        conn = self.get_connection()
        cursor = conn.cursor()
        dx_id = f"dx_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO diagnoses (id, patient_id, physician_id, diagnosis_type, title,
                description, icd_code, severity, test_name, test_results, test_date,
                normal_range, is_abnormal, follow_up_required, follow_up_date, notes, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (dx_id, patient_id, physician_id, diagnosis_type, title,
              kwargs.get('description'), kwargs.get('icd_code'), kwargs.get('severity'),
              kwargs.get('test_name'), kwargs.get('test_results'), kwargs.get('test_date'),
              kwargs.get('normal_range'), kwargs.get('is_abnormal', 0),
              kwargs.get('follow_up_required', 0), kwargs.get('follow_up_date'),
              kwargs.get('notes'), kwargs.get('attachments')))
        conn.commit()
        conn.close()
        return dx_id
    
    def get_diagnoses(self, patient_id=None, diagnosis_type=None):
        """Get diagnoses with optional filters"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT d.*, u.full_name as physician_name, pt.name as patient_name
            FROM diagnoses d
            JOIN users u ON d.physician_id = u.id
            JOIN patients pt ON d.patient_id = pt.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND d.patient_id = ?"
            params.append(patient_id)
        if diagnosis_type:
            query += " AND d.diagnosis_type = ?"
            params.append(diagnosis_type)
        query += " ORDER BY d.created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ============ Consultation Methods ============
    
    def create_consultation(self, patient_id, physician_id, consultation_type, visit_date, **kwargs):
        """Create a new consultation record"""
        conn = self.get_connection()
        cursor = conn.cursor()
        consult_id = f"consult_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO consultations (id, patient_id, physician_id, consultation_type, visit_date,
                chief_complaint, present_illness, physical_examination, assessment, treatment_plan,
                recommendations, follow_up_instructions, next_appointment, duration_minutes, video_call_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (consult_id, patient_id, physician_id, consultation_type, visit_date,
              kwargs.get('chief_complaint'), kwargs.get('present_illness'),
              kwargs.get('physical_examination'), kwargs.get('assessment'),
              kwargs.get('treatment_plan'), kwargs.get('recommendations'),
              kwargs.get('follow_up_instructions'), kwargs.get('next_appointment'),
              kwargs.get('duration_minutes'), kwargs.get('video_call_id')))
        conn.commit()
        conn.close()
        return consult_id
    
    def get_consultations(self, patient_id=None, physician_id=None, consultation_type=None):
        """Get consultations with optional filters"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT c.*, u.full_name as physician_name, pt.name as patient_name
            FROM consultations c
            JOIN users u ON c.physician_id = u.id
            JOIN patients pt ON c.patient_id = pt.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND c.patient_id = ?"
            params.append(patient_id)
        if physician_id:
            query += " AND c.physician_id = ?"
            params.append(physician_id)
        if consultation_type:
            query += " AND c.consultation_type = ?"
            params.append(consultation_type)
        query += " ORDER BY c.visit_date DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ============ Patient Issues Methods ============
    
    def create_patient_issue(self, patient_id, reported_by, issue_type, title, **kwargs):
        """Create a new patient issue/concern"""
        conn = self.get_connection()
        cursor = conn.cursor()
        issue_id = f"issue_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO patient_issues (id, patient_id, reported_by, issue_type, title,
                description, severity, onset_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (issue_id, patient_id, reported_by, issue_type, title,
              kwargs.get('description'), kwargs.get('severity', 'medium'),
              kwargs.get('onset_date')))
        conn.commit()
        conn.close()
        return issue_id
    
    def get_patient_issues(self, patient_id=None, status=None, severity=None):
        """Get patient issues with optional filters"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT pi.*, u.full_name as reporter_name, pt.name as patient_name,
                   r.full_name as resolver_name
            FROM patient_issues pi
            JOIN users u ON pi.reported_by = u.id
            JOIN patients pt ON pi.patient_id = pt.id
            LEFT JOIN users r ON pi.resolved_by = r.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND pi.patient_id = ?"
            params.append(patient_id)
        if status:
            query += " AND pi.status = ?"
            params.append(status)
        if severity:
            query += " AND pi.severity = ?"
            params.append(severity)
        query += " ORDER BY pi.created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def resolve_patient_issue(self, issue_id, resolved_by, resolution):
        """Mark an issue as resolved"""
        from datetime import datetime
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE patient_issues SET status = 'resolved', resolved_by = ?,
                resolution = ?, resolved_at = ?
            WHERE id = ?
        """, (resolved_by, resolution, datetime.now().isoformat(), issue_id))
        conn.commit()
        conn.close()
    
    # ============ Video Call Notes Methods ============
    
    def create_video_call_note(self, video_call_id, patient_id, created_by, note_type, content, **kwargs):
        """Create a note for a video call"""
        conn = self.get_connection()
        cursor = conn.cursor()
        note_id = f"vcn_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO video_call_notes (id, video_call_id, patient_id, created_by, note_type,
                content, timestamp_start, timestamp_end, is_important)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (note_id, video_call_id, patient_id, created_by, note_type, content,
              kwargs.get('timestamp_start'), kwargs.get('timestamp_end'),
              kwargs.get('is_important', 0)))
        conn.commit()
        conn.close()
        return note_id
    
    def get_video_call_notes(self, video_call_id=None, patient_id=None):
        """Get video call notes"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT vcn.*, u.full_name as author_name, pt.name as patient_name
            FROM video_call_notes vcn
            JOIN users u ON vcn.created_by = u.id
            JOIN patients pt ON vcn.patient_id = pt.id
            WHERE 1=1
        """
        params = []
        if video_call_id:
            query += " AND vcn.video_call_id = ?"
            params.append(video_call_id)
        if patient_id:
            query += " AND vcn.patient_id = ?"
            params.append(patient_id)
        query += " ORDER BY vcn.created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ============ Unified Patient History ============
    
    def get_patient_history(self, patient_id, limit=50):
        """
        Get complete patient care history - all records in chronological order
        Returns: prescriptions, diagnoses, consultations, issues, care_logs, 
                 medical_notes, medications, video_call_notes, vitals
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        history = {
            'prescriptions': [],
            'diagnoses': [],
            'consultations': [],
            'issues': [],
            'care_logs': [],
            'medical_notes': [],
            'medications': [],
            'video_call_notes': [],
            'vitals': [],
            'timeline': []
        }
        
        # Prescriptions
        cursor.execute("""
            SELECT p.*, u.full_name as physician_name, 'prescription' as record_type
            FROM prescriptions p JOIN users u ON p.physician_id = u.id
            WHERE p.patient_id = ? ORDER BY p.created_at DESC LIMIT ?
        """, (patient_id, limit))
        history['prescriptions'] = [dict(row) for row in cursor.fetchall()]
        
        # Diagnoses
        cursor.execute("""
            SELECT d.*, u.full_name as physician_name, 'diagnosis' as record_type
            FROM diagnoses d JOIN users u ON d.physician_id = u.id
            WHERE d.patient_id = ? ORDER BY d.created_at DESC LIMIT ?
        """, (patient_id, limit))
        history['diagnoses'] = [dict(row) for row in cursor.fetchall()]
        
        # Consultations
        cursor.execute("""
            SELECT c.*, u.full_name as physician_name, 'consultation' as record_type
            FROM consultations c JOIN users u ON c.physician_id = u.id
            WHERE c.patient_id = ? ORDER BY c.visit_date DESC LIMIT ?
        """, (patient_id, limit))
        history['consultations'] = [dict(row) for row in cursor.fetchall()]
        
        # Issues
        cursor.execute("""
            SELECT pi.*, u.full_name as reporter_name, 'issue' as record_type
            FROM patient_issues pi JOIN users u ON pi.reported_by = u.id
            WHERE pi.patient_id = ? ORDER BY pi.created_at DESC LIMIT ?
        """, (patient_id, limit))
        history['issues'] = [dict(row) for row in cursor.fetchall()]
        
        # Care logs
        cursor.execute("""
            SELECT cl.*, u.full_name as caregiver_name, 'care_log' as record_type
            FROM care_logs cl JOIN users u ON cl.caregiver_id = u.id
            WHERE cl.patient_id = ? ORDER BY cl.recorded_at DESC LIMIT ?
        """, (patient_id, limit))
        history['care_logs'] = [dict(row) for row in cursor.fetchall()]
        
        # Medical notes
        cursor.execute("""
            SELECT mn.*, u.full_name as physician_name, 'medical_note' as record_type
            FROM medical_notes mn JOIN users u ON mn.physician_id = u.id
            WHERE mn.patient_id = ? AND mn.is_private = 0 ORDER BY mn.created_at DESC LIMIT ?
        """, (patient_id, limit))
        history['medical_notes'] = [dict(row) for row in cursor.fetchall()]
        
        # Active medications
        cursor.execute("""
            SELECT *, 'medication' as record_type FROM medications
            WHERE patient_id = ? ORDER BY created_at DESC LIMIT ?
        """, (patient_id, limit))
        history['medications'] = [dict(row) for row in cursor.fetchall()]
        
        # Video call notes
        cursor.execute("""
            SELECT vcn.*, u.full_name as author_name, 'video_note' as record_type
            FROM video_call_notes vcn JOIN users u ON vcn.created_by = u.id
            WHERE vcn.patient_id = ? ORDER BY vcn.created_at DESC LIMIT ?
        """, (patient_id, limit))
        history['video_call_notes'] = [dict(row) for row in cursor.fetchall()]
        
        # Recent vitals
        cursor.execute("""
            SELECT v.*, u.full_name as recorded_by_name, 'vital' as record_type
            FROM vitals v LEFT JOIN users u ON v.recorded_by = u.id
            WHERE v.patient_id = ? ORDER BY v.recorded_at DESC LIMIT ?
        """, (patient_id, limit))
        history['vitals'] = [dict(row) for row in cursor.fetchall()]
        
        # Caregiver daily reports
        cursor.execute("""
            SELECT cdr.*, u.full_name as caregiver_name, 'caregiver_report' as record_type
            FROM caregiver_daily_reports cdr JOIN users u ON cdr.caregiver_id = u.id
            WHERE cdr.patient_id = ? ORDER BY cdr.report_date DESC LIMIT ?
        """, (patient_id, limit))
        history['caregiver_reports'] = [dict(row) for row in cursor.fetchall()]
        
        # Doctor reports
        cursor.execute("""
            SELECT dr.*, u.full_name as physician_name, 'doctor_report' as record_type
            FROM doctor_reports dr JOIN users u ON dr.physician_id = u.id
            WHERE dr.patient_id = ? ORDER BY dr.report_date DESC LIMIT ?
        """, (patient_id, limit))
        history['doctor_reports'] = [dict(row) for row in cursor.fetchall()]
        
        # Build unified timeline
        all_records = []
        for rx in history['prescriptions']:
            all_records.append({'type': 'prescription', 'date': rx['created_at'], 'data': rx})
        for dx in history['diagnoses']:
            all_records.append({'type': 'diagnosis', 'date': dx['created_at'], 'data': dx})
        for consult in history['consultations']:
            all_records.append({'type': 'consultation', 'date': consult['visit_date'], 'data': consult})
        for issue in history['issues']:
            all_records.append({'type': 'issue', 'date': issue['created_at'], 'data': issue})
        for log in history['care_logs']:
            all_records.append({'type': 'care_log', 'date': log['recorded_at'], 'data': log})
        for note in history['medical_notes']:
            all_records.append({'type': 'medical_note', 'date': note['created_at'], 'data': note})
        for vcn in history['video_call_notes']:
            all_records.append({'type': 'video_note', 'date': vcn['created_at'], 'data': vcn})
        for cdr in history['caregiver_reports']:
            all_records.append({'type': 'caregiver_report', 'date': cdr['report_date'], 'data': cdr})
        for dr in history['doctor_reports']:
            all_records.append({'type': 'doctor_report', 'date': dr['report_date'], 'data': dr})
        
        # Sort by date descending
        all_records.sort(key=lambda x: x['date'] if x['date'] else '', reverse=True)
        history['timeline'] = all_records[:limit]
        
        conn.close()
        return history
    
    # ============ Caregiver Daily Reports Methods ============
    
    def create_caregiver_report(self, patient_id, caregiver_id, report_date, **kwargs):
        """Create a caregiver daily report"""
        conn = self.get_connection()
        cursor = conn.cursor()
        report_id = f"cdr_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO caregiver_daily_reports (id, patient_id, caregiver_id, report_date,
                shift_id, overall_status, mood_assessment, appetite, sleep_quality, 
                mobility_status, pain_level, activities_completed, meals_given,
                medications_administered, vital_signs_summary, incidents, concerns,
                recommendations, family_communication, next_shift_notes, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (report_id, patient_id, caregiver_id, report_date,
              kwargs.get('shift_id'), kwargs.get('overall_status'),
              kwargs.get('mood_assessment'), kwargs.get('appetite'),
              kwargs.get('sleep_quality'), kwargs.get('mobility_status'),
              kwargs.get('pain_level'), kwargs.get('activities_completed'),
              kwargs.get('meals_given'), kwargs.get('medications_administered'),
              kwargs.get('vital_signs_summary'), kwargs.get('incidents'),
              kwargs.get('concerns'), kwargs.get('recommendations'),
              kwargs.get('family_communication'), kwargs.get('next_shift_notes'),
              kwargs.get('attachments')))
        conn.commit()
        conn.close()
        return report_id
    
    def get_caregiver_reports(self, patient_id=None, caregiver_id=None, date_from=None, date_to=None):
        """Get caregiver daily reports"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT cdr.*, u.full_name as caregiver_name, pt.name as patient_name
            FROM caregiver_daily_reports cdr
            JOIN users u ON cdr.caregiver_id = u.id
            JOIN patients pt ON cdr.patient_id = pt.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND cdr.patient_id = ?"
            params.append(patient_id)
        if caregiver_id:
            query += " AND cdr.caregiver_id = ?"
            params.append(caregiver_id)
        if date_from:
            query += " AND cdr.report_date >= ?"
            params.append(date_from)
        if date_to:
            query += " AND cdr.report_date <= ?"
            params.append(date_to)
        query += " ORDER BY cdr.report_date DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # ============ Doctor Reports Methods ============
    
    def create_doctor_report(self, patient_id, physician_id, report_type, report_date, **kwargs):
        """Create a doctor/physician report"""
        conn = self.get_connection()
        cursor = conn.cursor()
        report_id = f"dr_{uuid.uuid4().hex[:8]}"
        cursor.execute("""
            INSERT INTO doctor_reports (id, patient_id, physician_id, report_type, report_date,
                visit_type, chief_complaint, history_of_present_illness, review_of_systems,
                physical_exam, current_medications, allergies, diagnosis, icd_codes,
                assessment, treatment_plan, prescriptions_issued, tests_ordered, referrals,
                patient_education, follow_up_plan, prognosis, restrictions, work_status,
                caregiver_instructions, family_instructions, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (report_id, patient_id, physician_id, report_type, report_date,
              kwargs.get('visit_type'), kwargs.get('chief_complaint'),
              kwargs.get('history_of_present_illness'), kwargs.get('review_of_systems'),
              kwargs.get('physical_exam'), kwargs.get('current_medications'),
              kwargs.get('allergies'), kwargs.get('diagnosis'), kwargs.get('icd_codes'),
              kwargs.get('assessment'), kwargs.get('treatment_plan'),
              kwargs.get('prescriptions_issued'), kwargs.get('tests_ordered'),
              kwargs.get('referrals'), kwargs.get('patient_education'),
              kwargs.get('follow_up_plan'), kwargs.get('prognosis'),
              kwargs.get('restrictions'), kwargs.get('work_status'),
              kwargs.get('caregiver_instructions'), kwargs.get('family_instructions'),
              kwargs.get('attachments')))
        conn.commit()
        conn.close()
        return report_id
    
    def get_doctor_reports(self, patient_id=None, physician_id=None, report_type=None):
        """Get doctor reports"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT dr.*, u.full_name as physician_name, pt.name as patient_name
            FROM doctor_reports dr
            JOIN users u ON dr.physician_id = u.id
            JOIN patients pt ON dr.patient_id = pt.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND dr.patient_id = ?"
            params.append(patient_id)
        if physician_id:
            query += " AND dr.physician_id = ?"
            params.append(physician_id)
        if report_type:
            query += " AND dr.report_type = ?"
            params.append(report_type)
        query += " ORDER BY dr.report_date DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def sign_doctor_report(self, report_id):
        """Sign/finalize a doctor report"""
        from datetime import datetime
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE doctor_reports SET is_signed = 1, signed_at = ? WHERE id = ?
        """, (datetime.now().isoformat(), report_id))
        conn.commit()
        conn.close()

    # ============ Document Management ============
    
    def create_document(self, uploaded_by, filename, **kwargs):
        """Create a new document record"""
        doc_id = f"doc_{uuid.uuid4().hex[:12]}"
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO documents (id, patient_id, uploaded_by, filename, original_filename, file_type, 
                                   file_size, category, description, tags, expiration_date, is_confidential)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (doc_id, kwargs.get('patient_id'), uploaded_by, filename, kwargs.get('original_filename', filename),
              kwargs.get('file_type'), kwargs.get('file_size'), kwargs.get('category', 'other'),
              kwargs.get('description'), kwargs.get('tags'), kwargs.get('expiration_date'),
              kwargs.get('is_confidential', 0)))
        conn.commit()
        conn.close()
        return doc_id
    
    def get_documents(self, patient_id=None, category=None, uploaded_by=None):
        """Get documents with optional filters"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT d.*, u.full_name as uploader_name, p.name as patient_name
            FROM documents d
            JOIN users u ON d.uploaded_by = u.id
            LEFT JOIN patients p ON d.patient_id = p.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND d.patient_id = ?"
            params.append(patient_id)
        if category:
            query += " AND d.category = ?"
            params.append(category)
        if uploaded_by:
            query += " AND d.uploaded_by = ?"
            params.append(uploaded_by)
        query += " ORDER BY d.created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_document(self, doc_id):
        """Get a single document by ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def delete_document(self, doc_id):
        """Delete a document"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        conn.close()

    # ============ Messaging System ============
    
    def create_message(self, sender_id, content, **kwargs):
        """Create a new message"""
        msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO messages (id, sender_id, recipient_id, thread_id, patient_id, subject, content,
                                  message_type, priority, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (msg_id, sender_id, kwargs.get('recipient_id'), kwargs.get('thread_id'),
              kwargs.get('patient_id'), kwargs.get('subject'), content,
              kwargs.get('message_type', 'direct'), kwargs.get('priority', 'normal'),
              kwargs.get('attachments')))
        conn.commit()
        conn.close()
        return msg_id
    
    def get_messages(self, user_id, folder='inbox', limit=50):
        """Get messages for a user"""
        conn = self.get_connection()
        cursor = conn.cursor()
        if folder == 'inbox':
            query = """
                SELECT m.*, s.full_name as sender_name, r.full_name as recipient_name
                FROM messages m
                JOIN users s ON m.sender_id = s.id
                LEFT JOIN users r ON m.recipient_id = r.id
                WHERE m.recipient_id = ? AND m.is_deleted = 0
                ORDER BY m.created_at DESC LIMIT ?
            """
            cursor.execute(query, (user_id, limit))
        elif folder == 'sent':
            query = """
                SELECT m.*, s.full_name as sender_name, r.full_name as recipient_name
                FROM messages m
                JOIN users s ON m.sender_id = s.id
                LEFT JOIN users r ON m.recipient_id = r.id
                WHERE m.sender_id = ? AND m.is_deleted = 0
                ORDER BY m.created_at DESC LIMIT ?
            """
            cursor.execute(query, (user_id, limit))
        else:  # all
            query = """
                SELECT m.*, s.full_name as sender_name, r.full_name as recipient_name
                FROM messages m
                JOIN users s ON m.sender_id = s.id
                LEFT JOIN users r ON m.recipient_id = r.id
                WHERE (m.sender_id = ? OR m.recipient_id = ?) AND m.is_deleted = 0
                ORDER BY m.created_at DESC LIMIT ?
            """
            cursor.execute(query, (user_id, user_id, limit))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def mark_message_read(self, message_id):
        """Mark a message as read"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE messages SET is_read = 1, read_at = ? WHERE id = ?
        """, (datetime.now().isoformat(), message_id))
        conn.commit()
        conn.close()
    
    def get_unread_count(self, user_id):
        """Get count of unread messages for a user"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM messages WHERE recipient_id = ? AND is_read = 0 AND is_deleted = 0
        """, (user_id,))
        count = cursor.fetchone()[0]
        conn.close()
        return count

    # ============ Time Tracking ============
    
    def clock_in(self, user_id, **kwargs):
        """Record a clock-in event"""
        entry_id = f"time_{uuid.uuid4().hex[:12]}"
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO time_entries (id, user_id, patient_id, shift_id, clock_in, clock_in_location, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (entry_id, user_id, kwargs.get('patient_id'), kwargs.get('shift_id'),
              datetime.now().isoformat(), kwargs.get('location'), kwargs.get('notes')))
        conn.commit()
        conn.close()
        return entry_id
    
    def clock_out(self, entry_id, **kwargs):
        """Record a clock-out event"""
        conn = self.get_connection()
        cursor = conn.cursor()
        clock_out_time = datetime.now()
        
        # Get clock-in time to calculate hours
        cursor.execute("SELECT clock_in FROM time_entries WHERE id = ?", (entry_id,))
        row = cursor.fetchone()
        if row:
            clock_in_time = datetime.fromisoformat(row['clock_in'])
            total_hours = (clock_out_time - clock_in_time).total_seconds() / 3600
            overtime = max(0, total_hours - 8)  # Overtime after 8 hours
            
            cursor.execute("""
                UPDATE time_entries 
                SET clock_out = ?, clock_out_location = ?, total_hours = ?, overtime_hours = ?, 
                    status = 'completed', notes = COALESCE(notes || ' | ', '') || ?
                WHERE id = ?
            """, (clock_out_time.isoformat(), kwargs.get('location'), round(total_hours, 2),
                  round(overtime, 2), kwargs.get('notes', ''), entry_id))
        conn.commit()
        conn.close()
    
    def get_time_entries(self, user_id=None, patient_id=None, start_date=None, end_date=None, status=None):
        """Get time entries with filters"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT te.*, u.full_name as user_name, p.name as patient_name
            FROM time_entries te
            JOIN users u ON te.user_id = u.id
            LEFT JOIN patients p ON te.patient_id = p.id
            WHERE 1=1
        """
        params = []
        if user_id:
            query += " AND te.user_id = ?"
            params.append(user_id)
        if patient_id:
            query += " AND te.patient_id = ?"
            params.append(patient_id)
        if start_date:
            query += " AND te.clock_in >= ?"
            params.append(start_date)
        if end_date:
            query += " AND te.clock_in <= ?"
            params.append(end_date)
        if status:
            query += " AND te.status = ?"
            params.append(status)
        query += " ORDER BY te.clock_in DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_active_time_entry(self, user_id):
        """Get active (not clocked out) time entry for a user"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM time_entries WHERE user_id = ? AND status = 'active' ORDER BY clock_in DESC LIMIT 1
        """, (user_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    # ============ Care Plans ============
    
    def create_care_plan(self, patient_id, name, created_by, **kwargs):
        """Create a new care plan"""
        plan_id = f"cp_{uuid.uuid4().hex[:12]}"
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO patient_care_plans (id, patient_id, template_id, name, description, start_date,
                                            end_date, status, created_by, goals, interventions, review_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (plan_id, patient_id, kwargs.get('template_id'), name, kwargs.get('description'),
              kwargs.get('start_date'), kwargs.get('end_date'), kwargs.get('status', 'draft'),
              created_by, kwargs.get('goals'), kwargs.get('interventions'),
              kwargs.get('review_date'), kwargs.get('notes')))
        conn.commit()
        conn.close()
        return plan_id
    
    def get_care_plans(self, patient_id=None, status=None):
        """Get care plans"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT cp.*, p.name as patient_name, u.full_name as created_by_name
            FROM patient_care_plans cp
            JOIN patients p ON cp.patient_id = p.id
            JOIN users u ON cp.created_by = u.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND cp.patient_id = ?"
            params.append(patient_id)
        if status:
            query += " AND cp.status = ?"
            params.append(status)
        query += " ORDER BY cp.created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    # ============ Care Tasks ============
    
    def create_care_task(self, patient_id, title, **kwargs):
        """Create a care task"""
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO care_tasks (id, care_plan_id, patient_id, assigned_to, title, description,
                                    category, priority, frequency, scheduled_time, due_date, verification_required)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (task_id, kwargs.get('care_plan_id'), patient_id, kwargs.get('assigned_to'), title,
              kwargs.get('description'), kwargs.get('category', 'other'), kwargs.get('priority', 'normal'),
              kwargs.get('frequency'), kwargs.get('scheduled_time'), kwargs.get('due_date'),
              kwargs.get('verification_required', 0)))
        conn.commit()
        conn.close()
        return task_id
    
    def get_care_tasks(self, patient_id=None, assigned_to=None, status=None, due_date=None):
        """Get care tasks with filters"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT ct.*, p.name as patient_name, u.full_name as assigned_to_name
            FROM care_tasks ct
            JOIN patients p ON ct.patient_id = p.id
            LEFT JOIN users u ON ct.assigned_to = u.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND ct.patient_id = ?"
            params.append(patient_id)
        if assigned_to:
            query += " AND ct.assigned_to = ?"
            params.append(assigned_to)
        if status:
            query += " AND ct.status = ?"
            params.append(status)
        if due_date:
            query += " AND DATE(ct.due_date) = DATE(?)"
            params.append(due_date)
        query += " ORDER BY ct.due_date ASC, ct.priority DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def complete_care_task(self, task_id, completed_by, notes=None):
        """Mark a care task as completed"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE care_tasks 
            SET status = 'completed', completed_by = ?, completed_at = ?, completion_notes = ?
            WHERE id = ?
        """, (completed_by, datetime.now().isoformat(), notes, task_id))
        conn.commit()
        conn.close()

    # ============ ADL Logs ============
    
    def create_adl_log(self, patient_id, caregiver_id, log_date, **kwargs):
        """Create an ADL log entry"""
        log_id = f"adl_{uuid.uuid4().hex[:12]}"
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO adl_logs (id, patient_id, caregiver_id, log_date, bathing, dressing, grooming,
                                  toileting, transferring, ambulation, feeding, continence, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (log_id, patient_id, caregiver_id, log_date, kwargs.get('bathing'), kwargs.get('dressing'),
              kwargs.get('grooming'), kwargs.get('toileting'), kwargs.get('transferring'),
              kwargs.get('ambulation'), kwargs.get('feeding'), kwargs.get('continence'), kwargs.get('notes')))
        conn.commit()
        conn.close()
        return log_id
    
    def get_adl_logs(self, patient_id, start_date=None, end_date=None, limit=30):
        """Get ADL logs for a patient"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT al.*, u.full_name as caregiver_name
            FROM adl_logs al
            JOIN users u ON al.caregiver_id = u.id
            WHERE al.patient_id = ?
        """
        params = [patient_id]
        if start_date:
            query += " AND al.log_date >= ?"
            params.append(start_date)
        if end_date:
            query += " AND al.log_date <= ?"
            params.append(end_date)
        query += " ORDER BY al.log_date DESC LIMIT ?"
        params.append(limit)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    # ============ Invoices ============
    
    def create_invoice(self, patient_id, total, created_by, **kwargs):
        """Create an invoice"""
        invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
        invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO invoices (id, patient_id, invoice_number, billing_period_start, billing_period_end,
                                  subtotal, tax, discount, total, status, due_date, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (invoice_id, patient_id, invoice_number, kwargs.get('billing_period_start'),
              kwargs.get('billing_period_end'), kwargs.get('subtotal', total), kwargs.get('tax', 0),
              kwargs.get('discount', 0), total, kwargs.get('status', 'draft'),
              kwargs.get('due_date'), kwargs.get('notes'), created_by))
        conn.commit()
        conn.close()
        return invoice_id, invoice_number
    
    def get_invoices(self, patient_id=None, status=None, limit=50):
        """Get invoices with filters"""
        conn = self.get_connection()
        cursor = conn.cursor()
        query = """
            SELECT i.*, p.name as patient_name, u.full_name as created_by_name
            FROM invoices i
            JOIN patients p ON i.patient_id = p.id
            LEFT JOIN users u ON i.created_by = u.id
            WHERE 1=1
        """
        params = []
        if patient_id:
            query += " AND i.patient_id = ?"
            params.append(patient_id)
        if status:
            query += " AND i.status = ?"
            params.append(status)
        query += " ORDER BY i.created_at DESC LIMIT ?"
        params.append(limit)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

db = Database()

