// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseTable, serializeTable, type Table } from "../markdown.ts";
import { tablesLayoutProvider } from "./layoutprovider.ts";

/** A table widget as SilverBullet renders one, its metadata row's <meta> with these attributes (none: no metadata row) */
function widget(attributes?: Record<string, string>): HTMLElement {
  const element = document.createElement("span");
  element.className = "sb-table-widget";
  const meta = attributes ? `<tr><td><meta core.table ${Object.entries(attributes).map(([name, value]) => `${name}="${value}"`).join(" ")}></td><td></td></tr>` : "";
  element.innerHTML = `<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr>${meta}</tbody></table>`;
  return element;
}

/** The provider over one table's markdown, written as the core writes it */
function provider(markdown: string, options: { metadataOn?: boolean; enhanced?: boolean } = {}) {
  const page = { text: markdown };
  const made = tablesLayoutProvider({
    renderedRows: (table) => Array.from(table.rows),
    enhanced: () => options.enhanced ?? true,
    write: async (_, change) => {
      const changed = change(parseTable(page.text));
      if (!changed) return "unchanged";
      page.text = serializeTable(changed as Table);
      return "written";
    },
    metadataOn: () => options.metadataOn ?? true,
  });
  return { made, page };
}

describe("Silverware Table's provider for Silverware Layout", () => {
  it("its widgets are SilverBullet's table widgets", () => {
    expect(provider("").made.selector).toBe(".sb-table-widget");
  });

  it("reads the layout owner's attributes from the table as rendered, without the owner, others left out", () => {
    const { made } = provider("");
    expect(made.read(widget({ "layout.width": "1200", "core.name": "Sales", "formulas.x": "1" }))).toEqual({ width: "1200" });
    expect(made.read(widget({ "core.name": "Sales" }))).toEqual({});
    expect(made.read(widget())).toEqual({});
  });

  it("writes them into the table's metadata (one write), and takes them off", async () => {
    const { made, page } = provider("| A | B |\n| --- | --- |\n| 1 | 2 |\n");
    expect(await made.write(widget(), { width: "1200" })).toBeUndefined();
    expect(page.text).toContain("layout.width='1200'");
    expect(await made.write(widget(), { width: null })).toBeUndefined();
    expect(page.text).not.toContain("layout.width");
  });

  it("with the metadata setting off stores nothing new, and says why; a width the table has may change", async () => {
    const off = provider("| A | B |\n| --- | --- |\n| 1 | 2 |\n", { metadataOn: false });
    expect(await off.made.write(widget(), { width: "1200" })).toBe("Silverware Table's metadata setting is off, so a table stores nothing new");
    expect(off.page.text).not.toContain("layout.width");
    const kept = provider("| A | B |\n| --- | --- |\n| 1 | 2 |\n", { metadataOn: true });
    await kept.made.write(widget(), { width: "1200" });
    const changed = provider(kept.page.text, { metadataOn: false });
    expect(await changed.made.write(widget(), { width: "900" })).toBeUndefined();
    expect(changed.page.text).toContain("layout.width='900'");
  });

  it("writes nothing for a table not enhanced yet", async () => {
    const { made, page } = provider("| A | B |\n| --- | --- |\n| 1 | 2 |\n", { enhanced: false });
    expect(await made.write(widget(), { width: "1200" })).toBe("the table is not ready yet");
    expect(page.text).not.toContain("layout");
  });
});
