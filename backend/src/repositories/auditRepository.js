'use strict';

const db = require('../config/database');

async function log({ action, identifierType, identifierValue, verdict, source, metadata }) {
  await db.query(
    `INSERT INTO audit_logs (action, identifier_type, identifier_value, verdict, source, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [action, identifierType || null, identifierValue || null, verdict || null, source, metadata ? JSON.stringify(metadata) : null]
  );
}

async function recent(limit = 100) {
  const { rows } = await db.query(
    'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return rows;
}

module.exports = { log, recent };
