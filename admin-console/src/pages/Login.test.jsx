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

function getPasswordInput() {
  return document.querySelector('input[type="password"], input[type="text"][autocomplete="current-password"]');
}

describe('Admin Login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders username, password inputs and sign in button', () => {
    renderLogin();
    expect(screen.getByRole('textbox')).toBeInTheDocument(); // username
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('password field is hidden by default', () => {
    renderLogin();
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it('clicking eye icon reveals password', () => {
    renderLogin();
    fireEvent.click(screen.getByLabelText('Show password'));
    expect(document.querySelector('input[type="password"]')).not.toBeInTheDocument();
    expect(document.querySelector('input[autocomplete="current-password"]')).toHaveAttribute('type', 'text');
  });

  it('clicking eye icon again hides password', () => {
    renderLogin();
    fireEvent.click(screen.getByLabelText('Show password'));
    fireEvent.click(screen.getByLabelText('Hide password'));
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it('shows error on invalid credentials', async () => {
    api.login.mockRejectedValue(Object.assign(new Error('Invalid'), { status: 401 }));
    renderLogin();
    await userEvent.type(screen.getByRole('textbox'), 'bad');
    await userEvent.type(document.querySelector('input[type="password"]'), 'bad');
    fireEvent.click(screen.getByText('Sign In'));
    await waitFor(() => expect(screen.getByText('Invalid username or password')).toBeInTheDocument());
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
