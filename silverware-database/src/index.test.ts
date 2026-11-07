// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ViewDefinition } from "./core/view.ts";
import { type Bridge, defineViews, init, render, resetDefinitions } from "./index.ts";
import { memoryPages } from "./store/pages/testing.ts";

const ROOT = "---\ntags: [db-root]\n_database:\n  id: tasks\n  name: Tasks\n  format: 1\n  properties: {}\n---\n";
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

/** Two views, "a" and "b": the place's switcher picks one */
const VIEWS: ViewDefinition[] = ["a", "b"].map((name) => ({ name, label: name, icon: name, render: (_host, element) => void element.replaceChildren(name) }));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

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
    second.querySelector<HTMLButtonElement>('[data-view="b"]')!.click();
    await settle();
    expect(memory.pages.get("Page")).toBe("```silverware-database\nid: tasks\n```\n\nmiddle\n\n```silverware-database\nid: tasks\nview: b\n```\n");
    // One of two blocks alike out of view (CodeMirror keeps it out of the page): which is which cannot be told, nothing written
    memory.pages.set("Page", TWICE);
    const lone = render("id: tasks", "Page");
    document.body.replaceChildren(lone);
    await settle();
    lone.querySelector<HTMLButtonElement>('[data-view="b"]')!.click();
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
    element.querySelector<HTMLButtonElement>('[data-view="b"]')!.click();
    await settle();
    expect(memory.pages.get("Page")).toBe("```silverware-database\nid: tasks\nview: b\n```\n");
  });
});