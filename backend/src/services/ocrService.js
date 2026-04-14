'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
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
// Dimensions are computed once by the caller and passed in (no metadata reads here).

async function prepareFullImage(buffer, width, height) {
  return sharp(buffer)
    .grayscale()
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .normalize()
    .sharpen({ sigma: 1.5 })
    .linear(1.4, -20)       // boost contrast
    .toBuffer();
}

// High-contrast black/white version — better for colored card backgrounds
async function prepareBinaryImage(buffer, width, height) {
  return sharp(buffer)
    .grayscale()
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' })
    .normalize()
    .threshold(140)         // force pure black/white — strips colored backgrounds
    .toBuffer();
}

// ── Tesseract helpers ─────────────────────────────────────────────────────────

const DIGITS_ONLY = '0123456789-';

async function ocr(imageBuffer, { psm, lang = 'eng+heb', whitelist = null }) {
  const tmpPath = path.join(
    os.tmpdir(),
    `ocr_${crypto.randomBytes(8).toString('hex')}.png`
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

// ── Multi-pass OCR with cascading tiers and early exit ────────────────────────
//
// Passes run in three cascading tiers ordered cheapest→most-expensive.
// Each tier checks for a valid IL ID before proceeding to the next.
//
// Tier 1 — full binary, digits only, sparse text  (no language model overhead)
// Tier 2 — full binary, digits only, block mode   (different PSM, same low cost)
// Tier 3 — full image with Hebrew                 (most expensive, last resort)

async function extractTextFromBuffer(imageBuffer) {
  // Read metadata once; derive capped target dimensions (max 2000px wide)
  const meta = await sharp(imageBuffer).metadata();
  const rawScale     = meta.width < 1500 ? 2 : 1;
  const scaledWidth  = Math.min(meta.width * rawScale, 2000);
  const scaledHeight = Math.round(meta.height * scaledWidth / meta.width);

  // Preprocess both variants once upfront — used across all tiers
  const [full, binary] = await Promise.all([
    prepareFullImage(imageBuffer, scaledWidth, scaledHeight),
    prepareBinaryImage(imageBuffer, scaledWidth, scaledHeight),
  ]);

  // ── Tier 1: full binary, sparse text, digits only ────────────────────────
  const tier1Text = await ocr(binary, { psm: 11, lang: 'eng', whitelist: DIGITS_ONLY });
  if (extractIds(tier1Text).ilIds.length > 0) return tier1Text;

  // ── Tier 2: full binary, block mode, digits only ─────────────────────────
  const tier2Text = [tier1Text, await ocr(binary, { psm: 6, lang: 'eng', whitelist: DIGITS_ONLY })].join('\n');
  if (extractIds(tier2Text).ilIds.length > 0) return tier2Text;

  // ── Tier 3: full image with Hebrew models (last resort) ──────────────────
  const tier3Text = (await Promise.all([
    ocr(full, { psm: 11, lang: 'eng+heb' }),
    ocr(full, { psm: 6,  lang: 'eng+heb' }),
  ])).join('\n');

  return [tier2Text, tier3Text].join('\n');
}

// ── ID extraction ─────────────────────────────────────────────────────────────

function extractIds(text) {
  const ilIds  = new Set();
  const idfIds = new Set();

  // Strategy 1: dashed IL-ID format  X-XXXXXX-XX  (Teudat Zehut / driver's license)
  const dashedPattern = /\b(\d{1})[-\s](\d{6})[-\s](\d{2})\b/g;
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
  const stripped = text.replace(/[\s-]/g, '');
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
