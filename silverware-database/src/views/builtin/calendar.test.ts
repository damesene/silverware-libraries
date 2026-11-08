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
  id: "cal",
  name: "Tasks",
  properties: [
    { key: "due", label: "Due", type: "datetime", params: {}, readonly: false },
    { key: "until", label: "Until", type: "date", params: {}, readonly: false },
    { key: "made", label: "Made", type: "date", params: {}, readonly: true },
  ],
};

// (A database of its own each test: the calendar keeps its month for the session by database)
let made = 0;
async function setup(items: readonly { name: string; due?: Value; until?: Value }[], state: Record<string, unknown> = {}) {
  const database = { ...TASKS, id: `cal${++made}` };
  const values = (one: { due?: Value; until?: Value }) => Object.fromEntries(Object.entries({ due: one.due, until: one.until }).filter(([, value]) => value !== undefined)) as Record<string, Value>;
  const store = new MemoryStore([{ database, items: items.map((one, at) => ({ name: one.name, values: values(one), rank: `a${at}` })) }]);
  const types = new TypeRegistry();
  const core = new DatabaseCore(store, types, { notify: () => {}, ask: () => true });
  const element = document.createElement("div");
  document.body.append(element);
  const opened: string[] = [];
  const told: string[] = [];
  const place = new DatabasePlace({ element, database: database.id, state: new MemoryViewState({ [VIEW_KEY]: "calendar", ...state }), store, core, types, views: new ViewRegistry(BUILT_IN_VIEWS), settings: { get: (_path, fallback) => fallback }, ui: { notify: (message) => void told.push(message) }, openItem: (item) => (opened.push(item.name), true) });
  await place.render();
  const all = <T extends Element = HTMLElement>(selector: string) => [...element.querySelectorAll<T>(selector)];
  const day = (at: string) => element.querySelector<HTMLElement>(`.swd-cal-day[data-day="${at}"]`)!;
  // A day's items: the bars of its week whose columns hold it
  const onDay = (at: string) => {
    const cell = day(at);
    const week = cell.closest<HTMLElement>(".swd-cal-week")!;
    const column = Number(cell.style.gridColumn);
    return [...week.querySelectorAll<HTMLElement>(".swd-cal-item")].filter((bar) => {
      const [from, to] = bar.style.gridColumn.split("/").map((one) => Number(one.trim()));
      return from! <= column && column < (to ?? from! + 1);
    });
  };
  const names = (at: string) => onDay(at).map((one) => one.textContent);
  const stored = async () => Object.fromEntries((await store.items(database.id)).value.map((one) => [one.name, [one.values.due, one.values.until]]));
  const drag = (from: Element, to: Element) => {
    from.dispatchEvent(new Event("dragstart", { bubbles: true }));
    to.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    to.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
  };
  return { element, all, day, onDay, names, stored, opened, told, drag };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 8, 9, 0));
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("the calendar", () => {
  it("shows this month as whole weeks, each item on its day (its time first), today marked, the items without a start over it", async () => {
    const { all, day, names, element } = await setup([{ name: "Notes", due: "2026-11-03" }, { name: "Sync", due: "2026-11-05T10:00" }, { name: "Lunch", due: "2026-11-05T09:30" }, { name: "Someday" }, { name: "Odd", due: "soon" }]);
    expect(element.querySelector(".swd-cal-title")!.textContent).toBe("November 2026");
    expect([all(".swd-cal-week").length, all(".swd-cal-day")[0]!.dataset.day]).toEqual([6, "2026-10-26"]);
    expect(names("2026-11-03")).toEqual(["Notes"]);
    expect(names("2026-11-05")).toEqual(["09:30 Lunch", "10:00 Sync"]);
    expect(day("2026-11-08").classList.contains("swd-cal-now")).toBe(true);
    expect(day("2026-10-26").classList.contains("swd-cal-other")).toBe(true);
    // (A value that does not read as a day: with those without one)
    expect(all(".swd-cal-undated .swd-cal-item").map((one) => one.textContent)).toEqual(["Someday", "Odd"]);
  });

  it("opens an item pressed, adds one on a day by its +, and steps the months, Today back", async () => {
    const { day, onDay, element, opened, stored } = await setup([{ name: "Notes", due: "2026-11-03" }]);
    onDay("2026-11-03")[0]!.click();
    expect(opened).toEqual(["Notes"]);
    day("2026-11-20").querySelector<HTMLButtonElement>(".swd-cal-add")!.click();
    await settle();
    expect((await stored())["Untitled"]).toEqual(["2026-11-20", undefined]);
    const title = () => element.querySelector(".swd-cal-title")!.textContent;
    element.querySelector<HTMLButtonElement>('.swd-cal-step[aria-label="Next month"]')!.click();
    expect([title(), element.querySelector(".swd-cal-day[data-day='2026-12-01']") !== null]).toEqual(["December 2026", true]);
    element.querySelector<HTMLButtonElement>(".swd-cal-today")!.click();
    expect(title()).toBe("November 2026");
  });

  it("moves an item dragged onto another day there, its time kept; one without a start given that day", async () => {
    const { day, onDay, element, stored, drag } = await setup([{ name: "Sync", due: "2026-11-05T10:00" }, { name: "Someday" }]);
    drag(onDay("2026-11-05")[0]!, day("2026-11-12"));
    await settle();
    drag(element.querySelector(".swd-cal-undated .swd-cal-item")!, day("2026-11-13"));
    await settle();
    expect(await stored()).toEqual({ Sync: ["2026-11-12T10:00", undefined], Someday: ["2026-11-13", undefined] });
  });

  it("never drags a value that reads as no day (its text would go), and writes nothing for a drop on its own day", async () => {
    const { day, onDay, element, stored, drag } = await setup([{ name: "Odd", due: "soon" }, { name: "Sync", due: "2026-11-05T10:00" }]);
    const odd = element.querySelector<HTMLElement>(".swd-cal-undated .swd-cal-item")!;
    expect([odd.getAttribute("draggable"), odd.classList.contains("swd-invalid"), odd.title]).toEqual([null, true, 'Odd: its Due "soon" reads as no day; open it to set one']);
    drag(onDay("2026-11-05")[0]!, day("2026-11-05"));
    await settle();
    expect(await stored()).toEqual({ Odd: ["soon", undefined], Sync: ["2026-11-05T10:00", undefined] });
  });

  it("shows a week of many lanes as a few and +N more, then all; a day pressed is picked, its items listed under the month", async () => {
    const many = ["A", "B", "C", "D", "E"].map((name) => ({ name, due: "2026-11-10" }));
    const { day, names, element } = await setup(many);
    expect(names("2026-11-10")).toEqual(["A", "B", "C"]);
    day("2026-11-10").closest(".swd-cal-week")!.querySelector<HTMLButtonElement>(".swd-cal-more")!.click();
    expect(names("2026-11-10")).toEqual(["A", "B", "C", "D", "E"]);
    // (Today picked to start with: nothing on it)
    expect(element.querySelector(".swd-cal-agenda-none")).not.toBeNull();
    day("2026-11-10").click();
    expect([...element.querySelectorAll(".swd-cal-agenda .swd-cal-item")].map((one) => one.textContent)).toEqual(["A", "B", "C", "D", "E"]);
    expect(day("2026-11-10").classList.contains("swd-cal-picked")).toBe(true);
  });

  it("shows a week of one lane more than three whole, with no Show fewer", async () => {
    const { onDay, element } = await setup(["A", "B", "C", "D"].map((name) => ({ name, due: "2026-11-10" })));
    expect([onDay("2026-11-10").length, element.querySelector(".swd-cal-more")]).toEqual([4, null]);
  });

  it("never draws all of many items: a week opened 50 lanes at a time, the day's list and those without a start 100 at a time", async () => {
    const many = [...Array.from({ length: 230 }, (_, at) => ({ name: `T${at}`, due: "2026-11-10" })), ...Array.from({ length: 150 }, (_, at) => ({ name: `U${at}` }))];
    const { day, onDay, element, all } = await setup(many);
    const week = () => day("2026-11-10").closest(".swd-cal-week")!;
    const more = () => week().querySelector<HTMLButtonElement>(".swd-cal-more:not(.swd-cal-fewer)");
    expect([onDay("2026-11-10").length, more()!.textContent]).toEqual([3, "+227 more"]);
    more()!.click();
    expect([onDay("2026-11-10").length, more()!.textContent]).toEqual([50, "+180 more"]);
    more()!.click();
    expect(onDay("2026-11-10").length).toBe(100);
    week().querySelector<HTMLButtonElement>(".swd-cal-fewer")!.click();
    expect(onDay("2026-11-10").length).toBe(3);
    // The lists: 100 shown, a button for the next, the first of them focused once shown
    day("2026-11-10").click();
    const agenda = () => all(".swd-cal-agenda .swd-cal-item");
    expect([agenda().length, element.querySelector(".swd-cal-agenda .swd-cal-list-more")!.textContent]).toEqual([100, "Show 100 more (130 left)"]);
    element.querySelector<HTMLButtonElement>(".swd-cal-agenda .swd-cal-list-more")!.click();
    // (The 101st as listed: the first of those just shown)
    expect([agenda().length, document.activeElement === agenda()[100]]).toEqual([200, true]);
    expect(all(".swd-cal-undated-items .swd-cal-item").length).toBe(100);
    element.querySelector<HTMLButtonElement>(".swd-cal-undated .swd-cal-list-more")!.click();
    expect([all(".swd-cal-undated-items .swd-cal-item").length, element.querySelector(".swd-cal-undated .swd-cal-list-more")]).toEqual([150, null]);
  });

  it("shows its days by the properties picked under Start and End in ⋯; one not changed by hand offers no + nor a drag", async () => {
    const { all, element } = await setup([{ name: "Notes", due: "2026-11-03" }], { "calendar.dateBy": "made" });
    expect(element.querySelector(".swd-cal-by")!.textContent).toBe("by Made");
    expect([all(".swd-cal-add").length, all('.swd-cal-item[draggable="true"]').length]).toEqual([0, 0]);
    element.querySelector<HTMLButtonElement>(".swd-more")!.click();
    [...element.querySelectorAll<HTMLElement>(".swd-menu .swd-menu-item")].find((one) => one.textContent!.startsWith("Start"))!.click();
    expect([...element.querySelectorAll(".swd-menu .swd-menu-item .swd-label")].map((one) => one.textContent)).toEqual(["Due", "Until", "Made"]);
  });
});

