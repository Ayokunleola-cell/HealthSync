'use client';

import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function ContactPage() {
    return (
        <div className={`page ${styles.contactPage}`}>
            <header className={styles.header}><h1><Icons.Phone size={24} /> Contact Caregiver</h1><p>Get in touch with your care team</p></header>

            <div className={`card ${styles.contactCard}`}>
                <div className={styles.avatar}>S</div>
                <div className={styles.info}>
                    <h3>Sarah Wilson</h3>
                    <p>Primary Caregiver</p>
                    <p className={styles.phone}><Icons.Phone size={14} /> (555) 010-2</p>
                    <p className={styles.email}><Icons.Mail size={14} /> sarah@email.com</p>
                </div>
                <div className={styles.actions}>
                    <a href="tel:5550102" className="btn btn-primary"><Icons.Phone size={14} /> Call</a>
                    <a href="mailto:sarah@email.com" className="btn btn-secondary"><Icons.Mail size={14} /> Email</a>
                </div>
            </div>

            <div className={`card ${styles.contactCard}`}>
                <div className={styles.avatar}>D</div>
                <div className={styles.info}>
                    <h3>Dr. James Smith</h3>
                    <p>Primary Physician</p>
                    <p className={styles.phone}><Icons.Phone size={14} /> (555) 010-3</p>
                </div>
                <div className={styles.actions}>
                    <a href="tel:5550103" className="btn btn-secondary"><Icons.Phone size={14} /> Call</a>
                </div>
            </div>
        </div>
    );
}
