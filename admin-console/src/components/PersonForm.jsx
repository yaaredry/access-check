import { useState, useRef } from 'react';

const VISIT_REASONS = [
  'Drivers & Transport',
  'Food & Catering',
  'Construction & Infrastructure',
  'Maintenance & Technicians',
  'Suppliers & Equipment',
  'Regular & Reserve Military Personnel',
  'Medical & Emergency',
  'Official Visits & Meetings',
  'Cleaning & Services',
  'Other',
];

function parseReason(reason) {
  if (!reason) return { reasonCategory: '', reasonOther: '' };
  if (VISIT_REASONS.includes(reason) && reason !== 'Other') return { reasonCategory: reason, reasonOther: '' };
  return { reasonCategory: 'Other', reasonOther: reason === 'Other' ? '' : reason };
}

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
  { value: 'APPROVED',             label: 'Approved',              verdict: 'APPROVED',             status: null },
  { value: 'ADMIN_APPROVED',       label: 'Admin Approved',        verdict: 'ADMIN_APPROVED',       status: null },
  { value: 'APPROVED_WITH_ESCORT', label: 'Approved with Escort',  verdict: 'APPROVED_WITH_ESCORT', status: null },
  { value: 'NOT_APPROVED',         label: 'Not Approved',          verdict: 'NOT_APPROVED',         status: null },
  { value: 'PENDING',              label: 'Pending Review',        verdict: 'NOT_APPROVED',         status: 'PENDING' },
];

function resolveUiStatus(initial) {
  if (initial?.status === 'PENDING') return 'PENDING';
  if (initial?.verdict === 'APPROVED_WITH_ESCORT') return 'APPROVED_WITH_ESCORT';
  return initial?.verdict || 'APPROVED';
}

const EMPTY = {
  identifierType: 'IL_ID',
  identifierValue: '',
  uiStatus: 'APPROVED',
  approvalStartDate: '',
  approvalExpiration: '',
  population: 'IL_MILITARY',
  division: '',
  escortFullName: '',
  escortPhone: '',
  reasonCategory: '',
  reasonOther: '',
  requesterName: '',
};

