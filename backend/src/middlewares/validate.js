'use strict';

const { validationResult } = require('express-validator');
const logger = require('../config/logger');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      message: 'Validation failed',
      method: req.method,
      url: req.originalUrl,
      errors: errors.array(),
    });
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
}

module.exports = { validate };
