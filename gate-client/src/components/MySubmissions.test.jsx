import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MySubmissions from './MySubmissions';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { getMySubmissions: vi.fn() },
}));

const BASE = {
  id: 1,
  identifier_value: '000000018',
  approval_expiration: null,
  rejection_reason: null,
  created_at: '2024-06-01T10:00:00Z',
  last_resubmitted_at: null,
  population: 'IL_MILITARY',
  division: null,
  escort_full_name: null,
  escort_phone: null,
  reason: 'Supply run',
};

const PENDING_ROW    = { ...BASE, id: 1, identifier_value: '000000018', status: 'PENDING',       verdict: 'NOT_APPROVED' };
const ADMIN_APPROVED_ROW = { ...BASE, id: 2, identifier_value: '000000026', status: 'APPROVED', verdict: 'ADMIN_APPROVED',       approval_expiration: '2099-12-31' };
const ESCORT_ROW     = { ...BASE, id: 3, identifier_value: '000000034', status: 'APPROVED',      verdict: 'APPROVED_WITH_ESCORT', approval_expiration: '2099-12-31' };
const PLAIN_APPROVED_ROW = { ...BASE, id: 4, identifier_value: '000000042', status: null,        verdict: 'APPROVED' };
const REJECTED_ROW   = { ...BASE, id: 5, identifier_value: '000000059', status: 'NOT_APPROVED',  verdict: 'NOT_APPROVED', rejection_reason: 'No valid clearance on file' };
const REJECTED_VIA_FORM_ROW = { ...BASE, id: 6, identifier_value: '000000067', status: null,     verdict: 'NOT_APPROVED', rejection_reason: 'Flagged by security' };
const EXPIRED_ROW    = { ...BASE, id: 7, identifier_value: '000000075', status: 'APPROVED',      verdict: 'APPROVED', approval_expiration: '2000-01-01' };

const ALL_ROWS = [PENDING_ROW, ADMIN_APPROVED_ROW, ESCORT_ROW, PLAIN_APPROVED_ROW, REJECTED_ROW, REJECTED_VIA_FORM_ROW, EXPIRED_ROW];

describe('MySubmissions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading state initially', () => {
    api.getMySubmissions.mockImplementation(() => new Promise(() => {}));
    render(<MySubmissions />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows empty state when no submissions', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('No submissions yet.')).toBeInTheDocument());
  });

  it('renders Pending Review for PENDING status', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000018')).toBeInTheDocument());
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('renders Admin Approved for ADMIN_APPROVED verdict', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [ADMIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000026')).toBeInTheDocument());
    expect(screen.getByText('Admin Approved')).toBeInTheDocument();
  });

  it('renders Approved with Escort for APPROVED_WITH_ESCORT verdict', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [ESCORT_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000034')).toBeInTheDocument());
    expect(screen.getByText('Approved with Escort')).toBeInTheDocument();
  });

  it('renders Approved for plain APPROVED verdict with no status', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PLAIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000042')).toBeInTheDocument());
    // Badge is a <span>; filter chip is a <button>
    expect(screen.getAllByText('Approved').some(el => el.tagName === 'SPAN')).toBe(true);
  });

  it('renders Rejected for NOT_APPROVED status with rejection reason', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [REJECTED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000059')).toBeInTheDocument());
    expect(screen.getAllByText('Rejected').some(el => el.tagName === 'SPAN')).toBe(true);
    expect(screen.getByText('No valid clearance on file')).toBeInTheDocument();
  });

  it('renders Rejected when verdict is NOT_APPROVED with no status (rejected via form)', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [REJECTED_VIA_FORM_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('000000067')).toBeInTheDocument());
    expect(screen.getAllByText('Rejected').some(el => el.tagName === 'SPAN')).toBe(true);
    expect(screen.getByText('Flagged by security')).toBeInTheDocument();
  });

  it('shows Expired when approval_expiration is in the past', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [EXPIRED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Expired')).toBeInTheDocument());
  });

  it('does not show Expired when approval_expiration is in the future', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [ADMIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getAllByText('Admin Approved').some(el => el.tagName === 'SPAN')).toBe(true));
    // Only the filter chip (button) should say "Expired" — no badge span
    expect(screen.queryAllByText('Expired').every(el => el.tagName === 'BUTTON')).toBe(true);
  });

  it('shows expiry warning when approval_expiration is exactly today', async () => {
    const today = new Date().toISOString().split('T')[0];
    const row = { ...ADMIN_APPROVED_ROW, approval_expiration: today };
    api.getMySubmissions.mockResolvedValue({ rows: [row] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText(/Expires in 1 day/)).toBeInTheDocument());
  });

  it('shows expiry warning when approval_expiration is in 2 days', async () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const row = { ...ADMIN_APPROVED_ROW, approval_expiration: soon };
    api.getMySubmissions.mockResolvedValue({ rows: [row] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText(/Expires in 2 days/)).toBeInTheDocument());
  });

  it('does not show expiry warning when approval_expiration is 3 days away', async () => {
    const later = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const row = { ...ADMIN_APPROVED_ROW, approval_expiration: later };
    api.getMySubmissions.mockResolvedValue({ rows: [row] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Admin Approved')).toBeInTheDocument());
    expect(screen.queryByText(/Expires in/)).not.toBeInTheDocument();
  });

  it('PENDING is not treated as rejected despite having NOT_APPROVED verdict', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Pending Review')).toBeInTheDocument());
    // Only the filter chip (button) should say "Rejected" — no badge span
    expect(screen.queryAllByText('Rejected').every(el => el.tagName === 'BUTTON')).toBe(true);
  });

  it('shows error state and Try Again button on API failure', async () => {
    api.getMySubmissions.mockRejectedValue(new Error('Network error'));
    render(<MySubmissions />);
    await waitFor(() => expect(screen.getByText('Could not load submissions. Please try again.')).toBeInTheDocument());
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('reloads when Refresh is clicked', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('Refresh'));
    fireEvent.click(screen.getByText('Refresh'));
    expect(api.getMySubmissions).toHaveBeenCalledTimes(2);
  });

  it('reloads when Try Again is clicked after error', async () => {
    api.getMySubmissions
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('Try Again'));
    fireEvent.click(screen.getByText('Try Again'));
    await waitFor(() => expect(screen.getByText('No submissions yet.')).toBeInTheDocument());
  });
});

