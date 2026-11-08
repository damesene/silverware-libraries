// The calendar: a month of days, each item on the days it lasts (from its
// start to its end: views/spans.ts, the properties picked under Start and End
// in ⋯, the first property of days and none by default), as Notion's calendar
// shows a database. A week is a row, each item in it a bar across its days, in
// the first lane free (domain/calendar.ts `weekSegments`), so an item keeps
// its lane across the days it lasts. The month stepped back and forth (‹ ›,
// Today); a day's + adds an item on it; an item pressed opens (the peek);
// dragged by its body onto another day, it moves there whole (its length and
// times kept); by its ends' handles, its start or its end is that day. The
// items without a start (or one that reads as none: never moved, its text
// would go) over the month, dragged onto a day to give them one. A week with
// many lanes shows a few and +N more under each day hiding some. A day pressed
// is the day picked: its items listed under the month, whole (where the place
// is narrow the bars are marks, their names too narrow to read; the list is
// how the items are reached and added there). The month shown and the day
// picked are the view's for the session, not written (each step would write
// the block); the properties are the view's meta.
import { el } from "../../../../shared/elements.ts";
import type { ViewDefinition, ViewHost } from "../../core/view.ts";
import { addDays, type Day, daysBetween, inMonth, type Month, monthOfDay, monthWeeks, stepMonth, today, weekSegments } from "../../domain/calendar.ts";
import type { Item } from "../../model/database.ts";
import { svg } from "../icons.ts";
import { type ItemSpan, SPAN_META, type SpanChange, spanMenu, viewSpans } from "../spans.ts";

const ICON = svg('<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3M5 9h1.5M7.5 9H9M10 9h1.5M5 11.5h1.5M7.5 11.5H9"/>');
const BACK = svg('<path d="m10 4-4 4 4 4"/>');
const NEXT = svg('<path d="m6 4 4 4-4 4"/>');

// What an item dragged carries: its own type, so dropped on the page's text it inserts nothing there
const DRAG_TYPE = "application/x-silverware-database-item";

// The lanes a week shows before +N more (one more shown rather than +1 more)
const SHOWN_LANES = 3;

// The lanes +N more shows more each time it is pressed, and the items a list (the day picked, those without a start)
// shows more each time: as many items as anyone has, never all of them drawn at once
const MORE_LANES = 50;
const LISTED = 100;

// A place this narrow shows its bars as marks, the picked day's items listed under the month (the style page's container query)
const NARROW = 600;

// Dates as the rest of the plugin's words: English
const LOCALE = "en-US";

// The month each database's calendar shows, the day picked in it, the lanes each week opened shows, the items without a
// start folded, how many of a list are shown (by the database and the list: the day's by that day): the session's, not written
const months = new Map<string, Month>();
const picked = new Map<string, Day>();
const opened = new Map<string, Map<Day, number>>();
const undatedFolded = new Set<string>();
const listed = new Map<string, number>();

// What a drag is: the item, what of it is dragged (it whole, by the day it was taken by; its start; its end)
type Drag = { item?: Item; what?: "move" | "start" | "end"; grab?: Day };

