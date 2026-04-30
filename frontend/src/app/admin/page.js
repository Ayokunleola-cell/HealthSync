'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Link from 'next/link';
import styles from './page.module.css';

export default function AdminDashboard() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        if (!token || loading) return;
        const fetchData = async () => {
            const [statsRes, usersRes] = await Promise.all([
                fetch('/api/admin/dashboard', { headers: getAuthHeaders() }),
                fetch('/api/admin/users', { headers: getAuthHeaders() })
            ]);
            const statsData = await statsRes.json();
            const usersData = await usersRes.json();
            setStats(statsData);
            setUsers(usersData.users || []);
        };
        fetchData();
    }, [token, loading, getAuthHeaders]);

    if (loading || !stats) {
        return <div className={styles.loading}><div className="spinner"></div></div>;
    }

    const roleColors = {
        admin: '#805ad5', caregiver: '#38a169', physician: '#3182ce',
        family: '#dd6b20', patient: '#38a169'
    };

    return (
        <div className={`page ${styles.adminPage}`}>
            <header className={styles.header}>
                <div>
                    <h1>Admin Dashboard</h1>
                    <p>Clinic management overview</p>
                </div>
                <Link href="/admin/users" className="btn btn-primary">+ Add User</Link>
            </header>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statValue}>{Object.values(stats.users_by_role || {}).reduce((a, b) => a + b, 0)}</span>
                    <span className={styles.statLabel}>Total Users</span>
                </div>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statValue}>{stats.total_patients || 0}</span>
                    <span className={styles.statLabel}>Patients</span>
                </div>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statValue}>{stats.active_appointments || 0}</span>
                    <span className={styles.statLabel}>Active Appointments</span>
                </div>
                <div className={`card ${styles.statCard}`}>
                    <span className={styles.statValue}>{stats.unread_alerts || 0}</span>
                    <span className={styles.statLabel}>Unread Alerts</span>
                </div>
            </div>

            {/* Users by Role */}
            <div className={`card ${styles.sectionCard}`}>
                <h3>Users by Role</h3>
                <div className={styles.roleGrid}>
                    {Object.entries(stats.users_by_role || {}).map(([role, count]) => (
                        <div key={role} className={styles.roleItem}>
                            <span className={styles.roleDot} style={{ background: roleColors[role] }}></span>
                            <span className={styles.roleName}>{role}</span>
                            <span className={styles.roleCount}>{count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Users */}
            <div className={`card ${styles.sectionCard}`}>
                <div className="card-header">
                    <h3>Recent Users</h3>
                    <Link href="/admin/users" className={styles.viewAll}>View All</Link>
                </div>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Email</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.slice(0, 5).map((user) => (
                            <tr key={user.id}>
                                <td>{user.full_name}</td>
                                <td>{user.username}</td>
                                <td>
                                    <span className={styles.roleBadge} style={{ background: `${roleColors[user.role]}20`, color: roleColors[user.role] }}>
                                        {user.role}
                                    </span>
                                </td>
                                <td>{user.email}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Quick Actions */}
            <div className={`card ${styles.sectionCard}`}>
                <h3>Quick Actions</h3>
                <div className={styles.quickActions}>
                    <Link href="/admin/users" className="btn btn-secondary">Manage Users</Link>
                    <Link href="/admin/patients" className="btn btn-secondary">View All Patients</Link>
                    <Link href="/appointments" className="btn btn-secondary">Appointments</Link>
                    <Link href="/alerts" className="btn btn-secondary">View Alerts</Link>
                </div>
            </div>
        </div>
    );
}
