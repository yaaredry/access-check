import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';

const VERDICT_COLORS = {
  APPROVED: '#22c55e',
  ADMIN_APPROVED: '#86efac',
  APPROVED_WITH_ESCORT: '#fbbf24',
  NOT_APPROVED: '#ef4444',
  EXPIRED: '#f97316',
  NOT_FOUND: '#94a3b8',
  PENDING: '#60a5fa',
};

const s = {
  page: { maxWidth: 960, margin: '0 auto' },
  heading: { fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 4 },
  subheading: { fontSize: 13, color: '#64748b', marginBottom: 24 },
  section: { marginBottom: 40 },
  sectionTitle: {
    fontSize: 15, fontWeight: 700, color: '#1e293b',
    borderBottom: '2px solid #e2e8f0', paddingBottom: 8, marginBottom: 16,
  },
  cardRow: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 },
  card: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '16px 20px', minWidth: 130, flex: '1 1 130px',
  },
  cardLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  cardValue: { fontSize: 26, fontWeight: 700, color: '#0f172a' },
  cardSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  alertCard: {
    background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8,
    padding: '16px 20px', minWidth: 130, flex: '1 1 130px',
  },
  alertValue: { fontSize: 26, fontWeight: 700, color: '#c2410c' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '8px 12px',
    background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
    color: '#475569', fontWeight: 600, fontSize: 12,
  },
  td: { padding: '8px 12px', borderBottom: '1px solid #f1f5f9', color: '#1e293b' },
  badge: (verdict) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    background: (VERDICT_COLORS[verdict] || '#94a3b8') + '22',
    color: VERDICT_COLORS[verdict] || '#64748b',
    fontSize: 12, fontWeight: 600,
  }),
  row2: { display: 'flex', gap: 24, flexWrap: 'wrap' },
  half: { flex: '1 1 300px' },
  error: { color: '#ef4444', padding: '20px 0' },
  spinner: { color: '#64748b', padding: '40px 0', textAlign: 'center' },
};

// ---------------------------------------------------------------------------
// Hourly activity bar chart (pure SVG, no dependencies)
// ---------------------------------------------------------------------------

const CHART_H = 120;   // px height of bar area
const BAR_W   = 9;     // px width of each bar
const BAR_GAP = 2;     // px gap between bars

