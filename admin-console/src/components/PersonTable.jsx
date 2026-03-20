import { useState } from 'react';

function verdictBadge(verdict, expiration) {
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
  { key: 'verdict',             label: 'Verdict' },
  { key: 'approval_expiration', label: 'Expires' },
  { key: 'last_seen_at',        label: 'Last Seen' },
  { key: 'created_at',          label: 'Created' },
];

function sortRows(rows, key, dir) {
  return [...rows].sort((a, b) => {
    let av = a[key], bv = b[key];
    // Nulls always last
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    // Numeric
    if (key === 'id') return dir === 'asc' ? av - bv : bv - av;
    // Dates
    if (['approval_expiration', 'last_seen_at', 'created_at'].includes(key)) {
      const d = new Date(av) - new Date(bv);
      return dir === 'asc' ? d : -d;
    }
    // Strings
    const cmp = String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });
}

function SortIcon({ active, dir }) {
  if (!active) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 11 }}>↕</span>;
  return <span style={{ marginLeft: 4, fontSize: 11 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function PersonTable({ rows, onEdit, onDelete }) {
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
            <tr key={p.id}>
              <td style={{ color: 'var(--text-muted)' }}>{p.id}</td>
              <td><code>{p.identifier_type}</code></td>
              <td><strong>{p.identifier_value}</strong></td>
              <td>{verdictBadge(p.verdict, p.approval_expiration)}</td>
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
                <div style={{ display: 'flex', gap: 6 }}>
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
