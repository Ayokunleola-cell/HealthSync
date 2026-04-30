'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import styles from './page.module.css';

// SVG Icons
const Icons = {
    Video: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>,
    VideoOff: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
    Mic: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
    MicOff: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" /><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
    Phone: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>,
    MessageSquare: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>,
    Calendar: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    Clock: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>,
    User: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    Users: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
    Plus: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
    X: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
    Stethoscope: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.8 2.3A.3.3 0 105 2H4a2 2 0 00-2 2v5a6 6 0 006 6v0a6 6 0 006-6V4a2 2 0 00-2-2h-1a.2.2 0 10.3.3" /><path d="M8 15v1a6 6 0 006 6v0a6 6 0 006-6v-4" /><circle cx="20" cy="10" r="2" /></svg>,
    Heart: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /></svg>,
};

// Role icons and colors
const roleConfig = {
    physician: { icon: '👨‍⚕️', label: 'Physician', color: '#3b82f6' },
    caregiver: { icon: '👩‍⚕️', label: 'Caregiver', color: '#10b981' },
    family: { icon: '👨‍👩‍👧', label: 'Family', color: '#8b5cf6' },
    patient: { icon: '🧑‍🦳', label: 'Patient', color: '#f59e0b' },
    admin: { icon: '⚙️', label: 'Admin', color: '#6b7280' },
};

