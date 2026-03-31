'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');

const requestorToken = jwt.sign({ sub: 99, username: 'requestor', role: 'access_requestor' }, process.env.JWT_SECRET || 'dev-secret');
const namedRequestorToken = jwt.sign({ sub: 98, username: 'jane@example.com', role: 'access_requestor', name: 'Jane Smith' }, process.env.JWT_SECRET || 'dev-secret');
const namedRequestorBToken = jwt.sign({ sub: 97, username: 'bob@example.com', role: 'access_requestor', name: 'Bob Jones' }, process.env.JWT_SECRET || 'dev-secret');
const adminToken = jwt.sign({ sub: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'dev-secret');

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const TOMORROW = tomorrow.toISOString().split('T')[0];

const VALID_PAYLOAD = {
  ilId: '000000018',
  population: 'IL_MILITARY',
  approvalExpiration: TOMORROW,
  reason: 'Delivery',
  requesterName: 'Jane Smith',
};

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
});

beforeEach(async () => {
  await db.query('DELETE FROM audit_logs');
  await db.query('DELETE FROM people');
});

afterAll(async () => {
  await db.end();
});

describe('POST /access-requests', () => {
  it('creates a PENDING record with valid IL_MILITARY payload', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');

    const { rows } = await db.query('SELECT * FROM people WHERE identifier_value = $1', ['000000018']);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('PENDING');
    expect(rows[0].verdict).toBe('NOT_APPROVED');
    expect(rows[0].population).toBe('IL_MILITARY');
  });

  it('creates a PENDING record with valid CIVILIAN payload', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({
        ilId: '000000018',
        population: 'CIVILIAN',
        escortFullName: 'John Smith',
        escortPhone: '+972501234567',
        approvalExpiration: TOMORROW,
        reason: 'Contractor visit',
        requesterName: 'Jane Smith',
      });

    expect(res.status).toBe(201);
    const { rows } = await db.query('SELECT * FROM people WHERE identifier_value = $1', ['000000018']);
    expect(rows[0].escort_full_name).toBe('John Smith');
    expect(rows[0].escort_phone).toBe('+972501234567');
  });

  it('returns 400 when escort fields are missing for CIVILIAN', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({
        ilId: '000000018',
        population: 'CIVILIAN',
        approvalExpiration: TOMORROW,
        reason: 'Contractor visit',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid IL_ID', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...VALID_PAYLOAD, ilId: '000000019' }); // fails Luhn

    expect(res.status).toBe(400);
  });

  it('returns 400 for past expiration date', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...VALID_PAYLOAD, approvalExpiration: '2000-01-01' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for expiration date more than 7 days ahead', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...VALID_PAYLOAD, approvalExpiration: '2099-12-31' });

    expect(res.status).toBe(400);
  });

  it('returns 409 when a PENDING record already exists for the same ID', async () => {
    await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(VALID_PAYLOAD);

    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
    expect(res.body.existing).toMatchObject({ status: 'PENDING' });
  });

  it('returns 409 when a non-pending record already exists for the same ID', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status) VALUES ('IL_ID', '000000018', 'APPROVED', 'APPROVED')"
    );

    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
    expect(res.body.existing).toMatchObject({ verdict: 'APPROVED' });
  });

  it('returns 400 for invalid phone (letters)', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({
        ilId: '000000018',
        population: 'CIVILIAN',
        escortFullName: 'John Smith',
        escortPhone: 'abc123',
        approvalExpiration: TOMORROW,
        reason: 'Visit',
      });

    expect(res.status).toBe(400);
  });

  it('saves requesterName to the record', async () => {
    await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(VALID_PAYLOAD);

    const { rows } = await db.query('SELECT * FROM people WHERE identifier_value = $1', ['000000018']);
    expect(rows[0].requester_name).toBe('Jane Smith');
  });

  it('returns 400 when requesterName is missing', async () => {
    const { requesterName: _requesterName, ...withoutRequester } = VALID_PAYLOAD; // eslint-disable-line no-unused-vars
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(withoutRequester);

    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is missing', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ilId: '000000018', population: 'IL_MILITARY', approvalExpiration: '2099-12-31' });

    expect(res.status).toBe(400);
  });

  it('saves approvalStartDate when provided', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...VALID_PAYLOAD, approvalStartDate: TOMORROW });

    expect(res.status).toBe(201);
    const { rows } = await db.query('SELECT * FROM people WHERE identifier_value = $1', ['000000018']);
    expect(rows[0].approval_start_date).not.toBeNull();
  });

  it('works without approvalStartDate (backwards compatible)', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(201);
    const { rows } = await db.query('SELECT * FROM people WHERE identifier_value = $1', ['000000018']);
    expect(rows[0].approval_start_date).toBeNull();
  });

  it('returns 400 when approvalStartDate is after approvalExpiration', async () => {
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const DAY_AFTER_TOMORROW = dayAfterTomorrow.toISOString().split('T')[0];

    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...VALID_PAYLOAD, approvalStartDate: DAY_AFTER_TOMORROW, approvalExpiration: TOMORROW });

    expect(res.status).toBe(400);
  });

  it('allows approvalStartDate equal to approvalExpiration (same-day range)', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...VALID_PAYLOAD, approvalStartDate: TOMORROW, approvalExpiration: TOMORROW });

    expect(res.status).toBe(201);
  });

  it('allows expiration 7 days from start date (beyond the normal 7-day window)', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 2);
    const expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + 7);
    const START = startDate.toISOString().split('T')[0];
    const EXPIRY = expiryDate.toISOString().split('T')[0];

    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...VALID_PAYLOAD, approvalStartDate: START, approvalExpiration: EXPIRY });

    expect(res.status).toBe(201);
  });

  it('returns 400 when expiration is more than 7 days from start date', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 2);
    const expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + 8); // 8 days from start = too far
    const START = startDate.toISOString().split('T')[0];
    const EXPIRY = expiryDate.toISOString().split('T')[0];

    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...VALID_PAYLOAD, approvalStartDate: START, approvalExpiration: EXPIRY });

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/access-requests')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(401);
  });

  it('returns 403 for admin role', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('named requestor: derives requesterName and requesterEmail from JWT, body field not needed', async () => {
    const { requesterName: _, ...payloadWithoutName } = VALID_PAYLOAD; // eslint-disable-line no-unused-vars
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${namedRequestorToken}`)
      .send(payloadWithoutName);

    expect(res.status).toBe(201);
    const { rows } = await db.query('SELECT * FROM people WHERE identifier_value = $1', ['000000018']);
    expect(rows[0].requester_name).toBe('Jane Smith');
    expect(rows[0].requester_email).toBe('jane@example.com');
  });

  it('named requestor: JWT name takes precedence over any body requesterName', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${namedRequestorToken}`)
      .send({ ...VALID_PAYLOAD, requesterName: 'Someone Else' });

    expect(res.status).toBe(201);
    const { rows } = await db.query('SELECT * FROM people WHERE identifier_value = $1', ['000000018']);
    expect(rows[0].requester_name).toBe('Jane Smith');
  });

  it('generic requestor: requesterEmail is null when no name in JWT', async () => {
    await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(VALID_PAYLOAD);

    const { rows } = await db.query('SELECT * FROM people WHERE identifier_value = $1', ['000000018']);
    expect(rows[0].requester_name).toBe('Jane Smith');
    expect(rows[0].requester_email).toBeNull();
  });
});

