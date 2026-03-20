'use strict';

const { parse } = require('csv-parse/sync');

const ID_COL = 'תעודת זהות';
const STATUS_COL = 'סטטוס';
const POPULATION_COL = 'אוכלוסיה';
const REASON_COL = 'סיבת כניסה (נא לפרט)';

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

  const firstRow = records[0];
  if (!(ID_COL in firstRow) || !(STATUS_COL in firstRow)) {
    throw new Error(
      `Sheet is missing required columns. Expected "${ID_COL}" and "${STATUS_COL}". Found: ${Object.keys(firstRow).join(', ')}`
    );
  }

  return records.map((row, i) => ({
    rowNum: i + 2,
    identifierValue: (row[ID_COL] || '').trim(),
    verdict: mapStatus(row[STATUS_COL]),
    population: (row[POPULATION_COL] || '').trim() || null,
    reason: (row[REASON_COL] || '').trim() || null,
  }));
}

module.exports = { fetchAndParse, extractSheetInfo, mapStatus };
