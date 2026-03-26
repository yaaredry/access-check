import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import UserTable from '../components/UserTable';
import UserForm from '../components/UserForm';

const MODAL_NONE = null;
const MODAL_CREATE = 'create';
const MODAL_EDIT = 'edit';
const MODAL_CONFIRM = 'confirm';
const MODAL_PASSWORD = 'password';

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,.4)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  zIndex: 1000,
  padding: '40px 16px',
  overflowY: 'auto',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(MODAL_NONE);
  const [editTarget, setEditTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [revealedPassword, setRevealedPassword] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listUsers();
      setUsers(res.users);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(formData) {
    setFormLoading(true);
    try {
      const res = await api.createUser(formData);
      setModal(MODAL_PASSWORD);
      setRevealedPassword({ plainPassword: res.plainPassword, username: res.username });
      load();
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate(formData) {
    setFormLoading(true);
    try {
      await api.updateUser(editTarget.id, formData);
      setModal(MODAL_NONE);
      setEditTarget(null);
      load();
    } finally {
      setFormLoading(false);
    }
  }

  function handleDelete(user) {
    setConfirm({
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.name} (${user.username})? This cannot be undone.`,
      onConfirm: async () => {
        await api.deleteUser(user.id);
        setModal(MODAL_NONE);
        setConfirm(null);
        load();
      },
    });
    setModal(MODAL_CONFIRM);
  }

  async function handleRegenerate(user) {
    setConfirm({
      title: 'Reset Password',
      message: `Generate a new password for ${user.name} (${user.username})? The current password will stop working immediately.`,
      onConfirm: async () => {
        const res = await api.regeneratePassword(user.id);
        setConfirm(null);
        setRevealedPassword({ plainPassword: res.plainPassword, username: user.username });
        setModal(MODAL_PASSWORD);
      },
    });
    setModal(MODAL_CONFIRM);
  }

  function openEdit(user) {
    setEditTarget(user);
    setModal(MODAL_EDIT);
  }

  function closeConfirm() {
    setModal(MODAL_NONE);
    setConfirm(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Requestor Users</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{users.length} user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="primary" onClick={() => { setEditTarget(null); setModal(MODAL_CREATE); }}>+ Add User</button>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>Loading…</p>
        ) : (
          <UserTable users={users} onEdit={openEdit} onDelete={handleDelete} onRegenerate={handleRegenerate} />
        )}
      </div>

      {(modal === MODAL_CREATE || modal === MODAL_EDIT) && (
        <div style={overlayStyle}>
          <div className="card" style={{ width: 440, maxWidth: '95vw' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>
              {modal === MODAL_CREATE ? 'Add Requestor User' : 'Edit User'}
            </h3>
            <UserForm
              initial={editTarget}
              onSubmit={modal === MODAL_CREATE ? handleCreate : handleUpdate}
              onCancel={() => { setModal(MODAL_NONE); setEditTarget(null); }}
              loading={formLoading}
            />
          </div>
        </div>
      )}

      {modal === MODAL_CONFIRM && confirm && (
        <div style={overlayStyle}>
          <div className="card" style={{ width: 420, maxWidth: '95vw' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 12 }}>{confirm.title}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>{confirm.message}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="secondary" onClick={closeConfirm}>Cancel</button>
              <button
                className="primary"
                onClick={() => confirm.onConfirm()}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === MODAL_PASSWORD && revealedPassword && (
        <div style={overlayStyle}>
          <div className="card" style={{ width: 440, maxWidth: '95vw' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Password Ready</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
              The password for <strong>{revealedPassword.username}</strong> is shown below.
              Copy it now — it will not be shown again.
            </p>
            <div style={{
              background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.4)',
              borderRadius: 8, padding: '14px 18px', marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <code style={{ fontSize: 22, letterSpacing: 4, fontWeight: 700 }}>
                {revealedPassword.plainPassword}
              </code>
              <button
                className="secondary"
                style={{ padding: '4px 12px', fontSize: 12, flexShrink: 0 }}
                onClick={() => navigator.clipboard.writeText(revealedPassword.plainPassword)}
              >
                Copy
              </button>
            </div>
            <p style={{ color: '#d97706', fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
              ⚠ Save this password and share it with the user. You will not be able to retrieve it later.
            </p>
            <div style={{ textAlign: 'right' }}>
              <button className="primary" onClick={() => { setModal(MODAL_NONE); setRevealedPassword(null); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
