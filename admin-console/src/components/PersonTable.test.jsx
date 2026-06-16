import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PersonTable from './PersonTable';

vi.mock('../api/client', () => ({
  api: {
    getPersonVisits: vi.fn(),
    getPersonAuditLog: vi.fn(),
  },
}));

import { api } from '../api/client';

const BASE = {
  id: 1,
  identifier_type: 'IL_ID',
  identifier_value: '000000018',
  verdict: 'APPROVED',
  approval_expiration: null,
  last_seen_at: null,
  created_at: '2024-01-01T00:00:00Z',
};

describe('PersonTable', () => {
  beforeEach(() => {
    api.getPersonVisits.mockReset();
    api.getPersonVisits.mockResolvedValue([]);
    api.getPersonAuditLog.mockReset();
    api.getPersonAuditLog.mockResolvedValue([]);
  });

  it('shows empty state when rows is empty', () => {
    render(<PersonTable rows={[]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('No records found.')).toBeInTheDocument();
  });

  it('renders identifier value and type', () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('000000018')).toBeInTheDocument();
    expect(screen.getByText('IL_ID')).toBeInTheDocument();
  });

  it('shows Approved badge for APPROVED verdict', () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const badge = screen.getByText('Approved');
    expect(badge).toHaveClass('badge', 'approved');
  });

  it('shows Admin Approved badge with admin-approved class for ADMIN_APPROVED', () => {
    render(<PersonTable rows={[{ ...BASE, verdict: 'ADMIN_APPROVED' }]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const badge = screen.getByText('Admin Approved');
    expect(badge).toHaveClass('badge', 'admin-approved');
    expect(badge).not.toHaveClass('approved');
  });

  it('shows Approved with Escort badge for APPROVED_WITH_ESCORT', () => {
    render(<PersonTable rows={[{ ...BASE, verdict: 'APPROVED_WITH_ESCORT' }]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const badge = screen.getByText('Approved with Escort');
    expect(badge).toHaveClass('badge', 'approved-with-escort');
    expect(badge).not.toHaveClass('approved');
  });

  it('shows Not Approved badge for NOT_APPROVED', () => {
    render(<PersonTable rows={[{ ...BASE, verdict: 'NOT_APPROVED' }]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Not Approved')).toHaveClass('badge', 'not-approved');
  });

  it('shows Expired badge when approval_expiration is in the past', () => {
    render(<PersonTable rows={[{ ...BASE, approval_expiration: '2000-01-01' }]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Expired')).toHaveClass('badge', 'expired');
  });

  it('shows Not Approved (not Expired) for a rejected record whose approval_expiration has passed', () => {
    const row = { ...BASE, verdict: 'NOT_APPROVED', status: 'NOT_APPROVED', approval_expiration: '2000-01-01' };
    render(<PersonTable rows={[row]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Not Approved')).toHaveClass('badge', 'not-approved');
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });

  it('shows Approved badge when approval_expiration is in the future', () => {
    render(<PersonTable rows={[{ ...BASE, approval_expiration: '2099-12-31' }]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Approved')).toHaveClass('badge', 'approved');
  });

  it('calls onEdit when Edit is clicked', () => {
    const onEdit = vi.fn();
    render(<PersonTable rows={[BASE]} onEdit={onEdit} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(BASE);
  });

  it('calls onDelete when Delete is clicked', () => {
    const onDelete = vi.fn();
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith(BASE);
  });

  it('shows escort name and phone when present', () => {
    render(<PersonTable rows={[{ ...BASE, escort_full_name: 'Jane Doe', escort_phone: '+972501234567' }]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('+972501234567')).toBeInTheDocument();
  });

  it('shows requester_name when present', () => {
    render(<PersonTable rows={[{ ...BASE, requester_name: 'Bob Cohen' }]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Bob Cohen')).toBeInTheDocument();
  });

  it('shows requester email as tooltip on the name when requester_email is present', () => {
    render(<PersonTable rows={[{ ...BASE, requester_name: 'Bob Cohen', requester_email: 'bob@example.com' }]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    const nameSpan = screen.getByText('Bob Cohen');
    expect(nameSpan).toHaveAttribute('title', 'bob@example.com');
  });

  it('shows requester name without a title when no requester_email', () => {
    render(<PersonTable rows={[{ ...BASE, requester_name: 'Bob Cohen', requester_email: null }]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    const nameSpan = screen.getByText('Bob Cohen');
    expect(nameSpan).not.toHaveAttribute('title');
  });

  it('shows — for escort columns when not set', () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('Reject button is enabled for non-rejected rows', () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Reject')).not.toBeDisabled();
  });

  it('Reject button is disabled and has tooltip for already-rejected rows', () => {
    const rejected = { ...BASE, verdict: 'NOT_APPROVED', status: 'NOT_APPROVED' };
    render(<PersonTable rows={[rejected]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    const btn = screen.getByText('Reject');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'Already rejected');
  });

  it('shows rejection reason beneath the Not Approved badge', () => {
    const rejected = { ...BASE, verdict: 'NOT_APPROVED', status: 'NOT_APPROVED', rejection_reason: 'No valid clearance' };
    render(<PersonTable rows={[rejected]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('No valid clearance')).toBeInTheDocument();
  });

  it('shows — when last_seen_at is null', () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows formatted last_seen_at when set', () => {
    render(<PersonTable rows={[{ ...BASE, last_seen_at: '2024-06-15T09:30:00Z' }]} onEdit={vi.fn()} onDelete={vi.fn()} />);
    // The exact format depends on locale, just verify the cell isn't showing '—'
    const cells = screen.getAllByRole('cell');
    const lastSeenCell = cells.find(c => c.textContent !== '—' && c.textContent.includes('24'));
    expect(lastSeenCell).toBeDefined();
  });

  it('clicking a row opens the visit history modal', async () => {
    api.getPersonVisits.mockResolvedValue([]);
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('000000018'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText('Visit History')).toBeInTheDocument();
  });

  it('clicking a row calls getPersonVisits with the correct person id', async () => {
    api.getPersonVisits.mockResolvedValue([]);
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('000000018'));
    await waitFor(() => expect(api.getPersonVisits).toHaveBeenCalledWith(BASE.id));
  });

  it('modal shows visits returned from the API', async () => {
    api.getPersonVisits.mockResolvedValue([
      { id: 10, verdict: 'APPROVED', source: 'manual', created_at: '2024-06-15T09:30:00Z' },
    ]);
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('000000018'));
    await waitFor(() => expect(screen.getByText('Approved')).toBeInTheDocument());
  });

  it('modal shows empty state when person has no visits', async () => {
    api.getPersonVisits.mockResolvedValue([]);
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('000000018'));
    await waitFor(() => expect(screen.getByText('No visits recorded.')).toBeInTheDocument());
  });

  it('modal shows error when API call fails', async () => {
    api.getPersonVisits.mockRejectedValue(new Error('Server error'));
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('000000018'));
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });

  it('modal closes when Close button is clicked', async () => {
    api.getPersonVisits.mockResolvedValue([]);
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('000000018'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('modal closes when Escape is pressed', async () => {
    api.getPersonVisits.mockResolvedValue([]);
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('000000018'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('clicking Edit button does not open the modal', async () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.getPersonVisits).not.toHaveBeenCalled();
  });

  it('clicking Delete button does not open the modal', async () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.getPersonVisits).not.toHaveBeenCalled();
  });

  it('clicking Reject button does not open the modal', async () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('Reject'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.getPersonVisits).not.toHaveBeenCalled();
  });

  it('clicking Approve button on PENDING row does not open the modal', async () => {
    const pending = { ...BASE, status: 'PENDING', verdict: 'NOT_APPROVED' };
    render(<PersonTable rows={[pending]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} onApprove={vi.fn()} />);
    fireEvent.click(screen.getByText('Approve'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.getPersonVisits).not.toHaveBeenCalled();
  });

  it('row has pointer cursor style', () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    const rows = screen.getAllByRole('row');
    const dataRow = rows[1]; // first is header
    expect(dataRow).toHaveStyle({ cursor: 'pointer' });
  });
});

// ── Audit tab integration ──────────────────────────────────────────────────────

describe('PersonTable – Modification History tab integration', () => {
  beforeEach(() => {
    api.getPersonVisits.mockReset();
    api.getPersonVisits.mockResolvedValue([]);
    api.getPersonAuditLog.mockReset();
    api.getPersonAuditLog.mockResolvedValue([]);
  });

  it('does not call getPersonAuditLog on row click', async () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('row')[1]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(api.getPersonAuditLog).not.toHaveBeenCalled();
  });

  it('calls getPersonAuditLog when Modification History tab is clicked', async () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('row')[1]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    await waitFor(() => expect(api.getPersonAuditLog).toHaveBeenCalledWith(BASE.id));
  });

  it('does not call getPersonAuditLog again when switching back and forth', async () => {
    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('row')[1]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    await waitFor(() => expect(api.getPersonAuditLog).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('tab', { name: 'Visit History' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    // Still only one call — cached
    expect(api.getPersonAuditLog).toHaveBeenCalledTimes(1);
  });

  it('shows audit entries returned from the API', async () => {
    api.getPersonAuditLog.mockResolvedValue([
      { id: 1, event_type: 'created', changed_by_username: 'admin', changes: { snapshot: {} }, created_at: '2024-06-15T09:00:00Z' },
    ]);

    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('row')[1]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    await waitFor(() => expect(screen.getByText('Created')).toBeInTheDocument());
  });

  it('shows empty state when API returns empty audit log', async () => {
    api.getPersonAuditLog.mockResolvedValue([]);

    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('row')[1]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    await waitFor(() => expect(screen.getByText('No modification history.')).toBeInTheDocument());
  });

  it('shows error message when getPersonAuditLog rejects', async () => {
    api.getPersonAuditLog.mockRejectedValue(new Error('Server error'));

    render(<PersonTable rows={[BASE]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('row')[1]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });

  it('resets audit log when a different row is clicked', async () => {
    const SECOND = { ...BASE, id: 2, identifier_value: '000000026' };
    api.getPersonAuditLog
      .mockResolvedValueOnce([
        { id: 1, event_type: 'created', changed_by_username: 'admin', changes: { snapshot: {} }, created_at: '2024-06-15T09:00:00Z' },
      ])
      .mockResolvedValueOnce([]);

    render(<PersonTable rows={[BASE, SECOND]} onEdit={vi.fn()} onDelete={vi.fn()} onReject={vi.fn()} />);

    // Click first row and open audit tab
    const dataRows = screen.getAllByRole('row').slice(1);
    fireEvent.click(dataRows[0]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    await waitFor(() => expect(screen.getByText('Created')).toBeInTheDocument());

    // Close modal and click second row
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(dataRows[1]);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: 'Modification History' }));
    await waitFor(() => expect(screen.getByText('No modification history.')).toBeInTheDocument());
    // Second person's audit fetched separately
    expect(api.getPersonAuditLog).toHaveBeenCalledTimes(2);
  });
});

// ── BLOCKED person ─────────────────────────────────────────────────────────────

describe('PersonTable — BLOCKED person', () => {
  const BLOCKED_PERSON = {
    ...{
      id: 2,
      identifier_type: 'IL_ID',
      identifier_value: '000000018',
      verdict: 'BLOCKED',
      status: 'BLOCKED',
      block_reason: 'Caught tailgating',
      approval_expiration: null,
      last_seen_at: null,
      created_at: '2024-01-01T00:00:00Z',
    },
  };

  beforeEach(() => {
    vi.mocked(api.getPersonVisits).mockReset();
    vi.mocked(api.getPersonVisits).mockResolvedValue([]);
  });

  it('shows Blocked badge with blocked class', () => {
    render(<PersonTable rows={[BLOCKED_PERSON]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} onUnblock={vi.fn()} />);
    const badge = screen.getByText(/Blocked/i);
    expect(badge).toHaveClass('badge', 'blocked');
  });

  it('shows block_reason beneath the badge', () => {
    render(<PersonTable rows={[BLOCKED_PERSON]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} onUnblock={vi.fn()} />);
    expect(screen.getByText('Caught tailgating')).toBeInTheDocument();
  });

  it('shows Unblock button instead of Approve/Reject/Block for blocked rows', () => {
    render(<PersonTable rows={[BLOCKED_PERSON]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} onUnblock={vi.fn()} />);
    expect(screen.getByText('Unblock')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /🚫 Block/ })).not.toBeInTheDocument();
  });

  it('calls onUnblock when Unblock is clicked', () => {
    const onUnblock = vi.fn();
    render(<PersonTable rows={[BLOCKED_PERSON]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} onUnblock={onUnblock} />);
    fireEvent.click(screen.getByText('Unblock'));
    expect(onUnblock).toHaveBeenCalledWith(BLOCKED_PERSON);
  });

  it('shows Block button for non-blocked rows', () => {
    render(<PersonTable rows={[{ ...BLOCKED_PERSON, status: 'APPROVED', verdict: 'APPROVED', block_reason: null }]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} onUnblock={vi.fn()} />);
    expect(screen.getByText(/🚫 Block/)).toBeInTheDocument();
    expect(screen.queryByText('Unblock')).not.toBeInTheDocument();
  });

  it('calls onBlock when Block is clicked', () => {
    const onBlock = vi.fn();
    const approved = { ...BLOCKED_PERSON, status: 'APPROVED', verdict: 'APPROVED', block_reason: null };
    render(<PersonTable rows={[approved]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={onBlock} onUnblock={vi.fn()} />);
    fireEvent.click(screen.getByText(/🚫 Block/));
    expect(onBlock).toHaveBeenCalledWith(approved);
  });

  it('clicking Unblock button does not open the visit history modal', async () => {
    render(<PersonTable rows={[BLOCKED_PERSON]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} onUnblock={vi.fn()} />);
    fireEvent.click(screen.getByText('Unblock'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.getPersonVisits).not.toHaveBeenCalled();
  });

  it('clicking Block button does not open the visit history modal', async () => {
    const approved = { ...BLOCKED_PERSON, status: 'APPROVED', verdict: 'APPROVED', block_reason: null };
    render(<PersonTable rows={[approved]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} onUnblock={vi.fn()} />);
    fireEvent.click(screen.getByText(/🚫 Block/));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.getPersonVisits).not.toHaveBeenCalled();
  });

  it('Reject button is absent for blocked rows', () => {
    render(<PersonTable rows={[BLOCKED_PERSON]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} onUnblock={vi.fn()} />);
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('does not show block_reason text for non-blocked rows', () => {
    const approved = { ...BLOCKED_PERSON, status: 'APPROVED', verdict: 'APPROVED', block_reason: null };
    render(<PersonTable rows={[approved]} onEdit={vi.fn()} onDelete={vi.fn()} onBlock={vi.fn()} onUnblock={vi.fn()} />);
    expect(screen.queryByText('Caught tailgating')).not.toBeInTheDocument();
  });
});
