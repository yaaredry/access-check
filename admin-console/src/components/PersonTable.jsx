import { useState } from 'react';

function verdictBadge(verdict, expiration, status) {
  if (status === 'PENDING') return <span className="badge pending">Pending</span>;
  if (expiration && new Date(expiration) < new Date()) {
    return <span className="badge expired">Expired</span>;
  }
  if (verdict === 'APPROVED') return <span className="badge approved">Approved</span>;
  if (verdict === 'ADMIN_APPROVED') return <span className="badge admin-approved">Admin Approved</span>;
  return <span className="badge not-approved">Not Approved</span>;
}

const COLUMNS = [
  { key: 'id',                  label: 'ID' },
  { key: 'identifier_type',     label: 'Type' },
  { key: 'identifier_value',    label: 'Identifier' },
  { key: 'population',          label: 'Population' },
  { key: 'verdict',             label: 'Status' },
  { key: 'approval_expiration', label: 'Expires' },
  { key: 'last_seen_at',        label: 'Last Seen' },
  { key: 'created_at',          label: 'Created' },
];

function sortRows(rows, key, dir) {
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
  const [sortKey, setSortKey] = useState('id');
  const [sortDir, setSortDir] = useState('asc');

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
            <tr key={p.id} style={p.status === 'PENDING' ? { background: 'rgba(234,179,8,.07)' } : undefined}>
              <td style={{ color: 'var(--text-muted)' }}>{p.id}</td>
              <td><code>{p.identifier_type}</code></td>
              <td><strong>{p.identifier_value}</strong></td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.population || '—'}</td>
              <td>
                {verdictBadge(p.verdict, p.approval_expiration, p.status)}
                {p.rejection_reason && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, maxWidth: 180 }}>
                    {p.rejection_reason}
                  </div>
                )}
              </td>
              <td>{p.approval_expiration ? new Date(p.approval_expiration).toLocaleDateString() : '—'}</td>
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
                    <>
                      <button className="primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onApprove(p)}>Approve</button>
                      <button className="danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onReject(p)}>Reject</button>
                    </>
                  )}
                  <button className="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onEdit(p)}>Edit</button>
                  <button className="danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onDelete(p)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
