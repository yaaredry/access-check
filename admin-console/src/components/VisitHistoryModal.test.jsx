import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VisitHistoryModal from './VisitHistoryModal';

const PERSON = { id: 1, identifier_type: 'IL_ID', identifier_value: '000000018' };

const VISITS = [
  { id: 10, verdict: 'APPROVED', source: 'manual', created_at: '2024-06-15T09:30:00Z' },
  { id: 11, verdict: 'NOT_APPROVED', source: 'image', created_at: '2024-05-01T14:00:00Z' },
];

const AUDIT_LOG = [
  {
    id: 1,
    event_type: 'created',
    changed_by_username: 'admin',
    changes: { snapshot: { verdict: 'APPROVED' } },
    created_at: '2024-06-15T09:00:00Z',
  },
  {
    id: 2,
    event_type: 'updated',
    changed_by_username: 'admin',
    changes: { verdict: { old: 'APPROVED', new: 'NOT_APPROVED' } },
    created_at: '2024-06-16T10:00:00Z',
  },
];

function defaultProps(overrides = {}) {
  return {
    person: PERSON,
    visits: [],
    loading: false,
    error: null,
    onClose: vi.fn(),
    auditLog: [],
    auditLoading: false,
    auditError: null,
    onAuditTabSelect: vi.fn(),
    ...overrides,
  };
}

// ── Existing visit-history behaviour (Visit History tab is default) ─────────────

