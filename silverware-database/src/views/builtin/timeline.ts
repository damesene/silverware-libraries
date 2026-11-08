// The timeline: a row an item, in the order the view lists them, its bar from
// its start to its end (views/spans.ts: Start and End in ⋯, as the
// calendar's) on an axis of days, Days, Weeks or Months wide. A bar is moved by
// a drag of its body (a mouse's or a finger's: pointer events, so a phone too),
// its start or end by its ends' handles, a day at a time as it goes, written
// as it is let go (Esc puts it back), in one write; Alt+← → move it from the
// keys, Alt+Shift+← → its end. A press on a bar without moving opens it. An
// item without a start has its row empty: a press in it gives it that day.
// The axis spans the items and today, a margin either side; Today scrolls it
// there. The names stay in view as it scrolls sideways (sticky). Grouped (Group
// by in ⋯, as any view), it draws its groups itself on one axis: a group's
// head (views/groups.ts, folded as anywhere) over its items' rows.
import { el } from "../../../../shared/elements.ts";
import type { ViewDefinition, ViewHost } from "../../core/view.ts";
import { addDays, type Day, daysBetween, monthOfDay, today, weekday } from "../../domain/calendar.ts";
import type { ItemGroup } from "../../domain/grouping.ts";
import type { Item } from "../../model/database.ts";
import { foldedOf, groupHead, setFolded } from "../groups.ts";
import { edgeScroll } from "../edgescroll.ts";
import { svg } from "../icons.ts";
import { type ItemSpan, SPAN_META, type SpanChange, spanMenu, viewSpans } from "../spans.ts";

const CHEVRON_LEFT = svg('<path d="m10 4-4 4 4 4"/>');
const CHEVRON_RIGHT = svg('<path d="m6 4 4 4-4 4"/>');
const ICON = svg('<path d="M2.5 4h6M5 8h8M3.5 12h5"/><path d="M2.5 2v12" stroke-width="1"/>');

// How wide a day is at each scale, and the days the axis goes on past the items (and today) either side
const SCALES = {
  days: { width: 40, margin: 14, label: "Days" },
  weeks: { width: 14, margin: 35, label: "Weeks" },
  months: { width: 4, margin: 90, label: "Months" },
} as const;
type Scale = keyof typeof SCALES;

// The view's meta key of its scale (written: a choice kept, made seldom)
const SCALE_KEY = "scale";

// A move of the pointer under this many pixels is a press, not a drag
const PRESS_PX = 4;

// A finger held this long on a bar, still (moved less than HOLD_PX), takes it: before, a move of it scrolls the timeline,
// as a board's card is taken only once held
const HOLD_MS = 400;
const HOLD_PX = 8;

// Dates as the rest of the plugin's words: English
const LOCALE = "en-US";

// How far the axis goes from today at most, in days (a date typed with a wrong year, 1026, would make it hundreds of
// thousands of days wide): a bar past it is drawn at its edge, marked
const REACH = 5 * 366;

// A bar narrower than this has no handles (they would cover it, nothing left to move it by): its end changed from the keys
const HANDLES_MIN = 30;

// The names' column folded to a strip or shown, kept per browser by database (how much room a screen has, not the
// database's: a laptop's open, a phone's folded, the page not written for it; two timelines of one database share it, the
// other following as it is drawn anew); none kept: folded where the place is narrow (the style page's 600px, as there)
const NAMES_KEY = "silverware.database.timelineNames.";
const NARROW = 600;

function namesKept(win: Window | null, id: string): "folded" | "shown" | undefined {
  try {
    const kept = win?.localStorage.getItem(NAMES_KEY + id);
    return kept === "folded" || kept === "shown" ? kept : undefined;
  } catch {
    return undefined;
  }
}

function keepNames(win: Window | null, id: string, how: "folded" | "shown"): void {
  try {
    win?.localStorage.setItem(NAMES_KEY + id, how);
  } catch {
    // (No storage: a private window; folded or shown for this drawing alone)
  }
}

