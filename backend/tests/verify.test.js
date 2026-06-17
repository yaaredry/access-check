'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/config/database');
const ocrService = require('../src/services/ocrService');

const gateToken = jwt.sign({ sub: 2, username: 'megido', role: 'gate' }, process.env.JWT_SECRET || 'dev-secret');

beforeAll(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      action VARCHAR(50) NOT NULL,
      identifier_type VARCHAR(20),
      identifier_value VARCHAR(50),
      verdict VARCHAR(20),
      source VARCHAR(20) NOT NULL DEFAULT 'manual',
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Remove any stale 'megido' row at a different id before upserting at id=2
  await db.query(`DELETE FROM users WHERE username = 'megido' AND id != 2`);
  await db.query(`
    INSERT INTO users (id, username, password, role, name)
    OVERRIDING SYSTEM VALUE VALUES
      (2, 'megido', 'hash', 'gate', NULL)
    ON CONFLICT (id) DO UPDATE
      SET username = EXCLUDED.username, role = EXCLUDED.role, name = EXCLUDED.name
  `);
});

beforeEach(async () => {
  await db.query('DELETE FROM audit_logs');
  await db.query('DELETE FROM people');
});

afterAll(async () => {
  await db.end();
});

describe('POST /verify/id', () => {
  it('returns APPROVED for an approved person', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('APPROVED');
  });

  it('returns NOT_APPROVED for a not-approved person', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'NOT_APPROVED')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('NOT_APPROVED');
  });

  it('returns NOT_FOUND for unknown person', async () => {
    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('NOT_FOUND');
  });

  it('returns NOT_APPROVED (not EXPIRED) for a rejected record whose approval_expiration has passed', async () => {
    // Rejected records always have an approval_expiration from the original submission.
    // Once that date passes, NOT_APPROVED must still take precedence over EXPIRED.
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'NOT_APPROVED', '2020-01-01')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('NOT_APPROVED');
  });

  it('returns EXPIRED when approval_expiration is in the past', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration) VALUES ('IL_ID', '000000018', 'APPROVED', '2020-01-01')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('EXPIRED');
  });

  it('returns APPROVED when approval_expiration is in the future', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration) VALUES ('IL_ID', '000000018', 'APPROVED', '2099-12-31')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('APPROVED');
  });

  it('returns ADMIN_APPROVED for an admin-approved person', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'ADMIN_APPROVED')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('ADMIN_APPROVED');
  });

  it('returns EXPIRED for an admin-approved person with a past expiration', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration) VALUES ('IL_ID', '000000018', 'ADMIN_APPROVED', '2020-01-01')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('EXPIRED');
  });

  it('returns APPROVED for a requestor-flow person approved via status (verdict stays NOT_APPROVED)', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'APPROVED', '2099-12-31')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('APPROVED');
  });

  it('returns EXPIRED for a requestor-flow person approved via status with a past expiration', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'APPROVED', '2020-01-01')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('EXPIRED');
  });

  it('returns PENDING for a person with status PENDING', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'PENDING')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('PENDING');
  });

  it('returns NOT_YET_ACTIVE when approval_start_date is in the future', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, approval_start_date, approval_expiration) VALUES ('IL_ID', '000000018', 'APPROVED', '2099-01-01', '2099-12-31')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('NOT_YET_ACTIVE');
  });

  it('returns APPROVED when approval_start_date is today (already active)', async () => {
    const today = new Date().toISOString().split('T')[0];
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_start_date, approval_expiration) VALUES ('IL_ID', '000000018', 'APPROVED', '${today}', '2099-12-31')`
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('APPROVED');
  });

  it('returns APPROVED when approval_start_date is in the past', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, approval_start_date, approval_expiration) VALUES ('IL_ID', '000000018', 'APPROVED', '2020-01-01', '2099-12-31')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('APPROVED');
  });

  it('NOT_YET_ACTIVE takes precedence over EXPIRED when start_date is future and expiry is past', async () => {
    // The start check runs before the expiry check, so a future start wins.
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, approval_start_date, approval_expiration) VALUES ('IL_ID', '000000018', 'APPROVED', '2099-01-01', '2020-01-01')"
    );

    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('NOT_YET_ACTIVE');
  });

  it('returns 400 for invalid identifierType', async () => {
    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'PASSPORT', identifierValue: '12345' });

    expect(res.status).toBe(400);
  });
});

describe('POST /verify/image', () => {
  it('returns 410 — endpoint has been discontinued', async () => {
    const res = await request(app)
      .post('/verify/image')
      .set('Authorization', `Bearer ${gateToken}`);
    expect(res.status).toBe(410);
  });
});

describe('BLOCKED verdict', () => {
  it('returns BLOCKED via POST /verify/id even when a prior APPROVED verdict exists', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, block_reason) VALUES ('IL_ID', '000000018', 'BLOCKED', 'BLOCKED', 'Caught tailgating')"
    );
    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('BLOCKED');
  });

  it('BLOCKED overrides a non-expired approval (verdict stored as APPROVED, status BLOCKED)', async () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration, block_reason)
       VALUES ('IL_ID', '000000018', 'BLOCKED', 'BLOCKED', $1, 'Misconduct')`,
      [future.toISOString().split('T')[0]]
    );
    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('BLOCKED');
  });

  it('BLOCKED overrides EXPIRED (status BLOCKED with past approval_expiration returns BLOCKED)', async () => {
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration, block_reason)
       VALUES ('IL_ID', '000000018', 'BLOCKED', 'BLOCKED', $1, 'Persistent issue')`,
      [past.toISOString().split('T')[0]]
    );
    const res = await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });
    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('BLOCKED');
  });

  it('writes a VERIFY audit log entry with verdict BLOCKED for a blocked person', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, block_reason) VALUES ('IL_ID', '000000018', 'BLOCKED', 'BLOCKED', 'Audit test')"
    );
    await request(app)
      .post('/verify/id')
      .set('Authorization', `Bearer ${gateToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });
    const { rows: logs } = await db.query("SELECT * FROM audit_logs WHERE action = 'VERIFY'");
    expect(logs).toHaveLength(1);
    expect(logs[0].verdict).toBe('BLOCKED');
  });
});
