'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const tesseract = require('node-tesseract-ocr');
const sharp = require('sharp');

// ── Luhn-style check for 9-digit Israeli ID ───────────────────────────────────
function isValidIlId(s) {
  if (!/^\d{9}$/.test(s)) return false;
  const digits = s.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = digits[i] * (i % 2 === 0 ? 1 : 2);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

// ── Image preprocessing ───────────────────────────────────────────────────────

async function prepareFullImage(buffer) {
  const meta = await sharp(buffer).metadata();
  const scale = meta.width < 1500 ? 2 : 1;

  return sharp(buffer)
    .grayscale()
    .resize(meta.width * scale, meta.height * scale, { fit: 'fill', kernel: 'lanczos3' })
    .normalize()
    .sharpen({ sigma: 1.5 })
    .linear(1.4, -20)       // boost contrast
    .toBuffer();
}

// High-contrast black/white version — better for colored card backgrounds
async function prepareBinaryImage(buffer) {
  const meta = await sharp(buffer).metadata();
  const scale = meta.width < 1500 ? 2 : 1;

  return sharp(buffer)
    .grayscale()
    .resize(meta.width * scale, meta.height * scale, { fit: 'fill', kernel: 'lanczos3' })
    .normalize()
    .threshold(140)         // force pure black/white — strips colored backgrounds
    .toBuffer();
}

// Crop a relative region of the image (values 0–1)
async function cropRegion(buffer, { left, top, width, height }) {
  const meta = await sharp(buffer).metadata();
  return sharp(buffer)
    .extract({
      left:   Math.floor(meta.width  * left),
      top:    Math.floor(meta.height * top),
      width:  Math.floor(meta.width  * width),
      height: Math.floor(meta.height * height),
    })
    .toBuffer();
}

// ── Tesseract helpers ─────────────────────────────────────────────────────────

const DIGITS_ONLY = '0123456789-';

async function ocr(imageBuffer, { psm, lang = 'eng+heb', whitelist = null }) {
  const tmpPath = path.join(
    os.tmpdir(),
    `ocr_${Date.now()}_${Math.random().toString(36).slice(2)}.png`
  );
  try {
    fs.writeFileSync(tmpPath, imageBuffer);
    const opts = { lang, oem: 1, psm };
    if (whitelist) opts.tessedit_char_whitelist = whitelist;
    return await tesseract.recognize(tmpPath, opts);
  } catch (err) {
    if (err.message && err.message.includes('command not found')) {
      const e = new Error('Tesseract OCR is not installed. Run: brew install tesseract tesseract-lang');
      e.status = 503;
      throw e;
    }
    return ''; // single pass failure should not abort all passes
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

// ── Multi-pass OCR ────────────────────────────────────────────────────────────
//
// Israeli driver's license layout (approximate):
//   ┌──────────────────────────────┐
//   │  [PHOTO]  │  name / fields   │
//   │           │                  │
//   │  ID num   │  license fields  │
//   │  under    │                  │
//   └──────────────────────────────┘
//
// We crop several regions and run independent passes so a bad result in one
// area doesn't pollute results from a region where the number is clear.

async function extractTextFromBuffer(imageBuffer) {
  const [full, binary] = await Promise.all([
    prepareFullImage(imageBuffer),
    prepareBinaryImage(imageBuffer),
  ]);

  // Crop regions (relative coordinates):
  //  - bottomLeft:  under the photo — where IL ID lives on driver's license
  //  - topLeft:     the photo area itself (sometimes number is next to photo)
  //  - leftHalf:    entire left side of card
  //  - bottomStrip: bottom 40% full width
  const [bottomLeft, topLeft, leftHalf, bottomStrip] = await Promise.all([
    cropRegion(binary, { left: 0,    top: 0.45, width: 0.50, height: 0.55 }),
    cropRegion(binary, { left: 0,    top: 0,    width: 0.50, height: 0.50 }),
    cropRegion(binary, { left: 0,    top: 0,    width: 0.50, height: 1.00 }),
    cropRegion(binary, { left: 0,    top: 0.55, width: 1.00, height: 0.45 }),
  ]);

  const passes = await Promise.all([
    // Full image — general text, two PSM modes
    ocr(full,        { psm: 11, lang: 'eng+heb' }),
    ocr(full,        { psm: 6,  lang: 'eng+heb' }),

    // Full image — digits only (eng, no Hebrew noise)
    ocr(binary,      { psm: 11, lang: 'eng', whitelist: DIGITS_ONLY }),
    ocr(binary,      { psm: 6,  lang: 'eng', whitelist: DIGITS_ONLY }),

    // Targeted crops — digits only, multiple PSM modes
    // PSM 7 = single text line, PSM 8 = single word, PSM 13 = raw line
    ocr(bottomLeft,  { psm: 7,  lang: 'eng', whitelist: DIGITS_ONLY }),
    ocr(bottomLeft,  { psm: 11, lang: 'eng', whitelist: DIGITS_ONLY }),
    ocr(topLeft,     { psm: 7,  lang: 'eng', whitelist: DIGITS_ONLY }),
    ocr(leftHalf,    { psm: 11, lang: 'eng', whitelist: DIGITS_ONLY }),
    ocr(bottomStrip, { psm: 7,  lang: 'eng', whitelist: DIGITS_ONLY }),
    ocr(bottomStrip, { psm: 11, lang: 'eng', whitelist: DIGITS_ONLY }),
  ]);

  return passes.join('\n');
}

// ── ID extraction ─────────────────────────────────────────────────────────────

function extractIds(text) {
  const ilIds  = new Set();
  const idfIds = new Set();

  // Strategy 1: dashed IL-ID format  X-XXXXXX-XX  (Teudat Zehut / driver's license)
  const dashedPattern = /\b(\d{1})[\-\s](\d{6})[\-\s](\d{2})\b/g;
  let m;
  while ((m = dashedPattern.exec(text)) !== null) {
    const c = m[1] + m[2] + m[3];
    if (isValidIlId(c)) ilIds.add(c);
  }

  // Strategy 2: sliding window over every digit run
  // Concatenating all digit sequences then sliding a 9-char window catches
  // cases where the first (or last) digit is visually separated on the card.
  const allDigits = (text.match(/\d+/g) || []).join('');
  for (let i = 0; i <= allDigits.length - 9; i++) {
    const c = allDigits.slice(i, i + 9);
    if (isValidIlId(c)) ilIds.add(c);
  }

  // Strategy 3: plain 9-digit runs after stripping spaces/dashes
  const stripped = text.replace(/[\s\-]/g, '');
  for (const c of (stripped.match(/\d{9}/g) || [])) {
    if (isValidIlId(c)) ilIds.add(c);
  }

  // IDF ID: 7–8 digit sequences not already part of an IL ID
  for (const c of (stripped.match(/\d{7,8}/g) || [])) {
    if (![...ilIds].some((il) => il.includes(c))) {
      idfIds.add(c);
    }
  }

  return {
    ilIds:  [...ilIds],
    idfIds: [...idfIds],
    raw: text,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

async function processImage(imageBuffer) {
  const text = await extractTextFromBuffer(imageBuffer);
  return extractIds(text);
}

module.exports = { processImage, extractIds, isValidIlId };
