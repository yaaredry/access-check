'use strict';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/config/database');

beforeAll(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'admin',
      name VARCHAR(150),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin'`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(150)`);
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
  await db.query("DELETE FROM users WHERE username IN ('ci_testuser', 'named_user@test.com')");
});

afterAll(async () => {
  await db.end();
});

async function insertTestUser(password) {
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    "INSERT INTO users (username, password) VALUES ('ci_testuser', $1)",
    [hash]
  );
}

describe('userRepository.findById', () => {
  it('returns null for a non-existent id', async () => {
    const userRepo = require('../src/repositories/userRepository');
    const result = await userRepo.findById(999999);
    expect(result).toBeNull();
  });
});

describe('POST /auth/login', () => {
  it('returns a JWT token on valid credentials', async () => {
    await insertTestUser('secret123');

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'ci_testuser', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.username).toBe('ci_testuser');
  });

  it('returns 401 for a wrong password', async () => {
    await insertTestUser('secret123');

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'ci_testuser', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 401 for an unknown username', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'no_such_user', password: 'anything' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });

  it('returns 400 when username is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ password: 'secret123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'ci_testuser' });

    expect(res.status).toBe(400);
  });

  it('returns name in response and JWT for named users', async () => {
    const hash = await bcrypt.hash('testpass', 10);
    await db.query(
      "INSERT INTO users (username, password, name) VALUES ('named_user@test.com', $1, 'Test User')",
      [hash]
    );

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'named_user@test.com', password: 'testpass' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test User');

    const decoded = jwt.decode(res.body.token);
    expect(decoded.name).toBe('Test User');
  });

  it('returns null name for users without a name set', async () => {
    await insertTestUser('secret123');

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'ci_testuser', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBeNull();
  });

  it('login is case-insensitive for username', async () => {
    const hash = await bcrypt.hash('testpass', 10);
    await db.query(
      "INSERT INTO users (username, password, name) VALUES ('named_user@test.com', $1, 'Test User')",
      [hash]
    );

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'Named_User@Test.com', password: 'testpass' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test User');
  });
});
