import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PersonForm from './PersonForm';

const noop = vi.fn();

describe('PersonForm', () => {
  it('renders all fields', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/Identifier Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Identifier Value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Verdict/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Approval Expiration/i)).toBeInTheDocument();
  });

  it('has IL_ID selected by default', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/Identifier Type/i)).toHaveValue('IL_ID');
  });

  it('has APPROVED selected by default', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/Verdict/i)).toHaveValue('APPROVED');
  });

  it('includes ADMIN_APPROVED as a verdict option', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    const select = screen.getByLabelText(/Verdict/i);
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('ADMIN_APPROVED');
  });

  it('populates fields from initial prop', () => {
    render(<PersonForm initial={{ identifierType: 'IDF_ID', identifierValue: '1234567', verdict: 'NOT_APPROVED', approvalExpiration: '' }} onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/Identifier Type/i)).toHaveValue('IDF_ID');
    expect(screen.getByLabelText(/Identifier Value/i)).toHaveValue('1234567');
    expect(screen.getByLabelText(/Verdict/i)).toHaveValue('NOT_APPROVED');
  });

  it('calls onSubmit with form data when Save is clicked', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<PersonForm onSubmit={onSubmit} onCancel={noop} />);

    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        identifierType: 'IL_ID',
        identifierValue: '000000018',
        verdict: 'APPROVED',
        approvalExpiration: null,
      }));
    });
  });

  it('calls onSubmit with ADMIN_APPROVED when that verdict is selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<PersonForm onSubmit={onSubmit} onCancel={noop} />);

    await userEvent.selectOptions(screen.getByLabelText(/Verdict/i), 'ADMIN_APPROVED');
    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'ADMIN_APPROVED' }));
    });
  });

  it('shows error message when onSubmit rejects', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Server error'));
    render(<PersonForm onSubmit={onSubmit} onCancel={noop} />);

    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<PersonForm onSubmit={noop} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables buttons while loading', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} loading={true} />);
    expect(screen.getByText('Saving…')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
  });
});
