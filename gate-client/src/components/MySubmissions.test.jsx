import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MySubmissions from './MySubmissions';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { getMySubmissions: vi.fn() },
}));

const PENDING_ROW = {
  id: 1,
  identifier_value: '000000018',
  status: 'PENDING',
  verdict: 'NOT_APPROVED',
  approval_expiration: null,
  rejection_reason: null,
  created_at: '2024-06-01T10:00:00Z',
};

const APPROVED_ROW = {
  id: 2,
  identifier_value: '000000026',
  status: 'APPROVED',
  verdict: 'NOT_APPROVED',
  approval_expiration: '2099-12-31',
  rejection_reason: null,
  created_at: '2024-06-02T10:00:00Z',
};

const REJECTED_ROW = {
  id: 3,
  identifier_value: '000000034',
  status: 'NOT_APPROVED',
  verdict: 'NOT_APPROVED',
  approval_expiration: null,
  rejection_reason: 'No valid clearance on file',
  created_at: '2024-06-03T10:00:00Z',
};

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

  it('renders a PENDING card correctly', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000018')).toBeInTheDocument());
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('renders an APPROVED card correctly', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000026')).toBeInTheDocument());
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders a REJECTED card with rejection reason', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [REJECTED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000034')).toBeInTheDocument());
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('No valid clearance on file')).toBeInTheDocument();
  });

  it('shows expired label when approval_expiration is in the past', async () => {
    const expiredRow = { ...APPROVED_ROW, approval_expiration: '2000-01-01' };
    api.getMySubmissions.mockResolvedValue({ rows: [expiredRow] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Expired')).toBeInTheDocument());
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

  it('shows requestorName when provided', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [] });
    render(<MySubmissions requestorName="Dana Levi" />);
    await waitFor(() => expect(screen.getByText('Dana Levi')).toBeInTheDocument());
  });
});
