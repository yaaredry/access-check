import { useState } from 'react';
import { api } from '../api/client';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(username, password);
      if (res.role !== 'gate' && res.role !== 'admin') {
        setError('Access denied');
        return;
      }
      localStorage.setItem('gate_token', res.token);
      onLogin();
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
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          style={{ letterSpacing: 'normal', fontSize: 18, textAlign: 'left', padding: '16px 20px' }}
        />

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
