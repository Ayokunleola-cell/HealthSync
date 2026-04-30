'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { Icons } from './Icons';
import styles from './Sidebar.module.css';

// SVG Icons for menu items
const MenuIcons = {
    Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    Patients: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    Appointments: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    Alerts: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
    Vitals: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    Medications: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 1 1 7-7l10 10a4.95 4.95 0 1 1-7 7z" /><path d="M8.5 8.5l7 7" /></svg>,
    CareLogs: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
    Calendar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    Reminders: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    Video: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>,
    AI: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" /><circle cx="7.5" cy="14.5" r="1.5" /><circle cx="16.5" cy="14.5" r="1.5" /></svg>,
    Notes: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>,
    Status: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
    Contact: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
    Home: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
    Emergency: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    Messages: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
    Timesheet: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    Documents: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    Tasks: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
    Invoices: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    Logout: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
};

// Map labels to icons
const getIconForLabel = (label) => {
    const iconMap = {
        'Dashboard': MenuIcons.Dashboard,
        'Manage Users': MenuIcons.Users,
        'Staff Assignments': MenuIcons.Users,
        'Manage Shifts': MenuIcons.Calendar,
        'My Shifts': MenuIcons.Calendar,
        'All Patients': MenuIcons.Patients,
        'Patients': MenuIcons.Patients,
        'Appointments': MenuIcons.Appointments,
        'Alerts': MenuIcons.Alerts,
        'Vitals': MenuIcons.Vitals,
        'Vitals Review': MenuIcons.Vitals,
        'Medications': MenuIcons.Medications,
        'Care Logs': MenuIcons.CareLogs,
        'Calendar': MenuIcons.Calendar,
        'Reminders': MenuIcons.Reminders,
        'Video Call': MenuIcons.Video,
        'Video Consult': MenuIcons.Video,
        'AI Assistant': MenuIcons.AI,
        'Medical Notes': MenuIcons.Notes,
        'Patient Status': MenuIcons.Status,
        'Contact Caregiver': MenuIcons.Contact,
        'Home': MenuIcons.Home,
        'My Medications': MenuIcons.Medications,
        'My Appointments': MenuIcons.Appointments,
        'Emergency': MenuIcons.Emergency,
        'Messages': MenuIcons.Messages,
        'Timesheet': MenuIcons.Timesheet,
        'Documents': MenuIcons.Documents,
        'Tasks': MenuIcons.Tasks,
        'Invoices': MenuIcons.Invoices,
        'Care Plans': MenuIcons.Notes,
        'ADL Tracking': MenuIcons.Status,
        'Reports': MenuIcons.Dashboard,
        'Notifications': MenuIcons.Alerts,
        'Settings': MenuIcons.Notes,
    };
    return iconMap[label] || MenuIcons.Dashboard;
};

// Role-based navigation items
const navItemsByRole = {
    admin: [
        { href: '/admin', label: 'Dashboard' },
        { href: '/admin/users', label: 'Manage Users' },
        { href: '/admin/assignments', label: 'Staff Assignments' },
        { href: '/admin/shifts', label: 'Manage Shifts' },
        { href: '/admin/patients', label: 'All Patients' },
        { href: '/appointments', label: 'Appointments' },
        { href: '/messages', label: 'Messages' },
        { href: '/documents', label: 'Documents' },
        { href: '/invoices', label: 'Invoices' },
        { href: '/reports', label: 'Reports' },
        { href: '/notifications', label: 'Notifications' },
        { href: '/settings', label: 'Settings' },
    ],
    caregiver: [
        { href: '/', label: 'Dashboard' },
        { href: '/my-shifts', label: 'My Shifts' },
        { href: '/patients', label: 'Patients' },
        { href: '/vitals', label: 'Vitals' },
        { href: '/medications', label: 'Medications' },
        { href: '/care-logs', label: 'Care Logs' },
        { href: '/calendar', label: 'Calendar' },
        { href: '/reminders', label: 'Reminders' },
        { href: '/tasks', label: 'Tasks' },
        { href: '/adl', label: 'ADL Tracking' },
        { href: '/timesheet', label: 'Timesheet' },
        { href: '/messages', label: 'Messages' },
        { href: '/documents', label: 'Documents' },
        { href: '/video', label: 'Video Call' },
        { href: '/ai-assistant', label: 'AI Assistant' },
        { href: '/notifications', label: 'Notifications' },
        { href: '/settings', label: 'Settings' },
    ],
    physician: [
        { href: '/physician', label: 'Dashboard' },
        { href: '/my-shifts', label: 'My Shifts' },
        { href: '/patients', label: 'Patients' },
        { href: '/appointments', label: 'Appointments' },
        { href: '/medical-notes', label: 'Medical Notes' },
        { href: '/care-plans', label: 'Care Plans' },
        { href: '/vitals', label: 'Vitals Review' },
        { href: '/video', label: 'Video Consult' },
        { href: '/ai-assistant', label: 'AI Assistant' },
        { href: '/reports', label: 'Reports' },
        { href: '/notifications', label: 'Notifications' },
        { href: '/settings', label: 'Settings' },
    ],
    family: [
        { href: '/family', label: 'Dashboard' },
        { href: '/patient-status', label: 'Patient Status' },
        { href: '/calendar', label: 'Appointments' },
        { href: '/messages', label: 'Messages' },
        { href: '/video', label: 'Video Call' },
        { href: '/alerts', label: 'Alerts' },
        { href: '/contact', label: 'Contact Caregiver' },
    ],
    patient: [
        { href: '/patient', label: 'Home' },
        { href: '/my-medications', label: 'My Medications' },
        { href: '/my-appointments', label: 'My Appointments' },
        { href: '/messages', label: 'Messages' },
        { href: '/video', label: 'Video Call' },
        { href: '/emergency', label: 'Emergency' },
    ],
};


const roleLabels = {
    admin: 'Administrator',
    caregiver: 'Caregiver',
    physician: 'Physician',
    family: 'Family',
    patient: 'Patient',
};

const roleColors = {
    admin: '#805ad5',
    caregiver: '#38a169',
    physician: '#3182ce',
    family: '#dd6b20',
    patient: '#38a169',
};

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    if (pathname === '/login' || pathname === '/register') return null;
    if (!user) return null;

    const navItems = navItemsByRole[user.role] || navItemsByRole.caregiver;
    const roleLabel = roleLabels[user.role] || 'User';
    const roleColor = roleColors[user.role] || '#38a169';

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <div className={styles.logoIcon}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                </div>
                <h1 className={styles.logoText}>HealthSync</h1>
            </div>

            <div className={styles.roleTag} style={{ backgroundColor: `${roleColor}20`, color: roleColor }}>
                {roleLabel}
            </div>

            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const IconComponent = getIconForLabel(item.label);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
                        >
                            <span className={styles.navIcon}><IconComponent /></span>
                            <span className={styles.navLabel}>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <div className={styles.userInfo}>
                    <div className={styles.avatar} style={{ background: roleColor }}>
                        {user.full_name?.charAt(0) || 'U'}
                    </div>
                    <div className={styles.userDetails}>
                        <span className={styles.userName}>{user.full_name || user.username}</span>
                        <span className={styles.userRole}>{roleLabel}</span>
                    </div>
                </div>
                <button onClick={logout} className={styles.logoutBtn}>
                    <MenuIcons.Logout />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
