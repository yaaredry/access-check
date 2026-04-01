import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccessRequestForm from './AccessRequestForm';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { submitAccessRequest: vi.fn(), resubmitAccessRequest: vi.fn() },
}));

// A valid date within the allowed 7-day window (tomorrow)
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const FUTURE_DATE = tomorrow.toISOString().split('T')[0];

const TODAY = new Date().toISOString().split('T')[0];
const PAST_DATE_RECENT = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })();

const FAR_FUTURE_DATE = '2099-12-31';
const VALID_ID = '000000018';

function submitForm() {
  fireEvent.submit(document.querySelector('form'));
}

function getExpirationInput() {
  // Start Date is index 0; Expiration Date is index 1
  return document.querySelectorAll('input[type="date"]')[1];
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByPlaceholderText('Your full name'), 'Jane Smith');
  await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
  fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
  await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
}

describe('AccessRequestForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all base fields', () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    expect(screen.getByPlaceholderText('Your full name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('9-digit Israeli ID')).toBeInTheDocument();
    expect(screen.getByText('Population')).toBeInTheDocument();
    expect(screen.getByText('Division (optional)')).toBeInTheDocument();
    expect(screen.getByText('Expiration Date')).toBeInTheDocument();
    expect(screen.getByText('Reason for Entering')).toBeInTheDocument();
    expect(screen.getByText('Submit Request')).toBeInTheDocument();
  });

  it('shows escort fields for IL Military (always visible, optional)', () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    expect(screen.getByPlaceholderText("Escort's full name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+972501234567')).toBeInTheDocument();
    expect(screen.getByText(/Escort Full Name \(optional\)/)).toBeInTheDocument();
    expect(screen.getByText(/Escort Phone \(optional\)/)).toBeInTheDocument();
  });

  it('shows escort fields as required (no optional label) for Civilian', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.selectOptions(screen.getByDisplayValue('IL Military'), 'CIVILIAN');
    expect(screen.getByText('Escort Full Name')).toBeInTheDocument();
    expect(screen.getByText('Escort Phone')).toBeInTheDocument();
    expect(screen.queryByText(/Escort Full Name \(optional\)/)).not.toBeInTheDocument();
  });

  it('shows validation error when Your Name is missing', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => expect(screen.getByText(/Please enter your name/i)).toBeInTheDocument());
  });

  it('shows validation error for invalid IL ID', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), '123456789');
    submitForm();
    await waitFor(() => expect(screen.getByText(/not valid/i)).toBeInTheDocument());
  });

  it('shows validation error when expiration date is missing', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => expect(screen.getByText(/Expiration date is required/)).toBeInTheDocument());
  });

  it('shows validation error when expiration date is more than 7 days ahead', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your full name'), 'Jane Smith');
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(getExpirationInput(), { target: { value: FAR_FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => expect(screen.getByText(/cannot be more than 7 days/i)).toBeInTheDocument());
  });

  it('shows validation error when start date is in the past', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your full name'), 'Jane Smith');
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(document.querySelectorAll('input[type="date"]')[0], { target: { value: PAST_DATE_RECENT } });
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => expect(screen.getByText(/Start date cannot be in the past/i)).toBeInTheDocument());
  });

  it('accepts today as a valid start date', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your full name'), 'Jane Smith');
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(document.querySelectorAll('input[type="date"]')[0], { target: { value: TODAY } });
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => expect(screen.getByText('Request Submitted')).toBeInTheDocument());
    expect(screen.queryByText(/Start date cannot be in the past/i)).not.toBeInTheDocument();
  });

  it('shows expiry error when expiration is before start date', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your full name'), 'Jane Smith');
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    // start date = day after tomorrow, expiry = tomorrow (before start)
    const dayAfterTomorrow = new Date(); dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const DAY_AFTER_TOMORROW = dayAfterTomorrow.toISOString().split('T')[0];
    fireEvent.change(document.querySelectorAll('input[type="date"]')[0], { target: { value: DAY_AFTER_TOMORROW } });
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } }); // tomorrow < day after tomorrow
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => expect(screen.getByText(/Expiration date cannot be before the start date/i)).toBeInTheDocument());
  });

  it('shows expiry error when expiration is more than 7 days from start date', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your full name'), 'Jane Smith');
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(document.querySelectorAll('input[type="date"]')[0], { target: { value: FUTURE_DATE } });
    fireEvent.change(getExpirationInput(), { target: { value: FAR_FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => expect(screen.getByText(/cannot be more than 7 days from the start date/i)).toBeInTheDocument());
  });

  it('shows validation error when reason is missing', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    submitForm();
    await waitFor(() => expect(screen.getByText(/reason for this visit/i)).toBeInTheDocument());
  });

  it('shows validation error for civilian with missing escort name', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    await userEvent.selectOptions(screen.getByDisplayValue('IL Military'), 'CIVILIAN');
    await userEvent.type(screen.getByPlaceholderText('+972501234567'), '+972501234567');
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Visit');
    submitForm();
    await waitFor(() => expect(screen.getByText(/escort full name is required/i)).toBeInTheDocument());
  });

  it('shows validation error for civilian with invalid escort phone', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    await userEvent.selectOptions(screen.getByDisplayValue('IL Military'), 'CIVILIAN');
    await userEvent.type(screen.getByPlaceholderText("Escort's full name"), 'Jane');
    await userEvent.type(screen.getByPlaceholderText('+972501234567'), 'not-a-phone');
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Visit');
    submitForm();
    await waitFor(() => expect(screen.getByText(/only contain digits/i)).toBeInTheDocument());
  });

  it('calls api.submitAccessRequest and shows success screen', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => expect(screen.getByText('Request Submitted')).toBeInTheDocument());
    expect(api.submitAccessRequest).toHaveBeenCalled();
  });

  it('Start Fresh resets form back to empty state', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => screen.getByText('Start Fresh'));
    fireEvent.click(screen.getByText('Start Fresh'));
    expect(screen.getByPlaceholderText('9-digit Israeli ID')).toHaveValue('');
    expect(screen.getByPlaceholderText('Your full name')).toHaveValue('');
  });

  it('success screen shows both Add Another and Start Fresh buttons', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => screen.getByText('Request Submitted'));
    expect(screen.getByText('Add Another Person (Same Details)')).toBeInTheDocument();
    expect(screen.getByText('Start Fresh')).toBeInTheDocument();
  });

  it('Add Another Person keeps details but clears ID', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => screen.getByText('Add Another Person (Same Details)'));
    fireEvent.click(screen.getByText('Add Another Person (Same Details)'));
    expect(screen.getByPlaceholderText('9-digit Israeli ID')).toHaveValue('');
    expect(screen.getByPlaceholderText('Your full name')).toHaveValue('Jane Smith');
    expect(screen.getByPlaceholderText('Describe the reason for entry…')).toHaveValue('Supply run');
  });

  it('Add Another Person clears expiration date', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields(); // sets FUTURE_DATE on expiration
    submitForm();
    await waitFor(() => screen.getByText('Add Another Person (Same Details)'));
    fireEvent.click(screen.getByText('Add Another Person (Same Details)'));
    expect(getExpirationInput()).toHaveValue('');
  });

  it('Add Another Person clears start date when it was set', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    // Also set the start date (index 0)
    const startInput = document.querySelectorAll('input[type="date"]')[0];
    fireEvent.change(startInput, { target: { value: FUTURE_DATE } });
    // Adjust expiration to same day so start <= end
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    submitForm();
    await waitFor(() => screen.getByText('Add Another Person (Same Details)'));
    fireEvent.click(screen.getByText('Add Another Person (Same Details)'));
    expect(document.querySelectorAll('input[type="date"]')[0]).toHaveValue('');
  });

  it('Add Another Person keeps CIVILIAN population and escort details', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Your full name'), 'Jane Smith');
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    await userEvent.selectOptions(screen.getByDisplayValue('IL Military'), 'CIVILIAN');
    await userEvent.type(screen.getByPlaceholderText("Escort's full name"), 'Guard One');
    await userEvent.type(screen.getByPlaceholderText('+972501234567'), '+972501234567');
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Group tour');
    submitForm();
    await waitFor(() => screen.getByText('Add Another Person (Same Details)'));
    fireEvent.click(screen.getByText('Add Another Person (Same Details)'));
    expect(screen.getByDisplayValue('Civilian')).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escort's full name")).toHaveValue('Guard One');
    expect(screen.getByPlaceholderText('+972501234567')).toHaveValue('+972501234567');
    expect(screen.getByPlaceholderText('Describe the reason for entry…')).toHaveValue('Group tour');
  });

  it('Add Another Person clears field errors', async () => {
    // Trigger a field error first, then succeed, then Add Another — errors are gone
    api.submitAccessRequest.mockRejectedValueOnce(
      Object.assign(new Error('Validation failed'), {
        data: { errors: [{ path: 'ilId', msg: 'Invalid IL_ID' }] },
      })
    ).mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => expect(screen.getByText(/not valid/i)).toBeInTheDocument());
    // Fix and resubmit to success
    submitForm();
    await waitFor(() => screen.getByText('Add Another Person (Same Details)'));
    fireEvent.click(screen.getByText('Add Another Person (Same Details)'));
    expect(screen.queryByText(/not valid/i)).not.toBeInTheDocument();
  });

  it('Add Another Person with locked requestorName keeps name locked and clears ID', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} requestorName="Dana Levi" />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Delivery');
    submitForm();
    await waitFor(() => screen.getByText('Add Another Person (Same Details)'));
    fireEvent.click(screen.getByText('Add Another Person (Same Details)'));
    const nameInput = screen.getByPlaceholderText('Your full name');
    expect(nameInput).toHaveValue('Dana Levi');
    expect(nameInput).toBeDisabled();
    expect(screen.getByPlaceholderText('9-digit Israeli ID')).toHaveValue('');
  });

  it('can successfully submit a new ID after clicking Add Another Person', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => screen.getByText('Add Another Person (Same Details)'));
    fireEvent.click(screen.getByText('Add Another Person (Same Details)'));
    // Submit a new ID with the pre-filled details
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), '000000018');
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    submitForm();
    await waitFor(() => expect(screen.getByText('Request Submitted')).toBeInTheDocument());
    expect(api.submitAccessRequest).toHaveBeenCalledTimes(2);
  });

  it('shows general error message on non-field API failure', async () => {
    api.submitAccessRequest.mockRejectedValue(new Error('Server down'));
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => expect(screen.getByText('Server down')).toBeInTheDocument());
  });

  it('shows per-field errors from API response', async () => {
    const err = Object.assign(new Error('Validation failed'), {
      data: { errors: [{ path: 'ilId', msg: 'Invalid IL_ID' }] },
    });
    api.submitAccessRequest.mockRejectedValue(err);
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => expect(screen.getByText(/not valid/i)).toBeInTheDocument());
  });

  it('calls onLogout when Logout is clicked', () => {
    const onLogout = vi.fn();
    render(<AccessRequestForm onLogout={onLogout} />);
    fireEvent.click(screen.getByText('Logout'));
    expect(onLogout).toHaveBeenCalled();
  });

  it('pre-fills and disables the name field when requestorName prop is provided', () => {
    render(<AccessRequestForm onLogout={vi.fn()} requestorName="Dana Levi" />);
    const nameInput = screen.getByPlaceholderText('Your full name');
    expect(nameInput).toHaveValue('Dana Levi');
    expect(nameInput).toBeDisabled();
  });

  it('does not show name validation error when requestorName prop is provided and field is empty', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} requestorName="Dana Levi" />);
    // Don't fill name (it's locked), fill everything else
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => expect(screen.queryByText(/Please enter your name/i)).not.toBeInTheDocument());
  });

  it('retains the locked name after Start Fresh', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} requestorName="Dana Levi" />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => screen.getByText('Start Fresh'));
    fireEvent.click(screen.getByText('Start Fresh'));
    expect(screen.getByPlaceholderText('Your full name')).toHaveValue('Dana Levi');
  });

  it('disables submit button while loading', async () => {
    api.submitAccessRequest.mockImplementation(() => new Promise(() => {}));
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => expect(screen.getByText('Submitting…')).toBeDisabled());
  });
});

