// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewDefinition } from "./core/view.ts";
import type { Bridge } from "./index.ts";
import { memoryPages } from "./store/pages/testing.ts";

const ROOT = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  version: 1\n  properties: {}\n---\n";
const TWICE = "```silverware-database\nid: tasks\n```\n\nmiddle\n\n```silverware-database\nid: tasks\n```\n";

/** SilverBullet's API over a space of pages in memory, `open` the page in its editor */
function bridgeOf(pages: Record<string, string>, open: string) {
  const memory = memoryPages(pages, { open });
  const { editor, space, index } = memory.platform;
  const told: string[] = [];
  const bridge: Bridge = {
    getCurrentPage: async () => String(await editor.documentName()),
    getText: async () => String(await editor.text()),
    replaceRange: async (from, to, text) => void (await editor.replace(from, to, text)),
    insertAtCursor: async () => {},
    navigate: async () => {},
    readPage: async (name) => String(await space.read(name)),
    writePage: async (name, text) => void (await space.write(name, text)),
    deletePage: async (name) => void (await space.remove!(name)),
    listPages: async () => [...(await space.list())],
    renamePage: async (from, to) => space.rename!(from, to),
    renamePrefix: async () => {},
    queryTag: async (tag) => [...(await index.objects(tag))],
    flash: (message) => void told.push(message),
    confirm: async () => true,
    prompt: async () => undefined,
    getConfig: async (_path, fallback) => fallback,
  };
  return { memory, bridge, told };
}

/** A view picked in a place: its picker's menu opened, the item of that label pressed */
function pickView(root: ParentNode, label: string): void {
  root.querySelector<HTMLButtonElement>(".swd-view-picker")!.click();
  [...root.querySelectorAll<HTMLElement>(".swd-menu .swd-menu-item")].find((item) => item.querySelector(".swd-label")?.textContent === label)!.click();
}
/** Two views, "a" and "b": the place's picker picks one */
const VIEWS: ViewDefinition[] = ["a", "b"].map((name) => ({ name, label: name, icon: name, render: (_host, element) => void element.replaceChildren(name) }));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

// A module of its own for each test: what Silverware Database keeps across loads of Space Lua (its core, its history) is the
// module's, and each test has a space of its own
let defineViews: typeof import("./index.ts").defineViews;
let defineConverters: typeof import("./index.ts").defineConverters;
let init: typeof import("./index.ts").init;
let render: typeof import("./index.ts").render;
let resetDefinitions: typeof import("./index.ts").resetDefinitions;
let runCommand: typeof import("./index.ts").runCommand;
beforeEach(async () => {
  vi.resetModules();
  ({ defineConverters, defineViews, init, render, resetDefinitions, runCommand } = await import("./index.ts"));
});

afterEach(() => {
  vi.useRealTimers();
  resetDefinitions();
  document.body.replaceChildren();
});

