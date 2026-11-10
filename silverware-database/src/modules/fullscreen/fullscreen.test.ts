// @vitest-environment jsdom
import { iconsOf } from "../../../../shared/icons.ts";
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseCore } from "../../core/core.ts";
import { documentsHost } from "../../core/documents.ts";
import { Modules } from "../../core/module.ts";
import { DatabasePlace, VIEW_KEY } from "../../core/place.ts";
import { ViewRegistry } from "../../core/views.ts";
import { DOCUMENT } from "../../domain/noun.ts";
import { TypeRegistry } from "../../domain/types/registry.ts";
import type { Database } from "../../model/database.ts";
import { MemoryStore } from "../../store/memory.ts";
import { MemoryViewState } from "../../store/viewstate.ts";
import { BUILT_IN_VIEWS } from "../../views/builtin/index.ts";
import { FULLSCREEN_MODULE } from "./index.ts";

const TASKS: Database = { id: "tasks", name: "Tasks", properties: [{ key: "status", label: "Status", type: "text", params: {}, readonly: false }] };

async function setup(on = true) {
  const store = new MemoryStore([{ database: TASKS, items: [{ name: "Fix login", values: { status: "Todo" }, rank: "a0" }] }]);
  const types = new TypeRegistry();
  const ui = { notify: () => {}, ask: () => true };
  const core = new DatabaseCore(store, types, ui);
  const modules = new Modules(
    on ? [FULLSCREEN_MODULE] : [],
    {
      document,
      icons: iconsOf(undefined),
      core,
      types,
      ui,
      database: (id) => store.database(id),
      items: async (id) => (await store.items(id)).value,
      itemBodies: false,
      body: async () => undefined,
      openDocument: async () => {},
      ...documentsHost(undefined, DOCUMENT, ui),
      editorArea: () => undefined,
      onChanged: () => () => {},
      onDocumentOpened: () => () => {},
      refreshPlaces: () => {},
    },
    { get: (_path, fallback) => fallback },
  );
  await modules.start();
  const element = document.createElement("div");
  document.body.append(element);
  const place = new DatabasePlace({ element, database: "tasks", state: new MemoryViewState({ [VIEW_KEY]: "list" }), store, core, types, views: new ViewRegistry(BUILT_IN_VIEWS), settings: { get: (_path, fallback) => fallback }, ui, moduleTools: (where) => modules.placeTools(where) });
  await place.render();
  const tool = () => element.querySelector<HTMLButtonElement>('.swd-tool[data-tool="fullscreen"]');
  return { element, place, tool };
}

afterEach(() => document.body.replaceChildren());

describe("full screen", () => {
  it("shows a place over the window by its icon among the tools, the same icon or Esc putting it back", async () => {
    const { element, tool } = await setup();
    expect([tool()!.getAttribute("aria-pressed"), element.classList.contains("swd-over-window")]).toEqual(["false", false]);
    tool()!.click();
    await new Promise((resolve) => setTimeout(resolve));
    expect([tool()!.getAttribute("aria-pressed"), tool()!.title, element.classList.contains("swd-over-window"), document.activeElement === tool()]).toEqual(["true", "Exit full screen (Esc)", true, true]);
    tool()!.click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(element.classList.contains("swd-over-window")).toBe(false);
    tool()!.click();
    await new Promise((resolve) => setTimeout(resolve));
    tool()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve));
    expect(element.classList.contains("swd-over-window")).toBe(false);
  });

  it("ends with Esc from the page's body too (a press in its empty room), leaves its element as it was when gone, starts so where told", async () => {
    const { element, place, tool } = await setup();
    tool()!.click();
    await new Promise((resolve) => setTimeout(resolve));
    (document.activeElement as HTMLElement).blur();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve));
    expect(element.classList.contains("swd-over-window")).toBe(false);
    tool()!.click();
    await new Promise((resolve) => setTimeout(resolve));
    place.destroy();
    expect(element.classList.contains("swd-over-window")).toBe(false);
    // (Made over the window from its start: the place before it for the same block was)
    const store = new MemoryStore([{ database: TASKS, items: [] }]);
    const again = document.createElement("div");
    const made = new DatabasePlace({ element: again, database: "tasks", state: new MemoryViewState({}), store, core: new DatabaseCore(store, new TypeRegistry(), { notify: () => {}, ask: () => true }), types: new TypeRegistry(), views: new ViewRegistry(BUILT_IN_VIEWS), settings: { get: (_path, fallback) => fallback }, ui: { notify: () => {} }, overWindow: true });
    expect([again.classList.contains("swd-over-window"), made.isOverWindow]).toEqual([true, true]);
    made.destroy();
  });

  it("offers no icon where the module is off", async () => {
    const { tool } = await setup(false);
    expect(tool()).toBeNull();
  });
});
