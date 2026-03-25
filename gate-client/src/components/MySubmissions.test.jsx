import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MySubmissions from './MySubmissions';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { getMySubmissions: vi.fn() },
}));

const BASE = {
  id: 1,
  identifier_value: '000000018',
  approval_expiration: null,
  rejection_reason: null,
  created_at: '2024-06-01T10:00:00Z',
};

const PENDING_ROW = { ...BASE, id: 1, identifier_value: '000000018', status: 'PENDING', verdict: 'NOT_APPROVED' };
const ADMIN_APPROVED_ROW = { ...BASE, id: 2, identifier_value: '000000026', status: 'APPROVED', verdict: 'ADMIN_APPROVED', approval_expiration: '2099-12-31' };
const ESCORT_ROW = { ...BASE, id: 3, identifier_value: '000000034', status: 'APPROVED', verdict: 'APPROVED_WITH_ESCORT', approval_expiration: '2099-12-31' };
const PLAIN_APPROVED_ROW = { ...BASE, id: 4, identifier_value: '000000042', status: null, verdict: 'APPROVED' };
const REJECTED_ROW = { ...BASE, id: 5, identifier_value: '000000059', status: 'NOT_APPROVED', verdict: 'NOT_APPROVED', rejection_reason: 'No valid clearance on file' };
const REJECTED_VIA_FORM_ROW = { ...BASE, id: 6, identifier_value: '000000067', status: null, verdict: 'NOT_APPROVED', rejection_reason: 'Flagged by security' };

describe('MySubmissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading state initially', () => {
    api.getMySubmissions.mockImplementation(() => new Promise(() => {}));
    render(<MySubmissions />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows empty state when no submissions', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('No submissions yet.')).toBeInTheDocument());
  });

  it('renders Pending Review for PENDING status', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000018')).toBeInTheDocument());
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('renders Admin Approved for ADMIN_APPROVED verdict', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [ADMIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000026')).toBeInTheDocument());
    expect(screen.getByText('Admin Approved')).toBeInTheDocument();
  });

  it('renders Approved with Escort for APPROVED_WITH_ESCORT verdict', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [ESCORT_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000034')).toBeInTheDocument());
    expect(screen.getByText('Approved with Escort')).toBeInTheDocument();
  });

  it('renders Approved for plain APPROVED verdict with no status', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PLAIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000042')).toBeInTheDocument());
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders Rejected for NOT_APPROVED status with rejection reason', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [REJECTED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000059')).toBeInTheDocument());
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('No valid clearance on file')).toBeInTheDocument();
  });

  it('renders Rejected when verdict is NOT_APPROVED with no status (rejected via form)', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [REJECTED_VIA_FORM_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000067')).toBeInTheDocument());
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Flagged by security')).toBeInTheDocument();
  });

  it('shows Expired when approval_expiration is in the past', async () => {
    const expiredRow = { ...ADMIN_APPROVED_ROW, approval_expiration: '2000-01-01' };
    api.getMySubmissions.mockResolvedValue({ rows: [expiredRow] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Expired')).toBeInTheDocument());
  });

  it('does not show Expired when approval_expiration is in the future', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [ADMIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Admin Approved')).toBeInTheDocument());
    expect(screen.queryByText('Expired')).not.toBeInTheDocument();
  });

  it('shows expiry warning when approval_expiration is exactly today', async () => {
    const today = new Date().toISOString().split('T')[0];
    const row = { ...ADMIN_APPROVED_ROW, approval_expiration: today };
    api.getMySubmissions.mockResolvedValue({ rows: [row] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText(/Expires in 1 day/)).toBeInTheDocument());
  });

  it('shows expiry warning when approval_expiration is in 2 days', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const row = { ...ADMIN_APPROVED_ROW, approval_expiration: soon };
    api.getMySubmissions.mockResolvedValue({ rows: [row] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText(/Expires in 2 days/)).toBeInTheDocument());
  });

  it('does not show expiry warning when approval_expiration is 3 days away', async () => {
    const later = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const row = { ...ADMIN_APPROVED_ROW, approval_expiration: later };
    api.getMySubmissions.mockResolvedValue({ rows: [row] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Admin Approved')).toBeInTheDocument());
    expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();
  });

  it('PENDING is not treated as rejected despite having NOT_APPROVED verdict', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Pending Review')).toBeInTheDocument());
    expect(screen.queryByText('Rejected')).not.toBeInTheDocument();
  });

  it('shows error state and Try Again button on API failure', async () => {
    api.getMySubmissions.mockRejectedValue(new Error('Network error'));
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Could not load submissions. Please try again.')).toBeInTheDocument());
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('reloads when Refresh is clicked', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('↻ Refresh'));
    fireEvent.click(screen.getByText('↻ Refresh'));
    expect(api.getMySubmissions).toHaveBeenCalledTimes(2);
  });

  it('reloads when Try Again is clicked after error', async () => {
    api.getMySubmissions
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('Try Again'));
    fireEvent.click(screen.getByText('Try Again'));
    await waitFor(() => expect(screen.getByText('No submissions yet.')).toBeInTheDocument());
  });
});
