'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const ocrService = require('../src/services/ocrService');

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
      CONSTRAINT uq_verify_identifier UNIQUE (identifier_type, identifier_value)
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

describe('POST /verify/id', () => {
  it('returns APPROVED for an approved person', async () => {
    await db.query(
      "INSERT INTO people (identifier_type, identifier_value, verdict) VALUES ('IL_ID', '000000018', 'APPROVED')"
    );

    const res = await request(app)
      .post('/verify/id')
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
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('NOT_APPROVED');
  });

  it('returns NOT_FOUND for unknown person', async () => {
    const res = await request(app)
      .post('/verify/id')
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
      .send({ identifierType: 'IL_ID', identifierValue: '000000018' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('EXPIRED');
  });

  it('returns 400 for invalid identifierType', async () => {
    const res = await request(app)
      .post('/verify/id')
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
    const res = await request(app).post('/verify/image');
    expect(res.status).toBe(400);
  });

  it('returns NOT_FOUND when OCR finds no matching IDs', async () => {
    jest.spyOn(ocrService, 'processImage').mockResolvedValue({ ilIds: [], idfIds: [], raw: '' });

    const res = await request(app)
      .post('/verify/image')
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
      .attach('image', Buffer.from('fake-image-data'), { filename: 'id.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('APPROVED');
    expect(res.body.identifierType).toBe('IDF_ID');
  });
});
