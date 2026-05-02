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

function isExpired(row) {
  if (!['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT'].includes(row.verdict)) return false;
  return !!(row.approval_expiration && new Date(row.approval_expiration) < new Date());
}

function statusConfig(row) {
  if (row.status === 'PENDING') {
    return { label: 'Pending Review', color: '#d97706', bg: 'rgba(245,158,11,.12)' };
  }
  if (row.status === 'NOT_APPROVED' || row.verdict === 'NOT_APPROVED') {
    return { label: 'Rejected', color: 'var(--not-approved)', bg: 'rgba(239,68,68,.1)' };
  }
  if (row.status === 'APPROVED' || ['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT'].includes(row.verdict)) {
    if (isExpired(row)) {
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

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'expired',  label: 'Expired' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function matchesFilter(row, filter) {
  if (filter === 'all') return true;
  if (filter === 'expired') return isExpired(row);
  if (filter === 'pending') return row.status === 'PENDING';
  if (filter === 'rejected') {
    return (row.status === 'NOT_APPROVED' || row.verdict === 'NOT_APPROVED') && row.status !== 'PENDING';
  }
  if (filter === 'approved') {
    return ['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT'].includes(row.verdict) && !isExpired(row);
  }
  return true;
}

function matchesSearch(row, search) {
  if (!search.trim()) return true;
  return row.identifier_value.includes(search.trim());
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const aExp = isExpired(a) ? 0 : 1;
    const bExp = isExpired(b) ? 0 : 1;
    if (aExp !== bExp) return aExp - bExp;
    return 0;
  });
}

const FILTER_LABEL = {
  expired: 'expired',
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
};

export default function MySubmissions({ onExtend }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [hiddenCount, setHiddenCount] = useState(0);
  const [showingAll, setShowingAll] = useState(false);

  const load = useCallback(async (includeStale = false) => {
    setLoading(true);
    setError('');
    if (!includeStale) setShowingAll(false);
    try {
      const data = await api.getMySubmissions(includeStale);
      setRows(data.rows);
      setHiddenCount(data.hiddenCount ?? 0);
      if (includeStale) setShowingAll(true);
    } catch {
      setError('Could not load submissions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = sortRows(rows);
  const filtered = sorted.filter(r => matchesFilter(r, activeFilter) && matchesSearch(r, search));

  const noResults = !loading && !error && rows.length > 0 && filtered.length === 0;

  return (
    <div style={containerStyle}>
      {/* Search */}
      <div style={searchBarStyle}>
        <input
          type="search"
          placeholder="Search by ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={searchInputStyle}
          aria-label="Search by ID"
        />
      </div>

      {/* Filter chips */}
      <div style={filterBarStyle}>
        <div style={filterScrollStyle}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={chipStyle(activeFilter === f.key)}
              aria-pressed={activeFilter === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 20px 0' }}>
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

        {noResults && search.trim() && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            No results for &ldquo;{search.trim()}&rdquo;.
          </p>
        )}

        {noResults && !search.trim() && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            No {FILTER_LABEL[activeFilter]} submissions.
          </p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(row => {
              const cfg = statusConfig(row);
              const expiresInDays = daysUntilExpiry(row.approval_expiration);
              const expiringSoon = expiresInDays !== null && expiresInDays <= 2;
              const expired = isExpired(row);
              return (
                <div
                  key={row.id}
                  onClick={expired && onExtend ? () => onExtend(row) : undefined}
                  style={{
                    ...cardStyle,
                    borderLeft: `4px solid ${cfg.color}`,
                    ...(expired && onExtend ? expiredClickableStyle : {}),
                  }}
                >
                  {/* ID + status badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1 }}>
                      {row.identifier_value}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                      color: cfg.color, background: cfg.bg, flexShrink: 0, marginLeft: 8,
                    }}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Division */}
                  {row.division && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {row.division}
                    </div>
                  )}

                  {/* Submitted / Extended dates */}
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Submitted {new Date(row.created_at).toLocaleDateString()}
                  </div>
                  {row.last_resubmitted_at && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Extended {new Date(row.last_resubmitted_at).toLocaleDateString()}
                    </div>
                  )}

                  {/* Active window */}
                  {row.approval_start_date && row.approval_expiration && (
                    <div style={{ fontSize: 13, color: expiringSoon ? '#d97706' : 'var(--text-muted)', marginTop: 2 }}>
                      Active {new Date(row.approval_start_date + 'T00:00:00').toLocaleDateString()} – {new Date(row.approval_expiration + 'T00:00:00').toLocaleDateString()}
                    </div>
                  )}
                  {!row.approval_start_date && row.approval_expiration && (
                    <div style={{ fontSize: 13, color: expiringSoon ? '#d97706' : 'var(--text-muted)', marginTop: 2 }}>
                      Expires {new Date(row.approval_expiration + 'T00:00:00').toLocaleDateString()}
                    </div>
                  )}

                  {/* Expiring soon warning */}
                  {expiringSoon && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px', borderRadius: 8,
                      background: 'rgba(245,158,11,.12)', color: '#d97706',
                      fontSize: 12, fontWeight: 600,
                    }}>
                      Expires in {expiresInDays === 1 ? '1 day' : `${expiresInDays} days`}
                    </div>
                  )}

                  {/* Rejection reason */}
                  {row.rejection_reason && (
                    <div style={{ fontSize: 13, color: 'var(--not-approved)', marginTop: 6, fontStyle: 'italic' }}>
                      {row.rejection_reason}
                    </div>
                  )}

                  {/* Extend hint */}
                  {expired && onExtend && (
                    <div style={{
                      marginTop: 10, fontSize: 12, fontWeight: 600,
                      color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      Tap to request extension →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && hiddenCount > 0 && !showingAll && (
          <div style={hiddenBannerStyle}>
            <span>
              {hiddenCount} older record{hiddenCount !== 1 ? 's' : ''} not shown
            </span>
            <button
              type="button"
              onClick={() => load(true)}
              style={showAllLinkStyle}
            >
              Show all
            </button>
          </div>
        )}

        {!loading && (
          <button className="secondary" onClick={() => load()} style={{ width: '100%', marginTop: 20 }}>
            Refresh
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

const searchBarStyle = {
  padding: '12px 20px 8px',
};

const searchInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 15,
  padding: '10px 14px',
  borderRadius: 10,
  border: '1.5px solid var(--border)',
  background: 'var(--surface)',
  color: 'inherit',
  outline: 'none',
};

const filterBarStyle = {
  padding: '0 20px 4px',
  overflowX: 'auto',
};

const filterScrollStyle = {
  display: 'flex',
  gap: 8,
  paddingBottom: 4,
};

function chipStyle(active) {
  return {
    flexShrink: 0,
    padding: '6px 16px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    border: active ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    cursor: 'pointer',
    width: 'auto',
    letterSpacing: 0,
    transition: 'background .12s, color .12s, border-color .12s',
  };
}

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '14px 16px',
};

const expiredClickableStyle = {
  cursor: 'pointer',
  userSelect: 'none',
};

const hiddenBannerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 16,
  padding: '10px 14px',
  borderRadius: 10,
  background: 'rgba(100,116,139,.08)',
  fontSize: 13,
  color: 'var(--text-muted)',
};

const showAllLinkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--primary)',
  cursor: 'pointer',
  flexShrink: 0,
  marginLeft: 12,
};
