// Time: a time of day (`14:30`, seconds where given: `14:30:05`), 24 hours,
// as a browser's time field gives it; sorted as kept (two digits each).
// Typed with one digit of hour (`9:05`), it is kept with two. A date and time
// (the property's type changed from one) gives its time, its day left.
import { isEmpty } from "../../../model/database.ts";
import { readMoment } from "../moment.ts";
import { keptText, type PropertyType } from "../type.ts";

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/** A time of day as kept (`09:05`, `09:05:30`), or undefined where the text is none */
function timeOf(text: string): string | undefined {
  const m = TIME_RE.exec(text.trim());
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}${m[3] === undefined ? "" : `:${m[3]}`}` : undefined;
}

export const time: PropertyType = {
  name: "time",
  label: "Time",
  editor: "time",
  validate: (value) => (isEmpty(value) || (typeof value === "string" && timeOf(value) === value) ? undefined : "no time (HH:MM)"),
  text: keptText,
  parse: (typed) => {
    if (typed.trim() === "") return { value: null };
    const kept = timeOf(typed) ?? readMoment(typed)?.time?.slice(0, 8);
    return kept ? { value: kept } : { problem: `"${typed.trim()}" is no time (HH:MM)` };
  },
};
