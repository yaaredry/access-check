import { useEffect } from 'react';

function verdictLabel(verdict) {
  if (!verdict) return '—';
  if (verdict === 'APPROVED') return 'Approved';
  if (verdict === 'ADMIN_APPROVED') return 'Admin Approved';
  if (verdict === 'APPROVED_WITH_ESCORT') return 'Approved with Escort';
  if (verdict === 'NOT_APPROVED') return 'Not Approved';
  if (verdict === 'EXPIRED') return 'Expired';
  if (verdict === 'NOT_FOUND') return 'Not Found';
  return verdict;
}

function verdictColor(verdict) {
  if (!verdict) return 'var(--text-muted)';
  if (verdict === 'APPROVED' || verdict === 'ADMIN_APPROVED' || verdict === 'APPROVED_WITH_ESCORT') return '#16a34a';
  if (verdict === 'NOT_APPROVED') return '#dc2626';
  if (verdict === 'EXPIRED') return '#d97706';
  return 'var(--text-muted)';
}

export default function VisitHistoryModal({ person, visits, loading, error, onClose }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visit history"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        data-testid="modal-backdrop"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
      />
      <div
        style={{
          position: 'relative', zIndex: 1,
          background: 'var(--surface, #fff)',
          borderRadius: 10, padding: '28px 32px',
          minWidth: 380, maxWidth: 560, width: '100%',
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Visit History</h3>
            {person && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                {person.identifier_type}: <strong>{person.identifier_value}</strong>
              </p>
            )}
          </div>
          <button
            aria-label="Close"
            className="secondary"
            style={{ padding: '4px 12px', fontSize: 13 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Loading…</p>
          )}
          {error && !loading && (
            <p style={{ color: '#dc2626', textAlign: 'center', padding: '24px 0' }}>{error}</p>
          )}
          {!loading && !error && visits.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No visits recorded.</p>
          )}
          {!loading && !error && visits.length > 0 && (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontWeight: 600, fontSize: 12, paddingBottom: 8 }}>Date &amp; Time</th>
                  <th style={{ textAlign: 'left', fontWeight: 600, fontSize: 12, paddingBottom: 8 }}>Verdict</th>
                  <th style={{ textAlign: 'left', fontWeight: 600, fontSize: 12, paddingBottom: 8 }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontSize: 13, paddingBottom: 6, color: 'var(--text-muted)' }}>
                      {new Date(v.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ fontSize: 13, paddingBottom: 6, fontWeight: 500, color: verdictColor(v.verdict) }}>
                      {verdictLabel(v.verdict)}
                    </td>
                    <td style={{ fontSize: 12, paddingBottom: 6, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {v.source || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
