import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ManualCheck from './ManualCheck';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { verifyId: vi.fn() },
}));

describe('ManualCheck', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders ID type select and number input', () => {
    render(<ManualCheck onBack={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter ID number')).toBeInTheDocument();
  });

  it('Check button is disabled with empty input', () => {
    render(<ManualCheck onBack={vi.fn()} />);
    expect(screen.getByText('Check')).toBeDisabled();
  });

  it('Check button is disabled for invalid IL_ID (bad checksum)', async () => {
    render(<ManualCheck onBack={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Enter ID number'), '123456789');
    expect(screen.getByText('Check')).toBeDisabled();
  });

  it('Check button is enabled for valid IL_ID', async () => {
    render(<ManualCheck onBack={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Enter ID number'), '000000018');
    expect(screen.getByText('Check')).not.toBeDisabled();
  });

  it('Check button is enabled for valid IDF_ID (7 digits)', async () => {
    render(<ManualCheck onBack={vi.fn()} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'IDF_ID');
    await userEvent.type(screen.getByPlaceholderText('Enter ID number'), '1234567');
    expect(screen.getByText('Check')).not.toBeDisabled();
  });

  it('Check button is enabled for valid IDF_ID (8 digits)', async () => {
    render(<ManualCheck onBack={vi.fn()} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'IDF_ID');
    await userEvent.type(screen.getByPlaceholderText('Enter ID number'), '12345678');
    expect(screen.getByText('Check')).not.toBeDisabled();
  });

  it('strips non-numeric characters from input', async () => {
    render(<ManualCheck onBack={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Enter ID number'), 'ab12cd');
    expect(screen.getByPlaceholderText('Enter ID number')).toHaveValue('12');
  });

  it('calls api.verifyId with correct args and shows verdict on success', async () => {
    api.verifyId.mockResolvedValue({ verdict: 'APPROVED' });
    render(<ManualCheck onBack={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Enter ID number'), '000000018');
    fireEvent.click(screen.getByText('Check'));
    await waitFor(() => expect(screen.getByText('APPROVED')).toBeInTheDocument());
    expect(api.verifyId).toHaveBeenCalledWith('IL_ID', '000000018');
  });

  it('shows NOT APPROVED verdict', async () => {
    api.verifyId.mockResolvedValue({ verdict: 'NOT_APPROVED' });
    render(<ManualCheck onBack={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Enter ID number'), '000000018');
    fireEvent.click(screen.getByText('Check'));
    await waitFor(() => expect(screen.getByText('NOT APPROVED')).toBeInTheDocument());
  });

  it('shows error message on API failure', async () => {
    api.verifyId.mockRejectedValue(new Error('Verification failed'));
    render(<ManualCheck onBack={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Enter ID number'), '000000018');
    fireEvent.click(screen.getByText('Check'));
    await waitFor(() => expect(screen.getByText('Verification failed')).toBeInTheDocument());
  });

  it('returns to form from VerdictDisplay when Back is clicked', async () => {
    api.verifyId.mockResolvedValue({ verdict: 'APPROVED' });
    render(<ManualCheck onBack={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Enter ID number'), '000000018');
    fireEvent.click(screen.getByText('Check'));
    await waitFor(() => screen.getByText('APPROVED'));
    fireEvent.click(screen.getByText('← Back'));
    expect(screen.getByPlaceholderText('Enter ID number')).toBeInTheDocument();
  });

  it('calls onBack when Back button clicked', () => {
    const onBack = vi.fn();
    render(<ManualCheck onBack={onBack} onSwitch={vi.fn()} />);
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalled();
  });

});
