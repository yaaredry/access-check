import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UserTable from './UserTable';

const USERS = [
  { id: 1, username: 'alice@example.com', name: 'Alice', created_at: '2024-01-01T00:00:00Z' },
  { id: 2, username: 'bob@example.com',   name: 'Bob',   created_at: '2024-02-01T00:00:00Z' },
];

describe('UserTable', () => {
  it('renders empty state when no users', () => {
    render(<UserTable users={[]} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    expect(screen.getByText('No requestor users found.')).toBeInTheDocument();
  });

  it('renders a row per user with name and email', () => {
    render(<UserTable users={USERS} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('calls onEdit with the correct user', () => {
    const onEdit = vi.fn();
    render(<UserTable users={USERS} onEdit={onEdit} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Edit')[0]);
    expect(onEdit).toHaveBeenCalledWith(USERS[0]);
  });

  it('calls onDelete with the correct user', () => {
    const onDelete = vi.fn();
    render(<UserTable users={USERS} onEdit={vi.fn()} onDelete={onDelete} onRegenerate={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Delete')[0]);
    expect(onDelete).toHaveBeenCalledWith(USERS[0]);
  });

  it('calls onRegenerate with the correct user', () => {
    const onRegenerate = vi.fn();
    render(<UserTable users={USERS} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getAllByText('Reset Password')[0]);
    expect(onRegenerate).toHaveBeenCalledWith(USERS[0]);
  });
});
