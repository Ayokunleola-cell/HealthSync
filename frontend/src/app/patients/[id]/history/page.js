'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

// SVG Icon components for record types
const RecordIcons = {
    Prescription: ({ size = 16 }) => <Icons.Pill size={size} />,
    Diagnosis: ({ size = 16 }) => <Icons.Microscope size={size} />,
    Consultation: ({ size = 16 }) => <Icons.Doctor size={size} />,
    Issue: ({ size = 16 }) => <Icons.AlertTriangle size={size} />,
    CareLog: ({ size = 16 }) => <Icons.FileText size={size} />,
    MedicalNote: ({ size = 16 }) => <Icons.Clipboard size={size} />,
    VideoNote: ({ size = 16 }) => <Icons.Video size={size} />,
    CaregiverReport: ({ size = 16 }) => <Icons.Nurse size={size} />,
    DoctorReport: ({ size = 16 }) => <Icons.Report size={size} />,
    Calendar: ({ size = 16 }) => <Icons.Calendar size={size} />,
    Star: ({ size = 16 }) => <Icons.Star size={size} />,
    Check: ({ size = 16 }) => <Icons.Check size={size} />,
    Inbox: ({ size = 16 }) => <Icons.Inbox size={size} />,
};

// Record type configuration
const recordTypes = {
    prescription: { Icon: RecordIcons.Prescription, label: 'Prescription', color: '#8b5cf6' },
    diagnosis: { Icon: RecordIcons.Diagnosis, label: 'Diagnosis', color: '#ef4444' },
    consultation: { Icon: RecordIcons.Consultation, label: 'Consultation', color: '#3b82f6' },
    issue: { Icon: RecordIcons.Issue, label: 'Issue', color: '#f59e0b' },
    care_log: { Icon: RecordIcons.CareLog, label: 'Care Log', color: '#10b981' },
    medical_note: { Icon: RecordIcons.MedicalNote, label: 'Medical Note', color: '#6366f1' },
    video_note: { Icon: RecordIcons.VideoNote, label: 'Video Note', color: '#ec4899' },
    caregiver_report: { Icon: RecordIcons.CaregiverReport, label: 'Caregiver Report', color: '#14b8a6' },
    doctor_report: { Icon: RecordIcons.DoctorReport, label: 'Doctor Report', color: '#0ea5e9' }
};

