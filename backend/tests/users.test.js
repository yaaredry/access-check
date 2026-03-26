'use strict';

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const adminToken = jwt.sign({ sub: 99, username: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'dev-secret');
const requestorToken = jwt.sign({ sub: 98, username: 'req@test.com', role: 'access_requestor' }, process.env.JWT_SECRET || 'dev-secret');

beforeAll(async () => {
  // Ensure table exists (migrations may not have run in CI) without dropping seeded data
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   VARCHAR(100) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      role       VARCHAR(20) NOT NULL DEFAULT 'admin',
      name       VARCHAR(150),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
});

beforeEach(async () => {
  // Only remove test-inserted rows; preserve seeded admin/gate/requestor users from migrations
  await db.query("DELETE FROM users WHERE username LIKE '%@example.com' OR username LIKE '%@test.com'");
});

afterAll(async () => {
  await db.end();
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function insertUser({ username = 'test@example.com', name = 'Test User', role = 'access_requestor', password = 'hashed' } = {}) {
  const { rows } = await db.query(
    `INSERT INTO users (username, password, role, name) VALUES ($1, $2, $3, $4) RETURNING *`,
    [username, password, role, name]
  );
  return rows[0];
}

// ── GET /users ────────────────────────────────────────────────────────────────

describe('GET /users', () => {
  it('returns access_requestor users and excludes admin users', async () => {
    await insertUser({ username: 'req@example.com', role: 'access_requestor' });
    await insertUser({ username: 'admin@example.com', role: 'admin' });

    const res = await request(app).get('/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const usernames = res.body.users.map(u => u.username);
    expect(usernames).toContain('req@example.com');
    expect(usernames).not.toContain('admin@example.com');
  });

  it('returns an array (may include seeded users)', async () => {
    const res = await request(app).get('/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it('does not include password in response', async () => {
    await insertUser();
    const res = await request(app).get('/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.users[0].password).toBeUndefined();
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const res = await request(app).get('/users').set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(403);
  });
});

// ── POST /users ───────────────────────────────────────────────────────────────

describe('POST /users', () => {
  it('creates a user, returns plainPassword and no password hash', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'new@example.com', name: 'New User' });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe('new@example.com');
    expect(res.body.name).toBe('New User');
    expect(res.body.role).toBe('access_requestor');
    expect(typeof res.body.plainPassword).toBe('string');
    expect(res.body.plainPassword).toHaveLength(5);
    expect(res.body.password).toBeUndefined();
  });

  it('stores a bcrypt hash, not plaintext', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'hash@example.com', name: 'Hash Test' });

    const { rows } = await db.query('SELECT password FROM users WHERE username = $1', ['hash@example.com']);
    const valid = await bcrypt.compare(res.body.plainPassword, rows[0].password);
    expect(valid).toBe(true);
  });

  it('normalises username to lowercase', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'Upper@Example.COM', name: 'Case Test' });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe('upper@example.com');
  });

  it('returns 409 on duplicate email', async () => {
    await insertUser({ username: 'dup@example.com' });
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'dup@example.com', name: 'Dup' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'not-an-email', name: 'Bad' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'noname@example.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/users').send({ username: 'a@b.com', name: 'X' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${requestorToken}`)
      .send({ username: 'a@b.com', name: 'X' });
    expect(res.status).toBe(403);
  });
});

// ── PUT /users/:id ────────────────────────────────────────────────────────────

describe('PUT /users/:id', () => {
  it('updates name and username', async () => {
    const user = await insertUser({ username: 'old@example.com', name: 'Old Name' });
    const res = await request(app)
      .put(`/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'new@example.com', name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('new@example.com');
    expect(res.body.name).toBe('New Name');
  });

  it('allows updating to the same email (self)', async () => {
    const user = await insertUser({ username: 'same@example.com', name: 'Same' });
    const res = await request(app)
      .put(`/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'same@example.com', name: 'Same Updated' });
    expect(res.status).toBe(200);
  });

  it('returns 409 when email belongs to another user', async () => {
    await insertUser({ username: 'taken@example.com', name: 'Taken' });
    const user = await insertUser({ username: 'other@example.com', name: 'Other' });
    const res = await request(app)
      .put(`/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'taken@example.com', name: 'Other' });
    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .put('/users/99999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'x@example.com', name: 'X' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).put('/users/1').send({ username: 'a@b.com', name: 'X' });
    expect(res.status).toBe(401);
  });
});

// ── POST /users/:id/regenerate-password ───────────────────────────────────────

describe('POST /users/:id/regenerate-password', () => {
  it('returns a new plainPassword and updates the hash', async () => {
    const oldHash = await bcrypt.hash('oldpw', 12);
    const user = await insertUser({ username: 'regen@example.com', password: oldHash });

    const res = await request(app)
      .post(`/users/${user.id}/regenerate-password`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.plainPassword).toBe('string');
    expect(res.body.plainPassword).toHaveLength(5);

    const { rows } = await db.query('SELECT password FROM users WHERE id = $1', [user.id]);
    const oldStillValid = await bcrypt.compare('oldpw', rows[0].password);
    expect(oldStillValid).toBe(false);

    const newValid = await bcrypt.compare(res.body.plainPassword, rows[0].password);
    expect(newValid).toBe(true);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .post('/users/99999/regenerate-password')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/users/1/regenerate-password');
    expect(res.status).toBe(401);
  });
});

// ── DELETE /users/:id ─────────────────────────────────────────────────────────

describe('DELETE /users/:id', () => {
  it('deletes the user and returns 204', async () => {
    const user = await insertUser();
    const res = await request(app)
      .delete(`/users/${user.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);

    const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [user.id]);
    expect(rows).toHaveLength(0);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/users/99999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('cannot delete an admin user', async () => {
    const admin = await insertUser({ username: 'admin2@example.com', role: 'admin' });
    const res = await request(app)
      .delete(`/users/${admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).delete('/users/1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    const user = await insertUser();
    const res = await request(app)
      .delete(`/users/${user.id}`)
      .set('Authorization', `Bearer ${requestorToken}`);
    expect(res.status).toBe(403);
  });
});
