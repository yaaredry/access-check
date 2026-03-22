'use strict';

const { extractSheetInfo, mapStatus, mapRecords } = require('../src/services/gsheetService');

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

  it('throws when required columns are missing', () => {
    expect(() => mapRecords([{ 'עמודה אחרת': 'x' }])).toThrow('Sheet is missing required columns');
  });
});
