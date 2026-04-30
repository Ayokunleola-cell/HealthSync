'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

const CATEGORIES = [
    { value: 'medical', label: 'Medical Records', icon: 'FileText' },
    { value: 'legal', label: 'Legal Documents', icon: 'Shield' },
    { value: 'insurance', label: 'Insurance', icon: 'CreditCard' },
    { value: 'identification', label: 'Identification', icon: 'User' },
    { value: 'consent', label: 'Consent Forms', icon: 'Check' },
    { value: 'care_plan', label: 'Care Plans', icon: 'Clipboard' },
    { value: 'report', label: 'Reports', icon: 'Report' },
    { value: 'photo', label: 'Photos', icon: 'Camera' },
    { value: 'other', label: 'Other', icon: 'File' }
];

export default function DocumentsPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [documents, setDocuments] = useState([]);
    const [patients, setPatients] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedPatient, setSelectedPatient] = useState('');
    const [showUpload, setShowUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [newDoc, setNewDoc] = useState({
        filename: '',
        category: 'other',
        patient_id: '',
        description: ''
    });

    const fetchDocuments = useCallback(async () => {
        try {
            let url = '/api/documents';
            const params = new URLSearchParams();
            if (selectedCategory) params.append('category', selectedCategory);
            if (selectedPatient) params.append('patient_id', selectedPatient);
            if (params.toString()) url += `?${params.toString()}`;

            const res = await fetch(url, { headers: getAuthHeaders() });
            const data = await res.json();
            setDocuments(data.documents || []);
        } catch (err) {
            console.error('Failed to fetch documents:', err);
        }
    }, [selectedCategory, selectedPatient, getAuthHeaders]);

    const fetchPatients = useCallback(async () => {
        try {
            const res = await fetch('/api/patients', { headers: getAuthHeaders() });
            const data = await res.json();
            setPatients(data.patients || []);
        } catch (err) {
            console.error('Failed to fetch patients:', err);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchDocuments();
        fetchPatients();
    }, [token, loading, fetchDocuments, fetchPatients]);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!newDoc.filename) return;

        setUploading(true);
        try {
            const res = await fetch('/api/documents', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newDoc)
            });
            if (res.ok) {
                setShowUpload(false);
                setNewDoc({ filename: '', category: 'other', patient_id: '', description: '' });
                fetchDocuments();
            }
        } catch (err) {
            console.error('Upload failed:', err);
        }
        setUploading(false);
    };

    const handleDelete = async (docId) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        try {
            await fetch(`/api/documents/${docId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            fetchDocuments();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '-';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getCategoryInfo = (cat) => {
        return CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];
    };

    if (loading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading documents...</p></div>;
    }

    return (
        <div className={`page ${styles.documentsPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.FileText size={28} /> Document Management</h1>
                    <p>Secure document storage and management</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
                    <Icons.Upload size={16} /> Upload Document
                </button>
            </header>

            {/* Filters */}
            <div className={styles.filters}>
                <div className="input-group">
                    <label className="input-label">Category</label>
                    <select
                        className="input"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        {CATEGORIES.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                    </select>
                </div>
                <div className="input-group">
                    <label className="input-label">Patient</label>
                    <select
                        className="input"
                        value={selectedPatient}
                        onChange={(e) => setSelectedPatient(e.target.value)}
                    >
                        <option value="">All Patients</option>
                        {patients.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Category Pills */}
            <div className={styles.categoryPills}>
                <button
                    className={`${styles.pill} ${!selectedCategory ? styles.active : ''}`}
                    onClick={() => setSelectedCategory('')}
                >
                    All
                </button>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.value}
                        className={`${styles.pill} ${selectedCategory === cat.value ? styles.active : ''}`}
                        onClick={() => setSelectedCategory(cat.value)}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Documents Grid */}
            {documents.length === 0 ? (
                <div className={styles.emptyState}>
                    <Icons.Inbox size={48} />
                    <h3>No documents found</h3>
                    <p>Upload documents to get started</p>
                </div>
            ) : (
                <div className={styles.documentsGrid}>
                    {documents.map((doc) => {
                        const catInfo = getCategoryInfo(doc.category);
                        return (
                            <div key={doc.id} className={styles.docCard}>
                                <div className={styles.docIcon}>
                                    <Icons.FileText size={32} />
                                </div>
                                <div className={styles.docInfo}>
                                    <h4 className={styles.docName}>{doc.original_filename || doc.filename}</h4>
                                    <span className={`${styles.docCategory} ${styles[doc.category]}`}>
                                        {catInfo.label}
                                    </span>
                                    {doc.patient_name && (
                                        <p className={styles.docPatient}>
                                            <Icons.User size={14} /> {doc.patient_name}
                                        </p>
                                    )}
                                    {doc.description && (
                                        <p className={styles.docDescription}>{doc.description}</p>
                                    )}
                                    <div className={styles.docMeta}>
                                        <span>{formatFileSize(doc.file_size)}</span>
                                        <span>{formatDate(doc.created_at)}</span>
                                    </div>
                                    <p className={styles.docUploader}>Uploaded by {doc.uploader_name}</p>
                                </div>
                                <div className={styles.docActions}>
                                    <button className={styles.actionBtn} title="View">
                                        <Icons.Eye size={18} />
                                    </button>
                                    <button className={styles.actionBtn} title="Download">
                                        <Icons.Download size={18} />
                                    </button>
                                    <button
                                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                        title="Delete"
                                        onClick={() => handleDelete(doc.id)}
                                    >
                                        <Icons.Trash size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload Modal */}
            {showUpload && (
                <div className={styles.modalOverlay} onClick={() => setShowUpload(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><Icons.Upload size={20} /> Upload Document</h3>
                            <button className={styles.closeBtn} onClick={() => setShowUpload(false)}>
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpload} className={styles.uploadForm}>
                            <div className="input-group">
                                <label className="input-label">Document Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={newDoc.filename}
                                    onChange={(e) => setNewDoc({ ...newDoc, filename: e.target.value })}
                                    placeholder="Enter document name..."
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Category</label>
                                <select
                                    className="input"
                                    value={newDoc.category}
                                    onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                                >
                                    {CATEGORIES.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Patient (Optional)</label>
                                <select
                                    className="input"
                                    value={newDoc.patient_id}
                                    onChange={(e) => setNewDoc({ ...newDoc, patient_id: e.target.value })}
                                >
                                    <option value="">Select patient...</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Description</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={newDoc.description}
                                    onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
                                    placeholder="Enter description..."
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={uploading}>
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
