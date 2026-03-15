'use strict';

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

async function run() {
  const client = await pool.connect();
  try {
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const plainPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin1234!';
    const hash = await bcrypt.hash(plainPassword, 12);

    await client.query(
      `INSERT INTO users (username, password)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password`,
      [username, hash]
    );
    console.log(`Admin user '${username}' upserted.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
