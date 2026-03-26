import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Users from './Users';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    listUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    regeneratePassword: vi.fn(),
  },
}));

const USERS = [
  { id: 1, username: 'alice@example.com', name: 'Alice', created_at: '2024-01-01T00:00:00Z' },
  { id: 2, username: 'bob@example.com',   name: 'Bob',   created_at: '2024-02-01T00:00:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.listUsers.mockResolvedValue({ users: USERS });
});

describe('Users page', () => {
  it('renders the list of users', async () => {
    render(<Users />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows empty state when no users', async () => {
    api.listUsers.mockResolvedValue({ users: [] });
    render(<Users />);
    await waitFor(() => expect(screen.getByText('No requestor users found.')).toBeInTheDocument());
  });

  it('opens create modal on Add User click', async () => {
    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));
    fireEvent.click(screen.getByText('+ Add User'));
    expect(screen.getByText('Add Requestor User')).toBeInTheDocument();
  });

  it('creates a user and shows the generated password', async () => {
    api.createUser.mockResolvedValue({
      id: 3, username: 'new@example.com', name: 'New', role: 'access_requestor',
      created_at: '2024-03-01T00:00:00Z', plainPassword: 'ab3c9',
    });
    api.listUsers.mockResolvedValue({ users: USERS });

    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));

    fireEvent.click(screen.getByText('+ Add User'));
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Display name'), { target: { value: 'New' } });
    fireEvent.click(screen.getByText('Create User'));

    await waitFor(() => expect(screen.getByText('Password Ready')).toBeInTheDocument());
    expect(screen.getByText('ab3c9')).toBeInTheDocument();
    expect(screen.getByText(/Save this password/)).toBeInTheDocument();
  });

  it('dismissing password modal hides it', async () => {
    api.createUser.mockResolvedValue({
      id: 3, username: 'new@example.com', name: 'New', role: 'access_requestor',
      created_at: '2024-03-01T00:00:00Z', plainPassword: 'ab3c9',
    });

    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));

    fireEvent.click(screen.getByText('+ Add User'));
    fireEvent.change(screen.getByPlaceholderText('user@example.com'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Display name'), { target: { value: 'New' } });
    fireEvent.click(screen.getByText('Create User'));

    await waitFor(() => screen.getByText('Password Ready'));
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Password Ready')).not.toBeInTheDocument();
  });

  it('opens edit modal with pre-filled values', async () => {
    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));
    fireEvent.click(screen.getAllByText('Edit')[0]);

    expect(screen.getByText('Edit User')).toBeInTheDocument();
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });

  it('submits edit and closes modal', async () => {
    api.updateUser.mockResolvedValue({ id: 1, username: 'alice2@example.com', name: 'Alice 2' });

    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));
    fireEvent.click(screen.getAllByText('Edit')[0]);

    fireEvent.change(screen.getByDisplayValue('Alice'), { target: { value: 'Alice 2' } });
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(1, { username: 'alice@example.com', name: 'Alice 2' }));
    expect(screen.queryByText('Edit User')).not.toBeInTheDocument();
  });

  it('shows delete confirmation modal', async () => {
    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));
    fireEvent.click(screen.getAllByText('Delete')[0]);

    expect(screen.getByText('Delete User')).toBeInTheDocument();
    // email appears in both table row and modal message
    expect(screen.getAllByText(/alice@example.com/).length).toBeGreaterThanOrEqual(2);
  });

  it('calls deleteUser on confirm and reloads', async () => {
    api.deleteUser.mockResolvedValue(null);

    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));
    fireEvent.click(screen.getAllByText('Delete')[0]);
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith(1));
    expect(api.listUsers).toHaveBeenCalledTimes(2);
  });

  it('shows regenerate confirmation modal', async () => {
    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));
    fireEvent.click(screen.getAllByText('Reset Password')[0]);

    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
    expect(screen.getAllByText(/alice@example.com/).length).toBeGreaterThanOrEqual(2);
  });

  it('shows new password after regenerate confirm', async () => {
    api.regeneratePassword.mockResolvedValue({ plainPassword: 'z9x1q' });

    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));
    fireEvent.click(screen.getAllByText('Reset Password')[0]);
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => expect(screen.getByText('Password Ready')).toBeInTheDocument());
    expect(screen.getByText('z9x1q')).toBeInTheDocument();
  });

  it('cancels create modal without calling API', async () => {
    render(<Users />);
    await waitFor(() => screen.getByText('Alice'));
    fireEvent.click(screen.getByText('+ Add User'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Add Requestor User')).not.toBeInTheDocument();
    expect(api.createUser).not.toHaveBeenCalled();
  });
});
