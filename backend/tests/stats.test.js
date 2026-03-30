'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');
const statsRepo = require('../src/repositories/statsRepository');

const adminToken     = jwt.sign({ sub: 1, username: 'admin',     role: 'admin'            }, process.env.JWT_SECRET || 'dev-secret');
const gateToken      = jwt.sign({ sub: 2, username: 'gate',      role: 'gate'             }, process.env.JWT_SECRET || 'dev-secret');
const requestorToken = jwt.sign({ sub: 3, username: 'requestor', role: 'access_requestor' }, process.env.JWT_SECRET || 'dev-secret');

beforeAll(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id               SERIAL PRIMARY KEY,
      action           VARCHAR(50) NOT NULL,
      identifier_type  VARCHAR(20),
      identifier_value VARCHAR(50),
      verdict          VARCHAR(20),
      source           VARCHAR(20) NOT NULL DEFAULT 'manual',
      metadata         JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
});

beforeEach(async () => {
  await db.query('DELETE FROM audit_logs');
  await db.query('DELETE FROM people');
});

afterAll(async () => {
  await db.end();
});

// ── helpers ──────────────────────────────────────────────────────────────────

function insertScan(verdict = 'APPROVED', interval = '1 hour') {
  return db.query(
    `INSERT INTO audit_logs (action, source, verdict, created_at)
     VALUES ('VERIFY', 'manual', $1, NOW() - $2::INTERVAL)`,
    [verdict, interval]
  );
}

// Simpler person insert without status_changed_at complexity
function insertPersonRaw({ id, verdict, status, population, requesterEmail, requesterName, createdInterval, statusChangedInterval }) {
  const statusChangedAt = statusChangedInterval
    ? `NOW() - '${statusChangedInterval}'::INTERVAL`
    : 'NULL';
  return db.query(
    `INSERT INTO people (identifier_type, identifier_value, verdict, status, population, requester_email, requester_name, created_at, status_changed_at)
     VALUES ('IL_ID', $1, $2, $3, $4, $5, $6, NOW() - $7::INTERVAL, ${statusChangedAt})`,
    [id, verdict || 'NOT_APPROVED', status || 'PENDING', population || null,
     requesterEmail || null, requesterName || null, createdInterval || '1 hour']
  );
}

// ── Auth ──────────────────────────────────────────────────────────────────────

