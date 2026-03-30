'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/statsController');

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.getStats);

module.exports = router;
