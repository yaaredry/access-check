'use strict';

const { Router } = require('express');
const { authenticate, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/peopleController');

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.listQueryValidation, ctrl.list);
router.post('/', ctrl.personBodyValidation, ctrl.create);

// CSV bulk upload removed — was used for one-time migration only
router.post('/upload-csv', (_req, res) => res.status(410).json({ error: 'CSV upload has been discontinued.' }));
router.post('/import-gsheet', ctrl.importGSheet);

router.get('/:id', ctrl.idParamValidation, ctrl.getOne);
router.get('/:id/visits', ctrl.idParamValidation, ctrl.getVisits);
router.get('/:id/audit-log', ctrl.idParamValidation, ctrl.getAuditLog);
router.put('/:id', ctrl.idParamValidation, ctrl.personBodyValidation, ctrl.update);
router.patch('/:id/status', ctrl.idParamValidation, ctrl.updateStatus);
router.post('/:id/block', ctrl.idParamValidation, ctrl.blockPerson);
router.post('/:id/unblock', ctrl.idParamValidation, ctrl.unblockPerson);
router.delete('/:id', ctrl.idParamValidation, ctrl.remove);

module.exports = router;