// ── Filter chips ─────────────────────────────────────────────────────────────

describe('MySubmissions — filter chips', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders all five filter chips', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('No submissions yet.'));
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('All chip is active by default', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('No submissions yet.'));
    expect(screen.getByText('All')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Expired filter shows only expired entries', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: ALL_ROWS });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018')); // all loaded
    fireEvent.click(screen.getByRole('button', { name: 'Expired' }));
    expect(screen.getByText('000000075')).toBeInTheDocument(); // expired
    expect(screen.queryByText('000000018')).not.toBeInTheDocument(); // pending
    expect(screen.queryByText('000000026')).not.toBeInTheDocument(); // admin approved
  });

  it('Pending filter shows only pending entries', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: ALL_ROWS });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.getByText('000000018')).toBeInTheDocument();
    expect(screen.queryByText('000000026')).not.toBeInTheDocument();
    expect(screen.queryByText('000000075')).not.toBeInTheDocument();
  });

  it('Approved filter shows non-expired approved entries only', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: ALL_ROWS });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
    expect(screen.getByText('000000026')).toBeInTheDocument(); // admin approved
    expect(screen.getByText('000000034')).toBeInTheDocument(); // escort
    expect(screen.getByText('000000042')).toBeInTheDocument(); // plain approved
    expect(screen.queryByText('000000075')).not.toBeInTheDocument(); // expired — must be excluded
    expect(screen.queryByText('000000018')).not.toBeInTheDocument(); // pending
  });

  it('Rejected filter shows only rejected entries', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: ALL_ROWS });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByRole('button', { name: 'Rejected' }));
    expect(screen.getByText('000000059')).toBeInTheDocument();
    expect(screen.getByText('000000067')).toBeInTheDocument();
    expect(screen.queryByText('000000018')).not.toBeInTheDocument(); // pending
    expect(screen.queryByText('000000026')).not.toBeInTheDocument(); // approved
  });

  it('shows "No expired submissions" when Expired filter has no matches', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByRole('button', { name: 'Expired' }));
    expect(screen.getByText('No expired submissions.')).toBeInTheDocument();
  });

  it('shows "No pending submissions" when Pending filter has no matches', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [EXPIRED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000075'));
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.getByText('No pending submissions.')).toBeInTheDocument();
  });

  it('active filter chip has aria-pressed true, others false', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('No submissions yet.'));
    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));
    expect(screen.getByRole('button', { name: 'Pending' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Expired' })).toHaveAttribute('aria-pressed', 'false');
  });
});

// ── Sort order ────────────────────────────────────────────────────────────────

