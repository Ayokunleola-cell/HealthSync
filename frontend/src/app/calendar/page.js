'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import styles from './page.module.css';

export default function CalendarPage() {
    const { token, loading, getAuthHeaders } = useAuth();
    const [events, setEvents] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [medications, setMedications] = useState([]);
    const [shifts, setShifts] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(null);
    const [user, setUser] = useState(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) {
            setUser(JSON.parse(userData));
        }
    }, []);

    const fetchAllEvents = useCallback(async () => {
        try {
            // Fetch appointments
            const apptResponse = await fetch('/api/appointments', { headers: getAuthHeaders() });
            if (apptResponse.ok) {
                const apptData = await apptResponse.json();
                setAppointments(apptData.appointments || []);
            }

            // Fetch shifts (for caregivers)
            const shiftsResponse = await fetch('/api/shifts', { headers: getAuthHeaders() });
            if (shiftsResponse.ok) {
                const shiftsData = await shiftsResponse.json();
                setShifts(shiftsData.shifts || []);
            }

            // Fetch medications for reminders
            const medsResponse = await fetch('/api/patients', { headers: getAuthHeaders() });
            if (medsResponse.ok) {
                const patientsData = await medsResponse.json();
                const allMeds = [];
                for (const patient of (patientsData.patients || []).slice(0, 3)) {
                    const medResponse = await fetch(`/api/patients/${patient.id}/medications`, { headers: getAuthHeaders() });
                    if (medResponse.ok) {
                        const medData = await medResponse.json();
                        (medData.medications || []).forEach(med => {
                            allMeds.push({ ...med, patient_name: patient.name, patient_id: patient.id });
                        });
                    }
                }
                setMedications(allMeds);
            }

            // Fetch general events
            const eventsResponse = await fetch(
                '/api/patient/patient1/events?start_date=2020-01-01&end_date=2030-12-31',
                { headers: getAuthHeaders() }
            );
            if (eventsResponse.ok) {
                const eventsData = await eventsResponse.json();
                setEvents(eventsData.events || []);
            }
        } catch (err) {
            console.error('Failed to fetch events', err);
        } finally {
            setDataLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchAllEvents();
    }, [token, loading, fetchAllEvents]);

    // Real-time updates every 30 seconds
    useEffect(() => {
        if (!token) return;
        intervalRef.current = setInterval(fetchAllEvents, 30000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [token, fetchAllEvents]);

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const getEventsForDay = (day) => {
        if (!day) return { appointments: [], medications: [], shifts: [], events: [] };

        const dayStr = day.toISOString().split('T')[0];

        const dayAppointments = appointments.filter(apt =>
            apt.scheduled_at?.startsWith(dayStr)
        );

        const dayShifts = shifts.filter(shift =>
            shift.shift_date === dayStr
        );

        // Show medication reminders for every day (recurring)
        const dayMedications = medications;

        const dayEvents = events.filter(event => {
            const eventDate = new Date(event.event_time);
            return eventDate.toDateString() === day.toDateString();
        });

        return { appointments: dayAppointments, medications: dayMedications, shifts: dayShifts, events: dayEvents };
    };

    const getEventIndicators = (day) => {
        const dayData = getEventsForDay(day);
        const indicators = [];

        if (dayData.appointments.length > 0) {
            indicators.push({ type: 'appointment', count: dayData.appointments.length, label: 'Appt' });
        }
        if (dayData.shifts.length > 0) {
            indicators.push({ type: 'shift', count: dayData.shifts.length, label: 'Shift' });
        }
        if (dayData.medications.length > 0 && day >= new Date()) {
            indicators.push({ type: 'medication', count: dayData.medications.length, label: 'Meds' });
        }
        if (dayData.events.length > 0) {
            indicators.push({ type: 'event', count: dayData.events.length, label: 'Event' });
        }

        return indicators;
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
        setSelectedDay(null);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
        setSelectedDay(null);
    };

    const handleDayClick = (day) => {
        if (day) {
            setSelectedDay(day);
        }
    };

    const days = getDaysInMonth(currentDate);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : null;

    if (loading || dataLoading) {
        return (
            <div className={styles.loading}>
                <div className="spinner"></div>
                <p>Loading calendar...</p>
            </div>
        );
    }

    return (
        <div className={`page ${styles.calendarPage}`}>
            <header className={styles.header}>
                <h1>Health Calendar</h1>
                <p>View appointments, medications, shifts, and health events</p>
            </header>

            <div className={styles.calendarContainer}>
                <div className="card">
                    <div className={styles.calendarHeader}>
                        <button onClick={prevMonth} className="btn btn-secondary">Prev</button>
                        <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                        <button onClick={nextMonth} className="btn btn-secondary">Next</button>
                    </div>

                    <div className={styles.weekdays}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className={styles.weekday}>{day}</div>
                        ))}
                    </div>

                    <div className={styles.daysGrid}>
                        {days.map((day, index) => {
                            const indicators = day ? getEventIndicators(day) : [];
                            const isToday = day?.toDateString() === new Date().toDateString();
                            const isSelected = day?.toDateString() === selectedDay?.toDateString();

                            return (
                                <div
                                    key={index}
                                    className={`${styles.day} ${!day ? styles.empty : ''} ${isToday ? styles.today : ''} ${isSelected ? styles.selected : ''}`}
                                    onClick={() => handleDayClick(day)}
                                >
                                    {day && (
                                        <>
                                            <span className={styles.dayNumber}>{day.getDate()}</span>
                                            <div className={styles.indicators}>
                                                {indicators.map((ind, i) => (
                                                    <span
                                                        key={i}
                                                        className={`${styles.indicator} ${styles[ind.type]}`}
                                                        title={`${ind.count} ${ind.label}`}
                                                    >
                                                        {ind.count > 1 ? ind.count : ''}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className={styles.legend}>
                        <span><span className={`${styles.legendDot} ${styles.appointment}`}></span> Appointments</span>
                        <span><span className={`${styles.legendDot} ${styles.shift}`}></span> Shifts</span>
                        <span><span className={`${styles.legendDot} ${styles.medication}`}></span> Medications</span>
                        <span><span className={`${styles.legendDot} ${styles.event}`}></span> Events</span>
                    </div>
                </div>

                {selectedDay && (
                    <div className={`card ${styles.dayDetails}`}>
                        <h3>
                            {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h3>

                        {selectedDayEvents.appointments.length > 0 && (
                            <div className={styles.eventSection}>
                                <h4 className={styles.appointment}>Appointments</h4>
                                {selectedDayEvents.appointments.map((apt, i) => (
                                    <div key={i} className={styles.eventItem}>
                                        <span className={styles.eventTime}>
                                            {new Date(apt.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <div className={styles.eventContent}>
                                            <strong>{apt.title || 'Appointment'}</strong>
                                            <p>{apt.patient_name} - {apt.description || 'No details'}</p>
                                            <span className={`${styles.status} ${styles[apt.status]}`}>{apt.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedDayEvents.shifts.length > 0 && (
                            <div className={styles.eventSection}>
                                <h4 className={styles.shift}>Shifts</h4>
                                {selectedDayEvents.shifts.map((shift, i) => (
                                    <div key={i} className={styles.eventItem}>
                                        <span className={styles.eventTime}>{shift.start_time} - {shift.end_time}</span>
                                        <div className={styles.eventContent}>
                                            <strong>{shift.patient_name}</strong>
                                            <p>Caregiver: {shift.caregiver_name}</p>
                                            <span className={`${styles.status} ${styles[shift.status]}`}>{shift.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedDayEvents.medications.length > 0 && selectedDay >= new Date(new Date().setHours(0, 0, 0, 0)) && (
                            <div className={styles.eventSection}>
                                <h4 className={styles.medication}>Medication Schedule</h4>
                                {selectedDayEvents.medications.slice(0, 5).map((med, i) => (
                                    <div key={i} className={styles.eventItem}>
                                        <span className={styles.eventTime}>{med.schedule_time || 'Daily'}</span>
                                        <div className={styles.eventContent}>
                                            <strong>{med.name}</strong>
                                            <p>{med.dosage} - {med.patient_name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedDayEvents.events.length > 0 && (
                            <div className={styles.eventSection}>
                                <h4 className={styles.event}>Health Events</h4>
                                {selectedDayEvents.events.map((event, i) => (
                                    <div key={i} className={styles.eventItem}>
                                        <span className={styles.eventTime}>
                                            {new Date(event.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <div className={styles.eventContent}>
                                            <strong>{event.event_type}</strong>
                                            <p>{event.details}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedDayEvents.appointments.length === 0 &&
                            selectedDayEvents.shifts.length === 0 &&
                            selectedDayEvents.events.length === 0 &&
                            (selectedDay < new Date(new Date().setHours(0, 0, 0, 0)) || selectedDayEvents.medications.length === 0) && (
                                <p className={styles.noEvents}>No events scheduled for this day.</p>
                            )}
                    </div>
                )}
            </div>
        </div>
    );
}