function HourlyChart({ data }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);

  if (!data || data.length === 0) {
    return <div style={{ color: '#94a3b8', fontSize: 13, padding: '16px 0' }}>No gate scan data for the last 3 days.</div>;
  }

  // Build a complete slot array covering the past 3 days (72 hours), filling gaps with 0
  const now = new Date();
  const slots = [];
  for (let i = 71; i >= 0; i--) {
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - i);
    slots.push({ hour: d, count: 0 });
  }
  data.forEach(({ hour, count }) => {
    const t = new Date(hour);
    t.setMinutes(0, 0, 0);
    const idx = slots.findIndex(s => s.hour.getTime() === t.getTime());
    if (idx !== -1) slots[idx].count = count;
  });

  const maxCount = Math.max(...slots.map(s => s.count), 1);
  const peakCount = Math.max(...slots.map(s => s.count));

  const totalW = slots.length * (BAR_W + BAR_GAP);
  const svgW = totalW + 40; // 40px left margin for y-axis
  const svgH = CHART_H + 36; // 36px bottom for x labels

  // Day boundary indices
  const dayBoundaries = [];
  slots.forEach((s, i) => {
    if (i === 0 || s.hour.getHours() === 0) dayBoundaries.push(i);
  });

  function barColor(count) {
    if (count === 0) return '#e2e8f0';
    if (count === peakCount && peakCount > 0) return '#ef4444';
    const intensity = count / maxCount;
    if (intensity > 0.6) return '#3b82f6';
    if (intensity > 0.3) return '#93c5fd';
    return '#bfdbfe';
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y-axis labels */}
        {[0, Math.round(maxCount / 2), maxCount].map((v, i) => {
          const y = CHART_H - (v / maxCount) * CHART_H;
          return (
            <g key={i}>
              <line x1={36} y1={y} x2={svgW} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={32} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
            </g>
          );
        })}

        {/* Day separator lines + labels */}
        {dayBoundaries.map((idx) => {
          const x = 40 + idx * (BAR_W + BAR_GAP);
          const label = slots[idx].hour.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
          return (
            <g key={idx}>
              <line x1={x} y1={0} x2={x} y2={CHART_H} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
              <text x={x + 3} y={svgH - 4} fontSize="9" fill="#64748b">{label}</text>
            </g>
          );
        })}

        {/* Bars */}
        {slots.map((slot, i) => {
          const x = 40 + i * (BAR_W + BAR_GAP);
          const barH = Math.max((slot.count / maxCount) * CHART_H, slot.count > 0 ? 2 : 0);
          const y = CHART_H - barH;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={BAR_W}
              height={barH}
              fill={barColor(slot.count)}
              rx={2}
              style={{ cursor: slot.count > 0 ? 'pointer' : 'default' }}
              onMouseEnter={(e) => {
                const rect = svgRef.current?.getBoundingClientRect();
                if (!rect) return;
                setTooltip({
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top - 36,
                  slot,
                });
              }}
            />
          );
        })}

        {/* Hour tick labels every 6 hours */}
        {slots.map((slot, i) => {
          const h = slot.hour.getHours();
          if (h % 6 !== 0) return null;
          const x = 40 + i * (BAR_W + BAR_GAP) + BAR_W / 2;
          return (
            <text key={i} x={x} y={CHART_H + 13} textAnchor="middle" fontSize="8" fill="#94a3b8">
              {String(h).padStart(2, '0')}:00
            </text>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 10,
          top: tooltip.y,
          background: '#1e293b',
          color: '#fff',
          fontSize: 11,
          padding: '4px 8px',
          borderRadius: 4,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
        }}>
          {tooltip.slot.hour.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          <br />
          <strong>{tooltip.slot.count} scan{tooltip.slot.count !== 1 ? 's' : ''}</strong>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b', marginTop: 6 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />Peak hour</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#3b82f6', borderRadius: 2, marginRight: 4 }} />High activity</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#bfdbfe', borderRadius: 2, marginRight: 4 }} />Low activity</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#e2e8f0', borderRadius: 2, marginRight: 4 }} />No scans</span>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, alert }) {
  return (
    <div style={alert ? s.alertCard : s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={alert ? s.alertValue : s.cardValue}>{value ?? '—'}</div>
      {sub && <div style={s.cardSub}>{sub}</div>}
    </div>
  );
}

function fmtHours(h) {
  if (h == null) return '—';
  const n = parseFloat(h);
  if (n < 1) return `${Math.round(n * 60)}m`;
  if (n < 24) return `${n}h`;
  return `${(n / 24).toFixed(1)}d`;
}

export default function Stats() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getStats();
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div style={s.spinner}>Loading stats…</div>;
  if (error) return <div style={s.error}>{error}</div>;

  const { gateScans, requests, admin } = data;

  return (
    <div style={s.page}>
      <div style={s.heading}>System Usage</div>
      <div style={s.subheading}>Live snapshot — refresh to update</div>

      {/* ── Section 1: Gate Client ───────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Gate Client — Scan Activity</div>
        <div style={s.cardRow}>
          <StatCard label="Last 24 hours" value={gateScans.counts.last_24h} />
          <StatCard label="Last 72 hours" value={gateScans.counts.last_72h} />
          <StatCard label="Last 7 days"   value={gateScans.counts.last_7d} />
          <StatCard label="Last 30 days"  value={gateScans.counts.last_30d} />
          <StatCard label="All time"      value={gateScans.counts.all_time} />
        </div>

        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, marginTop: 4 }}>
          Hourly activity — last 3 days
        </div>
        <HourlyChart data={gateScans.hourlyScanActivity} />

        {gateScans.verdictBreakdown.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              Verdict breakdown — last 30 days
            </div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Verdict</th>
                  <th style={s.th}>Scans</th>
                  <th style={s.th}>Share</th>
                </tr>
              </thead>
              <tbody>
                {gateScans.verdictBreakdown.map(({ verdict, count }) => {
                  const total = gateScans.verdictBreakdown.reduce((a, r) => a + Number(r.count), 0);
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <tr key={verdict}>
                      <td style={s.td}><span style={s.badge(verdict)}>{verdict}</span></td>
                      <td style={s.td}>{count}</td>
                      <td style={s.td}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── Section 2: Requestors ────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Requestor Activity</div>
        <div style={s.cardRow}>
          <StatCard label="New requests — 24h"  value={requests.counts.last_24h} />
          <StatCard label="New requests — 72h"  value={requests.counts.last_72h} />
          <StatCard label="New requests — 7d"   value={requests.counts.last_7d} />
          <StatCard label="New requests — 30d"  value={requests.counts.last_30d} />
          <StatCard label="All time"            value={requests.counts.all_time} />
        </div>

        <div style={s.cardRow}>
          <StatCard
            label="Pending backlog"
            value={requests.pendingBacklog.total}
            sub="waiting for a verdict"
          />
          <StatCard
            label="Stale — over 48h"
            value={requests.pendingBacklog.stale_48h}
            sub="pending with no verdict yet"
            alert={Number(requests.pendingBacklog.stale_48h) > 0}
          />
          <StatCard
            label="Stale — over 7 days"
            value={requests.pendingBacklog.stale_7d}
            alert={Number(requests.pendingBacklog.stale_7d) > 0}
          />
          {requests.approvalRate.total_decided > 0 && (
            <StatCard
              label="Approval rate"
              value={`${Math.round((requests.approvalRate.approved / requests.approvalRate.total_decided) * 100)}%`}
              sub={`${requests.approvalRate.approved} approved / ${requests.approvalRate.not_approved} rejected`}
            />
          )}
        </div>

        <div style={s.row2}>
          <div style={s.half}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Top requestors</div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Requestor</th>
                  <th style={s.th}>Total</th>
                  <th style={s.th}>Pending</th>
                  <th style={s.th}>Approved</th>
                  <th style={s.th}>Rejected</th>
                </tr>
              </thead>
              <tbody>
                {requests.topRequestors.map((r, i) => (
                  <tr key={i}>
                    <td style={s.td}>
                      <div style={{ fontWeight: 500 }}>{r.display_name}</div>
                      {r.email !== r.display_name && (
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.email}</div>
                      )}
                    </td>
                    <td style={s.td}>{r.total}</td>
                    <td style={s.td}>{r.pending}</td>
                    <td style={s.td}>{r.approved}</td>
                    <td style={s.td}>{r.not_approved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {requests.populationBreakdown.length > 0 && (
            <div style={{ ...s.half, borderLeft: '2px solid #e2e8f0', paddingLeft: 24 }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>By population</div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Population</th>
                    <th style={s.th}>Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.populationBreakdown.map(({ population, count }) => (
                    <tr key={population}>
                      <td style={s.td}>{population}</td>
                      <td style={s.td}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Admin ─────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>Admin Activity</div>
        <div style={s.cardRow}>
          <StatCard label="Verdicts — 24h"  value={admin.verdictCounts.last_24h} />
          <StatCard label="Verdicts — 72h"  value={admin.verdictCounts.last_72h} />
          <StatCard label="Verdicts — 7d"   value={admin.verdictCounts.last_7d} />
          <StatCard label="Verdicts — 30d"  value={admin.verdictCounts.last_30d} />
        </div>
        <div style={s.cardRow}>
          <StatCard
            label="Median time to verdict (last 7d)"
            value={fmtHours(admin.avgTimeToVerdict.median_hours_7d)}
            sub="requests created in last 7 days"
          />
          <StatCard
            label="Avg time to verdict (last 7d)"
            value={fmtHours(admin.avgTimeToVerdict.avg_hours_7d)}
            sub="requests created in last 7 days"
          />
        </div>
      </div>
    </div>
  );
}
