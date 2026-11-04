import { afterEach, describe, expect, it } from "vitest";
import { clearCustomMenuEntries, customMenuEntries, customMenuEntriesAnew, defineCustomMenuEntries, menuEntriesDefinitions } from "./custom.ts";

describe("Custom menu entries' definitions", () => {
  afterEach(() => clearCustomMenuEntries());
  const lineMenu = () => [];

  it("takes a list or a module's default export, and says what is wrong with the others", () => {
    expect(customMenuEntries({ default: [{ name: "a", lineMenu }] }).list.map((d) => d.name)).toEqual(["a"]);
    const { list, problems } = customMenuEntries([{ name: "a", lineMenu }, { name: "1x", lineMenu }, { name: "b" }, "c"]);
    expect(list.map((d) => d.name)).toEqual(["a"]);
    expect(problems).toEqual([
      "has no name (letters, digits, - and _, starting with a letter)",
      "b: has no lineMenu(context, menu)",
      "is no definition (an object with a name and a lineMenu)",
    ]);
    expect(customMenuEntries("x").problems).toEqual(["the definitions are not a list of menu entries' definitions"]);
  });

  it("adds up calls (a plugin's and the user's), a name again replacing its definition; Space Lua loaded anew starts over at its first call", () => {
    const first = { name: "a", lineMenu };
    const again = { name: "a", lineMenu };
    defineCustomMenuEntries([first]);
    defineCustomMenuEntries([{ name: "b", lineMenu }]);
    defineCustomMenuEntries([again]);
    expect(menuEntriesDefinitions().map((d) => d.name)).toEqual(["a", "b"]);
    expect(menuEntriesDefinitions()[0]).toBe(again);
    // Kept until the first call of the next load
    customMenuEntriesAnew();
    expect(menuEntriesDefinitions().map((d) => d.name)).toEqual(["a", "b"]);
    defineCustomMenuEntries([{ name: "c", lineMenu }]);
    expect(menuEntriesDefinitions().map((d) => d.name)).toEqual(["c"]);
  });
});
