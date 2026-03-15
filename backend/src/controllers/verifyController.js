'use strict';

const { body } = require('express-validator');
const { validate } = require('../middlewares/validate');
const verifyService = require('../services/verifyService');
const logger = require('../config/logger');

const idVerifyValidation = [
  body('identifierType').isIn(['IL_ID', 'IDF_ID']).withMessage('identifierType must be IL_ID or IDF_ID'),
  body('identifierValue').trim().notEmpty().withMessage('identifierValue is required'),
  validate,
];

async function verifyId(req, res, next) {
  try {
    const { identifierType, identifierValue } = req.body;
    const result = await verifyService.verifyById(identifierType, identifierValue.trim());
    logger.info({ message: 'ID verify', identifierType, verdict: result.verdict });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function verifyImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    const result = await verifyService.verifyByImage(req.file.buffer);
    logger.info({ message: 'Image verify', verdict: result.verdict });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { verifyId, verifyImage, idVerifyValidation };
