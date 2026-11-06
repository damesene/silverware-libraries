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
    expect(sourceData({})).toEqual({ columns: ["value"], rows: [] });
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
    expect(sources.define("bad name", () => [])).toMatch(/is no source's name/);
    expect(sources.define("A1", () => [])).toMatch(/is no source's name/);
    expect(sources.define("ok", "nope")).toMatch(/give a function/);
    expect(sources.define("ok", { columns: 3 }, () => [])).toMatch(/its options are/);
    expect(sources.define("ok", () => [])).toBeUndefined();
    expect(sources.define("other", { columns: { 1: "a" } }, () => [])).toBeUndefined();
  });

  it("knows a source's name as it is defined, before its function has given rows; compared ignoring case", () => {
    sources.define("Tasks", () => new Promise(() => {}));
    expect(sources.names()).toEqual(["Tasks"]);
    expect(sources.read("tasks")).toBeUndefined();
  });

  it("reads a source as it is defined, and tells of the change once", async () => {
    sources.define("tasks", async () => [{ name: "a" }]);
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
    sources.define("tasks", { columns: ["due", "name"] }, () => [{ name: "a", due: "d" }]);
    await vi.runAllTimersAsync();
    expect(sources.read("tasks")).toEqual({ columns: ["due", "name"], rows: [["d", "a"]] });
  });

  it("reads the sources again a while after the last page indexed", async () => {
    let values = ["a"];
    sources.define("x", () => values);
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
    sources.define("x", () => {
      if (fail) throw fail;
      return ["a"];
    });
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
    sources.define("x", () => "a, b");
    await vi.runAllTimersAsync();
    expect(sources.read("x")).toBeUndefined();
    expect(problems).toEqual(["Silverware Table: the source x gave no list (return a query's result, or a list of values)."]);
  });

  it("drops a source no script defines once Space Lua has loaded again", async () => {
    sources.define("x", () => ["a"]);
    sources.define("y", () => ["b"]);
    await vi.runAllTimersAsync();
    sources.anew();
    sources.define("y", () => ["c"]);
    await vi.runAllTimersAsync();
    expect(sources.names()).toEqual(["y"]);
    expect(sources.read("x")).toBeUndefined();
    expect(sources.read("y")?.rows).toEqual([["c"]]);
  });

  it("keeps reading the definitions of before until a script defines one, or for a while where none does", async () => {
    sources.define("x", () => ["a"]);
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

  it("says a problem found before init once it is connected", async () => {
    const early = new LuaSources();
    const said: string[] = [];
    early.define("x", () => {
      throw new Error("early");
    });
    await vi.runAllTimersAsync();
    early.connect((m) => said.push(m));
    await vi.runAllTimersAsync();
    expect(said).toEqual(["Silverware Table: the source x failed: early"]);
    early.reset();
  });
});
