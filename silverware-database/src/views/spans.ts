// What an item lasts, as the views that lay items out in time read and change
// it (the calendar; a timeline): from a day to a day. Where it comes from is
// one source's, the views asking it only: now a start property and an end
// property (none: each item a day alone); a start and a duration would be
// another source of the same shape, nothing of the views changed. What a
// change writes is the source's too: every value through its type's `parse`,
// the value it had given (a time kept as its day changes), all of a change in
// one write (`ViewHost.move` with values: one step of Undo).
import type { MenuEntry } from "../../../shared/menu.ts";
import type { PlaceMenuBuilder, PlaceMenuGroup } from "../core/placemenu.ts";
import type { ViewHost } from "../core/view.ts";
import { addDays, type Day } from "../domain/calendar.ts";
import { readMoment } from "../domain/types/moment.ts";
import type { Item, Property, Value } from "../model/database.ts";

/** What an item lasts as read: its first and last day (the same for a day alone), its start's time, why its end was not taken */
export type ItemSpan = { readonly start: Day; readonly end: Day; readonly time?: string; readonly problem?: string };

/** The values a change of a span writes, or why it cannot */
export type SpanChange = { readonly values: Readonly<Record<string, Value>> } | { readonly problem: string };

/** Where items' spans come from, and what changing one writes */
export type SpanSource = {
  /** The property the spans start by (what the views name them by: Due, Start) */
  readonly start: Property;
  /** The property they end by, where they have one; none: each a day alone */
  readonly end?: Property;
  /** Whether a span can be moved (its start changed by hand) and its length changed (its end too) */
  readonly movable: boolean;
  readonly resizable: boolean;
  /** An item's span; undefined where it has no start (or one that reads as no day: `unread`) */
  spanOf(item: Item): ItemSpan | undefined;
  /** Whether an item has a start that reads as no day (a text: moved by nothing, which would write over it) */
  unread(item: Item): boolean;
  /** Whether an item has an end that reads as no day (a text: its end changed by nothing, which would write over it) */
  endUnread(item: Item): boolean;
  /** Its span moved `by` days, its length kept */
  moved(item: Item, by: number): SpanChange;
  /** Its first day `day`, its last kept */
  withStart(item: Item, day: Day): SpanChange;
  /** Its last day `day`, its first kept */
  withEnd(item: Item, day: Day): SpanChange;
  /** A new item's values: on `day`, a day alone */
  created(day: Day): SpanChange;
};

const moment = (value: unknown) => (typeof value === "string" ? readMoment(value) : undefined);
const kept = (value: unknown) => value !== undefined && value !== null && value !== "";

/** Spans from a start property and an end property (none: a day each), as the host's types read and write them */
export function startEndSpans(host: Pick<ViewHost, "type">, start: Property, end: Property | undefined): SpanSource {
  // A day written as `property`'s type writes it, the value it had given (a time kept)
  const write = (property: Property, day: Day, was: Value | undefined): { readonly value: Value } | { readonly problem: string } => {
    const parsed = host.type(property).parse(day, property.params, was);
    return "problem" in parsed ? { problem: `${property.label}: ${parsed.problem}` } : { value: parsed.value };
  };
  const spanOf = (item: Item): ItemSpan | undefined => {
    const from = moment(item.values[start.key]);
    if (!from) return undefined;
    if (!end || !kept(item.values[end.key])) return { start: from.day, end: from.day, ...(from.time ? { time: from.time } : {}) };
    const to = moment(item.values[end.key]);
    const problem = !to ? `its ${end.label} reads as no day` : to.day < from.day ? `its ${end.label} is before its ${start.label}` : undefined;
    return { start: from.day, end: problem ? from.day : to!.day, ...(from.time ? { time: from.time } : {}), ...(problem ? { problem } : {}) };
  };
  const both = (item: Item, first: Day, last: Day | undefined): SpanChange => {
    const values: Record<string, Value> = {};
    const made = write(start, first, item.values[start.key]);
    if ("problem" in made) return made;
    values[start.key] = made.value;
    if (end && last !== undefined) {
      const ended = write(end, last, item.values[end.key]);
      if ("problem" in ended) return ended;
      values[end.key] = ended.value;
    }
    return { values };
  };
  return {
    start,
    ...(end ? { end } : {}),
    // (A move writes its end too: an end not changed by hand moves nothing)
    movable: !start.readonly && !end?.readonly,
    resizable: !start.readonly && !!end && !end.readonly,
    spanOf,
    unread: (item) => kept(item.values[start.key]) && !moment(item.values[start.key]),
    endUnread: (item) => !!end && kept(item.values[end.key]) && !moment(item.values[end.key]),
    moved(item, by) {
      const span = spanOf(item);
      if (!span) return { problem: `${item.name} has no ${start.label}` };
      // (An end kept only where it was one: a day alone stays one)
      const hasEnd = !!end && kept(item.values[end.key]) && !span.problem;
      return both(item, addDays(span.start, by), hasEnd ? addDays(span.end, by) : undefined);
    },
    withStart(item, day) {
      const span = spanOf(item);
      // (Its end as it reads, a start given or not: one after it refused)
      const last = end && kept(item.values[end.key]) ? moment(item.values[end.key])?.day : undefined;
      if (last && !span?.problem && day > last) return { problem: `${item.name} would start after it ends` };
      // A day alone given an earlier start: it lasts from there to the day it was (as its end's handle lasts it the other way)
      if (end && !end.readonly && span && !kept(item.values[end.key]) && day < span.start) return both(item, day, span.start);
      return both(item, day, undefined);
    },
    withEnd(item, day) {
      const span = spanOf(item);
      if (!end) return { problem: `No property ends ${item.name}` };
      if (!span) return { problem: `${item.name} has no ${start.label}` };
      // (An end kept that reads as no day: its text never written over)
      if (kept(item.values[end.key]) && !moment(item.values[end.key])) return { problem: `${item.name}: its ${end.label} "${String(item.values[end.key])}" reads as no day; open it to set one` };
      if (day < span.start) return { problem: `${item.name} would end before it starts` };
      const ended = write(end, day, item.values[end.key]);
      return "problem" in ended ? ended : { values: { [end.key]: ended.value } };
    },
    created(day) {
      const made = write(start, day, undefined);
      return "problem" in made ? made : { values: { [start.key]: made.value } };
    },
  };
}

