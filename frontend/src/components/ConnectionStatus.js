'use client';

import { useSocket } from './SocketProvider';
import styles from './ConnectionStatus.module.css';

export default function ConnectionStatus() {
    const { isConnected, lastEvent } = useSocket();

    return (
        <div className={styles.statusContainer}>
            <div className={`${styles.indicator} ${isConnected ? styles.connected : styles.disconnected}`}>
                <span className={styles.dot}></span>
                <span className={styles.text}>
                    {isConnected ? 'Live' : 'Offline'}
                </span>
            </div>
            {lastEvent && isConnected && (
                <div className={styles.lastUpdate}>
                    Last update: {lastEvent.timestamp.toLocaleTimeString()}
                </div>
            )}
        </div>
    );
}
