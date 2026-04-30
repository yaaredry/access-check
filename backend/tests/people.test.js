'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');
const gsheetService = require('../src/services/gsheetService');
const auditRepo = require('../src/repositories/auditRepository');
const peopleRepo = require('../src/repositories/peopleRepository');

const authToken = jwt.sign({ sub: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'dev-secret');

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

describe('POST /people', () => {
  it('creates a person with valid data', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        identifierType: 'IL_ID',
        identifierValue: '000000018', // valid luhn-check IL ID
        verdict: 'APPROVED',
      });

    expect(res.status).toBe(201);
    expect(res.body.identifier_value).toBe('000000018');
    expect(res.body.verdict).toBe('APPROVED');
  });

  it('returns 400 for invalid identifierType', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'UNKNOWN', identifierValue: '123456789', verdict: 'APPROVED' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when identifierValue is a single digit (e.g. "0")', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '0', verdict: 'APPROVED' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when IL_ID fails the Luhn check', async () => {
    // 000000019 is 9 digits but fails the Luhn check (000000018 is the valid one)
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000019', verdict: 'APPROVED' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when IL_ID is fewer than 9 digits', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '12345', verdict: 'APPROVED' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when IL_ID contains non-digit characters', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: 'AB1234567', verdict: 'APPROVED' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing verdict', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(400);
  });

  it('creates a person with ADMIN_APPROVED verdict', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        identifierType: 'IL_ID',
        identifierValue: '000000018',
        verdict: 'ADMIN_APPROVED',
      });

    expect(res.status).toBe(201);
    expect(res.body.verdict).toBe('ADMIN_APPROVED');
  });

  it('creates a person with APPROVED_WITH_ESCORT verdict when escort fields are provided', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        identifierType: 'IL_ID',
        identifierValue: '000000018',
        verdict: 'APPROVED_WITH_ESCORT',
        escortFullName: 'John Smith',
        escortPhone: '+972501234567',
      });

    expect(res.status).toBe(201);
    expect(res.body.verdict).toBe('APPROVED_WITH_ESCORT');
    expect(res.body.escort_full_name).toBe('John Smith');
  });

  it('returns 400 for APPROVED_WITH_ESCORT when escortFullName is missing', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        identifierType: 'IL_ID',
        identifierValue: '000000018',
        verdict: 'APPROVED_WITH_ESCORT',
        escortPhone: '+972501234567',
      });

    expect(res.status).toBe(400);
  });

  it('returns 400 for APPROVED_WITH_ESCORT when escortPhone is missing', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        identifierType: 'IL_ID',
        identifierValue: '000000018',
        verdict: 'APPROVED_WITH_ESCORT',
        escortFullName: 'John Smith',
      });

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/people')
      .send({ identifierType: 'IL_ID', identifierValue: '000000018', verdict: 'APPROVED' });

    expect(res.status).toBe(401);
  });
});

