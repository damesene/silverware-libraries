import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LuaSources, REFRESH_MS, sourceData } from "./sources.ts";

describe("sourceData", () => {
  it("takes a list of records as rows, its columns the first record's keys then those new in later ones", () => {
    expect(sourceData([{ name: "a", due: "2025-11-06" }, { name: "b", done: true }])).toEqual({
      columns: ["name", "due", "done"],
      rows: [
        ["a", "2025-11-06", ""],
        ["b", "", "TRUE"],
      ],
    });
  });

  it("takes a Lua table of them too (keys 1, 2…)", () => {
    expect(sourceData({ 1: { name: "a" }, 2: { name: "b" } })).toEqual({ columns: ["name"], rows: [["a"], ["b"]] });
  });

  it("takes the columns given, in their order, some of them only", () => {
    expect(sourceData([{ name: "a", due: "x", page: "P" }], ["page", "name"])).toEqual({ columns: ["page", "name"], rows: [["P", "a"]] });
  });

  it("writes values as text: numbers, TRUE and FALSE, a list joined by a comma, nil and an object empty", () => {
    expect(sourceData([{ n: 3.5, yes: false, tags: { 1: "a", 2: "b" }, people: ["x", "y"], obj: { a: 1 }, none: null }])).toEqual({
      columns: ["n", "yes", "tags", "people", "obj", "none"],
      rows: [["3.5", "FALSE", "a, b", "x, y", "", ""]],
    });
  });

  it("takes a list of values as one column, value", () => {
    expect(sourceData(["Atlas", 2, null, true])).toEqual({ columns: ["value"], rows: [["Atlas"], ["2"], ["TRUE"]] });
    // Nothing: no columns known but those asked for
    expect(sourceData({})).toEqual({ columns: [], rows: [] });
    expect(sourceData([], ["name"])).toEqual({ columns: ["name"], rows: [] });
  });

  it("is no source for anything else", () => {
    expect(sourceData("a")).toEqual({ problem: "gave no list (return a query's result, or a list of values)" });
    expect(sourceData(undefined)).toHaveProperty("problem");
    expect(sourceData([{ a: 1 }, "b"])).toEqual({ problem: "gave a list of both records and values (select { … } for every row, or one field)" });
    expect(sourceData([["a"]])).toHaveProperty("problem");
  });
});

