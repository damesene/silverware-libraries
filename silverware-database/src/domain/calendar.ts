// A calendar's days, pure: a month as the weeks it spans (each seven days, as
// ISO days `2026-11-08`, a week starting on a Monday or a Sunday), months
// stepped forward and back, a local day of a moment. Days are text, as the
// date types keep them (domain/types/moment.ts): no time zone, no clock.

/** A day as the date types keep it: `YYYY-MM-DD` */
export type Day = string;

/** A month: its year, and its month counted from 0 (January) as a JavaScript Date counts */
export type Month = { readonly year: number; readonly month: number };

const pad = (n: number) => String(n).padStart(2, "0");

/** A day of the calendar (no time zone: its fields as given) */
export function dayOf(year: number, month: number, date: number): Day {
  const at = new Date(Date.UTC(year, month, date));
  return `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;
}

/** The day it is where the user is (their clock's local day) */
export function today(now: Date = new Date()): Day {
  return dayOf(now.getFullYear(), now.getMonth(), now.getDate());
}

/** The month a day is in */
export function monthOfDay(day: Day): Month {
  const [year, month] = day.split("-").map(Number);
  return { year: year!, month: month! - 1 };
}

/** A month `by` months after (before, where negative) */
export function stepMonth(at: Month, by: number): Month {
  const total = at.year * 12 + at.month + by;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** The day of the week of a day, 0 Sunday to 6 Saturday */
export function weekday(day: Day): number {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, date!)).getUTCDay();
}

/**
 * The weeks a month spans, each seven days, starting on `weekStart` (0 Sunday,
 * 1 Monday): the days before its first and after its last of the months beside
 * it, so every week is whole (four to six of them)
 */
export function monthWeeks(at: Month, weekStart: 0 | 1): Day[][] {
  const first = dayOf(at.year, at.month, 1);
  const before = (weekday(first) - weekStart + 7) % 7;
  const length = new Date(Date.UTC(at.year, at.month + 1, 0)).getUTCDate();
  const count = Math.ceil((before + length) / 7) * 7;
  const days = Array.from({ length: count }, (_, at2) => dayOf(at.year, at.month, 1 - before + at2));
  return Array.from({ length: count / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7));
}

/** Whether a day is in a month */
export function inMonth(day: Day, at: Month): boolean {
  const of = monthOfDay(day);
  return of.year === at.year && of.month === at.month;
}

/** A day `by` days after (before, where negative) */
export function addDays(day: Day, by: number): Day {
  const [year, month, date] = day.split("-").map(Number);
  return dayOf(year!, month! - 1, date! + by);
}

/** How many days from `from` to `to` (negative where `to` is before) */
export function daysBetween(from: Day, to: Day): number {
  const at = (day: Day) => {
    const [year, month, date] = day.split("-").map(Number);
    return Date.UTC(year!, month! - 1, date!);
  };
  return Math.round((at(to) - at(from)) / 86_400_000);
}

/** What lasts from a day to a day (its last, the same day for one of a day alone), by a key of the caller's */
export type Span<K> = { readonly key: K; readonly start: Day; readonly end: Day };

/** A span's part in a week: its columns (0 to 6, both in it), its row among the week's, whether it starts and ends there */
export type Segment<K> = { readonly key: K; readonly from: number; readonly to: number; readonly lane: number; readonly starts: boolean; readonly ends: boolean };

/**
 * The parts of `spans` in a week (its seven days), each in the first row free
 * across its columns: the longer first where they start alike, then as given
 * (the caller's order: a time, the view's), so a span keeps its row across the
 * days it lasts in a week
 */
export function weekSegments<K>(week: readonly Day[], spans: readonly Span<K>[]): Segment<K>[] {
  const first = week[0]!;
  const last = week[week.length - 1]!;
  const within = spans
    .map((span, at) => ({ span, at }))
    .filter(({ span }) => span.start <= last && span.end >= first)
    .sort((a, b) => (a.span.start < b.span.start ? -1 : a.span.start > b.span.start ? 1 : daysBetween(b.span.start, b.span.end) - daysBetween(a.span.start, a.span.end) || a.at - b.at));
  // Each lane's days taken, a bit a day; and each day's first lane free (a lane under it is taken that day, so a span
  // looks no lower than its days' highest: a day of thousands of items costs a step each, not a pass over its lanes)
  const lanes: number[] = [];
  const free = week.map(() => 0);
  return within.map(({ span }) => {
    const from = Math.max(0, daysBetween(first, span.start));
    const to = Math.min(week.length - 1, daysBetween(first, span.end));
    const days = ((1 << (to - from + 1)) - 1) << from;
    let lane = Math.max(...free.slice(from, to + 1));
    while ((lanes[lane] ?? 0) & days) lane++;
    lanes[lane] = (lanes[lane] ?? 0) | days;
    for (let at = from; at <= to; at++) while ((lanes[free[at]!] ?? 0) & (1 << at)) free[at]!++;
    return { key: span.key, from, to, lane, starts: span.start >= first, ends: span.end <= last };
  });
}
