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

// OCR is mocked so Tesseract is not required in CI
describe('POST /verify/image', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 400 when no image is attached', async () => {
    const res = await request(app)
      .post('/verify/image')
      .set('Authorization', `Bearer ${gateToken}`);
    expect(res.status).toBe(400);
  });

  it('returns NOT_FOUND when OCR finds no matching IDs', async () => {
    jest.spyOn(ocrService, 'processImage').mockResolvedValue({ ilIds: [], idfIds: [], raw: '' });

    const res = await request(app)
      .post('/verify/image')
      .set('Authorization', `Bearer ${gateToken}`)
      .attach('image', Buffer.from('fake-image-data'), { filename: 'id.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('NOT_FOUND');
  });

  it('returns APPROVED when OCR matches an approved IL_ID', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED')"
    );
    jest.spyOn(ocrService, 'processImage').mockResolvedValue({
      ilIds: ['000000018'], idfIds: [], raw: '000000018',
    });

    const res = await request(app)
      .post('/verify/image')
      .set('Authorization', `Bearer ${gateToken}`)
      .attach('image', Buffer.from('fake-image-data'), { filename: 'id.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('APPROVED');
    expect(res.body.identifierValue).toBe('000000018');
  });

  it('returns ADMIN_APPROVED when OCR matches an admin-approved person', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'ADMIN_APPROVED')"
    );
    jest.spyOn(ocrService, 'processImage').mockResolvedValue({
      ilIds: ['000000018'], idfIds: [], raw: '000000018',
    });

    const res = await request(app)
      .post('/verify/image')
      .set('Authorization', `Bearer ${gateToken}`)
      .attach('image', Buffer.from('fake-image-data'), { filename: 'id.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('ADMIN_APPROVED');
  });

  it('returns EXPIRED when matched person has a past expiration', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration) VALUES ('IL_ID', '000000018', 'APPROVED', '2000-01-01')"
    );
    jest.spyOn(ocrService, 'processImage').mockResolvedValue({
      ilIds: ['000000018'], idfIds: [], raw: '000000018',
    });

    const res = await request(app)
      .post('/verify/image')
      .set('Authorization', `Bearer ${gateToken}`)
      .attach('image', Buffer.from('fake-image-data'), { filename: 'id.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('EXPIRED');
  });

  it('falls through to IDF_ID when no IL_ID matches', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IDF_ID', '1234567', 'APPROVED')"
    );
    jest.spyOn(ocrService, 'processImage').mockResolvedValue({
      ilIds: [], idfIds: ['1234567'], raw: '1234567',
    });

    const res = await request(app)
      .post('/verify/image')
      .set('Authorization', `Bearer ${gateToken}`)
      .attach('image', Buffer.from('fake-image-data'), { filename: 'id.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('APPROVED');
    expect(res.body.identifierType).toBe('IDF_ID');
  });
});
