import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

vi.mock('./components/Login', () => ({
  default: ({ onLogin }) => (
    <div>
      <button onClick={() => onLogin('gate')}>Login as gate</button>
      <button onClick={() => onLogin('admin')}>Login as admin</button>
      <button onClick={() => onLogin('access_requestor')}>Login as requestor</button>
    </div>
  ),
}));

vi.mock('./components/ManualCheck', () => ({
  default: ({ onBack }) => (
    <div data-testid="manual-check">
      <button onClick={onBack}>ManualBack</button>
    </div>
  ),
}));

vi.mock('./components/CameraCheck', () => ({
  default: ({ onBack, onSwitch }) => (
    <div data-testid="camera-check">
      <button onClick={onBack}>CameraBack</button>
      <button onClick={onSwitch}>CameraSwitch</button>
    </div>
  ),
}));

vi.mock('./components/AccessRequestForm', () => ({
  default: ({ onLogout }) => (
    <div data-testid="access-request-form">
      <button onClick={onLogout}>RequestorLogout</button>
    </div>
  ),
}));

vi.mock('./components/MySubmissions', () => ({
  default: () => <div data-testid="my-submissions">My Submissions Content</div>,
}));

describe('App', () => {
  beforeEach(() => localStorage.clear());

  it('shows Login when not authenticated', () => {
    render(<App />);
    expect(screen.getByText('Login as gate')).toBeInTheDocument();
  });

  it('shows ManualCheck directly after gate login', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => expect(screen.getByTestId('manual-check')).toBeInTheDocument());
  });

  it('shows AccessRequestForm for access_requestor role', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as requestor'));
    await waitFor(() => expect(screen.getByTestId('access-request-form')).toBeInTheDocument());
  });

  it('returns to home from ManualCheck via Back, home shows Enter ID Manually', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByTestId('manual-check'));
    fireEvent.click(screen.getByText('ManualBack'));
    expect(screen.getByText(/Enter ID Manually/)).toBeInTheDocument();
  });

  it('navigates from home to ManualCheck via Enter ID Manually button', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByTestId('manual-check'));
    fireEvent.click(screen.getByText('ManualBack'));
    fireEvent.click(screen.getByText(/Enter ID Manually/));
    expect(screen.getByTestId('manual-check')).toBeInTheDocument();
  });

  it('logs out from home and shows Login', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByTestId('manual-check'));
    fireEvent.click(screen.getByText('ManualBack'));
    fireEvent.click(screen.getByText('Logout'));
    expect(screen.getByText('Login as gate')).toBeInTheDocument();
    expect(localStorage.getItem('gate_token')).toBeNull();
  });

  it('logs out from AccessRequestForm and shows Login', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as requestor'));
    await waitFor(() => screen.getByTestId('access-request-form'));
    fireEvent.click(screen.getByText('RequestorLogout'));
    expect(screen.getByText('Login as gate')).toBeInTheDocument();
  });

  it('shows My Submissions tab when requestor clicks it', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as requestor'));
    await waitFor(() => screen.getByText('📄 My Submissions'));
    fireEvent.click(screen.getByText('📄 My Submissions'));
    expect(screen.getByTestId('my-submissions')).toBeInTheDocument();
  });

  it('switches back to New Request tab from My Submissions', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as requestor'));
    await waitFor(() => screen.getByText('📄 My Submissions'));
    fireEvent.click(screen.getByText('📄 My Submissions'));
    fireEvent.click(screen.getByText('📋 New Request'));
    expect(screen.getByTestId('access-request-form')).toBeInTheDocument();
  });

  it('restores authenticated state from localStorage', () => {
    // A real JWT with exp far in the future (year 2099) so the expiry check passes
    const futureJwt = 'eyJhbGciOiJIUzI1NiJ9.' + btoa(JSON.stringify({ sub: 1, exp: 4070908800 })) + '.sig';
    localStorage.setItem('gate_token', futureJwt);
    localStorage.setItem('gate_role', 'gate');
    render(<App />);
    expect(screen.getByTestId('manual-check')).toBeInTheDocument();
  });
});