describe('VisitHistoryModal – Visit History tab (default)', () => {
  it('renders both tab buttons', () => {
    render(<VisitHistoryModal {...defaultProps()} />);
    expect(screen.getByRole('tab', { name: 'Visit History' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Modification History' })).toBeInTheDocument();
  });

  it('Visit History tab is selected by default', () => {
    render(<VisitHistoryModal {...defaultProps()} />);
    expect(screen.getByRole('tab', { name: 'Visit History' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Modification History' })).toHaveAttribute('aria-selected', 'false');
  });

  it('renders person identifier in the header', () => {
    render(<VisitHistoryModal {...defaultProps()} />);
    expect(screen.getByText('000000018')).toBeInTheDocument();
    expect(screen.getByText(/IL_ID/)).toBeInTheDocument();
  });

  it('shows loading state on visits tab', () => {
    render(<VisitHistoryModal {...defaultProps({ loading: true })} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('does not show visit table while loading', () => {
    render(<VisitHistoryModal {...defaultProps({ visits: VISITS, loading: true })} />);
    expect(screen.queryByText('Date & Time')).not.toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    render(<VisitHistoryModal {...defaultProps({ error: 'Network error' })} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('does not show loading when error is shown', () => {
    render(<VisitHistoryModal {...defaultProps({ error: 'Something went wrong' })} />);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows empty state when visits array is empty', () => {
    render(<VisitHistoryModal {...defaultProps()} />);
    expect(screen.getByText('No visits recorded.')).toBeInTheDocument();
  });

  it('renders visit rows with verdict and source', () => {
    render(<VisitHistoryModal {...defaultProps({ visits: VISITS })} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Not Approved')).toBeInTheDocument();
    expect(screen.getByText('manual')).toBeInTheDocument();
    expect(screen.getByText('image')).toBeInTheDocument();
  });

  it('renders table headers when visits are present', () => {
    render(<VisitHistoryModal {...defaultProps({ visits: VISITS })} />);
    expect(screen.getByText('Date & Time')).toBeInTheDocument();
    expect(screen.getByText('Verdict')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  it('renders multiple visits in order', () => {
    render(<VisitHistoryModal {...defaultProps({ visits: VISITS })} />);
    const rows = screen.getAllByRole('row');
    // header row + 2 data rows
    expect(rows).toHaveLength(3);
  });

  it('shows ADMIN_APPROVED verdict label', () => {
    const visits = [{ id: 1, verdict: 'ADMIN_APPROVED', source: 'manual', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal {...defaultProps({ visits })} />);
    expect(screen.getByText('Admin Approved')).toBeInTheDocument();
  });

  it('shows APPROVED_WITH_ESCORT verdict label', () => {
    const visits = [{ id: 1, verdict: 'APPROVED_WITH_ESCORT', source: 'manual', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal {...defaultProps({ visits })} />);
    expect(screen.getByText('Approved with Escort')).toBeInTheDocument();
  });

  it('shows EXPIRED verdict label', () => {
    const visits = [{ id: 1, verdict: 'EXPIRED', source: 'image', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal {...defaultProps({ visits })} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows NOT_FOUND verdict label', () => {
    const visits = [{ id: 1, verdict: 'NOT_FOUND', source: 'manual', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal {...defaultProps({ visits })} />);
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });

  it('shows — for null verdict', () => {
    const visits = [{ id: 1, verdict: null, source: 'manual', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal {...defaultProps({ visits })} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows — for null source', () => {
    const visits = [{ id: 1, verdict: 'APPROVED', source: null, created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal {...defaultProps({ visits })} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Tab navigation ─────────────────────────────────────────────────────────────

describe('VisitHistoryModal – tab navigation', () => {
  it('clicking Modification History tab switches active tab', () => {
    render(<VisitHistoryModal {...defaultProps()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    expect(screen.getByRole('tab', { name: 'Modification History' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Visit History' })).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking Visit History tab shows visit content and hides audit content', () => {
    render(<VisitHistoryModal {...defaultProps({ visits: VISITS, auditLog: AUDIT_LOG })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Visit History' }));
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByText('Created')).not.toBeInTheDocument();
  });

  it('clicking Modification History hides visit content', () => {
    render(<VisitHistoryModal {...defaultProps({ visits: VISITS })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    expect(screen.queryByText('Verdict')).not.toBeInTheDocument();
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
  });

  it('calls onAuditTabSelect when Modification History tab is clicked', () => {
    const onAuditTabSelect = vi.fn();
    render(<VisitHistoryModal {...defaultProps({ onAuditTabSelect })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    expect(onAuditTabSelect).toHaveBeenCalledTimes(1);
  });

  it('does not call onAuditTabSelect when Visit History tab is clicked', () => {
    const onAuditTabSelect = vi.fn();
    render(<VisitHistoryModal {...defaultProps({ onAuditTabSelect })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Visit History' }));
    expect(onAuditTabSelect).not.toHaveBeenCalled();
  });

  it('does not crash when onAuditTabSelect is not provided', () => {
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error={null} onClose={vi.fn()} />);
    expect(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    }).not.toThrow();
  });
});

// ── Modification History tab – states ─────────────────────────────────────────

describe('VisitHistoryModal – Modification History tab', () => {
  function renderOnAuditTab(overrides = {}) {
    const utils = render(<VisitHistoryModal {...defaultProps(overrides)} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    return utils;
  }

  it('shows loading spinner while auditLoading is true', () => {
    renderOnAuditTab({ auditLoading: true });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('does not show audit table while auditLoading', () => {
    renderOnAuditTab({ auditLog: AUDIT_LOG, auditLoading: true });
    expect(screen.queryByText('Event')).not.toBeInTheDocument();
  });

  it('shows error message when auditError is set', () => {
    renderOnAuditTab({ auditError: 'Failed to load' });
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  it('does not show loading when auditError is shown', () => {
    renderOnAuditTab({ auditError: 'Something went wrong', auditLoading: false });
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows empty state when auditLog is empty', () => {
    renderOnAuditTab({ auditLog: [] });
    expect(screen.getByText('No modification history.')).toBeInTheDocument();
  });

  it('renders audit table headers when entries are present', () => {
    renderOnAuditTab({ auditLog: AUDIT_LOG });
    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('Changed By')).toBeInTheDocument();
    expect(screen.getByText('Changes')).toBeInTheDocument();
  });

  it('renders created event type label', () => {
    renderOnAuditTab({ auditLog: AUDIT_LOG });
    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('renders updated event type label', () => {
    renderOnAuditTab({ auditLog: AUDIT_LOG });
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });

  it('renders deleted event type label', () => {
    const log = [{ id: 1, event_type: 'deleted', changed_by_username: 'admin', changes: { snapshot: {} }, created_at: '2024-06-15T09:00:00Z' }];
    renderOnAuditTab({ auditLog: log });
    expect(screen.getByText('Deleted')).toBeInTheDocument();
  });

  it('renders bulk_import event type label', () => {
    const log = [{ id: 1, event_type: 'bulk_import', changed_by_username: 'admin', changes: {}, created_at: '2024-06-15T09:00:00Z' }];
    renderOnAuditTab({ auditLog: log });
    expect(screen.getByText('Bulk Import')).toBeInTheDocument();
  });

  it('renders changedByUsername for each entry', () => {
    renderOnAuditTab({ auditLog: AUDIT_LOG });
    const adminCells = screen.getAllByText('admin');
    expect(adminCells.length).toBeGreaterThanOrEqual(2);
  });

  it('renders — when changedByUsername is null', () => {
    const log = [{ id: 1, event_type: 'created', changed_by_username: null, changes: { snapshot: {} }, created_at: '2024-06-15T09:00:00Z' }];
    renderOnAuditTab({ auditLog: log });
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('renders correct row count (header + data rows)', () => {
    renderOnAuditTab({ auditLog: AUDIT_LOG });
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(AUDIT_LOG.length + 1); // +1 for header
  });

  it('renders multiple entries in the provided order (newest first)', () => {
    renderOnAuditTab({ auditLog: AUDIT_LOG });
    const rows = screen.getAllByRole('row');
    // First data row should be 'created', second 'updated' based on AUDIT_LOG order
    expect(rows[1]).toHaveTextContent('Created');
    expect(rows[2]).toHaveTextContent('Updated');
  });
});

// ── ChangesDisplay rendering ────────────────────────────────────────────────────

describe('VisitHistoryModal – changes display', () => {
  function renderOnAuditTab(overrides = {}) {
    render(<VisitHistoryModal {...defaultProps(overrides)} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
  }

  it('shows "Full record snapshot" for snapshot changes', () => {
    const log = [{ id: 1, event_type: 'created', changed_by_username: 'admin', changes: { snapshot: { verdict: 'APPROVED' } }, created_at: '2024-06-15T09:00:00Z' }];
    renderOnAuditTab({ auditLog: log });
    expect(screen.getByText('Full record snapshot')).toBeInTheDocument();
  });

  it('shows field name with old → new values for diff changes', () => {
    const log = [{ id: 1, event_type: 'updated', changed_by_username: 'admin', changes: { verdict: { old: 'APPROVED', new: 'NOT_APPROVED' } }, created_at: '2024-06-15T09:00:00Z' }];
    renderOnAuditTab({ auditLog: log });
    expect(screen.getByText('verdict:')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByText('NOT_APPROVED')).toBeInTheDocument();
  });

  it('shows multiple field diffs for multi-field updates', () => {
    const log = [{
      id: 1, event_type: 'updated', changed_by_username: 'admin',
      changes: {
        verdict: { old: 'APPROVED', new: 'NOT_APPROVED' },
        population: { old: 'Pop A', new: 'Pop B' },
      },
      created_at: '2024-06-15T09:00:00Z',
    }];
    renderOnAuditTab({ auditLog: log });
    expect(screen.getByText('verdict:')).toBeInTheDocument();
    expect(screen.getByText('population:')).toBeInTheDocument();
  });

  it('handles null old value gracefully (created event diff)', () => {
    const log = [{ id: 1, event_type: 'updated', changed_by_username: 'admin', changes: { rejection_reason: { old: null, new: 'Blocked' } }, created_at: '2024-06-15T09:00:00Z' }];
    renderOnAuditTab({ auditLog: log });
    expect(screen.getByText('rejection_reason:')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('handles null new value gracefully', () => {
    const log = [{ id: 1, event_type: 'updated', changed_by_username: 'admin', changes: { reason: { old: 'Old reason', new: null } }, created_at: '2024-06-15T09:00:00Z' }];
    renderOnAuditTab({ auditLog: log });
    expect(screen.getByText('reason:')).toBeInTheDocument();
    expect(screen.getByText('Old reason')).toBeInTheDocument();
  });

  it('shows — for empty changes object', () => {
    const log = [{ id: 1, event_type: 'updated', changed_by_username: 'admin', changes: {}, created_at: '2024-06-15T09:00:00Z' }];
    renderOnAuditTab({ auditLog: log });
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('does not crash with null changes field', () => {
    const log = [{ id: 1, event_type: 'updated', changed_by_username: 'admin', changes: null, created_at: '2024-06-15T09:00:00Z' }];
    expect(() => renderOnAuditTab({ auditLog: log })).not.toThrow();
  });
});

// ── Close / accessibility behaviour ────────────────────────────────────────────

describe('VisitHistoryModal – close and accessibility', () => {
  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal {...defaultProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when a non-Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal {...defaultProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes keydown listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<VisitHistoryModal {...defaultProps({ onClose })} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose from Modification History tab when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from Modification History tab when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has role=dialog and aria-modal attributes', () => {
    render(<VisitHistoryModal {...defaultProps()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

// ── PersonTable integration – audit tab fetch ─────────────────────────────────
// These live in PersonTable.test.jsx (see that file)
