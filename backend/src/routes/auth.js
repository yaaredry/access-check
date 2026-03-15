'use strict';

const { Router } = require('express');
const { login, loginValidation } = require('../controllers/authController');

const router = Router();

router.post('/login', loginValidation, login);

module.exports = router;
