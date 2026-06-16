'use strict';

const db = require('../config/database');

async function insert({ personId, eventType, changedById, changedByUsername, changes }) {
  const { rows } = await db.query(
    `INSERT INTO person_audit_log (person_id, event_type, changed_by_id, changed_by_username, changes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [personId, eventType, changedById || null, changedByUsername || null, changes ? JSON.stringify(changes) : null]
  );
  return rows[0];
}

async function findByPersonId(personId) {
  const { rows } = await db.query(
    `SELECT id, person_id, event_type, changed_by_id, changed_by_username, changes, created_at
     FROM person_audit_log
     WHERE person_id = $1
     ORDER BY created_at DESC`,
    [personId]
  );
  return rows;
}

module.exports = { insert, findByPersonId };