export default function VideoPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { token, user, loading, getAuthHeaders } = useAuth();

    const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' or 'call'
    const [contacts, setContacts] = useState([]);
    const [patients, setPatients] = useState([]);
    const [scheduledCalls, setScheduledCalls] = useState([]);
    const [selectedContact, setSelectedContact] = useState(searchParams.get('contact') || '');
    const [selectedPatient, setSelectedPatient] = useState(searchParams.get('patient') || '');
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [transcript, setTranscript] = useState([]);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [showTranscript, setShowTranscript] = useState(true);

    // Schedule form
    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduleTitle, setScheduleTitle] = useState('');
    const [scheduleDuration, setScheduleDuration] = useState(30);
    const [scheduleParticipantType, setScheduleParticipantType] = useState('patient');

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const recognitionRef = useRef(null);
    const scheduledCallsIntervalRef = useRef(null);

    useEffect(() => {
        if (!token || loading) return;
        fetchContacts();
        fetchPatients();
        fetchScheduledCalls();

        // Real-time updates for scheduled calls every 20 seconds
        scheduledCallsIntervalRef.current = setInterval(fetchScheduledCalls, 20000);
        return () => {
            if (scheduledCallsIntervalRef.current) clearInterval(scheduledCallsIntervalRef.current);
        };
    }, [token, loading]);

    const fetchContacts = async () => {
        try {
            const res = await fetch('/api/video-call-contacts', { headers: getAuthHeaders() });
            const data = await res.json();
            setContacts(data.contacts || []);
        } catch (err) {
            console.error('Failed to fetch contacts:', err);
        }
    };

    const fetchPatients = async () => {
        try {
            const res = await fetch('/api/patients', { headers: getAuthHeaders() });
            const data = await res.json();
            setPatients(data.patients || []);
        } catch (err) { }
    };

    const fetchScheduledCalls = async () => {
        try {
            const res = await fetch('/api/video-calls', { headers: getAuthHeaders() });
            const data = await res.json();
            setScheduledCalls(data.video_calls || []);
        } catch (err) { }
    };

    useEffect(() => {
        let interval;
        if (isConnected) {
            interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isConnected]);

    // Speech recognition - initialize once
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition._active = false;

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    const text = event.results[i][0].transcript.trim();
                    if (text) {
                        setTranscript(prev => [...prev, {
                            text: text,
                            sender: 'You',
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }]);
                    }
                }
            }
        };

        recognition.onerror = (event) => {
            console.log('Speech error:', event.error);
        };

        recognition.onend = () => {
            if (recognition._active) {
                setTimeout(() => {
                    try { recognition.start(); } catch (e) { }
                }, 100);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition._active = false;
            try { recognition.stop(); } catch (e) { }
        };
    }, []);

    const formatDuration = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
            streamRef.current = stream;
            return true;
        } catch (err) {
            alert("Could not access camera/microphone.");
            return false;
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const handleConnect = async () => {
        if (!selectedContact && !selectedPatient) return alert('Please select a contact');
        setIsConnecting(true);
        if (await startCamera()) {
            setTimeout(() => {
                setIsConnecting(false);
                setIsConnected(true);
                setCallDuration(0);
                setTranscript([]);
                if (recognitionRef.current) {
                    recognitionRef.current._active = true;
                    try {
                        recognitionRef.current.start();
                        setIsTranscribing(true);
                    } catch (e) {
                        console.error('Failed to start speech recognition:', e);
                    }
                }
            }, 500);
        } else setIsConnecting(false);
    };

    const handleDisconnect = () => {
        if (recognitionRef.current) {
            recognitionRef.current._active = false;
            try { recognitionRef.current.stop(); } catch (e) { }
        }
        setIsTranscribing(false);
        stopCamera();
        setIsConnected(false);
    };

    const toggleMute = () => {
        streamRef.current?.getAudioTracks().forEach(t => t.enabled = !t.enabled);
        setIsMuted(!isMuted);
    };

    const toggleVideo = () => {
        streamRef.current?.getVideoTracks().forEach(t => t.enabled = !t.enabled);
        setIsVideoOff(!isVideoOff);
    };

    const handleScheduleCall = async (e) => {
        e.preventDefault();
        const participantId = scheduleParticipantType === 'patient' ? selectedPatient : selectedContact;

        if (!participantId || !scheduleDate || !scheduleTime) {
            alert('Please fill all required fields');
            return;
        }

        try {
            const scheduledAt = `${scheduleDate}T${scheduleTime}:00`;
            const body = {
                scheduled_at: scheduledAt,
                title: scheduleTitle || 'Video Consultation',
                duration_minutes: scheduleDuration
            };

            if (scheduleParticipantType === 'patient') {
                body.patient_id = selectedPatient;
            } else {
                body.participant_id = selectedContact;
                // If calling about a specific patient, include that
                if (selectedPatient) {
                    body.patient_id = selectedPatient;
                }
            }

            const res = await fetch('/api/video-calls', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (res.ok) {
                setShowScheduleForm(false);
                setScheduleDate('');
                setScheduleTime('');
                setScheduleTitle('');
                setSelectedContact('');
                setSelectedPatient('');
                fetchScheduledCalls();
                alert('Video call scheduled successfully!');
            } else {
                alert(data.error || 'Failed to schedule call');
            }
        } catch (err) {
            console.error('Schedule error:', err);
            alert('Failed to schedule call: ' + err.message);
        }
    };

    const cancelScheduledCall = async (callId) => {
        if (!confirm('Cancel this scheduled call?')) return;
        try {
            await fetch(`/api/video-calls/${callId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            fetchScheduledCalls();
        } catch (err) { }
    };

    const joinScheduledCall = (call) => {
        if (call.patient_id) {
            setSelectedPatient(call.patient_id);
        }
        if (call.scheduled_with) {
            setSelectedContact(call.scheduled_with);
        }
        setActiveTab('call');
    };

    const formatScheduledTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Get display info for selected contact
    const getSelectedContactInfo = () => {
        if (selectedPatient) {
            const patient = patients.find(p => p.id === selectedPatient);
            if (patient) return { name: patient.name, type: 'patient', config: roleConfig.patient };
        }
        if (selectedContact) {
            const contact = contacts.find(c => c.id === selectedContact);
            if (contact) return {
                name: contact.full_name,
                type: contact.contact_type,
                config: roleConfig[contact.contact_type] || roleConfig.patient
            };
        }
        return null;
    };

    const selectedContactInfo = getSelectedContactInfo();

    // Group contacts by type
    const groupedContacts = contacts.reduce((acc, contact) => {
        const type = contact.contact_type || contact.role;
        if (!acc[type]) acc[type] = [];
        acc[type].push(contact);
        return acc;
    }, {});

    // In-Call Screen
    if (isConnected) {
        return (
            <div className={styles.callScreen}>
                <div className={styles.videoArea}>
                    <div className={styles.remoteView}>
                        <div className={styles.remoteAvatar}>{selectedContactInfo?.name?.charAt(0)}</div>
                        <div className={styles.remoteInfo}>
                            <span className={styles.remoteName}>{selectedContactInfo?.name}</span>
                            <span className={styles.liveStatus}><span className={styles.liveDot}></span>Connected</span>
                        </div>
                    </div>
                    <div className={styles.selfView}>
                        <video ref={videoRef} autoPlay muted playsInline />
                        {isVideoOff && <div className={styles.cameraOff}><Icons.VideoOff /></div>}
                    </div>
                    <div className={styles.callTimer}>{formatDuration(callDuration)}</div>
                    <div className={styles.controlBar}>
                        <button className={`${styles.controlBtn} ${isMuted ? styles.active : ''}`} onClick={toggleMute}>
                            {isMuted ? <Icons.MicOff /> : <Icons.Mic />}
                        </button>
                        <button className={`${styles.controlBtn} ${isVideoOff ? styles.active : ''}`} onClick={toggleVideo}>
                            {isVideoOff ? <Icons.VideoOff /> : <Icons.Video />}
                        </button>
                        <button className={`${styles.controlBtn} ${styles.endCall}`} onClick={handleDisconnect}>
                            <Icons.Phone />
                        </button>
                        <button className={`${styles.controlBtn} ${showTranscript ? styles.active : ''}`} onClick={() => setShowTranscript(!showTranscript)}>
                            <Icons.MessageSquare />
                        </button>
                    </div>
                </div>
                {showTranscript && (
                    <div className={styles.transcriptPanel}>
                        <div className={styles.panelHeader}>
                            <h3>AI Scribe</h3>
                            <span className={styles.statusBadge}>{isTranscribing ? 'Listening' : 'Ready'}</span>
                        </div>
                        <div className={styles.transcriptMessages}>
                            {transcript.length === 0 ? (
                                <div className={styles.emptyState}><Icons.MessageSquare /><p>Conversation will appear here</p></div>
                            ) : (
                                transcript.map((t, i) => (
                                    <div key={i} className={`${styles.message} ${t.sender === 'You' ? styles.outgoing : styles.incoming}`}>
                                        <div className={styles.messageHeader}>
                                            <span className={styles.senderName}>{t.sender}</span>
                                            <span className={styles.messageTime}>{t.time}</span>
                                        </div>
                                        <p>{t.text}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Pre-Call Screen with Tabs
    return (
        <div className={`page ${styles.container}`}>
            <header className={styles.pageHeader}>
                <h1>Video Consultations</h1>
                <p>Schedule and conduct secure video calls with your care team</p>
            </header>

            <div className={styles.tabs}>
                <button className={`${styles.tab} ${activeTab === 'schedule' ? styles.activeTab : ''}`} onClick={() => setActiveTab('schedule')}>
                    <Icons.Calendar /> Scheduled Calls
                </button>
                <button className={`${styles.tab} ${activeTab === 'call' ? styles.activeTab : ''}`} onClick={() => setActiveTab('call')}>
                    <Icons.Video /> Start Call
                </button>
            </div>

            {activeTab === 'schedule' && (
                <div className={styles.scheduleSection}>
                    <div className={styles.scheduleActions}>
                        <button className="btn btn-primary" onClick={() => setShowScheduleForm(true)}>
                            <Icons.Plus /> Schedule New Call
                        </button>
                    </div>

                    {showScheduleForm && (
                        <div className={styles.modal}>
                            <div className={styles.modalContent}>
                                <div className={styles.modalHeader}>
                                    <h3>Schedule Video Call</h3>
                                    <button onClick={() => setShowScheduleForm(false)}><Icons.X /></button>
                                </div>
                                <form onSubmit={handleScheduleCall}>
                                    {/* Participant Type Selection */}
                                    <div className={styles.formGroup}>
                                        <label>Call With</label>
                                        <div className={styles.participantTypeToggle}>
                                            {patients.length > 0 && (
                                                <button
                                                    type="button"
                                                    className={`${styles.typeBtn} ${scheduleParticipantType === 'patient' ? styles.active : ''}`}
                                                    onClick={() => setScheduleParticipantType('patient')}
                                                >
                                                    {roleConfig.patient.icon} Patient
                                                </button>
                                            )}
                                            {contacts.length > 0 && (
                                                <button
                                                    type="button"
                                                    className={`${styles.typeBtn} ${scheduleParticipantType === 'contact' ? styles.active : ''}`}
                                                    onClick={() => setScheduleParticipantType('contact')}
                                                >
                                                    <Icons.Users /> Team Member
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {scheduleParticipantType === 'patient' && patients.length > 0 && (
                                        <div className={styles.formGroup}>
                                            <label>Select Patient</label>
                                            <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)} required>
                                                <option value="">Choose a patient...</option>
                                                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    {scheduleParticipantType === 'contact' && contacts.length > 0 && (
                                        <div className={styles.formGroup}>
                                            <label>Select Contact</label>
                                            <select value={selectedContact} onChange={(e) => setSelectedContact(e.target.value)} required>
                                                <option value="">Choose a contact...</option>
                                                {Object.entries(groupedContacts).map(([type, typeContacts]) => (
                                                    <optgroup key={type} label={roleConfig[type]?.label || type}>
                                                        {typeContacts.map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {roleConfig[type]?.icon || '👤'} {c.full_name}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Optional: relate call to a patient when calling a staff member */}
                                    {scheduleParticipantType === 'contact' && patients.length > 0 && (
                                        <div className={styles.formGroup}>
                                            <label>Regarding Patient (optional)</label>
                                            <select value={selectedPatient} onChange={(e) => setSelectedPatient(e.target.value)}>
                                                <option value="">No specific patient</option>
                                                {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                        </div>
                                    )}

                                    <div className={styles.formRow}>
                                        <div className={styles.formGroup}>
                                            <label>Date</label>
                                            <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} required />
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Time</label>
                                            <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} required />
                                        </div>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Title (optional)</label>
                                        <input type="text" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} placeholder="e.g., Follow-up consultation" />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Duration</label>
                                        <select value={scheduleDuration} onChange={(e) => setScheduleDuration(Number(e.target.value))}>
                                            <option value={15}>15 minutes</option>
                                            <option value={30}>30 minutes</option>
                                            <option value={45}>45 minutes</option>
                                            <option value={60}>1 hour</option>
                                        </select>
                                    </div>
                                    <div className={styles.formActions}>
                                        <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleForm(false)}>Cancel</button>
                                        <button type="submit" className="btn btn-primary">Schedule Call</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    <div className={styles.callsList}>
                        {scheduledCalls.length === 0 ? (
                            <div className={styles.emptyList}>
                                <Icons.Calendar />
                                <p>No scheduled video calls</p>
                            </div>
                        ) : (
                            scheduledCalls.filter(c => c.status !== 'cancelled' && c.status !== 'completed').map(call => (
                                <div key={call.id} className={styles.callCard}>
                                    <div className={styles.callInfo}>
                                        <div className={styles.callAvatar}>
                                            {call.patient_name?.charAt(0) || call.scheduled_with_name?.charAt(0) || '?'}
                                        </div>
                                        <div className={styles.callDetails}>
                                            <strong>{call.title || 'Video Consultation'}</strong>
                                            <span className={styles.callPatient}>
                                                {call.patient_name && `Patient: ${call.patient_name}`}
                                                {call.scheduled_with_name && ` • With: ${call.scheduled_with_name}`}
                                            </span>
                                            <span className={styles.callTime}>
                                                <Icons.Clock /> {formatScheduledTime(call.scheduled_at)} ({call.duration_minutes} min)
                                            </span>
                                        </div>
                                    </div>
                                    <div className={styles.callActions}>
                                        <button className="btn btn-primary btn-sm" onClick={() => joinScheduledCall(call)}>Join</button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => cancelScheduledCall(call.id)}>Cancel</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'call' && (
                <div className={styles.callSection}>
                    <div className={styles.preCallCard}>
                        <div className={styles.iconCircle}><Icons.Video /></div>
                        <h2>Start Video Call</h2>
                        <p>Select who you&apos;d like to call</p>

                        {/* Contact Type Tabs */}
                        <div className={styles.contactTabs}>
                            {patients.length > 0 && (
                                <button
                                    className={`${styles.contactTab} ${scheduleParticipantType === 'patient' ? styles.active : ''}`}
                                    onClick={() => { setScheduleParticipantType('patient'); setSelectedContact(''); }}
                                >
                                    {roleConfig.patient.icon} Patients
                                </button>
                            )}
                            {Object.entries(groupedContacts).map(([type, typeContacts]) => (
                                <button
                                    key={type}
                                    className={`${styles.contactTab} ${scheduleParticipantType === type ? styles.active : ''}`}
                                    onClick={() => { setScheduleParticipantType(type); setSelectedPatient(''); }}
                                >
                                    {roleConfig[type]?.icon || '👤'} {roleConfig[type]?.label || type}s ({typeContacts.length})
                                </button>
                            ))}
                        </div>

                        {/* Patient Selection */}
                        {scheduleParticipantType === 'patient' && patients.length > 0 && (
                            <div className={styles.contactGrid}>
                                {patients.map(p => (
                                    <div
                                        key={p.id}
                                        className={`${styles.contactCard} ${selectedPatient === p.id ? styles.selected : ''}`}
                                        onClick={() => { setSelectedPatient(p.id); setSelectedContact(''); }}
                                    >
                                        <div className={styles.contactAvatar} style={{ backgroundColor: roleConfig.patient.color }}>
                                            {p.name?.charAt(0)}
                                        </div>
                                        <div className={styles.contactInfo}>
                                            <strong>{p.name}</strong>
                                            <span>{p.condition || 'Patient'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Other Contact Selection */}
                        {scheduleParticipantType !== 'patient' && groupedContacts[scheduleParticipantType] && (
                            <div className={styles.contactGrid}>
                                {groupedContacts[scheduleParticipantType].map(c => (
                                    <div
                                        key={c.id}
                                        className={`${styles.contactCard} ${selectedContact === c.id ? styles.selected : ''}`}
                                        onClick={() => { setSelectedContact(c.id); setSelectedPatient(''); }}
                                    >
                                        <div className={styles.contactAvatar} style={{ backgroundColor: roleConfig[c.contact_type]?.color || '#6b7280' }}>
                                            {c.full_name?.charAt(0)}
                                        </div>
                                        <div className={styles.contactInfo}>
                                            <strong>{c.full_name}</strong>
                                            <span>{roleConfig[c.contact_type]?.label || c.contact_type}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedContactInfo && (
                            <div className={styles.selectedInfo}>
                                <div className={styles.selectedAvatar} style={{ backgroundColor: selectedContactInfo.config?.color }}>
                                    {selectedContactInfo.name?.charAt(0)}
                                </div>
                                <div>
                                    <strong>Calling {selectedContactInfo.name}</strong>
                                    <span>{selectedContactInfo.config?.label || selectedContactInfo.type}</span>
                                </div>
                            </div>
                        )}

                        <button
                            className={styles.startButton}
                            onClick={handleConnect}
                            disabled={isConnecting || (!selectedContact && !selectedPatient)}
                        >
                            {isConnecting ? 'Connecting...' : 'Start Video Call'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
