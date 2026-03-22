'use strict';

const { parse } = require('csv-parse/sync');

const ID_COL_SUBSTR        = 'תעודת זהות';
const STATUS_COL_SUBSTR    = 'סטטוס';
const POPULATION_COL_SUBSTR = 'אוכלוסיה';
const REASON_COL_SUBSTR    = 'סיבת כניסה';
const ESCORT_COL_SUBSTR    = 'אם אזרח: פרטי המלווה (שם מלא, טלפון)';

function findCol(headers, substring) {
  return headers.find((h) => h.includes(substring)) || null;
}

function extractSheetInfo(url) {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error('Invalid Google Sheets URL — expected: https://docs.google.com/spreadsheets/d/<id>/...');
  }
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  return { sheetId: idMatch[1], gid: gidMatch ? gidMatch[1] : null };
}

function mapStatus(raw) {
  const s = (raw || '').trim();
  if (s === 'מאושר') return 'APPROVED';
  if (s === 'מאושר מנהלתי') return 'ADMIN_APPROVED';
  if (s.startsWith('לא מאושר')) return 'NOT_APPROVED';
  return null; // e.g. בתהליך אישור — caller skips these
}

function fetchCsvBuffer(url) {
  return new Promise((resolve, reject) => {
    function get(u, redirects) {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const lib = u.startsWith('https') ? require('https') : require('http');
      lib.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(
            `Google Sheets returned HTTP ${res.statusCode} — make sure the sheet is set to "Anyone with the link can view"`
          ));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    }
    get(url, 0);
  });
}

async function fetchAndParse(sheetUrl) {
  const { sheetId, gid } = extractSheetInfo(sheetUrl);
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
  const csvBuffer = await fetchCsvBuffer(csvUrl);

  const records = parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  if (!records.length) return [];

  return mapRecords(records);
}

function mapRecords(records) {
  const headers = Object.keys(records[0]);
  const idCol         = findCol(headers, ID_COL_SUBSTR);
  const statusCol     = findCol(headers, STATUS_COL_SUBSTR);
  const populationCol = findCol(headers, POPULATION_COL_SUBSTR);
  const reasonCol     = findCol(headers, REASON_COL_SUBSTR);
  const escortCol     = findCol(headers, ESCORT_COL_SUBSTR);

  if (!idCol || !statusCol) {
    throw new Error(
      `Sheet is missing required columns. Expected a column containing "${ID_COL_SUBSTR}" and one containing "${STATUS_COL_SUBSTR}". Found: ${headers.join(', ')}`
    );
  }

  return records.map((row, i) => ({
    rowNum: i + 2,
    identifierValue: (row[idCol] || '').trim(),
    verdict: mapStatus(row[statusCol]),
    population: populationCol ? (row[populationCol] || '').trim() || null : null,
    reason: reasonCol ? (row[reasonCol] || '').trim() || null : null,
    escortName: escortCol ? (row[escortCol] || '').trim() || null : null,
  }));
}

module.exports = { fetchAndParse, extractSheetInfo, mapStatus, mapRecords };
