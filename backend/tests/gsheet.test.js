'use strict';

const { EventEmitter } = require('events');
const https = require('https');
const { extractSheetInfo, mapStatus, mapRecords, fetchAndParse } = require('../src/services/gsheetService');

const VALID_URL = 'https://docs.google.com/spreadsheets/d/abc123/edit';

describe('extractSheetInfo', () => {
  it('extracts sheet ID and gid from a full Google Sheets URL', () => {
    const url = 'https://docs.google.com/spreadsheets/d/1ju0zTxETD4eTDiANCU8CFieHppwGyycXv25ujvt_qLA/edit?gid=719674274#gid=719674274';
    const { sheetId, gid } = extractSheetInfo(url);
    expect(sheetId).toBe('1ju0zTxETD4eTDiANCU8CFieHppwGyycXv25ujvt_qLA');
    expect(gid).toBe('719674274');
  });

  it('extracts sheet ID without gid when URL has no tab parameter', () => {
    const url = 'https://docs.google.com/spreadsheets/d/abc123/edit';
    const { sheetId, gid } = extractSheetInfo(url);
    expect(sheetId).toBe('abc123');
    expect(gid).toBeNull();
  });

  it('throws for an invalid URL', () => {
    expect(() => extractSheetInfo('https://example.com/not-a-sheet')).toThrow(
      'Invalid Google Sheets URL'
    );
  });
});

