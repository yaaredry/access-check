#!/usr/bin/env node
'use strict';

/**
 * Requestor management CLI
 *
 * Usage:
 *   node tools/requestor.js add --email <email> --name <name> [--password <pw>]
 *
 * If --password is omitted, a random 5-char password is generated and printed.
 * Reads DB connection from .env in the project root.
 */

const path = require('path');
// Resolve dependencies from backend/node_modules
module.paths.unshift(path.resolve(__dirname, '../backend/node_modules'));
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generatePassword(len = 5) {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const [,, command, ...rest] = process.argv;

  if (command !== 'add') {
    console.error('Usage: node tools/requestor.js add --email <email> --name <name> [--password <pw>]');
    process.exit(1);
  }

  const args = parseArgs(rest);

  if (!args.email || !args.name) {
    console.error('Error: --email and --name are required');
    process.exit(1);
  }

  const email = args.email.toLowerCase();
  const name = args.name;
  const plaintext = args.password || generatePassword();
  const generated = !args.password;

  const hash = await bcrypt.hash(plaintext, 12);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rowCount } = await client.query(
    `INSERT INTO users (username, password, role, name)
     VALUES ($1, $2, 'access_requestor', $3)
     ON CONFLICT (username) DO NOTHING`,
    [email, hash, name]
  );

  await client.end();

  if (rowCount === 0) {
    console.error(`User ${email} already exists — no changes made.`);
    process.exit(1);
  }

  console.log(`\n✓ Requestor added successfully\n`);
  console.log(`  Name:     ${name}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${plaintext}${generated ? '  ← generated, save this now' : ''}`);
  console.log();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
