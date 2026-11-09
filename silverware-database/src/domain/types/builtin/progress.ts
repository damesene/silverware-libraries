// Progress: a share done, a number from 0 to 1 (`0.6667`), shown as a percent
// (`67%`, the views with a bar beside it), sorted and filtered as its number.
// The system property Task progress's: not offered for a property of the
// user's (one typed by hand is a number, a percent's Number).
import { isEmpty } from "../../../model/database.ts";
import { keptText, type PropertyType } from "../type.ts";

const isShare = (value: unknown): value is number => typeof value === "number" && value >= 0 && value <= 1;

/** A share as a whole percent, rounded, but 100 only when all is done and 0 only when none is (199 of 200 is 99, 1 of 300 is 1, 2 of 3 is 67) */
export function wholePercent(share: number): number {
  if (share <= 0) return 0;
  if (share >= 1) return 100;
  return Math.min(99, Math.max(1, Math.round(share * 100)));
}

// A number as typed: digits with a decimal point or comma, a percent sign after it or not
const TYPED_RE = /^(\d+(?:[.,]\d+)?)\s*(%?)$/;

export const progress: PropertyType = {
  name: "progress",
  label: "Progress",
  offered: false,
  look: "share",
  validate: (value) => (isEmpty(value) || isShare(value) ? undefined : "no share (0 to 1)"),
  text: (value) => (isShare(value) ? `${wholePercent(value)}%` : keptText(value)),
  // (Fixed places, so the texts sort as the numbers: 0.0500 before 0.5000 before 1.0000)
  sortKey: (value) => (isShare(value) ? value.toFixed(4) : keptText(value)),
  parse: (typed) => {
    const trimmed = typed.trim();
    if (trimmed === "") return { value: null };
    const read = TYPED_RE.exec(trimmed);
    const number = read ? Number(read[1]!.replace(",", ".")) / (read[2] ? 100 : 1) : NaN;
    return isShare(number) ? { value: number } : { problem: `"${trimmed}" is no share (0 to 1, or 0% to 100%)` };
  },
};
