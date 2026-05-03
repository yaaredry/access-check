'use strict';

const jwt = require('jsonwebtoken');
const db = require('../config/database');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

    // Verify the user still exists in the DB — guards against deleted-account tokens
    const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [payload.sub]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };
