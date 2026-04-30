'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function NotificationsPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loadingData, setLoadingData] = useState(true);

    const fetchNotifications = useCallback(async () => {
        try {
            // Fetch real alerts from API
            const res = await fetch('/api/alerts', { headers: getAuthHeaders() });
            const data = await res.json();

            // Combine with mock notifications for demo
            const mockNotifications = [
                {
                    id: 'notif_1',
                    type: 'alert',
                    priority: 'high',
                    title: 'Medication Reminder',
                    message: 'John Smith - Lisinopril due in 30 minutes',
                    timestamp: new Date(Date.now() - 1800000).toISOString(),
                    read: false,
                    patient_name: 'John Smith'
                },
                {
                    id: 'notif_2',
                    type: 'vitals',
                    priority: 'urgent',
                    title: 'Abnormal Vitals Detected',
                    message: 'Mary Johnson - Blood pressure reading 165/98 mmHg',
                    timestamp: new Date(Date.now() - 3600000).toISOString(),
                    read: false,
                    patient_name: 'Mary Johnson'
                },
                {
                    id: 'notif_3',
                    type: 'task',
                    priority: 'normal',
                    title: 'Task Assigned',
                    message: 'New ADL assessment task for Robert Davis',
                    timestamp: new Date(Date.now() - 7200000).toISOString(),
                    read: true,
                    patient_name: 'Robert Davis'
                },
                {
                    id: 'notif_4',
                    type: 'message',
                    priority: 'normal',
                    title: 'New Message',
                    message: 'Dr. Smith sent you a message about care plan updates',
                    timestamp: new Date(Date.now() - 14400000).toISOString(),
                    read: true
                },
                {
                    id: 'notif_5',
                    type: 'shift',
                    priority: 'normal',
                    title: 'Shift Reminder',
                    message: 'Your shift starts tomorrow at 8:00 AM',
                    timestamp: new Date(Date.now() - 28800000).toISOString(),
                    read: true
                },
                {
                    id: 'notif_6',
                    type: 'system',
                    priority: 'low',
                    title: 'System Maintenance',
                    message: 'Scheduled maintenance this weekend from 2-4 AM',
                    timestamp: new Date(Date.now() - 86400000).toISOString(),
                    read: true
                },
            ];

            // Merge API alerts with mock data
            const apiAlerts = (data.alerts || []).map(alert => ({
                id: alert.id,
                type: alert.alert_type || 'alert',
                priority: alert.priority || 'normal',
                title: alert.title || 'Alert',
                message: alert.message,
                timestamp: alert.created_at,
                read: alert.acknowledged,
                patient_name: alert.patient_name
            }));

            setNotifications([...apiAlerts, ...mockNotifications].sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            ));
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
        setLoadingData(false);
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchNotifications();
    }, [token, loading, fetchNotifications]);

    const markAsRead = (notifId) => {
        setNotifications(prev =>
            prev.map(n => n.id === notifId ? { ...n, read: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const deleteNotification = (notifId) => {
        setNotifications(prev => prev.filter(n => n.id !== notifId));
    };

    const clearAll = () => {
        setNotifications([]);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return date.toLocaleDateString();
    };

    const getIcon = (type) => {
        switch (type) {
            case 'alert': return <Icons.Bell size={20} />;
            case 'vitals': return <Icons.Activity size={20} />;
            case 'medication': return <Icons.Pill size={20} />;
            case 'task': return <Icons.CheckCircle size={20} />;
            case 'message': return <Icons.Mail size={20} />;
            case 'shift': return <Icons.Calendar size={20} />;
            case 'system': return <Icons.Settings size={20} />;
            default: return <Icons.Bell size={20} />;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'alert': return '#f59e0b';
            case 'vitals': return '#ef4444';
            case 'medication': return '#8b5cf6';
            case 'task': return '#22c55e';
            case 'message': return '#3b82f6';
            case 'shift': return '#14b8a6';
            case 'system': return '#6b7280';
            default: return '#38a169';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent': return '#ef4444';
            case 'high': return '#f59e0b';
            case 'normal': return '#3b82f6';
            case 'low': return '#6b7280';
            default: return '#3b82f6';
        }
    };

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'all') return true;
        if (filter === 'unread') return !n.read;
        return n.type === filter;
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    if (loading || loadingData) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading notifications...</p></div>;
    }

    return (
        <div className={`page ${styles.notificationsPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.Bell size={28} /> Notifications</h1>
                    <p>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
                </div>
                <div className={styles.headerActions}>
                    {unreadCount > 0 && (
                        <button className="btn btn-secondary" onClick={markAllAsRead}>
                            <Icons.Check size={16} /> Mark All Read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button className="btn btn-secondary" onClick={clearAll}>
                            <Icons.Trash size={16} /> Clear All
                        </button>
                    )}
                </div>
            </header>

            {/* Filters */}
            <div className={styles.filterTabs}>
                <button
                    className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All
                </button>
                <button
                    className={`${styles.filterTab} ${filter === 'unread' ? styles.active : ''}`}
                    onClick={() => setFilter('unread')}
                >
                    Unread {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
                </button>
                <button
                    className={`${styles.filterTab} ${filter === 'alert' ? styles.active : ''}`}
                    onClick={() => setFilter('alert')}
                >
                    Alerts
                </button>
                <button
                    className={`${styles.filterTab} ${filter === 'vitals' ? styles.active : ''}`}
                    onClick={() => setFilter('vitals')}
                >
                    Vitals
                </button>
                <button
                    className={`${styles.filterTab} ${filter === 'task' ? styles.active : ''}`}
                    onClick={() => setFilter('task')}
                >
                    Tasks
                </button>
                <button
                    className={`${styles.filterTab} ${filter === 'message' ? styles.active : ''}`}
                    onClick={() => setFilter('message')}
                >
                    Messages
                </button>
            </div>

            {/* Notifications List */}
            {filteredNotifications.length === 0 ? (
                <div className={styles.emptyState}>
                    <Icons.Bell size={48} />
                    <h3>No notifications</h3>
                    <p>You're all caught up!</p>
                </div>
            ) : (
                <div className={styles.notificationsList}>
                    {filteredNotifications.map((notif) => (
                        <div
                            key={notif.id}
                            className={`${styles.notificationItem} ${!notif.read ? styles.unread : ''}`}
                            onClick={() => markAsRead(notif.id)}
                        >
                            <div
                                className={styles.notifIcon}
                                style={{ backgroundColor: `${getTypeColor(notif.type)}15`, color: getTypeColor(notif.type) }}
                            >
                                {getIcon(notif.type)}
                            </div>
                            <div className={styles.notifContent}>
                                <div className={styles.notifHeader}>
                                    <span className={styles.notifTitle}>{notif.title}</span>
                                    {notif.priority === 'urgent' && (
                                        <span className={styles.urgentBadge}>URGENT</span>
                                    )}
                                    {notif.priority === 'high' && (
                                        <span className={styles.highBadge}>HIGH</span>
                                    )}
                                </div>
                                <p className={styles.notifMessage}>{notif.message}</p>
                                <div className={styles.notifMeta}>
                                    <span className={styles.notifTime}>{formatTime(notif.timestamp)}</span>
                                    {notif.patient_name && (
                                        <span className={styles.notifPatient}>
                                            <Icons.User size={12} /> {notif.patient_name}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className={styles.notifActions}>
                                {!notif.read && <div className={styles.unreadDot} />}
                                <button
                                    className={styles.deleteBtn}
                                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                                    title="Delete"
                                >
                                    <Icons.X size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