describe('MySubmissions — sort order', () => {
  beforeEach(() => vi.clearAllMocks());

  it('expired entries appear before non-expired entries', async () => {
    // API returns pending first, expired second (created_at order)
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW, EXPIRED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));

    // The expired row (000000075) must appear before the pending row (000000018)
    const allText = document.body.textContent;
    expect(allText.indexOf('000000075')).toBeLessThan(allText.indexOf('000000018'));
  });

  it('non-expired entries preserve API order (created_at DESC) among themselves', async () => {
    // Two non-expired rows: pending (id 1), admin approved (id 2) — as returned by API
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW, ADMIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    const allText = document.body.textContent;
    expect(allText.indexOf('000000018')).toBeLessThan(allText.indexOf('000000026'));
  });

  it('multiple expired entries all appear before any non-expired entries', async () => {
    const expiredTwo = { ...EXPIRED_ROW, id: 8, identifier_value: '000000083' };
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW, EXPIRED_ROW, expiredTwo] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    const allText = document.body.textContent;
    expect(allText.indexOf('000000075')).toBeLessThan(allText.indexOf('000000018'));
    expect(allText.indexOf('000000083')).toBeLessThan(allText.indexOf('000000018'));
  });
});

// ── Extend on click ───────────────────────────────────────────────────────────

describe('MySubmissions — extend on click', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Tap to request extension" hint on expired cards when onExtend is provided', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [EXPIRED_ROW] });
    render(<MySubmissions onExtend={vi.fn()} />);
    await waitFor(() => screen.getByText('Expired'));
    expect(screen.getByText(/Tap to request extension/)).toBeInTheDocument();
  });

  it('does NOT show extend hint when onExtend prop is not provided', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [EXPIRED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('Expired'));
    expect(screen.queryByText(/Tap to request extension/)).not.toBeInTheDocument();
  });

  it('calls onExtend with the row when an expired card is clicked', async () => {
    const onExtend = vi.fn();
    api.getMySubmissions.mockResolvedValue({ rows: [EXPIRED_ROW] });
    render(<MySubmissions onExtend={onExtend} />);
    await waitFor(() => screen.getByText('000000075'));
    fireEvent.click(screen.getByText('000000075'));
    expect(onExtend).toHaveBeenCalledWith(EXPIRED_ROW);
  });

  it('does not call onExtend when a non-expired card is clicked', async () => {
    const onExtend = vi.fn();
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions onExtend={onExtend} />);
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.click(screen.getByText('000000018'));
    expect(onExtend).not.toHaveBeenCalled();
  });

  it('calls onExtend with the correct row when multiple rows exist', async () => {
    const onExtend = vi.fn();
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW, EXPIRED_ROW] });
    render(<MySubmissions onExtend={onExtend} />);
    await waitFor(() => screen.getByText('000000075'));
    fireEvent.click(screen.getByText('000000075'));
    expect(onExtend).toHaveBeenCalledWith(EXPIRED_ROW);
    expect(onExtend).toHaveBeenCalledTimes(1);
  });
});

// ── Dates display ─────────────────────────────────────────────────────────────

describe('MySubmissions — dates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Submitted date from created_at', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    expect(screen.getByText(/Submitted/)).toBeInTheDocument();
  });

  it('shows Extended date when last_resubmitted_at is set', async () => {
    const row = { ...EXPIRED_ROW, last_resubmitted_at: '2025-03-10T08:00:00Z' };
    api.getMySubmissions.mockResolvedValue({ rows: [row] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000075'));
    expect(screen.getByText(/Extended/)).toBeInTheDocument();
  });

  it('does not show Extended when last_resubmitted_at is null', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    expect(screen.queryByText(/Extended/)).not.toBeInTheDocument();
  });
});

// ── Division display ──────────────────────────────────────────────────────────

describe('MySubmissions — division', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows division when present', async () => {
    const row = { ...PENDING_ROW, division: 'Alpha Unit' };
    api.getMySubmissions.mockResolvedValue({ rows: [row] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    expect(screen.getByText('Alpha Unit')).toBeInTheDocument();
  });

  it('does not show division when null', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] }); // division: null
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    expect(screen.queryByText('Alpha Unit')).not.toBeInTheDocument();
  });

  it('does not show division when empty string — same rendered output as null', async () => {
    // With division = '', the conditional {row.division && ...} is falsy → no division element
    const withEmpty = { ...PENDING_ROW, division: '' };
    api.getMySubmissions.mockResolvedValue({ rows: [withEmpty] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    // The card should render without any visible division text
    // Walk up to the card element and check no leaf node has empty-string text content
    const idEl = screen.getByText('000000018');
    const card = idEl.closest('[style]')?.parentElement;
    if (card) {
      const emptyLeaves = Array.from(card.querySelectorAll('*')).filter(
        el => el.childElementCount === 0 && el.textContent === ''
      );
      expect(emptyLeaves).toHaveLength(0);
    }
  });
});

