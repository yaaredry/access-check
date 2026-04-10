import { useState } from 'react';

const COLUMNS = [
  { key: 'name',          label: 'Name' },
  { key: 'username',      label: 'Email' },
  { key: 'request_count', label: '# Submissions' },
  { key: 'created_at',    label: 'Created' },
  { key: 'updated_at',    label: 'Updated' },
];

function sortRows(rows, key, dir) {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (key === 'request_count') return dir === 'asc' ? av - bv : bv - av;
    if (['created_at', 'updated_at'].includes(key)) {
      const d = new Date(av) - new Date(bv);
      return dir === 'asc' ? d : -d;
    }
    const cmp = String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });
}

function SortIcon({ active, dir }) {
  if (!active) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: 11 }}>↕</span>;
  return <span style={{ marginLeft: 4, fontSize: 11 }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function UserTable({ users, onEdit, onDelete, onRegenerate }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  if (!users || users.length === 0) {
    return <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>No requestor users found.</p>;
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = sortRows(users, sortKey, sortDir);

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
          {sorted.map((u) => (
            <tr key={u.id}>
              <td style={{ fontWeight: 600 }}>{u.name || '—'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.username}</td>
              <td style={{ fontSize: 13, fontWeight: u.request_count > 0 ? 600 : 400, color: u.request_count > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                {u.request_count}
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {new Date(u.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {new Date(u.updated_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onEdit(u)}>Edit</button>
                  <button className="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onRegenerate(u)}>Reset Password</button>
                  <button className="danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onDelete(u)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