describe('GET /stats — auth', () => {
  it('returns 401 with no token', async () => {
    const res = await request(app).get('/stats');
    expect(res.status).toBe(401);
  });

  it('returns 403 for gate role', async () => {
    const res = await request(app).get('/stats').set('Authorization', `Bearer ${gateToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 403 for access_requestor role', async () => {
    const res = await request(app).get('/stats').set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Response shape ────────────────────────────────────────────────────────────

describe('GET /stats — response shape', () => {
  it('returns 200 with all expected top-level keys on an empty DB', async () => {
    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    expect(res.body).toHaveProperty('gateScans');
    expect(res.body).toHaveProperty('requests');
    expect(res.body).toHaveProperty('admin');

    expect(res.body.gateScans).toHaveProperty('counts');
    expect(res.body.gateScans).toHaveProperty('verdictBreakdown');
    expect(res.body.gateScans).toHaveProperty('hourlyScanActivity');

    expect(res.body.requests).toHaveProperty('counts');
    expect(res.body.requests).toHaveProperty('pendingBacklog');
    expect(res.body.requests).toHaveProperty('topRequestors');
    expect(res.body.requests).toHaveProperty('populationBreakdown');
    expect(res.body.requests).toHaveProperty('approvalRate');

    expect(res.body.admin).toHaveProperty('verdictCounts');
    expect(res.body.admin).toHaveProperty('avgTimeToVerdict');
  });

  it('returns zero counts on an empty DB', async () => {
    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const { counts } = res.body.gateScans;
    expect(Number(counts.all_time)).toBe(0);
    expect(Number(counts.last_24h)).toBe(0);
  });
});

// ── Gate scans ────────────────────────────────────────────────────────────────

describe('GET /stats — gate scan counts', () => {
  it('counts VERIFY audit logs by time window', async () => {
    await insertScan('APPROVED',     '1 hour');   // within 24h
    await insertScan('NOT_APPROVED', '50 hours'); // within 72h, outside 24h
    await insertScan('APPROVED',     '5 days');   // within 7d, outside 72h
    // non-VERIFY action should not be counted
    await db.query("INSERT INTO audit_logs (action, source, created_at) VALUES ('CREATE', 'admin', NOW() - '1 hour'::INTERVAL)");

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const { counts } = res.body.gateScans;

    expect(Number(counts.last_24h)).toBe(1);
    expect(Number(counts.last_72h)).toBe(2);
    expect(Number(counts.last_7d)).toBe(3);
    expect(Number(counts.all_time)).toBe(3);
  });

  it('returns verdict breakdown for the last 30 days', async () => {
    await insertScan('APPROVED',     '1 hour');
    await insertScan('APPROVED',     '2 hours');
    await insertScan('NOT_APPROVED', '3 hours');

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const breakdown = res.body.gateScans.verdictBreakdown;

    const approved = breakdown.find(r => r.verdict === 'APPROVED');
    const notApproved = breakdown.find(r => r.verdict === 'NOT_APPROVED');
    expect(Number(approved.count)).toBe(2);
    expect(Number(notApproved.count)).toBe(1);
  });

  it('returns hourly activity buckets for VERIFY logs', async () => {
    // Insert 2 scans at the same truncated hour (2 hours ago)
    await db.query(`
      INSERT INTO audit_logs (action, source, verdict, created_at)
      VALUES ('VERIFY', 'manual', 'APPROVED', date_trunc('hour', NOW()) - INTERVAL '2 hours'),
             ('VERIFY', 'manual', 'APPROVED', date_trunc('hour', NOW()) - INTERVAL '2 hours')
    `);
    // 1 scan at a different hour
    await db.query(`
      INSERT INTO audit_logs (action, source, verdict, created_at)
      VALUES ('VERIFY', 'manual', 'NOT_APPROVED', date_trunc('hour', NOW()) - INTERVAL '5 hours')
    `);

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const activity = res.body.gateScans.hourlyScanActivity;

    expect(Array.isArray(activity)).toBe(true);
    const total = activity.reduce((sum, r) => sum + Number(r.count), 0);
    expect(total).toBe(3);

    const twoHourBucket = activity.find(r => Number(r.count) === 2);
    expect(twoHourBucket).toBeDefined();
  });

  it('returns an empty hourly activity array when there are no scans', async () => {
    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.gateScans.hourlyScanActivity).toEqual([]);
  });
});

// ── Request counts ────────────────────────────────────────────────────────────

describe('GET /stats — request counts', () => {
  it('counts people rows by creation time window', async () => {
    await insertPersonRaw({ id: '000000018', createdInterval: '1 hour' });
    await insertPersonRaw({ id: '000000026', createdInterval: '50 hours' });
    await insertPersonRaw({ id: '000000034', createdInterval: '5 days' });

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const { counts } = res.body.requests;

    expect(Number(counts.last_24h)).toBe(1);
    expect(Number(counts.last_72h)).toBe(2);
    expect(Number(counts.last_7d)).toBe(3);
    expect(Number(counts.all_time)).toBe(3);
  });

  it('reports pending backlog total, stale_48h and stale_7d', async () => {
    // fresh pending
    await insertPersonRaw({ id: '000000018', status: 'PENDING', createdInterval: '1 hour' });
    // stale 48h+ but not 7d+
    await insertPersonRaw({ id: '000000026', status: 'PENDING', createdInterval: '3 days' });
    // stale 7d+
    await insertPersonRaw({ id: '000000034', status: 'PENDING', createdInterval: '8 days' });
    // decided — should not appear in backlog
    await insertPersonRaw({ id: '000000042', status: 'APPROVED', verdict: 'APPROVED', createdInterval: '1 hour' });

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const bl = res.body.requests.pendingBacklog;

    expect(Number(bl.total)).toBe(3);
    expect(Number(bl.stale_48h)).toBe(2);
    expect(Number(bl.stale_7d)).toBe(1);
  });

  it('ranks top requestors by total requests descending', async () => {
    await insertPersonRaw({ id: '000000018', requesterEmail: 'alice@ex.com', requesterName: 'Alice' });
    await insertPersonRaw({ id: '000000026', requesterEmail: 'alice@ex.com', requesterName: 'Alice' });
    await insertPersonRaw({ id: '000000034', requesterEmail: 'bob@ex.com',   requesterName: 'Bob'   });

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const [first, second] = res.body.requests.topRequestors;

    expect(first.email).toBe('alice@ex.com');
    expect(Number(first.total)).toBe(2);
    expect(second.email).toBe('bob@ex.com');
    expect(Number(second.total)).toBe(1);
  });

  it('includes requestors with only a requester_name (no email)', async () => {
    await insertPersonRaw({ id: '000000018', requesterName: 'NoEmail Person' });

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const found = res.body.requests.topRequestors.find(r => r.display_name === 'NoEmail Person');
    expect(found).toBeDefined();
    expect(Number(found.total)).toBe(1);
  });

  it('returns population breakdown grouped by population', async () => {
    await insertPersonRaw({ id: '000000018', population: 'IL_MILITARY' });
    await insertPersonRaw({ id: '000000026', population: 'IL_MILITARY' });
    await insertPersonRaw({ id: '000000034', population: 'CIVILIAN'    });

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const breakdown = res.body.requests.populationBreakdown;

    const mil  = breakdown.find(r => r.population === 'IL_MILITARY');
    const civ  = breakdown.find(r => r.population === 'CIVILIAN');
    expect(Number(mil.count)).toBe(2);
    expect(Number(civ.count)).toBe(1);
  });

  it('calculates approval rate from decided records', async () => {
    await insertPersonRaw({ id: '000000018', status: 'APPROVED',     verdict: 'APPROVED'     });
    await insertPersonRaw({ id: '000000026', status: 'APPROVED',     verdict: 'APPROVED'     });
    await insertPersonRaw({ id: '000000034', status: 'NOT_APPROVED', verdict: 'NOT_APPROVED' });
    await insertPersonRaw({ id: '000000042', status: 'PENDING',      verdict: 'NOT_APPROVED' }); // still pending — excluded

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const rate = res.body.requests.approvalRate;

    expect(Number(rate.approved)).toBe(2);
    expect(Number(rate.not_approved)).toBe(1);
    expect(Number(rate.total_decided)).toBe(3);
  });
});

// ── Admin activity ────────────────────────────────────────────────────────────

describe('GET /stats — admin verdict counts', () => {
  it('counts verdicts via status_changed_at time windows', async () => {
    await db.query(`
      INSERT INTO people (identifier_type, identifier_value, verdict, status, status_changed_at)
      VALUES ('IL_ID', '000000018', 'APPROVED',     'APPROVED',     NOW() - '1 hour'::INTERVAL),
             ('IL_ID', '000000026', 'NOT_APPROVED', 'NOT_APPROVED', NOW() - '50 hours'::INTERVAL),
             ('IL_ID', '000000034', 'APPROVED',     'APPROVED',     NOW() - '5 days'::INTERVAL)
    `);

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const vc = res.body.admin.verdictCounts;

    expect(Number(vc.last_24h)).toBe(1);
    expect(Number(vc.last_72h)).toBe(2);
    expect(Number(vc.last_7d)).toBe(3);
  });

  it('calculates average time to verdict in hours', async () => {
    // 4 hours between created_at and status_changed_at
    await db.query(`
      INSERT INTO people (identifier_type, identifier_value, verdict, status, created_at, status_changed_at)
      VALUES ('IL_ID', '000000018', 'APPROVED', 'APPROVED', NOW() - '4 hours'::INTERVAL, NOW())
    `);

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const avg = res.body.admin.avgTimeToVerdict;

    expect(parseFloat(avg.avg_hours_all_time)).toBeCloseTo(4.0, 0);
  });

  it('returns null avg time when no records have been decided', async () => {
    await insertPersonRaw({ id: '000000018', status: 'PENDING' });

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    const avg = res.body.admin.avgTimeToVerdict;

    expect(avg.avg_hours_all_time).toBeNull();
    expect(avg.avg_hours_30d).toBeNull();
  });
});

// ── Repository defaults ───────────────────────────────────────────────────────

describe('statsRepository — default parameters', () => {
  it('getHourlyScanActivity works without arguments (uses days=3 default)', async () => {
    const result = await statsRepo.getHourlyScanActivity();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('GET /stats — error handling', () => {
  it('returns 500 when a repository function throws', async () => {
    jest.spyOn(statsRepo, 'getGateScanCounts').mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await request(app).get('/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);

    jest.restoreAllMocks();
  });
});
