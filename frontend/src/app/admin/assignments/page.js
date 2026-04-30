'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import Link from 'next/link';
import styles from './page.module.css';

export default function StaffAssignmentsPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [caregivers, setCaregivers] = useState([]);
    const [physicians, setPhysicians] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState({ staff_type: '', patient_id: '' });
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [formData, setFormData] = useState({
        staff_type: 'caregiver',
        staff_id: '',
        patient_id: ''
    });

    const fetchAssignments = async () => {
        const params = new URLSearchParams();
        if (filter.staff_type) params.append('staff_type', filter.staff_type);
        if (filter.patient_id) params.append('patient_id', filter.patient_id);

        const res = await fetch(`/api/staff-assignments?${params.toString()}`, { headers: getAuthHeaders() });
        const data = await res.json();
        setAssignments(data.assignments || []);
    };

    const fetchDropdownData = async () => {
        try {
            const [patientsRes, caregiversRes, physiciansRes] = await Promise.all([
                fetch('/api/admin/patients', { headers: getAuthHeaders() }),
                fetch('/api/users/by-role/caregiver', { headers: getAuthHeaders() }),
                fetch('/api/users/by-role/physician', { headers: getAuthHeaders() })
            ]);
            const patientsData = await patientsRes.json();
            const caregiversData = await caregiversRes.json();
            const physiciansData = await physiciansRes.json();

            setPatients(patientsData.patients || []);
            setCaregivers(caregiversData.users || []);
            setPhysicians(physiciansData.users || []);
        } catch (err) {
            console.error('Failed to fetch dropdown data:', err);
        }
    };

    const fetchPatientDetails = async (patientId) => {
        try {
            const res = await fetch(`/api/patients/${patientId}/care-team`, { headers: getAuthHeaders() });
            const data = await res.json();
            setSelectedPatient({
                ...patients.find(p => p.id === patientId),
                care_team: data.care_team || [],
                family: data.family || []
            });
        } catch (err) {
            console.error('Failed to fetch patient details:', err);
        }
    };

    useEffect(() => {
        if (!token || loading) return;
        fetchAssignments();
        fetchDropdownData();
    }, [token, loading]);

    useEffect(() => {
        if (token) fetchAssignments();
    }, [filter]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        const res = await fetch('/api/staff-assignments', {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (res.ok) {
            setMessage({
                text: `${formData.staff_type === 'caregiver' ? 'Caregiver' : 'Physician'} assigned! Linked to ${data.family_members_linked} family member(s).`,
                type: 'success'
            });
            setShowForm(false);
            setFormData({ staff_type: 'caregiver', staff_id: '', patient_id: '' });
            fetchAssignments();
            if (selectedPatient?.id === formData.patient_id) {
                fetchPatientDetails(formData.patient_id);
            }
        } else {
            setMessage({ text: data.error || 'Failed to create assignment', type: 'error' });
        }
    };

    const handleRemove = async (patientId, staffId) => {
        if (!confirm('Remove this staff assignment?')) return;
        await fetch(`/api/staff-assignments/${patientId}/${staffId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        setMessage({ text: 'Assignment removed', type: 'success' });
        fetchAssignments();
        if (selectedPatient?.id === patientId) {
            fetchPatientDetails(patientId);
        }
    };

    const getStaffOptions = () => {
        return formData.staff_type === 'caregiver' ? caregivers : physicians;
    };

    if (loading) return <div className={styles.loading}><div className="spinner"></div></div>;

    return (
        <div className={`page ${styles.assignmentsPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.Users size={24} /> Staff Assignments</h1>
                    <p>Assign caregivers and physicians to patients</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary">
                    + New Assignment
                </button>
            </header>

            {message.text && (
                <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>
            )}

            <div className={styles.mainContent}>
                {/* Left: Patients List */}
                <div className={styles.patientsList}>
                    <h3>Select a Patient</h3>
                    <div className={styles.patientsGrid}>
                        {patients.map(patient => (
                            <div
                                key={patient.id}
                                className={`${styles.patientCard} ${selectedPatient?.id === patient.id ? styles.selected : ''}`}
                                onClick={() => fetchPatientDetails(patient.id)}
                            >
                                <div className={styles.patientAvatar}>{patient.name?.charAt(0)}</div>
                                <div>
                                    <strong>{patient.name}</strong>
                                    <span>{patient.condition || 'No condition listed'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Patient Details */}
                <div className={styles.patientDetails}>
                    {selectedPatient ? (
                        <>
                            <div className={styles.patientHeader}>
                                <div className={styles.patientAvatarLarge}>
                                    {selectedPatient.name?.charAt(0)}
                                </div>
                                <div>
                                    <h2>{selectedPatient.name}</h2>
                                    <span>{selectedPatient.condition}</span>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        setFormData({ ...formData, patient_id: selectedPatient.id });
                                        setShowForm(true);
                                    }}
                                >
                                    + Assign Staff
                                </button>
                            </div>

                            {/* Care Team Section */}
                            <div className={styles.section}>
                                <h3><Icons.Activity size={18} /> Care Team</h3>
                                {selectedPatient.care_team?.length === 0 ? (
                                    <p className={styles.emptyText}>No staff assigned yet</p>
                                ) : (
                                    <div className={styles.teamGrid}>
                                        {selectedPatient.care_team?.map(member => (
                                            <div key={member.user_id} className={styles.teamCard}>
                                                <div className={styles.teamAvatar} data-role={member.role}>
                                                    {member.full_name?.charAt(0)}
                                                </div>
                                                <div className={styles.teamInfo}>
                                                    <strong>{member.full_name}</strong>
                                                    <span className={styles.roleBadge} data-role={member.role}>
                                                        {member.role === 'caregiver' ? 'Caregiver' : 'Physician'}
                                                    </span>
                                                    <span className={styles.contact}>{member.email}</span>
                                                </div>
                                                <button
                                                    className={styles.removeBtn}
                                                    onClick={() => handleRemove(selectedPatient.id, member.user_id)}
                                                >
                                                    <Icons.X size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Family Section */}
                            <div className={styles.section}>
                                <h3><Icons.Family size={18} /> Family Members</h3>
                                <p className={styles.helpText}>
                                    When staff is assigned to this patient, they automatically get access to contact these family members.
                                </p>
                                {selectedPatient.family?.length === 0 ? (
                                    <p className={styles.emptyText}>No family members registered</p>
                                ) : (
                                    <div className={styles.familyGrid}>
                                        {selectedPatient.family?.map(member => (
                                            <div key={member.user_id} className={styles.familyCard}>
                                                <span className={styles.familyIcon}><Icons.User size={18} /></span>
                                                <div>
                                                    <strong>{member.full_name}</strong>
                                                    <span>{member.relationship || 'Family'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className={styles.noSelection}>
                            <Icons.ArrowLeft size={24} />
                            <p>Select a patient to view and manage their care team</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Assignment Modal */}
            {showForm && (
                <div className={styles.modal}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>Assign Staff to Patient</h3>
                            <button onClick={() => setShowForm(false)}><Icons.X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label className="input-label">Patient*</label>
                                <select className="input" value={formData.patient_id}
                                    onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })} required>
                                    <option value="">Select patient...</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Staff Type*</label>
                                <div className={styles.staffTypeToggle}>
                                    <button
                                        type="button"
                                        className={formData.staff_type === 'caregiver' ? styles.active : ''}
                                        onClick={() => setFormData({ ...formData, staff_type: 'caregiver', staff_id: '' })}
                                    >
                                        Caregiver
                                    </button>
                                    <button
                                        type="button"
                                        className={formData.staff_type === 'physician' ? styles.active : ''}
                                        onClick={() => setFormData({ ...formData, staff_type: 'physician', staff_id: '' })}
                                    >
                                        Physician
                                    </button>
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">{formData.staff_type === 'caregiver' ? 'Caregiver' : 'Physician'}*</label>
                                <select className="input" value={formData.staff_id}
                                    onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })} required>
                                    <option value="">Select {formData.staff_type}...</option>
                                    {getStaffOptions().map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.infoBox}>
                                <Icons.Info size={18} />
                                <p>When you assign a staff member to a patient, they will automatically be able to communicate with the patient&apos;s family members.</p>
                            </div>
                            <div className={styles.formActions}>
                                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                                <button type="submit" className="btn btn-primary">Assign Staff</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
