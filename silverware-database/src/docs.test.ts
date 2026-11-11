// @vitest-environment jsdom
// The library page's examples of a view, a type and a converter of your own, run as a space's
// module would be: defined, then used, so the page shows what works.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type ConverterDefinition, validateConverted, validateConverter } from "./core/converter.ts";
import { CONVERTER_HELPERS } from "./converters/helpers.ts";
import { DatabaseCore } from "./core/core.ts";
import { DatabasePlace, VIEW_KEY } from "./core/place.ts";
import type { ViewDefinition } from "./core/view.ts";
import { validateView, ViewRegistry } from "./core/views.ts";
import { guardedType, TYPE_HELPERS, validateType } from "./domain/types/custom.ts";
import { TypeRegistry } from "./domain/types/registry.ts";
import type { PropertyType } from "./domain/types/type.ts";
import { MemoryStore } from "./store/memory.ts";
import { MemoryViewState } from "./store/viewstate.ts";
import { BUILT_IN_VIEWS } from "./views/builtin/index.ts";
import { VIEW_HELPERS } from "./views/helpers.ts";

const PAGE = readFileSync(join(import.meta.dirname, "..", "silverware-database.md"), "utf8");

/** A ```js block of the page, by the file its first line names, run as its module: what its default export gives, given HELPERS */
function example(file: string, helpers: unknown): unknown[] {
  const block = [...PAGE.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]!).find((text) => text.startsWith(`// ${file}`));
  if (!block) throw new Error(`no example of ${file}`);
  const made = new Function(block.replace("export default", "return"))() as unknown;
  return (typeof made === "function" ? (made as (h: unknown) => unknown)(helpers) : made) as unknown[];
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

describe("the library page's examples", () => {
  it("define a type that shows and reads its values", () => {
    const [stars] = example("Library/me/types.js", TYPE_HELPERS) as PropertyType[];
    expect(validateType(stars!)).toBeUndefined();
    const type = guardedType(stars!, (problem) => {
      throw new Error(problem);
    });
    expect([type.text(3, {}), type.parse("4", {}), type.parse("9", {}), type.validate(7, {}), type.validate(null, {})]).toEqual(["★★★", { value: 4 }, { problem: "1 to 5" }, "1 to 5", undefined]);
  });

  it("define a converter, given HELPERS, whose items make a database", async () => {
    const [table] = example("Library/me/converters.js", CONVERTER_HELPERS) as ConverterDefinition[];
    expect(validateConverter(table!)).toBeUndefined();
    const converted = table!.read("| Name | Due | Estimate |\n|---|---|---|\n| Call the client | 2026-11-12 | 3 |\n| Send the offer | | 5 |\n");
    expect(validateConverted(converted)).toBeUndefined();
    expect(converted!.properties.map((one) => [one.key, one.type])).toEqual([
      ["due", "date"],
      ["estimate", "number"],
    ]);
    const store = new MemoryStore();
    const core = new DatabaseCore(store, new TypeRegistry(), { notify: () => {}, ask: () => true });
    await core.createDatabaseOf("Ideas", converted!);
    expect((await store.items("ideas")).value.map((item) => [item.name, item.values.due, item.values.estimate])).toEqual([
      ["Call the client", "2026-11-12", 3],
      ["Send the offer", undefined, 5],
    ]);
    expect(table!.read("No table here")).toBeUndefined();
    // A table under a heading; two columns of one label, one of none, each a key of its own; an empty name Untitled as made
    const under = table!.read("# Plan\n\n| Name | Due | due | |\n|---|---|---|---|\n| | 2026-11-12 | x | 3 |\n")!;
    expect(under.properties.map((one) => [one.key, one.label])).toEqual([
      ["due", "Due"],
      ["due_2", "due"],
      ["property", "property"],
    ]);
    expect(under.items[0]).toEqual({ name: "", values: { due: "2026-11-12", due_2: "x", property: 3 } });
  });

  it("define a view that lists the items and edits a value in place", async () => {
    const [names] = example("Library/me/views.js", VIEW_HELPERS) as ViewDefinition[];
    expect(validateView(names!)).toBeUndefined();
    const store = new MemoryStore([
      {
        database: { id: "tasks", name: "Tasks", properties: [{ key: "status", label: "Status", type: "select", params: { options: ["Todo", "Done"] }, readonly: false }] },
        items: [{ name: "Fix login", values: { status: "Todo" }, rank: "a0" }],
      },
    ]);
    const types = new TypeRegistry();
    const core = new DatabaseCore(store, types, { notify: () => {}, ask: () => true });
    const element = document.createElement("div");
    document.body.append(element);
    const place = new DatabasePlace({ element, database: "tasks", state: new MemoryViewState({ [VIEW_KEY]: "names" }), store, core, types, views: new ViewRegistry([...BUILT_IN_VIEWS, names!]), settings: { get: (_path, fallback) => fallback }, ui: { notify: () => {} } });
    await place.render();
    const line = [...element.querySelectorAll("div")].find((one) => one.textContent?.startsWith("Fix login"))!;
    expect(line.textContent).toBe("Fix login Todo");
    const status = line.querySelector("span")!;
    status.click();
    // (A click in the editor open, its handler again: the same editor, the choice made in it kept)
    line.querySelector("select")!.value = "Done";
    status.click();
    const select = line.querySelector("select")!;
    expect(select.value).toBe("Done");
    select.value = "Done";
    select.dispatchEvent(new Event("change"));
    await settle();
    expect((await store.items("tasks")).value[0]!.values.status).toBe("Done");
    element.remove();
  });
});
