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
