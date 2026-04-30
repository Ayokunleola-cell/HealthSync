'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

const TASK_CATEGORIES = [
    { value: 'adl', label: 'ADL', color: '#3b82f6' },
    { value: 'medication', label: 'Medication', color: '#8b5cf6' },
    { value: 'vitals', label: 'Vitals', color: '#ef4444' },
    { value: 'exercise', label: 'Exercise', color: '#22c55e' },
    { value: 'nutrition', label: 'Nutrition', color: '#f59e0b' },
    { value: 'therapy', label: 'Therapy', color: '#ec4899' },
    { value: 'monitoring', label: 'Monitoring', color: '#14b8a6' },
    { value: 'communication', label: 'Communication', color: '#6366f1' },
    { value: 'other', label: 'Other', color: '#6b7280' }
];

export default function TasksPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [patients, setPatients] = useState([]);
    const [filter, setFilter] = useState({ status: 'pending', patient_id: '' });
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newTask, setNewTask] = useState({
        patient_id: '',
        title: '',
        description: '',
        category: 'other',
        priority: 'normal',
        due_date: ''
    });

    const fetchTasks = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (filter.status) params.append('status', filter.status);
            if (filter.patient_id) params.append('patient_id', filter.patient_id);

            const res = await fetch(`/api/care-tasks?${params.toString()}`, { headers: getAuthHeaders() });
            const data = await res.json();
            setTasks(data.care_tasks || []);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
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
        fetchTasks();
        fetchPatients();
    }, [token, loading, fetchTasks, fetchPatients]);

    const completeTask = async (taskId) => {
        try {
            await fetch(`/api/care-tasks/${taskId}/complete`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            fetchTasks();
        } catch (err) {
            console.error('Failed to complete task:', err);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newTask.patient_id || !newTask.title) return;

        setCreating(true);
        try {
            const res = await fetch('/api/care-tasks', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newTask)
            });
            if (res.ok) {
                setShowCreate(false);
                setNewTask({
                    patient_id: '',
                    title: '',
                    description: '',
                    category: 'other',
                    priority: 'normal',
                    due_date: ''
                });
                fetchTasks();
            }
        } catch (err) {
            console.error('Create failed:', err);
        }
        setCreating(false);
    };

    const getCategoryInfo = (cat) => {
        return TASK_CATEGORIES.find(c => c.value === cat) || TASK_CATEGORIES[TASK_CATEGORIES.length - 1];
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const isOverdue = (dueDate) => {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    };

    const pendingCount = tasks.filter(t => t.status === 'pending').length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;

    if (loading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading tasks...</p></div>;
    }

    return (
        <div className={`page ${styles.tasksPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.CheckCircle size={28} /> Care Tasks</h1>
                    <p>Manage and track patient care tasks</p>
                </div>
                {(user?.role === 'caregiver' || user?.role === 'physician' || user?.role === 'admin') && (
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        <Icons.Plus size={16} /> New Task
                    </button>
                )}
            </header>

            {/* Stats */}
            <div className={styles.statsGrid}>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statIcon} style={{ color: '#f59e0b' }}><Icons.Clock size={24} /></span>
                    <span className={styles.statValue}>{pendingCount}</span>
                    <span className={styles.statLabel}>Pending</span>
                </div>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statIcon} style={{ color: '#22c55e' }}><Icons.Check size={24} /></span>
                    <span className={styles.statValue}>{completedCount}</span>
                    <span className={styles.statLabel}>Completed</span>
                </div>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statIcon} style={{ color: '#ef4444' }}><Icons.AlertTriangle size={24} /></span>
                    <span className={styles.statValue}>{tasks.filter(t => t.priority === 'urgent').length}</span>
                    <span className={styles.statLabel}>Urgent</span>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filters}>
                <div className={styles.statusTabs}>
                    <button
                        className={`${styles.tab} ${filter.status === 'pending' ? styles.active : ''}`}
                        onClick={() => setFilter({ ...filter, status: 'pending' })}
                    >
                        Pending
                    </button>
                    <button
                        className={`${styles.tab} ${filter.status === 'completed' ? styles.active : ''}`}
                        onClick={() => setFilter({ ...filter, status: 'completed' })}
                    >
                        Completed
                    </button>
                    <button
                        className={`${styles.tab} ${!filter.status ? styles.active : ''}`}
                        onClick={() => setFilter({ ...filter, status: '' })}
                    >
                        All
                    </button>
                </div>
                <select
                    className="input"
                    value={filter.patient_id}
                    onChange={(e) => setFilter({ ...filter, patient_id: e.target.value })}
                    style={{ width: '200px' }}
                >
                    <option value="">All Patients</option>
                    {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* Tasks List */}
            {tasks.length === 0 ? (
                <div className={styles.emptyState}>
                    <Icons.CheckCircle size={48} />
                    <h3>No tasks found</h3>
                    <p>Create a new task to get started</p>
                </div>
            ) : (
                <div className={styles.tasksList}>
                    {tasks.map((task) => {
                        const catInfo = getCategoryInfo(task.category);
                        const overdue = task.status === 'pending' && isOverdue(task.due_date);

                        return (
                            <div
                                key={task.id}
                                className={`${styles.taskCard} ${styles[task.priority]} ${task.status === 'completed' ? styles.completed : ''}`}
                            >
                                <div className={styles.taskCheckbox}>
                                    {task.status === 'pending' ? (
                                        <button
                                            className={styles.checkBtn}
                                            onClick={() => completeTask(task.id)}
                                            title="Mark as complete"
                                        >
                                            <Icons.Circle size={24} />
                                        </button>
                                    ) : (
                                        <span className={styles.checkedIcon}>
                                            <Icons.CheckCircle size={24} />
                                        </span>
                                    )}
                                </div>
                                <div className={styles.taskContent}>
                                    <div className={styles.taskHeader}>
                                        <h4 className={styles.taskTitle}>{task.title}</h4>
                                        <span
                                            className={styles.taskCategory}
                                            style={{ background: `${catInfo.color}20`, color: catInfo.color }}
                                        >
                                            {catInfo.label}
                                        </span>
                                        {task.priority === 'urgent' && (
                                            <span className={styles.urgentBadge}>URGENT</span>
                                        )}
                                        {task.priority === 'high' && (
                                            <span className={styles.highBadge}>HIGH</span>
                                        )}
                                    </div>
                                    {task.description && (
                                        <p className={styles.taskDescription}>{task.description}</p>
                                    )}
                                    <div className={styles.taskMeta}>
                                        <span><Icons.User size={14} /> {task.patient_name}</span>
                                        {task.assigned_to_name && (
                                            <span><Icons.UserCheck size={14} /> {task.assigned_to_name}</span>
                                        )}
                                        {task.due_date && (
                                            <span className={overdue ? styles.overdue : ''}>
                                                <Icons.Calendar size={14} />
                                                {overdue ? 'Overdue: ' : 'Due: '}{formatDate(task.due_date)}
                                            </span>
                                        )}
                                    </div>
                                    {task.status === 'completed' && task.completed_at && (
                                        <p className={styles.completedInfo}>
                                            <Icons.Check size={14} /> Completed {formatDate(task.completed_at)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><Icons.Plus size={20} /> Create Task</h3>
                            <button className={styles.closeBtn} onClick={() => setShowCreate(false)}>
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className={styles.createForm}>
                            <div className="input-group">
                                <label className="input-label">Patient *</label>
                                <select
                                    className="input"
                                    value={newTask.patient_id}
                                    onChange={(e) => setNewTask({ ...newTask, patient_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select patient...</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Task Title *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    placeholder="Enter task title..."
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    placeholder="Enter description..."
                                />
                            </div>
                            <div className={styles.formRow}>
                                <div className="input-group">
                                    <label className="input-label">Category</label>
                                    <select
                                        className="input"
                                        value={newTask.category}
                                        onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                                    >
                                        {TASK_CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Priority</label>
                                    <select
                                        className="input"
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                    >
                                        <option value="low">Low</option>
                                        <option value="normal">Normal</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Due Date</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={newTask.due_date}
                                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={creating}>
                                    {creating ? 'Creating...' : 'Create Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
