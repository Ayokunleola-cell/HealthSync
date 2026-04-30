'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function ResetPassword() {
    const searchParams = useSearchParams();
    const [token, setToken] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        const tokenParam = searchParams.get('token');
        if (tokenParam) {
            setToken(tokenParam);
        }
    }, [searchParams]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Reset failed');
            }

            setMessage(data.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className={styles.authPage}>
                <div className={styles.authCard}>
                    <div className={styles.errorBox}>
                        <p>Invalid or missing reset token.</p>
                        <Link href="/forgot-password" className="btn btn-primary">
                            Request New Reset Link
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <div className={styles.logoSection}>
                    <div className={styles.logoIcon}>+</div>
                    <h1 className={styles.logoText}>HealthSync</h1>
                    <p className={styles.tagline}>Reset Your Password</p>
                </div>

                {message ? (
                    <div className={styles.successBox}>
                        <p>{message}</p>
                        <Link href="/login" className="btn btn-primary">Go to Login</Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className="input-group">
                            <label className="input-label">New Password</label>
                            <input
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter new password"
                                required
                                minLength={8}
                                disabled={loading}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Confirm Password</label>
                            <input
                                type="password"
                                className="input"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                required
                                disabled={loading}
                            />
                        </div>

                        {error && <div className={styles.errorMessage}>{error}</div>}

                        <button
                            type="submit"
                            className={`btn btn-primary ${styles.submitBtn}`}
                            disabled={loading}
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
