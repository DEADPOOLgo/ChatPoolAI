import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, LogOut, User, Bot, MessageSquare, Plus, MessageCircle } from 'lucide-react';

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [threads, setThreads] = useState([]);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        checkAuth();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();
            if (!data.isAuthenticated) {
                navigate('/login');
            } else {
                setUser(data.user);
                fetchThreads();
            }
        } catch (e) {
            navigate('/login');
        }
    };

    const fetchThreads = async () => {
        try {
            const res = await fetch('/api/chat/threads');
            if (res.ok) {
                const data = await res.json();
                setThreads(data);
                // Optionally load the most recent thread or stay on 'new chat'
                if (data.length > 0 && !activeThreadId) {
                    // selectThread(data[0].id); // Uncomment to auto-select last thread
                }
            }
        } catch (e) {
            console.error("Failed to load threads");
        }
    };

    const selectThread = async (threadId) => {
        setActiveThreadId(threadId);
        setMessages([]); // Clear current view
        setLoading(true);
        try {
            const res = await fetch(`/api/chat/threads/${threadId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (e) {
            console.error("Failed to load messages");
        } finally {
            setLoading(false);
        }
    };

    const startNewChat = () => {
        setActiveThreadId(null);
        setMessages([]);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg = { role: 'user', text: input, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/chat/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.text, threadId: activeThreadId })
            });

            const data = await res.json();
            if (res.ok) {
                setMessages(prev => [...prev, data.botMessage]);

                // If we just started a new thread, set it as active and update list
                if (data.newThread) {
                    setActiveThreadId(data.threadId);
                    setThreads(prev => [data.newThread, ...prev]);
                } else {
                    // Re-order threads locally (move current to top)
                    setThreads(prev => {
                        const filtered = prev.filter(t => t.id !== activeThreadId);
                        const current = prev.find(t => t.id === activeThreadId);
                        if (current) {
                            return [{ ...current, updatedAt: new Date().toISOString() }, ...filtered];
                        }
                        return prev;
                    })
                }
            } else {
                setMessages(prev => [...prev, { role: 'assistant', text: "Error: " + (data.error || "Failed to send") }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', text: "Error: Could not reach server." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        navigate('/login');
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-color)' }}>
            {/* Sidebar */}
            <div className="glass" style={{
                width: '280px',
                borderRight: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                padding: '1rem',
                borderRadius: '0',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', padding: '0.5rem' }}>
                    <div style={{ background: '#3b82f6', borderRadius: '8px', padding: '6px' }}>
                        <MessageSquare size={20} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>AI Chat</h2>
                </div>

                {/* New Chat Button */}
                <button
                    onClick={startNewChat}
                    className="btn-primary"
                    style={{
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        width: '100%'
                    }}>
                    <Plus size={18} /> New Chat
                </button>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', paddingRight: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                        History
                    </div>
                    {threads.length === 0 ? (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic', padding: '0.5rem' }}>No history yet</div>
                    ) : (
                        threads.map(thread => (
                            <div
                                key={thread.id}
                                onClick={() => selectThread(thread.id)}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    cursor: 'pointer',
                                    marginBottom: '0.25rem',
                                    background: activeThreadId === thread.id ? 'var(--primary-color)' : 'transparent',
                                    color: activeThreadId === thread.id ? 'white' : 'var(--text-color)',
                                    transition: 'background 0.2s',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.9rem'
                                }}
                                onMouseOver={(e) => { if (activeThreadId !== thread.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                                onMouseOut={(e) => { if (activeThreadId !== thread.id) e.currentTarget.style.background = 'transparent' }}
                            >
                                <MessageCircle size={16} style={{ minWidth: '16px' }} />
                                {thread.title || 'New Chat'}
                            </div>
                        ))
                    )}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div style={{ padding: '0.25rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        <User size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle' }} />
                        {user?.name || 'User'}
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            width: '100%'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

                {/* Messages List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {messages.length === 0 ? (
                        <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <Bot size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <p>Start a new conversation.</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className="animate-fade-in" style={{
                                display: 'flex',
                                gap: '1rem',
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: '70%',
                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: msg.role === 'user' ? 'var(--primary-color)' : 'var(--sidebar-bg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {msg.role === 'user' ? <User size={18} color="white" /> : <Bot size={18} color="#3b82f6" />}
                                </div>

                                <div style={{
                                    background: msg.role === 'user' ? 'var(--message-user-bg)' : 'var(--message-bot-bg)',
                                    padding: '1rem',
                                    borderRadius: '1rem',
                                    borderTopRightRadius: msg.role === 'user' ? '0' : '1rem',
                                    borderTopLeftRadius: msg.role === 'user' ? '1rem' : '0',
                                    lineHeight: '1.5',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}>
                                    {msg.text}
                                </div>
                            </div>
                        ))
                    )}
                    {loading && (
                        <div className="animate-fade-in" style={{ alignSelf: 'flex-start', marginLeft: '3rem', color: 'var(--text-secondary)' }}>
                            Thinking...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div style={{ padding: '2rem', background: 'transperent' }}>
                    <form onSubmit={handleSend} className="glass" style={{
                        display: 'flex',
                        padding: '0.5rem',
                        borderRadius: '0.75rem',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-color)'
                    }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                padding: '0.75rem',
                                outline: 'none',
                                fontSize: '1rem'
                            }}
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: input.trim() ? 1 : 0.5,
                                pointerEvents: input.trim() ? 'auto' : 'none'
                            }}
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}