describe('mapStatus', () => {
  it('maps מאושר to APPROVED', () => {
    expect(mapStatus('מאושר')).toBe('APPROVED');
  });

  it('maps מאושר מנהלתי to ADMIN_APPROVED', () => {
    expect(mapStatus('מאושר מנהלתי')).toBe('ADMIN_APPROVED');
  });

  it('maps לא מאושר to NOT_APPROVED', () => {
    expect(mapStatus('לא מאושר')).toBe('NOT_APPROVED');
  });

  it('maps לא מאושר (with trailing text) to NOT_APPROVED', () => {
    expect(mapStatus('לא מאושר - סיבה כלשהי')).toBe('NOT_APPROVED');
  });

  it('returns null for pending status (בתהליך אישור)', () => {
    expect(mapStatus('בתהליך אישור')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(mapStatus('')).toBeNull();
  });

  it('trims whitespace before mapping', () => {
    expect(mapStatus('  מאושר  ')).toBe('APPROVED');
  });
});

describe('mapRecords', () => {
  const BASE_ROW = {
    'תעודת זהות': '123456782',
    'סטטוס': 'מאושר',
  };

  it('maps escort column to escortName', () => {
    const records = [{ ...BASE_ROW, 'אם אזרח: פרטי המלווה (שם מלא, טלפון)': 'ישראל ישראלי 0501234567' }];
    const [row] = mapRecords(records);
    expect(row.escortName).toBe('ישראל ישראלי 0501234567');
  });

  it('sets escortName to null when escort column is absent', () => {
    const [row] = mapRecords([{ ...BASE_ROW }]);
    expect(row.escortName).toBeNull();
  });

  it('sets escortName to null when escort cell is empty', () => {
    const records = [{ ...BASE_ROW, 'אם אזרח: פרטי המלווה (שם מלא, טלפון)': '' }];
    const [row] = mapRecords(records);
    expect(row.escortName).toBeNull();
  });

  it('trims whitespace from escort value', () => {
    const records = [{ ...BASE_ROW, 'אם אזרח: פרטי המלווה (שם מלא, טלפון)': '  שם המלווה  ' }];
    const [row] = mapRecords(records);
    expect(row.escortName).toBe('שם המלווה');
  });

  it('maps email column to requesterEmail', () => {
    const records = [{ ...BASE_ROW, 'כתובת אימייל': 'user@example.com' }];
    const [row] = mapRecords(records);
    expect(row.requesterEmail).toBe('user@example.com');
  });

  it('sets requesterEmail to null when email column is absent', () => {
    const [row] = mapRecords([{ ...BASE_ROW }]);
    expect(row.requesterEmail).toBeNull();
  });

  it('sets requesterEmail to null when email cell is empty', () => {
    const records = [{ ...BASE_ROW, 'כתובת אימייל': '' }];
    const [row] = mapRecords(records);
    expect(row.requesterEmail).toBeNull();
  });

  it('trims whitespace from email value', () => {
    const records = [{ ...BASE_ROW, 'כתובת אימייל': '  user@example.com  ' }];
    const [row] = mapRecords(records);
    expect(row.requesterEmail).toBe('user@example.com');
  });

  it('throws when required columns are missing', () => {
    expect(() => mapRecords([{ 'עמודה אחרת': 'x' }])).toThrow('Sheet is missing required columns');
  });

  it('maps ליווי=TRUE to APPROVED_WITH_ESCORT verdict', () => {
    const records = [{ ...BASE_ROW, 'ליווי': 'TRUE' }];
    const [row] = mapRecords(records);
    expect(row.verdict).toBe('APPROVED_WITH_ESCORT');
  });

  it('maps ליווי=true (lowercase) to APPROVED_WITH_ESCORT', () => {
    const records = [{ ...BASE_ROW, 'ליווי': 'true' }];
    const [row] = mapRecords(records);
    expect(row.verdict).toBe('APPROVED_WITH_ESCORT');
  });

  it('does not override verdict when ליווי=FALSE', () => {
    const records = [{ ...BASE_ROW, 'ליווי': 'FALSE' }];
    const [row] = mapRecords(records);
    expect(row.verdict).toBe('APPROVED');
  });

  it('does not override verdict when ליווי column is empty', () => {
    const records = [{ ...BASE_ROW, 'ליווי': '' }];
    const [row] = mapRecords(records);
    expect(row.verdict).toBe('APPROVED');
  });

  it('does not override verdict when ליווי column is absent', () => {
    const [row] = mapRecords([{ ...BASE_ROW }]);
    expect(row.verdict).toBe('APPROVED');
  });
});

describe('fetchAndParse HTTP layer', () => {
  afterEach(() => jest.restoreAllMocks());

  function mockGet(handler) {
    jest.spyOn(https, 'get').mockImplementation((url, cb) => {
      const req = new EventEmitter();
      handler(url, cb, req);
      return req;
    });
  }

  function makeRes(statusCode, headers = {}) {
    const res = new EventEmitter();
    res.statusCode = statusCode;
    res.headers = headers;
    return res;
  }

  it('fetches, parses and returns records from a successful response', async () => {
    const csv = 'תעודת זהות,סטטוס\n000000018,מאושר\n';
    mockGet((url, cb) => {
      const res = makeRes(200);
      process.nextTick(() => { cb(res); res.emit('data', Buffer.from(csv)); res.emit('end'); });
    });
    const result = await fetchAndParse(VALID_URL);
    expect(result).toHaveLength(1);
    expect(result[0].verdict).toBe('APPROVED');
  });

  it('returns empty array when CSV has no data rows', async () => {
    mockGet((url, cb) => {
      const res = makeRes(200);
      process.nextTick(() => { cb(res); res.emit('data', Buffer.from('col1,col2\n')); res.emit('end'); });
    });
    await expect(fetchAndParse(VALID_URL)).resolves.toEqual([]);
  });

  it('rejects with HTTP status message on non-200 response', async () => {
    mockGet((url, cb) => {
      process.nextTick(() => cb(makeRes(403)));
    });
    await expect(fetchAndParse(VALID_URL)).rejects.toThrow('HTTP 403');
  });

  it('follows a redirect and returns the final response data', async () => {
    let call = 0;
    const csv = 'תעודת זהות,סטטוס\n301802500,מאושר מנהלתי\n';
    mockGet((url, cb) => {
      if (call++ === 0) {
        process.nextTick(() => cb(makeRes(302, { location: 'https://docs.google.com/redirected' })));
      } else {
        const res = makeRes(200);
        process.nextTick(() => { cb(res); res.emit('data', Buffer.from(csv)); res.emit('end'); });
      }
    });
    const result = await fetchAndParse(VALID_URL);
    expect(result).toHaveLength(1);
    expect(result[0].verdict).toBe('ADMIN_APPROVED');
  });

  it('rejects after too many redirects', async () => {
    mockGet((url, cb) => {
      process.nextTick(() => cb(makeRes(302, { location: url })));
    });
    await expect(fetchAndParse(VALID_URL)).rejects.toThrow('Too many redirects');
  });

  it('rejects on request-level network error', async () => {
    mockGet((url, cb, req) => {
      process.nextTick(() => req.emit('error', new Error('ECONNREFUSED')));
    });
    await expect(fetchAndParse(VALID_URL)).rejects.toThrow('ECONNREFUSED');
  });

  it('rejects on response-level stream error', async () => {
    mockGet((url, cb) => {
      const res = makeRes(200);
      process.nextTick(() => { cb(res); res.emit('error', new Error('socket hang up')); });
    });
    await expect(fetchAndParse(VALID_URL)).rejects.toThrow('socket hang up');
  });
});
