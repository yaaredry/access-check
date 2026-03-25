import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr + 'T00:00:00');
  const days = Math.round((expiry - today) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  return days === 0 ? 1 : days;
}

function statusConfig(row) {
  if (row.status === 'PENDING') {
    return { label: 'Pending Review', color: '#d97706', bg: 'rgba(245,158,11,.12)' };
  }
  if (row.status === 'NOT_APPROVED' || row.verdict === 'NOT_APPROVED') {
    return { label: 'Rejected', color: 'var(--not-approved)', bg: 'rgba(239,68,68,.1)' };
  }
  if (row.status === 'APPROVED' || ['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT'].includes(row.verdict)) {
    if (row.approval_expiration && new Date(row.approval_expiration) < new Date()) {
      return { label: 'Expired', color: 'var(--text-muted)', bg: 'rgba(100,116,139,.1)' };
    }
    if (row.verdict === 'APPROVED_WITH_ESCORT') {
      return { label: 'Approved with Escort', color: 'var(--approved)', bg: 'rgba(34,197,94,.1)' };
    }
    if (row.verdict === 'ADMIN_APPROVED') {
      return { label: 'Admin Approved', color: 'var(--approved)', bg: 'rgba(34,197,94,.1)' };
    }
    return { label: 'Approved', color: 'var(--approved)', bg: 'rgba(34,197,94,.1)' };
  }
  return { label: 'Unknown', color: 'var(--text-muted)', bg: 'rgba(100,116,139,.1)' };
}

export default function MySubmissions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getMySubmissions();
      setRows(data.rows);
    } catch {
      setError('Could not load submissions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={containerStyle}>
      <div style={{ padding: '20px 20px 0' }}>
        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>Loading…</p>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ color: 'var(--not-approved)', marginBottom: 16 }}>{error}</p>
            <button className="secondary" onClick={load}>Try Again</button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            No submissions yet.
          </p>
        )}

        {!loading && !error && rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rows.map(row => {
              const cfg = statusConfig(row);
              const expiresInDays = daysUntilExpiry(row.approval_expiration);
              const expiringSoon = expiresInDays !== null && expiresInDays <= 2;
              return (
                <div key={row.id} style={{ ...cardStyle, borderLeft: `4px solid ${cfg.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>
                      {row.identifier_value}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                      color: cfg.color, background: cfg.bg,
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Submitted {new Date(row.created_at).toLocaleDateString()}
                  </div>
                  {row.approval_expiration && (
                    <div style={{ fontSize: 13, color: expiringSoon ? '#d97706' : 'var(--text-muted)', marginTop: 2 }}>
                      Expires {new Date(row.approval_expiration).toLocaleDateString()}
                    </div>
                  )}
                  {expiringSoon && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px', borderRadius: 8,
                      background: 'rgba(245,158,11,.12)', color: '#d97706',
                      fontSize: 12, fontWeight: 600,
                    }}>
                      ⚠ Expires in {expiresInDays === 1 ? '1 day' : `${expiresInDays} days`}
                    </div>
                  )}
                  {row.rejection_reason && (
                    <div style={{ fontSize: 13, color: 'var(--not-approved)', marginTop: 6, fontStyle: 'italic' }}>
                      {row.rejection_reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && (
          <button className="secondary" onClick={load} style={{ width: '100%', marginTop: 20 }}>
            ↻ Refresh
          </button>
        )}
      </div>
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

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '14px 16px',
};
