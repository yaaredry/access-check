import { useState } from 'react';
import { api } from '../api/client';

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

const EMPTY = {
  requesterName: '',
  ilId: '',
  population: 'IL_MILITARY',
  division: '',
  escortFullName: '',
  escortPhone: '',
  approvalExpiration: '',
  reason: '',
};

// Maps backend field paths to friendly labels used in error messages
const FIELD_LABELS = {
  requesterName:    'your name',
  ilId:             'ID number',
  population:       'population',
  escortFullName:   'escort full name',
  escortPhone:      'escort phone',
  approvalExpiration: 'expiration date',
  reason:           'reason for entering',
};

// Maps specific backend error messages to user-friendly text
function friendlyMessage(msg, field) {
  if (msg.includes('Invalid IL_ID')) return 'This ID number is not valid. Please double-check and try again.';
  if (msg.includes('required for CIVILIAN')) return `${FIELD_LABELS[field] ?? field} is required for civilian visitors.`;
  if (msg.includes('required')) return `${FIELD_LABELS[field] ?? field} is required.`;
  if (msg.includes('future date')) return 'The expiration date must be in the future.';
  if (msg.includes('valid date')) return 'Please enter a valid date.';
  if (msg.includes('digits')) return 'Phone number can only contain digits and an optional "+" at the start.';
  return msg;
}

export default function AccessRequestForm({ onLogout }) {
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function clientValidate() {
    const errors = {};
    if (!form.requesterName.trim()) {
      errors.requesterName = 'Please enter your name.';
    }
    if (!validateIlId(form.ilId)) {
      errors.ilId = 'This ID number is not valid. Please double-check and try again.';
    }
    if (!form.approvalExpiration) {
      errors.approvalExpiration = 'Expiration date is required.';
    } else if (new Date(form.approvalExpiration) <= new Date()) {
      errors.approvalExpiration = 'The expiration date must be in the future.';
    }
    if (!form.reason.trim()) {
      errors.reason = 'Please explain the reason for this visit.';
    }
    if (form.population === 'CIVILIAN') {
      if (!form.escortFullName.trim()) errors.escortFullName = 'Escort full name is required for civilian visitors.';
      if (!form.escortPhone.trim()) errors.escortPhone = 'Escort phone is required for civilian visitors.';
      else if (!/^\+?[\d]+$/.test(form.escortPhone)) errors.escortPhone = 'Phone number can only contain digits and an optional "+" at the start.';
    }
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGeneralError('');

    const clientErrors = clientValidate();
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      await api.submitAccessRequest(form);
      setSubmitted(true);
    } catch (err) {
      // Parse per-field errors from express-validator response
      if (err.data?.errors && Array.isArray(err.data.errors)) {
        const parsed = {};
        err.data.errors.forEach(({ path, msg }) => {
          parsed[path] = friendlyMessage(msg, path);
        });
        setFieldErrors(parsed);
      } else {
        setGeneralError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Request Submitted</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
            Your access request has been submitted and is pending review.
          </p>
          <button className="scan" onClick={() => { setSubmitted(false); setForm(EMPTY); }}>
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Access Request</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Fill in the details below</p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Field label="Your Name" error={fieldErrors.requesterName}>
          <input
            type="text"
            placeholder="Your full name"
            value={form.requesterName}
            onChange={e => set('requesterName', e.target.value)}
            required
            style={{ ...inputStyle, ...(fieldErrors.requesterName ? errorInputStyle : {}) }}
          />
        </Field>

        <Field label="IL ID Number" error={fieldErrors.ilId}>
          <input
            type="text"
            placeholder="9-digit Israeli ID"
            value={form.ilId}
            onChange={e => set('ilId', e.target.value.trim())}
            required
            inputMode="numeric"
            style={{ ...inputStyle, ...(fieldErrors.ilId ? errorInputStyle : {}) }}
          />
        </Field>

        <Field label="Population">
          <select
            value={form.population}
            onChange={e => set('population', e.target.value)}
            style={inputStyle}
          >
            <option value="IL_MILITARY">IL Military</option>
            <option value="CIVILIAN">Civilian</option>
          </select>
        </Field>

        <Field label="Division (optional)">
          <input
            type="text"
            placeholder="Unit or division"
            value={form.division}
            onChange={e => set('division', e.target.value)}
            style={inputStyle}
          />
        </Field>

        {form.population === 'CIVILIAN' && (
          <>
            <Field label="Escort Full Name" error={fieldErrors.escortFullName}>
              <input
                type="text"
                placeholder="Escort's full name"
                value={form.escortFullName}
                onChange={e => set('escortFullName', e.target.value)}
                style={{ ...inputStyle, ...(fieldErrors.escortFullName ? errorInputStyle : {}) }}
              />
            </Field>

            <Field label="Escort Phone" error={fieldErrors.escortPhone}>
              <input
                type="tel"
                placeholder="+972501234567"
                value={form.escortPhone}
                onChange={e => set('escortPhone', e.target.value)}
                style={{ ...inputStyle, ...(fieldErrors.escortPhone ? errorInputStyle : {}) }}
              />
            </Field>
          </>
        )}

        <Field label="Expiration Date" error={fieldErrors.approvalExpiration}>
          <input
            type="date"
            value={form.approvalExpiration}
            onChange={e => set('approvalExpiration', e.target.value)}
            style={{ ...inputStyle, ...(fieldErrors.approvalExpiration ? errorInputStyle : {}) }}
          />
        </Field>

        <Field label="Reason for Entering" error={fieldErrors.reason}>
          <textarea
            placeholder="Describe the reason for entry…"
            value={form.reason}
            onChange={e => set('reason', e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', ...(fieldErrors.reason ? errorInputStyle : {}) }}
          />
        </Field>

        {generalError && (
          <p style={{ color: 'var(--not-approved)', fontSize: 14, margin: 0, textAlign: 'center', fontWeight: 500 }}>
            {generalError}
          </p>
        )}

        <button type="submit" className="scan" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Submitting…' : 'Submit Request'}
        </button>

        <button type="button" className="secondary" onClick={onLogout}>
          Logout
        </button>
      </form>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 15 }}>{label}</label>
      {children}
      {error && (
        <p style={{ color: 'var(--not-approved)', fontSize: 13, margin: '6px 0 0', fontWeight: 500 }}>
          ⚠ {error}
        </p>
      )}
    </div>
  );
}

const containerStyle = {
  minHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  maxWidth: 480,
  margin: '0 auto',
};

const inputStyle = {
  fontSize: 18,
  padding: '14px 16px',
  width: '100%',
  boxSizing: 'border-box',
};

const errorInputStyle = {
  borderColor: 'var(--not-approved)',
  outline: 'none',
};
