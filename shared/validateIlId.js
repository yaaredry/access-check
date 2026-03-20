/**
 * Validates an Israeli Teudat Zehut (IL_ID):
 * must be exactly 9 digits and pass the Luhn-style checksum.
 */
export function validateIlId(value) {
  if (!/^\d{9}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = digits[i] * (i % 2 === 0 ? 1 : 2);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}
