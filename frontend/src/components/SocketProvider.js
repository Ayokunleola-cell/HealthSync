'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthProvider';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const { user, token } = useAuth();
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState(null);
    const eventListeners = useRef(new Map());

    // Initialize socket connection
    useEffect(() => {
        if (!token) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        const socketInstance = io('http://localhost:5000', {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
        });

        socketInstance.on('connect', () => {
            console.log('🔌 WebSocket connected:', socketInstance.id);
            setIsConnected(true);

            // Auto-join dashboard room for general updates
            socketInstance.emit('join_room', { room: 'dashboard' });

            // Subscribe to user-specific alerts
            if (user?.id) {
                socketInstance.emit('subscribe_alerts', { user_id: user.id });
                socketInstance.emit('subscribe_shifts', { user_id: user.id });
            }
        });

        socketInstance.on('disconnect', () => {
            console.log('🔌 WebSocket disconnected');
            setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
            console.error('🔌 WebSocket connection error:', error);
        });

        socketInstance.on('connected', (data) => {
            console.log('🔌 Server confirmed connection:', data);
        });

        socketInstance.on('room_joined', (data) => {
            console.log('🔌 Joined room:', data.room);
        });

        socketInstance.on('subscribed', (data) => {
            console.log('🔌 Subscribed to:', data);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, [token, user?.id]);

    // Subscribe to a patient for updates
    const subscribeToPatient = useCallback((patientId) => {
        if (socket && isConnected) {
            socket.emit('subscribe_patient', { patient_id: patientId });
        }
    }, [socket, isConnected]);

    // Join a specific room
    const joinRoom = useCallback((room) => {
        if (socket && isConnected) {
            socket.emit('join_room', { room });
        }
    }, [socket, isConnected]);

    // Leave a room
    const leaveRoom = useCallback((room) => {
        if (socket && isConnected) {
            socket.emit('leave_room', { room });
        }
    }, [socket, isConnected]);

    // Add event listener
    const addEventListener = useCallback((event, callback) => {
        if (!socket) return () => { };

        socket.on(event, callback);

        // Store reference for cleanup
        if (!eventListeners.current.has(event)) {
            eventListeners.current.set(event, []);
        }
        eventListeners.current.get(event).push(callback);

        // Return cleanup function
        return () => {
            socket.off(event, callback);
            const listeners = eventListeners.current.get(event);
            if (listeners) {
                const idx = listeners.indexOf(callback);
                if (idx > -1) listeners.splice(idx, 1);
            }
        };
    }, [socket]);

    // Generic event handler that updates lastEvent
    useEffect(() => {
        if (!socket) return;

        const events = [
            'vitals_update',
            'new_alert',
            'shift_update',
            'medication_administered',
            'care_log_added',
            'emergency_alert'
        ];

        const handlers = events.map(event => {
            const handler = (data) => {
                setLastEvent({ type: event, data, timestamp: new Date() });
            };
            socket.on(event, handler);
            return { event, handler };
        });

        return () => {
            handlers.forEach(({ event, handler }) => {
                socket.off(event, handler);
            });
        };
    }, [socket]);

    const value = {
        socket,
        isConnected,
        lastEvent,
        subscribeToPatient,
        joinRoom,
        leaveRoom,
        addEventListener,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
}

// Custom hooks for specific real-time features

export function useVitalsUpdates(patientId, callback) {
    const { socket, isConnected, subscribeToPatient, addEventListener } = useSocket();

    useEffect(() => {
        if (!isConnected || !patientId) return;

        subscribeToPatient(patientId);

        const cleanup = addEventListener('vitals_update', (data) => {
            if (data.patient_id === patientId && callback) {
                callback(data.vitals);
            }
        });

        return cleanup;
    }, [isConnected, patientId, subscribeToPatient, addEventListener, callback]);
}

export function useAlerts(callback) {
    const { isConnected, addEventListener } = useSocket();

    useEffect(() => {
        if (!isConnected) return;

        const cleanup = addEventListener('new_alert', (data) => {
            if (callback) callback(data);
        });

        return cleanup;
    }, [isConnected, addEventListener, callback]);
}

export function useShiftUpdates(callback) {
    const { isConnected, addEventListener } = useSocket();

    useEffect(() => {
        if (!isConnected) return;

        const cleanup = addEventListener('shift_update', (data) => {
            if (callback) callback(data);
        });

        return cleanup;
    }, [isConnected, addEventListener, callback]);
}

export function useEmergencyAlerts(callback) {
    const { isConnected, addEventListener } = useSocket();

    useEffect(() => {
        if (!isConnected) return;

        const cleanup = addEventListener('emergency_alert', (data) => {
            if (callback) callback(data);
        });

        return cleanup;
    }, [isConnected, addEventListener, callback]);
}

export function useMedicationUpdates(patientId, callback) {
    const { isConnected, subscribeToPatient, addEventListener } = useSocket();

    useEffect(() => {
        if (!isConnected || !patientId) return;

        subscribeToPatient(patientId);

        const cleanup = addEventListener('medication_administered', (data) => {
            if (data.patient_id === patientId && callback) {
                callback(data.medication_log);
            }
        });

        return cleanup;
    }, [isConnected, patientId, subscribeToPatient, addEventListener, callback]);
}

export function useCareLogUpdates(patientId, callback) {
    const { isConnected, subscribeToPatient, addEventListener } = useSocket();

    useEffect(() => {
        if (!isConnected || !patientId) return;

        subscribeToPatient(patientId);

        const cleanup = addEventListener('care_log_added', (data) => {
            if (data.patient_id === patientId && callback) {
                callback(data.care_log);
            }
        });

        return cleanup;
    }, [isConnected, patientId, subscribeToPatient, addEventListener, callback]);
}

export default SocketContext;