describe("Silverware Database in SilverBullet", () => {
  it("writes a view picked into the block it was picked in, and nothing where a block alike is out of view", async () => {
    const { memory, bridge, told } = bridgeOf({ Page: TWICE, "Page/db-tasks": ROOT }, "Page");
    init(bridge);
    defineViews(VIEWS);
    const [first, second] = [render("id: tasks", "Page"), render("id: tasks", "Page")];
    document.body.append(first, second);
    await settle();
    pickView(second, "b");
    await settle();
    expect(memory.pages.get("Page")).toBe("```silverware-database\nid: tasks\n```\n\nmiddle\n\n```silverware-database\nid: tasks\nview: b\n```\n");
    // One of two blocks alike out of view (CodeMirror keeps it out of the page): which is which cannot be told, nothing written
    memory.pages.set("Page", TWICE);
    const lone = render("id: tasks", "Page");
    document.body.replaceChildren(lone);
    await settle();
    pickView(lone, "b");
    await settle();
    expect(memory.pages.get("Page")).toBe(TWICE);
    expect(told.some((one) => one.includes("out of view"))).toBe(true);
  });

  it("lets the places and the tidying of before go as it starts again (Space Lua loaded again)", () => {
    vi.useFakeTimers();
    const { bridge } = bridgeOf({}, "Page");
    init(bridge);
    init(bridge);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("says a view that cannot be one once, not again with the definitions after it", () => {
    const { bridge } = bridgeOf({}, "Page");
    init(bridge);
    expect(defineViews([{ name: "Bad" } as unknown as ViewDefinition])).toContain("Bad");
    expect(defineViews(VIEWS)).toBeUndefined();
  });

  it("says a view defined twice in one call once", () => {
    const { bridge } = bridgeOf({}, "Page");
    init(bridge);
    expect(defineViews([...VIEWS, VIEWS[0]!])).toContain("defined twice");
    expect(defineViews([{ ...VIEWS[0]!, name: "c" }])).toBeUndefined();
  });

  it("says what of the converters defined cannot be one, the definitions a list or a function giving one", () => {
    const tasks = { name: "tasks", label: "Tasks", read: () => undefined };
    expect(defineConverters([tasks, { name: "Bad" }])).toContain(`"Bad" is no converter's name`);
    expect(defineConverters(() => [tasks])).toBeUndefined();
    expect(defineConverters("nope")).toBe("Silverware Database: definitions are a list, or a function giving one");
  });

  it("takes the blocks shown over as it starts again, drawn and written as before", async () => {
    const { memory, bridge } = bridgeOf({ Page: "```silverware-database\nid: tasks\n```\n", "Page/db-tasks": ROOT }, "Page");
    init(bridge);
    defineViews(VIEWS);
    const element = render("id: tasks", "Page");
    document.body.append(element);
    await settle();
    init(bridge);
    await settle();
    expect(element.querySelector("[inert]")).toBeNull();
    pickView(element, "b");
    await settle();
    expect(memory.pages.get("Page")).toBe("```silverware-database\nid: tasks\nview: b\n```\n");
  });

  it("writes a database picked at the cursor, or makes a new one first in the list (Insert database, /database)", async () => {
    const { memory, bridge } = bridgeOf({ Page: "", "Page/db-tasks": ROOT }, "Page");
    const inserted: string[] = [];
    const offered: string[][] = [];
    let pick: string | undefined;
    init({
      ...bridge,
      insertAtCursor: async (text) => void inserted.push(text),
      prompt: async () => "Ideas",
      filterBox: async (_label, options) => {
        offered.push(options.map((one) => one.name));
        return options.find((one) => one.name === pick);
      },
    });
    pick = "Tasks";
    await runCommand("Silverware Database: Insert database");
    expect(offered[0]).toEqual(["New database…", "Tasks"]);
    expect(inserted).toEqual(["\n```silverware-database\nid: tasks\n```\n"]);
    pick = undefined;
    await runCommand("Silverware Database: Insert database");
    expect(inserted).toHaveLength(1);
    pick = "New database…";
    await runCommand("Silverware Database: Insert database");
    expect(memory.pages.has("Page/db-ideas")).toBe(true);
    expect(inserted[1]).toBe("\n```silverware-database\nid: ideas\n```\n");
  });

  it("converts the lines selected into a new database, its block under them, the lines still selected", async () => {
    const text = "Intro\n- [ ] Call @ada [due: 2026-11-12]\n  - [ ] sub\n- [x] Done #sales\nAfter\n";
    const { memory, bridge } = bridgeOf({ Page: text }, "Page");
    let selection = { from: text.indexOf("Call"), to: text.indexOf("#sales") };
    init({ ...bridge, prompt: async () => "Calls", getSelection: async () => selection, setSelection: async (from, to) => void (selection = { from, to }) });
    await runCommand("Silverware Database: Convert selection to database");
    const page = memory.pages.get("Page")!;
    const lines = "- [ ] Call @ada [due: 2026-11-12]\n  - [ ] sub\n- [x] Done #sales\n";
    // (Shown first as the converter asks: a board by Status)
    expect(page).toBe(`Intro\n${lines}\n\`\`\`silverware-database\nid: calls\nview: board\nboard.groupBy: status\n\`\`\`\nAfter\n`);
    expect(page.slice(selection.from, selection.to)).toBe(lines);
    expect(memory.pages.get("Page/db-calls/Call")).toContain("- [ ] sub");
    expect(memory.pages.get("Page/db-calls/Done")).toMatch(/^---\ntags: \[db, sales\]/);
  });

  it("writes no view the converter asks for where it is turned off: the place shows the first one on", async () => {
    const text = "- [ ] One\n";
    const { memory, bridge } = bridgeOf({ Page: text }, "Page");
    const getConfig = async (path: string, fallback: unknown) => (path === "silverware.database.views.board.enabled" ? false : fallback);
    init({ ...bridge, getConfig, prompt: async () => "One", getSelection: async () => ({ from: 0, to: 0 }), setSelection: async () => {} });
    await runCommand("Silverware Database: Convert selection to database");
    expect(memory.pages.get("Page")).toBe("- [ ] One\n\n```silverware-database\nid: one\n```\n");
  });

  it("converts the cursor's line with those under it, and says where nothing is to convert", async () => {
    const text = "- [ ] One\n  more\n- [ ] Two";
    const { memory, bridge, told } = bridgeOf({ Page: text, Other: "plain text" }, "Page");
    init({ ...bridge, prompt: async () => "One", getSelection: async () => ({ from: 3, to: 3 }), setSelection: async () => {} });
    await runCommand("Silverware Database: Convert selection to database");
    expect([...memory.pages.keys()].filter((name) => name.startsWith("Page/db-one/"))).toEqual(["Page/db-one/One"]);
    init({ ...bridge, getText: async () => "plain text", getSelection: async () => ({ from: 0, to: 5 }), setSelection: async () => {} });
    await runCommand("Silverware Database: Convert selection to database");
    expect(told.at(-1)).toContain("nothing here to convert");
  });

  it("keeps a change undoable as Space Lua loads again (a setting saved), its bridge a new one", async () => {
    const { memory, bridge } = bridgeOf({ Page: "text\n" }, "Page");
    init({ ...bridge, prompt: async () => "Ideas" });
    await runCommand("Silverware Database: New database");
    expect(memory.pages.has("Page/db-ideas")).toBe(true);
    init({ ...bridge });
    await runCommand("Silverware Database: Undo");
    expect(memory.pages.has("Page/db-ideas")).toBe(false);
  });
});
