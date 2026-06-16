import { useEffect, useState } from 'react';

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

function eventTypeLabel(eventType) {
  if (eventType === 'created') return 'Created';
  if (eventType === 'updated') return 'Updated';
  if (eventType === 'deleted') return 'Deleted';
  if (eventType === 'bulk_import') return 'Bulk Import';
  return eventType;
}

function ChangesDisplay({ changes }) {
  if (!changes || Object.keys(changes).length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

  if (changes.snapshot) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Full record snapshot</span>;
  }

  const entries = Object.entries(changes);
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {entries.map(([field, val]) => {
        if (!val || typeof val !== 'object' || !('old' in val)) return null;
        return (
          <li key={field} style={{ fontSize: 11, marginBottom: 2 }}>
            <strong>{field}:</strong>{' '}
            <span style={{ color: '#dc2626' }}>{val.old ?? '—'}</span>
            {' → '}
            <span style={{ color: '#16a34a' }}>{val.new ?? '—'}</span>
          </li>
        );
      })}
    </ul>
  );
}

const TAB_VISITS = 'visits';
const TAB_AUDIT = 'audit';

export default function VisitHistoryModal({
  person,
  visits,
  loading,
  error,
  onClose,
  auditLog = [],
  auditLoading = false,
  auditError = null,
  onAuditTabSelect,
}) {
  const [activeTab, setActiveTab] = useState(TAB_VISITS);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === TAB_AUDIT && onAuditTabSelect) {
      onAuditTabSelect();
    }
  }

  const tabStyle = (tab) => ({
    background: 'none',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)',
    fontWeight: activeTab === tab ? 600 : 400,
    cursor: 'pointer',
    padding: '6px 14px',
    fontSize: 13,
    marginRight: 4,
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Person history"
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
          minWidth: 420, maxWidth: 620, width: '100%',
          maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Person History</h3>
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

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #e5e7eb)', marginBottom: 16 }}>
          <button
            role="tab"
            aria-selected={activeTab === TAB_VISITS}
            style={tabStyle(TAB_VISITS)}
            onClick={() => handleTabChange(TAB_VISITS)}
          >
            Visit History
          </button>
          <button
            role="tab"
            aria-selected={activeTab === TAB_AUDIT}
            style={tabStyle(TAB_AUDIT)}
            onClick={() => handleTabChange(TAB_AUDIT)}
          >
            Modification History
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {activeTab === TAB_VISITS && (
            <>
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
            </>
          )}

          {activeTab === TAB_AUDIT && (
            <>
              {auditLoading && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>Loading…</p>
              )}
              {auditError && !auditLoading && (
                <p style={{ color: '#dc2626', textAlign: 'center', padding: '24px 0' }}>{auditError}</p>
              )}
              {!auditLoading && !auditError && auditLog.length === 0 && (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No modification history.</p>
              )}
              {!auditLoading && !auditError && auditLog.length > 0 && (
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', fontWeight: 600, fontSize: 12, paddingBottom: 8 }}>Date &amp; Time</th>
                      <th style={{ textAlign: 'left', fontWeight: 600, fontSize: 12, paddingBottom: 8 }}>Event</th>
                      <th style={{ textAlign: 'left', fontWeight: 600, fontSize: 12, paddingBottom: 8 }}>Changed By</th>
                      <th style={{ textAlign: 'left', fontWeight: 600, fontSize: 12, paddingBottom: 8 }}>Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id}>
                        <td style={{ fontSize: 12, paddingBottom: 8, color: 'var(--text-muted)', whiteSpace: 'nowrap', paddingRight: 12 }}>
                          {new Date(entry.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ fontSize: 12, paddingBottom: 8, fontWeight: 500, paddingRight: 12 }}>
                          {eventTypeLabel(entry.event_type)}
                        </td>
                        <td style={{ fontSize: 12, paddingBottom: 8, color: 'var(--text-muted)', paddingRight: 12 }}>
                          {entry.changed_by_username || '—'}
                        </td>
                        <td style={{ fontSize: 12, paddingBottom: 8 }}>
                          <ChangesDisplay changes={entry.changes} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
