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
