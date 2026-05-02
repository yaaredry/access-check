'use strict';

/**
 * Dev-only seed script — populates mock data to review all recent features.
 * Safe to run repeatedly (upserts / clears only dev data).
 * Run: node backend/scripts/seed-dev.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'access_check',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

async function run() {
  const client = await pool.connect();
  try {
    // ── 1. Requestor users ────────────────────────────────────────────────────
    const password = await bcrypt.hash('Test1234!', 12);

    // User A: default 7-day max
    await client.query(
      `INSERT INTO users (username, password, role, name, max_request_days)
       VALUES ('dana@dev.local', $1, 'access_requestor', 'Dana Dev', 7)
       ON CONFLICT (username) DO UPDATE
         SET password = EXCLUDED.password, max_request_days = EXCLUDED.max_request_days, name = EXCLUDED.name`,
      [password]
    );

    // User B: restricted 3-day max (to demo dynamic chips)
    await client.query(
      `INSERT INTO users (username, password, role, name, max_request_days)
       VALUES ('oren@dev.local', $1, 'access_requestor', 'Oren Dev', 3)
       ON CONFLICT (username) DO UPDATE
         SET password = EXCLUDED.password, max_request_days = EXCLUDED.max_request_days, name = EXCLUDED.name`,
      [password]
    );

    console.log('✓ Requestor users: dana@dev.local (7d), oren@dev.local (3d) — password: Test1234!');

    // ── 2. Clear previous dev people records ──────────────────────────────────
    await client.query(`DELETE FROM people WHERE requester_email IN ('dana@dev.local', 'oren@dev.local')`);

    // ── 3. People records for dana@dev.local ─────────────────────────────────
    // Each covers a different filter/feature scenario

    // (a) PENDING — waiting for admin review
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration,
        population, division, reason, requester_name, requester_email, created_at)
       VALUES ('IL_ID', '000000018', 'NOT_APPROVED', 'PENDING', $1,
        'IL_MILITARY', 'Unit 8200', 'Supply delivery', 'Dana Dev', 'dana@dev.local', NOW() - INTERVAL '1 hour')`,
      [daysFromNow(5)]
    );

    // (b) APPROVED — active, no expiry warning
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status,
        approval_start_date, approval_expiration,
        population, division, reason, requester_name, requester_email, created_at)
       VALUES ('IL_ID', '000000026', 'APPROVED', 'APPROVED', $1, $2,
        'IL_MILITARY', 'Logistics', 'Routine inspection', 'Dana Dev', 'dana@dev.local', NOW() - INTERVAL '3 days')`,
      [daysFromNow(0), daysFromNow(6)]
    );

    // (c) APPROVED — expiring in 2 days (warning banner)
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration,
        population, division, reason, requester_name, requester_email, created_at)
       VALUES ('IL_ID', '000000034', 'APPROVED', 'APPROVED', $1,
        'IL_MILITARY', 'Maintenance', 'Equipment check', 'Dana Dev', 'dana@dev.local', NOW() - INTERVAL '5 days')`,
      [daysFromNow(2)]
    );

    // (d) APPROVED_WITH_ESCORT — civilian, active
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration,
        population, escort_full_name, escort_phone, division, reason, requester_name, requester_email, created_at)
       VALUES ('IL_ID', '000000042', 'APPROVED_WITH_ESCORT', 'APPROVED', $1,
        'CIVILIAN', 'Moshe Cohen', '+972501234567', 'Contractors', 'Vendor meeting', 'Dana Dev', 'dana@dev.local', NOW() - INTERVAL '2 days')`,
      [daysFromNow(4)]
    );

    // (e) EXPIRED recently (<= 3 days ago) — visible, tap-to-extend
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration,
        population, division, reason, requester_name, requester_email, created_at)
       VALUES ('IL_ID', '000000059', 'APPROVED', 'APPROVED', $1,
        'IL_MILITARY', 'Operations', 'Weekly visit', 'Dana Dev', 'dana@dev.local', NOW() - INTERVAL '10 days')`,
      [daysFromNow(-1)]
    );

    // (f) EXPIRED stale (> 3 days ago) — hidden by default, visible via "Show all"
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration,
        population, division, reason, requester_name, requester_email, created_at)
       VALUES ('IL_ID', '000000067', 'APPROVED', 'APPROVED', $1,
        'IL_MILITARY', 'Old Unit', 'Archive visit', 'Dana Dev', 'dana@dev.local', NOW() - INTERVAL '30 days')`,
      [daysFromNow(-5)]
    );

    // (g) REJECTED (NOT_APPROVED) — normal rejection
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration,
        population, division, reason, rejection_reason, requester_name, requester_email, created_at)
       VALUES ('IL_ID', '000000075', 'NOT_APPROVED', 'NOT_APPROVED', $1,
        'IL_MILITARY', 'Security', 'Access request', 'Does not meet entry requirements', 'Dana Dev', 'dana@dev.local', NOW() - INTERVAL '2 days')`,
      [daysFromNow(3)]
    );

    // (h) BUG FIX DEMO — rejected record whose approval_expiration has already passed.
    //     Gate-client should show NOT_APPROVED, not EXPIRED.
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration,
        population, division, reason, rejection_reason, requester_name, requester_email, created_at)
       VALUES ('IL_ID', '000000083', 'NOT_APPROVED', 'NOT_APPROVED', $1,
        'CIVILIAN', 'Visitor Center', 'Conference attendance', 'Security clearance not approved', 'Dana Dev', 'dana@dev.local', NOW() - INTERVAL '20 days')`,
      [daysFromNow(-10)]
    );

    // (i) EXTENDED — previously approved, resubmitted (has last_resubmitted_at)
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration,
        population, division, reason, requester_name, requester_email, last_resubmitted_at, created_at)
       VALUES ('IL_ID', '000000091', 'APPROVED', 'APPROVED', $1,
        'IL_MILITARY', 'R&D', 'Project continuation', 'Dana Dev', 'dana@dev.local', NOW() - INTERVAL '1 day', NOW() - INTERVAL '14 days')`,
      [daysFromNow(5)]
    );

    console.log('✓ People records for dana@dev.local:');
    console.log('  000000018 — PENDING');
    console.log('  000000026 — APPROVED (active, with start date)');
    console.log('  000000034 — APPROVED (expiring in 2 days — warning)');
    console.log('  000000042 — APPROVED_WITH_ESCORT (civilian)');
    console.log('  000000059 — EXPIRED recently (tap-to-extend)');
    console.log('  000000067 — EXPIRED stale >3 days (hidden — "Show all" to see)');
    console.log('  000000075 — REJECTED with reason');
    console.log('  000000083 — REJECTED + past expiration (bug fix: gate shows NOT_APPROVED, not EXPIRED)');
    console.log('  000000091 — APPROVED + Extended date shown');

    // ── 4. People record for oren@dev.local (3-day max demo) ─────────────────
    await client.query(
      `INSERT INTO people (identifier_type, identifier_value, verdict, status, approval_expiration,
        population, reason, requester_name, requester_email, created_at)
       VALUES ('IL_ID', '000000109', 'NOT_APPROVED', 'PENDING', $1,
        'IL_MILITARY', 'Short-term access', 'Oren Dev', 'oren@dev.local', NOW())`,
      [daysFromNow(2)]
    );
    console.log('✓ People record for oren@dev.local: 000000109 — PENDING');

    console.log('\nDone! Login credentials:');
    console.log('  Admin:   admin / Admin1234!');
    console.log('  Dana:    dana@dev.local / Test1234!  (max 7 days — chips: Today/Tomorrow/3d/7d)');
    console.log('  Oren:    oren@dev.local / Test1234!  (max 3 days — chips: Today/Tomorrow/3d)');
    console.log('\nTo verify the bug fix, scan ID 000000083 in the gate client — should show NOT_APPROVED.');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Dev seed failed:', err.message);
  process.exit(1);
});
