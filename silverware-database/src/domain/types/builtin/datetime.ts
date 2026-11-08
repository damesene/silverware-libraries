// Date and time: a moment as local ISO text (`2026-11-08T14:30`, seconds
// where given), as a browser's date and time field gives it and as
// SilverBullet's index keeps a page's dates (Created, Modified); shown to the
// minute (`2026-11-08 14:30`), sorted as kept. A day alone (a date's, the
// property's type changed) reads too and shows as its day, no time made up
// for it (domain/types/moment.ts). Written into a page as text in quotes (the
// page writer quotes what would read as another kind), so the index keeps it
// as written; one typed unquoted by hand may be read otherwise, and is shown
// as kept, invalid.
import { isEmpty } from "../../../model/database.ts";
import { readMoment, writeMoment } from "../moment.ts";
import { keptText, type PropertyType } from "../type.ts";

const moment = (value: unknown) => (typeof value === "string" ? readMoment(value) : undefined);

export const datetime: PropertyType = {
  name: "datetime",
  label: "Date & time",
  editor: "datetime-local",
  validate: (value) => (isEmpty(value) || moment(value) ? undefined : "no date and time (YYYY-MM-DD HH:MM)"),
  text: (value) => {
    const read = moment(value);
    return read ? `${read.day}${read.time === undefined ? "" : ` ${read.time.slice(0, 5)}`}` : keptText(value);
  },
  // (Grouped to the minute, as shown: a page's Created to the millisecond in the group of its minute)
  groupValue: (value) => {
    const read = moment(value);
    return read ? writeMoment(read.time === undefined ? read : { day: read.day, time: read.time.slice(0, 5) }) : value;
  },
  sortKey: (value) => {
    const read = moment(value);
    return read ? writeMoment(read) : keptText(value);
  },
  parse: (typed, _params, was) => {
    const trimmed = typed.trim();
    if (trimmed === "") return { value: null };
    const read = readMoment(trimmed);
    if (!read) return { problem: `"${trimmed}" is no date and time (YYYY-MM-DD HH:MM)` };
    // (A day alone: the time the value had kept with it, as a date keeps it; a day put on a calendar's other day)
    return { value: writeMoment(read.time === undefined ? { day: read.day, time: moment(was)?.time } : read) };
  },
};
