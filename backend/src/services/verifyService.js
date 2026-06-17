'use strict';

const peopleRepo = require('../repositories/peopleRepository');
const auditRepo = require('../repositories/auditRepository');
const ocrService = require('./ocrService');
const logger = require('../config/logger');

const VERDICTS = {
  APPROVED: 'APPROVED',
  ADMIN_APPROVED: 'ADMIN_APPROVED',
  APPROVED_WITH_ESCORT: 'APPROVED_WITH_ESCORT',
  NOT_APPROVED: 'NOT_APPROVED',
  PENDING: 'PENDING',
  EXPIRED: 'EXPIRED',
  NOT_FOUND: 'NOT_FOUND',
  NOT_YET_ACTIVE: 'NOT_YET_ACTIVE',
  BLOCKED: 'BLOCKED',
};

function resolveVerdict(person) {
  if (!person) return VERDICTS.NOT_FOUND;

  // BLOCKED is the strongest status — overrides all other verdicts including active approvals.
  if (person.status === 'BLOCKED') return VERDICTS.BLOCKED;

  if (person.status === 'PENDING') return VERDICTS.PENDING;

  // NOT_APPROVED is the strongest negative status — check before any date logic.
  // Rejected records always have an approval_expiration from the original submission,
  // so expiration must not override a rejection verdict.
  if (person.status === 'NOT_APPROVED') return VERDICTS.NOT_APPROVED;

  // Date checks only apply to records that were actually approved.
  const wasApproved = ['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT'].includes(person.verdict)
    || person.status === 'APPROVED';

  if (wasApproved && person.approval_start_date) {
    const start = new Date(person.approval_start_date);
    start.setHours(0, 0, 0, 0); // start of start day
    if (start > new Date()) return VERDICTS.NOT_YET_ACTIVE;
  }

  if (wasApproved && person.approval_expiration) {
    const expiry = new Date(person.approval_expiration);
    expiry.setHours(23, 59, 59, 999); // end of expiry day
    if (expiry < new Date()) {
      return VERDICTS.EXPIRED;
    }
  }

  if (person.verdict === 'APPROVED') return VERDICTS.APPROVED;
  if (person.verdict === 'ADMIN_APPROVED') return VERDICTS.ADMIN_APPROVED;
  if (person.verdict === 'APPROVED_WITH_ESCORT') return VERDICTS.APPROVED_WITH_ESCORT;
  if (person.status === 'APPROVED') return VERDICTS.APPROVED;
  return VERDICTS.NOT_APPROVED;
}

async function verifyById(identifierType, identifierValue) {
  const person = await peopleRepo.findByIdentifier(identifierType, identifierValue);
  const verdict = resolveVerdict(person);

  if (person) await peopleRepo.touchLastSeen(person.id);

  await auditRepo.log({
    action: 'VERIFY',
    identifierType,
    identifierValue,
    verdict,
    source: 'manual',
  });

  return {
    verdict,
    escortFullName: person?.escort_full_name || null,
    escortPhone: person?.escort_phone || null,
    person: person ? { id: person.id, identifierType: person.identifier_type, identifierValue: person.identifier_value } : null,
  };
}

async function verifyByImage(imageBuffer) {
  const { ilIds, idfIds } = await ocrService.processImage(imageBuffer);

  logger.info({
    message: 'OCR scan result',
    ilIdCount: ilIds.length,
    idfIdCount: idfIds.length,
  });

  // Try IL_ID matches first
  for (const val of ilIds) {
    logger.info({ message: 'OCR DB lookup', identifierType: 'IL_ID' });
    const person = await peopleRepo.findByIdentifier('IL_ID', val);
    if (person) {
      const verdict = resolveVerdict(person);
      logger.info({ message: 'OCR match found', identifierType: 'IL_ID', verdict });
      await peopleRepo.touchLastSeen(person.id);
      await auditRepo.log({
        action: 'VERIFY',
        identifierType: 'IL_ID',
        identifierValue: val,
        verdict,
        source: 'image',
        metadata: { extractedIds: { ilIds, idfIds } },
      });
      return { verdict, escortFullName: person.escort_full_name || null, escortPhone: person.escort_phone || null, identifierType: 'IL_ID', identifierValue: val };
    }
  }

  // Try IDF_ID matches
  for (const val of idfIds) {
    logger.info({ message: 'OCR DB lookup', identifierType: 'IDF_ID' });
    const person = await peopleRepo.findByIdentifier('IDF_ID', val);
    if (person) {
      const verdict = resolveVerdict(person);
      logger.info({ message: 'OCR match found', identifierType: 'IDF_ID', verdict });
      await peopleRepo.touchLastSeen(person.id);
      await auditRepo.log({
        action: 'VERIFY',
        identifierType: 'IDF_ID',
        identifierValue: val,
        verdict,
        source: 'image',
        metadata: { extractedIds: { ilIds, idfIds } },
      });
      return { verdict, escortFullName: person.escort_full_name || null, escortPhone: person.escort_phone || null, identifierType: 'IDF_ID', identifierValue: val };
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
