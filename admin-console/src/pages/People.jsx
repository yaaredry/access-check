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
  { key: 'BLOCKED',              label: '🚫 Blocked' },
];

function getDisplayStatus(person) {
  if (person.status === 'BLOCKED') return 'BLOCKED';
  if (person.status === 'PENDING') return 'PENDING';
  if (person.status === 'NOT_APPROVED' || person.verdict === 'NOT_APPROVED') return 'NOT_APPROVED';
  const wasApproved = ['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT'].includes(person.verdict);
  if (wasApproved && person.approval_expiration) {
    const endOfExpiryDay = new Date(person.approval_expiration.slice(0, 10) + 'T23:59:59.999');
    if (endOfExpiryDay < new Date()) return 'EXPIRED';
  }
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
const MODAL_BLOCK = 'block';
const MODAL_UNBLOCK = 'unblock';

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
  const [blockTarget, setBlockTarget] = useState(null);
  const [unblockTarget, setUnblockTarget] = useState(null);
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

  async function handleCreateAndAddAnother(formData) {
    setFormLoading(true);
    try {
      await api.createPerson(formData);
      setOffset(0);
      load();
      // modal stays open; PersonForm resets identifierValue/dates itself
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
      setOffset(0);
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
    setOffset(0);
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
    setOffset(0);
    load();
  }

  function handleBlock(person) {
    setBlockTarget(person);
    setModal(MODAL_BLOCK);
  }

  async function handleBlockConfirm(blockReason) {
    await api.blockPerson(blockTarget.id, blockReason);
    setModal(MODAL_NONE);
    setBlockTarget(null);
    setOffset(0);
    load();
  }

  function handleUnblock(person) {
    setUnblockTarget(person);
    setModal(MODAL_UNBLOCK);
  }

  async function handleUnblockConfirm(status, verdict, rejectionReason) {
    await api.unblockPerson(unblockTarget.id, status, verdict, rejectionReason);
    setModal(MODAL_NONE);
    setUnblockTarget(null);
    setOffset(0);
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
          <DisabledButtonWithTooltip label="Load from Google Sheet" />
          <DisabledButtonWithTooltip label="Bulk Upload CSV" />
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
          <PersonTable rows={filteredRows} onEdit={openEdit} onDelete={handleDelete} onApprove={handleApprove} onReject={handleReject} onBlock={handleBlock} onUnblock={handleUnblock} />
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
              onSaveAndAddAnother={modal === MODAL_CREATE ? handleCreateAndAddAnother : undefined}
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

      {modal === MODAL_BLOCK && blockTarget && (
        <BlockModal
          person={blockTarget}
          onConfirm={handleBlockConfirm}
          onCancel={() => { setModal(MODAL_NONE); setBlockTarget(null); }}
        />
      )}

      {modal === MODAL_UNBLOCK && unblockTarget && (
        <UnblockModal
          person={unblockTarget}
          onConfirm={handleUnblockConfirm}
          onCancel={() => { setModal(MODAL_NONE); setUnblockTarget(null); }}
        />
      )}
    </div>
  );
}

function ApproveModal({ person, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function approve(verdict) {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(verdict);
    } catch (err) {
      setError(err.message || 'Failed to approve. Please try again.');
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
        {error && (
          <div style={{ color: 'var(--not-approved)', fontWeight: 600, marginBottom: 16 }}>{error}</div>
        )}
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

function BlockModal({ person, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err.message || 'Failed to block. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div className="card" style={{ width: 440, maxWidth: '95vw' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 8, color: '#991b1b' }}>🚫 Block Person</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
          Blocking ID <strong>{person.identifier_value}</strong>. This will deny all gate access immediately and
          prevent any new requests. A reason is required.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for blocking (visible to admins only)…"
            rows={3}
            required
            style={{ resize: 'vertical', fontSize: 14, padding: '10px 12px', width: '100%', boxSizing: 'border-box' }}
          />
          {error && <div style={{ color: '#991b1b', fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="danger" disabled={loading || !reason.trim()}
              style={{ background: '#7f1d1d', borderColor: '#7f1d1d' }}>
              {loading ? 'Blocking…' : '🚫 Block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UnblockModal({ person, onConfirm, onCancel }) {
  const [status, setStatus] = useState('PENDING');
  const [verdict, setVerdict] = useState('ADMIN_APPROVED');
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'NOT_APPROVED' && !rejectionReason.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(status, status === 'APPROVED' ? verdict : undefined, status === 'NOT_APPROVED' ? rejectionReason.trim() : undefined);
    } catch (err) {
      setError(err.message || 'Failed to unblock. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div className="card" style={{ width: 460, maxWidth: '95vw' }}>
        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Unblock Person</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14, lineHeight: 1.5 }}>
          Unblocking ID <strong>{person.identifier_value}</strong>. Choose the new status to assign.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { value: 'PENDING', label: 'Set to Pending', desc: 'Return to the review queue' },
              { value: 'APPROVED', label: 'Approve', desc: 'Grant access immediately' },
              { value: 'NOT_APPROVED', label: 'Reject', desc: 'Deny access' },
            ].map(opt => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', border: `1px solid ${status === opt.value ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 8 }}>
                <input type="radio" name="status" value={opt.value} checked={status === opt.value} onChange={() => setStatus(opt.value)} style={{ marginTop: 3 }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {status === 'APPROVED' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Approval type</label>
              <select value={verdict} onChange={e => setVerdict(e.target.value)} style={{ padding: '8px 10px', fontSize: 14 }}>
                <option value="APPROVED">Standard Approval</option>
                <option value="ADMIN_APPROVED">Administrative Approval</option>
                <option value="APPROVED_WITH_ESCORT">Approved with Escort</option>
              </select>
            </div>
          )}

          {status === 'NOT_APPROVED' && (
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection…"
              rows={3}
              required
              style={{ resize: 'vertical', fontSize: 14, padding: '10px 12px', width: '100%', boxSizing: 'border-box' }}
            />
          )}

          {error && <div style={{ color: 'var(--not-approved)', fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary"
              disabled={loading || (status === 'NOT_APPROVED' && !rejectionReason.trim())}>
              {loading ? 'Saving…' : 'Unblock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DisabledButtonWithTooltip({ label }) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button className="secondary" disabled style={{ opacity: 0.4, pointerEvents: 'none' }}>
        {label}
      </button>
      {visible && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff',
          fontSize: 12, padding: '7px 12px', borderRadius: 8,
          whiteSpace: 'nowrap', zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,.25)',
          pointerEvents: 'none',
        }}>
          This feature is currently unavailable.<br />For assistance, please contact Yaron Edry.
        </div>
      )}
    </span>
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