// ── Search ────────────────────────────────────────────────────────────────────

describe('MySubmissions — search', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the search input', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('No submissions yet.'));
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('filters cards by ID as user types', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW, ADMIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '26' } });
    expect(screen.getByText('000000026')).toBeInTheDocument();
    expect(screen.queryByText('000000018')).not.toBeInTheDocument();
  });

  it('shows all cards when search is cleared', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW, ADMIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '26' } });
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    expect(screen.getByText('000000018')).toBeInTheDocument();
    expect(screen.getByText('000000026')).toBeInTheDocument();
  });

  it('shows "No results for..." message when search has no matches', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '999' } });
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });

  it('search and filter work together — only shows rows matching both', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW, ADMIN_APPROVED_ROW, EXPIRED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    // Filter to Expired, then search for '075'
    fireEvent.click(screen.getByRole('button', { name: 'Expired' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '075' } });
    expect(screen.getByText('000000075')).toBeInTheDocument();
    expect(screen.queryByText('000000018')).not.toBeInTheDocument();
    expect(screen.queryByText('000000026')).not.toBeInTheDocument();
  });

  it('search ignores leading/trailing whitespace', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW, ADMIN_APPROVED_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  26  ' } });
    expect(screen.getByText('000000026')).toBeInTheDocument();
    expect(screen.queryByText('000000018')).not.toBeInTheDocument();
  });
});

// ── Hidden records banner ─────────────────────────────────────────────────────

describe('MySubmissions — hidden records banner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not show the banner when hiddenCount is 0', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW], hiddenCount: 0 });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    expect(screen.queryByText(/not shown/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show all' })).not.toBeInTheDocument();
  });

  it('does not show the banner when hiddenCount is absent from the API response', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW] });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    expect(screen.queryByText(/not shown/)).not.toBeInTheDocument();
  });

  it('shows the banner with the correct count when hiddenCount > 0', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW], hiddenCount: 3 });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    expect(screen.getByText(/3 older records not shown/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument();
  });

  it('uses singular "record" when hiddenCount is 1', async () => {
    api.getMySubmissions.mockResolvedValue({ rows: [PENDING_ROW], hiddenCount: 1 });
    render(<MySubmissions />);
    await waitFor(() => screen.getByText('000000018'));
    expect(screen.getByText(/1 older record not shown/)).toBeInTheDocument();
    expect(screen.queryByText(/records not shown/)).not.toBeInTheDocument();
  });

  it('clicking Show all calls getMySubmissions(true) and shows previously hidden records', async () => {
    const STALE_ROW = { ...BASE, id: 99, identifier_value: '000000091', status: 'APPROVED', verdict: 'APPROVED', approval_expiration: '2020-01-01' };
    api.getMySubmissions
      .mockResolvedValueOnce({ rows: [PENDING_ROW], hiddenCount: 1 })
      .mockResolvedValueOnce({ rows: [PENDING_ROW, STALE_ROW], hiddenCount: 0 });
    render(<MySubmissions />);
    await waitFor(() => screen.getByRole('button', { name: 'Show all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    await waitFor(() => screen.getByText('000000091'));
    expect(api.getMySubmissions).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: 'Show all' })).not.toBeInTheDocument();
  });

  it('Refresh resets back to the filtered view', async () => {
    const STALE_ROW = { ...BASE, id: 99, identifier_value: '000000091', status: 'APPROVED', verdict: 'APPROVED', approval_expiration: '2020-01-01' };
    api.getMySubmissions
      .mockResolvedValueOnce({ rows: [PENDING_ROW], hiddenCount: 1 })
      .mockResolvedValueOnce({ rows: [PENDING_ROW, STALE_ROW], hiddenCount: 0 })
      .mockResolvedValueOnce({ rows: [PENDING_ROW], hiddenCount: 1 });
    render(<MySubmissions />);
    await waitFor(() => screen.getByRole('button', { name: 'Show all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    await waitFor(() => screen.getByText('000000091'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(screen.queryByText('000000091')).not.toBeInTheDocument());
    expect(screen.getByText(/1 older record not shown/)).toBeInTheDocument();
  });
});
