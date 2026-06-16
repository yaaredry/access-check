'use strict';

const { body, param, query } = require('express-validator');
const { validate } = require('../middlewares/validate');
const peopleService = require('../services/peopleService');
const auditRepo = require('../repositories/auditRepository');
const personAuditLogRepo = require('../repositories/personAuditLogRepository');

const IDENTIFIER_TYPES = ['IL_ID', 'IDF_ID'];
const VERDICTS = ['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT', 'NOT_APPROVED'];

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
  body('approvalStartDate').optional({ nullable: true }).isISO8601().withMessage('approvalStartDate must be a valid date')
    .custom((value, { req }) => {
      if (!value) return true;
      if (req.body.approvalExpiration && value > req.body.approvalExpiration) {
        throw new Error('approvalStartDate must not be after approvalExpiration');
      }
      return true;
    }),
  body('requesterName').optional({ nullable: true }).trim(),
  body('escortFullName').if(body('verdict').equals('APPROVED_WITH_ESCORT'))
    .notEmpty().withMessage('escortFullName is required when verdict is APPROVED_WITH_ESCORT'),
  body('escortPhone').if(body('verdict').equals('APPROVED_WITH_ESCORT'))
    .notEmpty().withMessage('escortPhone is required when verdict is APPROVED_WITH_ESCORT'),
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
    const person = await peopleService.createPerson(req.body, req.user);
    return res.status(201).json(person);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const person = await peopleService.updatePerson(parseInt(req.params.id, 10), req.body, req.user);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    return res.json(person);
  } catch (err) {
    return next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status, rejectionReason, verdict: requestedVerdict } = req.body;
    if (!['APPROVED', 'NOT_APPROVED'].includes(status)) {
      return res.status(400).json({ error: 'status must be APPROVED or NOT_APPROVED' });
    }
    if (status === 'NOT_APPROVED' && !rejectionReason?.trim()) {
      return res.status(400).json({ error: 'rejectionReason is required when rejecting' });
    }
    const allowedApprovalVerdicts = ['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT'];
    const verdict = status === 'APPROVED'
      ? (allowedApprovalVerdicts.includes(requestedVerdict) ? requestedVerdict : 'ADMIN_APPROVED')
      : 'NOT_APPROVED';
    const person = await peopleService.updatePerson(parseInt(req.params.id, 10), {
      verdict,
      status,
      rejectionReason: status === 'NOT_APPROVED' ? rejectionReason.trim() : null,
    }, req.user);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    return res.json(person);
  } catch (err) {
    return next(err);
  }
}

async function blockPerson(req, res, next) {
  try {
    const { blockReason } = req.body;
    if (!blockReason?.trim()) {
      return res.status(400).json({ error: 'blockReason is required' });
    }
    const person = await peopleService.blockPerson(parseInt(req.params.id, 10), blockReason.trim());
    if (!person) return res.status(404).json({ error: 'Person not found' });
    return res.json(person);
  } catch (err) {
    return next(err);
  }
}

const UNBLOCK_STATUSES = ['PENDING', 'APPROVED', 'NOT_APPROVED'];
const APPROVAL_VERDICTS = ['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT'];

async function unblockPerson(req, res, next) {
  try {
    const { status, verdict: requestedVerdict, rejectionReason } = req.body;
    if (!UNBLOCK_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${UNBLOCK_STATUSES.join(', ')}` });
    }
    if (status === 'NOT_APPROVED' && !rejectionReason?.trim()) {
      return res.status(400).json({ error: 'rejectionReason is required when status is NOT_APPROVED' });
    }
    let verdict;
    if (status === 'APPROVED') {
      verdict = APPROVAL_VERDICTS.includes(requestedVerdict) ? requestedVerdict : 'ADMIN_APPROVED';
    } else if (status === 'NOT_APPROVED') {
      verdict = 'NOT_APPROVED';
    } else {
      verdict = 'NOT_APPROVED';
    }
    const person = await peopleService.unblockPerson(parseInt(req.params.id, 10), {
      status,
      verdict,
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
    const deleted = await peopleService.deletePerson(parseInt(req.params.id, 10), req.user);
    if (!deleted) return res.status(404).json({ error: 'Person not found' });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

async function getVisits(req, res, next) {
  try {
    const person = await peopleService.getPerson(parseInt(req.params.id, 10));
    if (!person) return res.status(404).json({ error: 'Person not found' });
    const visits = await auditRepo.getVisitsByIdentifierValue(person.identifier_value);
    return res.json(visits);
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
    const result = await peopleService.importFromGSheet(url, req.user);
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
    const result = await peopleService.bulkUploadCSV(req.file.buffer, req.user);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getAuditLog(req, res, next) {
  try {
    const person = await peopleService.getPerson(parseInt(req.params.id, 10));
    if (!person) return res.status(404).json({ error: 'Person not found' });
    const log = await personAuditLogRepo.findByPersonId(parseInt(req.params.id, 10));
    return res.json(log);
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
  getVisits,
  getAuditLog,
  create,
  update,
  updateStatus,
  blockPerson,
  unblockPerson,
  remove,
  uploadCSV,
  importGSheet,
  personBodyValidation,
  idParamValidation,
  listQueryValidation,
};
