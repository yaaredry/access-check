'use strict';

const db = require('../config/database');

async function findByUsername(username) {
  const { rows } = await db.query(
    'SELECT id, username, password FROM users WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(
    'SELECT id, username FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

module.exports = { findByUsername, findById };
