'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');
const gsheetService = require('../src/services/gsheetService');
const personAuditLogRepo = require('../src/repositories/personAuditLogRepository');

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const adminToken = jwt.sign({ sub: 1, username: 'admin', role: 'admin' }, SECRET);
const gateToken = jwt.sign({ sub: 99, username: 'gate_audit_test', role: 'gate' }, SECRET);

const VALID_PERSON = {
  identifierType: 'IL_ID',
  identifierValue: '000000018',
  verdict: 'APPROVED',
};


beforeAll(async () => {
  // Ensure required tables exist (defensive — migrations should have run)
  await db.query(`
    CREATE TABLE IF NOT EXISTS person_audit_log (
      id SERIAL PRIMARY KEY,
      person_id INTEGER NOT NULL,
      event_type VARCHAR(20) NOT NULL,
      changed_by_id INTEGER,
      changed_by_username VARCHAR(100),
      changes JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  await db.query(`
    INSERT INTO users (id, username, password, role, name)
    OVERRIDING SYSTEM VALUE VALUES
      (1,  'admin',           'hash', 'admin', 'Admin User'),
      (99, 'gate_audit_test', 'hash', 'gate',  NULL)
    ON CONFLICT (id) DO UPDATE
      SET username = EXCLUDED.username, role = EXCLUDED.role, name = EXCLUDED.name
  `);
});

beforeEach(async () => {
  await db.query('DELETE FROM person_audit_log');
  await db.query('DELETE FROM audit_logs');
  await db.query('DELETE FROM people');
});

afterAll(async () => {
  await db.end();
});

// ── Repository layer ───────────────────────────────────────────────────────────

describe('personAuditLogRepository', () => {
  it('inserts an entry and returns it', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID','000000018','APPROVED') RETURNING id"
    );
    const personId = rows[0].id;

    const entry = await personAuditLogRepo.insert({
      personId,
      eventType: 'created',
      changedById: 1,
      changedByUsername: 'admin',
      changes: { snapshot: { verdict: 'APPROVED' } },
    });

    expect(entry.person_id).toBe(personId);
    expect(entry.event_type).toBe('created');
    expect(entry.changed_by_id).toBe(1);
    expect(entry.changed_by_username).toBe('admin');
    expect(entry.changes.snapshot.verdict).toBe('APPROVED');
    expect(entry.created_at).toBeDefined();
  });

  it('stores null changedById and changedByUsername gracefully', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID','000000018','APPROVED') RETURNING id"
    );
    const entry = await personAuditLogRepo.insert({
      personId: rows[0].id,
      eventType: 'updated',
      changedById: null,
      changedByUsername: null,
      changes: {},
    });
    expect(entry.changed_by_id).toBeNull();
    expect(entry.changed_by_username).toBeNull();
  });

  it('findByPersonId returns entries in reverse-chronological order', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID','000000018','APPROVED') RETURNING id"
    );
    const personId = rows[0].id;

    await db.query(
      `INSERT INTO person_audit_log (person_id, event_type, changed_by_username, created_at) VALUES
       ($1, 'created', 'admin', NOW() - INTERVAL '2 minutes'),
       ($1, 'updated', 'admin', NOW() - INTERVAL '1 minute'),
       ($1, 'updated', 'admin', NOW())`,
      [personId]
    );

    const entries = await personAuditLogRepo.findByPersonId(personId);
    expect(entries).toHaveLength(3);
    // newest first
    expect(new Date(entries[0].created_at) >= new Date(entries[1].created_at)).toBe(true);
    expect(new Date(entries[1].created_at) >= new Date(entries[2].created_at)).toBe(true);
  });

  it('findByPersonId returns empty array for person with no log entries', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID','000000018','APPROVED') RETURNING id"
    );
    const entries = await personAuditLogRepo.findByPersonId(rows[0].id);
    expect(entries).toEqual([]);
  });

  it('findByPersonId returns empty array for unknown person id', async () => {
    const entries = await personAuditLogRepo.findByPersonId(99999);
    expect(entries).toEqual([]);
  });
});

// ── POST /people → created event ──────────────────────────────────────────────

describe('POST /people → audit log', () => {
  it('logs a created event', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);

    expect(res.status).toBe(201);
    const entries = await personAuditLogRepo.findByPersonId(res.body.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].event_type).toBe('created');
  });

  it('logs the authenticated admin as the actor', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);

    const entries = await personAuditLogRepo.findByPersonId(res.body.id);
    expect(entries[0].changed_by_id).toBe(1);
    expect(entries[0].changed_by_username).toBe('admin');
  });

  it('snapshot contains all submitted field values', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_PERSON, approvalExpiration: '2026-12-31' });

    const entries = await personAuditLogRepo.findByPersonId(res.body.id);
    const snapshot = entries[0].changes.snapshot;
    expect(snapshot.identifier_value).toBe('000000018');
    expect(snapshot.verdict).toBe('APPROVED');
  });

  it('snapshot contains identifier_type', async () => {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);

    const entries = await personAuditLogRepo.findByPersonId(res.body.id);
    expect(entries[0].changes.snapshot.identifier_type).toBe('IL_ID');
  });

  it('does not log an audit entry when request body is invalid', async () => {
    await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ identifierType: 'BAD', identifierValue: '000000018', verdict: 'APPROVED' });

    const { rows } = await db.query('SELECT * FROM person_audit_log');
    expect(rows).toHaveLength(0);
  });

  it('does not log an audit entry when IL_ID fails luhn check', async () => {
    await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ identifierType: 'IL_ID', identifierValue: '000000019', verdict: 'APPROVED' });

    const { rows } = await db.query('SELECT * FROM person_audit_log');
    expect(rows).toHaveLength(0);
  });
});

// ── PUT /people/:id → updated event ──────────────────────────────────────────

describe('PUT /people/:id → audit log', () => {
  async function createPerson(data = VALID_PERSON) {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(data);
    return res.body;
  }

  it('logs an updated event on PUT', async () => {
    const person = await createPerson();
    await db.query('DELETE FROM person_audit_log'); // reset after create

    await request(app)
      .put(`/people/${person.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_PERSON, verdict: 'NOT_APPROVED' });

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].event_type).toBe('updated');
  });

  it('logs the actor correctly on update', async () => {
    const person = await createPerson();
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .put(`/people/${person.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_PERSON, verdict: 'NOT_APPROVED' });

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    expect(entries[0].changed_by_id).toBe(1);
    expect(entries[0].changed_by_username).toBe('admin');
  });

  it('captures changed fields in the diff', async () => {
    const person = await createPerson();
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .put(`/people/${person.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_PERSON, verdict: 'NOT_APPROVED' });

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    const changes = entries[0].changes;
    expect(changes.verdict).toBeDefined();
    expect(changes.verdict.old).toBe('APPROVED');
    expect(changes.verdict.new).toBe('NOT_APPROVED');
  });

  it('captures multiple changed fields in a single update', async () => {
    const person = await createPerson({ ...VALID_PERSON, population: 'Pop A' });
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .put(`/people/${person.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_PERSON, verdict: 'NOT_APPROVED', population: 'Pop B' });

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    const changes = entries[0].changes;
    expect(changes.verdict).toBeDefined();
    expect(changes.population).toBeDefined();
    expect(changes.population.old).toBe('Pop A');
    expect(changes.population.new).toBe('Pop B');
  });

  it('only includes changed fields in the diff (unchanged fields absent)', async () => {
    const person = await createPerson();
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .put(`/people/${person.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_PERSON, verdict: 'NOT_APPROVED' });

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    const changes = entries[0].changes;
    expect(Object.keys(changes)).not.toContain('identifier_value');
    expect(Object.keys(changes)).not.toContain('identifier_type');
  });

  it('does not log an audit entry when person is not found', async () => {
    await request(app)
      .put('/people/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);

    const { rows } = await db.query('SELECT * FROM person_audit_log');
    expect(rows).toHaveLength(0);
  });
});

