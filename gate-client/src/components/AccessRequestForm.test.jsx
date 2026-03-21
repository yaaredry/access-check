import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AccessRequestForm from './AccessRequestForm';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { submitAccessRequest: vi.fn() },
}));

const FUTURE_DATE = '2099-12-31';
const VALID_ID = '000000018';

function submitForm() {
  fireEvent.submit(document.querySelector('form'));
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByPlaceholderText('Your full name'), 'Jane Smith');
  await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
  fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: FUTURE_DATE } });
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

  it('hides escort fields when population is IL Military', () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    expect(screen.queryByPlaceholderText("Escort's full name")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('+972501234567')).not.toBeInTheDocument();
  });

  it('shows escort fields when population is Civilian', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.selectOptions(screen.getByDisplayValue('IL Military'), 'CIVILIAN');
    expect(screen.getByPlaceholderText("Escort's full name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+972501234567')).toBeInTheDocument();
  });

  it('shows validation error when Your Name is missing', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: FUTURE_DATE } });
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

  it('shows validation error when reason is missing', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: FUTURE_DATE } });
    submitForm();
    await waitFor(() => expect(screen.getByText(/reason for this visit/i)).toBeInTheDocument());
  });

  it('shows validation error for civilian with missing escort name', async () => {
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('9-digit Israeli ID'), VALID_ID);
    await userEvent.selectOptions(screen.getByDisplayValue('IL Military'), 'CIVILIAN');
    await userEvent.type(screen.getByPlaceholderText('+972501234567'), '+972501234567');
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: FUTURE_DATE } });
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
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: FUTURE_DATE } });
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

  it('Submit Another resets form back to empty state', async () => {
    api.submitAccessRequest.mockResolvedValue({});
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => screen.getByText('Submit Another'));
    fireEvent.click(screen.getByText('Submit Another'));
    expect(screen.getByPlaceholderText('9-digit Israeli ID')).toHaveValue('');
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

  it('disables submit button while loading', async () => {
    api.submitAccessRequest.mockImplementation(() => new Promise(() => {}));
    render(<AccessRequestForm onLogout={vi.fn()} />);
    await fillRequiredFields();
    submitForm();
    await waitFor(() => expect(screen.getByText('Submitting…')).toBeDisabled());
  });
});
