'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/usersController');

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.list);
router.post('/', ctrl.userBodyValidation, ctrl.create);
router.put('/:id', ctrl.idParamValidation, ctrl.userBodyValidation, ctrl.update);
router.post('/:id/regenerate-password', ctrl.idParamValidation, ctrl.regeneratePassword);
router.delete('/:id', ctrl.idParamValidation, ctrl.remove);

module.exports = router;
