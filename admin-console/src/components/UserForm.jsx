import { useState } from 'react';

export default function UserForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    username: initial?.username || '',
    name: initial?.name || '',
  });
  const [error, setError] = useState('');

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({ username: form.username.trim(), name: form.name.trim() });
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Email</label>
        <input
          type="email"
          value={form.username}
          onChange={e => set('username', e.target.value)}
          placeholder="user@example.com"
          required
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Display name"
          required
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      {error && <p style={{ color: 'var(--not-approved)', fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Saving…' : initial ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    </form>
  );
}
