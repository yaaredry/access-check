import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VisitHistoryModal from './VisitHistoryModal';

const PERSON = { id: 1, identifier_type: 'IL_ID', identifier_value: '000000018' };

const VISITS = [
  { id: 10, verdict: 'APPROVED', source: 'manual', created_at: '2024-06-15T09:30:00Z' },
  { id: 11, verdict: 'NOT_APPROVED', source: 'image', created_at: '2024-05-01T14:00:00Z' },
];

describe('VisitHistoryModal', () => {
  it('renders the modal with person identifier in the header', () => {
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error={null} onClose={vi.fn()} />);
    expect(screen.getByText('Visit History')).toBeInTheDocument();
    expect(screen.getByText('000000018')).toBeInTheDocument();
    expect(screen.getByText(/IL_ID/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={true} error={null} onClose={vi.fn()} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('does not show visit table while loading', () => {
    render(<VisitHistoryModal person={PERSON} visits={VISITS} loading={true} error={null} onClose={vi.fn()} />);
    expect(screen.queryByText('Date & Time')).not.toBeInTheDocument();
  });

  it('shows error message when error is set', () => {
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error="Network error" onClose={vi.fn()} />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('does not show loading when error is shown', () => {
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error="Something went wrong" onClose={vi.fn()} />);
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows empty state when visits array is empty', () => {
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error={null} onClose={vi.fn()} />);
    expect(screen.getByText('No visits recorded.')).toBeInTheDocument();
  });

  it('renders visit rows with verdict and source', () => {
    render(<VisitHistoryModal person={PERSON} visits={VISITS} loading={false} error={null} onClose={vi.fn()} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Not Approved')).toBeInTheDocument();
    expect(screen.getByText('manual')).toBeInTheDocument();
    expect(screen.getByText('image')).toBeInTheDocument();
  });

  it('renders table headers when visits are present', () => {
    render(<VisitHistoryModal person={PERSON} visits={VISITS} loading={false} error={null} onClose={vi.fn()} />);
    expect(screen.getByText('Date & Time')).toBeInTheDocument();
    expect(screen.getByText('Verdict')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error={null} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error={null} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when a non-Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error={null} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes keydown listener on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error={null} onClose={onClose} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows ADMIN_APPROVED verdict label', () => {
    const adminVisit = [{ id: 1, verdict: 'ADMIN_APPROVED', source: 'manual', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal person={PERSON} visits={adminVisit} loading={false} error={null} onClose={vi.fn()} />);
    expect(screen.getByText('Admin Approved')).toBeInTheDocument();
  });

  it('shows APPROVED_WITH_ESCORT verdict label', () => {
    const escortVisit = [{ id: 1, verdict: 'APPROVED_WITH_ESCORT', source: 'manual', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal person={PERSON} visits={escortVisit} loading={false} error={null} onClose={vi.fn()} />);
    expect(screen.getByText('Approved with Escort')).toBeInTheDocument();
  });

  it('shows EXPIRED verdict label', () => {
    const expiredVisit = [{ id: 1, verdict: 'EXPIRED', source: 'image', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal person={PERSON} visits={expiredVisit} loading={false} error={null} onClose={vi.fn()} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows NOT_FOUND verdict label', () => {
    const notFoundVisit = [{ id: 1, verdict: 'NOT_FOUND', source: 'manual', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal person={PERSON} visits={notFoundVisit} loading={false} error={null} onClose={vi.fn()} />);
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });

  it('shows — for null verdict', () => {
    const nullVerdictVisit = [{ id: 1, verdict: null, source: 'manual', created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal person={PERSON} visits={nullVerdictVisit} loading={false} error={null} onClose={vi.fn()} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows — for null source', () => {
    const nullSourceVisit = [{ id: 1, verdict: 'APPROVED', source: null, created_at: '2024-06-15T09:30:00Z' }];
    render(<VisitHistoryModal person={PERSON} visits={nullSourceVisit} loading={false} error={null} onClose={vi.fn()} />);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('has role=dialog and aria-modal attributes', () => {
    render(<VisitHistoryModal person={PERSON} visits={[]} loading={false} error={null} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('renders multiple visits in order', () => {
    render(<VisitHistoryModal person={PERSON} visits={VISITS} loading={false} error={null} onClose={vi.fn()} />);
    const rows = screen.getAllByRole('row');
    // header row + 2 data rows
    expect(rows).toHaveLength(3);
  });
});
