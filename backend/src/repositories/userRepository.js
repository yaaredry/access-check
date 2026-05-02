'use strict';

const db = require('../config/database');

async function findByUsername(username) {
  const { rows } = await db.query(
    'SELECT id, username, password, role, name FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(
    'SELECT id, username, role FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function listRequestors() {
  const { rows } = await db.query(
    `SELECT u.id, u.username, u.name, u.role, u.created_at, u.updated_at, u.max_request_days,
            COUNT(p.id)::int AS request_count
     FROM users u
     LEFT JOIN people p ON LOWER(p.requester_email) = LOWER(u.username)
     WHERE u.role = 'access_requestor'
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );
  return rows;
}

async function createUser({ username, password, name, maxRequestDays = 7 }) {
  const { rows } = await db.query(
    `INSERT INTO users (username, password, role, name, max_request_days)
     VALUES ($1, $2, 'access_requestor', $3, $4)
     RETURNING id, username, name, role, max_request_days, created_at`,
    [username.toLowerCase(), password, name, maxRequestDays]
  );
  return rows[0];
}

async function updateUser(id, { username, name, maxRequestDays }) {
  const { rows } = await db.query(
    `UPDATE users
     SET username = $2, name = $3, max_request_days = $4, updated_at = NOW()
     WHERE id = $1 AND role = 'access_requestor'
     RETURNING id, username, name, role, max_request_days, created_at`,
    [id, username.toLowerCase(), name, maxRequestDays]
  );
  return rows[0] || null;
}

async function updatePassword(id, password) {
  const { rows } = await db.query(
    `UPDATE users
     SET password = $2, updated_at = NOW()
     WHERE id = $1 AND role = 'access_requestor'
     RETURNING id, username, name, role, created_at`,
    [id, password]
  );
  return rows[0] || null;
}

async function removeUser(id) {
  const { rowCount } = await db.query(
    "DELETE FROM users WHERE id = $1 AND role = 'access_requestor'",
    [id]
  );
  return rowCount > 0;
}

async function getMaxRequestDays(username) {
  const { rows } = await db.query(
    'SELECT max_request_days FROM users WHERE LOWER(username) = LOWER($1)',
    [username]
  );
  return rows[0]?.max_request_days ?? 7;
}

module.exports = { findByUsername, findById, listRequestors, createUser, updateUser, updatePassword, removeUser, getMaxRequestDays };
