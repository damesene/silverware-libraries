import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spaceList, spaceListNames } from "./columntypes/spacelists.ts";
import { type ChoicesHost, choicesAnew, choicesIndexed, choiceValues, defineChoices, REFRESH_MS, refreshChoices, resetChoicesForTests, setChoicesHost } from "./spacechoices.ts";

describe("choiceValues", () => {
  it("takes a list or a Lua table of texts and numbers, each once (its case ignored), empty ones out", () => {
    expect(choiceValues(["b", "a", "B", " ", 3, null])).toEqual({ values: ["b", "a", "3"] });
    expect(choiceValues({ 1: "x", 2: " y " })).toEqual({ values: ["x", "y"] });
    expect(choiceValues({})).toEqual({ values: [] });
    expect(choiceValues([])).toEqual({ values: [] });
  });

  it("is no list for anything else", () => {
    expect(choiceValues("a")).toEqual({ problem: "are not a list of values" });
    expect(choiceValues(undefined)).toEqual({ problem: "are not a list of values" });
    expect(choiceValues({ name: "a" })).toEqual({ problem: "are not a list of values" });
    // A query selecting no field: its objects are no values
    expect(choiceValues([{ name: "a" }])).toEqual({ problem: "hold items that are not texts (select a field: select p.name)" });
  });
});

describe("defineChoices", () => {
  const problems: string[] = [];
  let changes = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    resetChoicesForTests();
    problems.length = 0;
    changes = 0;
    setChoicesHost({ problem: (m) => problems.push(m), changed: () => changes++ });
  });
  afterEach(() => {
    resetChoicesForTests();
    vi.useRealTimers();
  });

  it("refuses a name a list cannot have, or no function", () => {
    expect(defineChoices("Bad name", () => [])).toMatch(/is no list's name/);
    expect(defineChoices("ok", "nope")).toMatch(/give a function/);
    expect(defineChoices("ok", () => [])).toBeUndefined();
  });

  it("reads a list as it is defined, its name in lower case, and tells of the change once", async () => {
    defineChoices("Projects", async () => ["Alpha", "Beta"]);
    await vi.runAllTimersAsync();
    expect(spaceList("projects")).toEqual(["Alpha", "Beta"]);
    expect(spaceListNames()).toEqual(["projects"]);
    expect(changes).toBe(1);
    // Read again the same: nothing changed
    await refreshChoices();
    expect(changes).toBe(1);
  });

  it("reads the lists again a while after the last page indexed", async () => {
    let values = ["a"];
    defineChoices("x", () => values);
    await vi.runAllTimersAsync();
    values = ["a", "b"];
    choicesIndexed();
    await vi.advanceTimersByTimeAsync(REFRESH_MS / 2);
    choicesIndexed();
    await vi.advanceTimersByTimeAsync(REFRESH_MS / 2);
    expect(spaceList("x")).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    expect(spaceList("x")).toEqual(["a", "b"]);
  });

  it("keeps a list's values where its function fails, said once until the problem changes", async () => {
    let fail: unknown = undefined;
    defineChoices("x", () => {
      if (fail) throw fail;
      return ["a"];
    });
    await vi.runAllTimersAsync();
    fail = new Error("no index");
    await refreshChoices();
    await refreshChoices();
    expect(spaceList("x")).toEqual(["a"]);
    expect(problems).toEqual(["Silverware Table: the choices x failed: no index"]);
    fail = undefined;
    await refreshChoices();
    fail = new Error("no index");
    await refreshChoices();
    expect(problems).toHaveLength(2);
  });

  it("says a function that gives no list", async () => {
    defineChoices("x", () => "a, b");
    await vi.runAllTimersAsync();
    expect(spaceList("x")).toBeUndefined();
    expect(problems).toEqual(["Silverware Table: the choices x are not a list of values."]);
  });

  it("drops a list no script defines once Space Lua has loaded again", async () => {
    defineChoices("x", () => ["a"]);
    defineChoices("y", () => ["b"]);
    await vi.runAllTimersAsync();
    choicesAnew();
    defineChoices("y", () => ["c"]);
    await vi.runAllTimersAsync();
    expect(spaceListNames()).toEqual(["y"]);
    expect(spaceList("y")).toEqual(["c"]);
  });

  it("keeps reading the definitions of before until a script defines one, or for a while where none does", async () => {
    defineChoices("x", () => ["a"]);
    await vi.runAllTimersAsync();
    choicesAnew();
    // A page indexed meanwhile: the list stays
    await refreshChoices();
    expect(spaceList("x")).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(REFRESH_MS);
    await vi.runAllTimersAsync();
    expect(spaceListNames()).toEqual([]);
  });

  it("knows a list's name as it is defined, before its function has given values", () => {
    defineChoices("x", () => new Promise(() => {}));
    expect(spaceListNames()).toEqual(["x"]);
    expect(spaceList("x")).toBeUndefined();
  });

  it("says a problem found before there was a host once there is one", async () => {
    resetChoicesForTests();
    setChoicesHost(undefined as unknown as ChoicesHost);
    defineChoices("x", () => {
      throw new Error("early");
    });
    await vi.runAllTimersAsync();
    expect(problems).toEqual([]);
    setChoicesHost({ problem: (m) => problems.push(m), changed: () => changes++ });
    await vi.runAllTimersAsync();
    expect(problems).toEqual(["Silverware Table: the choices x failed: early"]);
  });

  it("says a list of objects", async () => {
    defineChoices("x", () => [{ name: "a" }]);
    await vi.runAllTimersAsync();
    expect(problems).toEqual(["Silverware Table: the choices x hold items that are not texts (select a field: select p.name)."]);
  });
});
