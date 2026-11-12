// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Registry } from "../../core/registry.ts";
import { Widgets } from "./widgets.ts";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Widgets", () => {
  it("reads what a widget keeps once for a batch of changes, however many of its nodes came in it", async () => {
    document.body.innerHTML = `<div class="cm-content"><div class="cm-line"><div class="w" data-key="a"></div></div></div>`;
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
    new Widgets(document, registry, () => undefined).start();
    expect(reads).toEqual(["a"]);
    reads.length = 0;

    // A view drawn a row at a time into one widget, a second widget added in the same batch
    const widget = document.querySelector(".w")!;
    for (let i = 0; i < 100; i++) widget.append(document.createElement("div"));
    const other = document.createElement("div");
    other.className = "w";
    other.dataset.key = "b";
    document.querySelector(".cm-line")!.append(other);
    await flush();
    expect(reads.sort()).toEqual(["a", "b"]);
    expect(other.getAttribute("data-swl-width")).toBe("1000");
  });
});