export default function PatientHistoryPage() {
    const { id: patientId } = useParams();
    const { token, loading, getAuthHeaders } = useAuth();
    const [history, setHistory] = useState(null);
    const [activeTab, setActiveTab] = useState('timeline');
    const [patient, setPatient] = useState(null);
    const [filterType, setFilterType] = useState('all');

    const fetchPatientHistory = useCallback(async () => {
        try {
            const [historyRes, patientRes] = await Promise.all([
                fetch(`/api/patients/${patientId}/history`, { headers: getAuthHeaders() }),
                fetch(`/api/patients/${patientId}`, { headers: getAuthHeaders() })
            ]);
            const historyData = await historyRes.json();
            const patientData = await patientRes.json();
            setHistory(historyData);
            setPatient(patientData.patient || patientData);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        }
    }, [patientId, getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchPatientHistory();
    }, [token, loading, fetchPatientHistory]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const getFilteredTimeline = () => {
        if (!history?.timeline) return [];
        if (filterType === 'all') return history.timeline;
        return history.timeline.filter(item => item.type === filterType);
    };

    const renderTimelineItem = (item) => {
        const config = recordTypes[item.type] || { Icon: RecordIcons.CareLog, label: item.type, color: '#6b7280' };
        const IconComponent = config.Icon;
        const data = item.data;

        return (
            <div key={data.id} className={styles.timelineItem}>
                <div className={styles.timelineDot} style={{ background: config.color }}>
                    <IconComponent size={14} />
                </div>
                <div className={styles.timelineContent}>
                    <div className={styles.timelineHeader}>
                        <span className={styles.recordType} style={{ background: `${config.color}15`, color: config.color }}>
                            {config.label}
                        </span>
                        <span className={styles.recordDate}>{formatDate(item.date)}</span>
                    </div>
                    <div className={styles.recordBody}>
                        {renderRecordContent(item.type, data)}
                    </div>
                </div>
            </div>
        );
    };

    const renderRecordContent = (type, data) => {
        switch (type) {
            case 'prescription':
                return (
                    <>
                        <h4>{data.medication_name}</h4>
                        <p><strong>Dosage:</strong> {data.dosage} | <strong>Frequency:</strong> {data.frequency}</p>
                        {data.instructions && <p className={styles.instructions}>{data.instructions}</p>}
                        <span className={styles.author}>Prescribed by {data.physician_name}</span>
                    </>
                );
            case 'diagnosis':
                return (
                    <>
                        <h4>{data.title}</h4>
                        {data.severity && <span className={`${styles.severity} ${styles[data.severity]}`}>{data.severity}</span>}
                        {data.description && <p>{data.description}</p>}
                        {data.test_results && <p><strong>Results:</strong> {data.test_results}</p>}
                        <span className={styles.author}>Recorded by {data.physician_name}</span>
                    </>
                );
            case 'consultation':
                return (
                    <>
                        <h4>{data.consultation_type} Consultation</h4>
                        {data.chief_complaint && <p><strong>Chief Complaint:</strong> {data.chief_complaint}</p>}
                        {data.assessment && <p><strong>Assessment:</strong> {data.assessment}</p>}
                        {data.treatment_plan && <p><strong>Treatment:</strong> {data.treatment_plan}</p>}
                        <span className={styles.author}>By {data.physician_name}</span>
                    </>
                );
            case 'issue':
                return (
                    <>
                        <h4>{data.title}</h4>
                        <span className={`${styles.issueStatus} ${styles[data.status]}`}>{data.status}</span>
                        {data.severity && <span className={`${styles.severity} ${styles[data.severity]}`}>{data.severity}</span>}
                        {data.description && <p>{data.description}</p>}
                        {data.resolution && <p className={styles.resolution}><strong>Resolution:</strong> {data.resolution}</p>}
                        <span className={styles.author}>Reported by {data.reporter_name}</span>
                    </>
                );
            case 'care_log':
                return (
                    <>
                        <h4>{data.title || data.log_type}</h4>
                        {data.details && <p>{data.details}</p>}
                        <span className={styles.author}>By {data.caregiver_name}</span>
                    </>
                );
            case 'medical_note':
                return (
                    <>
                        <h4>{data.title || data.note_type}</h4>
                        {data.content && <p>{data.content}</p>}
                        <span className={styles.author}>By {data.physician_name}</span>
                    </>
                );
            case 'video_note':
                return (
                    <>
                        <h4>Video Call {data.note_type}</h4>
                        <p>{data.content}</p>
                        {data.is_important && <span className={styles.importantBadge}><Icons.Star size={12} /> Important</span>}
                        <span className={styles.author}>By {data.author_name}</span>
                    </>
                );
            case 'caregiver_report':
                return (
                    <>
                        <h4>Daily Report - {formatDate(data.report_date).split(',')[0]}</h4>
                        <div className={styles.reportGrid}>
                            {data.overall_status && <span><strong>Status:</strong> {data.overall_status}</span>}
                            {data.mood_assessment && <span><strong>Mood:</strong> {data.mood_assessment}</span>}
                            {data.appetite && <span><strong>Appetite:</strong> {data.appetite}</span>}
                            {data.sleep_quality && <span><strong>Sleep:</strong> {data.sleep_quality}</span>}
                        </div>
                        {data.concerns && <p className={styles.concerns}><strong>Concerns:</strong> {data.concerns}</p>}
                        {data.recommendations && <p><strong>Recommendations:</strong> {data.recommendations}</p>}
                        <span className={styles.author}>By {data.caregiver_name}</span>
                    </>
                );
            case 'doctor_report':
                return (
                    <>
                        <h4>{data.report_type} Report</h4>
                        {data.diagnosis && <p><strong>Diagnosis:</strong> {data.diagnosis}</p>}
                        {data.assessment && <p><strong>Assessment:</strong> {data.assessment}</p>}
                        {data.treatment_plan && <p><strong>Treatment Plan:</strong> {data.treatment_plan}</p>}
                        {data.is_signed && <span className={styles.signedBadge}><Icons.Check size={12} /> Signed</span>}
                        <span className={styles.author}>By {data.physician_name}</span>
                    </>
                );
            default:
                return <p>{JSON.stringify(data)}</p>;
        }
    };

    if (loading || !history) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading patient history...</p></div>;
    }

    return (
        <div className={`page ${styles.historyPage}`}>
            <header className={styles.header}>
                <Link href={`/patients/${patientId}`} className={styles.backLink}>
                    <Icons.ArrowLeft size={16} /> Back to Patient
                </Link>
                <div className={styles.patientInfo}>
                    <div className={styles.patientAvatar}>{patient?.name?.charAt(0)}</div>
                    <div>
                        <h1>{patient?.name}&apos;s Care History</h1>
                        <p>{patient?.condition}</p>
                    </div>
                </div>
            </header>

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryIcon}><Icons.Pill size={24} /></span>
                    <span className={styles.summaryValue}>{history.prescriptions?.length || 0}</span>
                    <span className={styles.summaryLabel}>Prescriptions</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryIcon}><Icons.Microscope size={24} /></span>
                    <span className={styles.summaryValue}>{history.diagnoses?.length || 0}</span>
                    <span className={styles.summaryLabel}>Diagnoses</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryIcon}><Icons.Doctor size={24} /></span>
                    <span className={styles.summaryValue}>{history.consultations?.length || 0}</span>
                    <span className={styles.summaryLabel}>Consultations</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryIcon}><Icons.Report size={24} /></span>
                    <span className={styles.summaryValue}>{history.doctor_reports?.length || 0}</span>
                    <span className={styles.summaryLabel}>Doctor Reports</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryIcon}><Icons.Nurse size={24} /></span>
                    <span className={styles.summaryValue}>{history.caregiver_reports?.length || 0}</span>
                    <span className={styles.summaryLabel}>Caregiver Reports</span>
                </div>
                <div className={styles.summaryCard}>
                    <span className={styles.summaryIcon}><Icons.AlertTriangle size={24} /></span>
                    <span className={styles.summaryValue}>{history.issues?.filter(i => i.status === 'open').length || 0}</span>
                    <span className={styles.summaryLabel}>Open Issues</span>
                </div>
            </div>

            {/* Tabs */}
            <div className={styles.tabs}>
                <button className={activeTab === 'timeline' ? styles.activeTab : ''} onClick={() => setActiveTab('timeline')}>
                    <Icons.Calendar size={16} /> Timeline
                </button>
                <button className={activeTab === 'prescriptions' ? styles.activeTab : ''} onClick={() => setActiveTab('prescriptions')}>
                    <Icons.Pill size={16} /> Prescriptions
                </button>
                <button className={activeTab === 'reports' ? styles.activeTab : ''} onClick={() => setActiveTab('reports')}>
                    <Icons.Report size={16} /> Reports
                </button>
                <button className={activeTab === 'issues' ? styles.activeTab : ''} onClick={() => setActiveTab('issues')}>
                    <Icons.AlertTriangle size={16} /> Issues
                </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {activeTab === 'timeline' && (
                    <div className={styles.timelineSection}>
                        <div className={styles.filterBar}>
                            <label><Icons.Filter size={14} /> Filter by type:</label>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                <option value="all">All Records</option>
                                <option value="prescription">Prescriptions</option>
                                <option value="diagnosis">Diagnoses</option>
                                <option value="consultation">Consultations</option>
                                <option value="caregiver_report">Caregiver Reports</option>
                                <option value="doctor_report">Doctor Reports</option>
                                <option value="issue">Issues</option>
                                <option value="video_note">Video Notes</option>
                                <option value="care_log">Care Logs</option>
                            </select>
                        </div>
                        <div className={styles.timeline}>
                            {getFilteredTimeline().length === 0 ? (
                                <div className={styles.emptyState}>
                                    <Icons.Inbox size={48} />
                                    <p>No records found</p>
                                </div>
                            ) : (
                                getFilteredTimeline().map(renderTimelineItem)
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'prescriptions' && (
                    <div className={styles.listSection}>
                        <h3>Active Prescriptions</h3>
                        {history.prescriptions?.filter(p => p.status === 'active').length === 0 ? (
                            <p className={styles.emptyText}>No active prescriptions</p>
                        ) : (
                            history.prescriptions?.filter(p => p.status === 'active').map(rx => (
                                <div key={rx.id} className={styles.listCard}>
                                    <div className={styles.listHeader}>
                                        <h4>{rx.medication_name}</h4>
                                        <span className={styles.statusBadge}>{rx.status}</span>
                                    </div>
                                    <p><strong>Dosage:</strong> {rx.dosage} | <strong>Frequency:</strong> {rx.frequency}</p>
                                    {rx.instructions && <p>{rx.instructions}</p>}
                                    <span className={styles.author}>Prescribed by {rx.physician_name} on {formatDate(rx.created_at)}</span>
                                </div>
                            ))
                        )}

                        <h3 style={{ marginTop: '2rem' }}>Current Medications</h3>
                        {history.medications?.filter(m => m.is_active).length === 0 ? (
                            <p className={styles.emptyText}>No current medications</p>
                        ) : (
                            history.medications?.filter(m => m.is_active).map(med => (
                                <div key={med.id} className={styles.listCard}>
                                    <h4>{med.name}</h4>
                                    <p><strong>Dosage:</strong> {med.dosage} | <strong>Frequency:</strong> {med.frequency}</p>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'reports' && (
                    <div className={styles.reportsSection}>
                        <div className={styles.reportColumn}>
                            <h3><Icons.Doctor size={18} /> Doctor Reports</h3>
                            {history.doctor_reports?.length === 0 ? (
                                <p className={styles.emptyText}>No doctor reports</p>
                            ) : (
                                history.doctor_reports?.map(report => (
                                    <div key={report.id} className={styles.reportCard}>
                                        <div className={styles.reportHeader}>
                                            <span className={styles.reportType}>{report.report_type}</span>
                                            {report.is_signed && <span className={styles.signedBadge}><Icons.Check size={12} /> Signed</span>}
                                        </div>
                                        <span className={styles.reportDate}>{formatDate(report.report_date)}</span>
                                        {report.diagnosis && <p><strong>Diagnosis:</strong> {report.diagnosis}</p>}
                                        {report.assessment && <p><strong>Assessment:</strong> {report.assessment}</p>}
                                        {report.treatment_plan && <p><strong>Treatment:</strong> {report.treatment_plan}</p>}
                                        {report.caregiver_instructions && (
                                            <div className={styles.instructions}>
                                                <strong>For Caregivers:</strong> {report.caregiver_instructions}
                                            </div>
                                        )}
                                        <span className={styles.author}>By {report.physician_name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className={styles.reportColumn}>
                            <h3><Icons.Nurse size={18} /> Caregiver Reports</h3>
                            {history.caregiver_reports?.length === 0 ? (
                                <p className={styles.emptyText}>No caregiver reports</p>
                            ) : (
                                history.caregiver_reports?.map(report => (
                                    <div key={report.id} className={styles.reportCard}>
                                        <span className={styles.reportDate}>{formatDate(report.report_date)}</span>
                                        <div className={styles.statusGrid}>
                                            {report.overall_status && <span><strong>Status:</strong> {report.overall_status}</span>}
                                            {report.mood_assessment && <span><strong>Mood:</strong> {report.mood_assessment}</span>}
                                            {report.appetite && <span><strong>Appetite:</strong> {report.appetite}</span>}
                                            {report.sleep_quality && <span><strong>Sleep:</strong> {report.sleep_quality}</span>}
                                            {report.pain_level !== null && <span><strong>Pain:</strong> {report.pain_level}/10</span>}
                                        </div>
                                        {report.activities_completed && <p><strong>Activities:</strong> {report.activities_completed}</p>}
                                        {report.concerns && <p className={styles.concerns}><strong>Concerns:</strong> {report.concerns}</p>}
                                        {report.incidents && <p className={styles.incidents}><strong>Incidents:</strong> {report.incidents}</p>}
                                        <span className={styles.author}>By {report.caregiver_name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'issues' && (
                    <div className={styles.issuesSection}>
                        <h3>Open Issues</h3>
                        {history.issues?.filter(i => i.status !== 'resolved').length === 0 ? (
                            <p className={styles.emptyText}>No open issues</p>
                        ) : (
                            history.issues?.filter(i => i.status !== 'resolved').map(issue => (
                                <div key={issue.id} className={`${styles.issueCard} ${styles[issue.severity]}`}>
                                    <div className={styles.issueHeader}>
                                        <h4>{issue.title}</h4>
                                        <span className={`${styles.severityBadge} ${styles[issue.severity]}`}>{issue.severity}</span>
                                    </div>
                                    <span className={styles.issueType}>{issue.issue_type}</span>
                                    {issue.description && <p>{issue.description}</p>}
                                    <span className={styles.author}>Reported by {issue.reporter_name} on {formatDate(issue.created_at)}</span>
                                </div>
                            ))
                        )}

                        <h3 style={{ marginTop: '2rem' }}>Resolved Issues</h3>
                        {history.issues?.filter(i => i.status === 'resolved').length === 0 ? (
                            <p className={styles.emptyText}>No resolved issues</p>
                        ) : (
                            history.issues?.filter(i => i.status === 'resolved').map(issue => (
                                <div key={issue.id} className={`${styles.issueCard} ${styles.resolved}`}>
                                    <div className={styles.issueHeader}>
                                        <h4>{issue.title}</h4>
                                        <span className={styles.resolvedBadge}><Icons.Check size={12} /> Resolved</span>
                                    </div>
                                    <p>{issue.description}</p>
                                    {issue.resolution && (
                                        <div className={styles.resolution}>
                                            <strong>Resolution:</strong> {issue.resolution}
                                        </div>
                                    )}
                                    <span className={styles.author}>Resolved by {issue.resolver_name}</span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
