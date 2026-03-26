export default function UserTable({ users, onEdit, onDelete, onRegenerate }) {
  if (!users || users.length === 0) {
    return <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>No requestor users found.</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Created</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={{ fontWeight: 600 }}>{u.name || '—'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.username}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {new Date(u.updated_at).toLocaleDateString()}
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
