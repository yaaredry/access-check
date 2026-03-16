'use strict';

const { extractSheetInfo, mapStatus } = require('../src/services/gsheetService');

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
