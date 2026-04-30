'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

const REPORT_TYPES = [
    { id: 'care_summary', label: 'Care Summary Report', description: 'Overview of care activities and logs', icon: 'Clipboard' },
    { id: 'time_tracking', label: 'Time Tracking Report', description: 'Caregiver hours and timesheets', icon: 'Clock' },
    { id: 'medication', label: 'Medication Report', description: 'Medication administration records', icon: 'Pill' },
    { id: 'vitals', label: 'Vitals Report', description: 'Patient vital signs history', icon: 'Activity' },
    { id: 'adl', label: 'ADL Report', description: 'Activities of Daily Living summary', icon: 'CheckCircle' },
    { id: 'billing', label: 'Billing Report', description: 'Invoice and payment summary', icon: 'DollarSign' },
];

export default function ReportsPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [patients, setPatients] = useState([]);
    const [caregivers, setCaregivers] = useState([]);
    const [selectedReport, setSelectedReport] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [filters, setFilters] = useState({
        patient_id: '',
        caregiver_id: '',
        start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        try {
            const [patientsRes, usersRes] = await Promise.all([
                fetch('/api/patients', { headers: getAuthHeaders() }),
                fetch('/api/users', { headers: getAuthHeaders() })
            ]);
            const patientsData = await patientsRes.json();
            const usersData = await usersRes.json();
            setPatients(patientsData.patients || []);
            setCaregivers((usersData.users || []).filter(u => u.role === 'caregiver'));
        } catch (err) {
            console.error('Failed to fetch data:', err);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchData();
    }, [token, loading, fetchData]);

    const generateReport = async (reportType) => {
        setGenerating(true);
        setSelectedReport(reportType);

        try {
            // Simulate report generation with mock data
            // In production, this would call specific report endpoints
            await new Promise(resolve => setTimeout(resolve, 1000));

            const mockData = generateMockReportData(reportType);
            setReportData(mockData);
        } catch (err) {
            console.error('Failed to generate report:', err);
        }
        setGenerating(false);
    };

    const generateMockReportData = (reportType) => {
        const baseStats = {
            generated_at: new Date().toISOString(),
            period: { start: filters.start_date, end: filters.end_date }
        };

        switch (reportType.id) {
            case 'care_summary':
                return {
                    ...baseStats,
                    title: 'Care Summary Report',
                    summary: {
                        total_patients: 12,
                        total_care_logs: 156,
                        total_tasks_completed: 89,
                        avg_daily_logs: 5.2
                    },
                    chart_data: [
                        { label: 'Week 1', value: 38 },
                        { label: 'Week 2', value: 42 },
                        { label: 'Week 3', value: 35 },
                        { label: 'Week 4', value: 41 }
                    ]
                };
            case 'time_tracking':
                return {
                    ...baseStats,
                    title: 'Time Tracking Report',
                    summary: {
                        total_hours: 480,
                        overtime_hours: 24,
                        avg_shift_length: 7.5,
                        total_shifts: 64
                    },
                    chart_data: [
                        { label: 'Week 1', value: 120 },
                        { label: 'Week 2', value: 125 },
                        { label: 'Week 3', value: 115 },
                        { label: 'Week 4', value: 120 }
                    ]
                };
            case 'medication':
                return {
                    ...baseStats,
                    title: 'Medication Administration Report',
                    summary: {
                        total_administered: 342,
                        on_time_rate: 95.2,
                        missed_doses: 8,
                        total_medications: 28
                    },
                    chart_data: [
                        { label: 'On Time', value: 326 },
                        { label: 'Late', value: 8 },
                        { label: 'Missed', value: 8 }
                    ]
                };
            case 'vitals':
                return {
                    ...baseStats,
                    title: 'Vitals Report',
                    summary: {
                        total_readings: 248,
                        abnormal_readings: 12,
                        avg_bp_systolic: 128,
                        avg_bp_diastolic: 82
                    },
                    chart_data: [
                        { label: 'Normal', value: 236 },
                        { label: 'Elevated', value: 8 },
                        { label: 'Critical', value: 4 }
                    ]
                };
            case 'adl':
                return {
                    ...baseStats,
                    title: 'ADL Summary Report',
                    summary: {
                        total_entries: 84,
                        avg_independence: 68,
                        improvement_rate: 12,
                        patients_tracked: 8
                    },
                    chart_data: [
                        { label: 'Independent', value: 35 },
                        { label: 'Minimal Assist', value: 28 },
                        { label: 'Moderate Assist', value: 15 },
                        { label: 'Total Assist', value: 6 }
                    ]
                };
            case 'billing':
                return {
                    ...baseStats,
                    title: 'Billing Summary Report',
                    summary: {
                        total_invoiced: 45600,
                        total_collected: 38400,
                        outstanding: 7200,
                        avg_payment_days: 18
                    },
                    chart_data: [
                        { label: 'Paid', value: 38400 },
                        { label: 'Pending', value: 4800 },
                        { label: 'Overdue', value: 2400 }
                    ]
                };
            default:
                return baseStats;
        }
    };

    const exportReport = (format) => {
        if (!reportData) return;

        const filename = `${selectedReport.id}_report_${filters.start_date}_${filters.end_date}.${format}`;

        if (format === 'csv') {
            const headers = Object.keys(reportData.summary).join(',');
            const values = Object.values(reportData.summary).join(',');
            const csv = `${headers}\n${values}`;
            downloadFile(csv, filename, 'text/csv');
        } else if (format === 'json') {
            downloadFile(JSON.stringify(reportData, null, 2), filename, 'application/json');
        }
    };

    const downloadFile = (content, filename, type) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    if (loading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading reports...</p></div>;
    }

    if (user?.role !== 'admin' && user?.role !== 'physician') {
        return (
            <div className={`page ${styles.reportsPage}`}>
                <div className={styles.accessDenied}>
                    <Icons.BarChart size={48} />
                    <h2>Reports</h2>
                    <p>Report generation is available for administrators and physicians only.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`page ${styles.reportsPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.BarChart size={28} /> Reports</h1>
                    <p>Generate and export care management reports</p>
                </div>
            </header>

            {/* Filters */}
            <div className={`card ${styles.filtersCard}`}>
                <h3><Icons.Filter size={18} /> Report Filters</h3>
                <div className={styles.filtersGrid}>
                    <div className="input-group">
                        <label className="input-label">Start Date</label>
                        <input
                            type="date"
                            className="input"
                            value={filters.start_date}
                            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">End Date</label>
                        <input
                            type="date"
                            className="input"
                            value={filters.end_date}
                            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Patient</label>
                        <select
                            className="input"
                            value={filters.patient_id}
                            onChange={(e) => setFilters({ ...filters, patient_id: e.target.value })}
                        >
                            <option value="">All Patients</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Caregiver</label>
                        <select
                            className="input"
                            value={filters.caregiver_id}
                            onChange={(e) => setFilters({ ...filters, caregiver_id: e.target.value })}
                        >
                            <option value="">All Caregivers</option>
                            {caregivers.map(c => (
                                <option key={c.id} value={c.id}>{c.full_name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Report Types */}
            <div className={styles.reportTypesGrid}>
                {REPORT_TYPES.map((report) => (
                    <div
                        key={report.id}
                        className={`${styles.reportCard} ${selectedReport?.id === report.id ? styles.selected : ''}`}
                        onClick={() => generateReport(report)}
                    >
                        <div className={styles.reportIcon}>
                            <Icons.FileText size={24} />
                        </div>
                        <div className={styles.reportInfo}>
                            <h4>{report.label}</h4>
                            <p>{report.description}</p>
                        </div>
                        <button className={styles.generateBtn}>
                            {generating && selectedReport?.id === report.id ? 'Generating...' : 'Generate'}
                        </button>
                    </div>
                ))}
            </div>

            {/* Report Results */}
            {reportData && (
                <div className={`card ${styles.resultCard}`}>
                    <div className={styles.resultHeader}>
                        <h3>{reportData.title}</h3>
                        <div className={styles.exportButtons}>
                            <button className="btn btn-secondary btn-sm" onClick={() => exportReport('csv')}>
                                <Icons.Download size={14} /> Export CSV
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => exportReport('json')}>
                                <Icons.Download size={14} /> Export JSON
                            </button>
                        </div>
                    </div>
                    <p className={styles.reportPeriod}>
                        Period: {reportData.period.start} to {reportData.period.end}
                    </p>

                    {/* Summary Stats */}
                    <div className={styles.summaryGrid}>
                        {Object.entries(reportData.summary).map(([key, value]) => (
                            <div key={key} className={styles.summaryItem}>
                                <span className={styles.summaryValue}>
                                    {typeof value === 'number' && key.includes('total') && key.includes('invoiced')
                                        ? formatCurrency(value)
                                        : typeof value === 'number' && key.includes('rate')
                                            ? `${value}%`
                                            : value}
                                </span>
                                <span className={styles.summaryLabel}>
                                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Simple Bar Chart */}
                    {reportData.chart_data && (
                        <div className={styles.chartSection}>
                            <h4>Breakdown</h4>
                            <div className={styles.barChart}>
                                {reportData.chart_data.map((item, idx) => {
                                    const maxValue = Math.max(...reportData.chart_data.map(d => d.value));
                                    const percentage = (item.value / maxValue) * 100;
                                    return (
                                        <div key={idx} className={styles.barItem}>
                                            <span className={styles.barLabel}>{item.label}</span>
                                            <div className={styles.barContainer}>
                                                <div
                                                    className={styles.bar}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                            <span className={styles.barValue}>{item.value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
