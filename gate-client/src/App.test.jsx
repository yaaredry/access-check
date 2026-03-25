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
  default: ({ onBack, onSwitch }) => (
    <div data-testid="manual-check">
      <button onClick={onBack}>ManualBack</button>
      <button onClick={onSwitch}>ManualSwitch</button>
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
  default: () => <div data-testid="my-submissions" />,
}));

describe('App', () => {
  beforeEach(() => localStorage.clear());

  it('shows Login when not authenticated', () => {
    render(<App />);
    expect(screen.getByText('Login as gate')).toBeInTheDocument();
  });

  it('shows home screen after gate login', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => expect(screen.getByText(/Scan ID Card/)).toBeInTheDocument());
    expect(screen.getByText(/Enter ID Manually/)).toBeInTheDocument();
  });

  it('shows AccessRequestForm for access_requestor role', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as requestor'));
    await waitFor(() => expect(screen.getByTestId('access-request-form')).toBeInTheDocument());
  });

  it('shows ManualCheck when Enter ID Manually is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByText(/Enter ID Manually/));
    fireEvent.click(screen.getByText(/Enter ID Manually/));
    expect(screen.getByTestId('manual-check')).toBeInTheDocument();
  });

  it('shows CameraCheck when Scan ID Card is clicked', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByText(/Scan ID Card/));
    fireEvent.click(screen.getByText(/Scan ID Card/));
    expect(screen.getByTestId('camera-check')).toBeInTheDocument();
  });

  it('returns to home from ManualCheck via Back', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByText(/Enter ID Manually/));
    fireEvent.click(screen.getByText(/Enter ID Manually/));
    fireEvent.click(screen.getByText('ManualBack'));
    expect(screen.getByText(/Scan ID Card/)).toBeInTheDocument();
  });

  it('returns to home from CameraCheck via Back', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByText(/Scan ID Card/));
    fireEvent.click(screen.getByText(/Scan ID Card/));
    fireEvent.click(screen.getByText('CameraBack'));
    expect(screen.getByText(/Enter ID Manually/)).toBeInTheDocument();
  });

  it('switches from ManualCheck to CameraCheck via switch button', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByText(/Enter ID Manually/));
    fireEvent.click(screen.getByText(/Enter ID Manually/));
    fireEvent.click(screen.getByText('ManualSwitch'));
    expect(screen.getByTestId('camera-check')).toBeInTheDocument();
  });

  it('switches from CameraCheck to ManualCheck via switch button', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByText(/Scan ID Card/));
    fireEvent.click(screen.getByText(/Scan ID Card/));
    fireEvent.click(screen.getByText('CameraSwitch'));
    expect(screen.getByTestId('manual-check')).toBeInTheDocument();
  });

  it('logs out from home and shows Login', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Login as gate'));
    await waitFor(() => screen.getByText('Logout'));
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
    localStorage.setItem('gate_token', 'existing-token');
    localStorage.setItem('gate_role', 'gate');
    render(<App />);
    expect(screen.getByText(/Scan ID Card/)).toBeInTheDocument();
  });
});
