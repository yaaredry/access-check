'use strict';

const db = require('../config/database');

async function findAll({ search, limit = 50, offset = 0 }) {
  let query = `
    SELECT id, identifier_type, identifier_value, verdict,
           approval_expiration, created_at, updated_at, last_seen_at,
           population, division, escort_full_name, escort_phone, reason, status
    FROM people
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` WHERE identifier_value ILIKE $${params.length}`;
  }

  query += ` ORDER BY (status = 'PENDING') DESC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await db.query(query, params);

  const countQuery = search
    ? 'SELECT COUNT(*) FROM people WHERE identifier_value ILIKE $1'
    : 'SELECT COUNT(*) FROM people';
  const countParams = search ? [`%${search}%`] : [];
  const { rows: countRows } = await db.query(countQuery, countParams);

  return { rows, total: parseInt(countRows[0].count, 10) };
}

async function findById(id) {
  const { rows } = await db.query(
    'SELECT * FROM people WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function findByIdentifier(identifierType, identifierValue) {
  const { rows } = await db.query(
    'SELECT * FROM people WHERE identifier_type = $1 AND identifier_value = $2',
    [identifierType, identifierValue]
  );
  return rows[0] || null;
}

async function findByIdentifierValue(identifierValue) {
  const { rows } = await db.query(
    'SELECT * FROM people WHERE identifier_value = $1 ORDER BY created_at DESC LIMIT 1',
    [identifierValue]
  );
  return rows[0] || null;
}

async function create({ identifierType, identifierValue, verdict, approvalExpiration, population, division, escortFullName, escortPhone, reason, status }) {
  const { rows } = await db.query(
    `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration,
                         population, division, escort_full_name, escort_phone, reason, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [identifierType, identifierValue, verdict, approvalExpiration || null,
     population || null, division || null, escortFullName || null, escortPhone || null, reason || null, status || null]
  );
  return rows[0];
}

async function update(id, { identifierType, identifierValue, verdict, approvalExpiration, population, division, escortFullName, escortPhone, reason, status }) {
  const { rows } = await db.query(
    `UPDATE people
     SET identifier_type    = COALESCE($2, identifier_type),
         identifier_value   = COALESCE($3, identifier_value),
         verdict            = COALESCE($4, verdict),
         approval_expiration = $5,
         population         = COALESCE($6, population),
         division           = COALESCE($7, division),
         escort_full_name   = COALESCE($8, escort_full_name),
         escort_phone       = COALESCE($9, escort_phone),
         reason             = COALESCE($10, reason),
         status             = $11
     WHERE id = $1
     RETURNING *`,
    [id, identifierType, identifierValue, verdict, approvalExpiration ?? null,
     population ?? null, division ?? null, escortFullName ?? null, escortPhone ?? null, reason ?? null, status ?? null]
  );
  return rows[0] || null;
}

async function updateStatus(id, status) {
  const { rows } = await db.query(
    `UPDATE people SET status = $2 WHERE id = $1 RETURNING *`,
    [id, status]
  );
  return rows[0] || null;
}

async function touchLastSeen(id) {
  await db.query('UPDATE people SET last_seen_at = NOW() WHERE id = $1', [id]);
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM people WHERE id = $1', [id]);
  return rowCount > 0;
}

async function upsertMany(records) {
  const client = await db.connect();
  let inserted = 0;
  let updated = 0;

  try {
    await client.query('BEGIN');
    for (const r of records) {
      const { rows } = await client.query(
        `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, population, reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (identifier_type, identifier_value)
         DO UPDATE SET verdict = EXCLUDED.verdict,
                       approval_expiration = EXCLUDED.approval_expiration,
                       population = COALESCE(EXCLUDED.population, people.population),
                       reason = COALESCE(EXCLUDED.reason, people.reason),
                       updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
        [r.identifierType, r.identifierValue, r.verdict, r.approvalExpiration || null, r.population || null, r.reason || null]
      );
      if (rows[0].inserted) inserted++;
      else updated++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { inserted, updated };
}

module.exports = {
  findAll,
  findById,
  findByIdentifier,
  findByIdentifierValue,
  create,
  update,
  updateStatus,
  remove,
  upsertMany,
  touchLastSeen,
};
