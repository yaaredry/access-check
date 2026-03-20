import { useState } from 'react';

function validateIlId(value) {
  if (!/^\d{9}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = digits[i] * (i % 2 === 0 ? 1 : 2);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

// Maps a UI status value to the { verdict, status } pair sent to the backend
const STATUS_OPTIONS = [
  { value: 'APPROVED',       label: 'Approved',        verdict: 'APPROVED',      status: null },
  { value: 'ADMIN_APPROVED', label: 'Admin Approved',  verdict: 'ADMIN_APPROVED', status: null },
  { value: 'NOT_APPROVED',   label: 'Not Approved',    verdict: 'NOT_APPROVED',   status: null },
  { value: 'PENDING',        label: 'Pending Review',  verdict: 'NOT_APPROVED',   status: 'PENDING' },
];

function resolveUiStatus(initial) {
  if (initial?.status === 'PENDING') return 'PENDING';
  return initial?.verdict || 'APPROVED';
}

const EMPTY = { identifierType: 'IL_ID', identifierValue: '', uiStatus: 'APPROVED', approvalExpiration: '' };

export default function PersonForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(
    initial ? { ...initial, uiStatus: resolveUiStatus(initial) } : EMPTY
  );
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.identifierType === 'IL_ID' && !validateIlId(form.identifierValue)) {
      setError('Invalid Israeli ID');
      return;
    }
    try {
      const { verdict, status } = STATUS_OPTIONS.find(o => o.value === form.uiStatus);
      await onSubmit({
        ...form,
        verdict,
        status,
        approvalExpiration: form.approvalExpiration || null,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  const isAccessRequest = !!initial?.status;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label htmlFor="pf-identifierType" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Identifier Type</label>
        <select id="pf-identifierType" value={form.identifierType} onChange={(e) => set('identifierType', e.target.value)}>
          <option value="IL_ID">IL ID (Israeli ID)</option>
          <option value="IDF_ID">IDF ID (Military ID)</option>
        </select>
      </div>

      <div>
        <label htmlFor="pf-identifierValue" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Identifier Value</label>
        <input
          id="pf-identifierValue"
          type="text"
          value={form.identifierValue}
          onChange={(e) => set('identifierValue', e.target.value)}
          placeholder={form.identifierType === 'IL_ID' ? '9-digit ID number' : '7-8 digit service number'}
          required
        />
      </div>

      <div>
        <label htmlFor="pf-status" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Status</label>
        <select id="pf-status" value={form.uiStatus} onChange={(e) => set('uiStatus', e.target.value)}>
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pf-approvalExpiration" style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Approval Expiration (optional)</label>
        <input
          id="pf-approvalExpiration"
          type="date"
          value={form.approvalExpiration || ''}
          onChange={(e) => set('approvalExpiration', e.target.value)}
        />
      </div>

      {isAccessRequest && (
        <>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Access Request Details</p>

          {form.population && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Population</label>
              <input type="text" value={form.population} readOnly style={{ background: 'var(--surface)' }} />
            </div>
          )}

          {form.division && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Division</label>
              <input type="text" value={form.division} readOnly style={{ background: 'var(--surface)' }} />
            </div>
          )}

          {form.escort_full_name && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Escort Full Name</label>
              <input type="text" value={form.escort_full_name} readOnly style={{ background: 'var(--surface)' }} />
            </div>
          )}

          {form.escort_phone && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Escort Phone</label>
              <input type="text" value={form.escort_phone} readOnly style={{ background: 'var(--surface)' }} />
            </div>
          )}

          {form.reason && (
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Reason</label>
              <textarea value={form.reason} readOnly rows={3} style={{ background: 'var(--surface)', resize: 'none' }} />
            </div>
          )}
        </>
      )}

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
