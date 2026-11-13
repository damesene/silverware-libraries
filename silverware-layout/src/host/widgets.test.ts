// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Registry } from "../core/registry.ts";
import type { PageHost } from "./page.ts";
import { Widgets } from "./widgets.ts";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A page of no host's: its content the element of class `content` */
const page: PageHost = {
  content: () => document.querySelector<HTMLElement>(".content") ?? undefined,
  editor: () => undefined,
  pane: () => document.body,
  view: () => ({ top: 0, bottom: 800 }),
  guideLayer: () => undefined,
  showTextWidth: () => undefined,
  themeTextWidth: () => 0,
};

describe("Widgets", () => {
  it("reads what a widget keeps once for a batch of changes, however many of its nodes came in it", async () => {
    document.body.innerHTML = `<div class="content"><div class="line"><div class="w" data-key="a"></div></div></div>`;
    const reads: string[] = [];
    const registry = new Registry(() => undefined);
    registry.register({
      name: "test",
      selector: ".w",
      read: (element) => {
        reads.push((element as HTMLElement).dataset.key!);
        return { width: "1000" };
      },
      write: async () => undefined,
    });
    new Widgets(document, page, registry, () => undefined).start();
    expect(reads).toEqual(["a"]);
    reads.length = 0;

    // A view drawn a row at a time into one widget, a second widget added in the same batch
    const widget = document.querySelector(".w")!;
    for (let i = 0; i < 100; i++) widget.append(document.createElement("div"));
    const other = document.createElement("div");
    other.className = "w";
    other.dataset.key = "b";
    document.querySelector(".line")!.append(other);
    await flush();
    expect(reads.sort()).toEqual(["a", "b"]);
    expect(other.getAttribute("data-swl-width")).toBe("1000");
  });

  it("takes the width off an element its provider no longer takes, as everything is laid out again", () => {
    document.body.innerHTML = `<div class="content"><div class="w" data-view="embed"></div></div>`;
    const registry = new Registry(() => undefined);
    registry.register({ name: "test", selector: '.w:not([data-view="card"])', read: () => ({ width: "300" }), write: async () => undefined, anchor: () => "start" });
    const widgets = new Widgets(document, page, registry, () => undefined);
    widgets.start();
    const element = document.querySelector<HTMLElement>(".w")!;
    expect(element.getAttribute("data-swl-width")).toBe("300");
    expect(element.hasAttribute("data-swl-anchor-start")).toBe(true);
    // (Shown another way by its plugin, which its selector leaves out, then laid out again on its word)
    element.dataset.view = "card";
    widgets.layOutAll();
    expect(element.hasAttribute("data-swl-width")).toBe(false);
    expect(element.style.getPropertyValue("--swl-width")).toBe("");
    expect(element.hasAttribute("data-swl-anchor-start")).toBe(false);
  });

  it("finds the innermost widget a node is in, and marks one its provider lays out in a room of its own", async () => {
    document.body.innerHTML = `<div class="content"><div class="outer"><div class="room"><span class="inner"><img></span></div></div></div>`;
    const registry = new Registry(() => undefined);
    registry.register({ name: "outer", selector: ".outer", read: () => ({}), write: async () => undefined });
    registry.register({ name: "inner", selector: ".inner", read: () => ({ width: "120" }), write: async () => undefined, room: (element) => element.closest(".room") ?? undefined });
    const widgets = new Widgets(document, page, registry, () => undefined);
    widgets.start();
    const found = widgets.widgetAt(document.querySelector("img")!);
    expect(found?.provider.name).toBe("inner");
    expect(widgets.room(found!)).toBe(document.querySelector(".room"));
    expect(document.querySelector(".inner")!.hasAttribute("data-swl-in-room")).toBe(true);
    expect(document.querySelector(".outer")!.hasAttribute("data-swl-in-room")).toBe(false);
    expect(widgets.widgetAt(document.querySelector(".room")!)?.provider.name).toBe("outer");
  });
});

