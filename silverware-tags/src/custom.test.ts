import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readCatalog } from "./core/catalog.ts";
import type { WorkspaceHost } from "./core/module.ts";
import type { Operation } from "./core/operation.ts";
import { applyPlan, makePlan } from "./core/plan.ts";
import { customActions, customOperationsAnew, defineCustomOperations, HELPERS, operationsOf, resetCustomOperations } from "./custom.ts";
import { defineOperations } from "./index.ts";
import { memorySpace } from "./space/memory.ts";

afterEach(() => resetCustomOperations());

const space = () => memorySpace({ A: "#Todo\n\n- [ ] do #Todo", B: "- [ ] task #Todo", C: "#other" });

/** An action of a custom operation run on a tag as the window runs it: its operation, planned and applied */
async function runOn(id: string, tag: string, s = space()) {
  const catalog = await readCatalog(s);
  const action = customActions().find((a) => a.id === id)!;
  const operation = (await action.run(tag, { catalog } as unknown as WorkspaceHost)) as Operation;
  const plan = await makePlan(s, catalog, operation);
  await applyPlan(s, plan);
  return { s, plan, operation, offered: action.when?.(tag, catalog) ?? true };
}

describe("custom operations", () => {
  it("checks definitions: the others defined, what is wrong said", () => {
    const { operations, problems } = operationsOf([{ name: "ok", label: "OK", edit: () => undefined }, { name: "1bad", label: "x", edit: () => undefined }, { name: "noEdit", label: "x" }]);
    expect(operations.map((o) => o.name)).toEqual(["ok"]);
    expect(problems).toHaveLength(2);
    expect(defineOperations({ name: "x" })).toMatch(/not defined/);
  });
  it("runs as an action on a tag: its pages, its edit (async too), reviewed and applied", async () => {
    defineCustomOperations(operationsOf((helpers: typeof HELPERS) => [{ name: "lower", label: "Lower case", edit: async (text: string, _page: string, context: { tag: string }) => helpers.renameTags(text, (name) => (name === context.tag ? name.toLowerCase() : undefined)) }]).operations);
    const { s, plan, operation } = await runOn("custom.lower", "Todo");
    expect(operation.label).toBe("Lower case #Todo");
    expect(plan.changes.map((c) => c.page)).toEqual(["A", "B"]);
    expect(s.pages.get("A")).toBe("#todo\n\n- [ ] do #todo");
  });
  it("leaves a page its edit fails on, said in the review", async () => {
    defineCustomOperations(operationsOf([{ name: "fails", label: "Fails", edit: (_t: string, page: string) => { if (page === "A") throw new Error("no"); return "changed"; } }]).operations);
    const { plan } = await runOn("custom.fails", "Todo");
    expect(plan.changes.map((c) => c.page)).toEqual(["B"]);
    expect(plan.skipped[0]!.reason).toMatch(/fails: no/);
  });
  it("replaces the definitions of before once Space Lua loads again", () => {
    defineCustomOperations(operationsOf([{ name: "a", label: "A", edit: () => undefined }]).operations);
    customOperationsAnew();
    defineCustomOperations(operationsOf([{ name: "b", label: "B", edit: () => undefined }]).operations);
    expect(customActions().map((a) => a.id)).toEqual(["custom.b"]);
  });
  it("runs the library page's example", async () => {
    const page = readFileSync(join(import.meta.dirname, "..", "silverware-tags.md"), "utf8");
    const example = /## Custom operations[\s\S]*?```js\n([\s\S]*?)```/.exec(page)![1]!.replace("export default", "return");
    const definitions = new Function(example)() as unknown;
    defineCustomOperations(operationsOf(definitions).operations);
    const lower = await runOn("custom.lowerCase", "Todo");
    expect(lower.offered).toBe(true);
    expect(lower.s.pages.get("B")).toBe("- [ ] task #todo");
    const promoted = await runOn("custom.promote", "Todo");
    expect(promoted.plan.changes.map((c) => c.page)).toEqual(["B"]);
    expect(promoted.s.pages.get("B")).toBe("---\ntags: [Todo]\n---\n- [ ] task #Todo");
  });
});
