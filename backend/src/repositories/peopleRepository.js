'use strict';

const db = require('../config/database');

async function findAll({ search, limit = 50, offset = 0 }) {
  let query = `
    SELECT p.id, p.identifier_type, p.identifier_value, p.verdict,
           p.approval_expiration, p.created_at, p.updated_at, p.last_seen_at,
           p.population, p.division, p.escort_full_name, p.escort_phone, p.reason, p.status,
           p.rejection_reason, p.requester_name, p.requester_email,
           u.name AS requestor_user_name
    FROM people p
    LEFT JOIN users u ON u.username = p.requester_email
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` WHERE p.identifier_value ILIKE $${params.length}`;
  }

  query += ` ORDER BY (p.status = 'PENDING') DESC NULLS LAST, p.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await db.query(query, params);

  const countQuery = search
    ? 'SELECT COUNT(*) FROM people p WHERE p.identifier_value ILIKE $1'
    : 'SELECT COUNT(*) FROM people p';
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

async function create({ identifierType, identifierValue, verdict, approvalExpiration, approvalStartDate, population, division, escortFullName, escortPhone, reason, status, requesterName, requesterEmail }) {
  const { rows } = await db.query(
    `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, approval_start_date,
                         population, division, escort_full_name, escort_phone, reason, status, requester_name, requester_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [identifierType, identifierValue, verdict, approvalExpiration || null, approvalStartDate || null,
     population || null, division || null, escortFullName || null, escortPhone || null, reason || null, status || null, requesterName || null, requesterEmail || null]
  );
  return rows[0];
}

async function update(id, { identifierType, identifierValue, verdict, approvalExpiration, approvalStartDate, population, division, escortFullName, escortPhone, reason, status, rejectionReason, requesterName }) {
  // Compute status_changed_at in JS to avoid PostgreSQL type inference issues with dual $N usage.
  // Pass NOW() when transitioning to a final verdict, null otherwise (COALESCE keeps existing value).
  const statusChangedAt = (status === 'APPROVED' || status === 'NOT_APPROVED') ? new Date() : null;

  const { rows } = await db.query(
    `UPDATE people
     SET identifier_type    = COALESCE($2, identifier_type),
         identifier_value   = COALESCE($3, identifier_value),
         verdict            = COALESCE($4, verdict),
         approval_expiration = COALESCE($5, approval_expiration),
         approval_start_date = $6,
         population         = COALESCE($7, population),
         division           = COALESCE($8, division),
         escort_full_name   = COALESCE($9, escort_full_name),
         escort_phone       = COALESCE($10, escort_phone),
         reason             = COALESCE($11, reason),
         status             = $12,
         rejection_reason   = $13,
         requester_name     = COALESCE($14, requester_name),
         status_changed_at  = COALESCE($15, status_changed_at)
     WHERE id = $1
     RETURNING *`,
    [id, identifierType, identifierValue, verdict, approvalExpiration ?? null,
     approvalStartDate ?? null,
     population ?? null, division ?? null, escortFullName ?? null, escortPhone ?? null, reason ?? null, status ?? null, rejectionReason ?? null, requesterName ?? null,
     statusChangedAt]
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

async function findByRequesterEmail(email) {
  const { rows } = await db.query(
    `SELECT id, identifier_value, status, verdict, approval_expiration, approval_start_date, rejection_reason, created_at,
            last_resubmitted_at, population, division, escort_full_name, escort_phone, reason
     FROM people
     WHERE requester_email = $1
     ORDER BY created_at DESC`,
    [email]
  );
  return rows;
}

async function resubmitById(id, { approvalExpiration, approvalStartDate, population, division, escortFullName, escortPhone, reason, requesterName, requesterEmail }) {
  const { rows } = await db.query(
    `UPDATE people
     SET status             = 'PENDING',
         verdict            = 'NOT_APPROVED',
         rejection_reason   = NULL,
         status_changed_at  = NULL,
         approval_expiration = $2,
         approval_start_date = $3,
         population         = $4,
         division           = $5,
         escort_full_name   = $6,
         escort_phone       = $7,
         reason             = $8,
         requester_name     = $9,
         requester_email    = $10,
         last_resubmitted_at = NOW(),
         updated_at         = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, approvalExpiration || null, approvalStartDate || null, population || null, division || null,
     escortFullName || null, escortPhone || null, reason || null,
     requesterName || null, requesterEmail || null]
  );
  return rows[0] || null;
}

async function upsertMany(records) {
  const client = await db.connect();
  let inserted = 0;
  let updated = 0;

  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL app.suppress_updated_at = 'true'");
    for (const r of records) {
      const { rows } = await client.query(
        `INSERT INTO people (identifier_type, identifier_value, verdict, approval_expiration, population, reason, escort_full_name, requester_email)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (identifier_type, identifier_value)
         DO UPDATE SET verdict = EXCLUDED.verdict,
                       approval_expiration = EXCLUDED.approval_expiration,
                       population = COALESCE(EXCLUDED.population, people.population),
                       reason = COALESCE(EXCLUDED.reason, people.reason),
                       escort_full_name = COALESCE(EXCLUDED.escort_full_name, people.escort_full_name),
                       requester_email = COALESCE(EXCLUDED.requester_email, people.requester_email)
         RETURNING (xmax = 0) AS inserted`,
        [r.identifierType, r.identifierValue, r.verdict, r.approvalExpiration || null, r.population || null, r.reason || null, r.escortName || null, r.requesterEmail || null]
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
  findByRequesterEmail,
  create,
  update,
  updateStatus,
  resubmitById,
  remove,
  upsertMany,
  touchLastSeen,
};
