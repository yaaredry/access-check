import React, { useState } from 'react';

const EMPTY = { identifierType: 'IL_ID', identifierValue: '', verdict: 'APPROVED', approvalExpiration: '' };

export default function PersonForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await onSubmit({
        ...form,
        approvalExpiration: form.approvalExpiration || null,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Identifier Type</label>
        <select value={form.identifierType} onChange={(e) => set('identifierType', e.target.value)}>
          <option value="IL_ID">IL ID (Israeli ID)</option>
          <option value="IDF_ID">IDF ID (Military ID)</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Identifier Value</label>
        <input
          type="text"
          value={form.identifierValue}
          onChange={(e) => set('identifierValue', e.target.value)}
          placeholder={form.identifierType === 'IL_ID' ? '9-digit ID number' : '7-8 digit service number'}
          required
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Verdict</label>
        <select value={form.verdict} onChange={(e) => set('verdict', e.target.value)}>
          <option value="APPROVED">Approved</option>
          <option value="NOT_APPROVED">Not Approved</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Approval Expiration (optional)</label>
        <input
          type="date"
          value={form.approvalExpiration || ''}
          onChange={(e) => set('approvalExpiration', e.target.value)}
        />
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
