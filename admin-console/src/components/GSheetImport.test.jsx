import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GSheetImport from './GSheetImport';

vi.mock('../api/client', () => ({
  api: {
    importGSheet: vi.fn(),
  },
}));

import { api } from '../api/client';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GSheetImport', () => {
  it('renders the URL input and Load button', () => {
    render(<GSheetImport onDone={noop} />);
    expect(screen.getByPlaceholderText(/docs\.google\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument();
  });

  it('shows import result after successful load', async () => {
    api.importGSheet.mockResolvedValue({ inserted: 5, updated: 2, skipped: 1, errors: [], totalRows: 8 });
    render(<GSheetImport onDone={noop} />);

    await userEvent.type(screen.getByRole('textbox'), 'https://docs.google.com/spreadsheets/d/abc123');
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));

    await waitFor(() => {
      expect(screen.getByText(/Import complete/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/5 inserted/i)).toBeInTheDocument();
    expect(screen.getByText(/2 updated/i)).toBeInTheDocument();
    expect(noop).toHaveBeenCalled();
  });

  it('calls onDone after successful import', async () => {
    const onDone = vi.fn();
    api.importGSheet.mockResolvedValue({ inserted: 1, updated: 0, skipped: 0, errors: [], totalRows: 1 });
    render(<GSheetImport onDone={onDone} />);

    await userEvent.type(screen.getByRole('textbox'), 'https://docs.google.com/spreadsheets/d/abc123');
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('shows error message when import fails', async () => {
    api.importGSheet.mockRejectedValue(new Error('Network error'));
    render(<GSheetImport onDone={noop} />);

    await userEvent.type(screen.getByRole('textbox'), 'https://docs.google.com/spreadsheets/d/abc123');
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows skipped count when skipped > 0', async () => {
    api.importGSheet.mockResolvedValue({ inserted: 0, updated: 0, skipped: 3, errors: [], totalRows: 3 });
    render(<GSheetImport onDone={noop} />);

    await userEvent.type(screen.getByRole('textbox'), 'https://docs.google.com/spreadsheets/d/abc123');
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));

    await waitFor(() => {
      expect(screen.getByText(/3 skipped/i)).toBeInTheDocument();
    });
  });

  it('shows error rows when import has errors', async () => {
    api.importGSheet.mockResolvedValue({
      inserted: 0, updated: 0, skipped: 0,
      errors: [{ line: 2, error: 'Invalid ID' }],
      totalRows: 1,
    });
    render(<GSheetImport onDone={noop} />);

    await userEvent.type(screen.getByRole('textbox'), 'https://docs.google.com/spreadsheets/d/abc123');
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));

    await waitFor(() => {
      expect(screen.getByText(/Row 2: Invalid ID/i)).toBeInTheDocument();
    });
  });

  it('disables Load button while loading', async () => {
    let resolve;
    api.importGSheet.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<GSheetImport onDone={noop} />);

    await userEvent.type(screen.getByRole('textbox'), 'https://docs.google.com/spreadsheets/d/abc123');
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));

    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
    resolve({ inserted: 0, updated: 0, skipped: 0, errors: [], totalRows: 0 });
  });
});
