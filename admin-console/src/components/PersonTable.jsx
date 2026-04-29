import { useState } from 'react';
import { api } from '../api/client';
import VisitHistoryModal from './VisitHistoryModal';

function verdictBadge(verdict, expiration, status, startDate) {
  if (status === 'PENDING') return <span className="badge pending">Pending</span>;
  if (expiration && new Date(expiration) < new Date()) {
    return <span className="badge expired">Expired</span>;
  }
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    if (start > new Date()) return <span className="badge not-yet-active">Not Yet Active</span>;
  }
  if (verdict === 'APPROVED') return <span className="badge approved">Approved</span>;
  if (verdict === 'ADMIN_APPROVED') return <span className="badge admin-approved">Admin Approved</span>;
  if (verdict === 'APPROVED_WITH_ESCORT') return <span className="badge approved-with-escort">Approved with Escort</span>;
  return <span className="badge not-approved">Not Approved</span>;
}

const COLUMNS = [
  { key: 'id',                  label: 'ID' },
  { key: 'identifier_type',     label: 'Type' },
  { key: 'identifier_value',    label: 'Identifier' },
  { key: 'population',          label: 'Population' },
  { key: 'escort_full_name',    label: 'Escort Name' },
  { key: 'escort_phone',        label: 'Escort Phone' },
  { key: 'reason',              label: 'Reason' },
  { key: 'requester_name',      label: 'Requester' },
  { key: 'verdict',             label: 'Status' },
  { key: 'approval_expiration', label: 'Expires' },
  { key: 'last_seen_at',        label: 'Last Seen' },
  { key: 'created_at',          label: 'Created' },
];

function sortRows(rows, key, dir) {
  if (!key) return rows; // no client sort → preserve server order
  const pending = rows.filter(r => r.status === 'PENDING');
  const rest = rows.filter(r => r.status !== 'PENDING');
  const sorted = [...rest].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (key === 'id') return dir === 'asc' ? av - bv : bv - av;
    if (['approval_expiration', 'last_seen_at', 'created_at'].includes(key)) {
      const d = new Date(av) - new Date(bv);
      return dir === 'asc' ? d : -d;
    }
    const cmp = String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });
  return [...pending, ...sorted];
}

function SortIcon({ active, dir }) {
  if (!active) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 11 }}>↕</span>;
  return <span style={{ marginLeft: 4, fontSize: 11 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function PersonTable({ rows, onEdit, onDelete, onApprove, onReject }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [visits, setVisits] = useState([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitsError, setVisitsError] = useState(null);

  async function handleRowClick(person) {
    setSelectedPerson(person);
    setVisits([]);
    setVisitsError(null);
    setVisitsLoading(true);
    try {
      const data = await api.getPersonVisits(person.id);
      setVisits(data);
    } catch (err) {
      setVisitsError(err.message || 'Failed to load visit history');
    } finally {
      setVisitsLoading(false);
    }
  }

  function handleCloseModal() {
    setSelectedPerson(null);
    setVisits([]);
    setVisitsError(null);
  }

  if (!rows || rows.length === 0) {
    return <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>No records found.</p>;
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = sortRows(rows, sortKey, sortDir);

  return (
    <>
    {selectedPerson && (
      <VisitHistoryModal
        person={selectedPerson}
        visits={visits}
        loading={visitsLoading}
        error={visitsError}
        onClose={handleCloseModal}
      />
    )}
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {COLUMNS.map(({ key, label }) => (
              <th
                key={key}
                onClick={() => handleSort(key)}
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  color: sortKey === key ? 'var(--primary)' : undefined,
                }}
              >
                {label}
                <SortIcon active={sortKey === key} dir={sortDir} />
              </th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr
              key={p.id}
              onClick={() => handleRowClick(p)}
              style={{
                cursor: 'pointer',
                ...(p.status === 'PENDING' ? { background: 'rgba(234,179,8,.07)' } : {}),
              }}
            >
              <td style={{ color: 'var(--text-muted)' }}>{p.id}</td>
              <td><code>{p.identifier_type}</code></td>
              <td><strong>{p.identifier_value}</strong></td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.population || '—'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.escort_full_name || '—'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.escort_phone || '—'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 200 }}>{p.reason || '—'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {(p.requestor_user_name || p.requester_name)
                  ? <span title={p.requester_email || undefined}>{p.requestor_user_name || p.requester_name}</span>
                  : '—'}
              </td>
              <td>
                {verdictBadge(p.verdict, p.approval_expiration, p.status, p.approval_start_date)}
                {p.rejection_reason && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, maxWidth: 180 }}>
                    {p.rejection_reason}
                  </div>
                )}
              </td>
              <td>
                {p.approval_start_date && p.approval_expiration
                  ? `${new Date(p.approval_start_date).toLocaleDateString()} – ${new Date(p.approval_expiration).toLocaleDateString()}`
                  : p.approval_expiration
                    ? new Date(p.approval_expiration).toLocaleDateString()
                    : '—'}
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {p.last_seen_at
                  ? new Date(p.last_seen_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                  : '—'}
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {new Date(p.created_at).toLocaleDateString()}
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.status === 'PENDING' && (
                    <button className="primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onApprove(p); }}>Approve</button>
                  )}
                  <button
                    className="danger"
                    style={{ padding: '4px 10px', fontSize: 12, opacity: p.status === 'NOT_APPROVED' ? 0.35 : 1, cursor: p.status === 'NOT_APPROVED' ? 'not-allowed' : 'pointer' }}
                    disabled={p.status === 'NOT_APPROVED'}
                    title={p.status === 'NOT_APPROVED' ? 'Already rejected' : undefined}
                    onClick={(e) => { e.stopPropagation(); onReject(p); }}
                  >Reject</button>
                  <button className="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onEdit(p); }}>Edit</button>
                  <button className="danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onDelete(p); }}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
