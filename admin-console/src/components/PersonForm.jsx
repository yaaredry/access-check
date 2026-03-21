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

const EMPTY = {
  identifierType: 'IL_ID',
  identifierValue: '',
  uiStatus: 'APPROVED',
  approvalExpiration: '',
  population: 'IL_MILITARY',
  division: '',
  escortFullName: '',
  escortPhone: '',
  reason: '',
};

export default function PersonForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(
    initial ? { ...EMPTY, ...initial, uiStatus: resolveUiStatus(initial) } : EMPTY
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const errors = {};
    if (form.identifierType === 'IL_ID' && !validateIlId(form.identifierValue)) {
      errors.identifierValue = 'Invalid Israeli ID';
    }
    if (form.population === 'CIVILIAN') {
      if (!form.escortFullName.trim()) errors.escortFullName = 'Escort full name is required for civilian visitors.';
      if (!form.escortPhone.trim()) errors.escortPhone = 'Escort phone is required for civilian visitors.';
      else if (!/^\+?[\d]+$/.test(form.escortPhone)) errors.escortPhone = 'Phone number can only contain digits and an optional "+" at the start.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      const { verdict, status } = STATUS_OPTIONS.find(o => o.value === form.uiStatus);
      await onSubmit({
        ...form,
        verdict,
        status,
        approvalExpiration: form.approvalExpiration || null,
        escortFullName: form.escortFullName || null,
        escortPhone: form.escortPhone || null,
        division: form.division || null,
        reason: form.reason || null,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label htmlFor="pf-identifierType" style={labelStyle}>Identifier Type</label>
        <select id="pf-identifierType" value={form.identifierType} onChange={(e) => set('identifierType', e.target.value)}>
          <option value="IL_ID">IL ID (Israeli ID)</option>
          <option value="IDF_ID">IDF ID (Military ID)</option>
        </select>
      </div>

      <div>
        <label htmlFor="pf-identifierValue" style={labelStyle}>Identifier Value</label>
        <input
          id="pf-identifierValue"
          type="text"
          value={form.identifierValue}
          onChange={(e) => set('identifierValue', e.target.value)}
          placeholder={form.identifierType === 'IL_ID' ? '9-digit ID number' : '7-8 digit service number'}
          required
          style={fieldErrors.identifierValue ? errorInputStyle : undefined}
        />
        {fieldErrors.identifierValue && <p style={fieldErrorStyle}>⚠ {fieldErrors.identifierValue}</p>}
      </div>

      <div>
        <label htmlFor="pf-status" style={labelStyle}>Status</label>
        <select id="pf-status" value={form.uiStatus} onChange={(e) => set('uiStatus', e.target.value)}>
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pf-approvalExpiration" style={labelStyle}>Approval Expiration (optional)</label>
        <input
          id="pf-approvalExpiration"
          type="date"
          value={form.approvalExpiration || ''}
          onChange={(e) => set('approvalExpiration', e.target.value)}
        />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />

      <div>
        <label htmlFor="pf-population" style={labelStyle}>Population</label>
        <select id="pf-population" value={form.population} onChange={(e) => set('population', e.target.value)}>
          <option value="IL_MILITARY">IL Military</option>
          <option value="CIVILIAN">Civilian</option>
        </select>
      </div>

      <div>
        <label htmlFor="pf-division" style={labelStyle}>Division (optional)</label>
        <input
          id="pf-division"
          type="text"
          placeholder="Unit or division"
          value={form.division || ''}
          onChange={(e) => set('division', e.target.value)}
        />
      </div>

      {form.population === 'CIVILIAN' && (
        <>
          <div>
            <label htmlFor="pf-escortFullName" style={labelStyle}>Escort Full Name</label>
            <input
              id="pf-escortFullName"
              type="text"
              placeholder="Escort's full name"
              value={form.escortFullName || ''}
              onChange={(e) => set('escortFullName', e.target.value)}
              style={fieldErrors.escortFullName ? errorInputStyle : undefined}
            />
            {fieldErrors.escortFullName && <p style={fieldErrorStyle}>⚠ {fieldErrors.escortFullName}</p>}
          </div>

          <div>
            <label htmlFor="pf-escortPhone" style={labelStyle}>Escort Phone</label>
            <input
              id="pf-escortPhone"
              type="tel"
              placeholder="+972501234567"
              value={form.escortPhone || ''}
              onChange={(e) => set('escortPhone', e.target.value)}
              style={fieldErrors.escortPhone ? errorInputStyle : undefined}
            />
            {fieldErrors.escortPhone && <p style={fieldErrorStyle}>⚠ {fieldErrors.escortPhone}</p>}
          </div>
        </>
      )}

      <div>
        <label htmlFor="pf-reason" style={labelStyle}>Reason for Visit (optional)</label>
        <textarea
          id="pf-reason"
          placeholder="Describe the reason for this visit…"
          value={form.reason || ''}
          onChange={(e) => set('reason', e.target.value)}
          rows={3}
          style={{ resize: 'vertical' }}
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

const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 500 };
const fieldErrorStyle = { color: 'var(--not-approved)', fontSize: 13, margin: '6px 0 0', fontWeight: 500 };
const errorInputStyle = { borderColor: 'var(--not-approved)', outline: 'none' };
