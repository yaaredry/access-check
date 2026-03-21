'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');

const requestorToken = jwt.sign({ sub: 99, username: 'requestor', role: 'access_requestor' }, process.env.JWT_SECRET || 'dev-secret');
const adminToken = jwt.sign({ sub: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'dev-secret');

const VALID_PAYLOAD = {
  ilId: '000000018',
  population: 'IL_MILITARY',
  approvalExpiration: '2099-12-31',
  reason: 'Delivery',
  requesterName: 'Jane Smith',
};

beforeAll(async () => {
  await db.query('DROP TABLE IF EXISTS people CASCADE');
  await db.query(`
    CREATE TABLE people (
      id SERIAL PRIMARY KEY,
      identifier_type VARCHAR(20) NOT NULL,
      identifier_value VARCHAR(50) NOT NULL,
      verdict VARCHAR(20) NOT NULL DEFAULT 'NOT_APPROVED',
      approval_expiration DATE,
      last_seen_at TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      population VARCHAR(20),
      division VARCHAR(100),
      escort_full_name VARCHAR(150),
      escort_phone VARCHAR(30),
      reason VARCHAR(500),
      status VARCHAR(20),
      rejection_reason VARCHAR(500),
      requester_name VARCHAR(150),
      CONSTRAINT uq_test_ar_identifier UNIQUE (identifier_type, identifier_value)
    )
  `);
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
        approvalExpiration: '2099-12-31',
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
        approvalExpiration: '2099-12-31',
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

  it('returns 400 for invalid phone (letters)', async () => {
    const res = await request(app)
      .post('/access-requests')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({
        ilId: '000000018',
        population: 'CIVILIAN',
        escortFullName: 'John Smith',
        escortPhone: 'abc123',
        approvalExpiration: '2099-12-31',
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
    const { requesterName, ...withoutRequester } = VALID_PAYLOAD;
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
