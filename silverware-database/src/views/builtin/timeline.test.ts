// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseCore } from "../../core/core.ts";
import { DatabasePlace, VIEW_KEY } from "../../core/place.ts";
import { ViewRegistry } from "../../core/views.ts";
import { TypeRegistry } from "../../domain/types/registry.ts";
import type { Database, Value } from "../../model/database.ts";
import { MemoryStore } from "../../store/memory.ts";
import { MemoryViewState } from "../../store/viewstate.ts";
import { BUILT_IN_VIEWS } from "./index.ts";

const TASKS: Database = {
  id: "tl",
  name: "Tasks",
  properties: [
    { key: "start", label: "Start", type: "datetime", params: {}, readonly: false },
    { key: "end", label: "End", type: "date", params: {}, readonly: false },
    { key: "phase", label: "Phase", type: "select", params: { options: ["Design", "Build"] }, readonly: false },
  ],
};

// (A database of its own each test: the timeline keeps where it was scrolled for the session by database)
let made = 0;
async function setup(items: readonly { name: string; start?: Value; end?: Value; phase?: Value }[], state: Record<string, unknown> = { "timeline.endBy": "end" }) {
  const database = { ...TASKS, id: `tl${++made}` };
  const values = (one: { start?: Value; end?: Value; phase?: Value }) => Object.fromEntries(Object.entries({ start: one.start, end: one.end, phase: one.phase }).filter(([, value]) => value !== undefined)) as Record<string, Value>;
  const store = new MemoryStore([{ database, items: items.map((one, at) => ({ name: one.name, values: values(one), rank: `a${at}` })) }]);
  const types = new TypeRegistry();
  const core = new DatabaseCore(store, types, { notify: () => {}, ask: () => true });
  const element = document.createElement("div");
  document.body.append(element);
  const opened: string[] = [];
  const told: string[] = [];
  const place = new DatabasePlace({ element, database: database.id, state: new MemoryViewState({ [VIEW_KEY]: "timeline", ...state }), store, core, types, views: new ViewRegistry(BUILT_IN_VIEWS), settings: { get: (_path, fallback) => fallback }, ui: { notify: (message) => void told.push(message) }, openItem: (item) => (opened.push(item.name), true) });
  await place.render();
  const all = <T extends Element = HTMLElement>(selector: string) => [...element.querySelectorAll<T>(selector)];
  const bar = (name: string) => all(".swd-tl-bar").find((one) => one.textContent?.endsWith(name))!;
  const track = (name: string) => all(".swd-tl-row").find((one) => one.querySelector(".swd-tl-name-text")!.textContent === name)!.querySelector<HTMLElement>(".swd-tl-track")!;
  const stored = async () => Object.fromEntries((await store.items(database.id)).value.map((one) => [one.name, [one.values.start, one.values.end]]));
  // A drag of the pointer from x to x (jsdom lays nothing out: what counts is how far it went)
  const drag = (target: Element, from: number, to: number, then: "up" | "escape" = "up") => {
    const pointer = (type: string, x: number, on: EventTarget) => on.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 }));
    // (The bar takes the pointer's events once pressed: captured)
    const bar = target.closest(".swd-tl-bar")!;
    pointer("pointerdown", from, target);
    pointer("pointermove", to, bar);
    if (then === "escape") document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    else pointer("pointerup", to, bar);
  };
  const changeOutside = async (name: string, values: Record<string, Value>) => {
    const item = (await store.items(database.id)).value.find((one) => one.name === name)!;
    store.changeOutside(database.id, item.key, { values });
    await settle();
  };
  return { element, all, bar, track, stored, opened, told, drag, changeOutside, core, place, database, store };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 8, 9, 0));
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.body.replaceChildren();
});

