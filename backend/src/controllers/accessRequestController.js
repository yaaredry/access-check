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
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('approvalExpiration must be a future date');
      }
      return true;
    }),
  body('reason')
    .trim()
    .notEmpty().withMessage('reason is required'),
  body('requesterName')
    .trim()
    .notEmpty().withMessage('requesterName is required'),
  validate,
];

async function create(req, res, next) {
  try {
    const { ilId, population, division, escortFullName, escortPhone, approvalExpiration, reason, requesterName } = req.body;

    const person = await peopleRepo.create({
      identifierType: 'IL_ID',
      identifierValue: ilId,
      verdict: 'NOT_APPROVED',
      approvalExpiration,
      population,
      division: division || null,
      escortFullName: population === 'CIVILIAN' ? escortFullName : null,
      escortPhone: population === 'CIVILIAN' ? escortPhone : null,
      reason,
      status: 'PENDING',
      requesterName,
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

module.exports = { create, requestBodyValidation };
