import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { login: vi.fn() },
}));

vi.mock('../App', () => ({
  useAuth: () => ({ signIn: vi.fn() }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => vi.fn() };
});

function renderLogin() {
  return render(<MemoryRouter><Login /></MemoryRouter>);
}

describe('Admin Login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders username, password inputs and sign in button', () => {
    renderLogin();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('shows error on invalid credentials', async () => {
    api.login.mockRejectedValue(Object.assign(new Error('Invalid'), { status: 401 }));
    renderLogin();
    await userEvent.type(screen.getByRole('textbox'), 'bad');
    await userEvent.type(document.querySelector('input[type="password"]'), 'bad');
    fireEvent.click(screen.getByText('Sign In'));
    await waitFor(() => expect(screen.getByText('Invalid username or password')).toBeInTheDocument());
  });

  it('shows Access denied for non-admin roles', async () => {
    api.login.mockResolvedValue({ token: 'tok', role: 'access_requestor' });
    renderLogin();
    await userEvent.type(screen.getByRole('textbox'), 'requestor');
    await userEvent.type(document.querySelector('input[type="password"]'), 'pass');
    fireEvent.click(screen.getByText('Sign In'));
    await waitFor(() => expect(screen.getByText('Access denied')).toBeInTheDocument());
  });

  it('shows loading state while signing in', async () => {
    api.login.mockImplementation(() => new Promise(() => {}));
    renderLogin();
    await userEvent.type(screen.getByRole('textbox'), 'u');
    await userEvent.type(document.querySelector('input[type="password"]'), 'p');
    fireEvent.click(screen.getByText('Sign In'));
    await waitFor(() => expect(screen.getByText('Signing in…')).toBeDisabled());
  });
});
