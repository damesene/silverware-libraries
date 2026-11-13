// @vitest-environment jsdom
// A grid in an embedded page as SilverBullet 2.12.1 shows it (probed 2026-11-13: the page's markdown in
// `.sb-inline-content`, the grid's lines as text with a <br> between each): found and drawn in its place.
import { afterEach, describe, expect, it, vi } from "vitest";
import { watchEmbeddedGrids } from "./embeddedgrids.ts";

const EMBEDDED =
  '<span class="wrapper"><h1>Embedded</h1><br>&lt;grid columns="1fr 3fr"&gt;<br>&lt;column&gt;<br><br>**Own** A<br><br>&lt;/column&gt;<br>&lt;column&gt;<br><br>Own B<br><br>&lt;/column&gt;<br>&lt;/grid&gt;<br>After</span>';

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.body.replaceChildren();
});

describe("a grid in an embedded page", () => {
  it("is found as its text and drawn in its place, the rest of the page left", async () => {
    const texts: string[] = [];
    stops.push(
      watchEmbeddedGrids(document, async (text) => {
        texts.push(text);
        return Object.assign(document.createElement("div"), { className: "swl-grid", textContent: "drawn" });
      }),
    );
    const frame = Object.assign(document.createElement("div"), { className: "sb-inline-content", innerHTML: EMBEDDED });
    document.body.append(frame);
    await vi.waitFor(() => expect(frame.querySelector(".swl-grid")).not.toBeNull());
    expect(texts).toEqual(['<grid columns="1fr 3fr">\n<column>\n\n**Own** A\n\n</column>\n<column>\n\nOwn B\n\n</column>\n</grid>']);
    expect(frame.querySelector(".wrapper")!.textContent).toBe("EmbeddeddrawnAfter");
  });

  it("is left as its text where it is not closed, or not drawn", async () => {
    stops.push(watchEmbeddedGrids(document, async () => undefined));
    const frame = Object.assign(document.createElement("div"), { className: "sb-inline-content", innerHTML: EMBEDDED });
    const open = Object.assign(document.createElement("div"), { className: "sb-inline-content", innerHTML: "&lt;grid&gt;<br>text" });
    document.body.append(frame, open);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(frame.textContent).toContain("<grid columns");
    expect(open.textContent).toBe("<grid>text");
  });
});
