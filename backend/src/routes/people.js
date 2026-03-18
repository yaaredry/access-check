'use strict';

const { Router } = require('express');
const multer = require('multer');
const { authenticate, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/peopleController');

const router = Router();

// CSV upload — memory storage only, no disk writes
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5', 10)) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'), false);
    }
  },
});

router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.listQueryValidation, ctrl.list);
router.post('/', ctrl.personBodyValidation, ctrl.create);

// bulk upload must be declared before /:id to avoid route collision
router.post('/upload-csv', csvUpload.single('file'), ctrl.uploadCSV);
router.post('/import-gsheet', ctrl.importGSheet);

router.get('/:id', ctrl.idParamValidation, ctrl.getOne);
router.put('/:id', ctrl.idParamValidation, ctrl.personBodyValidation, ctrl.update);
router.delete('/:id', ctrl.idParamValidation, ctrl.remove);

module.exports = router;
