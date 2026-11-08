// Date and time: a moment as local ISO text (`2026-11-08T14:30:05.123`), as
// SilverBullet's index keeps a page's dates; shown to the minute
// (`2026-11-08 14:30`), sorted as kept. The system properties' (Created,
// Modified) only: not offered for a property of the user's, as a date and time
// written in a page is not kept as written by the index (probe 1).
import { isEmpty } from "../../../model/database.ts";
import { keptText, type PropertyType } from "../type.ts";

const MOMENT_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;

export const datetime: PropertyType = {
  name: "datetime",
  label: "Date & time",
  offered: false,
  validate: (value) => (isEmpty(value) || (typeof value === "string" && MOMENT_RE.test(value)) ? undefined : "no date and time (YYYY-MM-DD HH:MM)"),
  text: (value) => {
    const m = typeof value === "string" ? MOMENT_RE.exec(value) : null;
    return m ? `${m[1]} ${m[2]}` : keptText(value);
  },
  sortKey: (value) => (typeof value === "string" ? value.replace(" ", "T") : keptText(value)),
  parse: (typed) => {
    const trimmed = typed.trim();
    if (trimmed === "") return { value: null };
    return MOMENT_RE.test(trimmed) ? { value: trimmed.replace(" ", "T") } : { problem: `"${trimmed}" is no date and time (YYYY-MM-DD HH:MM)` };
  },
};
