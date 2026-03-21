import { useState } from 'react';
import { api } from '../api/client';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(username, password);
      if (!['gate', 'admin', 'access_requestor'].includes(res.role)) {
        setError('Access denied');
        return;
      }
      localStorage.setItem('gate_token', res.token);
      localStorage.setItem('gate_role', res.role);
      onLogin(res.role);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 32,
      gap: 24,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🛡️</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: 1 }}>Access Check</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 14 }}>Gate operator login</p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          required
          style={{ letterSpacing: 'normal', fontSize: 18, textAlign: 'left', padding: '16px 20px' }}
        />
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ letterSpacing: 'normal', fontSize: 18, textAlign: 'left', padding: '16px 52px 16px 20px', width: '100%', boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => setShowPassword(v => !v)}
            style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 6,
              color: 'var(--text-muted)', lineHeight: 0, display: 'flex', alignItems: 'center',
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
          </button>
        </div>

        {error && (
          <p style={{ color: 'var(--not-approved)', fontSize: 14, textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}

        <button type="submit" className="scan" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
