'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Icons } from '@/components/Icons';
import styles from './page.module.css';

export default function MessagesPage() {
    const { user, token, loading, getAuthHeaders } = useAuth();
    const [messages, setMessages] = useState([]);
    const [folder, setFolder] = useState('inbox');
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [users, setUsers] = useState([]);
    const [showCompose, setShowCompose] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [newMessage, setNewMessage] = useState({ recipient_id: '', subject: '', content: '' });
    const [sending, setSending] = useState(false);

    const fetchMessages = useCallback(async () => {
        try {
            const [messagesRes, unreadRes] = await Promise.all([
                fetch(`/api/messages?folder=${folder}`, { headers: getAuthHeaders() }),
                fetch('/api/messages/unread-count', { headers: getAuthHeaders() })
            ]);
            const messagesData = await messagesRes.json();
            const unreadData = await unreadRes.json();
            setMessages(messagesData.messages || []);
            setUnreadCount(unreadData.unread_count || 0);
        } catch (err) {
            console.error('Failed to fetch messages:', err);
        }
    }, [folder, getAuthHeaders]);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/video-call-contacts', { headers: getAuthHeaders() });
            const data = await res.json();
            setUsers(data.contacts || []);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        if (!token || loading) return;
        fetchMessages();
        fetchUsers();
    }, [token, loading, fetchMessages, fetchUsers]);

    const markAsRead = async (messageId) => {
        try {
            await fetch(`/api/messages/${messageId}/read`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            fetchMessages();
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.recipient_id || !newMessage.content) return;

        setSending(true);
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(newMessage)
            });
            if (res.ok) {
                setShowCompose(false);
                setNewMessage({ recipient_id: '', subject: '', content: '' });
                fetchMessages();
            }
        } catch (err) {
            console.error('Failed to send message:', err);
        }
        setSending(false);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return <div className={styles.loading}><div className="spinner"></div><p>Loading messages...</p></div>;
    }

    return (
        <div className={`page ${styles.messagesPage}`}>
            <header className={styles.header}>
                <div>
                    <h1><Icons.Mail size={28} /> Messages</h1>
                    <p>Secure HIPAA-compliant messaging</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCompose(true)}>
                    <Icons.Edit size={16} /> Compose
                </button>
            </header>

            <div className={styles.messagesLayout}>
                {/* Sidebar */}
                <aside className={styles.sidebar}>
                    <button
                        className={`${styles.folderBtn} ${folder === 'inbox' ? styles.active : ''}`}
                        onClick={() => setFolder('inbox')}
                    >
                        <Icons.Inbox size={18} />
                        <span>Inbox</span>
                        {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
                    </button>
                    <button
                        className={`${styles.folderBtn} ${folder === 'sent' ? styles.active : ''}`}
                        onClick={() => setFolder('sent')}
                    >
                        <Icons.Send size={18} />
                        <span>Sent</span>
                    </button>
                </aside>

                {/* Message List */}
                <div className={styles.messageList}>
                    {messages.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Icons.Inbox size={48} />
                            <p>No messages in {folder}</p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.messageItem} ${!msg.is_read && folder === 'inbox' ? styles.unread : ''} ${selectedMessage?.id === msg.id ? styles.selected : ''}`}
                                onClick={() => {
                                    setSelectedMessage(msg);
                                    if (!msg.is_read && folder === 'inbox') markAsRead(msg.id);
                                }}
                            >
                                <div className={styles.messageAvatar}>
                                    {(folder === 'inbox' ? msg.sender_name : msg.recipient_name)?.charAt(0)}
                                </div>
                                <div className={styles.messagePreview}>
                                    <div className={styles.messageMeta}>
                                        <span className={styles.messageSender}>
                                            {folder === 'inbox' ? msg.sender_name : msg.recipient_name}
                                        </span>
                                        <span className={styles.messageTime}>{formatDate(msg.created_at)}</span>
                                    </div>
                                    <p className={styles.messageSubject}>{msg.subject || 'No subject'}</p>
                                    <p className={styles.messageSnippet}>{msg.content?.substring(0, 60)}...</p>
                                </div>
                                {msg.priority === 'urgent' && <span className={styles.urgentBadge}>!</span>}
                            </div>
                        ))
                    )}
                </div>

                {/* Message Detail */}
                <div className={styles.messageDetail}>
                    {selectedMessage ? (
                        <>
                            <div className={styles.detailHeader}>
                                <h2>{selectedMessage.subject || 'No subject'}</h2>
                                <span className={styles.detailTime}>{formatDate(selectedMessage.created_at)}</span>
                            </div>
                            <div className={styles.detailMeta}>
                                <span><strong>From:</strong> {selectedMessage.sender_name}</span>
                                <span><strong>To:</strong> {selectedMessage.recipient_name}</span>
                            </div>
                            <div className={styles.detailContent}>
                                {selectedMessage.content}
                            </div>
                            <div className={styles.detailActions}>
                                <button className="btn btn-secondary" onClick={() => {
                                    setNewMessage({
                                        recipient_id: selectedMessage.sender_id,
                                        subject: `Re: ${selectedMessage.subject || ''}`,
                                        content: ''
                                    });
                                    setShowCompose(true);
                                }}>
                                    <Icons.Reply size={16} /> Reply
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className={styles.emptyDetail}>
                            <Icons.Mail size={64} />
                            <p>Select a message to read</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Compose Modal */}
            {showCompose && (
                <div className={styles.modalOverlay} onClick={() => setShowCompose(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>New Message</h3>
                            <button className={styles.closeBtn} onClick={() => setShowCompose(false)}>
                                <Icons.X size={20} />
                            </button>
                        </div>
                        <form onSubmit={sendMessage} className={styles.composeForm}>
                            <div className="input-group">
                                <label className="input-label">To</label>
                                <select
                                    className="input"
                                    value={newMessage.recipient_id}
                                    onChange={(e) => setNewMessage({ ...newMessage, recipient_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select recipient...</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Subject</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={newMessage.subject}
                                    onChange={(e) => setNewMessage({ ...newMessage, subject: e.target.value })}
                                    placeholder="Enter subject..."
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Message</label>
                                <textarea
                                    className="input"
                                    rows={6}
                                    value={newMessage.content}
                                    onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                                    placeholder="Type your message..."
                                    required
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCompose(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={sending}>
                                    {sending ? 'Sending...' : 'Send Message'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