// The day in the middle of each database's timeline as last scrolled (by the day, not the pixel: the axis' first day
// and a day's width change with the items and the scale), this session; none: today, a third in
const middles = new Map<string, number>();

// What a timeline keeps between its drawings: a drag going on (a drawing put off until it ends), the bar to focus again
// (The bar to focus again by its item and its group: an item of several groups is drawn in each)
type Live = { dragging: boolean; pending: boolean; refocus?: { readonly item: string; readonly group: string | undefined } };

function draw(host: ViewHost, element: HTMLElement, live: Live): void {
  const doc = host.document;
  const spans = viewSpans(host);
  if (!spans) {
    element.replaceChildren(el(doc, "p", { class: "swd-place-note", text: "No property of dates: add one (a date, a date and time) in Properties" }));
    return;
  }
  const named = host.getMeta(SCALE_KEY);
  const scale: Scale = named === "weeks" || named === "months" ? named : "days";
  const { width: dayWidth, margin } = SCALES[scale];
  const now = today();
  // The items drawn: grouped, those of the groups shown (a group hidden is no part of the axis nor the count; one folded is,
  // so folding moves nothing), each once; by the item's key, as an item in several groups is drawn in each
  const grouping = host.grouping;
  const drawn = grouping ? [...new Map(grouping.groups.flatMap((group) => group.items.map((item) => [item.key, item] as const))).values()] : host.items;
  const spanOf = new Map(drawn.map((item) => [item.key, spans.spanOf(item)] as const));
  // The axis: the items' days and today (within its reach), a margin either side, from a week's first day (a month's at Months)
  const days = [now, ...[...spanOf.values()].flatMap((span) => (span ? [span.start, span.end] : []))].sort();
  const within = (day: Day) => (day < addDays(now, -REACH) ? addDays(now, -REACH) : day > addDays(now, REACH) ? addDays(now, REACH) : day);
  let first = addDays(within(days[0]!), -margin);
  first = scale === "months" ? `${first.slice(0, 8)}01` : addDays(first, -((weekday(first) + 6) % 7));
  const last = addDays(within(days.at(-1)!), margin);
  const count = daysBetween(first, last) + 1;
  const x = (day: Day) => daysBetween(first, day) * dayWidth;
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" });
  const utc = (day: Day) => new Date(`${day}T00:00:00Z`);
  const shortDay = fmt({ day: "numeric", month: "short" });
  const lasting = (span: ItemSpan) => [span.start === span.end ? shortDay.format(utc(span.start)) : `${shortDay.format(utc(span.start))} – ${shortDay.format(utc(span.end))}`, span.time?.slice(0, 5) ?? "", span.problem ?? ""].filter(Boolean).join(", ");
  // A change written, or why not said; whether it was written
  const change = (item: Item, made: SpanChange) => {
    if ("problem" in made) {
      host.notify(made.problem);
      return false;
    }
    void host.move(item, { values: made.values });
    return true;
  };
  // An item as it is now (drawn anew meanwhile, its values may have changed), with its span so; none where it is gone or has none
  const current = (item: Item) => {
    const one = host.items.find((other) => other.key === item.key);
    const span = one && spans.spanOf(one);
    return one && span ? { item: one, span } : undefined;
  };

  // The axis' heads: the months over the days (Days: each day's number; Weeks: each week's first day; Months: the months alone)
  const months: HTMLElement[] = [];
  for (let at = first; at <= last; ) {
    const month = monthOfDay(at);
    const next = `${month.month === 11 ? month.year + 1 : month.year}-${String(month.month === 11 ? 1 : month.month + 2).padStart(2, "0")}-01`;
    const until = next <= last ? next : addDays(last, 1);
    const head = el(doc, "div", "swd-tl-month", el(doc, "span", { text: fmt({ month: scale === "months" ? "short" : "long", year: "numeric" }).format(utc(at)) }));
    head.style.left = `${x(at)}px`;
    head.style.width = `${daysBetween(at, until) * dayWidth}px`;
    months.push(head);
    at = until;
  }
  const units: HTMLElement[] = [];
  if (scale !== "months")
    for (let at = 0; at < count; at++) {
      const day = addDays(first, at);
      const weekend = weekday(day) === 0 || weekday(day) === 6;
      if (scale === "days") {
        const unit = el(doc, "div", { class: `swd-tl-unit${weekend ? " swd-tl-weekend" : ""}${day === now ? " swd-tl-now" : ""}`, text: String(Number(day.slice(8))), title: fmt({ weekday: "long", day: "numeric", month: "long" }).format(utc(day)) });
        unit.style.left = `${x(day)}px`;
        unit.style.width = `${dayWidth}px`;
        units.push(unit);
      } else if (weekday(day) === 1) {
        const unit = el(doc, "div", { class: "swd-tl-unit", text: shortDay.format(utc(day)) });
        unit.style.left = `${x(day)}px`;
        unit.style.width = `${7 * dayWidth}px`;
        units.push(unit);
      }
    }
  const trackWidth = count * dayWidth;
  const axis = el(doc, "div", "swd-tl-axis", el(doc, "div", "swd-tl-months", ...months), ...(units.length ? [el(doc, "div", "swd-tl-units", ...units)] : []));
  axis.style.width = `${trackWidth}px`;

  // An item's row: its name (opening it), its track with its bar, or, without a start, a press there giving it that day
  const row = (item: Item, group?: string) => {
    const span = spanOf.get(item.key);
    const unread = spans.unread(item);
    // (Its name a text of its own: the names' column folded to a strip shows the icon alone, the name its title)
    // (Folded, an item without an icon shows its name's first three letters, a strip of nothing being no button to find)
    const icon = host.look.icon(item);
    const initial = icon ? undefined : el(doc, "span", { class: "swd-tl-name-initial", text: [...new Intl.Segmenter().segment(item.name.trim())].slice(0, 3).map((one) => one.segment).join(""), attrs: { "aria-hidden": "true" } });
    const name = el(doc, "button", { class: `swd-tl-name${unread ? " swd-invalid" : ""}`, title: `Open ${item.name}`, run: () => void host.open(item) }, icon, initial, el(doc, "span", { class: "swd-tl-name-text", text: item.name }));
    // (Its color by its name too, as a table's stripe: the strip folded shows it where its bar is out of view)
    host.look.item(item, name);
    // (What a row without a bar says names it too where the names are folded)
    const whose = () => el(doc, "span", { class: "swd-tl-hint-name", text: `${item.name} · ` });
    const track = el(doc, "div", "swd-tl-track");
    track.style.width = `${trackWidth}px`;
    if (span) track.append(bar(item, span, group));
    // (Its start alone written: an end not changed by hand is no matter here)
    else if (!spans.start.readonly && !unread) {
      // Said in the row, in view however it scrolls (an empty row read as a bar not drawn); the day a press gives shown
      // under the pointer, a bar of one day, dashed
      track.classList.add("swd-tl-empty");
      track.title = `Press a day to give ${item.name} its ${spans.start.label}`;
      const ghost = el(doc, "span", { class: "swd-tl-ghost", attrs: { "aria-hidden": "true" } });
      ghost.style.width = `${dayWidth}px`;
      track.append(el(doc, "span", "swd-tl-hint", whose(), `No ${spans.start.label}: press a day`), ghost);
      const dayAt = (event: MouseEvent) => Math.max(0, Math.floor((event.clientX - track.getBoundingClientRect().left) / dayWidth));
      track.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
        ghost.style.left = `${dayAt(event) * dayWidth}px`;
        ghost.hidden = false;
      });
      track.addEventListener("pointerleave", () => (ghost.hidden = true));
      ghost.hidden = true;
      track.addEventListener("click", (event) => {
        // (As it is now: given a start meanwhile, or one that reads as no day, nothing written)
        const one = host.items.find((other) => other.key === item.key);
        if (one && !spans.spanOf(one) && !spans.unread(one)) change(one, spans.withStart(one, addDays(first, dayAt(event))));
      });
    } else if (unread) {
      track.title = `Its ${spans.start.label} "${String(item.values[spans.start.key])}" reads as no day; open it to set one`;
      track.append(el(doc, "span", "swd-tl-hint swd-invalid", whose(), `${spans.start.label} "${String(item.values[spans.start.key])}" is no day`));
    }
    return el(doc, "div", { class: "swd-tl-row", attrs: { "data-item": item.key, ...(group === undefined ? {} : { "data-in-group": group }) } }, name, track);
  };

  // A bar: from its start to its end (past the axis' reach at its edge, marked); dragged (its body: moved; its ends'
  // handles: its start, its end), a day at a time
  const bar = (item: Item, span: ItemSpan, group: string | undefined) => {
    const movable = spans.movable;
    const resizable = spans.resizable && !spans.endUnread(item);
    const from = span.start < first ? first : span.start > last ? last : span.start;
    const to = span.end > last ? last : span.end < first ? first : span.end;
    const beyond = from !== span.start || to !== span.end;
    const left = x(from);
    const width = (daysBetween(from, to) + 1) * dayWidth;
    const handled = resizable && width >= HANDLES_MIN;
    const box = el(
      doc,
      "div",
      {
        class: `swd-tl-bar${span.problem ? " swd-invalid" : ""}${beyond ? " swd-tl-beyond" : ""}${movable ? " swd-tl-movable" : ""}`,
        title: `${item.name} (${lasting(span)}): open${movable ? ", drag to move it (Alt+← →)" : ""}${handled ? ", or its ends" : ""}${resizable ? " (Alt+Shift+← → its end)" : ""}`,
        attrs: { role: "button", tabindex: "0", "aria-label": `${item.name}, ${lasting(span)}`, "data-item": item.key },
      },
      el(doc, "span", "swd-tl-bar-text", host.look.icon(item), `${span.time ? `${span.time.slice(0, 5)} ` : ""}${item.name}`),
    );
    host.look.item(item, box);
    box.style.left = `${left}px`;
    box.style.width = `${width}px`;
    if (handled) box.append(...(["start", "end"] as const).map((which) => el(doc, "span", { class: `swd-tl-handle swd-tl-handle-${which}`, attrs: { "aria-hidden": "true", "data-handle": which } })));
    // A drag: what of it (it whole, its start, its end), from where, by how many days so far; drawn as it goes, written as
    // it ends, from the item as it is then; the pointer captured by the bar (a release outside the window still ends it)
    box.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || live.dragging) return;
      const what = ((event.target as Element).closest<HTMLElement>("[data-handle]")?.dataset.handle ?? "move") as "move" | "start" | "end";
      if (what === "move" && !movable) return;
      touched = event.pointerType === "touch";
      if (touched) return hold(event, what);
      event.preventDefault();
      take(event, what);
    });
    // (A long press's own menu, the system's, never over a bar under a finger; a mouse's right click keeps the browser's)
    let touched = false;
    box.addEventListener("contextmenu", (event) => touched && event.preventDefault());
    // A finger held on it: its moves the drag's, not a scroll of the timeline or the page. Listened for as the bar is drawn,
    // not once held: the browser tells at a touch's start whether its moves may be kept from scrolling
    let held = false;
    box.addEventListener("touchmove", (event) => held && event.cancelable && event.preventDefault(), { passive: false });
    // A finger: the bar taken once held still a moment, a tap opening it; moved before, it is the timeline's scroll
    const hold = (event: PointerEvent, what: "move" | "start" | "end") => {
      const view = doc.defaultView;
      const stop = () => {
        view?.clearTimeout(timer);
        box.removeEventListener("pointermove", moved);
        box.removeEventListener("pointerup", up);
        box.removeEventListener("pointercancel", stop);
      };
      const moved = (m: PointerEvent) => {
        if (m.pointerId === event.pointerId && Math.hypot(m.clientX - event.clientX, m.clientY - event.clientY) > HOLD_PX) stop();
      };
      const up = (u: PointerEvent) => {
        if (u.pointerId !== event.pointerId) return;
        stop();
        void host.open(item);
      };
      const timer = view?.setTimeout(() => {
        stop();
        // (Drawn anew meanwhile: this bar is gone, the new one's to take)
        if (!box.isConnected) return;
        take(event, what, true);
      }, HOLD_MS);
      box.addEventListener("pointermove", moved);
      box.addEventListener("pointerup", up);
      box.addEventListener("pointercancel", stop);
    };
    // The drag itself, from `event` (a finger's once held: the page kept from scrolling under it meanwhile)
    const take = (event: PointerEvent, what: "move" | "start" | "end", byFinger = false) => {
      const start = event.clientX;
      let by = 0;
      let moved = false;
      let ended = false;
      live.dragging = true;
      // Near the timeline's left or right edge (right of the names) it scrolls as a board's card dragged does, the days the
      // drag went those it scrolled too
      const startScroll = scrollBox.scrollLeft;
      let x = start;
      const follow = () => {
        by = Math.round((x - start + scrollBox.scrollLeft - startScroll) / dayWidth);
        show();
      };
      const scroll = edgeScroll(scrollBox, { inset: () => ({ left: names, right: 0 }), scrolled: () => moved && !ended && follow() });
      const show = () => {
        const shift = by * dayWidth;
        if (what === "move") box.style.left = `${left + shift}px`;
        else if (what === "start") {
          box.style.left = `${Math.min(left + shift, left + width - dayWidth)}px`;
          box.style.width = `${Math.max(dayWidth, width - shift)}px`;
        } else box.style.width = `${Math.max(dayWidth, width + shift)}px`;
      };
      const move = (m: PointerEvent) => {
        if (m.pointerId !== event.pointerId) return;
        if (!moved && Math.abs(m.clientX - start) < PRESS_PX) return;
        moved = true;
        box.classList.add("swd-tl-dragging");
        x = m.clientX;
        follow();
        scroll.at(x);
      };
      const end = (cancel: boolean) => {
        if (ended) return;
        ended = true;
        scroll.stop();
        held = false;
        box.removeEventListener("pointermove", move);
        box.removeEventListener("pointerup", up);
        box.removeEventListener("pointercancel", cancelled);
        box.removeEventListener("lostpointercapture", lost);
        doc.removeEventListener("keydown", escape, true);
        if (box.hasPointerCapture?.(event.pointerId)) box.releasePointerCapture(event.pointerId);
        box.classList.remove("swd-tl-dragging");
        live.dragging = false;
        if (cancel || !moved || by === 0) {
          by = 0;
          show();
          // (A press opens it; a finger held and let go without moving puts it back)
          if (!cancel && !moved && !byFinger) void host.open(item);
        } else {
          const one = current(item);
          if (one) {
            if (what === "move") change(one.item, spans.moved(one.item, by));
            else if (what === "start") change(one.item, spans.withStart(one.item, addDays(one.span.start, by)));
            else change(one.item, spans.withEnd(one.item, addDays(one.span.end, by)));
          }
        }
        // (Drawn anew where that was put off meanwhile)
        if (live.pending) {
          live.pending = false;
          draw(host, element, live);
        }
      };
      const up = (u: PointerEvent) => u.pointerId === event.pointerId && end(false);
      const cancelled = (c: PointerEvent) => c.pointerId === event.pointerId && end(true);
      const lost = () => end(true);
      const escape = (k: KeyboardEvent) => {
        if (k.key !== "Escape") return;
        k.preventDefault();
        k.stopPropagation();
        end(true);
      };
      // (A finger held: shown taken, its moves kept from scrolling)
      if (byFinger) {
        held = true;
        box.classList.add("swd-tl-dragging");
      }
      // (A pointer that cannot be captured any more, let go meanwhile: the drag over as it began)
      try {
        box.setPointerCapture?.(event.pointerId);
      } catch {
        return end(true);
      }
      box.addEventListener("pointermove", move);
      box.addEventListener("pointerup", up);
      box.addEventListener("pointercancel", cancelled);
      box.addEventListener("lostpointercapture", lost);
      doc.addEventListener("keydown", escape, true);
    };
    // From the keys: Enter opens; Alt+← → move it a day; Alt+Shift+← → its end a day (from the item as it is now: keys
    // pressed faster than it is drawn anew each count)
    box.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        return void host.open(item);
      }
      if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      const one = current(item);
      if (!one) return;
      const written = event.shiftKey ? resizable && change(one.item, spans.withEnd(one.item, addDays(one.span.end, step))) : movable && change(one.item, spans.moved(one.item, step));
      if (written) live.refocus = { item: item.key, group };
    });
    return box;
  };

  // The head: Today, the scale, what the bars are of
  const scales = el(
    doc,
    "div",
    { class: "swd-tl-scales", attrs: { role: "group", "aria-label": "Scale" } },
    ...(Object.keys(SCALES) as Scale[]).map((one) =>
      el(doc, "button", { class: "swd-tl-scale", text: SCALES[one].label, attrs: { "aria-pressed": String(one === scale) }, run: () => void host.setMeta({ [SCALE_KEY]: one === "days" ? undefined : one }).then(() => host.refresh()) }),
    ),
  );
  // (Its scroll its own, kept by the day: the place keeps none of it, `data-own-scroll`)
  const scrollBox = el(doc, "div", { class: "swd-tl-box", attrs: { "data-own-scroll": "" } });
  // The names' column's width, measured once laid out (not on every scroll)
  let names = 0;
  const toToday = () => {
    scrollBox.scrollLeft = Math.max(0, x(now) - (scrollBox.clientWidth - names) / 3);
  };
  const id = host.database.id;
  let putting = true;
  const put = () => {
    const middle = middles.get(id);
    if (middle === undefined) return toToday();
    scrollBox.scrollLeft = Math.max(0, (middle - daysBetween(now, first)) * dayWidth - (scrollBox.clientWidth - names) / 2);
  };
  // (The day in the middle of the view, as the names leave it: kept as the user scrolls, and as the names are folded)
  const keepMiddle = () => middles.set(id, daysBetween(now, first) + (scrollBox.scrollLeft + (scrollBox.clientWidth - names) / 2) / dayWidth);
  scrollBox.addEventListener(
    "scroll",
    () => {
      if (!putting) keepMiddle();
    },
    { passive: true },
  );
  const head = el(
    doc,
    "div",
    "swd-tl-head",
    el(doc, "button", { class: "swd-tl-today", text: "Today", title: "Scroll to today", run: toToday }),
    scales,
    el(doc, "span", { class: "swd-tl-by", text: `by ${spans.start.label}${spans.end ? ` → ${spans.end.label}` : ""}`, title: "What the bars are of (Start and End in ⋯)" }),
  );
  // Grouped: each group's head (folding it) over its items' rows, on the one axis
  const folded = foldedOf(host);
  const fold = (key: string, open: boolean) =>
    setFolded(host, key, open).then(() => element.querySelector<HTMLElement>(`.swd-tl-group[data-group="${CSS.escape(key)}"] .swd-group-head`)?.focus({ preventScroll: true }));
  const groupRow = (group: ItemGroup) => {
    const open = !folded.has(group.key);
    const track = el(doc, "div", "swd-tl-track swd-tl-group-track");
    track.style.width = `${trackWidth}px`;
    return el(
      doc,
      "div",
      // (Its head the button reads: its value, how many, folded or not)
      { class: `swd-tl-row swd-tl-group${open ? "" : " swd-folded"}`, attrs: { "data-group": group.key } },
      el(doc, "div", "swd-tl-group-cell", groupHead(doc, group, open, () => void fold(group.key, open))),
      track,
    );
  };
  const lines = grouping
    ? grouping.groups.length
      ? grouping.groups.flatMap((group) => [groupRow(group), ...(folded.has(group.key) ? [] : group.items.map((item) => row(item, group.key)))])
      : [el(doc, "p", { class: "swd-tl-none", text: "Every group is hidden: show one under Group in ⋯" })]
    : host.items.map((item) => row(item));
  // Today's line, the weekends (Days) or the weeks' starts (Weeks) the rows' own background, under their bars: no layer
  // over the rows (one laid over them was drawn over the bars by the browser, and into the names as it scrolled), a week a
  // period from the axis' first day, a Monday; its scale by a class of its own (`swd-tl-months` is the axis' row of months)
  const rows = el(doc, "div", `swd-tl-rows swd-tl-by-${scale}`, ...lines);
  rows.style.setProperty("--swd-tl-day", `${dayWidth}px`);
  rows.style.setProperty("--swd-tl-now", `${x(now) + dayWidth / 2}px`);
  // The names' column folded to a strip or shown by the corner's button (the bars name their items; the strip their icons)
  const view = doc.defaultView;
  const timeline = el(doc, "div", "swd-tl", head, scrollBox);
  const foldButton = el(doc, "button", { class: "swd-tl-fold", run: () => foldNames(!timeline.classList.contains("swd-tl-folded"), true) });
  const foldNames = (on: boolean, remember = false) => {
    timeline.classList.toggle("swd-tl-folded", on);
    foldButton.innerHTML = on ? CHEVRON_RIGHT : CHEVRON_LEFT;
    // (Its name for a screen reader the same either way, its state said by aria-expanded)
    foldButton.title = on ? "Show the names" : "Fold the names to a strip";
    foldButton.setAttribute("aria-label", "Names");
    foldButton.setAttribute("aria-expanded", String(!on));
    if (remember) keepNames(view, host.database.id, on ? "folded" : "shown");
    // (The days in view stay: the axis' days left of the view are where they were, the names' width aside)
    names = corner.offsetWidth;
    // (Folded by the user: the view's middle as it is now, so the next drawing does not move it)
    if (remember && !putting) keepMiddle();
  };
  const corner = el(doc, "div", "swd-tl-corner", el(doc, "span", { class: "swd-tl-count", text: `${drawn.length} ${drawn.length === 1 ? "item" : "items"}` }), foldButton);
  scrollBox.append(el(doc, "div", "swd-tl-axis-row", corner, axis), rows);
  const kept = namesKept(view, host.database.id);
  foldNames(kept === "folded");
  element.replaceChildren(timeline);
  // Scrolled where it was once laid out (a block put in the page after it is drawn, maybe frames later); the scroll events
  // of that before the next frame, the user's after it
  const settle = () => {
    // (None kept: folded where the place is narrow, as a phone's)
    if (!kept && element.clientWidth > 0 && element.clientWidth <= NARROW) foldNames(true);
    names = corner.offsetWidth;
    put();
    view?.requestAnimationFrame(() => {
      put();
      view.requestAnimationFrame(() => (putting = false));
    });
  };
  if (scrollBox.clientWidth > 0 || !view?.ResizeObserver) settle();
  else {
    const watch = new view.ResizeObserver(() => {
      if (scrollBox.clientWidth === 0) return;
      watch.disconnect();
      settle();
    });
    watch.observe(scrollBox);
  }
  // A bar moved from the keys: focused again, drawn anew
  if (live.refocus) {
    const { item, group } = live.refocus;
    const within = group === undefined ? "" : `.swd-tl-row[data-in-group="${CSS.escape(group)}"] `;
    element.querySelector<HTMLElement>(`${within}.swd-tl-bar[data-item="${CSS.escape(item)}"]`)?.focus({ preventScroll: true });
  }
  live.refocus = undefined;
}

export const TIMELINE_VIEW: ViewDefinition = {
  name: "timeline",
  label: "Timeline",
  icon: ICON,
  // (Its groups drawn by itself, on one axis: a head over each group's rows)
  groupBy: { draws: true },
  // (Its Start and End by a property's key: followed as the key changes)
  propertyMeta: SPAN_META,
  // (No property beside an item's name: no Visible properties in its ⋯)
  properties: false,
  menu: (host, menu) => spanMenu(host, menu, ICON),
  render(host, element) {
    const live: Live = { dragging: false, pending: false };
    draw(host, element, live);
    // (Not under a drag: drawn once it ends)
    return { update: () => (live.dragging ? void (live.pending = true) : draw(host, element, live)) };
  },
};