describe('GET /people', () => {
  it('returns list of people', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED')"
    );

    const res = await request(app)
      .get('/people')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('sorts PENDING records first, then by updated_at DESC', async () => {
    // oldest updated_at
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, updated_at) VALUES ('IL_ID', '000000018', 'APPROVED', 'APPROVED', NOW() - INTERVAL '2 hours')"
    );
    // most recently updated — should be first among non-pending
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, updated_at) VALUES ('IDF_ID', '1234567', 'NOT_APPROVED', 'NOT_APPROVED', NOW() - INTERVAL '1 hour')"
    );
    // PENDING — must always be first regardless of updated_at
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, updated_at) VALUES ('IL_ID', '000000026', 'NOT_APPROVED', 'PENDING', NOW() - INTERVAL '3 hours')"
    );

    const res = await request(app)
      .get('/people')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.rows.map(r => r.identifier_value);
    expect(ids[0]).toBe('000000026'); // PENDING first
    expect(ids[1]).toBe('1234567');   // most recently updated non-pending
    expect(ids[2]).toBe('000000018'); // oldest updated_at last
  });

  it('approved record (via PATCH /status) appears before null-status admin-created records', async () => {
    // Simulate admin-created records (status = NULL) — typical bulk import or manual entry
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, updated_at) VALUES ('IDF_ID', '1111111', 'APPROVED', NOW() - INTERVAL '30 minutes')"
    );
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, updated_at) VALUES ('IDF_ID', '2222222', 'APPROVED', NOW() - INTERVAL '1 hour')"
    );

    // PENDING record submitted by a gate requestor (older than the admin-created records)
    const { rows: [pending] } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, updated_at) VALUES ('IL_ID', '000000026', 'NOT_APPROVED', 'PENDING', NOW() - INTERVAL '2 hours') RETURNING id, updated_at"
    );
    const updatedAtBefore = pending.updated_at;

    // Admin approves the PENDING record
    await request(app)
      .patch(`/people/${pending.id}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'APPROVED', verdict: 'APPROVED' });

    // Confirm the trigger actually bumped updated_at
    const { rows: [after] } = await db.query('SELECT updated_at, status FROM people WHERE id = $1', [pending.id]);
    expect(after.status).toBe('APPROVED');
    expect(after.updated_at.getTime()).toBeGreaterThan(updatedAtBefore.getTime());

    const res = await request(app)
      .get('/people')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.rows.map(r => r.identifier_value);
    // Newly approved record must appear before the null-status admin-created records
    expect(ids[0]).toBe('000000026'); // just approved — top of non-pending section
    expect(ids[1]).toBe('1111111');   // null-status, more recently updated
    expect(ids[2]).toBe('2222222');   // null-status, older
  });

  it('supports search by identifier_value', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED'), ('IDF_ID', '1234567', 'NOT_APPROVED')"
    );

    const res = await request(app)
      .get('/people?search=00000001')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });
});

describe('GET /people/:id', () => {
  it('returns a person by id', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED') RETURNING id"
    );
    const id = rows[0].id;

    const res = await request(app)
      .get(`/people/${id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.identifier_value).toBe('000000018');
  });

  it('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .get('/people/99999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});