// ── helpers for 409 conflict scenarios ───────────────────────────────────────

function make409Error(existing) {
  return Object.assign(new Error('A record for this ID already exists.'), {
    status: 409,
    data: { existing },
  });
}

const PAST_DATE = '2020-01-01T00:00:00.000Z';

describe('AccessRequestForm — resubmit flow', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Button visibility ─────────────────────────────────────────────────────

  it('shows "Resubmit Request" button for a rejected (NOT_APPROVED) record', async () => {
    api.submitAccessRequest.mockRejectedValue(
      make409Error({ id: 42, status: 'NOT_APPROVED', verdict: 'NOT_APPROVED', rejection_reason: 'Denied', approval_expiration: null })
    );
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => expect(screen.getByRole('button', { name: /Resubmit Request/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Request Extension/i })).not.toBeInTheDocument();
  });

  it('shows "Request Extension until [date]" button for an expired approved record', async () => {
    api.submitAccessRequest.mockRejectedValue(
      make409Error({ id: 42, status: 'APPROVED', verdict: 'APPROVED', rejection_reason: null, approval_expiration: PAST_DATE })
    );
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields(); // sets FUTURE_DATE as expiration
    submitForm();
    await waitFor(() => expect(screen.getByRole('button', { name: /Request Extension until/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Resubmit Request/i })).not.toBeInTheDocument();
  });

  it('does NOT show any action button for a PENDING record', async () => {
    api.submitAccessRequest.mockRejectedValue(
      make409Error({ id: 42, status: 'PENDING', verdict: 'NOT_APPROVED', rejection_reason: null, approval_expiration: null })
    );
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Resubmit Request/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request Extension/i })).not.toBeInTheDocument();
  });

  it('does NOT show any action button for an APPROVED record with future expiration', async () => {
    api.submitAccessRequest.mockRejectedValue(
      make409Error({ id: 42, status: 'APPROVED', verdict: 'APPROVED', rejection_reason: null, approval_expiration: FUTURE_DATE + 'T00:00:00.000Z' })
    );
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Resubmit Request/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request Extension/i })).not.toBeInTheDocument();
  });

  // ── Click flow — rejected path ────────────────────────────────────────────

  it('clicking "Resubmit Request" calls resubmitAccessRequest', async () => {
    api.submitAccessRequest.mockRejectedValue(
      make409Error({ id: 42, status: 'NOT_APPROVED', verdict: 'NOT_APPROVED', rejection_reason: null, approval_expiration: null })
    );
    api.resubmitAccessRequest.mockResolvedValue({ id: 42, status: 'PENDING' });

    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => screen.getByRole('button', { name: /Resubmit Request/i }));
    fireEvent.click(screen.getByRole('button', { name: /Resubmit Request/i }));

    await waitFor(() => expect(api.resubmitAccessRequest).toHaveBeenCalledWith(42, expect.any(Object)));
    expect(api.submitAccessRequest).toHaveBeenCalledTimes(1);
  });

  it('shows success screen after clicking "Resubmit Request"', async () => {
    api.submitAccessRequest.mockRejectedValue(
      make409Error({ id: 42, status: 'NOT_APPROVED', verdict: 'NOT_APPROVED', rejection_reason: null, approval_expiration: null })
    );
    api.resubmitAccessRequest.mockResolvedValue({ id: 42, status: 'PENDING' });

    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => screen.getByRole('button', { name: /Resubmit Request/i }));
    fireEvent.click(screen.getByRole('button', { name: /Resubmit Request/i }));

    await waitFor(() => expect(screen.getByText('Request Submitted')).toBeInTheDocument());
  });

  // ── Click flow — expired path ─────────────────────────────────────────────

  it('clicking "Request Extension until [date]" calls resubmitAccessRequest', async () => {
    api.submitAccessRequest.mockRejectedValue(
      make409Error({ id: 42, status: 'APPROVED', verdict: 'APPROVED', rejection_reason: null, approval_expiration: PAST_DATE })
    );
    api.resubmitAccessRequest.mockResolvedValue({ id: 42, status: 'PENDING' });

    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => screen.getByRole('button', { name: /Request Extension until/i }));
    fireEvent.click(screen.getByRole('button', { name: /Request Extension until/i }));

    await waitFor(() => expect(api.resubmitAccessRequest).toHaveBeenCalledWith(42, expect.any(Object)));
    expect(api.submitAccessRequest).toHaveBeenCalledTimes(1);
  });

  it('shows success screen after clicking "Request Extension until [date]"', async () => {
    api.submitAccessRequest.mockRejectedValue(
      make409Error({ id: 42, status: 'APPROVED', verdict: 'APPROVED', rejection_reason: null, approval_expiration: PAST_DATE })
    );
    api.resubmitAccessRequest.mockResolvedValue({ id: 42, status: 'PENDING' });

    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => screen.getByRole('button', { name: /Request Extension until/i }));
    fireEvent.click(screen.getByRole('button', { name: /Request Extension until/i }));

    await waitFor(() => expect(screen.getByText('Request Submitted')).toBeInTheDocument());
  });

  it('shows action button even when the existing record was created by a different requestor', async () => {
    api.submitAccessRequest.mockRejectedValue(
      make409Error({ id: 99, status: 'APPROVED', verdict: 'APPROVED', rejection_reason: null, approval_expiration: PAST_DATE })
    );
    render(<AccessRequestForm onLogout={vi.fn()} requestorName="Bob Jones" />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(getExpirationInput(), { target: { value: FUTURE_DATE } });
    await userEvent.type(screen.getByPlaceholderText('Describe the reason for entry…'), 'Supply run');
    submitForm();
    await waitFor(() => expect(screen.getByRole('button', { name: /Request Extension until/i })).toBeInTheDocument());
  });
});
