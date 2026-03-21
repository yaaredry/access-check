'use strict';

const { body, param, query } = require('express-validator');
const { validate } = require('../middlewares/validate');
const peopleService = require('../services/peopleService');

const IDENTIFIER_TYPES = ['IL_ID', 'IDF_ID'];
const VERDICTS = ['APPROVED', 'ADMIN_APPROVED', 'NOT_APPROVED'];

const personBodyValidation = [
  body('identifierType').isIn(IDENTIFIER_TYPES).withMessage(`identifierType must be one of ${IDENTIFIER_TYPES.join(', ')}`),
  body('identifierValue')
    .trim()
    .notEmpty().withMessage('identifierValue is required')
    .custom((value, { req }) => {
      const type = req.body.identifierType;
      if (!IDENTIFIER_TYPES.includes(type)) return true; // let identifierType validator handle it
      if (!peopleService.validateIdentifierValue(type, value)) {
        throw new Error(`Invalid identifierValue format for type ${type}`);
      }
      return true;
    }),
  body('verdict').isIn(VERDICTS).withMessage(`verdict must be one of ${VERDICTS.join(', ')}`),
  body('approvalExpiration').optional({ nullable: true }).isISO8601().withMessage('approvalExpiration must be a valid date'),
  validate,
];

async function list(req, res, next) {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    const result = await peopleService.listPeople({
      search,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const person = await peopleService.getPerson(parseInt(req.params.id, 10));
    if (!person) return res.status(404).json({ error: 'Person not found' });
    return res.json(person);
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const person = await peopleService.createPerson(req.body);
    return res.status(201).json(person);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const person = await peopleService.updatePerson(parseInt(req.params.id, 10), req.body);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    return res.json(person);
  } catch (err) {
    return next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status, rejectionReason } = req.body;
    if (!['APPROVED', 'NOT_APPROVED'].includes(status)) {
      return res.status(400).json({ error: 'status must be APPROVED or NOT_APPROVED' });
    }
    if (status === 'NOT_APPROVED' && !rejectionReason?.trim()) {
      return res.status(400).json({ error: 'rejectionReason is required when rejecting' });
    }
    const verdict = status === 'APPROVED' ? 'ADMIN_APPROVED' : 'NOT_APPROVED';
    const person = await peopleService.updatePerson(parseInt(req.params.id, 10), {
      verdict,
      status,
      rejectionReason: status === 'NOT_APPROVED' ? rejectionReason.trim() : null,
    });
    if (!person) return res.status(404).json({ error: 'Person not found' });
    return res.json(person);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const deleted = await peopleService.deletePerson(parseInt(req.params.id, 10));
    if (!deleted) return res.status(404).json({ error: 'Person not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

async function importGSheet(req, res, next) {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
    }
    const result = await peopleService.importFromGSheet(url);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function uploadCSV(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }
    const result = await peopleService.bulkUploadCSV(req.file.buffer);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

const idParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
  validate,
];

const listQueryValidation = [
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be 1-200'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset must be >= 0'),
  validate,
];

module.exports = {
  list,
  getOne,
  create,
  update,
  updateStatus,
  remove,
  uploadCSV,
  importGSheet,
  personBodyValidation,
  idParamValidation,
  listQueryValidation,
};
