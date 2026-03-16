import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PersonTable from './PersonTable';

const BASE = {
  id: 1,
  identifier_type: 'IL_ID',
  identifier_value: '000000018',
  verdict: 'APPROVED',
  approval_expiration: null,
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
});
