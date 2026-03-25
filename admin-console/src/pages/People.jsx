import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import PersonTable from '../components/PersonTable';
import PersonForm from '../components/PersonForm';
import BulkUpload from '../components/BulkUpload';
import GSheetImport from '../components/GSheetImport';

const MODAL_NONE = null;

const STATUS_FILTERS = [
  { key: 'PENDING',              label: 'Pending' },
  { key: 'APPROVED',             label: 'Approved' },
  { key: 'ADMIN_APPROVED',       label: 'Admin Approved' },
  { key: 'APPROVED_WITH_ESCORT', label: 'Approved w/ Escort' },
  { key: 'EXPIRED',              label: 'Expired' },
  { key: 'NOT_APPROVED',         label: 'Not Approved' },
];

function getDisplayStatus(person) {
  if (person.status === 'PENDING') return 'PENDING';
  if (person.approval_expiration && new Date(person.approval_expiration) < new Date()) return 'EXPIRED';
  if (person.verdict === 'APPROVED') return 'APPROVED';
  if (person.verdict === 'ADMIN_APPROVED') return 'ADMIN_APPROVED';
  if (person.verdict === 'APPROVED_WITH_ESCORT') return 'APPROVED_WITH_ESCORT';
  return 'NOT_APPROVED';
}
const MODAL_CREATE = 'create';
const MODAL_EDIT = 'edit';
const MODAL_BULK = 'bulk';
const MODAL_GSHEET = 'gsheet';
const MODAL_CONFIRM = 'confirm';
const MODAL_APPROVE = 'approve';
const MODAL_REJECT = 'reject';

export default function People() {
  const [data, setData] = useState({ rows: [], total: 0 });
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(MODAL_NONE);
  const [editTarget, setEditTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm, variant }
  const [rejectTarget, setRejectTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
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
      setEditTarget(null);
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
    setApproveTarget(person);
    setModal(MODAL_APPROVE);
  }

  async function handleApproveConfirm(verdict) {
    await api.updatePersonStatus(approveTarget.id, 'APPROVED', undefined, verdict);
    setModal(MODAL_NONE);
    setApproveTarget(null);
    load();
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
      escortFullName: person.escort_full_name || '',
      escortPhone: person.escort_phone || '',
      requesterName: person.requester_name || '',
    });
    setModal(MODAL_EDIT);
  }

  const filteredRows = statusFilter
    ? data.rows.filter(p => getDisplayStatus(p) === statusFilter)
    : data.rows;

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                className={statusFilter === key ? 'primary' : 'secondary'}
                onClick={() => setStatusFilter(prev => prev === key ? null : key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '24px 0' }}>Loading…</p>
        ) : data.rows.length === 0 && search ? (
          <div style={{ padding: '32px 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              No records found for <strong>{search}</strong>.
            </p>
            <button
              className="primary"
              onClick={() => {
                setEditTarget({ identifierType: 'IL_ID', identifierValue: search });
                setModal(MODAL_CREATE);
              }}
            >
              + Add "{search}" as new person
            </button>
          </div>
        ) : (
          <PersonTable rows={filteredRows} onEdit={openEdit} onDelete={handleDelete} onApprove={handleApprove} onReject={handleReject} />
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
              initial={editTarget}
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

      {modal === MODAL_APPROVE && approveTarget && (
        <ApproveModal
          person={approveTarget}
          onConfirm={handleApproveConfirm}
          onCancel={() => { setModal(MODAL_NONE); setApproveTarget(null); }}
        />
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

function ApproveModal({ person, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);

  async function approve(verdict) {
    setLoading(true);
    try {
      await onConfirm(verdict);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div className="card" style={{ width: 420, maxWidth: '95vw' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Approve Access</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
          Select approval type for ID <strong>{person.identifier_value}</strong>.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <button
            className="primary"
            disabled={loading}
            onClick={() => approve('APPROVED')}
            style={{ textAlign: 'left', padding: '12px 16px' }}
          >
            <div style={{ fontWeight: 600 }}>Approve</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Standard approval</div>
          </button>
          <button
            className="primary"
            disabled={loading}
            onClick={() => approve('ADMIN_APPROVED')}
            style={{ textAlign: 'left', padding: '12px 16px' }}
          >
            <div style={{ fontWeight: 600 }}>Administrative Approval</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>The person can be only in the administrative areas</div>
          </button>
          <button
            className="primary"
            disabled={loading}
            onClick={() => approve('APPROVED_WITH_ESCORT')}
            style={{ textAlign: 'left', padding: '12px 16px' }}
          >
            <div style={{ fontWeight: 600 }}>Approved with Escort</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>The person must be accompanied by their registered escort at all times</div>
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        </div>
      </div>
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
