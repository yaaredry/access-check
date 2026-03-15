'use strict';

const logger = require('../config/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Record already exists with this identifier' });
  }

  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
