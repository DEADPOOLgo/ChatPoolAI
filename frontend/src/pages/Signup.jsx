import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Lock, Mail, User, ArrowRight } from 'lucide-react';

export default function Signup() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await res.json();
            if (res.ok) {
                navigate('/');
            } else {
                setError(data.error || 'Signup failed');
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        }
    };

    return (
        <div className="glass" style={{
            maxWidth: '400px',
            margin: '100px auto',
            padding: '2rem',
            borderRadius: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
        }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{
                    background: 'rgba(59, 130, 246, 0.2)',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto'
                }}>
                    <UserPlus size={32} color="#3b82f6" />
                </div>
                <h2 style={{ margin: 0 }}>Create Account</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Join to start chatting with AI</p>
            </div>

            {error && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem'
                }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                    <User size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                    <input
                        type="text"
                        placeholder="Full Name"
                        className="input-field"
                        style={{ paddingLeft: '40px' }}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>
                <div style={{ position: 'relative' }}>
                    <Mail size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                    <input
                        type="email"
                        placeholder="Email Address"
                        className="input-field"
                        style={{ paddingLeft: '40px' }}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div style={{ position: 'relative' }}>
                    <Lock size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                    <input
                        type="password"
                        placeholder="Password"
                        className="input-field"
                        style={{ paddingLeft: '40px' }}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    Create Account <ArrowRight size={18} />
                </button>
            </form>

            <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Already have an account? <Link to="/login" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
            </div>
        </div>
    );
}
