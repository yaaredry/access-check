import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import People from './People';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    listPeople: vi.fn(),
    updatePersonStatus: vi.fn(),
    deletePerson: vi.fn(),
    createPerson: vi.fn(),
    updatePerson: vi.fn(),
    blockPerson: vi.fn(),
    unblockPerson: vi.fn(),
  },
}));

vi.mock('../components/PersonTable', () => ({
  default: ({ rows, onApprove, onReject, onEdit, onDelete, onBlock, onUnblock }) => (
    <div>
      {rows.map((r) => (
        <div key={r.id}>
          <span>{r.identifier_value}</span>
          <button onClick={() => onApprove(r)}>ApproveRow</button>
          <button onClick={() => onReject(r)}>Reject</button>
          <button onClick={() => onEdit(r)}>Edit</button>
          <button onClick={() => onDelete(r)}>Delete</button>
          <button onClick={() => onBlock(r)}>BlockRow</button>
          <button onClick={() => onUnblock(r)}>UnblockRow</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../components/PersonForm', () => ({ default: () => <div>PersonForm</div> }));
vi.mock('../components/BulkUpload', () => ({ default: () => <div>BulkUpload</div> }));
vi.mock('../components/GSheetImport', () => ({ default: () => <div>GSheetImport</div> }));

const PERSON = {
  id: 1,
  identifier_type: 'IL_ID',
  identifier_value: '000000018',
  verdict: 'NOT_APPROVED',
  status: 'PENDING',
  approval_expiration: null,
  last_seen_at: null,
  created_at: '2024-01-01T00:00:00Z',
};

// A diverse set of people covering all display statuses
const PEOPLE_ALL_STATUSES = [
  { id: 1, identifier_type: 'IL_ID', identifier_value: 'pending-001',            verdict: null,                  status: 'PENDING',       approval_expiration: null,         last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 2, identifier_type: 'IL_ID', identifier_value: 'approved-001',           verdict: 'APPROVED',            status: 'APPROVED',      approval_expiration: '2099-12-31', last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 3, identifier_type: 'IL_ID', identifier_value: 'admin-approved-001',     verdict: 'ADMIN_APPROVED',      status: 'APPROVED',      approval_expiration: '2099-12-31', last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 4, identifier_type: 'IL_ID', identifier_value: 'approved-with-escort-001', verdict: 'APPROVED_WITH_ESCORT', status: 'APPROVED',   approval_expiration: '2099-12-31', last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 5, identifier_type: 'IL_ID', identifier_value: 'expired-001',            verdict: 'APPROVED',            status: 'APPROVED',      approval_expiration: '2000-01-01', last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 6, identifier_type: 'IL_ID', identifier_value: 'not-approved-001',       verdict: 'NOT_APPROVED',        status: 'NOT_APPROVED',  approval_expiration: null,         last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 7, identifier_type: 'IL_ID', identifier_value: 'blocked-001',            verdict: 'BLOCKED',             status: 'BLOCKED',       approval_expiration: null,         last_seen_at: null, created_at: '2024-01-01T00:00:00Z', block_reason: 'Bad actor' },
];

function setup() {
  api.listPeople.mockResolvedValue({ rows: [PERSON], total: 1 });
  return render(<People />);
}

function setupMulti() {
  api.listPeople.mockResolvedValue({ rows: PEOPLE_ALL_STATUSES, total: PEOPLE_ALL_STATUSES.length });
  return render(<People />);
}

describe('People — status quick filters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders one filter button per status', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('pending-001'));
    expect(screen.getByRole('button', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approved' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Admin Approved' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approved w/ Escort' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expired' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not Approved' })).toBeInTheDocument();
  });

  it('filters to only Pending rows when Pending is clicked', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('pending-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.getByText('pending-001')).toBeInTheDocument();
    expect(screen.queryByText('approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('admin-approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('expired-001')).not.toBeInTheDocument();
    expect(screen.queryByText('not-approved-001')).not.toBeInTheDocument();
  });

  it('filters to only Approved rows when Approved is clicked', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('approved-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
    expect(screen.getByText('approved-001')).toBeInTheDocument();
    expect(screen.queryByText('pending-001')).not.toBeInTheDocument();
    expect(screen.queryByText('admin-approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('expired-001')).not.toBeInTheDocument();
    expect(screen.queryByText('not-approved-001')).not.toBeInTheDocument();
  });

  it('filters to only Admin Approved rows when Admin Approved is clicked', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('admin-approved-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Admin Approved' }));
    expect(screen.getByText('admin-approved-001')).toBeInTheDocument();
    expect(screen.queryByText('pending-001')).not.toBeInTheDocument();
    expect(screen.queryByText('approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('expired-001')).not.toBeInTheDocument();
    expect(screen.queryByText('not-approved-001')).not.toBeInTheDocument();
  });

  it('filters to only Approved with Escort rows when Approved w/ Escort is clicked', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('approved-with-escort-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Approved w/ Escort' }));
    expect(screen.getByText('approved-with-escort-001')).toBeInTheDocument();
    expect(screen.queryByText('pending-001')).not.toBeInTheDocument();
    expect(screen.queryByText('approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('admin-approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('expired-001')).not.toBeInTheDocument();
    expect(screen.queryByText('not-approved-001')).not.toBeInTheDocument();
  });

  it('filters to only Expired rows when Expired is clicked', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('expired-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Expired' }));
    expect(screen.getByText('expired-001')).toBeInTheDocument();
    expect(screen.queryByText('pending-001')).not.toBeInTheDocument();
    expect(screen.queryByText('approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('admin-approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('not-approved-001')).not.toBeInTheDocument();
  });

  it('filters to only Not Approved rows when Not Approved is clicked', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('not-approved-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Not Approved' }));
    expect(screen.getByText('not-approved-001')).toBeInTheDocument();
    expect(screen.queryByText('pending-001')).not.toBeInTheDocument();
    expect(screen.queryByText('approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('admin-approved-001')).not.toBeInTheDocument();
    expect(screen.queryByText('expired-001')).not.toBeInTheDocument();
  });

  it('shows all rows when active filter is clicked again (toggle off)', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('pending-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.queryByText('approved-001')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.getByText('approved-001')).toBeInTheDocument();
    expect(screen.getByText('pending-001')).toBeInTheDocument();
  });

  it('filter persists when data is reloaded (e.g. after 30 s refresh)', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('pending-001'));

    // Activate Pending filter
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.queryByText('approved-001')).not.toBeInTheDocument();

    // Trigger a reload via the search form (same code-path as the 30 s interval)
    api.listPeople.mockResolvedValueOnce({ rows: PEOPLE_ALL_STATUSES, total: PEOPLE_ALL_STATUSES.length });
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form'));
    await waitFor(() => expect(api.listPeople).toHaveBeenCalledTimes(2));

    // Filter must still be active after the reload
    expect(screen.getByRole('button', { name: 'Pending' })).toHaveClass('primary');
    expect(screen.getByText('pending-001')).toBeInTheDocument();
    expect(screen.queryByText('approved-001')).not.toBeInTheDocument();
  });
});

