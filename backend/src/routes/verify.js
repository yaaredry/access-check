'use strict';

const { Router } = require('express');
const { verifyLimiter } = require('../middlewares/rateLimiter');
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/verifyController');

const router = Router();

router.use(authenticate);

router.post('/id', verifyLimiter, ctrl.idVerifyValidation, ctrl.verifyId);
router.post('/image', (_req, res) => res.status(410).json({ error: 'Image verification has been discontinued.' }));

module.exports = router;
