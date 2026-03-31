'use strict';

const db = require('../config/database');

// ---------------------------------------------------------------------------
// Gate client activity — sourced from audit_logs (action = 'VERIFY')
// ---------------------------------------------------------------------------

async function getGateScanCounts() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')  AS last_24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '72 hours')  AS last_72h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')    AS last_7d,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')   AS last_30d,
      COUNT(*)                                                           AS all_time
    FROM audit_logs
    WHERE action = 'VERIFY'
  `);
  return rows[0];
}

async function getGateScanVerdictBreakdown() {
  const { rows } = await db.query(`
    SELECT verdict, COUNT(*) AS count
    FROM audit_logs
    WHERE action = 'VERIFY' AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY verdict
    ORDER BY count DESC
  `);
  return rows;
}

// ---------------------------------------------------------------------------
// Requestor activity — sourced from people table
// ---------------------------------------------------------------------------

async function getRequestCounts() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')  AS last_24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '72 hours')  AS last_72h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')    AS last_7d,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')   AS last_30d,
      COUNT(*)                                                           AS all_time
    FROM people
  `);
  return rows[0];
}

async function getPendingBacklog() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*)                                                                      AS total,
      COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '48 hours')             AS stale_48h,
      COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days')               AS stale_7d
    FROM people
    WHERE status = 'PENDING'
  `);
  return rows[0];
}

async function getTopRequestors({ limit = 10 } = {}) {
  const { rows } = await db.query(`
    SELECT
      COALESCE(requester_email, requester_name, 'unknown')  AS email,
      COALESCE(requester_name, requester_email, 'unknown')  AS display_name,
      COUNT(*)                                               AS total,
      COUNT(*) FILTER (WHERE status = 'PENDING')            AS pending,
      COUNT(*) FILTER (WHERE status = 'APPROVED')           AS approved,
      COUNT(*) FILTER (WHERE status = 'NOT_APPROVED')       AS not_approved
    FROM people
    WHERE requester_email IS NOT NULL OR requester_name IS NOT NULL
    GROUP BY requester_email, requester_name
    ORDER BY total DESC
    LIMIT $1
  `, [limit]);
  return rows;
}

async function getPopulationBreakdown() {
  const { rows } = await db.query(`
    SELECT population, COUNT(*) AS count
    FROM people
    WHERE population IS NOT NULL
    GROUP BY population
    ORDER BY count DESC
  `);
  return rows;
}

async function getApprovalRate() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'APPROVED')     AS approved,
      COUNT(*) FILTER (WHERE status = 'NOT_APPROVED') AS not_approved,
      COUNT(*) FILTER (WHERE status != 'PENDING')     AS total_decided
    FROM people
  `);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Admin activity — sourced from people.status_changed_at and audit_logs
// ---------------------------------------------------------------------------

async function getVerdictCounts() {
  const { rows } = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status_changed_at > NOW() - INTERVAL '24 hours')  AS last_24h,
      COUNT(*) FILTER (WHERE status_changed_at > NOW() - INTERVAL '72 hours')  AS last_72h,
      COUNT(*) FILTER (WHERE status_changed_at > NOW() - INTERVAL '7 days')    AS last_7d,
      COUNT(*) FILTER (WHERE status_changed_at > NOW() - INTERVAL '30 days')   AS last_30d
    FROM people
    WHERE status != 'PENDING' AND status_changed_at IS NOT NULL
  `);
  return rows[0];
}

async function getAvgTimeToVerdict() {
  const { rows } = await db.query(`
    SELECT
      ROUND(CAST(median AS numeric), 1) AS median_hours_7d,
      ROUND(CAST(avg    AS numeric), 1) AS avg_hours_7d
    FROM (
      SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (status_changed_at - created_at)) / 3600
        ) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS median,
        AVG(EXTRACT(EPOCH FROM (status_changed_at - created_at)) / 3600)
          FILTER (WHERE created_at > NOW() - INTERVAL '7 days')  AS avg
      FROM people
      WHERE status != 'PENDING' AND status_changed_at IS NOT NULL
    ) sub
  `);
  return rows[0];
}

async function getHourlyScanActivity({ days = 3 } = {}) {
  const { rows } = await db.query(`
    SELECT
      date_trunc('hour', created_at AT TIME ZONE 'UTC') AS hour_utc,
      COUNT(*) AS count
    FROM audit_logs
    WHERE action = 'VERIFY'
      AND created_at > NOW() - ($1 || ' days')::INTERVAL
    GROUP BY 1
    ORDER BY 1
  `, [days]);
  return rows.map(r => ({ hour: r.hour_utc, count: Number(r.count) }));
}

module.exports = {
  getGateScanCounts,
  getGateScanVerdictBreakdown,
  getHourlyScanActivity,
  getRequestCounts,
  getPendingBacklog,
  getTopRequestors,
  getPopulationBreakdown,
  getApprovalRate,
  getVerdictCounts,
  getAvgTimeToVerdict,
};
