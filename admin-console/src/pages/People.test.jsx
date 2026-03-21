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

function setup() {
  api.listPeople.mockResolvedValue({ rows: [PERSON], total: 1 });
  return render(<People />);
}

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
