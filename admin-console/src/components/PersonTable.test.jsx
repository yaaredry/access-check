import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PersonTable from './PersonTable';

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
});
