'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function CarePlansPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [carePlans, setCarePlans] = useState([]);
    const [patients, setPatients] = useState([]);
    const [filter, setFilter] = useState({ patient_id: '', status: '' });
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newPlan, setNewPlan] = useState({
        patient_id: '',
        name: '',
        description: '',
        start_date: '',
        goals: '',
        interventions: '',
        status: 'draft'
    });

    const fetchCarePlans = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (filter.patient_id) params.append('patient_id', filter.patient_id);
            if (filter.status) params.append('status', filter.status);

            const res = await fetch(`/api/care-plans?${params.toString()}`, { headers: getAuthHeaders() });
            const data = await res.json();
            setCarePlans(data.care_plans || []);
        } catch (err) {
            console.error('Failed to fetch care plans:', err);
        }
    }, [filter, getAuthHeaders]);

    const fetchPatients = useCallback(async () => {
        try {
            const res = await fetch('/api/patients', { headers: getAuthHeaders() });
            const data = await res.json();
            setPatients(data.patients || []);
        } catch (err) {
            console.error('Failed to fetch patients:', err);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchCarePlans();
        fetchPatients();
    }, [token, loading, fetchCarePlans, fetchPatients]);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newPlan.patient_id || !newPlan.name) return;

        setCreating(true);
        try {
            const res = await fetch('/api/care-plans', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newPlan)
            });
            if (res.ok) {
                setShowCreate(false);
                setNewPlan({
                    patient_id: '',
                    name: '',
                    description: '',
                    start_date: '',
                    goals: '',
                    interventions: '',
                    status: 'draft'
                });
                fetchCarePlans();
            }
        } catch (err) {
            console.error('Create failed:', err);
        }
        setCreating(false);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const getStatusColor = (status) => {
        const colors = {
            draft: '#6b7280',
            active: '#22c55e',
            on_hold: '#f59e0b',
            completed: '#3b82f6',
            discontinued: '#ef4444'
        };
        return colors[status] || colors.draft;
    };

    if (loading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading care plans...</p></div>;
    }

    const canCreate = user?.role === 'physician' || user?.role === 'admin';

    return (
        <div className={`page ${styles.carePlansPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.ClipboardList size={28} /> Care Plans</h1>
                    <p>Create and manage patient care plans</p>
                </div>
                {canCreate && (
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Icons.Plus size={16} /> New Care Plan
                    </button>
                )}
            </header>

            {/* Filters */}
            <div className={styles.filters}>
                <select
                    className="input"
                    value={filter.patient_id}
                    onChange={(e) => setFilter({ ...filter, patient_id: e.target.value })}
                >
                    <option value="">All Patients</option>
                    {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <select
                    className="input"
                    value={filter.status}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="discontinued">Discontinued</option>
                </select>
            </div>

            {/* Care Plans List */}
            {carePlans.length === 0 ? (
                <div className={styles.emptyState}>
                    <Icons.Clipboard size={48} />
                    <h3>No care plans found</h3>
                    <p>Create a care plan to get started</p>
                </div>
            ) : (
                <div className={styles.plansGrid}>
                    {carePlans.map((plan) => (
                        <div key={plan.id} className={styles.planCard}>
                            <div className={styles.planHeader}>
                                <h3>{plan.name}</h3>
                                <span
                                    className={styles.statusBadge}
                                    style={{ backgroundColor: `${getStatusColor(plan.status)}20`, color: getStatusColor(plan.status) }}
                                >
                                    {plan.status.replace('_', ' ')}
                                </span>
                            </div>
                            <p className={styles.planPatient}>
                                <Icons.User size={14} /> {plan.patient_name}
                            </p>
                            {plan.description && (
                                <p className={styles.planDescription}>{plan.description}</p>
                            )}
                            <div className={styles.planMeta}>
                                <span><Icons.Calendar size={14} /> Start: {formatDate(plan.start_date)}</span>
                                <span><Icons.User size={14} /> By: {plan.created_by_name}</span>
                            </div>
                            {plan.goals && (
                                <div className={styles.planSection}>
                                    <strong>Goals:</strong>
                                    <p>{plan.goals}</p>
                                </div>
                            )}
                            {plan.interventions && (
                                <div className={styles.planSection}>
                                    <strong>Interventions:</strong>
                                    <p>{plan.interventions}</p>
                                </div>
                            )}
                            <div className={styles.planActions}>
                                <button className="btn btn-secondary btn-sm">
                                    <Icons.Eye size={14} /> View Details
                                </button>
                                <button className="btn btn-secondary btn-sm">
                                    <Icons.Edit size={14} /> Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><Icons.Plus size={20} /> Create Care Plan</h3>
                            <button className={styles.closeBtn} onClick={() => setShowCreate(false)}>
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className={styles.createForm}>
                            <div className="input-group">
                                <label className="input-label">Patient *</label>
                                <select
                                    className="input"
                                    value={newPlan.patient_id}
                                    onChange={(e) => setNewPlan({ ...newPlan, patient_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select patient...</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Plan Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={newPlan.name}
                                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                                    placeholder="e.g., Dementia Care Plan"
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    value={newPlan.description}
                                    onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                                    placeholder="Brief description..."
                                />
                            </div>
                            <div className={styles.formRow}>
                                <div className="input-group">
                                    <label className="input-label">Start Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={newPlan.start_date}
                                        onChange={(e) => setNewPlan({ ...newPlan, start_date: e.target.value })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Status</label>
                                    <select
                                        className="input"
                                        value={newPlan.status}
                                        onChange={(e) => setNewPlan({ ...newPlan, status: e.target.value })}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                    </select>
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Goals</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={newPlan.goals}
                                    onChange={(e) => setNewPlan({ ...newPlan, goals: e.target.value })}
                                    placeholder="Define care goals..."
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Interventions</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={newPlan.interventions}
                                    onChange={(e) => setNewPlan({ ...newPlan, interventions: e.target.value })}
                                    placeholder="Define interventions..."
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={creating}>
                                    {creating ? 'Creating...' : 'Create Care Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
