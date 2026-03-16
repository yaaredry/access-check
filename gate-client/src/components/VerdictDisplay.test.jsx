import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VerdictDisplay from './VerdictDisplay';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('VerdictDisplay', () => {
  it('shows APPROVED label and icon', () => {
    render(<VerdictDisplay verdict="APPROVED" onBack={vi.fn()} autoResetMs={0} />);
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows NOT APPROVED label', () => {
    render(<VerdictDisplay verdict="NOT_APPROVED" onBack={vi.fn()} autoResetMs={0} />);
    expect(screen.getByText('NOT APPROVED')).toBeInTheDocument();
    expect(screen.getByText('✕')).toBeInTheDocument();
  });

  it('shows EXPIRED label', () => {
    render(<VerdictDisplay verdict="EXPIRED" onBack={vi.fn()} autoResetMs={0} />);
    expect(screen.getByText('EXPIRED')).toBeInTheDocument();
  });

  it('shows ADMIN APPROVED label with correct icon', () => {
    render(<VerdictDisplay verdict="ADMIN_APPROVED" onBack={vi.fn()} autoResetMs={0} />);
    expect(screen.getByText('ADMIN APPROVED')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('shows NOT FOUND for unknown verdict', () => {
    render(<VerdictDisplay verdict="UNKNOWN_VERDICT" onBack={vi.fn()} autoResetMs={0} />);
    expect(screen.getByText('NOT FOUND')).toBeInTheDocument();
  });

  it('shows NOT FOUND label', () => {
    render(<VerdictDisplay verdict="NOT_FOUND" onBack={vi.fn()} autoResetMs={0} />);
    expect(screen.getByText('NOT FOUND')).toBeInTheDocument();
  });

  it('renders identifierValue when provided', () => {
    render(<VerdictDisplay verdict="APPROVED" identifierValue="000000018" onBack={vi.fn()} autoResetMs={0} />);
    expect(screen.getByText('000000018')).toBeInTheDocument();
  });

  it('does not render identifierValue when omitted', () => {
    render(<VerdictDisplay verdict="APPROVED" onBack={vi.fn()} autoResetMs={0} />);
    expect(screen.queryByText('000000018')).not.toBeInTheDocument();
  });

  it('calls onBack when Back button is clicked', () => {
    const onBack = vi.fn();
    render(<VerdictDisplay verdict="APPROVED" onBack={onBack} autoResetMs={0} />);
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('auto-resets after autoResetMs', () => {
    const onBack = vi.fn();
    render(<VerdictDisplay verdict="APPROVED" onBack={onBack} autoResetMs={3000} />);
    expect(onBack).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not auto-reset when autoResetMs is 0', () => {
    const onBack = vi.fn();
    render(<VerdictDisplay verdict="APPROVED" onBack={onBack} autoResetMs={0} />);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onBack).not.toHaveBeenCalled();
  });

  it('shows auto-reset countdown text', () => {
    render(<VerdictDisplay verdict="APPROVED" onBack={vi.fn()} autoResetMs={8000} />);
    expect(screen.getByText('Auto-reset in 8s')).toBeInTheDocument();
  });
});
