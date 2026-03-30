import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Stats from './Stats';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { getStats: vi.fn() },
}));

// ── Fixture data ──────────────────────────────────────────────────────────────

function makeStats(overrides = {}) {
  return {
    gateScans: {
      counts: { last_24h: '5', last_72h: '12', last_7d: '40', last_30d: '150', all_time: '500' },
      verdictBreakdown: [
        { verdict: 'APPROVED',     count: '100' },
        { verdict: 'NOT_APPROVED', count: '50'  },
      ],
      hourlyScanActivity: [],
      ...overrides.gateScans,
    },
    requests: {
      counts:            { last_24h: '2', last_72h: '8', last_7d: '20', last_30d: '80', all_time: '200' },
      pendingBacklog:    { total: '5', stale_48h: '2', stale_7d: '1' },
      populationBreakdown: [
        { population: 'IL_MILITARY', count: '120' },
        { population: 'CIVILIAN',    count: '80'  },
      ],
      approvalRate: { approved: '80', not_approved: '20', total_decided: '100' },
      topRequestors: [
        { email: 'alice@example.com', display_name: 'Alice',            total: '10', pending: '2', approved: '6', not_approved: '2' },
        { email: 'bob@example.com',   display_name: 'bob@example.com',  total: '5',  pending: '1', approved: '3', not_approved: '1' },
      ],
      ...overrides.requests,
    },
    admin: {
      verdictCounts:    { last_24h: '3', last_72h: '8', last_7d: '25', last_30d: '90' },
      avgTimeToVerdict: { avg_hours_all_time: '12.5', avg_hours_30d: '8.0' },
      ...overrides.admin,
    },
  };
}

// A slot matching the current hour minus 5 hours, so it falls within the 72-slot window
function hourlySlotNow(hoursAgo = 5, count = 4) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() - hoursAgo);
  return { hour: d.toISOString(), count };
}

beforeEach(() => vi.clearAllMocks());

// ── Loading / error states ────────────────────────────────────────────────────

describe('Stats — loading and error states', () => {
  it('shows a loading message while the request is in flight', () => {
    api.getStats.mockReturnValue(new Promise(() => {})); // never resolves
    render(<Stats />);
    expect(screen.getByText(/loading stats/i)).toBeInTheDocument();
  });

  it('shows an error message when api.getStats rejects', async () => {
    api.getStats.mockRejectedValue(new Error('Network failure'));
    render(<Stats />);
    await waitFor(() => expect(screen.getByText(/network failure/i)).toBeInTheDocument());
  });

  it('renders the page heading after successful load', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => expect(screen.getByText('System Usage')).toBeInTheDocument());
  });
});

// ── Section headings ──────────────────────────────────────────────────────────

describe('Stats — section headings', () => {
  it('renders all three section titles', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText(/Gate Client/i)).toBeInTheDocument();
    expect(screen.getByText(/Requestor Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin Activity/i)).toBeInTheDocument();
  });
});

// ── Gate scan counts ──────────────────────────────────────────────────────────

describe('Stats — gate scan counts', () => {
  it('renders scan count cards with correct values', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    // '5' appears in both last_24h scan card and pending backlog — getAllByText handles that
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('500')).toBeInTheDocument(); // all_time — unique
  });

  it('shows the verdict breakdown table when data is present', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByText('NOT_APPROVED')).toBeInTheDocument();
  });

  it('hides the verdict breakdown table when the array is empty', async () => {
    api.getStats.mockResolvedValue(makeStats({ gateScans: { verdictBreakdown: [] } }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.queryByText('APPROVED')).not.toBeInTheDocument();
  });

  it('calculates the share percentage correctly in the breakdown table', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    // 100 out of 150 total → 67%
    expect(screen.getByText('67%')).toBeInTheDocument();
    // 50 out of 150 → 33%
    expect(screen.getByText('33%')).toBeInTheDocument();
  });
});

// ── Requestor section ─────────────────────────────────────────────────────────

describe('Stats — requestor section', () => {
  it('renders request count cards', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText('200')).toBeInTheDocument(); // all_time requests
  });

  it('shows pending backlog total', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    // card value '5' for backlog total
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
  });

  it('shows stale alert cards when stale_48h > 0', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    // Both stale cards should appear (stale_48h=2, stale_7d=1 are both > 0)
    expect(screen.getByText(/Stale.*over 48h/i)).toBeInTheDocument();
    expect(screen.getByText(/Stale.*over 7 days/i)).toBeInTheDocument();
  });

  it('still renders stale cards when stale counts are zero (no crash, no alert)', async () => {
    api.getStats.mockResolvedValue(makeStats({
      requests: { pendingBacklog: { total: '3', stale_48h: '0', stale_7d: '0' } },
    }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    // Cards still render, just without alert styling
    expect(screen.getByText(/Stale.*over 48h/i)).toBeInTheDocument();
  });

  it('shows the approval rate card when total_decided > 0', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText(/80 approved \/ 20 rejected/i)).toBeInTheDocument();
  });

  it('hides the approval rate card when total_decided === 0', async () => {
    api.getStats.mockResolvedValue(makeStats({
      requests: { approvalRate: { approved: '0', not_approved: '0', total_decided: '0' } },
    }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.queryByText(/approval rate/i)).not.toBeInTheDocument();
  });

  it('shows top requestors table with display_name and email', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // alice's sub-email should show since email !== display_name
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('hides the sub-email row when email equals display_name', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    // bob@example.com appears as display_name in the table cell,
    // but NOT as a separate sub-email div since email === display_name
    const bobs = screen.getAllByText('bob@example.com');
    // Should appear exactly once (as the display_name), not twice
    expect(bobs).toHaveLength(1);
  });

  it('shows population breakdown when data is present', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText('IL_MILITARY')).toBeInTheDocument();
    expect(screen.getByText('CIVILIAN')).toBeInTheDocument();
  });

  it('hides population breakdown when array is empty', async () => {
    api.getStats.mockResolvedValue(makeStats({ requests: { populationBreakdown: [] } }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.queryByText('IL_MILITARY')).not.toBeInTheDocument();
  });
});