function draw(host: ViewHost, element: HTMLElement, drag: Drag): void {
  const doc = host.document;
  const spans = viewSpans(host);
  if (!spans) {
    element.replaceChildren(el(doc, "p", { class: "swd-place-note", text: "No property of dates: add one (a date, a date and time) in Properties" }));
    return;
  }
  const key = host.database.id;
  const shown = months.get(key) ?? monthOfDay(today());
  // The day picked: the one pressed, else today where it is in the month shown, else the month's first
  const chosen = ((day: Day | undefined) => (day && inMonth(day, shown) ? day : inMonth(today(), shown) ? today() : `${shown.year}-${String(shown.month + 1).padStart(2, "0")}-01`))(picked.get(key));
  const open = opened.get(key) ?? new Map<Day, number>();
  opened.set(key, open);
  const weekStart = host.setting("weekStart") === "Sunday" ? 0 : 1;
  const now = today();
  // Each item's span read once; those without a start apart; the order the view lists them, an earlier time first
  const spanOf = new Map(host.items.map((item) => [item, spans.spanOf(item)] as const));
  const dated = host.items.filter((item) => spanOf.get(item)).sort((a, b) => (spanOf.get(a)!.time ?? "").localeCompare(spanOf.get(b)!.time ?? ""));
  const undated = host.items.filter((item) => !spanOf.get(item));
  const redraw = () => draw(host, element, drag);
  const go = (to: Month, from: string) => {
    months.set(key, to);
    redraw();
    element.querySelector<HTMLElement>(from)?.focus({ preventScroll: true });
  };
  const pick = (day: Day) => {
    picked.set(key, day);
    redraw();
  };
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" });
  const utc = (day: Day) => new Date(`${day}T00:00:00Z`);
  const longDay = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const shortDay = fmt({ day: "numeric", month: "short" });
  // What a span says of itself: its days where it lasts more than one, its time, why its end was not taken
  const lasting = (span: ItemSpan) => [span.start !== span.end ? `${shortDay.format(utc(span.start))} – ${shortDay.format(utc(span.end))}` : "", span.time?.slice(0, 5) ?? "", span.problem ?? ""].filter(Boolean).join(", ");
  const change = (item: Item, made: SpanChange) => {
    if ("problem" in made) return host.notify(made.problem);
    // (Its values in one write: one step of Undo; its place by hand kept)
    void host.move(item, { values: made.values });
  };
  // An item: its time (where its start is shown) and its name; pressed, opened; dragged by its body, moved; by its handles, its ends
  const entry = (item: Item, part?: { readonly starts: boolean; readonly ends: boolean; readonly from: Day; readonly days: number }) => {
    const span = spanOf.get(item);
    const unread = spans.unread(item);
    const showsStart = !part || part.starts;
    const time = showsStart ? span?.time?.slice(0, 5) : undefined;
    const about = span ? lasting(span) : "";
    const title = unread
      ? `${item.name}: its ${spans.start.label} "${String(item.values[spans.start.key])}" reads as no day; open it to set one`
      : `${item.name}${about ? ` (${about})` : ""}: open${spans.movable ? ", or drag it to another day" : ""}`;
    const movable = spans.movable && !unread;
    // (An element any browser drags: Firefox drags no button; a button still to the keys and to a screen reader)
    const box = el(
      doc,
      "div",
      {
        class: `swd-cal-item${unread || span?.problem ? " swd-invalid" : ""}${part && !part.starts ? " swd-cal-before" : ""}${part && !part.ends ? " swd-cal-after" : ""}`,
        title,
        attrs: { role: "button", tabindex: "0", "aria-label": `${item.name}, ${span ? (lasting(span) || longDay.format(utc(span.start))) : `no ${spans.start.label}`}`, "data-item": item.key, ...(movable ? { draggable: "true" } : {}) },
        run: () => void host.open(item),
      },
      // (A space between its time and its name, not a margin: else the two are one word to the lines, broken inside)
      el(doc, "span", "swd-cal-text", host.itemIcon(item), ...(time ? [el(doc, "span", { class: "swd-cal-time", text: time }), " "] : []), el(doc, "span", { class: "swd-cal-name", text: item.name })),
    );
    host.itemLook(item, box);
    box.addEventListener("keydown", (event) => {
      if (event.target !== box || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      void host.open(item);
    });
    const start = (what: Drag["what"], grab: Day | undefined) => (event: DragEvent) => {
      drag.item = item;
      drag.what = what;
      drag.grab = grab;
      event.dataTransfer?.setData(DRAG_TYPE, item.key);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      box.classList.add("swd-cal-dragged");
      event.stopPropagation();
    };
    if (movable)
      box.addEventListener("dragstart", (event) => {
        // (The day it is taken by: dropped on another, it moves by as many days; in a week's bar, the day under the pointer)
        let grab = span?.start;
        if (part && span) {
          const rect = box.getBoundingClientRect();
          const at = rect.width > 0 ? Math.min(part.days - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * part.days))) : 0;
          grab = addDays(part.from, at);
        }
        start("move", grab)(event);
      });
    // Its ends' handles: where it starts and ends in this week, its length changed by them
    if (part && span && spans.resizable && !unread && !spans.endUnread(item)) {
      const handle = (which: "start" | "end") => {
        const made = el(doc, "span", { class: `swd-cal-handle swd-cal-handle-${which}`, title: which === "start" ? `Drag to change its ${spans.start.label}` : `Drag to change its ${spans.end!.label}`, attrs: { draggable: "true", "aria-hidden": "true" } });
        made.addEventListener("dragstart", start(which, undefined));
        made.addEventListener("click", (event) => event.stopPropagation());
        return made;
      };
      if (part.starts) box.prepend(handle("start"));
      if (part.ends) box.append(handle("end"));
    }
    box.addEventListener("dragend", () => {
      box.classList.remove("swd-cal-dragged");
      drag.item = undefined;
      for (const over of element.querySelectorAll(".swd-drop")) over.classList.remove("swd-drop");
    });
    return box;
  };
  // A drop on a day: the item moved there (by as many days as from the day it was taken by), or its start or end that day
  const dropped = (day: Day) => {
    // (The item as it is now: drawn anew while it was dragged, its value may have changed)
    const item = drag.item && (host.items.find((one) => one.key === drag.item!.key) ?? drag.item);
    const { what, grab } = drag;
    drag.item = undefined;
    if (!item) return;
    if (what === "start") return change(item, spans.withStart(item, day));
    if (what === "end") return change(item, spans.withEnd(item, day));
    // (One without a start: given that day; one moved by no day: nothing written)
    if (!spanOf.get(item) || grab === undefined) return change(item, spans.withStart(item, day));
    const by = daysBetween(grab, day);
    if (by !== 0) change(item, spans.moved(item, by));
  };
  const carries = (event: DragEvent) => !!drag.item && (!event.dataTransfer || [...event.dataTransfer.types].includes(DRAG_TYPE));
  // A target of drops: its day where it is one (a day of a week, the picked day's list), else the day under the pointer in a week
  const dropOn = (target: HTMLElement, dayAt: (event: DragEvent) => Day | undefined) => {
    if (!spans.movable) return;
    target.addEventListener("dragover", (event) => {
      if (!carries(event) || !dayAt(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      for (const over of element.querySelectorAll(".swd-drop")) over.classList.remove("swd-drop");
      const day = dayAt(event);
      (target.matches(".swd-cal-agenda") ? target : target.querySelector(`.swd-cal-day[data-day="${day}"]`))?.classList.add("swd-drop");
    });
    target.addEventListener("dragleave", (event) => {
      if (!target.contains(event.relatedTarget as Node | null)) for (const over of target.querySelectorAll(".swd-drop")) over.classList.remove("swd-drop");
      target.classList.remove("swd-drop");
    });
    target.addEventListener("drop", (event) => {
      const day = carries(event) ? dayAt(event) : undefined;
      for (const over of element.querySelectorAll(".swd-drop")) over.classList.remove("swd-drop");
      if (!day) return;
      event.preventDefault();
      dropped(day);
    });
  };
  // A day's + : an item added on it
  const add = (day: Day) => {
    const made = spans.created(day);
    if ("problem" in made) return host.notify(made.problem);
    void host.create({ values: made.values });
  };
  const title = fmt({ month: "long", year: "numeric" }).format(new Date(Date.UTC(shown.year, shown.month, 1)));
  const head = el(
    doc,
    "div",
    "swd-cal-head",
    el(doc, "button", { class: "swd-cal-step", html: BACK, title: "Previous month", attrs: { "aria-label": "Previous month" }, run: () => go(stepMonth(shown, -1), '.swd-cal-step[aria-label="Previous month"]') }),
    el(doc, "h3", { class: "swd-cal-title", text: title, attrs: { tabindex: "-1", "aria-live": "polite" } }),
    el(doc, "button", { class: "swd-cal-step", html: NEXT, title: "Next month", attrs: { "aria-label": "Next month" }, run: () => go(stepMonth(shown, 1), '.swd-cal-step[aria-label="Next month"]') }),
    el(doc, "button", { class: "swd-cal-today", text: "Today", title: "Show this month", run: () => go(monthOfDay(today()), ".swd-cal-today") }),
    el(doc, "span", { class: "swd-cal-by", text: `by ${spans.start.label}${spans.end ? ` → ${spans.end.label}` : ""}`, title: "What the days are of (Start and End in ⋯)" }),
  );
  const weeks = monthWeeks(shown, weekStart);
  const names = fmt({ weekday: "short" });
  const weekdays = el(doc, "div", { class: "swd-cal-weekdays", attrs: { "aria-hidden": "true" } }, ...weeks[0]!.map((day) => el(doc, "span", { text: names.format(utc(day)) })));
  const byKey = new Map(dated.map((item) => [item.key, item] as const));
  const rows = weeks.map((week) => {
    const segments = weekSegments(
      week,
      dated.map((item) => ({ key: item.key, start: spanOf.get(item)!.start, end: spanOf.get(item)!.end })),
    );
    const lanes = segments.reduce((most, one) => Math.max(most, one.lane + 1), 0);
    // (Opened: as many more as +N more was pressed for, all of them where one more would be shown rather than +1 more)
    const asked = lanes <= SHOWN_LANES + 1 ? lanes : (open.get(week[0]!) ?? SHOWN_LANES);
    const shownLanes = asked >= lanes - 1 ? lanes : asked;
    // (A week of one lane more than shown shows it all, opened by nothing: no Show fewer)
    const opening = lanes > SHOWN_LANES + 1 && shownLanes > SHOWN_LANES;
    const hiding = shownLanes < lanes;
    // The rows: the days' heads, the lanes shown, +N more and Show fewer where some are hidden or shown more, the room left
    const tail = (hiding ? 1 : 0) + (opening ? 1 : 0);
    const row = el(doc, "div", { class: "swd-cal-week", attrs: { "data-week": week[0]! } });
    // (No lane: the heads and the room alone; a repeat of none is no template at all)
    row.style.gridTemplateRows = `var(--swd-cal-head, 28px)${shownLanes + tail > 0 ? ` repeat(${shownLanes + tail}, auto)` : ""} 1fr`;
    week.forEach((day, at) => {
      const count = segments.filter((one) => one.from <= at && one.to >= at).length;
      const weekend = [0, 6].includes(utc(day).getUTCDay());
      const cell = el(
        doc,
        "div",
        {
          class: `swd-cal-day${inMonth(day, shown) ? "" : " swd-cal-other"}${day === now ? " swd-cal-now" : ""}${weekend ? " swd-cal-weekend" : ""}${day === chosen ? " swd-cal-picked" : ""}`,
          attrs: { role: "listitem", "data-day": day, "aria-label": `${longDay.format(utc(day))}${count ? `, ${count} ${count === 1 ? "item" : "items"}` : ""}` },
        },
        el(
          doc,
          "div",
          "swd-cal-day-head",
          el(doc, "span", { class: "swd-cal-date", text: String(Number(day.slice(8))) }),
          ...(spans.movable ? [el(doc, "button", { class: "swd-cal-add", text: "+", title: `Add an item on ${longDay.format(utc(day))}`, attrs: { "aria-label": `Add an item on ${longDay.format(utc(day))}` }, run: () => add(day) })] : []),
        ),
      );
      cell.style.gridColumn = String(at + 1);
      // (Pressed beside its items and buttons: the day picked, its items listed under the month)
      cell.addEventListener("click", (event) => {
        if ((event.target as Element).closest("button, [role='button']")) return;
        // (A day of another month: its month, where the picked day's list shows, a narrow place; a wide one picks it only)
        if (!inMonth(day, shown) && element.clientWidth <= NARROW) months.set(key, monthOfDay(day));
        pick(day);
      });
      row.append(cell);
    });
    for (const segment of segments) {
      if (segment.lane >= shownLanes) continue;
      const bar = entry(byKey.get(segment.key)!, { starts: segment.starts, ends: segment.ends, from: week[segment.from]!, days: segment.to - segment.from + 1 });
      bar.style.gridColumn = `${segment.from + 1} / ${segment.to + 2}`;
      bar.style.gridRow = String(segment.lane + 2);
      row.append(bar);
    }
    // Under each day hiding some: +N more (the week opened by as many lanes more); opened, Show fewer over the whole week
    // (not under a day: its own row, where a day of +N more may leave no room)
    if (hiding)
      week.forEach((_, at) => {
        const hidden = segments.filter((one) => one.lane >= shownLanes && one.from <= at && one.to >= at).length;
        if (!hidden) return;
        const more = el(doc, "button", { class: "swd-cal-more", text: `+${hidden} more`, title: "Show more of this week's items", run: () => (open.set(week[0]!, shownLanes + (shownLanes === SHOWN_LANES ? MORE_LANES - SHOWN_LANES : MORE_LANES)), redraw()) });
        more.style.gridColumn = String(at + 1);
        more.style.gridRow = String(shownLanes + 2);
        row.append(more);
      });
    if (opening) {
      const fewer = el(doc, "button", { class: "swd-cal-more swd-cal-fewer", text: "Show fewer", run: () => (open.delete(week[0]!), redraw()) });
      fewer.style.gridColumn = "1 / -1";
      fewer.style.gridRow = String(shownLanes + 2 + (hiding ? 1 : 0));
      row.append(fewer);
    }
    // (A drop on a day of the week: on its cell, or on a bar over it: the day under the pointer)
    dropOn(row, (event) => {
      const cell = (event.target as Element).closest<HTMLElement>(".swd-cal-day");
      if (cell?.dataset.day) return cell.dataset.day;
      const rect = row.getBoundingClientRect();
      if (rect.width <= 0) return undefined;
      return week[Math.min(6, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * 7)))];
    });
    return row;
  });
  const grid = el(doc, "div", { class: "swd-cal-grid", attrs: { role: "list", "aria-label": title } }, ...rows);
  // A list's first items (LISTED, more as asked), a button after them showing more, the first of those focused once shown
  const limited = (list: string, within: string, items: readonly Item[], entryOf: (item: Item) => HTMLElement): HTMLElement[] => {
    const count = listed.get(list) ?? LISTED;
    const left = items.length - count;
    if (left <= 0) return items.map(entryOf);
    const more = el(doc, "button", {
      class: "swd-cal-more swd-cal-list-more",
      text: `Show ${Math.min(LISTED, left)} more (${left} left)`,
      run: () => {
        listed.set(list, count + LISTED);
        redraw();
        element.querySelector<HTMLElement>(`${within} [data-item="${CSS.escape(items[count]!.key)}"]`)?.focus({ preventScroll: true });
      },
    });
    return [...items.slice(0, count).map(entryOf), more];
  };
  // The items without a start, over the month (folded by their label): dragged onto a day to give them one
  const folded = undatedFolded.has(key);
  const tray = el(
    doc,
    "div",
    { class: `swd-cal-undated${folded ? " swd-folded" : ""}`, attrs: { "aria-label": `Without ${spans.start.label}` } },
    el(
      doc,
      "button",
      {
        class: "swd-cal-undated-label",
        title: folded ? "Show them" : "Fold them",
        attrs: { "aria-expanded": String(!folded) },
        run: () => {
          if (folded) undatedFolded.delete(key);
          else undatedFolded.add(key);
          redraw();
        },
      },
      `No ${spans.start.label} · ${undated.length}`,
    ),
    ...(folded ? [] : [el(doc, "div", "swd-cal-undated-items", ...limited(`${key}\u0000undated`, ".swd-cal-undated-items", undated, (item) => entry(item)))]),
  );
  // The day picked: its items whole (those lasting over it too, their days said), its + (where the place is narrow, how they are reached)
  const onChosen = dated.filter((item) => spanOf.get(item)!.start <= chosen && spanOf.get(item)!.end >= chosen);
  const agenda = el(
    doc,
    "div",
    { class: "swd-cal-agenda", attrs: { "aria-label": longDay.format(utc(chosen)) } },
    el(
      doc,
      "div",
      "swd-cal-agenda-head",
      el(doc, "span", { class: "swd-cal-agenda-day", text: longDay.format(utc(chosen)) }),
      ...(spans.movable ? [el(doc, "button", { class: "swd-cal-agenda-add", text: "+ New", title: `Add an item on ${longDay.format(utc(chosen))}`, run: () => add(chosen) })] : []),
    ),
    ...(onChosen.length
      ? limited(`${key}\u0000${chosen}`, ".swd-cal-agenda", onChosen, (item) => {
          const span = spanOf.get(item)!;
          const box = entry(item);
          if (span.start !== span.end) box.querySelector(".swd-cal-text")?.append(el(doc, "span", { class: "swd-cal-days", text: ` ${shortDay.format(utc(span.start))} – ${shortDay.format(utc(span.end))}` }));
          return box;
        })
      : [el(doc, "p", { class: "swd-cal-agenda-none", text: "Nothing on this day" })]),
  );
  // (Dropped on the picked day's list: an item without a start given that day; one lasting over it already moved by nothing)
  dropOn(agenda, () => chosen);
  agenda.addEventListener(
    "drop",
    (event) => {
      const item = drag.item;
      const span = item && spanOf.get(item);
      if (span && span.start <= chosen && span.end >= chosen) {
        event.stopImmediatePropagation();
        drag.item = undefined;
        for (const over of element.querySelectorAll(".swd-drop")) over.classList.remove("swd-drop");
      }
    },
    { capture: true },
  );
  element.replaceChildren(el(doc, "div", "swd-cal", head, ...(undated.length ? [tray] : []), el(doc, "div", "swd-cal-box", weekdays, grid), agenda));
}

export const CALENDAR_VIEW: ViewDefinition = {
  name: "calendar",
  label: "Calendar",
  icon: ICON,
  settings: [{ key: "weekStart", label: "Week starts on", hint: "The first day of a calendar's weeks", control: "choice", choices: ["Monday", "Sunday"], default: "Monday" }],
  // (Its days are its layout: never grouped)
  groupBy: false,
  // (Its Start and End by a property's key: followed as the key changes)
  propertyMeta: SPAN_META,
  menu: (host, menu) => spanMenu(host, menu, ICON),
  render(host, element) {
    const drag: Drag = {};
    draw(host, element, drag);
    return { update: () => draw(host, element, drag) };
  },
};
