import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import PersonTable from '../components/PersonTable';
import PersonForm from '../components/PersonForm';
import BulkUpload from '../components/BulkUpload';
import GSheetImport from '../components/GSheetImport';

const MODAL_NONE = null;
const MODAL_CREATE = 'create';
const MODAL_EDIT = 'edit';
const MODAL_BULK = 'bulk';
const MODAL_GSHEET = 'gsheet';
const MODAL_CONFIRM = 'confirm';
const MODAL_REJECT = 'reject';

export default function People() {
  const [data, setData] = useState({ rows: [], total: 0 });
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(MODAL_NONE);
  const [editTarget, setEditTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm, variant }
  const [rejectTarget, setRejectTarget] = useState(null);
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset };
      if (search) params.search = search;
      const res = await api.listPeople(params);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, offset]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  function handleSearch(e) {
    e.preventDefault();
    setOffset(0);
    load();
  }

  async function handleCreate(formData) {
    setFormLoading(true);
    try {
      await api.createPerson(formData);
      setModal(MODAL_NONE);
      setOffset(0);
      load();
    } finally {
      setFormLoading(false);
    }
  }

  async function handleUpdate(formData) {
    setFormLoading(true);
    try {
      await api.updatePerson(editTarget.id, formData);
      setModal(MODAL_NONE);
      setEditTarget(null);
      load();
    } finally {
      setFormLoading(false);
    }
  }

  function handleDelete(person) {
    setConfirm({
      title: 'Delete Record',
      message: `Are you sure you want to delete the record for ID ${person.identifier_value}? This cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        await api.deletePerson(person.id);
        load();
      },
    });
    setModal(MODAL_CONFIRM);
  }

  function handleApprove(person) {
    setConfirm({
      title: 'Approve Access',
      message: `Approve access for ID ${person.identifier_value}?`,
      variant: 'primary',
      onConfirm: async () => {
        await api.updatePersonStatus(person.id, 'APPROVED');
        load();
      },
    });
    setModal(MODAL_CONFIRM);
  }

  function handleReject(person) {
    setRejectTarget(person);
    setModal(MODAL_REJECT);
  }

  async function handleRejectConfirm(reason) {
    await api.updatePersonStatus(rejectTarget.id, 'NOT_APPROVED', reason);
    setModal(MODAL_NONE);
    setRejectTarget(null);
    load();
  }

  function closeConfirm() {
    setModal(MODAL_NONE);
    setConfirm(null);
  }

  function openEdit(person) {
    setEditTarget({
      ...person,
      identifierType: person.identifier_type,
      identifierValue: person.identifier_value,
      approvalExpiration: person.approval_expiration ? person.approval_expiration.slice(0, 10) : '',
    });
    setModal(MODAL_EDIT);
  }

  const totalPages = Math.ceil(data.total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>People</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{data.total} total records</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="secondary" onClick={() => setModal(MODAL_GSHEET)}>Load from Google Sheet</button>
          <button className="secondary" onClick={() => setModal(MODAL_BULK)}>Bulk Upload CSV</button>
          <button className="primary" onClick={() => setModal(MODAL_CREATE)}>+ Add Person</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Search by identifier value…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <button type="submit" className="primary">Search</button>
          {search && (
            <button type="button" className="secondary" onClick={() => { setSearch(''); setOffset(0); }}>Clear</button>
          )}
        </form>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>Loading…</p>
        ) : (
          <PersonTable rows={data.rows} onEdit={openEdit} onDelete={handleDelete} onApprove={handleApprove} onReject={handleReject} />
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button className="secondary" disabled={currentPage === 1} onClick={() => setOffset(offset - LIMIT)}>← Previous</button>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Page {currentPage} of {totalPages}</span>
            <button className="secondary" disabled={currentPage === totalPages} onClick={() => setOffset(offset + LIMIT)}>Next →</button>
          </div>
        )}
      </div>

      {/* Modals */}
      {(modal === MODAL_CREATE || modal === MODAL_EDIT) && (
        <div style={overlayStyle}>
          <div className="card" style={{ width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>{modal === MODAL_CREATE ? 'Add Person' : 'Edit Person'}</h3>
            <PersonForm
              initial={modal === MODAL_EDIT ? editTarget : null}
              onSubmit={modal === MODAL_CREATE ? handleCreate : handleUpdate}
              onCancel={() => { setModal(MODAL_NONE); setEditTarget(null); }}
              loading={formLoading}
            />
          </div>
        </div>
      )}

      {modal === MODAL_BULK && (
        <div style={overlayStyle}>
          <div className="card" style={{ width: 600, maxWidth: '95vw' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Bulk Upload CSV</h3>
            <BulkUpload onDone={() => { load(); }} />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="secondary" onClick={() => setModal(MODAL_NONE)}>Close</button>
            </div>
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
                className={confirm.variant === 'danger' ? 'danger' : 'primary'}
                onClick={async () => { await confirm.onConfirm(); closeConfirm(); }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === MODAL_REJECT && rejectTarget && (
        <RejectModal
          person={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => { setModal(MODAL_NONE); setRejectTarget(null); }}
        />
      )}

      {modal === MODAL_GSHEET && (
        <div style={overlayStyle}>
          <div className="card" style={{ width: 640, maxWidth: '95vw' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Load from Google Sheet</h3>
            <GSheetImport onDone={() => { load(); }} />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="secondary" onClick={() => setModal(MODAL_NONE)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RejectModal({ person, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div className="card" style={{ width: 440, maxWidth: '95vw' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Reject Access</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
          Rejecting request for ID <strong>{person.identifier_value}</strong>. Please provide a reason.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for rejection…"
            rows={3}
            required
            style={{ resize: 'vertical', fontSize: 14, padding: '10px 12px', width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="danger" disabled={loading || !reason.trim()}>
              {loading ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,.4)',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  zIndex: 1000,
  padding: '40px 16px',
  overflowY: 'auto',
};
