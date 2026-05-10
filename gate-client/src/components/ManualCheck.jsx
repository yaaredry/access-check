import { useState } from 'react';
import { api } from '../api/client';
import VerdictDisplay from './VerdictDisplay';

const VERDICT_COLORS = {
  APPROVED: 'var(--approved)',
  ADMIN_APPROVED: '#ca8a04',
  APPROVED_WITH_ESCORT: '#eab308',
  NOT_APPROVED: 'var(--not-approved)',
  EXPIRED: '#ef4444',
  PENDING: 'var(--text-muted)',
  NOT_FOUND: 'var(--text-muted)',
  NOT_YET_ACTIVE: '#6366f1',
};

const VERDICT_LABELS = {
  APPROVED: 'APPROVED',
  ADMIN_APPROVED: 'ADMIN APPROVED',
  APPROVED_WITH_ESCORT: 'WITH ESCORT',
  NOT_APPROVED: 'NOT APPROVED',
  EXPIRED: 'EXPIRED',
  PENDING: 'PENDING',
  NOT_FOUND: 'NOT FOUND',
  NOT_YET_ACTIVE: 'NOT YET ACTIVE',
};

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

function isValidId(type, value) {
  if (type === 'IL_ID') return validateIlId(value);
  if (type === 'IDF_ID') return /^\d{7,8}$/.test(value);
  return false;
}

export default function ManualCheck({ onBack, recentChecks = [], onResult }) {
  const [type, setType] = useState('IL_ID');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showRecent, setShowRecent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!value.trim()) return;
    setError('');
    if (type === 'IL_ID' && !validateIlId(value.trim())) {
      setError('Invalid Israeli ID');
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyId(type, value.trim());
      setResult(res);
      onResult?.({ identifierValue: value.trim(), verdict: res.verdict });
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setValue('');
    setError('');
  }

  if (result) {
    return (
      <VerdictDisplay
        verdict={result.verdict}
        identifierValue={value.trim()}
        escortName={result.escortFullName}
        escortPhone={result.escortPhone}
        onBack={reset}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, flex: 1 }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
        Manual ID Check
      </h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="IL_ID">Israeli ID (9 digits)</option>
          <option value="IDF_ID">IDF ID (7-8 digits)</option>
        </select>

        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter ID number"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
          autoFocus
          maxLength={9}
        />

        {error && (
          <div style={{ color: 'var(--not-approved)', textAlign: 'center', fontWeight: 600 }}>{error}</div>
        )}

        <button
          type="submit"
          className="scan"
          disabled={loading || !isValidId(type, value)}
          style={{ marginTop: 8, fontSize: 22 }}
        >
          {loading ? 'Checking…' : 'Check'}
        </button>
      </form>

      {recentChecks.length > 0 && (
        <div>
          <button
            type="button"
            className="secondary"
            onClick={() => setShowRecent(prev => !prev)}
            style={{ fontSize: 14, padding: '8px 16px' }}
          >
            🕒 Recent ({recentChecks.length})
          </button>
          {showRecent && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentChecks.map((entry, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                }}>
                  <span style={{ fontWeight: 600, letterSpacing: 1 }}>{entry.identifierValue}</span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: VERDICT_COLORS[entry.verdict] || 'var(--text-muted)',
                  }}>
                    {VERDICT_LABELS[entry.verdict] || entry.verdict}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button className="back" onClick={onBack}>← Back</button>
    </div>
  );
}
