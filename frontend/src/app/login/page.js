'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRoleDashboard } from '@/components/AuthProvider';
import styles from './page.module.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        if (token && user) {
            try {
                const userData = JSON.parse(user);
                router.push(getRoleDashboard(userData.role));
            } catch (e) {
                // Invalid user data
            }
        }
    }, [router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server error. Please ensure the backend is running on port 5000.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = getRoleDashboard(data.user.role);
        } catch (err) {
            setError(err.message || 'Invalid credentials. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginCard}>
                <div className={styles.logoSection}>
                    <div className={styles.logoIcon}>+</div>
                    <h1 className={styles.logoText}>HealthSync</h1>
                    <p className={styles.tagline}>Comprehensive Home Care Platform</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className="input-group">
                        <label className="input-label">Username</label>
                        <input
                            type="text"
                            className="input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
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
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>

                    <p className={styles.forgotLink}>
                        <a href="/forgot-password">Forgot your password?</a>
                    </p>
                </form>

                <p className={styles.signupLink}>
                    New healthcare organization? <a href="/signup">Register here</a>
                </p>
            </div>
        </div>
    );
}