describe("LuaSources", () => {
  let sources: LuaSources;
  const problems: string[] = [];
  let changes = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    sources = new LuaSources();
    problems.length = 0;
    changes = 0;
    sources.connect((m) => problems.push(m));
    sources.changed(() => changes++);
  });
  afterEach(() => {
    sources.reset();
    vi.useRealTimers();
  });

  it("refuses a name a table cannot have, no function, or options that are not columns", () => {
    expect(sources.define("tasks")).toMatch(/give a table/);
    expect(sources.define({ name: "bad name", data: () => [] })).toMatch(/is no source's name/);
    expect(sources.define({ name: "A1", data: () => [] })).toMatch(/is no source's name/);
    expect(sources.define({ name: "ok", data: "nope" })).toMatch(/its data is a function/);
    expect(sources.define({ name: "ok", data: () => [], columns: 3 })).toMatch(/its columns are/);
    expect(sources.define({ name: "ok", data: () => [], run: () => [] })).toMatch(/knows no run/);
    expect(sources.define({ name: "ok", data: () => [] })).toBeUndefined();
    // A Lua table's list: keys 1, 2…
    expect(sources.define({ name: "other", data: () => [], columns: { 1: "a" } })).toBeUndefined();
  });

  it("knows a source's name as it is defined, before its function has given rows; compared ignoring case", () => {
    sources.define({ name: "Tasks", data: () => new Promise(() => {}) });
    expect(sources.names()).toEqual(["Tasks"]);
    expect(sources.read("tasks")).toBeUndefined();
  });

  it("reads a source as it is defined, and tells of the change once", async () => {
    sources.define({ name: "tasks", data: async () => [{ name: "a" }] });
    await vi.runAllTimersAsync();
    const read = sources.read("TASKS");
    expect(read).toEqual({ columns: ["name"], rows: [["a"]] });
    const told = changes;
    // Read again the same: nothing changed, the same object
    await sources.refresh();
    expect(changes).toBe(told);
    expect(sources.read("tasks")).toBe(read);
  });

  it("takes the columns given", async () => {
    sources.define({ name: "tasks", columns: ["due", "name"], data: () => [{ name: "a", due: "d" }] });
    await vi.runAllTimersAsync();
    expect(sources.read("tasks")).toEqual({ columns: ["due", "name"], rows: [["d", "a"]] });
  });

  it("reads the sources again a while after the last page indexed", async () => {
    let values = ["a"];
    sources.define({ name: "x", data: () => values });
    await vi.runAllTimersAsync();
    values = ["a", "b"];
    sources.indexed();
    await vi.advanceTimersByTimeAsync(REFRESH_MS / 2);
    sources.indexed();
    await vi.advanceTimersByTimeAsync(REFRESH_MS / 2);
    expect(sources.read("x")?.rows).toEqual([["a"]]);
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    expect(sources.read("x")?.rows).toEqual([["a"], ["b"]]);
  });

  it("keeps a source's rows where its function fails, said once until the problem changes", async () => {
    let fail: unknown = undefined;
    sources.define({ name: "x", data: () => {
      if (fail) throw fail;
      return ["a"];
    } });
    await vi.runAllTimersAsync();
    fail = new Error("no index");
    await sources.refresh();
    await sources.refresh();
    expect(sources.read("x")?.rows).toEqual([["a"]]);
    expect(problems).toEqual(["Silverware Table: the source x failed: no index"]);
    fail = undefined;
    await sources.refresh();
    fail = new Error("no index");
    await sources.refresh();
    expect(problems).toHaveLength(2);
  });

  it("says a function that gives no list", async () => {
    sources.define({ name: "x", data: () => "a, b" });
    await vi.runAllTimersAsync();
    expect(sources.read("x")).toBeUndefined();
    expect(problems).toEqual(["Silverware Table: the source x gave no list (return a query's result, or a list of values)."]);
  });

  it("drops a source no script defines once Space Lua has loaded again", async () => {
    sources.define({ name: "x", data: () => ["a"] });
    sources.define({ name: "y", data: () => ["b"] });
    await vi.runAllTimersAsync();
    sources.anew();
    sources.define({ name: "y", data: () => ["c"] });
    await vi.runAllTimersAsync();
    expect(sources.names()).toEqual(["y"]);
    expect(sources.read("x")).toBeUndefined();
    expect(sources.read("y")?.rows).toEqual([["c"]]);
  });

  it("keeps reading the definitions of before until a script defines one, or for a while where none does", async () => {
    sources.define({ name: "x", data: () => ["a"] });
    await vi.runAllTimersAsync();
    sources.anew();
    // A page indexed meanwhile: the source stays
    await sources.refresh();
    expect(sources.read("x")?.rows).toEqual([["a"]]);
    const told = changes;
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    await vi.runAllTimersAsync();
    expect(sources.names()).toEqual([]);
    expect(changes).toBeGreaterThan(told);
  });

  it("keeps the columns read before where a query gives no rows", async () => {
    let rows: unknown[] = [{ name: "a", due: "d" }];
    sources.define({ name: "overdue", data: () => rows });
    await vi.runAllTimersAsync();
    rows = [];
    await sources.refresh();
    expect(sources.read("overdue")).toEqual({ columns: ["name", "due"], rows: [] });
  });

  it("has the sources of before unread, not gone, while a new load of Space Lua defines them again", async () => {
    sources.define({ name: "x", data: () => ["a"] });
    sources.define({ name: "y", data: () => ["b"] });
    await vi.runAllTimersAsync();
    sources.anew();
    sources.define({ name: "x", data: () => ["c"] });
    // y not defined again yet: known, not read
    expect(sources.names()).toEqual(["y", "x"]);
    expect(sources.read("y")).toBeUndefined();
    sources.define({ name: "y", data: () => ["d"] });
    await vi.runAllTimersAsync();
    expect(sources.read("y")?.rows).toEqual([["d"]]);
    // One no script defines again goes once the load is over
    sources.anew();
    sources.define({ name: "x", data: () => ["e"] });
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    await vi.runAllTimersAsync();
    expect(sources.names()).toEqual(["x"]);
  });

  it("says a problem found before init once it is connected", async () => {
    const early = new LuaSources();
    const said: string[] = [];
    early.define({ name: "x", data: () => {
      throw new Error("early");
    } });
    await vi.runAllTimersAsync();
    early.connect((m) => said.push(m));
    await vi.runAllTimersAsync();
    expect(said).toEqual(["Silverware Table: the source x failed: early"]);
    early.reset();
  });
});
