import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, LogOut, User, Bot, MessageSquare, Plus, MessageCircle, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [threads, setThreads] = useState([]);
    const [activeThreadId, setActiveThreadId] = useState(null);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);
    const [ws, setWs] = useState(null);
    const [copiedIndex, setCopiedIndex] = useState(null);

    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // Initialize Auth & WS
    useEffect(() => {
        checkAuth();
    }, []);

    // Scroll handling
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
                connectWebSocket(data.user);
            }
        } catch (e) {
            navigate('/login');
        }
    };

    const connectWebSocket = (currentUser) => {
        // Assume backend is on same host, different port (or proxy)
        // In this setup: Frontend :7321, Backend :7320 (proxied via /api)
        // Since we are proxying /api, we might not proxy WS automatically with Vite unless configured.
        // Let's assume standard Vite proxy supports WS or direct connect.
        // If Vite proxy is set up for /api -> http://localhost:7320, 
        // WS endpoint would be ws://localhost:7320

        const wsUrl = 'ws://localhost:7320';
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('WebSocket Connected');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWsMessage(data);
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        socket.onclose = () => {
            console.log('WebSocket Disconnected');
            // Reconnect logic could go here
        };

        setWs(socket);
    };

    const handleWsMessage = (data) => {
        if (data.type === 'user_message_saved') {
            const { message, threadId, newThread } = data;

            // If new thread started
            if (newThread) {
                setActiveThreadId(threadId);
                setThreads(prev => [newThread, ...prev]);
            }

            // Ensure user message is shown (we optimistically added it, but let's confirm or update ID)
            // Ideally we rely on optimistic update mostly.
        }
        else if (data.type === 'stream_start') {
            // Create a placeholder for AI response if not exists or start accumulating
            setMessages(prev => {
                // Check if last message is already an empty AI message? 
                // Actually, let's just push a fresh empty AI message or "Thinking..."
                return [...prev, { role: 'assistant', text: "", isStreaming: true }];
            });
            setLoading(true);
        }
        else if (data.type === 'stream_chunk') {
            setMessages(prev => {
                const newArr = [...prev];
                const lastMsg = newArr[newArr.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    // Update last message
                    newArr[newArr.length - 1] = {
                        ...lastMsg,
                        text: lastMsg.text + data.text
                    };
                }
                return newArr;
            });
        }
        else if (data.type === 'stream_done') {
            setLoading(false);
            setMessages(prev => {
                const newArr = [...prev];
                const lastMsg = newArr[newArr.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    newArr[newArr.length - 1] = {
                        ...lastMsg,
                        // Ensure we rely on fullMessage just in case, or just streaming result
                        // data.fullMessage contains db record.
                        ...data.fullMessage,
                        isStreaming: false
                    };
                }
                return newArr;
            });

            // Re-order threads (move current to top)
            setThreads(prev => {
                const filtered = prev.filter(t => t.id !== activeThreadId);
                const current = prev.find(t => t.id === activeThreadId);
                if (current) {
                    return [{ ...current, updatedAt: new Date().toISOString() }, ...filtered];
                }
                return prev;
            });
        }
    };

    const fetchThreads = async () => {
        try {
            const res = await fetch('/api/chat/threads');
            if (res.ok) {
                const data = await res.json();
                setThreads(data);
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
        if (!input.trim() || !ws) return;

        const text = input;
        const userMsg = { role: 'user', text: text, timestamp: new Date().toISOString() };

        // Optimistic UI
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true); // Will act as "waiting for stream start"

        // Send via WS
        ws.send(JSON.stringify({
            type: 'message',
            text: text,
            threadId: activeThreadId,
            userId: user?.id
        }));
    };

    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        if (ws) ws.close();
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
                                    position: 'relative',
                                    background: msg.role === 'user' ? 'var(--message-user-bg)' : 'var(--message-bot-bg)',
                                    padding: '1rem',
                                    borderRadius: '1rem',
                                    borderTopRightRadius: msg.role === 'user' ? '0' : '1rem',
                                    borderTopLeftRadius: msg.role === 'user' ? '1rem' : '0',
                                    lineHeight: '1.5',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-word',
                                    minWidth: '150px' // Ensure space for copy button
                                }}>

                                    {/* Copy Button */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '0.5rem',
                                        right: '0.5rem',
                                        opacity: 0.7,
                                        cursor: 'pointer'
                                    }} onClick={() => handleCopy(msg.text, idx)}>
                                        {copiedIndex === idx ?
                                            <Check size={14} color="var(--text-secondary)" /> :
                                            <Copy size={14} color="var(--text-secondary)" />
                                        }
                                    </div>

                                    <div style={{ paddingRight: '1rem' }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {loading && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
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
                            disabled={loading && !ws} // Allow typing if we have WS but maybe busy (concurrent?) - simple blocking for now
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
