'use strict';

const { body } = require('express-validator');
const { validate } = require('../middlewares/validate');
const peopleRepo = require('../repositories/peopleRepository');
const auditRepo = require('../repositories/auditRepository');
const { validateIlId } = require('../utils/validateIlId');

const POPULATIONS = ['IL_MILITARY', 'CIVILIAN'];

const requestBodyValidation = [
  body('ilId')
    .trim()
    .notEmpty().withMessage('ilId is required')
    .custom((value) => {
      if (!validateIlId(value)) throw new Error('Invalid IL_ID format');
      return true;
    }),
  body('population')
    .isIn(POPULATIONS).withMessage(`population must be one of: ${POPULATIONS.join(', ')}`),
  body('division')
    .optional({ nullable: true }).trim(),
  body('escortFullName')
    .if(body('population').equals('CIVILIAN'))
    .notEmpty().withMessage('escortFullName is required for CIVILIAN population'),
  body('escortPhone')
    .if(body('population').equals('CIVILIAN'))
    .notEmpty().withMessage('escortPhone is required for CIVILIAN population')
    .matches(/^\+?[\d]+$/).withMessage('escortPhone must contain digits and optional leading +'),
  body('approvalExpiration')
    .isISO8601().withMessage('approvalExpiration must be a valid date')
    .custom((value, { req }) => {
      const expUTC = new Date(value + 'T00:00:00Z');
      const todayUTC = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z');
      if (req.body.approvalStartDate) {
        // With a start date: expiration >= start (single-day access allowed)
        const startUTC = new Date(req.body.approvalStartDate + 'T00:00:00Z');
        if (expUTC < startUTC) throw new Error('approvalExpiration must not be before approvalStartDate');
        const max = new Date(startUTC);
        max.setUTCDate(max.getUTCDate() + 7);
        max.setUTCHours(23, 59, 59, 999);
        if (expUTC > max) throw new Error('approvalExpiration cannot be more than 7 days from approvalStartDate');
      } else {
        // No start date: must be strictly tomorrow or later
        if (expUTC <= todayUTC) throw new Error('approvalExpiration must be a future date');
        const max = new Date();
        max.setDate(max.getDate() + 7);
        if (expUTC > max) throw new Error('approvalExpiration cannot be more than 7 days from today');
      }
      return true;
    }),
  body('approvalStartDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('approvalStartDate must be a valid date')
    .custom((value, { req }) => {
      if (!value) return true;
      if (req.body.approvalExpiration && value > req.body.approvalExpiration) {
        throw new Error('approvalStartDate must not be after approvalExpiration');
      }
      return true;
    }),
  body('reason')
    .trim()
    .notEmpty().withMessage('reason is required'),
  // requesterName is only required from the body when the JWT does not carry a name
  // (i.e. the generic shared requestor account, not a named individual)
  body('requesterName')
    .if((value, { req }) => !req.user?.name)
    .trim()
    .notEmpty().withMessage('requesterName is required'),
  validate,
];

async function create(req, res, next) {
  try {
    const { ilId, population, division, escortFullName, escortPhone, approvalExpiration, approvalStartDate, reason, requesterName: requesterNameFromBody } = req.body;

    // Named requestors have their identity locked to the JWT; generic requestor uses the form field
    const requesterName = req.user.name || requesterNameFromBody;
    const requesterEmail = req.user.name ? req.user.username : null;

    const existing = await peopleRepo.findByIdentifierValue(ilId);
    if (existing) {
      return res.status(409).json({
        error: 'A record for this ID already exists.',
        existing: {
          id: existing.id,
          status: existing.status,
          verdict: existing.verdict,
          rejection_reason: existing.rejection_reason || null,
          approval_expiration: existing.approval_expiration || null,
        },
      });
    }

    const person = await peopleRepo.create({
      identifierType: 'IL_ID',
      identifierValue: ilId,
      verdict: 'NOT_APPROVED',
      approvalExpiration,
      approvalStartDate: approvalStartDate || null,
      population,
      division: division || null,
      escortFullName: population === 'CIVILIAN' ? escortFullName : null,
      escortPhone: population === 'CIVILIAN' ? escortPhone : null,
      reason,
      status: 'PENDING',
      requesterName,
      requesterEmail,
    });

    await auditRepo.log({
      action: 'ACCESS_REQUEST',
      identifierType: 'IL_ID',
      identifierValue: ilId,
      verdict: 'PENDING',
      source: 'request_form',
    });

    return res.status(201).json({ id: person.id, status: person.status });
  } catch (err) {
    return next(err);
  }
}

const resubmitBodyValidation = [
  body('population')
    .isIn(POPULATIONS).withMessage(`population must be one of: ${POPULATIONS.join(', ')}`),
  body('division')
    .optional({ nullable: true }).trim(),
  body('escortFullName')
    .if(body('population').equals('CIVILIAN'))
    .notEmpty().withMessage('escortFullName is required for CIVILIAN population'),
  body('escortPhone')
    .if(body('population').equals('CIVILIAN'))
    .notEmpty().withMessage('escortPhone is required for CIVILIAN population')
    .matches(/^\+?[\d]+$/).withMessage('escortPhone must contain digits and optional leading +'),
  body('approvalExpiration')
    .isISO8601().withMessage('approvalExpiration must be a valid date')
    .custom((value, { req }) => {
      const expUTC = new Date(value + 'T00:00:00Z');
      const todayUTC = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z');
      if (req.body.approvalStartDate) {
        // With a start date: expiration >= start (single-day access allowed)
        const startUTC = new Date(req.body.approvalStartDate + 'T00:00:00Z');
        if (expUTC < startUTC) throw new Error('approvalExpiration must not be before approvalStartDate');
        const max = new Date(startUTC);
        max.setUTCDate(max.getUTCDate() + 7);
        max.setUTCHours(23, 59, 59, 999);
        if (expUTC > max) throw new Error('approvalExpiration cannot be more than 7 days from approvalStartDate');
      } else {
        // No start date: must be strictly tomorrow or later
        if (expUTC <= todayUTC) throw new Error('approvalExpiration must be a future date');
        const max = new Date();
        max.setDate(max.getDate() + 7);
        if (expUTC > max) throw new Error('approvalExpiration cannot be more than 7 days from today');
      }
      return true;
    }),
  body('approvalStartDate')
    .optional({ nullable: true })
    .isISO8601().withMessage('approvalStartDate must be a valid date')
    .custom((value, { req }) => {
      if (!value) return true;
      if (req.body.approvalExpiration && value > req.body.approvalExpiration) {
        throw new Error('approvalStartDate must not be after approvalExpiration');
      }
      return true;
    }),
  body('reason')
    .trim()
    .notEmpty().withMessage('reason is required'),
  body('requesterName')
    .if((value, { req }) => !req.user?.name)
    .trim()
    .notEmpty().withMessage('requesterName is required'),
  validate,
];

function isResubmittable(record) {
  if (record.status === 'NOT_APPROVED') return true;
  if (['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT'].includes(record.verdict)) {
    return !!(record.approval_expiration && new Date(record.approval_expiration) < new Date());
  }
  return false;
}

async function resubmit(req, res, next) {
  try {
    const { id } = req.params;
    const { population, division, escortFullName, escortPhone, approvalExpiration, approvalStartDate, reason, requesterName: requesterNameFromBody } = req.body;

    const record = await peopleRepo.findById(id);
    if (!record) return res.status(404).json({ error: 'Record not found.' });

    if (!isResubmittable(record)) {
      return res.status(409).json({ error: 'This record cannot be resubmitted in its current state.' });
    }

    const requesterName = req.user.name || requesterNameFromBody;
    const requesterEmail = req.user.name ? req.user.username : null;

    const updated = await peopleRepo.resubmitById(id, {
      approvalExpiration,
      approvalStartDate: approvalStartDate || null,
      population,
      division: division || null,
      escortFullName: population === 'CIVILIAN' ? escortFullName : null,
      escortPhone: population === 'CIVILIAN' ? escortPhone : null,
      reason,
      requesterName,
      requesterEmail,
    });

    await auditRepo.log({
      action: 'ACCESS_REQUEST_RESUBMIT',
      identifierType: updated.identifier_type,
      identifierValue: updated.identifier_value,
      verdict: 'PENDING',
      source: 'request_form',
    });

    return res.json({ id: updated.id, status: updated.status });
  } catch (err) {
    return next(err);
  }
}

async function mine(req, res, next) {
  try {
    const rows = await peopleRepo.findByRequesterEmail(req.user.username);
    return res.json({ rows });
  } catch (err) {
    return next(err);
  }
}

module.exports = { create, resubmit, mine, requestBodyValidation, resubmitBodyValidation };
