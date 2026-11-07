// Date: a day, as ISO text (`2026-11-10`), as formulas write dates and as
// SilverBullet's index keeps one unquoted (probe 1). A date and time is no
// date of this type (the index does not keep one as written).
import { isEmpty } from "../../../model/database.ts";
import { keptText, type PropertyType } from "../type.ts";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether a text is a day of the calendar written as ISO (no 2026-02-30) */
function isDay(text: string): boolean {
  const m = DATE_RE.exec(text);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const date: PropertyType = {
  name: "date",
  label: "Date",
  validate: (value) => (isEmpty(value) || (typeof value === "string" && isDay(value)) ? undefined : "no date (YYYY-MM-DD)"),
  text: keptText,
  parse: (typed) => {
    const trimmed = typed.trim();
    if (trimmed === "") return { value: null };
    return isDay(trimmed) ? { value: trimmed } : { problem: `"${trimmed}" is no date (YYYY-MM-DD)` };
  },
};
