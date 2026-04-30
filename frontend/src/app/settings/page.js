'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function SettingsPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // 2FA state
    const [twoFAEnabled, setTwoFAEnabled] = useState(false);
    const [twoFASetup, setTwoFASetup] = useState(null);
    const [twoFACode, setTwoFACode] = useState('');
    const [disablePassword, setDisablePassword] = useState('');

    const [profile, setProfile] = useState({
        full_name: '',
        email: '',
        phone: '',
        address: '',
        emergency_contact: '',
        emergency_phone: ''
    });

    const [password, setPassword] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const [preferences, setPreferences] = useState({
        email_notifications: true,
        sms_notifications: false,
        push_notifications: true,
        dark_mode: false,
        language: 'en',
        timezone: 'America/New_York'
    });

    useEffect(() => {
        if (user) {
            setProfile({
                full_name: user.full_name || '',
                email: user.email || '',
                phone: user.phone || '',
                address: user.address || '',
                emergency_contact: user.emergency_contact || '',
                emergency_phone: user.emergency_phone || ''
            });
            setTwoFAEnabled(user.totp_enabled || false);
        }
    }, [user]);

    // Check 2FA status on load
    useEffect(() => {
        if (token && activeTab === 'security') {
            check2FAStatus();
        }
    }, [token, activeTab]);

    const check2FAStatus = async () => {
        try {
            const res = await fetch('/api/auth/2fa-status', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setTwoFAEnabled(data.enabled);
            }
        } catch (err) {
            console.error('Failed to check 2FA status');
        }
    };

    const showMessage = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(`/api/users/${user.id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(profile)
            });
            if (res.ok) {
                showMessage('Profile updated successfully!');
            } else {
                showMessage('Failed to update profile', 'error');
            }
        } catch (err) {
            showMessage('Error updating profile', 'error');
        }
        setSaving(false);
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (password.new !== password.confirm) {
            showMessage('Passwords do not match', 'error');
            return;
        }
        if (password.new.length < 6) {
            showMessage('Password must be at least 6 characters', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/change-password', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    current_password: password.current,
                    new_password: password.new
                })
            });
            if (res.ok) {
                showMessage('Password changed successfully!');
                setPassword({ current: '', new: '', confirm: '' });
            } else {
                const data = await res.json();
                showMessage(data.error || 'Failed to change password', 'error');
            }
        } catch (err) {
            showMessage('Error changing password', 'error');
        }
        setSaving(false);
    };

    const handleSetup2FA = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/auth/setup-2fa', {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                setTwoFASetup(data);
            } else {
                showMessage('Failed to setup 2FA', 'error');
            }
        } catch (err) {
            showMessage('Error setting up 2FA', 'error');
        }
        setSaving(false);
    };

    const handleVerify2FA = async (e) => {
        e.preventDefault();
        if (!twoFACode || twoFACode.length !== 6) {
            showMessage('Please enter a 6-digit code', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/auth/verify-2fa', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    secret: twoFASetup.secret,
                    code: twoFACode
                })
            });
            if (res.ok) {
                setTwoFAEnabled(true);
                setTwoFASetup(null);
                setTwoFACode('');
                showMessage('Two-Factor Authentication enabled successfully!');
            } else {
                const data = await res.json();
                showMessage(data.error || 'Invalid verification code', 'error');
            }
        } catch (err) {
            showMessage('Error verifying 2FA', 'error');
        }
        setSaving(false);
    };

    const handleDisable2FA = async (e) => {
        e.preventDefault();
        if (!disablePassword) {
            showMessage('Please enter your password', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/auth/disable-2fa', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ password: disablePassword })
            });
            if (res.ok) {
                setTwoFAEnabled(false);
                setDisablePassword('');
                showMessage('Two-Factor Authentication disabled');
            } else {
                const data = await res.json();
                showMessage(data.error || 'Failed to disable 2FA', 'error');
            }
        } catch (err) {
            showMessage('Error disabling 2FA', 'error');
        }
        setSaving(false);
    };

    const handlePreferencesSave = async () => {
        setSaving(true);
        // In production, this would save to user preferences API
        await new Promise(r => setTimeout(r, 500));
        showMessage('Preferences saved!');
        setSaving(false);
    };

    if (loading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading settings...</p></div>;
    }

    return (
        <div className={`page ${styles.settingsPage}`}>
            <header className={styles.header}>
                <h1><Icons.Settings size={28} /> Settings</h1>
                <p>Manage your account and preferences</p>
            </header>

            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.type === 'success' ? <Icons.Check size={18} /> : <Icons.AlertCircle size={18} />}
                    {message.text}
                </div>
            )}

            <div className={styles.settingsLayout}>
                {/* Sidebar */}
                <div className={styles.sidebar}>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.active : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <Icons.User size={18} /> Profile
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'security' ? styles.active : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        <Icons.Shield size={18} /> Security
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'notifications' ? styles.active : ''}`}
                        onClick={() => setActiveTab('notifications')}
                    >
                        <Icons.Bell size={18} /> Notifications
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'preferences' ? styles.active : ''}`}
                        onClick={() => setActiveTab('preferences')}
                    >
                        <Icons.Settings size={18} /> Preferences
                    </button>
                </div>

                {/* Content */}
                <div className={styles.content}>
                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className={`card ${styles.tabContent}`}>
                            <h2>Profile Information</h2>
                            <p>Update your personal information</p>

                            <form onSubmit={handleProfileSave} className={styles.form}>
                                <div className={styles.avatarSection}>
                                    <div className={styles.avatar}>
                                        {profile.full_name?.charAt(0) || 'U'}
                                    </div>
                                    <div>
                                        <strong>{profile.full_name || 'User'}</strong>
                                        <span className={styles.role}>{user?.role}</span>
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className="input-group">
                                        <label className="input-label">Full Name</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={profile.full_name}
                                            onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Email</label>
                                        <input
                                            type="email"
                                            className="input"
                                            value={profile.email}
                                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className={styles.formRow}>
                                    <div className="input-group">
                                        <label className="input-label">Phone</label>
                                        <input
                                            type="tel"
                                            className="input"
                                            value={profile.phone}
                                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Address</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={profile.address}
                                            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <h3 className={styles.sectionTitle}>Emergency Contact</h3>
                                <div className={styles.formRow}>
                                    <div className="input-group">
                                        <label className="input-label">Contact Name</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={profile.emergency_contact}
                                            onChange={(e) => setProfile({ ...profile, emergency_contact: e.target.value })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Contact Phone</label>
                                        <input
                                            type="tel"
                                            className="input"
                                            value={profile.emergency_phone}
                                            onChange={(e) => setProfile({ ...profile, emergency_phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className={styles.formActions}>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <div className={`card ${styles.tabContent}`}>
                            <h2>Security Settings</h2>
                            <p>Manage your password and security options</p>

                            <form onSubmit={handlePasswordChange} className={styles.form}>
                                <h3 className={styles.sectionTitle}>Change Password</h3>

                                <div className="input-group">
                                    <label className="input-label">Current Password</label>
                                    <input
                                        type="password"
                                        className="input"
                                        value={password.current}
                                        onChange={(e) => setPassword({ ...password, current: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className={styles.formRow}>
                                    <div className="input-group">
                                        <label className="input-label">New Password</label>
                                        <input
                                            type="password"
                                            className="input"
                                            value={password.new}
                                            onChange={(e) => setPassword({ ...password, new: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Confirm New Password</label>
                                        <input
                                            type="password"
                                            className="input"
                                            value={password.confirm}
                                            onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className={styles.formActions}>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </form>

                            <div className={styles.twoFactorSection}>
                                <h3 className={styles.sectionTitle}>
                                    <Icons.Shield size={20} /> Two-Factor Authentication (2FA)
                                </h3>
                                <p className={styles.twoFactorDesc}>
                                    Add an extra layer of security using a time-based one-time password (TOTP) from an authenticator app like Google Authenticator or Authy.
                                </p>

                                {twoFAEnabled ? (
                                    <div className={styles.twoFactorEnabled}>
                                        <div className={styles.statusBadge}>
                                            <Icons.Check size={16} /> 2FA is Enabled
                                        </div>
                                        <form onSubmit={handleDisable2FA} className={styles.disableForm}>
                                            <p>To disable 2FA, enter your password:</p>
                                            <div className={styles.disableRow}>
                                                <input
                                                    type="password"
                                                    className="input"
                                                    placeholder="Enter your password"
                                                    value={disablePassword}
                                                    onChange={(e) => setDisablePassword(e.target.value)}
                                                />
                                                <button type="submit" className="btn btn-danger" disabled={saving}>
                                                    Disable 2FA
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                ) : twoFASetup ? (
                                    <div className={styles.twoFactorSetup}>
                                        <div className={styles.setupSteps}>
                                            <div className={styles.step}>
                                                <span className={styles.stepNum}>1</span>
                                                <div>
                                                    <strong>Install an authenticator app</strong>
                                                    <p>Download Google Authenticator, Authy, or any TOTP app on your phone.</p>
                                                </div>
                                            </div>
                                            <div className={styles.step}>
                                                <span className={styles.stepNum}>2</span>
                                                <div>
                                                    <strong>Scan the QR code or enter the secret key</strong>
                                                    <div className={styles.qrContainer}>
                                                        <img
                                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(twoFASetup.uri)}`}
                                                            alt="2FA QR Code"
                                                            className={styles.qrCode}
                                                        />
                                                    </div>
                                                    <div className={styles.secretKey}>
                                                        <label>Or enter this secret key manually:</label>
                                                        <code>{twoFASetup.secret}</code>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={styles.step}>
                                                <span className={styles.stepNum}>3</span>
                                                <div>
                                                    <strong>Enter the 6-digit code from your app</strong>
                                                    <form onSubmit={handleVerify2FA} className={styles.verifyForm}>
                                                        <input
                                                            type="text"
                                                            className="input"
                                                            placeholder="000000"
                                                            maxLength={6}
                                                            value={twoFACode}
                                                            onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                                                            style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                                                        />
                                                        <div className={styles.verifyActions}>
                                                            <button type="button" className="btn btn-secondary" onClick={() => setTwoFASetup(null)}>
                                                                Cancel
                                                            </button>
                                                            <button type="submit" className="btn btn-primary" disabled={saving || twoFACode.length !== 6}>
                                                                {saving ? 'Verifying...' : 'Verify & Enable'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button className="btn btn-primary" onClick={handleSetup2FA} disabled={saving}>
                                        <Icons.Shield size={16} /> {saving ? 'Setting up...' : 'Enable 2FA'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Notifications Tab */}
                    {activeTab === 'notifications' && (
                        <div className={`card ${styles.tabContent}`}>
                            <h2>Notification Settings</h2>
                            <p>Choose how you want to receive notifications</p>

                            <div className={styles.toggleList}>
                                <div className={styles.toggleItem}>
                                    <div>
                                        <strong>Email Notifications</strong>
                                        <p>Receive updates via email</p>
                                    </div>
                                    <label className={styles.toggle}>
                                        <input
                                            type="checkbox"
                                            checked={preferences.email_notifications}
                                            onChange={(e) => setPreferences({ ...preferences, email_notifications: e.target.checked })}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.toggleItem}>
                                    <div>
                                        <strong>SMS Notifications</strong>
                                        <p>Receive text messages for urgent alerts</p>
                                    </div>
                                    <label className={styles.toggle}>
                                        <input
                                            type="checkbox"
                                            checked={preferences.sms_notifications}
                                            onChange={(e) => setPreferences({ ...preferences, sms_notifications: e.target.checked })}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.toggleItem}>
                                    <div>
                                        <strong>Push Notifications</strong>
                                        <p>Browser push notifications</p>
                                    </div>
                                    <label className={styles.toggle}>
                                        <input
                                            type="checkbox"
                                            checked={preferences.push_notifications}
                                            onChange={(e) => setPreferences({ ...preferences, push_notifications: e.target.checked })}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>

                            <div className={styles.formActions}>
                                <button className="btn btn-primary" onClick={handlePreferencesSave} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Preferences'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Preferences Tab */}
                    {activeTab === 'preferences' && (
                        <div className={`card ${styles.tabContent}`}>
                            <h2>App Preferences</h2>
                            <p>Customize your app experience</p>

                            <div className={styles.toggleList}>
                                <div className={styles.toggleItem}>
                                    <div>
                                        <strong>Dark Mode</strong>
                                        <p>Use dark theme</p>
                                    </div>
                                    <label className={styles.toggle}>
                                        <input
                                            type="checkbox"
                                            checked={preferences.dark_mode}
                                            onChange={(e) => setPreferences({ ...preferences, dark_mode: e.target.checked })}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className="input-group">
                                    <label className="input-label">Language</label>
                                    <select
                                        className="input"
                                        value={preferences.language}
                                        onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                                    >
                                        <option value="en">English</option>
                                        <option value="es">Español</option>
                                        <option value="fr">Français</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Timezone</label>
                                    <select
                                        className="input"
                                        value={preferences.timezone}
                                        onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                                    >
                                        <option value="America/New_York">Eastern Time</option>
                                        <option value="America/Chicago">Central Time</option>
                                        <option value="America/Denver">Mountain Time</option>
                                        <option value="America/Los_Angeles">Pacific Time</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formActions}>
                                <button className="btn btn-primary" onClick={handlePreferencesSave} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Preferences'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