describe('People — approve modal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens approve modal when Approve is clicked', async () => {
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('ApproveRow'));
    expect(screen.getByText('Approve Access')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Administrative Approval')).toBeInTheDocument();
  });

  it('calls updatePersonStatus with APPROVED verdict when Approve is chosen', async () => {
    api.updatePersonStatus.mockResolvedValue({});
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('ApproveRow'));
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(api.updatePersonStatus).toHaveBeenCalledWith(1, 'APPROVED', undefined, 'APPROVED'));
  });

  it('calls updatePersonStatus with ADMIN_APPROVED verdict when Administrative Approval is chosen', async () => {
    api.updatePersonStatus.mockResolvedValue({});
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('ApproveRow'));
    fireEvent.click(screen.getByText('Administrative Approval'));
    await waitFor(() => expect(api.updatePersonStatus).toHaveBeenCalledWith(1, 'APPROVED', undefined, 'ADMIN_APPROVED'));
  });

  it('calls updatePersonStatus with APPROVED_WITH_ESCORT verdict when "Approved with Escort" is chosen', async () => {
    api.updatePersonStatus.mockResolvedValue({});
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('ApproveRow'));
    fireEvent.click(screen.getByText('Approved with Escort'));
    await waitFor(() => expect(api.updatePersonStatus).toHaveBeenCalledWith(1, 'APPROVED', undefined, 'APPROVED_WITH_ESCORT'));
  });

  it('shows error message in approve modal when approval API call fails', async () => {
    api.updatePersonStatus.mockRejectedValue(new Error('Internal Server Error'));
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('ApproveRow'));
    fireEvent.click(screen.getByText('Approved with Escort'));
    await waitFor(() => screen.getByText('Internal Server Error'));
    expect(screen.getByText('Approve Access')).toBeInTheDocument();
  });

  it('shows fallback error message when error has no message', async () => {
    api.updatePersonStatus.mockRejectedValue(new Error());
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('ApproveRow'));
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => screen.getByText('Failed to approve. Please try again.'));
  });

  it('closes approve modal when Cancel is clicked', async () => {
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('ApproveRow'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Approve Access')).not.toBeInTheDocument();
  });

  it('reloads list after approval', async () => {
    api.updatePersonStatus.mockResolvedValue({});
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('ApproveRow'));
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(api.listPeople).toHaveBeenCalledTimes(2));
  });
});

describe('People — block filter chip', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a Blocked filter chip', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('blocked-001'));
    expect(screen.getByRole('button', { name: /Blocked/i })).toBeInTheDocument();
  });

  it('clicking Blocked filter shows only blocked rows', async () => {
    setupMulti();
    await waitFor(() => screen.getByText('blocked-001'));
    fireEvent.click(screen.getByRole('button', { name: /Blocked/i }));
    expect(screen.getByText('blocked-001')).toBeInTheDocument();
    expect(screen.queryByText('pending-001')).not.toBeInTheDocument();
    expect(screen.queryByText('approved-001')).not.toBeInTheDocument();
  });
});

