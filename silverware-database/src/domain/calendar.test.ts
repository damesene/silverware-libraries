import { describe, expect, it } from "vitest";
import { addDays, dayOf, daysBetween, inMonth, monthOfDay, monthWeeks, stepMonth, today, weekday, weekSegments } from "./calendar.ts";

describe("a calendar's days", () => {
  it("lays a month out as whole weeks, from a Monday or a Sunday", () => {
    // November 2026: the 1st a Sunday, the 30th a Monday
    const monday = monthWeeks({ year: 2026, month: 10 }, 1);
    expect(monday.map((week) => [week[0], week[6]])).toEqual([
      ["2026-10-26", "2026-11-01"],
      ["2026-11-02", "2026-11-08"],
      ["2026-11-09", "2026-11-15"],
      ["2026-11-16", "2026-11-22"],
      ["2026-11-23", "2026-11-29"],
      ["2026-11-30", "2026-12-06"],
    ]);
    const sunday = monthWeeks({ year: 2026, month: 10 }, 0);
    expect([sunday.length, sunday[0]![0], sunday.at(-1)![6]]).toEqual([5, "2026-11-01", "2026-12-05"]);
    // February 2027 from a Monday: four weeks exactly
    expect(monthWeeks({ year: 2027, month: 1 }, 1)).toHaveLength(4);
  });

  it("steps months over years, tells a day's month, its weekday, and today on the user's clock", () => {
    expect([stepMonth({ year: 2026, month: 11 }, 1), stepMonth({ year: 2026, month: 0 }, -1), stepMonth({ year: 2026, month: 5 }, -18)]).toEqual([
      { year: 2027, month: 0 },
      { year: 2025, month: 11 },
      { year: 2024, month: 11 },
    ]);
    expect([monthOfDay("2026-11-08"), weekday("2026-11-08"), dayOf(2026, 1, 29)]).toEqual([{ year: 2026, month: 10 }, 0, "2026-03-01"]);
    expect([inMonth("2026-11-30", { year: 2026, month: 10 }), inMonth("2026-12-01", { year: 2026, month: 10 })]).toEqual([true, false]);
    expect(today(new Date(2026, 10, 8, 23, 30))).toBe("2026-11-08");
    // (Days added over months and years; days between, either way)
    expect([addDays("2026-12-30", 3), addDays("2026-03-01", -1), daysBetween("2026-11-08", "2026-11-12"), daysBetween("2026-11-12", "2026-10-31")]).toEqual(["2027-01-02", "2026-02-28", 4, -12]);
  });

  it("lays a week's spans in rows, each in the first free across its days, cut at the week's edges", () => {
    const week = monthWeeks({ year: 2026, month: 10 }, 1)[1]!; // 2 to 8 November
    const spans = [
      { key: "trip", start: "2026-10-30", end: "2026-11-03" },
      { key: "call", start: "2026-11-03", end: "2026-11-03" },
      { key: "sprint", start: "2026-11-03", end: "2026-11-12" },
      { key: "lunch", start: "2026-11-05", end: "2026-11-05" },
      { key: "later", start: "2026-11-20", end: "2026-11-21" },
    ];
    expect(weekSegments(week, spans).map((one) => [one.key, one.from, one.to, one.lane, one.starts, one.ends])).toEqual([
      ["trip", 0, 1, 0, false, true],
      ["sprint", 1, 6, 1, true, false],
      ["call", 1, 1, 2, true, true],
      ["lunch", 3, 3, 0, true, true],
    ]);
  });

  it("puts each span in the first lane free on all its days, as a pass over the lanes would; thousands on a day at once", () => {
    const week = Array.from({ length: 7 }, (_, at) => addDays("2026-11-02", at));
    // The plain rule: lanes searched from the first, each span in the first free on all its days
    const plain = (spans: { key: number; start: string; end: string }[]) => {
      const taken: boolean[][] = [];
      return weekSegments(week, spans).map((one) => {
        let lane = 0;
        while (taken[lane]?.slice(one.from, one.to + 1).some(Boolean)) lane++;
        taken[lane] ??= Array<boolean>(7).fill(false);
        for (let at = one.from; at <= one.to; at++) taken[lane]![at] = true;
        return lane;
      });
    };
    let seed = 7;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const spans = Array.from({ length: 400 }, (_, key) => {
      const start = addDays("2026-10-30", Math.floor(random() * 12));
      return { key, start, end: addDays(start, Math.floor(random() * 5)) };
    });
    expect(weekSegments(week, spans).map((one) => one.lane)).toEqual(plain(spans));
    const pile = Array.from({ length: 20000 }, (_, key) => ({ key, start: "2026-11-08", end: "2026-11-08" }));
    const started = performance.now();
    expect(weekSegments(week, pile).at(-1)!.lane).toBe(19999);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
