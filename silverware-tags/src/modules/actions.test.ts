import { describe, expect, it } from "vitest";
import { readCatalog } from "../core/catalog.ts";
import type { ModuleHost, TagAction, WorkspaceHost } from "../core/module.ts";
import { memorySpace } from "../space/memory.ts";
import { pagesModule } from "./pages.ts";
import { removeModule } from "./remove.ts";

const space = memorySpace({ A: "#todo\n\n- [ ] do #todo/later", B: "- item #todo" });
const moduleHost = { space, catalog: () => readCatalog(space) } as unknown as ModuleHost;

async function windowHost() {
  const shown: unknown[] = [];
  const host = { catalog: await readCatalog(space), show: (view: string, state?: unknown) => void shown.push([view, state]) } as unknown as WorkspaceHost;
  return { host, shown };
}

const actionsOf = (actions: readonly TagAction[] | undefined) => Object.fromEntries((actions ?? []).map((a) => [a.id, a]));

describe("the built-in modules' actions on a tag, as data", () => {
  it("Delete gives its operation to review, its subtags offered", async () => {
    const { host } = await windowHost();
    const remove = actionsOf(removeModule(moduleHost).tagActions?.()).remove!;
    expect(remove.danger).toBe(true);
    const operation = await remove.run("todo", host);
    expect(operation && operation.label).toBe("Delete #todo");
    expect(operation && operation.option?.label).toBe("Its subtags too (1)");
  });
  it("Add to pages and Remove from pages show the view by page; Remove only for a page's own tag", async () => {
    const { host, shown } = await windowHost();
    const actions = actionsOf(pagesModule(moduleHost).tagActions?.());
    expect(actions["pages.remove"]!.when!("todo", host.catalog)).toBe(true);
    expect(actions["pages.remove"]!.when!("todo/later", host.catalog)).toBe(false);
    await actions["pages.add"]!.run("todo", host);
    await actions["pages.remove"]!.run("todo", host);
    expect(shown).toEqual([
      ["pages", { add: ["todo"] }],
      ["pages", { checked: ["A"], remove: ["todo"] }],
    ]);
  });
});