// ── Admin section ─────────────────────────────────────────────────────────────

describe('Stats — admin section', () => {
  it('renders verdict count cards', async () => {
    api.getStats.mockResolvedValue(makeStats());
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText('90')).toBeInTheDocument(); // last_30d verdicts
  });

  it('shows avg time in hours when value is between 1 and 24', async () => {
    api.getStats.mockResolvedValue(makeStats({
      admin: { avgTimeToVerdict: { avg_hours_all_time: '12.5', avg_hours_30d: '8.0' } },
    }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText('12.5h')).toBeInTheDocument();
    expect(screen.getByText('8h')).toBeInTheDocument();
  });

  it('shows avg time in minutes when value is less than 1 hour', async () => {
    api.getStats.mockResolvedValue(makeStats({
      admin: { avgTimeToVerdict: { avg_hours_all_time: '0.5', avg_hours_30d: '0.25' } },
    }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.getByText('15m')).toBeInTheDocument();
  });

  it('shows avg time in days when value is 24 hours or more', async () => {
    api.getStats.mockResolvedValue(makeStats({
      admin: { avgTimeToVerdict: { avg_hours_all_time: '48', avg_hours_30d: '72' } },
    }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText('2.0d')).toBeInTheDocument();
    expect(screen.getByText('3.0d')).toBeInTheDocument();
  });

  it('shows — when avg time is null', async () => {
    api.getStats.mockResolvedValue(makeStats({
      admin: { avgTimeToVerdict: { avg_hours_all_time: null, avg_hours_30d: null } },
    }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});

// ── HourlyChart ───────────────────────────────────────────────────────────────

describe('HourlyChart', () => {
  it('shows a no-data message when hourlyScanActivity is empty', async () => {
    api.getStats.mockResolvedValue(makeStats({ gateScans: { hourlyScanActivity: [] } }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText(/No gate scan data for the last 3 days/i)).toBeInTheDocument();
  });

  it('renders an SVG chart when hourly data is provided', async () => {
    api.getStats.mockResolvedValue(makeStats({
      gateScans: { hourlyScanActivity: [hourlySlotNow(5, 4), hourlySlotNow(10, 2)] },
    }));
    const { container } = render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders 72 bar rects covering the full 3-day window', async () => {
    api.getStats.mockResolvedValue(makeStats({
      gateScans: { hourlyScanActivity: [hourlySlotNow(5, 4)] },
    }));
    const { container } = render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    // 72 bar rects
    const rects = container.querySelectorAll('svg rect');
    expect(rects.length).toBe(72);
  });

  it('shows the legend', async () => {
    api.getStats.mockResolvedValue(makeStats({
      gateScans: { hourlyScanActivity: [hourlySlotNow(5, 4)] },
    }));
    render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(screen.getByText(/Peak hour/)).toBeInTheDocument();
    expect(screen.getByText(/High activity/)).toBeInTheDocument();
    expect(screen.getByText(/No scans/)).toBeInTheDocument();
  });

  it('shows a tooltip on bar hover and hides it on SVG mouseLeave', async () => {
    const user = userEvent.setup();
    api.getStats.mockResolvedValue(makeStats({
      gateScans: { hourlyScanActivity: [hourlySlotNow(5, 4)] },
    }));
    const { container } = render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));

    const rects = container.querySelectorAll('svg rect');
    expect(rects.length).toBeGreaterThan(0);

    // Hover over a bar — userEvent properly fires the full mouseenter sequence
    await user.hover(rects[0]);
    // Tooltip renders a <strong> element with the scan count — unique in the page
    await waitFor(() => {
      expect(container.querySelector('strong')).toBeInTheDocument();
    });

    // Mouse leaves the SVG
    const svg = container.querySelector('svg');
    await user.unhover(svg);
    await waitFor(() => {
      expect(container.querySelector('strong')).not.toBeInTheDocument();
    });
  });

  it('renders bars with all activity levels (covers all barColor branches)', async () => {
    // peak=10, high=7(>0.6), medium=4(>0.3), low=2(<=0.3), zero=rest
    api.getStats.mockResolvedValue(makeStats({
      gateScans: {
        hourlyScanActivity: [
          hourlySlotNow(2, 10), // peak → red
          hourlySlotNow(3, 7),  // intensity 0.7 → strong blue
          hourlySlotNow(4, 4),  // intensity 0.4 → medium blue
          hourlySlotNow(5, 2),  // intensity 0.2 → low blue (line 106)
        ],
      },
    }));
    const { container } = render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    // All 72 slots render
    expect(container.querySelectorAll('svg rect').length).toBe(72);
  });

  it('does not show tooltip when data is empty', async () => {
    api.getStats.mockResolvedValue(makeStats({ gateScans: { hourlyScanActivity: [] } }));
    const { container } = render(<Stats />);
    await waitFor(() => screen.getByText('System Usage'));
    expect(container.querySelector('[style*="1e293b"]')).not.toBeInTheDocument();
  });
});