describe('POST /access-requests/:id/resubmit', () => {
  async function insertPerson(overrides = {}) {
    const { rows } = await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration, rejection_reason, requester_name, requester_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        overrides.identifier_type ?? 'IL_ID',
        overrides.identifier_value ?? '000000018',
        overrides.verdict ?? 'NOT_APPROVED',
        overrides.status ?? 'NOT_APPROVED',
        overrides.approval_expiration ?? null,
        overrides.rejection_reason ?? null,
        overrides.requester_name ?? 'Original Name',
        overrides.requester_email ?? null,
      ]
    );
    return rows[0].id;
  }

  const RESUBMIT_PAYLOAD = {
    population: 'IL_MILITARY',
    approvalExpiration: TOMORROW,
    reason: 'Extended visit',
    requesterName: 'New Requestor',
  };

  // ── Happy path ────────────────────────────────────────────────────────────

  it('resubmits a NOT_APPROVED record → status becomes PENDING', async () => {
    const id = await insertPerson({ status: 'NOT_APPROVED', verdict: 'NOT_APPROVED', rejection_reason: 'Denied' });

    const res = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(RESUBMIT_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, status: 'PENDING' });

    const { rows } = await db.query('SELECT * FROM people WHERE id = $1', [id]);
    expect(rows[0].status).toBe('PENDING');
    expect(rows[0].verdict).toBe('NOT_APPROVED');
    expect(rows[0].rejection_reason).toBeNull();
    expect(rows[0].status_changed_at).toBeNull();
  });

  it('resubmits an APPROVED record with past expiration (expired) → status becomes PENDING', async () => {
    const id = await insertPerson({ status: 'APPROVED', verdict: 'APPROVED', approval_expiration: '2020-01-01' });

    const res = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(RESUBMIT_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PENDING');

    const { rows } = await db.query('SELECT * FROM people WHERE id = $1', [id]);
    expect(rows[0].status).toBe('PENDING');
    expect(rows[0].status_changed_at).toBeNull();
  });

  it('updates form fields on resubmit', async () => {
    const id = await insertPerson({ status: 'NOT_APPROVED' });

    await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...RESUBMIT_PAYLOAD, reason: 'Updated reason', population: 'CIVILIAN', escortFullName: 'Guard', escortPhone: '+972501234567' });

    const { rows } = await db.query('SELECT * FROM people WHERE id = $1', [id]);
    expect(rows[0].reason).toBe('Updated reason');
    expect(rows[0].population).toBe('CIVILIAN');
    expect(rows[0].escort_full_name).toBe('Guard');
  });

  it('overwrites requester fields with the new submitter identity', async () => {
    const id = await insertPerson({ status: 'NOT_APPROVED', requester_name: 'Old Name' });

    await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...RESUBMIT_PAYLOAD, requesterName: 'New Person' });

    const { rows } = await db.query('SELECT * FROM people WHERE id = $1', [id]);
    expect(rows[0].requester_name).toBe('New Person');
    expect(rows[0].requester_email).toBeNull();
  });

  it('named requestor: derives requester identity from JWT on resubmit', async () => {
    const id = await insertPerson({ status: 'NOT_APPROVED', requester_name: 'Old Name' });
    const { requesterName: _, ...payloadWithoutName } = RESUBMIT_PAYLOAD; // eslint-disable-line no-unused-vars

    await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${namedRequestorToken}`)
      .send(payloadWithoutName);

    const { rows } = await db.query('SELECT * FROM people WHERE id = $1', [id]);
    expect(rows[0].requester_name).toBe('Jane Smith');
    expect(rows[0].requester_email).toBe('jane@example.com');
  });

  it('writes an ACCESS_REQUEST_RESUBMIT audit log entry', async () => {
    const id = await insertPerson({ status: 'NOT_APPROVED' });

    await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(RESUBMIT_PAYLOAD);

    const { rows } = await db.query("SELECT * FROM audit_logs WHERE action = 'ACCESS_REQUEST_RESUBMIT'");
    expect(rows).toHaveLength(1);
    expect(rows[0].identifier_value).toBe('000000018');
  });

  // ── Blocked states ────────────────────────────────────────────────────────

  it('returns 409 when record is PENDING', async () => {
    const id = await insertPerson({ status: 'PENDING', verdict: 'NOT_APPROVED' });

    const res = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(RESUBMIT_PAYLOAD);

    expect(res.status).toBe(409);
  });

  it('returns 409 when record is APPROVED with future expiration (still active)', async () => {
    const id = await insertPerson({ status: 'APPROVED', verdict: 'APPROVED', approval_expiration: TOMORROW });

    const res = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(RESUBMIT_PAYLOAD);

    expect(res.status).toBe(409);
  });

  it('returns 409 when record is APPROVED with no expiration', async () => {
    const id = await insertPerson({ status: 'APPROVED', verdict: 'APPROVED', approval_expiration: null });

    const res = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(RESUBMIT_PAYLOAD);

    expect(res.status).toBe(409);
  });

  // ── Not found / auth ──────────────────────────────────────────────────────

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .post('/access-requests/99999/resubmit')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(RESUBMIT_PAYLOAD);

    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/access-requests/1/resubmit')
      .send(RESUBMIT_PAYLOAD);

    expect(res.status).toBe(401);
  });

  // ── Cross-requestor scenarios ─────────────────────────────────────────────

  it('Person B can resubmit an expired record originally submitted by Person A', async () => {
    // Person A submits
    await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${namedRequestorToken}`)
      .send({ ...VALID_PAYLOAD, requesterName: undefined });

    // Admin approves, record then expires (simulate by direct DB update)
    await db.query(
      "UPDATE people SET status = 'APPROVED', verdict = 'APPROVED', approval_expiration = '2020-01-01' WHERE identifier_value = '000000018'"
    );

    // Person B submits same ID → 409
    const conflictRes = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${namedRequestorBToken}`)
      .send({ ...VALID_PAYLOAD, requesterName: undefined });

    expect(conflictRes.status).toBe(409);
    const { id } = conflictRes.body.existing;

    // Person B resubmits using the id from the 409
    const resubmitRes = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${namedRequestorBToken}`)
      .send(RESUBMIT_PAYLOAD);

    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.status).toBe('PENDING');

    const { rows } = await db.query('SELECT * FROM people WHERE id = $1', [id]);
    expect(rows[0].requester_name).toBe('Bob Jones');
    expect(rows[0].requester_email).toBe('bob@example.com');
  });

  it('Person B can resubmit a rejected record originally submitted by Person A', async () => {
    // Person A submits
    await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${namedRequestorToken}`)
      .send({ ...VALID_PAYLOAD, requesterName: undefined });

    // Admin rejects
    await db.query(
      "UPDATE people SET status = 'NOT_APPROVED', verdict = 'NOT_APPROVED', rejection_reason = 'Denied by security' WHERE identifier_value = '000000018'"
    );

    // Person B submits same ID → 409
    const conflictRes = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(VALID_PAYLOAD);

    expect(conflictRes.status).toBe(409);
    const { id } = conflictRes.body.existing;

    // Person B resubmits
    const resubmitRes = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(RESUBMIT_PAYLOAD);

    expect(resubmitRes.status).toBe(200);
    const { rows } = await db.query('SELECT * FROM people WHERE id = $1', [id]);
    expect(rows[0].requester_name).toBe('New Requestor');
    expect(rows[0].requester_email).toBeNull();
    expect(rows[0].rejection_reason).toBeNull(); // cleared
    expect(rows[0].status).toBe('PENDING');
  });

  // ── Start date (approval_start_date) ─────────────────────────────────────

  it('resubmit saves approvalStartDate when provided', async () => {
    const id = await insertPerson({ status: 'NOT_APPROVED', verdict: 'NOT_APPROVED' });

    const res = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...RESUBMIT_PAYLOAD, approvalStartDate: TOMORROW });

    expect(res.status).toBe(200);
    const { rows } = await db.query('SELECT * FROM people WHERE id = $1', [id]);
    expect(rows[0].approval_start_date).not.toBeNull();
  });

  it('resubmit clears approvalStartDate when not provided', async () => {
    // Record previously had a start date
    const { rows: inserted } = await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_start_date, approval_expiration)
       VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'NOT_APPROVED', '2020-01-01', '2020-06-01') RETURNING id`
    );
    const id = inserted[0].id;

    const res = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send(RESUBMIT_PAYLOAD); // no approvalStartDate

    expect(res.status).toBe(200);
    const { rows } = await db.query('SELECT * FROM people WHERE id = $1', [id]);
    expect(rows[0].approval_start_date).toBeNull();
  });

  it('resubmit returns 400 when approvalStartDate is after approvalExpiration', async () => {
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const DAY_AFTER_TOMORROW = dayAfterTomorrow.toISOString().split('T')[0];

    const id = await insertPerson({ status: 'NOT_APPROVED', verdict: 'NOT_APPROVED' });

    const res = await request(app)
      .post(`/access-requests/${id}/resubmit`)
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ ...RESUBMIT_PAYLOAD, approvalStartDate: DAY_AFTER_TOMORROW, approvalExpiration: TOMORROW });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /people/:id/status (admin approve/reject)', () => {
  it('approves a PENDING record', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'PENDING') RETURNING id"
    );
    const id = rows[0].id;

    const res = await request(app)
      .patch(`/people/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.verdict).toBe('ADMIN_APPROVED');
  });

  it('rejects a PENDING record', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'PENDING') RETURNING id"
    );
    const id = rows[0].id;

    const res = await request(app)
      .patch(`/people/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'NOT_APPROVED', rejectionReason: 'Does not meet requirements' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('NOT_APPROVED');
  });

  it('returns 400 for invalid status value', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'PENDING') RETURNING id"
    );

    const res = await request(app)
      .patch(`/people/${rows[0].id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PENDING' });

    expect(res.status).toBe(400);
  });

  it('returns 403 for access_requestor role', async () => {
    const res = await request(app)
      .patch('/people/1/status')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(403);
  });
});

describe('GET /access-requests/mine', () => {
  it('returns only records submitted by the calling named requestor', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, requester_email) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'PENDING', 'jane@example.com')"
    );
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, requester_email) VALUES ('IL_ID', '000000026', 'NOT_APPROVED', 'PENDING', 'other@example.com')"
    );

    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${namedRequestorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].identifier_value).toBe('000000018');
  });

  it('returns an empty array when the requestor has no submissions', async () => {
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${namedRequestorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(0);
  });

  it('returns records ordered newest first', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, requester_email, created_at) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'PENDING', 'jane@example.com', NOW() - INTERVAL '1 day')"
    );
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, requester_email, created_at) VALUES ('IL_ID', '000000026', 'NOT_APPROVED', 'PENDING', 'jane@example.com', NOW())"
    );

    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${namedRequestorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rows[0].identifier_value).toBe('000000026');
    expect(res.body.rows[1].identifier_value).toBe('000000018');
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/access-requests/mine');
    expect(res.status).toBe(401);
  });

  it('returns 403 for admin role', async () => {
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });
});
