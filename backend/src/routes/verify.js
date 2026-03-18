'use strict';

const { Router } = require('express');
const multer = require('multer');
const { verifyLimiter } = require('../middlewares/rateLimiter');
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/verifyController');

const router = Router();

router.use(authenticate);

// Image upload — memory only, never persisted
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '5', 10)) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are accepted'), false);
    }
  },
});

router.post('/id', verifyLimiter, ctrl.idVerifyValidation, ctrl.verifyId);
router.post('/image', verifyLimiter, imageUpload.single('image'), ctrl.verifyImage);

module.exports = router;
