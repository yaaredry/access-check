import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UserTable from './UserTable';

const USERS = [
  { id: 1, username: 'alice@example.com', name: 'Alice', request_count: 5,  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-03-01T00:00:00Z' },
  { id: 2, username: 'bob@example.com',   name: 'Bob',   request_count: 12, created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-15T00:00:00Z' },
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

describe('UserTable — sorting', () => {
  function getNames() {
    return screen.getAllByRole('row').slice(1).map(r => r.cells[0].textContent);
  }

  it('preserves server order by default (no sort active)', () => {
    render(<UserTable users={USERS} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    expect(getNames()).toEqual(['Alice', 'Bob']);
  });

  it('sorts by Name ascending on first click', () => {
    render(<UserTable users={[...USERS].reverse()} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    fireEvent.click(screen.getByText(/^Name/));
    expect(getNames()).toEqual(['Alice', 'Bob']);
  });

  it('sorts by Name descending on second click', () => {
    render(<UserTable users={USERS} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    fireEvent.click(screen.getByText(/^Name/));
    fireEvent.click(screen.getByText(/^Name/));
    expect(getNames()).toEqual(['Bob', 'Alice']);
  });

  it('sorts by # Submissions ascending', () => {
    render(<UserTable users={USERS} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    fireEvent.click(screen.getByText(/# Submissions/));
    expect(getNames()).toEqual(['Alice', 'Bob']); // 5 < 12
  });

  it('sorts by # Submissions descending', () => {
    render(<UserTable users={USERS} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    fireEvent.click(screen.getByText(/# Submissions/));
    fireEvent.click(screen.getByText(/# Submissions/));
    expect(getNames()).toEqual(['Bob', 'Alice']); // 12 > 5
  });

  it('sorts by Created ascending', () => {
    render(<UserTable users={[...USERS].reverse()} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    fireEvent.click(screen.getByText(/^Created/));
    expect(getNames()).toEqual(['Alice', 'Bob']); // Jan < Feb
  });

  it('switches sort column when a different header is clicked', () => {
    render(<UserTable users={USERS} onEdit={vi.fn()} onDelete={vi.fn()} onRegenerate={vi.fn()} />);
    fireEvent.click(screen.getByText(/^Name/));
    fireEvent.click(screen.getByText(/# Submissions/));
    // Now sorted by request_count asc: Alice(5) then Bob(12)
    expect(getNames()).toEqual(['Alice', 'Bob']);
  });
});
