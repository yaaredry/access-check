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
  },
}));

vi.mock('../components/PersonTable', () => ({
  default: ({ rows, onApprove, onReject, onEdit, onDelete }) => (
    <div>
      {rows.map((r) => (
        <div key={r.id}>
          <span>{r.identifier_value}</span>
          <button onClick={() => onApprove(r)}>ApproveRow</button>
          <button onClick={() => onReject(r)}>Reject</button>
          <button onClick={() => onEdit(r)}>Edit</button>
          <button onClick={() => onDelete(r)}>Delete</button>
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

// A diverse set of people covering all five display statuses
const PEOPLE_ALL_STATUSES = [
  { id: 1, identifier_type: 'IL_ID', identifier_value: 'pending-001',       verdict: null,           status: 'PENDING',       approval_expiration: null,          last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 2, identifier_type: 'IL_ID', identifier_value: 'approved-001',      verdict: 'APPROVED',     status: 'APPROVED',      approval_expiration: '2099-12-31',  last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 3, identifier_type: 'IL_ID', identifier_value: 'admin-approved-001', verdict: 'ADMIN_APPROVED', status: 'APPROVED',   approval_expiration: '2099-12-31',  last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 4, identifier_type: 'IL_ID', identifier_value: 'expired-001',       verdict: 'APPROVED',     status: 'APPROVED',      approval_expiration: '2000-01-01',  last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 5, identifier_type: 'IL_ID', identifier_value: 'not-approved-001',  verdict: 'NOT_APPROVED', status: 'NOT_APPROVED',  approval_expiration: null,          last_seen_at: null, created_at: '2024-01-01T00:00:00Z' },
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
