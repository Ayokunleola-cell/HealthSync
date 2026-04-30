'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            setMessage(data.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.authPage}>
            <div className={styles.authCard}>
                <div className={styles.logoSection}>
                    <div className={styles.logoIcon}>+</div>
                    <h1 className={styles.logoText}>HealthSync</h1>
                    <p className={styles.tagline}>Password Recovery</p>
                </div>

                {message ? (
                    <div className={styles.successBox}>
                        <p>{message}</p>
                        <Link href="/login" className="btn btn-primary">Return to Login</Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <p className={styles.instructions}>
                            Enter your email address and we will send you a link to reset your password.
                        </p>

                        <div className="input-group">
                            <label className="input-label">Email Address</label>
                            <input
                                type="email"
                                className="input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
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
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>

                        <p className={styles.backLink}>
                            <Link href="/login">Back to Login</Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
