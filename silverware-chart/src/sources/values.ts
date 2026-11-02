// A cell's text as the value a chart draws: what the sources and the criteria share. Pure.

/** A cell's text as a number: as written, or with its unit and spaces left out (12,99 € is 12.99); else no value */
export function numberOf(text: string): number | null {
  const plain = Number(text);
  if (text.trim() !== "" && Number.isFinite(plain)) return plain;
  let digits = text.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(digits)) return null;
  // A comma alone the decimal one, as written in much of Europe
  if (digits.includes(",") && !digits.includes(".")) digits = digits.replace(",", ".");
  const n = Number(digits.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// A number with what may stand around it: before, signs or a currency (of letters its code: USD 12),
// after, a unit or a currency (3 kg, 12,99 €, 5%)
const PLAIN_NUMBER = /^([^\d\p{L}]*(?:\p{Lu}{3}\s+)?)(\d[\d.,\s]*)[^\d]*$/u;

/**
 * A cell's text as a number only where it is one: a number, with a unit or
 * a currency around it; a code with digits in it (A1, Q1, v2, Room 12) is a text.
 * What conditions compare as numbers and what makes a column one of numbers
 * (a drawn value is read as `numberOf` reads it, any digits a value)
 */
export function plainNumberOf(text: string): number | null {
  const match = PLAIN_NUMBER.exec(text.trim());
  if (!match) return null;
  const n = numberOf(match[2]!.trim());
  if (n === null) return null;
  // (Its sign before it, a currency between them or not: -12, -€12)
  return match[1]!.includes("-") ? -n : n;
}