describe('PUT /people/:id', () => {
  it('updates verdict and expiration', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'NOT_APPROVED') RETURNING id"
    );
    const id = rows[0].id;

    const res = await request(app)
      .put(`/people/${id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        identifierType: 'IL_ID',
        identifierValue: '000000018',
        verdict: 'APPROVED',
        approvalExpiration: '2099-12-31',
      });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('APPROVED');
    expect(res.body.approval_expiration).toBeDefined();
  });

  it('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .put('/people/99999')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018', verdict: 'APPROVED' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /people/:id', () => {
  it('deletes an existing person', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED') RETURNING id"
    );
    const id = rows[0].id;

    const res = await request(app)
      .delete(`/people/${id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent person', async () => {
    const res = await request(app)
      .delete('/people/99999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /people/upload-csv', () => {
  it('inserts valid records from a CSV upload', async () => {
    const csv = [
      'identifier_type,identifier_value,verdict,expiration_date',
      'IL_ID,000000018,APPROVED,',
      'IDF_ID,1234567,NOT_APPROVED,',
    ].join('\n');

    const res = await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from(csv), { filename: 'test.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(2);
    expect(res.body.errors).toHaveLength(0);
  });

  it('reports errors for invalid rows and still inserts valid ones', async () => {
    const csv = [
      'identifier_type,identifier_value,verdict,expiration_date',
      'IL_ID,000000018,APPROVED,',
      'UNKNOWN,000000018,APPROVED,',
    ].join('\n');

    const res = await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from(csv), { filename: 'test.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(1);
    expect(res.body.errors).toHaveLength(1);
  });

  it('accepts APPROVED_WITH_ESCORT verdict in CSV upload', async () => {
    const csv = [
      'identifier_type,identifier_value,verdict,expiration_date',
      'IL_ID,000000018,APPROVED_WITH_ESCORT,',
    ].join('\n');

    const res = await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from(csv), { filename: 'test.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(1);
    expect(res.body.errors).toHaveLength(0);
  });

  it('rejects rows with unrecognised verdict in CSV upload', async () => {
    const csv = [
      'identifier_type,identifier_value,verdict,expiration_date',
      'IL_ID,000000018,SUPER_APPROVED,',
    ].join('\n');

    const res = await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from(csv), { filename: 'test.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(0);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].error).toMatch(/Invalid verdict/);
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /people/import-gsheet', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('imports records from a mocked Google Sheet', async () => {
    jest.spyOn(gsheetService, 'fetchAndParse').mockResolvedValue([
      { rowNum: 2, identifierValue: '000000018', verdict: 'APPROVED' },
      { rowNum: 3, identifierValue: '301802500', verdict: 'ADMIN_APPROVED' },
    ]);

    const res = await request(app)
      .post('/people/import-gsheet')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ url: 'https://docs.google.com/spreadsheets/d/fake/edit' });

    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(2);
    expect(res.body.errors).toHaveLength(0);
  });

  it('skips rows where verdict is null (pending)', async () => {
    jest.spyOn(gsheetService, 'fetchAndParse').mockResolvedValue([
      { rowNum: 2, identifierValue: '000000018', verdict: null },
    ]);

    const res = await request(app)
      .post('/people/import-gsheet')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ url: 'https://docs.google.com/spreadsheets/d/fake/edit' });

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(1);
    expect(res.body.inserted).toBe(0);
  });

  it('returns errors for invalid IL_IDs', async () => {
    // 000000019 has 9 digits but fails the Luhn check
    jest.spyOn(gsheetService, 'fetchAndParse').mockResolvedValue([
      { rowNum: 2, identifierValue: '000000019', verdict: 'APPROVED' },
    ]);

    const res = await request(app)
      .post('/people/import-gsheet')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ url: 'https://docs.google.com/spreadsheets/d/fake/edit' });

    expect(res.status).toBe(200);
    expect(res.body.errors).toHaveLength(1);
  });

  it('returns 400 when url is missing', async () => {
    const res = await request(app)
      .post('/people/import-gsheet')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('Error handler', () => {
  it('returns 409 on duplicate identifier', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED')"
    );

    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018', verdict: 'APPROVED' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/);
  });
});

describe('PATCH /people/:id/status', () => {
  it('rejects a person with a reason and saves it', async () => {
    const create = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018', verdict: 'NOT_APPROVED', status: 'PENDING' });
    const id = create.body.id;

    const res = await request(app)
      .patch(`/people/${id}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'NOT_APPROVED', rejectionReason: 'No valid clearance on file' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('NOT_APPROVED');
    expect(res.body.rejection_reason).toBe('No valid clearance on file');
  });

  it('returns 400 when rejecting without a reason', async () => {
    const create = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000018', verdict: 'NOT_APPROVED', status: 'PENDING' });
    const id = create.body.id;

    const res = await request(app)
      .patch(`/people/${id}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'NOT_APPROVED' });

    expect(res.status).toBe(400);
  });

  it('clears rejection_reason when approving', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status, rejection_reason) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'NOT_APPROVED', 'Previous rejection') RETURNING id"
    );
    const id = rows[0].id;

    const res = await request(app)
      .patch(`/people/${id}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.rejection_reason).toBeNull();
  });
});

describe('peopleRepository direct', () => {
  it('updateStatus updates only the status field', async () => {
    const { rows: [person] } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, status) VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'PENDING') RETURNING id"
    );
    const updated = await peopleRepo.updateStatus(person.id, 'APPROVED');
    expect(updated.id).toBe(person.id);
    expect(updated.status).toBe('APPROVED');
  });

  it('upsertMany returns updated count when record already exists', async () => {
    const record = { identifierType: 'IL_ID', identifierValue: '000000018', verdict: 'APPROVED', approvalExpiration: null };
    const first = await peopleRepo.upsertMany([record]);
    expect(first.inserted).toBe(1);
    expect(first.updated).toBe(0);

    const second = await peopleRepo.upsertMany([{ ...record, verdict: 'NOT_APPROVED' }]);
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(1);
  });

  it('upsertMany does not update updated_at on conflict (GSheet import preserves timestamp)', async () => {
    const record = { identifierType: 'IL_ID', identifierValue: '000000018', verdict: 'APPROVED', approvalExpiration: null };
    await peopleRepo.upsertMany([record]);

    const { rows: [before] } = await db.query("SELECT updated_at FROM people WHERE identifier_value = '000000018'");

    // Small delay to ensure clock would advance if updated_at were touched
    await new Promise(r => setTimeout(r, 20));
    await peopleRepo.upsertMany([{ ...record, verdict: 'NOT_APPROVED' }]);

    const { rows: [after] } = await db.query("SELECT updated_at FROM people WHERE identifier_value = '000000018'");
    expect(after.updated_at.getTime()).toBe(before.updated_at.getTime());
  });

  it('upsertMany rolls back the entire batch and throws on DB error', async () => {
    const valid = { identifierType: 'IL_ID', identifierValue: '000000018', verdict: 'APPROVED', approvalExpiration: null };
    // identifier_value is VARCHAR(50) — 51 chars triggers a DB error mid-transaction
    const bad = { identifierType: 'IL_ID', identifierValue: 'x'.repeat(51), verdict: 'APPROVED', approvalExpiration: null };

    await expect(peopleRepo.upsertMany([valid, bad])).rejects.toThrow();

    // Rollback should have undone the valid insert too
    const { rows } = await db.query("SELECT * FROM people WHERE identifier_value = '000000018'");
    expect(rows).toHaveLength(0);
  });
});

describe('GET /people/:id/visits', () => {
  it('returns empty array when person has no visits', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED') RETURNING id"
    );
    const id = rows[0].id;

    const res = await request(app)
      .get(`/people/${id}/visits`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns visits for a person ordered newest first', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED') RETURNING id"
    );
    const id = rows[0].id;

    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source, created_at) VALUES ('VERIFY', '000000018', 'APPROVED', 'manual', NOW() - INTERVAL '2 hours')"
    );
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source, created_at) VALUES ('VERIFY', '000000018', 'APPROVED', 'image', NOW() - INTERVAL '1 hour')"
    );

    const res = await request(app)
      .get(`/people/${id}/visits`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    // newest first
    expect(res.body[0].source).toBe('image');
    expect(res.body[1].source).toBe('manual');
  });

  it('returns 404 when person does not exist', async () => {
    const res = await request(app)
      .get('/people/99999/visits')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/people/1/visits');
    expect(res.status).toBe(401);
  });

  it('returns 400 for non-integer id', async () => {
    const res = await request(app)
      .get('/people/abc/visits')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(400);
  });

  it('only returns VERIFY actions, not CREATE or UPDATE', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED') RETURNING id"
    );
    const id = rows[0].id;

    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('VERIFY', '000000018', 'APPROVED', 'manual')"
    );
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('CREATE', '000000018', 'APPROVED', 'admin')"
    );
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('UPDATE', '000000018', 'APPROVED', 'admin')"
    );

    const res = await request(app)
      .get(`/people/${id}/visits`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].source).toBe('manual');
  });

  it('does not return visits for a different person with a different identifier', async () => {
    const { rows: [personA] } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED') RETURNING id"
    );
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IDF_ID', '1234567', 'APPROVED')"
    );

    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('VERIFY', '000000018', 'APPROVED', 'manual')"
    );
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('VERIFY', '1234567', 'APPROVED', 'image')"
    );

    const res = await request(app)
      .get(`/people/${personA.id}/visits`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].source).toBe('manual');
  });

  it('response includes id, verdict, source, and created_at fields', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED') RETURNING id"
    );
    const id = rows[0].id;

    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('VERIFY', '000000018', 'NOT_FOUND', 'image')"
    );

    const res = await request(app)
      .get(`/people/${id}/visits`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('verdict', 'NOT_FOUND');
    expect(res.body[0]).toHaveProperty('source', 'image');
    expect(res.body[0]).toHaveProperty('created_at');
  });
});

describe('auditRepository.getVisitsByIdentifierValue', () => {
  it('returns only VERIFY entries for the given identifier', async () => {
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('VERIFY', '000000018', 'APPROVED', 'manual')"
    );
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('CREATE', '000000018', 'APPROVED', 'admin')"
    );
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('VERIFY', '9999999', 'NOT_FOUND', 'manual')"
    );

    const rows = await auditRepo.getVisitsByIdentifierValue('000000018');
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('manual');
  });

  it('returns empty array when no VERIFY entries exist', async () => {
    const rows = await auditRepo.getVisitsByIdentifierValue('000000018');
    expect(rows).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await db.query(
        "INSERT INTO audit_logs (action, identifier_value, verdict, source) VALUES ('VERIFY', '000000018', 'APPROVED', 'manual')"
      );
    }
    const rows = await auditRepo.getVisitsByIdentifierValue('000000018', 3);
    expect(rows).toHaveLength(3);
  });

  it('returns results ordered newest first', async () => {
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source, created_at) VALUES ('VERIFY', '000000018', 'APPROVED', 'manual', NOW() - INTERVAL '2 hours')"
    );
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, verdict, source, created_at) VALUES ('VERIFY', '000000018', 'NOT_APPROVED', 'image', NOW() - INTERVAL '1 hour')"
    );

    const rows = await auditRepo.getVisitsByIdentifierValue('000000018');
    expect(rows[0].source).toBe('image');   // newer
    expect(rows[1].source).toBe('manual');  // older
  });
});

describe('auditRepository.recent', () => {
  it('returns recent audit log entries', async () => {
    await db.query(
      "INSERT INTO audit_logs (action, identifier_value, source) VALUES ('VERIFY', '000000018', 'manual')"
    );

    const rows = await auditRepo.recent(10);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].action).toBe('VERIFY');
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await db.query(
        "INSERT INTO audit_logs (action, source) VALUES ('VERIFY', 'manual')"
      );
    }

    const rows = await auditRepo.recent(3);
    expect(rows).toHaveLength(3);
  });
});

// ── Stale expired record filtering (GET /access-requests/mine) ───────────────
// Approved records that expired more than 3 calendar days ago are hidden from
// the requestor's My Submissions view. They remain visible in the admin panel.

describe('GET /access-requests/mine — stale expired record filtering', () => {
  const requestorToken = jwt.sign(
    { sub: 2, username: 'requestor@test.com', role: 'access_requestor' },
    process.env.JWT_SECRET || 'dev-secret'
  );
  const EMAIL = 'requestor@test.com';

  it('returns an approved record that expired 1 day ago', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'APPROVED', NOW() - INTERVAL '1 day', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].identifier_value).toBe('000000018');
  });

  it('returns an approved record that expired exactly 3 days ago (boundary — still visible)', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'APPROVED', NOW() - INTERVAL '3 days', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });

  it('hides an APPROVED record that expired 4 days ago', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'APPROVED', NOW() - INTERVAL '4 days', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(0);
  });

  it('hides an ADMIN_APPROVED record that expired 4 days ago', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'ADMIN_APPROVED', NOW() - INTERVAL '4 days', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(0);
  });

  it('hides an APPROVED_WITH_ESCORT record that expired 4 days ago', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'APPROVED_WITH_ESCORT', NOW() - INTERVAL '4 days', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(0);
  });

  it('always shows a resubmitted (PENDING) record regardless of old expiration date', async () => {
    // After resubmit, verdict = NOT_APPROVED and status = PENDING — never filtered
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'PENDING', NOW() - INTERVAL '10 days', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });

  it('always shows a NOT_APPROVED (rejected) record — no expiration to filter on', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, requester_email)
       VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'NOT_APPROVED', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });

  it('always shows an approved record with no expiration date', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'APPROVED', NULL, $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });

  it('always shows an approved record with a future expiration', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'APPROVED', NOW() + INTERVAL '2 days', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });

  it('returns only the visible records when stale and fresh records are mixed', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'APPROVED', NOW() - INTERVAL '5 days', $1)`,
      [EMAIL]
    );
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IDF_ID', '1234567', 'APPROVED', NOW() - INTERVAL '1 day', $1)`,
      [EMAIL]
    );
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, requester_email)
       VALUES ('IL_ID', '000000026', 'NOT_APPROVED', 'PENDING', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/access-requests/mine')
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(2);
    const ids = res.body.rows.map(r => r.identifier_value);
    expect(ids).not.toContain('000000018'); // stale — hidden
    expect(ids).toContain('1234567');       // recent expired — visible
    expect(ids).toContain('000000026');     // pending — visible
  });

  it('does not affect admin GET /people — stale expired records remain visible to admins', async () => {
    await db.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, requester_email)
       VALUES ('IL_ID', '000000018', 'APPROVED', NOW() - INTERVAL '5 days', $1)`,
      [EMAIL]
    );
    const res = await request(app)
      .get('/people')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
  });
});