describe("the timeline", () => {
  it("shows a row an item, its bar from its start to its end on an axis of days (40px each), today marked", async () => {
    const { all, bar, element } = await setup([{ name: "Plan", start: "2026-11-03", end: "2026-11-05" }, { name: "Sync", start: "2026-11-10T10:00" }, { name: "Someday" }]);
    expect(all(".swd-tl-name-text").map((one) => one.textContent)).toEqual(["Plan", "Sync", "Someday"]);
    expect([bar("Plan").style.width, bar("Sync").style.width, bar("Sync").textContent]).toEqual(["120px", "40px", "10:00 Sync"]);
    expect(Number.parseFloat(bar("Sync").style.left) - Number.parseFloat(bar("Plan").style.left)).toBe(7 * 40);
    expect(element.querySelector(".swd-tl-now")!.textContent).toBe("8");
    expect(element.querySelector(".swd-tl-by")!.textContent).toBe("by Start → End");
    // (The axis from a Monday a margin before the first day)
    expect(all(".swd-tl-unit")[0]!.title).toMatch(/^Monday/);
  });

  it("moves a bar dragged, a day at a time, its length kept, in one write; its ends' handles change its start or its end", async () => {
    const { bar, drag, stored } = await setup([{ name: "Plan", start: "2026-11-03T09:00", end: "2026-11-05" }]);
    drag(bar("Plan"), 100, 100 + 2 * 40 + 10);
    await settle();
    expect((await stored()).Plan).toEqual(["2026-11-05T09:00", "2026-11-07"]);
    drag(bar("Plan").querySelector(".swd-tl-handle-end")!, 0, 3 * 40);
    await settle();
    expect((await stored()).Plan).toEqual(["2026-11-05T09:00", "2026-11-10"]);
    drag(bar("Plan").querySelector(".swd-tl-handle-start")!, 0, -40);
    await settle();
    expect((await stored()).Plan).toEqual(["2026-11-04T09:00", "2026-11-10"]);
  });

  it("opens a bar pressed without moving; Esc puts a drag back, nothing written", async () => {
    const { bar, drag, stored, opened } = await setup([{ name: "Plan", start: "2026-11-03", end: "2026-11-05" }]);
    drag(bar("Plan"), 100, 101);
    expect(opened).toEqual(["Plan"]);
    const left = bar("Plan").style.left;
    drag(bar("Plan"), 100, 300, "escape");
    await settle();
    expect([bar("Plan").style.left, (await stored()).Plan]).toEqual([left, ["2026-11-03", "2026-11-05"]]);
  });

  it("takes a bar under a finger only once held still: moved before, it is the timeline's scroll; a tap opens it", async () => {
    const { bar, stored, opened } = await setup([{ name: "Plan", start: "2026-11-03", end: "2026-11-05" }]);
    const touch = (type: string, x: number, on: EventTarget = bar("Plan")) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 });
      Object.defineProperty(event, "pointerType", { value: "touch" });
      on.dispatchEvent(event);
    };
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    // Moved at once: no drag, nothing written, nothing opened
    touch("pointerdown", 100);
    touch("pointermove", 180);
    await wait(450);
    touch("pointerup", 180);
    await settle();
    expect([(await stored()).Plan, opened]).toEqual([["2026-11-03", "2026-11-05"], []]);
    // A tap: opened
    touch("pointerdown", 100);
    touch("pointerup", 100);
    expect(opened).toEqual(["Plan"]);
    // Held and let go without moving: put back, nothing opened
    touch("pointerdown", 100);
    await wait(450);
    touch("pointerup", 100);
    await settle();
    expect([(await stored()).Plan, opened, bar("Plan").classList.contains("swd-tl-dragging")]).toEqual([["2026-11-03", "2026-11-05"], ["Plan"], false]);
    // Held, then moved two days: written so
    touch("pointerdown", 100);
    await wait(450);
    touch("pointermove", 100 + 2 * 40);
    touch("pointerup", 100 + 2 * 40);
    await settle();
    expect((await stored()).Plan).toEqual(["2026-11-05", "2026-11-07"]);
  });

  it("refuses an end dragged before the start, said why", async () => {
    const { bar, drag, stored, told } = await setup([{ name: "Plan", start: "2026-11-03", end: "2026-11-05" }]);
    drag(bar("Plan").querySelector(".swd-tl-handle-end")!, 0, -4 * 40);
    await settle();
    expect((await stored()).Plan).toEqual(["2026-11-03", "2026-11-05"]);
    expect(told).toEqual(["Plan would end before it starts"]);
  });

  it("moves a bar by Alt+arrows, its end by Alt+Shift+arrows", async () => {
    const { bar, stored } = await setup([{ name: "Plan", start: "2026-11-03", end: "2026-11-05" }]);
    bar("Plan").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }));
    await settle();
    expect((await stored()).Plan).toEqual(["2026-11-04", "2026-11-06"]);
    bar("Plan").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, shiftKey: true, bubbles: true }));
    await settle();
    expect((await stored()).Plan).toEqual(["2026-11-04", "2026-11-05"]);
  });

  it("gives an item without a start the day pressed in its row; one whose start reads as no day is left alone", async () => {
    const { track, stored, all } = await setup([{ name: "Someday" }, { name: "Odd", start: "soon" }]);
    const row = track("Someday");
    row.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) });
    // (The axis from Monday 2026-10-19: today and a margin of 14 days before it, back to a Monday)
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 2 * 40 + 5 }));
    await settle();
    expect((await stored()).Someday).toEqual(["2026-10-21", undefined]);
    expect(track("Odd").classList.contains("swd-tl-empty")).toBe(false);
    // (Each row without a bar saying why)
    expect([track("Odd").querySelector(".swd-tl-hint")!.textContent, all(".swd-tl-empty .swd-tl-hint").length]).toEqual(['Odd · Start "soon" is no day', 0]);
    expect(all(".swd-tl-name.swd-invalid .swd-tl-name-text").map((one) => one.textContent)).toEqual(["Odd"]);
  });

  it("writes a drag from the item as it is when let go, the drawing put off until then (an end changed meanwhile kept)", async () => {
    const { bar, element, stored, changeOutside } = await setup([{ name: "Plan", start: "2026-11-03", end: "2026-11-05" }]);
    const pressed = bar("Plan");
    const pointer = (type: string, x: number) => pressed.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, button: 0 }));
    pointer("pointerdown", 100);
    pointer("pointermove", 140);
    // (Its end changed elsewhere while it is dragged: the place told, not drawn anew under the drag)
    await changeOutside("Plan", { end: "2026-11-09" });
    expect(pressed.isConnected).toBe(true);
    pointer("pointerup", 140);
    await settle();
    expect((await stored()).Plan).toEqual(["2026-11-04", "2026-11-10"]);
    expect(element.querySelector(".swd-tl-dragging")).toBeNull();
  });

  it("keeps the axis within five years of today: a date with a wrong year at its edge, marked", async () => {
    const { all, bar } = await setup([{ name: "Typo", start: "1026-11-03" }, { name: "Plan", start: "2026-11-03" }]);
    expect(all(".swd-tl-unit").length).toBeLessThan(2000);
    expect(bar("Typo").classList.contains("swd-tl-beyond")).toBe(true);
    expect(bar("Plan").classList.contains("swd-tl-beyond")).toBe(false);
  });

  it("draws its groups itself on one axis: a group's head over its items' rows, folded by its head", async () => {
    const { all, bar, element } = await setup(
      [
        { name: "Sketch", start: "2026-11-03", end: "2026-11-05", phase: "Design" },
        { name: "Code", start: "2026-11-10", end: "2026-11-12", phase: "Build" },
        { name: "Review", start: "2026-11-06", phase: "Design" },
      ],
      { "timeline.endBy": "end", "timeline.groupBy": "phase" },
    );
    // One timeline, its rows in its groups' order (the select's options), each group's head before them
    expect(all(".swd-tl").length).toBe(1);
    const rows = () => all(".swd-tl-row").map((one) => (one.classList.contains("swd-tl-group") ? `# ${one.querySelector(".swd-group-label")!.textContent}` : one.querySelector(".swd-tl-name-text")!.textContent));
    expect(rows()).toEqual(["# Design", "Sketch", "Review", "# Build", "Code"]);
    expect(element.querySelector(".swd-tl-corner")!.textContent).toBe("3 items");
    // (Placed on the one axis as ungrouped)
    expect(Number.parseFloat(bar("Code").style.left) - Number.parseFloat(bar("Sketch").style.left)).toBe(7 * 40);
    element.querySelector<HTMLButtonElement>('.swd-tl-group[data-group] .swd-group-head')!.click();
    await settle();
    expect(rows()).toEqual(["# Design", "# Build", "Code"]);
    expect(document.activeElement?.classList.contains("swd-group-head")).toBe(true);
  });

  it("folds its names' column to a strip by the corner's button, kept by the browser for the database", async () => {
    const { element } = await setup([{ name: "Plan", start: "2026-11-03" }, { name: "Someday" }]);
    const timeline = () => element.querySelector(".swd-tl")!;
    expect(timeline().classList.contains("swd-tl-folded")).toBe(false);
    element.querySelector<HTMLButtonElement>(".swd-tl-fold")!.click();
    expect([timeline().classList.contains("swd-tl-folded"), element.querySelector(".swd-tl-fold")!.getAttribute("aria-expanded")]).toEqual([true, "false"]);
    // (A row without a bar names its item in what it says, shown so where the names are folded)
    expect(element.querySelector(".swd-tl-empty .swd-tl-hint")!.textContent).toBe("Someday · No Start: press a day");
    // Kept: drawn anew, still folded
    expect(Object.keys(localStorage).some((key) => key.startsWith("silverware.database.timelineNames.") && localStorage.getItem(key) === "folded")).toBe(true);
    element.querySelector<HTMLButtonElement>(".swd-tl-scale:nth-child(2)")!.click();
    await settle();
    expect(timeline().classList.contains("swd-tl-folded")).toBe(true);
  });

  it("colors its bars by a property of options (Color by in ⋯), an item's own color first, its head saying so", async () => {
    const { bar, element, core, place, database, store } = await setup(
      [
        { name: "Sketch", start: "2026-11-03", phase: "Design" },
        { name: "Code", start: "2026-11-10", phase: "Build" },
        { name: "Plain", start: "2026-11-12" },
      ],
      { "timeline.endBy": "end", "timeline.colorBy": "phase" },
    );
    // (Design the options' first, gray; Build the second, blue; none: no color)
    expect([bar("Sketch").dataset.swdItemColor, bar("Code").dataset.swdItemColor, bar("Plain").dataset.swdItemColor]).toEqual(["0", "1", undefined]);
    expect(element.querySelector(".swd-place-colored")!.textContent).toBe("colored by Phase");
    // An item's own color first
    const code = (await store.items(database.id)).value.find((one) => one.name === "Code")!;
    await core.setLook(database.id, code, { color: "red" });
    await place.refresh();
    expect(bar("Code").dataset.swdItemColor).toBe("5");
  });

  it("draws a day at Weeks 14px, at Months 4px, kept in the view", async () => {
    const { element, bar } = await setup([{ name: "Plan", start: "2026-11-03", end: "2026-11-05" }]);
    element.querySelector<HTMLButtonElement>('.swd-tl-scale:nth-child(2)')!.click();
    await settle();
    expect(bar("Plan").style.width).toBe(`${3 * 14}px`);
    element.querySelector<HTMLButtonElement>('.swd-tl-scale:nth-child(3)')!.click();
    await settle();
    expect(bar("Plan").style.width).toBe(`${3 * 4}px`);
    expect(element.querySelector('.swd-tl-scale[aria-pressed="true"]')!.textContent).toBe("Months");
  });
});
