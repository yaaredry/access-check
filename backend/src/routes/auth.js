'use strict';

const { Router } = require('express');
const { login, loginValidation } = require('../controllers/authController');
const { authLimiter } = require('../middlewares/rateLimiter');

const router = Router();

router.post('/login', authLimiter, loginValidation, login);

module.exports = router;
