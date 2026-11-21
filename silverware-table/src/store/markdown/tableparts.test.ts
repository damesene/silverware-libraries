import { afterEach, describe, expect, it } from "vitest";
import { pageChanges } from "../../../../shared/pages/changes.ts";
import { pageWriter } from "../../../../shared/pages/writer.ts";
import type { Editor, Space } from "../../../../shared/platform.ts";
import { luaCallPlaces } from "../../host/lua.ts";
import { findTables } from "../../markdown.ts";
import { defineFormulaPlaces, pageFormulasIn } from "./pageformulas.ts";
import { cursorPlace, removedSpan, tableAt } from "./tableparts.ts";

/** Pages in memory, `open` the one in the editor; the writer over them */
function pages(texts: Record<string, string>, open?: string) {
  const map = new Map(Object.entries(texts));
  const editor: Editor = {
    documentName: () => open ?? "",
    text: () => map.get(open!) ?? "",
    replace: (from, to, insert) => {
      const text = map.get(open!) ?? "";
      map.set(open!, text.slice(0, from) + insert + text.slice(to));
    },
  };
  const space: Space = {
    read: (name) => {
      const text = map.get(name);
      if (text === undefined) throw new Error(`no page ${name}`);
      return text;
    },
    write: (name, text) => void map.set(name, text),
    list: () => [...map.keys()],
  };
  return { map, writer: pageWriter({ editor, space }) };
}

const TWO = "# Shop\n\n| A |\n|---|\n| 1 |\n\nText.\n\n| A |\n|---|\n| 1 |\n";
const NEW = "| B |\n|---|\n| x |";
const at = (text: string, ordinal: number) => tableAt(text, findTables(text)[ordinal]!);

describe("the markdown store's parts of the page writer", () => {
  afterEach(() => defineFormulaPlaces(undefined));

  it("writes a table found by its text and its order among those alike, and refuses one changed since", async () => {
    const { map, writer } = pages({ Shop: TWO });
    const second = at(TWO, 1);
    expect(second).toEqual({ source: "| A |\n|---|\n| 1 |", occurrence: 1, of: 2 });
    await writer.write(pageChanges().page("Shop", (p) => p.tables.write([{ ...second, markdown: "| A |\n|---|\n| 2 |" }])).build());
    expect(map.get("Shop")).toBe("# Shop\n\n| A |\n|---|\n| 1 |\n\nText.\n\n| A |\n|---|\n| 2 |\n");
    // The first one alike no more: changed since it was read
    const report = await writer.write(pageChanges().page("Shop", (p) => p.tables.write([{ ...second, markdown: "| A |\n|---|\n| 3 |" }])).build());
    expect(report.skipped.map((one) => [one.cause, one.reason])).toEqual([["refused", "a table changed since it was read"]]);
  });

  it("writes tables alike in one change, each the one it was as read", async () => {
    const { map, writer } = pages({ Shop: TWO });
    await writer.write(
      pageChanges()
        .page("Shop", (p) => p.tables.write([{ ...at(TWO, 0), markdown: "| A |\n|---|\n| 2 |" }, { ...at(TWO, 1), markdown: "| A |\n|---|\n| 3 |" }]))
        .build(),
    );
    expect(map.get("Shop")).toBe("# Shop\n\n| A |\n|---|\n| 2 |\n\nText.\n\n| A |\n|---|\n| 3 |\n");
  });

  it("puts a new table after a table, where the cursor was, or at the page's end, an empty line around it", async () => {
    const { map, writer } = pages({ Shop: TWO });
    await writer.write(pageChanges().page("Shop", (p) => p.tables.write([], { markdown: NEW, place: { after: at(TWO, 0) } })).build());
    expect(map.get("Shop")).toBe(`# Shop\n\n| A |\n|---|\n| 1 |\n\n${NEW}\n\nText.\n\n| A |\n|---|\n| 1 |\n`);
    // After a table written in the same change: after it as written
    const both = pages({ Shop: TWO });
    await both.writer.write(pageChanges().page("Shop", (p) => p.tables.write([{ ...at(TWO, 0), markdown: "| A |\n|---|\n| 9 |" }], { markdown: NEW, place: { after: at(TWO, 0) } })).build());
    expect(both.map.get("Shop")).toBe(`# Shop\n\n| A |\n|---|\n| 9 |\n\n${NEW}\n\nText.\n\n| A |\n|---|\n| 1 |\n`);
    const cursor = cursorPlace(TWO, 3);
    const page = pages({ Shop: TWO });
    await page.writer.write(pageChanges().page("Shop", (p) => p.tables.write([], { markdown: NEW, place: cursor })).build());
    expect(page.map.get("Shop")).toBe(`# Shop\n\n${NEW}\n\n| A |\n|---|\n| 1 |\n\nText.\n\n| A |\n|---|\n| 1 |\n`);
    // The cursor's line changed since: refused
    const moved = pages({ Shop: `# Shop!\n${TWO.slice(7)}` });
    expect((await moved.writer.write(pageChanges().page("Shop", (p) => p.tables.write([], { markdown: NEW, place: cursor })).build())).skipped).toHaveLength(1);
    const end = pages({ Shop: "Text." });
    await end.writer.write(pageChanges().page("Shop", (p) => p.tables.write([], { markdown: NEW })).build());
    expect(end.map.get("Shop")).toBe(`Text.\n\n${NEW}`);
  });

  it("takes a table out with the empty line after it, the page's last with the one before", async () => {
    const { map, writer } = pages({ Shop: TWO });
    await writer.write(pageChanges().page("Shop", (p) => p.tables.write([{ ...at(TWO, 0), markdown: undefined }])).build());
    expect(map.get("Shop")).toBe("# Shop\n\nText.\n\n| A |\n|---|\n| 1 |\n");
    const last = pages({ Shop: TWO });
    await last.writer.write(pageChanges().page("Shop", (p) => p.tables.write([{ ...at(TWO, 1), markdown: undefined }])).build());
    expect(last.map.get("Shop")).toBe("# Shop\n\n| A |\n|---|\n| 1 |\n\nText.\n");
    const range = findTables(TWO)[0]!;
    const span = removedSpan(TWO, range);
    expect(TWO.slice(0, span.from) + TWO.slice(span.to)).toBe("# Shop\n\nText.\n\n| A |\n|---|\n| 1 |\n");
  });

  it("writes a page formula by its key", async () => {
    defineFormulaPlaces(luaCallPlaces("te"));
    const TEXT = `${TWO}\nTotal: \${te("=SUM(prices![price])")}\n`;
    const { map, writer } = pages({ Shop: TEXT });
    const [formula] = pageFormulasIn("Shop", TEXT);
    await writer.write(pageChanges().page("Shop", (p) => p.tables.setPageFormula("Shop", { key: formula!.key, text: "=SUM(costs![price])" })).build());
    expect(map.get("Shop")).toContain(`\${te("=SUM(costs![price])")}`);
  });

  it("finds its table again on the open page changed since it was read, the write planned anew", async () => {
    const { map, writer } = pages({ Shop: TWO }, "Shop");
    const plan = await writer.plan(pageChanges().page("Shop", (p) => p.tables.write([{ ...at(TWO, 1), markdown: "| A |\n|---|\n| 2 |" }])).build(), { replanOpenPage: true });
    map.set("Shop", `Typed meanwhile.\n${TWO}`);
    expect((await writer.apply(plan)).written).toHaveLength(1);
    expect(map.get("Shop")).toBe("Typed meanwhile.\n# Shop\n\n| A |\n|---|\n| 1 |\n\nText.\n\n| A |\n|---|\n| 2 |\n");
  });
});
