import React from 'react';

function verdictBadge(verdict, expiration) {
  if (expiration && new Date(expiration) < new Date()) {
    return <span className="badge expired">Expired</span>;
  }
  if (verdict === 'APPROVED') return <span className="badge approved">Approved</span>;
  if (verdict === 'ADMIN_APPROVED') return <span className="badge approved">Admin Approved</span>;
  return <span className="badge not-approved">Not Approved</span>;
}

export default function PersonTable({ rows, onEdit, onDelete }) {
  if (!rows || rows.length === 0) {
    return <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>No records found.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Identifier</th>
            <th>Verdict</th>
            <th>Expires</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td style={{ color: 'var(--text-muted)' }}>{p.id}</td>
              <td><code>{p.identifier_type}</code></td>
              <td><strong>{p.identifier_value}</strong></td>
              <td>{verdictBadge(p.verdict, p.approval_expiration)}</td>
              <td>{p.approval_expiration ? new Date(p.approval_expiration).toLocaleDateString() : '—'}</td>
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