export default function PersonForm({ initial, onSubmit, onSaveAndAddAnother, onCancel, loading }) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY;
    const { reasonCategory, reasonOther } = parseReason(initial.reason || '');
    return { ...EMPTY, ...initial, uiStatus: resolveUiStatus(initial), reasonCategory, reasonOther };
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const addAnotherRef = useRef(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    if (field === 'reasonCategory') setFieldErrors(prev => ({ ...prev, reasonOther: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const errors = {};
    if (form.identifierType === 'IL_ID' && !validateIlId(form.identifierValue)) {
      errors.identifierValue = 'Invalid Israeli ID';
    }
    if (form.approvalStartDate && form.approvalExpiration && form.approvalStartDate > form.approvalExpiration) {
      errors.approvalStartDate = 'Start date cannot be after the expiration date.';
    }
    const escortRequired = form.uiStatus === 'APPROVED_WITH_ESCORT' || form.population === 'CIVILIAN';
    if (escortRequired) {
      if (!form.escortFullName?.trim()) errors.escortFullName = 'Escort full name is required.';
      if (!form.escortPhone?.trim()) errors.escortPhone = 'Escort phone is required.';
      else if (!/^\+?[\d]+$/.test(form.escortPhone)) errors.escortPhone = 'Phone number can only contain digits and an optional "+" at the start.';
    }
    if (!form.reasonCategory) {
      errors.reasonCategory = 'Reason for visit is required.';
    } else if (form.reasonCategory === 'Other') {
      if (!form.reasonOther.trim()) {
        errors.reasonOther = 'Please describe the reason for this visit.';
      } else if (form.reasonOther.length > 100) {
        errors.reasonOther = 'Reason cannot exceed 100 characters.';
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      const { verdict, status } = STATUS_OPTIONS.find(o => o.value === form.uiStatus);
      const payload = {
        ...form,
        verdict,
        status,
        approvalStartDate: form.approvalStartDate || null,
        approvalExpiration: form.approvalExpiration || null,
        escortFullName: form.escortFullName || null,
        escortPhone: form.escortPhone || null,
        division: form.division || null,
        reason: form.reasonCategory === 'Other' ? (form.reasonOther.trim() || null) : (form.reasonCategory || null),
        requesterName: form.requesterName || null,
      };
      if (addAnotherRef.current && onSaveAndAddAnother) {
        await onSaveAndAddAnother(payload);
        setForm(prev => ({ ...prev, identifierValue: '', approvalStartDate: '', approvalExpiration: '' }));
        setFieldErrors({});
        setError('');
      } else {
        await onSubmit(payload);
      }
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
        <label htmlFor="pf-approvalStartDate" style={labelStyle}>Start Date (optional)</label>
        <input
          id="pf-approvalStartDate"
          type="date"
          value={form.approvalStartDate || ''}
          max={form.approvalExpiration || undefined}
          onChange={(e) => set('approvalStartDate', e.target.value)}
          style={fieldErrors.approvalStartDate ? errorInputStyle : undefined}
        />
        {fieldErrors.approvalStartDate && <p style={fieldErrorStyle}>⚠ {fieldErrors.approvalStartDate}</p>}
      </div>

      <div>
        <label htmlFor="pf-approvalExpiration" style={labelStyle}>Approval Expiration (optional)</label>
        <input
          id="pf-approvalExpiration"
          type="date"
          value={form.approvalExpiration || ''}
          min={form.approvalStartDate || undefined}
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

      {(form.uiStatus === 'APPROVED_WITH_ESCORT' || form.population === 'CIVILIAN') && (
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
        <label htmlFor="pf-requesterName" style={labelStyle}>Requester Name (optional)</label>
        <input
          id="pf-requesterName"
          type="text"
          placeholder="Name of person who filed this request"
          value={form.requesterName || ''}
          onChange={(e) => set('requesterName', e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="pf-reasonCategory" style={labelStyle}>Reason for Visit</label>
        <select
          id="pf-reasonCategory"
          value={form.reasonCategory}
          onChange={(e) => set('reasonCategory', e.target.value)}
          style={fieldErrors.reasonCategory ? errorInputStyle : undefined}
        >
          <option value="">Select a reason…</option>
          {VISIT_REASONS.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {fieldErrors.reasonCategory && <p style={fieldErrorStyle}>⚠ {fieldErrors.reasonCategory}</p>}
        {form.reasonCategory === 'Other' && (
          <>
            <textarea
              id="pf-reasonOther"
              placeholder="Describe the reason for this visit… (max 100 characters)"
              value={form.reasonOther || ''}
              onChange={(e) => set('reasonOther', e.target.value)}
              rows={3}
              style={{ resize: 'vertical', marginTop: 8, ...(fieldErrors.reasonOther ? errorInputStyle : {}) }}
            />
            {fieldErrors.reasonOther && <p style={fieldErrorStyle}>⚠ {fieldErrors.reasonOther}</p>}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0', textAlign: 'right' }}>
              {(form.reasonOther || '').length}/100
            </p>
          </>
        )}
      </div>

      {error && <p className="error-msg">{error}</p>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        {onSaveAndAddAnother && (
          <button type="submit" className="secondary" disabled={loading} onClick={() => { addAnotherRef.current = true; }}>
            {loading ? 'Saving…' : 'Save & Add Another'}
          </button>
        )}
        <button type="submit" className="primary" disabled={loading} onClick={() => { addAnotherRef.current = false; }}>
          {loading ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

const labelStyle = { display: 'block', marginBottom: 6, fontWeight: 500 };
const fieldErrorStyle = { color: 'var(--not-approved)', fontSize: 13, margin: '6px 0 0', fontWeight: 500 };
const errorInputStyle = { borderColor: 'var(--not-approved)', outline: 'none' };