// ── PATCH /people/:id/status → updated event ──────────────────────────────────

describe('PATCH /people/:id/status → audit log', () => {
  async function createPerson() {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);
    return res.body;
  }

  it('logs updated event when status changes to NOT_APPROVED', async () => {
    const person = await createPerson();
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .patch(`/people/${person.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'NOT_APPROVED', rejectionReason: 'Not eligible' });

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries[0].event_type).toBe('updated');
  });

  it('captures verdict change in diff when status is set to APPROVED', async () => {
    const person = await createPerson();
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .patch(`/people/${person.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED', verdict: 'ADMIN_APPROVED' });

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    const changes = entries[0].changes;
    expect(changes.verdict).toBeDefined();
    expect(changes.verdict.new).toBe('ADMIN_APPROVED');
  });

  it('captures rejectionReason in diff when rejecting', async () => {
    const person = await createPerson();
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .patch(`/people/${person.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'NOT_APPROVED', rejectionReason: 'Blocked' });

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    const changes = entries[0].changes;
    expect(changes.rejection_reason).toBeDefined();
    expect(changes.rejection_reason.new).toBe('Blocked');
  });

  it('logs the actor correctly on status update', async () => {
    const person = await createPerson();
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .patch(`/people/${person.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'NOT_APPROVED', rejectionReason: 'Blocked' });

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    expect(entries[0].changed_by_username).toBe('admin');
  });
});

// ── DELETE /people/:id → deleted event ────────────────────────────────────────

describe('DELETE /people/:id → audit log', () => {
  async function createPerson() {
    const res = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);
    return res.body;
  }

  it('logs a deleted event', async () => {
    const person = await createPerson();
    const personId = person.id;
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .delete(`/people/${personId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const entries = await personAuditLogRepo.findByPersonId(personId);
    expect(entries).toHaveLength(1);
    expect(entries[0].event_type).toBe('deleted');
  });

  it('snapshot in deleted event contains the full record at time of deletion', async () => {
    const person = await createPerson();
    const personId = person.id;
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .delete(`/people/${personId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const entries = await personAuditLogRepo.findByPersonId(personId);
    const snapshot = entries[0].changes.snapshot;
    expect(snapshot.identifier_value).toBe('000000018');
    expect(snapshot.verdict).toBe('APPROVED');
  });

  it('logs the actor correctly on delete', async () => {
    const person = await createPerson();
    await db.query('DELETE FROM person_audit_log');

    await request(app)
      .delete(`/people/${person.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const entries = await personAuditLogRepo.findByPersonId(person.id);
    expect(entries[0].changed_by_id).toBe(1);
    expect(entries[0].changed_by_username).toBe('admin');
  });

  it('does not log an audit entry when person is not found on delete', async () => {
    await request(app)
      .delete('/people/999999')
      .set('Authorization', `Bearer ${adminToken}`);

    const { rows } = await db.query('SELECT * FROM person_audit_log');
    expect(rows).toHaveLength(0);
  });
});

// ── GET /people/:id/audit-log ─────────────────────────────────────────────────

describe('GET /people/:id/audit-log', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/people/1/audit-log');
    expect(res.status).toBe(401);
  });

  it('returns 403 for gate role', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID','000000018','APPROVED') RETURNING id"
    );
    const res = await request(app)
      .get(`/people/${rows[0].id}/audit-log`)
      .set('Authorization', `Bearer ${gateToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent person', async () => {
    const res = await request(app)
      .get('/people/999999/audit-log')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 200 with empty array for person with no log', async () => {
    const { rows } = await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID','000000018','APPROVED') RETURNING id"
    );
    const res = await request(app)
      .get(`/people/${rows[0].id}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns entries with required fields', async () => {
    const createRes = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);

    const res = await request(app)
      .get(`/people/${createRes.body.id}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const entry = res.body[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('event_type');
    expect(entry).toHaveProperty('changed_by_username');
    expect(entry).toHaveProperty('changes');
    expect(entry).toHaveProperty('created_at');
  });

  it('returns entries in reverse-chronological order', async () => {
    const createRes = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);

    await request(app)
      .put(`/people/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_PERSON, verdict: 'NOT_APPROVED' });

    const res = await request(app)
      .get(`/people/${createRes.body.id}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body).toHaveLength(2);
    // newest first
    expect(res.body[0].event_type).toBe('updated');
    expect(res.body[1].event_type).toBe('created');
  });

  it('multiple mutations produce correctly ordered log entries', async () => {
    const createRes = await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);
    const id = createRes.body.id;

    await request(app).put(`/people/${id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ ...VALID_PERSON, verdict: 'NOT_APPROVED' });
    await request(app).patch(`/people/${id}/status`).set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED', verdict: 'ADMIN_APPROVED' });

    const res = await request(app)
      .get(`/people/${id}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.body).toHaveLength(3);
    expect(res.body[0].event_type).toBe('updated'); // most recent status change
    expect(res.body[2].event_type).toBe('created');
  });
});

// ── CSV bulk upload → created events per inserted row ────────────────────────

describe('POST /people/upload-csv → audit log', () => {
  it('logs a created event per inserted row', async () => {
    const csv = Buffer.from(
      'identifier_type,identifier_value,verdict\nIL_ID,000000018,APPROVED\nIL_ID,000000026,NOT_APPROVED\n'
    );

    const res = await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csv, { filename: 'data.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(2);

    const { rows: auditRows } = await db.query(
      "SELECT * FROM person_audit_log WHERE event_type = 'created'"
    );
    expect(auditRows).toHaveLength(2);
  });

  it('logs actor on each inserted CSV row', async () => {
    const csv = Buffer.from('identifier_type,identifier_value,verdict\nIL_ID,000000018,APPROVED\n');

    await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csv, { filename: 'data.csv', contentType: 'text/csv' });

    const { rows } = await db.query("SELECT * FROM person_audit_log WHERE event_type = 'created'");
    expect(rows[0].changed_by_username).toBe('admin');
  });

  it('does not log audit entries for rows with validation errors', async () => {
    const csv = Buffer.from('identifier_type,identifier_value,verdict\nBAD_TYPE,000000018,APPROVED\n');

    await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csv, { filename: 'data.csv', contentType: 'text/csv' });

    const { rows } = await db.query('SELECT * FROM person_audit_log');
    expect(rows).toHaveLength(0);
  });

  it('does not log audit entries for rows that are updates (already exist)', async () => {
    // Insert person first
    await request(app)
      .post('/people')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(VALID_PERSON);
    await db.query('DELETE FROM person_audit_log');

    // Re-upload same person — it's an upsert/update, not a new insert
    const csv = Buffer.from('identifier_type,identifier_value,verdict\nIL_ID,000000018,NOT_APPROVED\n');
    await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csv, { filename: 'data.csv', contentType: 'text/csv' });

    const { rows } = await db.query("SELECT * FROM person_audit_log WHERE event_type = 'created'");
    expect(rows).toHaveLength(0);
  });

  it('snapshot source field is csv_import for CSV uploads', async () => {
    const csv = Buffer.from('identifier_type,identifier_value,verdict\nIL_ID,000000018,APPROVED\n');

    await request(app)
      .post('/people/upload-csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csv, { filename: 'data.csv', contentType: 'text/csv' });

    const { rows } = await db.query("SELECT * FROM person_audit_log WHERE event_type = 'created'");
    expect(rows[0].changes.source).toBe('csv_import');
  });
});

// ── GSheet import → created events per inserted row ───────────────────────────

describe('POST /people/import-gsheet → audit log', () => {
  beforeEach(() => {
    jest.spyOn(gsheetService, 'fetchAndParse').mockResolvedValue([
      { rowNum: 2, identifierValue: '000000018', verdict: 'APPROVED', population: null, reason: null, escortName: null, requesterEmail: null },
      { rowNum: 3, identifierValue: '000000026', verdict: 'NOT_APPROVED', population: null, reason: null, escortName: null, requesterEmail: null },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a created event per inserted row from GSheet', async () => {
    const res = await request(app)
      .post('/people/import-gsheet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://docs.google.com/spreadsheets/fake' });

    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(2);

    const { rows } = await db.query("SELECT * FROM person_audit_log WHERE event_type = 'created'");
    expect(rows).toHaveLength(2);
  });

  it('logs actor on each inserted GSheet row', async () => {
    await request(app)
      .post('/people/import-gsheet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://docs.google.com/spreadsheets/fake' });

    const { rows } = await db.query("SELECT * FROM person_audit_log WHERE event_type = 'created'");
    expect(rows.every(r => r.changed_by_username === 'admin')).toBe(true);
  });

  it('snapshot source is gsheet_import for GSheet rows', async () => {
    await request(app)
      .post('/people/import-gsheet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://docs.google.com/spreadsheets/fake' });

    const { rows } = await db.query("SELECT * FROM person_audit_log WHERE event_type = 'created'");
    expect(rows[0].changes.source).toBe('gsheet_import');
  });

  it('does not log entries for skipped rows (null verdict)', async () => {
    jest.spyOn(gsheetService, 'fetchAndParse').mockResolvedValue([
      { rowNum: 2, identifierValue: '000000018', verdict: null, population: null, reason: null, escortName: null, requesterEmail: null },
    ]);

    await request(app)
      .post('/people/import-gsheet')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://docs.google.com/spreadsheets/fake' });

    const { rows } = await db.query('SELECT * FROM person_audit_log');
    expect(rows).toHaveLength(0);
  });
});
