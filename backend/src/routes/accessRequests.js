'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/accessRequestController');

const router = Router();

router.post('/', authenticate, requireRole('access_requestor'), ctrl.requestBodyValidation, ctrl.create);
router.post('/:id/resubmit', authenticate, requireRole('access_requestor'), ctrl.resubmitBodyValidation, ctrl.resubmit);
router.get('/mine', authenticate, requireRole('access_requestor'), ctrl.mine);

module.exports = router;
