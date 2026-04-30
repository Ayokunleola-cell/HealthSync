'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function SignUpPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const [orgData, setOrgData] = useState({
        organization_name: '',
        organization_type: 'clinic',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        phone: '',
        email: '',
        website: ''
    });

    const [adminData, setAdminData] = useState({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        confirm_password: ''
    });

    const handleOrgChange = (e) => {
        setOrgData({ ...orgData, [e.target.name]: e.target.value });
    };

    const handleAdminChange = (e) => {
        setAdminData({ ...adminData, [e.target.name]: e.target.value });
    };

    const validateStep1 = () => {
        if (!orgData.organization_name.trim()) {
            setError('Organization name is required');
            return false;
        }
        if (!orgData.email.trim() || !orgData.email.includes('@')) {
            setError('Valid organization email is required');
            return false;
        }
        if (!orgData.phone.trim()) {
            setError('Organization phone is required');
            return false;
        }
        setError('');
        return true;
    };

    const validateStep2 = () => {
        if (!adminData.full_name.trim()) {
            setError('Administrator name is required');
            return false;
        }
        if (!adminData.email.trim() || !adminData.email.includes('@')) {
            setError('Valid administrator email is required');
            return false;
        }
        if (adminData.password.length < 8) {
            setError('Password must be at least 8 characters');
            return false;
        }
        if (adminData.password !== adminData.confirm_password) {
            setError('Passwords do not match');
            return false;
        }
        setError('');
        return true;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        }
    };

    const handleBack = () => {
        setStep(1);
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateStep2()) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/organizations/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organization: orgData,
                    admin: {
                        full_name: adminData.full_name,
                        email: adminData.email,
                        phone: adminData.phone,
                        password: adminData.password
                    }
                })
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
            } else {
                setError(data.error || 'Registration failed. Please try again.');
            }
        } catch (err) {
            setError('Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className={styles.signupPage}>
                <div className={styles.successContainer}>
                    <div className={styles.successIcon}>
                        <Icons.CheckCircle size={64} />
                    </div>
                    <h1>Registration Successful!</h1>
                    <p>Your organization <strong>{orgData.organization_name}</strong> has been registered.</p>
                    <p className={styles.successNote}>
                        An administrator account has been created for <strong>{adminData.email}</strong>.
                        You can now log in to access your dashboard.
                    </p>
                    <Link href="/login" className="btn btn-primary btn-lg">
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.signupPage}>
            <div className={styles.container}>
                {/* Left Panel - Branding */}
                <div className={styles.brandPanel}>
                    <div className={styles.brandContent}>
                        <div className={styles.logo}>
                            <Icons.Heart size={48} />
                            <span>HealthSync</span>
                        </div>
                        <h1>Join HealthSync</h1>
                        <p>Register your healthcare organization and start providing better care with our comprehensive management platform.</p>

                        <div className={styles.features}>
                            <div className={styles.feature}>
                                <Icons.Users size={24} />
                                <div>
                                    <h4>Team Management</h4>
                                    <p>Manage caregivers, physicians, and staff</p>
                                </div>
                            </div>
                            <div className={styles.feature}>
                                <Icons.Activity size={24} />
                                <div>
                                    <h4>Patient Monitoring</h4>
                                    <p>Real-time vitals and health tracking</p>
                                </div>
                            </div>
                            <div className={styles.feature}>
                                <Icons.Calendar size={24} />
                                <div>
                                    <h4>Scheduling</h4>
                                    <p>Appointments and shift management</p>
                                </div>
                            </div>
                            <div className={styles.feature}>
                                <Icons.Shield size={24} />
                                <div>
                                    <h4>HIPAA Compliant</h4>
                                    <p>Secure and private health data</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Panel - Form */}
                <div className={styles.formPanel}>
                    <div className={styles.formContainer}>
                        <div className={styles.formHeader}>
                            <h2>Create Your Account</h2>
                            <p>Step {step} of 2: {step === 1 ? 'Organization Details' : 'Administrator Account'}</p>
                        </div>

                        {/* Progress Steps */}
                        <div className={styles.progressSteps}>
                            <div className={`${styles.stepIndicator} ${step >= 1 ? styles.active : ''}`}>
                                <div className={styles.stepNumber}>1</div>
                                <span>Organization</span>
                            </div>
                            <div className={styles.stepLine}></div>
                            <div className={`${styles.stepIndicator} ${step >= 2 ? styles.active : ''}`}>
                                <div className={styles.stepNumber}>2</div>
                                <span>Administrator</span>
                            </div>
                        </div>

                        {error && (
                            <div className={styles.errorMessage}>
                                <Icons.AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            {step === 1 && (
                                <div className={styles.formStep}>
                                    <div className="input-group">
                                        <label className="input-label">Organization Name*</label>
                                        <input
                                            type="text"
                                            name="organization_name"
                                            className="input"
                                            value={orgData.organization_name}
                                            onChange={handleOrgChange}
                                            placeholder="e.g., Sunrise Healthcare Clinic"
                                            required
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">Organization Type*</label>
                                        <select
                                            name="organization_type"
                                            className="input"
                                            value={orgData.organization_type}
                                            onChange={handleOrgChange}
                                        >
                                            <option value="clinic">Clinic</option>
                                            <option value="hospital">Hospital</option>
                                            <option value="home_care_agency">Home Care Agency</option>
                                            <option value="nursing_home">Nursing Home</option>
                                            <option value="assisted_living">Assisted Living Facility</option>
                                            <option value="hospice">Hospice</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    <div className={styles.formRow}>
                                        <div className="input-group">
                                            <label className="input-label">Organization Email*</label>
                                            <input
                                                type="email"
                                                name="email"
                                                className="input"
                                                value={orgData.email}
                                                onChange={handleOrgChange}
                                                placeholder="contact@organization.com"
                                                required
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label">Phone Number*</label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                className="input"
                                                value={orgData.phone}
                                                onChange={handleOrgChange}
                                                placeholder="(555) 123-4567"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">Street Address</label>
                                        <input
                                            type="text"
                                            name="address"
                                            className="input"
                                            value={orgData.address}
                                            onChange={handleOrgChange}
                                            placeholder="123 Healthcare Drive"
                                        />
                                    </div>

                                    <div className={styles.formRow}>
                                        <div className="input-group">
                                            <label className="input-label">City</label>
                                            <input
                                                type="text"
                                                name="city"
                                                className="input"
                                                value={orgData.city}
                                                onChange={handleOrgChange}
                                                placeholder="City"
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label">State</label>
                                            <input
                                                type="text"
                                                name="state"
                                                className="input"
                                                value={orgData.state}
                                                onChange={handleOrgChange}
                                                placeholder="State"
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label">ZIP Code</label>
                                            <input
                                                type="text"
                                                name="zip_code"
                                                className="input"
                                                value={orgData.zip_code}
                                                onChange={handleOrgChange}
                                                placeholder="12345"
                                            />
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">Website (optional)</label>
                                        <input
                                            type="url"
                                            name="website"
                                            className="input"
                                            value={orgData.website}
                                            onChange={handleOrgChange}
                                            placeholder="https://www.organization.com"
                                        />
                                    </div>

                                    <div className={styles.formActions}>
                                        <Link href="/login" className="btn btn-secondary">
                                            Back to Login
                                        </Link>
                                        <button type="button" className="btn btn-primary" onClick={handleNext}>
                                            Continue <Icons.ArrowRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className={styles.formStep}>
                                    <p className={styles.stepInfo}>
                                        Create the administrator account for your organization. This person will have full access to manage users, patients, and settings.
                                    </p>

                                    <div className="input-group">
                                        <label className="input-label">Full Name*</label>
                                        <input
                                            type="text"
                                            name="full_name"
                                            className="input"
                                            value={adminData.full_name}
                                            onChange={handleAdminChange}
                                            placeholder="John Smith"
                                            required
                                        />
                                    </div>

                                    <div className={styles.formRow}>
                                        <div className="input-group">
                                            <label className="input-label">Email Address*</label>
                                            <input
                                                type="email"
                                                name="email"
                                                className="input"
                                                value={adminData.email}
                                                onChange={handleAdminChange}
                                                placeholder="admin@organization.com"
                                                required
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label">Phone Number</label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                className="input"
                                                value={adminData.phone}
                                                onChange={handleAdminChange}
                                                placeholder="(555) 123-4567"
                                            />
                                        </div>
                                    </div>

                                    <div className={styles.formRow}>
                                        <div className="input-group">
                                            <label className="input-label">Password*</label>
                                            <input
                                                type="password"
                                                name="password"
                                                className="input"
                                                value={adminData.password}
                                                onChange={handleAdminChange}
                                                placeholder="Minimum 8 characters"
                                                required
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label className="input-label">Confirm Password*</label>
                                            <input
                                                type="password"
                                                name="confirm_password"
                                                className="input"
                                                value={adminData.confirm_password}
                                                onChange={handleAdminChange}
                                                placeholder="Re-enter password"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className={styles.termsBox}>
                                        <label className={styles.checkbox}>
                                            <input type="checkbox" required />
                                            <span>I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></span>
                                        </label>
                                    </div>

                                    <div className={styles.formActions}>
                                        <button type="button" className="btn btn-secondary" onClick={handleBack}>
                                            <Icons.ArrowLeft size={18} /> Back
                                        </button>
                                        <button type="submit" className="btn btn-primary" disabled={loading}>
                                            {loading ? 'Creating Account...' : 'Create Organization'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>

                        <div className={styles.loginLink}>
                            Already have an account? <Link href="/login">Sign in</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
