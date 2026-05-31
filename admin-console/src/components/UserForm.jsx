import { useState } from 'react';

export default function UserForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState({
    username: initial?.username || '',
    name: initial?.name || '',
    maxRequestDays: initial?.max_request_days ?? 7,
    canExtend: initial?.can_extend ?? true,
  });
  const [error, setError] = useState('');

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({ username: form.username.trim(), name: form.name.trim(), maxRequestDays: Number(form.maxRequestDays), canExtend: form.canExtend });
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
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Max Request Days</label>
        <input
          type="number"
          min={1}
          max={30}
          value={form.maxRequestDays}
          onChange={e => set('maxRequestDays', e.target.value)}
          required
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Maximum number of days this user can request access for (1–30, default 7).
        </p>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Extension Permission</label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.canExtend}
            onChange={e => set('canExtend', e.target.checked)}
            style={{ width: 'auto', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13 }}>Can request extension of expired entries</span>
        </label>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          When unchecked, the user must submit a full new request instead of using the one-click extension shortcut.
        </p>
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
