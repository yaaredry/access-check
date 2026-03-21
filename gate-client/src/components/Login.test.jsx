import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from './Login';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { login: vi.fn() },
}));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders username, password inputs and sign in button', () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
  });

  it('calls onLogin with role on successful login', async () => {
    api.login.mockResolvedValue({ token: 'tok', role: 'gate' });
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    await userEvent.type(screen.getByPlaceholderText('Username'), 'gateuser');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'pass');
    fireEvent.click(screen.getByText('Sign in'));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('gate'));
  });

  it('stores token and role in localStorage on success', async () => {
    api.login.mockResolvedValue({ token: 'tok123', role: 'gate' });
    render(<Login onLogin={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Username'), 'u');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'p');
    fireEvent.click(screen.getByText('Sign in'));
    await waitFor(() => expect(localStorage.getItem('gate_token')).toBe('tok123'));
    expect(localStorage.getItem('gate_role')).toBe('gate');
  });

  it('allows access_requestor role', async () => {
    api.login.mockResolvedValue({ token: 'tok', role: 'access_requestor' });
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    await userEvent.type(screen.getByPlaceholderText('Username'), 'req');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'req');
    fireEvent.click(screen.getByText('Sign in'));
    await waitFor(() => expect(onLogin).toHaveBeenCalledWith('access_requestor'));
  });

  it('shows Access denied for disallowed role', async () => {
    api.login.mockResolvedValue({ token: 'tok', role: 'superadmin' });
    render(<Login onLogin={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Username'), 'x');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'x');
    fireEvent.click(screen.getByText('Sign in'));
    await waitFor(() => expect(screen.getByText('Access denied')).toBeInTheDocument());
  });

  it('shows error message on API failure', async () => {
    api.login.mockRejectedValue(new Error('Invalid credentials'));
    render(<Login onLogin={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Username'), 'bad');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'bad');
    fireEvent.click(screen.getByText('Sign in'));
    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument());
  });

  it('password field is hidden by default', () => {
    render(<Login onLogin={vi.fn()} />);
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password');
  });

  it('clicking eye icon reveals password', async () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Show password'));
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'text');
  });

  it('clicking eye icon again hides password', async () => {
    render(<Login onLogin={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Show password'));
    fireEvent.click(screen.getByLabelText('Hide password'));
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password');
  });

  it('shows loading state while signing in', async () => {
    api.login.mockImplementation(() => new Promise(() => {}));
    render(<Login onLogin={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Username'), 'u');
    await userEvent.type(screen.getByPlaceholderText('Password'), 'p');
    fireEvent.click(screen.getByText('Sign in'));
    await waitFor(() => expect(screen.getByText('Signing in…')).toBeInTheDocument());
    expect(screen.getByText('Signing in…')).toBeDisabled();
  });
});