/**
 * The properties whose values are days: a type edited as a date or a date and
 * time (a system one's too: Created, Modified) that keeps a day as one (its
 * `parse` of a day reads back as it: a type of the user's keeping another form
 * would be placed nowhere, and written where it could not be read back)
 */
export function dayProperties(host: Pick<ViewHost, "database" | "type">): Property[] {
  return host.database.properties.filter((property) => {
    const type = host.type(property);
    if (type.editor !== "date" && type.editor !== "datetime-local") return false;
    const made = type.parse("2026-01-31", property.params);
    return "value" in made && typeof made.value === "string" && readMoment(made.value)?.day === "2026-01-31";
  });
}

// A view's meta keys of the properties its spans start and end by (each view its own: a calendar's and a timeline's apart)
const START_KEY = "dateBy";
const END_KEY = "endBy";

/** The meta keys of a view of spans that hold a property's key (its `propertyMeta`): followed as a key changes */
export const SPAN_META: readonly string[] = [START_KEY, END_KEY];

/** A view's spans: by the start and end properties its meta names (the first property of days, and none, by default); an end not changed by hand none (a move writes it) */
export function viewSpans(host: ViewHost): SpanSource | undefined {
  const all = dayProperties(host);
  const start = all.find((one) => one.key === host.getMeta(START_KEY)) ?? all[0];
  if (!start) return undefined;
  const end = all.find((one) => one.key === host.getMeta(END_KEY) && one.key !== start.key && !one.readonly);
  return startEndSpans(host, start, end);
}

/** A view's Start and End in its place's ⋯: the properties of days to pick, kept in the view's meta */
export function spanMenu(host: ViewHost, menu: PlaceMenuBuilder, icon: string): readonly PlaceMenuGroup[] {
  const all = dayProperties(host);
  const spans = viewSpans(host);
  const set = (values: Record<string, string | undefined>) => void host.setMeta(values).then(() => host.refresh());
  const none = all.length ? {} : { disabled: "No property of dates (a date, a date and time)" };
  const starts = (): MenuEntry[] => all.map((property) => menu.item({ label: property.label, checked: property.key === spans?.start.key, run: () => set({ [START_KEY]: property.key, ...(property.key === spans?.end?.key ? { [END_KEY]: undefined } : {}) }) }));
  const ends = (): MenuEntry[] => [
    menu.item({ label: "None (a day each)", checked: !spans?.end, run: () => set({ [END_KEY]: undefined }) }),
    // (Not one not changed by hand: a move writes its end too)
    ...all.filter((property) => property.key !== spans?.start.key && !property.readonly).map((property) => menu.item({ label: property.label, checked: property.key === spans?.end?.key, run: () => set({ [END_KEY]: property.key }) })),
  ];
  return [
    menu.slot.view([
      menu.submenu({ label: "Start", icon, value: { text: spans?.start.label ?? "None" }, ...none }, starts),
      menu.submenu({ label: "End", icon, value: { text: spans?.end?.label ?? "None" }, ...none }, ends),
    ]),
  ];
}
