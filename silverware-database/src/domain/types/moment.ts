// A day and maybe its time, as the date types keep them: ISO text, the day
// alone (`2026-11-10`) or with its time (`2026-11-10T14:30`, seconds where
// given; a space for the T read too). A date and a date and time read both, so
// a property changed from one to the other keeps every value as it is, a time
// included: a date shows its day, a date and time its day and its time where
// it has one (never a midnight it was not given).

const MOMENT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d(?:\.\d+)?))?)?$/;

/** A day and its time where it has one (`HH:MM`, `HH:MM:SS`, a fraction of a second where given: a page's Created) */
export interface Moment {
  readonly day: string;
  readonly time?: string;
}

/** A text read as a day of the calendar (no 2026-02-30) and maybe its time, or undefined where it is none */
export function readMoment(text: string): Moment | undefined {
  const m = MOMENT_RE.exec(text.trim());
  if (!m) return undefined;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  const at = `${m[1]}-${m[2]}-${m[3]}`;
  return m[4] === undefined ? { day: at } : { day: at, time: `${m[4]}:${m[5]}${m[6] === undefined ? "" : `:${m[6]}`}` };
}

/** A moment as kept: its day alone, or its day and time joined by a T */
export function writeMoment(moment: Moment): string {
  return moment.time === undefined ? moment.day : `${moment.day}T${moment.time}`;
}
