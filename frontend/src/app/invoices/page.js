'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function InvoicesPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [invoices, setInvoices] = useState([]);
    const [patients, setPatients] = useState([]);
    const [filter, setFilter] = useState({ patient_id: '', status: '' });
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newInvoice, setNewInvoice] = useState({
        patient_id: '',
        subtotal: '',
        tax: '0',
        discount: '0',
        total: '',
        billing_period_start: '',
        billing_period_end: '',
        due_date: '',
        notes: ''
    });

    const fetchInvoices = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (filter.patient_id) params.append('patient_id', filter.patient_id);
            if (filter.status) params.append('status', filter.status);

            const res = await fetch(`/api/invoices?${params.toString()}`, { headers: getAuthHeaders() });
            const data = await res.json();
            setInvoices(data.invoices || []);
        } catch (err) {
            console.error('Failed to fetch invoices:', err);
        }
    }, [filter, getAuthHeaders]);

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
        fetchInvoices();
        fetchPatients();
    }, [token, loading, fetchInvoices, fetchPatients]);

    const calculateTotal = () => {
        const subtotal = parseFloat(newInvoice.subtotal) || 0;
        const tax = parseFloat(newInvoice.tax) || 0;
        const discount = parseFloat(newInvoice.discount) || 0;
        return (subtotal + tax - discount).toFixed(2);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newInvoice.patient_id || !newInvoice.subtotal) return;

        setCreating(true);
        try {
            const payload = {
                ...newInvoice,
                total: parseFloat(calculateTotal()),
                subtotal: parseFloat(newInvoice.subtotal),
                tax: parseFloat(newInvoice.tax) || 0,
                discount: parseFloat(newInvoice.discount) || 0
            };

            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowCreate(false);
                setNewInvoice({
                    patient_id: '',
                    subtotal: '',
                    tax: '0',
                    discount: '0',
                    total: '',
                    billing_period_start: '',
                    billing_period_end: '',
                    due_date: '',
                    notes: ''
                });
                fetchInvoices();
            }
        } catch (err) {
            console.error('Create failed:', err);
        }
        setCreating(false);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    };

    const getStatusInfo = (status) => {
        const statuses = {
            draft: { label: 'Draft', color: '#6b7280' },
            pending: { label: 'Pending', color: '#f59e0b' },
            sent: { label: 'Sent', color: '#3b82f6' },
            paid: { label: 'Paid', color: '#22c55e' },
            overdue: { label: 'Overdue', color: '#ef4444' },
            cancelled: { label: 'Cancelled', color: '#6b7280' },
            refunded: { label: 'Refunded', color: '#8b5cf6' }
        };
        return statuses[status] || statuses.draft;
    };

    // Calculate summary stats
    const totalPending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.total || 0), 0);
    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paid_amount || i.total || 0), 0);
    const overdueCount = invoices.filter(i => i.status === 'overdue').length;

    if (loading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading invoices...</p></div>;
    }

    if (user?.role !== 'admin') {
        return (
            <div className={`page ${styles.invoicesPage}`}>
                <div className={styles.accessDenied}>
                    <Icons.DollarSign size={48} />
                    <h2>Billing & Invoices</h2>
                    <p>Invoice management is available for administrators only.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`page ${styles.invoicesPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.DollarSign size={28} /> Billing & Invoices</h1>
                    <p>Manage patient invoices and payments</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    <Icons.Plus size={16} /> Create Invoice
                </button>
            </header>

            {/* Summary Cards */}
            <div className={styles.summaryGrid}>
                <div className={`card ${styles.summaryCard}`}>
                    <span className={styles.summaryIcon} style={{ color: '#f59e0b' }}><Icons.Clock size={24} /></span>
                    <span className={styles.summaryValue}>{formatCurrency(totalPending)}</span>
                    <span className={styles.summaryLabel}>Pending</span>
                </div>
                <div className={`card ${styles.summaryCard}`}>
                    <span className={styles.summaryIcon} style={{ color: '#22c55e' }}><Icons.CheckCircle size={24} /></span>
                    <span className={styles.summaryValue}>{formatCurrency(totalPaid)}</span>
                    <span className={styles.summaryLabel}>Collected</span>
                </div>
                <div className={`card ${styles.summaryCard}`}>
                    <span className={styles.summaryIcon} style={{ color: '#ef4444' }}><Icons.AlertTriangle size={24} /></span>
                    <span className={styles.summaryValue}>{overdueCount}</span>
                    <span className={styles.summaryLabel}>Overdue</span>
                </div>
            </div>

            {/* Filters */}
            <div className={styles.filters}>
                <select
                    className="input"
                    value={filter.patient_id}
                    onChange={(e) => setFilter({ ...filter, patient_id: e.target.value })}
                >
                    <option value="">All Patients</option>
                    {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                <select
                    className="input"
                    value={filter.status}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                </select>
            </div>

            {/* Invoices Table */}
            <div className="card">
                <div className={styles.tableWrapper}>
                    <table className={styles.invoiceTable}>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th>Patient</th>
                                <th>Amount</th>
                                <th>Due Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className={styles.emptyTable}>No invoices found</td>
                                </tr>
                            ) : (
                                invoices.map((invoice) => {
                                    const statusInfo = getStatusInfo(invoice.status);
                                    return (
                                        <tr key={invoice.id}>
                                            <td className={styles.invoiceNumber}>{invoice.invoice_number}</td>
                                            <td>{invoice.patient_name}</td>
                                            <td className={styles.amount}>{formatCurrency(invoice.total)}</td>
                                            <td>{formatDate(invoice.due_date)}</td>
                                            <td>
                                                <span
                                                    className={styles.statusBadge}
                                                    style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}
                                                >
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td>
                                                <div className={styles.actions}>
                                                    <button className={styles.actionBtn} title="View">
                                                        <Icons.Eye size={16} />
                                                    </button>
                                                    <button className={styles.actionBtn} title="Print">
                                                        <Icons.FileText size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3><Icons.Plus size={20} /> Create Invoice</h3>
                            <button className={styles.closeBtn} onClick={() => setShowCreate(false)}>
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className={styles.createForm}>
                            <div className="input-group">
                                <label className="input-label">Patient *</label>
                                <select
                                    className="input"
                                    value={newInvoice.patient_id}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, patient_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select patient...</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formRow}>
                                <div className="input-group">
                                    <label className="input-label">Billing Period Start</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={newInvoice.billing_period_start}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, billing_period_start: e.target.value })}
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Billing Period End</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={newInvoice.billing_period_end}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, billing_period_end: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className="input-group">
                                    <label className="input-label">Subtotal *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input"
                                        value={newInvoice.subtotal}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, subtotal: e.target.value })}
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Tax</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input"
                                        value={newInvoice.tax}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, tax: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className="input-group">
                                    <label className="input-label">Discount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input"
                                        value={newInvoice.discount}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, discount: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="input-group">
                                    <label className="input-label">Due Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={newInvoice.due_date}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className={styles.totalDisplay}>
                                <span>Total:</span>
                                <span className={styles.totalAmount}>{formatCurrency(calculateTotal())}</span>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Notes</label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    value={newInvoice.notes}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                                    placeholder="Optional notes..."
                                />
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={creating}>
                                    {creating ? 'Creating...' : 'Create Invoice'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
