import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PersonForm from './PersonForm';

const noop = vi.fn();

describe('PersonForm', () => {
  it('renders all base fields', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/Identifier Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Identifier Value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Approval Expiration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Population/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Division/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Requester Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason for Visit/i)).toBeInTheDocument();
  });

  it('has IL_ID selected by default', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/Identifier Type/i)).toHaveValue('IL_ID');
  });

  it('has APPROVED selected by default', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/Status/i)).toHaveValue('APPROVED');
  });

  it('has IL_MILITARY selected as default population', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/Population/i)).toHaveValue('IL_MILITARY');
  });

  it('includes ADMIN_APPROVED and PENDING as status options', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    const select = screen.getByLabelText(/Status/i);
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('ADMIN_APPROVED');
    expect(options).toContain('PENDING');
  });

  it('hides escort fields when population is IL_MILITARY', () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    expect(screen.queryByLabelText(/Escort Full Name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Escort Phone/i)).not.toBeInTheDocument();
  });

  it('shows escort fields when population is switched to CIVILIAN', async () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    await userEvent.selectOptions(screen.getByLabelText(/Population/i), 'CIVILIAN');
    expect(screen.getByLabelText(/Escort Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Escort Phone/i)).toBeInTheDocument();
  });

  it('hides escort fields again when switching back from CIVILIAN to IL_MILITARY', async () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    await userEvent.selectOptions(screen.getByLabelText(/Population/i), 'CIVILIAN');
    await userEvent.selectOptions(screen.getByLabelText(/Population/i), 'IL_MILITARY');
    expect(screen.queryByLabelText(/Escort Full Name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Escort Phone/i)).not.toBeInTheDocument();
  });

  it('shows validation error when CIVILIAN and escort name is missing', async () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    await userEvent.selectOptions(screen.getByLabelText(/Population/i), 'CIVILIAN');
    await userEvent.type(screen.getByLabelText(/Escort Phone/i), '+972501234567');
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(screen.getByText(/Escort full name is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when CIVILIAN and escort phone is invalid', async () => {
    render(<PersonForm onSubmit={noop} onCancel={noop} />);
    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    await userEvent.selectOptions(screen.getByLabelText(/Population/i), 'CIVILIAN');
    await userEvent.type(screen.getByLabelText(/Escort Full Name/i), 'Jane Doe');
    await userEvent.type(screen.getByLabelText(/Escort Phone/i), 'not-a-phone');
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(screen.getByText(/Phone number can only contain digits/i)).toBeInTheDocument();
    });
  });

  it('does not require escort fields when population is IL_MILITARY', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<PersonForm onSubmit={onSubmit} onCancel={noop} />);
    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it('populates base fields from initial prop', () => {
    render(<PersonForm initial={{ identifierType: 'IDF_ID', identifierValue: '1234567', verdict: 'NOT_APPROVED', approvalExpiration: '' }} onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText(/Identifier Type/i)).toHaveValue('IDF_ID');
    expect(screen.getByLabelText(/Identifier Value/i)).toHaveValue('1234567');
    expect(screen.getByLabelText(/Status/i)).toHaveValue('NOT_APPROVED');
  });

  it('populates new fields from initial prop', () => {
    render(<PersonForm
      initial={{
        identifierType: 'IL_ID', identifierValue: '000000018', verdict: 'APPROVED',
        population: 'CIVILIAN', division: 'Alpha', escortFullName: 'Jane Doe',
        escortPhone: '+972501234567', reason: 'Visit', requesterName: 'Bob',
      }}
      onSubmit={noop} onCancel={noop}
    />);
    expect(screen.getByLabelText(/Population/i)).toHaveValue('CIVILIAN');
    expect(screen.getByLabelText(/Division/i)).toHaveValue('Alpha');
    expect(screen.getByLabelText(/Escort Full Name/i)).toHaveValue('Jane Doe');
    expect(screen.getByLabelText(/Escort Phone/i)).toHaveValue('+972501234567');
    expect(screen.getByLabelText(/Reason for Visit/i)).toHaveValue('Visit');
    expect(screen.getByLabelText(/Requester Name/i)).toHaveValue('Bob');
  });

  it('calls onSubmit with all new fields', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<PersonForm onSubmit={onSubmit} onCancel={noop} />);

    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    await userEvent.type(screen.getByLabelText(/Division/i), 'Bravo');
    await userEvent.type(screen.getByLabelText(/Requester Name/i), 'Bob');
    await userEvent.type(screen.getByLabelText(/Reason for Visit/i), 'Supply delivery');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        identifierType: 'IL_ID',
        identifierValue: '000000018',
        verdict: 'APPROVED',
        approvalExpiration: null,
        population: 'IL_MILITARY',
        division: 'Bravo',
        requesterName: 'Bob',
        reason: 'Supply delivery',
      }));
    });
  });

  it('calls onSubmit with escort fields when CIVILIAN', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<PersonForm onSubmit={onSubmit} onCancel={noop} />);

    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    await userEvent.selectOptions(screen.getByLabelText(/Population/i), 'CIVILIAN');
    await userEvent.type(screen.getByLabelText(/Escort Full Name/i), 'Jane Doe');
    await userEvent.type(screen.getByLabelText(/Escort Phone/i), '+972501234567');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        population: 'CIVILIAN',
        escortFullName: 'Jane Doe',
        escortPhone: '+972501234567',
      }));
    });
  });

  it('calls onSubmit with ADMIN_APPROVED when that status is selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<PersonForm onSubmit={onSubmit} onCancel={noop} />);

    await userEvent.selectOptions(screen.getByLabelText(/Status/i), 'ADMIN_APPROVED');
    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ verdict: 'ADMIN_APPROVED' }));
    });
  });

  it('calls onSubmit with verdict NOT_APPROVED and status PENDING when Pending Review is selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue();
    render(<PersonForm onSubmit={onSubmit} onCancel={noop} />);

    await userEvent.selectOptions(screen.getByLabelText(/Status/i), 'PENDING');
    await userEvent.type(screen.getByLabelText(/Identifier Value/i), '000000018');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        verdict: 'NOT_APPROVED',
        status: 'PENDING',
      }));
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
