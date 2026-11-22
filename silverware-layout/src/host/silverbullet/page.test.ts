import { describe, expect, it } from "vitest";
import type { Platform } from "../../../../shared/platform.ts";
import { pageWriter } from "../../../../shared/pages/writer.ts";
import { type PageTextLayout, pageLayoutOf, writePageLayout } from "./page.ts";

/** A page open in an editor of memory, as the page writer writes it (through the editor) */
function openPage(name: string, text: string) {
  const page = { text };
  const platform: Pick<Platform, "editor" | "space"> = {
    editor: {
      documentName: () => name,
      text: () => page.text,
      replace: (from, to, insert) => {
        page.text = page.text.slice(0, from) + insert + page.text.slice(to);
      },
    },
    space: {
      read: () => page.text,
      write: (_, written) => {
        page.text = written;
      },
      list: () => [name],
    },
  };
  const layout = (written: PageTextLayout) => writePageLayout(pageWriter(platform), name, page.text, written);
  return { page, layout, write: (width: PageTextLayout["width"]) => layout({ width, align: pageLayoutOf(page.text).align }) };
}

describe("A page's layout in its frontmatter", () => {
  it("its text width read from _layout.width: pixels a number, percent a text", () => {
    expect(pageLayoutOf("---\n_layout:\n  width: 1100\n---\n# Page\n")).toEqual({ width: { amount: 1100, unit: "px" }, align: undefined, more: false });
    expect(pageLayoutOf('---\n_layout:\n  width: "90%"\n  other: 1\n---\n')).toEqual({ width: { amount: 90, unit: "%" }, align: undefined, more: true });
  });

  it("none without a frontmatter, without _layout, with a width not read, or a frontmatter not read", () => {
    for (const text of ["# Page\n", "---\ntags: a\n---\n", "---\n_layout: wide\n---\n", "---\n_layout:\n  width: wide\n---\n", "---\n_layout: [\n---\n"]) {
      expect(pageLayoutOf(text).width, text).toBeUndefined();
    }
  });

  it("written into the frontmatter, made where the page has none", async () => {
    const one = openPage("Page", "# Page\n");
    expect(await one.write({ amount: 1100, unit: "px" })).toBeUndefined();
    expect(one.page.text).toBe("---\n_layout:\n  width: 1100\n---\n# Page\n");
    expect(await one.write({ amount: 90, unit: "%" })).toBeUndefined();
    expect(pageLayoutOf(one.page.text).width).toEqual({ amount: 90, unit: "%" });
  });

  it("taken off with _layout where it held nothing else, the other keys kept", async () => {
    const alone = openPage("Page", "---\ntags: a\n_layout:\n  width: 1100\n---\n# Page\n");
    await alone.write(undefined);
    expect(alone.page.text).toBe("---\ntags: a\n---\n# Page\n");
    const more = openPage("Page", "---\n_layout:\n  width: 1100\n  other: 1\n---\n# Page\n");
    await more.write(undefined);
    expect(more.page.text).toBe("---\n_layout:\n  other: 1\n---\n# Page\n");
  });

  it("its text's alignment read from _layout.align, beside the width; one not read none", () => {
    expect(pageLayoutOf("---\n_layout:\n  width: 1100\n  align: left-with-panel\n---\n")).toEqual({ width: { amount: 1100, unit: "px" }, align: "left-with-panel", more: false });
    expect(pageLayoutOf("---\n_layout:\n  align: right\n---\n").align).toBeUndefined();
  });

  it("width and alignment written in one edit; each taken off alone, _layout with the last", async () => {
    const one = openPage("Page", "---\ntags: a\n---\n# Page\n");
    expect(await one.layout({ width: { amount: 1100, unit: "px" }, align: "left" })).toBeUndefined();
    expect(one.page.text).toBe("---\ntags: a\n_layout:\n  width: 1100\n  align: left\n---\n# Page\n");
    await one.layout({ width: undefined, align: "left" });
    expect(one.page.text).toBe("---\ntags: a\n_layout:\n  align: left\n---\n# Page\n");
    await one.layout({ width: undefined, align: undefined });
    expect(one.page.text).toBe("---\ntags: a\n---\n# Page\n");
  });

  it("an alignment it does not read (typed by hand) kept as the rest of _layout: a width written beside it, none taken off", async () => {
    const one = openPage("Page", "---\n_layout:\n  align: right\n---\n# Page\n");
    expect(pageLayoutOf(one.page.text)).toEqual({ width: undefined, align: undefined, more: true });
    await one.layout({ width: { amount: 1100, unit: "px" }, align: undefined });
    expect(one.page.text).toBe("---\n_layout:\n  align: right\n  width: 1100\n---\n# Page\n");
    await one.layout({ width: undefined, align: undefined });
    expect(one.page.text).toBe("---\n_layout:\n  align: right\n---\n# Page\n");
  });
});