describe('People — block modal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens block modal when BlockRow is clicked', async () => {
    api.blockPerson.mockResolvedValue({});
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('BlockRow'));
    expect(screen.getByText(/Block Person/i)).toBeInTheDocument();
  });

  it('calls blockPerson with blockReason and closes modal on confirm', async () => {
    api.blockPerson.mockResolvedValue({});
    api.listPeople.mockResolvedValue({ rows: [PERSON], total: 1 });
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('BlockRow'));
    const textarea = screen.getByPlaceholderText(/Reason for blocking/i);
    fireEvent.change(textarea, { target: { value: 'Repeated violations' } });
    fireEvent.click(screen.getByRole('button', { name: '🚫 Block' }));
    await waitFor(() => expect(api.blockPerson).toHaveBeenCalledWith(PERSON.id, 'Repeated violations'));
    expect(screen.queryByText(/Block Person/i)).not.toBeInTheDocument();
  });

  it('block confirm button is disabled when reason is empty', async () => {
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('BlockRow'));
    expect(screen.getByRole('button', { name: '🚫 Block' })).toBeDisabled();
  });

  it('closes block modal when Cancel is clicked', async () => {
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('BlockRow'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Block Person/i)).not.toBeInTheDocument();
  });

  it('shows error when blockPerson API call fails', async () => {
    api.blockPerson.mockRejectedValue(new Error('Server error'));
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('BlockRow'));
    fireEvent.change(screen.getByPlaceholderText(/Reason for blocking/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: '🚫 Block' }));
    await waitFor(() => screen.getByText('Server error'));
    expect(screen.getByText(/Block Person/i)).toBeInTheDocument();
  });
});

describe('People — unblock modal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens unblock modal when UnblockRow is clicked', async () => {
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('UnblockRow'));
    expect(screen.getByText('Unblock Person')).toBeInTheDocument();
  });

  it('calls unblockPerson with PENDING status and closes modal', async () => {
    api.unblockPerson.mockResolvedValue({});
    api.listPeople.mockResolvedValue({ rows: [PERSON], total: 1 });
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('UnblockRow'));
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(api.unblockPerson).toHaveBeenCalledWith(PERSON.id, 'PENDING', undefined, undefined));
    expect(screen.queryByText('Unblock Person')).not.toBeInTheDocument();
  });

  it('closes unblock modal when Cancel is clicked', async () => {
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('UnblockRow'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Unblock Person')).not.toBeInTheDocument();
  });

  it('shows rejection reason textarea when NOT_APPROVED is selected', async () => {
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('UnblockRow'));
    fireEvent.click(screen.getByDisplayValue('PENDING'));
    fireEvent.click(screen.getByDisplayValue('NOT_APPROVED'));
    expect(screen.getByPlaceholderText(/Reason for rejection/i)).toBeInTheDocument();
  });

  it('calls unblockPerson with APPROVED status and verdict on confirm', async () => {
    api.unblockPerson.mockResolvedValue({});
    api.listPeople.mockResolvedValue({ rows: [PERSON], total: 1 });
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('UnblockRow'));
    fireEvent.click(screen.getByDisplayValue('PENDING'));
    fireEvent.click(screen.getByDisplayValue('APPROVED'));
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(api.unblockPerson).toHaveBeenCalledWith(PERSON.id, 'APPROVED', expect.any(String), undefined));
    expect(screen.queryByText('Unblock Person')).not.toBeInTheDocument();
  });

  it('calls unblockPerson with NOT_APPROVED status and rejectionReason on confirm', async () => {
    api.unblockPerson.mockResolvedValue({});
    api.listPeople.mockResolvedValue({ rows: [PERSON], total: 1 });
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('UnblockRow'));
    fireEvent.click(screen.getByDisplayValue('PENDING'));
    fireEvent.click(screen.getByDisplayValue('NOT_APPROVED'));
    fireEvent.change(screen.getByPlaceholderText(/Reason for rejection/i), { target: { value: 'Policy violation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(api.unblockPerson).toHaveBeenCalledWith(PERSON.id, 'NOT_APPROVED', undefined, 'Policy violation'));
    expect(screen.queryByText('Unblock Person')).not.toBeInTheDocument();
  });

  it('shows error when unblockPerson API call fails', async () => {
    api.unblockPerson.mockRejectedValue(new Error('Network error'));
    setup();
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('UnblockRow'));
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    await waitFor(() => screen.getByText('Network error'));
    expect(screen.getByText('Unblock Person')).toBeInTheDocument();
  });

  it('reloads the list after a successful unblock', async () => {
    api.unblockPerson.mockResolvedValue({});
    api.listPeople.mockResolvedValue({ rows: [PERSON], total: 1 });
    setup();
    await waitFor(() => screen.getByText('000000018'));
    const callsBefore = api.listPeople.mock.calls.length;
    fireEvent.click(screen.getByText('UnblockRow'));
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(api.listPeople.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
