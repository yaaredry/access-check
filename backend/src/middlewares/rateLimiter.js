'use strict';

const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const max = process.env.NODE_ENV === 'test'
  ? 10000
  : parseInt(process.env.RATE_LIMIT_MAX || '60', 10);

// General API limit — defense-in-depth behind nginx
const apiLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Verify endpoints — OCR is expensive
const verifyLimiter = rateLimit({
  windowMs: 60000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification requests, please try again later.' },
});

// Login — brute-force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

module.exports = { apiLimiter, verifyLimiter, authLimiter };
