'use strict';

const { body } = require('express-validator');
const { validate } = require('../middlewares/validate');
const authService = require('../services/authService');
const logger = require('../config/logger');

const loginValidation = [
  body('username').trim().notEmpty().withMessage('username is required'),
  body('password').notEmpty().withMessage('password is required'),
  validate,
];

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    logger.info({ message: 'Admin login', username });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, loginValidation };
