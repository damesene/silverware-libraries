// Date: a day, as ISO text (`2026-11-10`), as formulas write dates and as
// SilverBullet's index keeps one unquoted (probe 1). A value with a time too
// (a date and time's, the property's type changed) reads as its day and keeps
// its time: shown, sorted, grouped and filtered by its day, its time kept as
// another day is picked (domain/types/moment.ts).
import { isEmpty } from "../../../model/database.ts";
import { readMoment, writeMoment } from "../moment.ts";
import { keptText, type PropertyType } from "../type.ts";

const moment = (value: unknown) => (typeof value === "string" ? readMoment(value) : undefined);

export const date: PropertyType = {
  name: "date",
  label: "Date",
  editor: "date",
  validate: (value) => (isEmpty(value) || moment(value) ? undefined : "no date (YYYY-MM-DD)"),
  text: (value) => moment(value)?.day ?? keptText(value),
  // (Grouped by its day: a value with a time in the group of its day)
  groupValue: (value) => moment(value)?.day ?? value,
  parse: (typed, _params, was) => {
    const trimmed = typed.trim();
    if (trimmed === "") return { value: null };
    const read = readMoment(trimmed);
    if (!read) return { problem: `"${trimmed}" is no date (YYYY-MM-DD)` };
    // (A day alone: the time the value had kept with it)
    return { value: writeMoment(read.time === undefined ? { day: read.day, time: moment(was)?.time } : read) };
  },
};
