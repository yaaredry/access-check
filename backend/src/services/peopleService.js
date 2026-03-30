'use strict';

const { parse } = require('csv-parse/sync');
const peopleRepo = require('../repositories/peopleRepository');
const auditRepo = require('../repositories/auditRepository');
const gsheetService = require('./gsheetService');

const { validateIlId } = require('../utils/validateIlId');

const VALID_TYPES = ['IL_ID', 'IDF_ID'];
const VALID_VERDICTS = ['APPROVED', 'ADMIN_APPROVED', 'APPROVED_WITH_ESCORT', 'NOT_APPROVED'];

function validateIdentifierValue(type, value) {
  if (type === 'IL_ID') return validateIlId(value);
  if (type === 'IDF_ID') return /^\d{7,8}$/.test(value);
  return false;
}

async function listPeople(query) {
  return peopleRepo.findAll(query);
}

async function getPerson(id) {
  return peopleRepo.findById(id);
}

async function createPerson(data) {
  const { identifierType, identifierValue, verdict, approvalExpiration, population, division, escortFullName, escortPhone, reason, status, requesterName } = data;
  const person = await peopleRepo.create({ identifierType, identifierValue, verdict, approvalExpiration, population, division, escortFullName, escortPhone, reason, status, requesterName });
  await auditRepo.log({
    action: 'CREATE',
    identifierType,
    identifierValue,
    verdict: status === 'PENDING' ? 'PENDING' : verdict,
    source: 'admin',
  });
  return person;
}

async function updatePerson(id, data) {
  const person = await peopleRepo.update(id, data);
  if (person) {
    const isVerdictChange = data.status === 'APPROVED' || data.status === 'NOT_APPROVED';
    await auditRepo.log({
      action: isVerdictChange ? 'VERDICT_GIVEN' : 'UPDATE',
      identifierType: person.identifier_type,
      identifierValue: person.identifier_value,
      verdict: person.verdict,
      source: 'admin',
      metadata: isVerdictChange ? { status: data.status, rejectionReason: data.rejectionReason || null } : null,
    });
  }
  return person;
}

async function deletePerson(id) {
  const person = await peopleRepo.findById(id);
  if (!person) return false;
  const deleted = await peopleRepo.remove(id);
  if (deleted) {
    await auditRepo.log({
      action: 'DELETE',
      identifierType: person.identifier_type,
      identifierValue: person.identifier_value,
      source: 'admin',
    });
  }
  return deleted;
}

async function bulkUploadCSV(csvBuffer) {
  const records = parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const errors = [];
  const valid = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const lineNum = i + 2; // +2 for header row + 1-based index

    const identifierType = (row.identifier_type || '').toUpperCase();
    const identifierValue = (row.identifier_value || '').trim();
    const verdict = (row.verdict || '').toUpperCase();
    const approvalExpiration = row.expiration_date || null;

    if (!VALID_TYPES.includes(identifierType)) {
      errors.push({ line: lineNum, error: `Invalid identifier_type: ${row.identifier_type}` });
      continue;
    }
    if (!VALID_VERDICTS.includes(verdict)) {
      errors.push({ line: lineNum, error: `Invalid verdict: ${row.verdict}` });
      continue;
    }
    if (!validateIdentifierValue(identifierType, identifierValue)) {
      errors.push({ line: lineNum, error: `Invalid identifier_value for type ${identifierType}: ${identifierValue}` });
      continue;
    }

    valid.push({ identifierType, identifierValue, verdict, approvalExpiration });
  }

  let result = { inserted: 0, updated: 0 };
  if (valid.length > 0) {
    result = await peopleRepo.upsertMany(valid);
    await auditRepo.log({
      action: 'BULK_UPLOAD',
      source: 'admin',
      metadata: { inserted: result.inserted, updated: result.updated, errors: errors.length },
    });
  }

  return { ...result, errors, totalRows: records.length };
}

async function importFromGSheet(url) {
  const rows = await gsheetService.fetchAndParse(url);

  const errors = [];
  const valid = [];
  let skipped = 0;

  for (const { rowNum, identifierValue: rawId, verdict, population, reason, escortName, requesterEmail } of rows) {
    if (verdict === null) {
      skipped++;
      continue;
    }

    // Pad to 9 digits to handle IDs stored without leading zeros
    const identifierValue = rawId.replace(/\D/g, '').padStart(9, '0');

    if (!validateIdentifierValue('IL_ID', identifierValue)) {
      errors.push({ line: rowNum, error: `Invalid IL_ID: "${rawId}"` });
      continue;
    }

    valid.push({ identifierType: 'IL_ID', identifierValue, verdict, population: population || null, reason: reason || null, escortName: escortName || null, requesterEmail: requesterEmail || null });
  }

  let result = { inserted: 0, updated: 0 };
  if (valid.length > 0) {
    result = await peopleRepo.upsertMany(valid);
    await auditRepo.log({
      action: 'BULK_UPLOAD',
      source: 'admin',
      metadata: { inserted: result.inserted, updated: result.updated, errors: errors.length, skipped, source: 'gsheet' },
    });
  }

  return { ...result, errors, skipped, totalRows: rows.length };
}

module.exports = { listPeople, getPerson, createPerson, updatePerson, deletePerson, bulkUploadCSV, importFromGSheet, validateIdentifierValue };