describe("the calendar's spans", () => {
  const ranged = { "calendar.endBy": "until" };

  it("lays an item from its start to its end as a bar across its days, cut at a week's edges, in the same lane", async () => {
    const { onDay, element } = await setup([{ name: "Trip", due: "2026-11-06T08:00", until: "2026-11-10" }, { name: "Call", due: "2026-11-09" }], ranged);
    expect(element.querySelector(".swd-cal-by")!.textContent).toBe("by Due → Until");
    // (Friday to Sunday in one week, Monday to Tuesday in the next: its time where it starts only)
    const parts = [...element.querySelectorAll<HTMLElement>(".swd-cal-week .swd-cal-item")].filter((one) => one.textContent!.includes("Trip"));
    expect(parts.map((one) => [one.textContent, one.style.gridColumn, one.classList.contains("swd-cal-before"), one.classList.contains("swd-cal-after")])).toEqual([
      ["08:00 Trip", "5 / 8", false, true],
      ["Trip", "1 / 3", true, false],
    ]);
    expect(onDay("2026-11-09").map((one) => one.textContent)).toEqual(["Trip", "Call"]);
  });

  it("moves an item whole by the day it is taken by, its length and times kept; its ends changed by their handles", async () => {
    const { onDay, day, stored, drag } = await setup([{ name: "Trip", due: "2026-11-03T08:00", until: "2026-11-05" }], ranged);
    drag(onDay("2026-11-03")[0]!, day("2026-11-10"));
    await settle();
    expect((await stored()).Trip).toEqual(["2026-11-10T08:00", "2026-11-12"]);
    drag(onDay("2026-11-10")[0]!.querySelector(".swd-cal-handle-end")!, day("2026-11-14"));
    await settle();
    expect((await stored()).Trip).toEqual(["2026-11-10T08:00", "2026-11-14"]);
    drag(onDay("2026-11-10")[0]!.querySelector(".swd-cal-handle-start")!, day("2026-11-09"));
    await settle();
    expect((await stored()).Trip).toEqual(["2026-11-09T08:00", "2026-11-14"]);
  });

  it("refuses an end before its start or a start after its end, said; an end before its start shown as a day alone, marked", async () => {
    const { onDay, day, stored, told, drag } = await setup([{ name: "Trip", due: "2026-11-10", until: "2026-11-12" }, { name: "Odd", due: "2026-11-20", until: "2026-11-18" }], ranged);
    drag(onDay("2026-11-12")[0]!.querySelector(".swd-cal-handle-end")!, day("2026-11-09"));
    drag(onDay("2026-11-10")[0]!.querySelector(".swd-cal-handle-start")!, day("2026-11-13"));
    await settle();
    expect((await stored()).Trip).toEqual(["2026-11-10", "2026-11-12"]);
    expect(told).toEqual(["Trip would end before it starts", "Trip would start after it ends"]);
    const odd = onDay("2026-11-20")[0]!;
    expect([odd.classList.contains("swd-invalid"), odd.title]).toEqual([true, "Odd (its Until is before its Due): open, or drag it to another day"]);
  });

  it("gives an item a day alone an end by its end's handle, and lists one lasting over the picked day with its days", async () => {
    const { onDay, day, stored, element, drag } = await setup([{ name: "Call", due: "2026-11-09" }, { name: "Trip", due: "2026-11-06", until: "2026-11-10" }], ranged);
    drag(onDay("2026-11-09").find((one) => one.textContent === "Call")!.querySelector(".swd-cal-handle-end")!, day("2026-11-11"));
    await settle();
    expect((await stored()).Call).toEqual(["2026-11-09", "2026-11-11"]);
    day("2026-11-08").click();
    expect([...element.querySelectorAll(".swd-cal-agenda .swd-cal-item")].map((one) => one.textContent)).toEqual(["Trip Nov 6 – Nov 10"]);
  });

  it("never writes over an end that reads as no day, nor offers an end not changed by hand (a move writes its end too)", async () => {
    const { onDay } = await setup([{ name: "Plan", due: "2026-11-10", until: "next sprint" }], ranged);
    const plan = onDay("2026-11-10")[0]!;
    expect([plan.querySelector(".swd-cal-handle-end"), plan.classList.contains("swd-invalid")]).toEqual([null, true]);
    document.body.replaceChildren();
    const ro = await setup([{ name: "Notes", due: "2026-11-03" }], { "calendar.endBy": "made" });
    expect(ro.element.querySelector(".swd-cal-by")!.textContent).toBe("by Due");
    ro.element.querySelector<HTMLButtonElement>(".swd-more")!.click();
    [...ro.element.querySelectorAll<HTMLElement>(".swd-menu .swd-menu-item")].find((one) => one.textContent!.startsWith("End"))!.click();
    expect([...ro.element.querySelectorAll(".swd-menu .swd-menu-item .swd-label")].map((one) => one.textContent)).toEqual(["None (a day each)", "Until"]);
  });

  it("lasts a day alone from an earlier day by its start's handle; refuses a start after an end kept, a start given or not", async () => {
    const { onDay, day, stored, told, element, drag } = await setup([{ name: "Call", due: "2026-11-12" }, { name: "Later", until: "2026-11-10" }], ranged);
    drag(onDay("2026-11-12")[0]!.querySelector(".swd-cal-handle-start")!, day("2026-11-10"));
    await settle();
    expect((await stored()).Call).toEqual(["2026-11-10", "2026-11-12"]);
    drag(element.querySelector(".swd-cal-undated .swd-cal-item")!, day("2026-11-20"));
    await settle();
    expect([(await stored()).Later, told]).toEqual([[undefined, "2026-11-10"], ["Later would start after it ends"]]);
  });

  it("moves nothing for an item dropped on the picked day's list it lasts over already", async () => {
    const { day, onDay, element, stored, drag } = await setup([{ name: "Trip", due: "2026-11-06", until: "2026-11-10" }], ranged);
    day("2026-11-08").click();
    drag(onDay("2026-11-06")[0]!, element.querySelector(".swd-cal-agenda")!);
    await settle();
    expect((await stored()).Trip).toEqual(["2026-11-06", "2026-11-10"]);
  });
});
