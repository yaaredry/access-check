'use strict';

const peopleRepo = require('../repositories/peopleRepository');
const auditRepo = require('../repositories/auditRepository');
const ocrService = require('./ocrService');
const logger = require('../config/logger');

const VERDICTS = {
  APPROVED: 'APPROVED',
  ADMIN_APPROVED: 'ADMIN_APPROVED',
  NOT_APPROVED: 'NOT_APPROVED',
  EXPIRED: 'EXPIRED',
  NOT_FOUND: 'NOT_FOUND',
};

function resolveVerdict(person) {
  if (!person) return VERDICTS.NOT_FOUND;

  if (person.approval_expiration) {
    const expiry = new Date(person.approval_expiration);
    expiry.setHours(23, 59, 59, 999); // end of expiry day
    if (expiry < new Date()) {
      return VERDICTS.EXPIRED;
    }
  }

  if (person.verdict === 'APPROVED') return VERDICTS.APPROVED;
  if (person.verdict === 'ADMIN_APPROVED') return VERDICTS.ADMIN_APPROVED;
  return VERDICTS.NOT_APPROVED;
}

async function verifyById(identifierType, identifierValue) {
  const person = await peopleRepo.findByIdentifier(identifierType, identifierValue);
  const verdict = resolveVerdict(person);

  await auditRepo.log({
    action: 'VERIFY',
    identifierType,
    identifierValue,
    verdict,
    source: 'manual',
  });

  return { verdict, person: person ? { id: person.id, identifierType: person.identifier_type, identifierValue: person.identifier_value } : null };
}

async function verifyByImage(imageBuffer) {
  const { ilIds, idfIds, raw } = await ocrService.processImage(imageBuffer);

  logger.info({
    message: 'OCR scan result',
    rawText: raw,
    extractedIlIds: ilIds,
    extractedIdfIds: idfIds,
  });

  // Try IL_ID matches first
  for (const val of ilIds) {
    logger.info({ message: 'OCR DB lookup', identifierType: 'IL_ID', identifierValue: val });
    const person = await peopleRepo.findByIdentifier('IL_ID', val);
    if (person) {
      const verdict = resolveVerdict(person);
      logger.info({ message: 'OCR match found', identifierType: 'IL_ID', identifierValue: val, verdict });
      await auditRepo.log({
        action: 'VERIFY',
        identifierType: 'IL_ID',
        identifierValue: val,
        verdict,
        source: 'image',
        metadata: { extractedIds: { ilIds, idfIds } },
      });
      return { verdict, identifierType: 'IL_ID', identifierValue: val };
    }
  }

  // Try IDF_ID matches
  for (const val of idfIds) {
    logger.info({ message: 'OCR DB lookup', identifierType: 'IDF_ID', identifierValue: val });
    const person = await peopleRepo.findByIdentifier('IDF_ID', val);
    if (person) {
      const verdict = resolveVerdict(person);
      logger.info({ message: 'OCR match found', identifierType: 'IDF_ID', identifierValue: val, verdict });
      await auditRepo.log({
        action: 'VERIFY',
        identifierType: 'IDF_ID',
        identifierValue: val,
        verdict,
        source: 'image',
        metadata: { extractedIds: { ilIds, idfIds } },
      });
      return { verdict, identifierType: 'IDF_ID', identifierValue: val };
    }
  }

  // Nothing matched
  await auditRepo.log({
    action: 'VERIFY',
    verdict: VERDICTS.NOT_FOUND,
    source: 'image',
    metadata: { extractedIds: { ilIds, idfIds } },
  });

  return { verdict: VERDICTS.NOT_FOUND, identifierType: null, identifierValue: null };
}

module.exports = { verifyById, verifyByImage };
