import { afterEach, describe, expect, it } from "vitest";
import { parseTable, serializeTable } from "../../markdown.ts";
import { TableRegister } from "../../core/tables.ts";
import type { TablePlatform } from "../../core/platform.ts";
import type { TableModel } from "../../model/model.ts";
import { storeContract, table } from "../contract.ts";
import { luaCallPlaces } from "../../host/silverbullet/lua.ts";
import { attributeIn, withAttributeIn } from "../../model/model.ts";
import { defineFormulaPlaces, pageFormulasIn } from "./pageformulas.ts";
import { type BeforeWrite, MarkdownStore } from "./store.ts";
import { addWriteListener, writeListenersAnew } from "./writelisteners.ts";
import { newTableMarkdown } from "./tableparts.ts";

/** A page's text of these tables, a line of text before each */
const textOf = (tables: readonly TableModel[]) => ["Intro.", ...tables.map((one) => newTableMarkdown(one, "", serializeTable))].join("\n\n") + "\n";

// Pages in memory, one of them open in the editor
function pagesOf(documents: Readonly<Record<string, readonly TableModel[]>>, open: string) {
  const pages = new Map(Object.entries(documents).map(([name, tables]) => [name, textOf(tables)]));
  const platform: Pick<TablePlatform, "editor" | "space"> = {
    editor: {
      documentName: () => open,
      text: () => pages.get(open) ?? "",
      replace: (from, to, insert) => {
        const text = pages.get(open) ?? "";
        pages.set(open, text.slice(0, from) + insert + text.slice(to));
      },
    },
    space: {
      read: (name) => {
        const text = pages.get(name);
        if (text === undefined) throw new Error(`no page ${name}`);
        return text;
      },
      write: (name, text) => void pages.set(name, text),
      list: () => [...pages.keys()],
    },
  };
  return { pages, platform };
}

const storeOf = (platform: Pick<TablePlatform, "editor" | "space">, beforeWrite?: BeforeWrite, register = new TableRegister()) =>
  new MarkdownStore(() => platform, register, async () => serializeTable, beforeWrite);

storeContract("markdown in pages, the open page's through the editor", (documents) => {
  const open = Object.keys(documents)[0] ?? "";
  const { pages, platform } = pagesOf(documents, open);
  const register = new TableRegister();
  return { store: storeOf(platform, undefined, register), replace: (document, tables) => void pages.set(document, textOf(tables)), reserve: (document) => register.reserve(document) };
});

storeContract("markdown in pages, none open: through the space", (documents) => {
  const { pages, platform } = pagesOf(documents, "");
  const register = new TableRegister();
  return { store: storeOf(platform, undefined, register), replace: (document, tables) => void pages.set(document, textOf(tables)), reserve: (document) => register.reserve(document) };
});

describe("the markdown store", () => {
  it("reads a page not open through the space, none where the platform reads no other page", async () => {
    const { platform } = pagesOf({ Open: [], Other: [table(["A"], ["1"])] }, "Open");
    expect(await storeOf(platform).tables("Other")).toHaveLength(1);
    const { space: _, ...editorOnly } = platform;
    expect(await storeOf(editorOnly).tables("Other")).toBeNull();
  });

  it("writes a transaction's tables as markdown, the rest of the page as it was", async () => {
    const { pages, platform } = pagesOf({ Shop: [table(["A"], ["1"]), table(["B"], ["2"])] }, "Shop");
    const store = storeOf(platform);
    const [first] = (await store.tables("Shop"))!;
    await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "write", key: first!.key, expects: first!.revision, model: table(["A"], ["one | two"]) }] }));
    expect(pages.get("Shop")).toBe("Intro.\n\n| A |\n|---|\n| one \\| two |\n\n| B |\n|---|\n| 2 |\n");
  });

  describe("a write's text apart from its tables", () => {
    afterEach(() => {
      // (No listener left for the next test: a new one replaces those of before)
      writeListenersAnew();
      addWriteListener(() => []);
    });

    it("writes the page formulas given with the tables, leaving one it cannot find, said why", async () => {
      defineFormulaPlaces(luaCallPlaces("te"));
      const { pages, platform } = pagesOf({ Shop: [table(["A"], ["1"])] }, "Shop");
      pages.set("Shop", `${pages.get("Shop")!}\nTotal: \${te("=SUM(a![A])")}\n`);
      const store = storeOf(platform);
      const [first] = (await store.tables("Shop"))!;
      const [formula] = pageFormulasIn("Shop", pages.get("Shop")!);
      const gone = { ...formula!, key: `${formula!.key}x` as NonNullable<typeof formula>["key"] };
      const plan = await store.plan({
        document: "Shop",
        edits: [{ kind: "write", key: first!.key, expects: first!.revision, model: table(["A"], ["2"]) }],
        formulas: [{ key: formula!.key, text: "=SUM(b![A])" }, { ...gone, text: "=1" }],
      });
      expect(plan.formulasLeft).toHaveLength(1);
      expect((await store.apply(plan)).written).toBe(true);
      expect(pages.get("Shop")).toBe(`Intro.\n\n| A |\n|---|\n| 2 |\n\nTotal: \${te("=SUM(b![A])")}\n`);
    });

    it("lets other plugins write with it, told of the tables written; tidies a table where asked", async () => {
      const told: string[] = [];
      writeListenersAnew();
      addWriteListener((text, context) => {
        told.push(String(context.renamed()));
        return text.startsWith("Intro.") ? [{ from: 0, to: 6, text: "Begin." }] : [];
      });
      const { pages, platform } = pagesOf({ Shop: [table(["A"], ["1"])] }, "Shop");
      pages.set("Shop", "Intro.\n\n| A |\n|---|\n|  1 |\n");
      const store = storeOf(platform);
      const [first] = (await store.tables("Shop"))!;
      const renamed = { ...first!.model, columns: first!.model.columns.map((c) => ({ ...c, header: "B" })) };
      await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "write", key: first!.key, expects: first!.revision, model: renamed, tidy: true }] }));
      expect(told).toEqual(["true"]);
      expect(pages.get("Shop")).toBe("Begin.\n\n| B   |\n| --- |\n| 1   |\n");
    });

    it("tells the binding of a write of the open page before it is made: the text read, its tables' span, the edit; then where places went", async () => {
      const { pages, platform } = pagesOf({ Shop: [table(["A"], ["1"]), table(["B"], ["2"])] }, "Shop");
      const seen: string[] = [];
      const store = storeOf(platform, async (text, span, edit) => {
        seen.push(`${text.slice(span.from, span.to)} ${edit.from}-${edit.to}`);
        return (moved) => seen.push(`moved ${moved(text.length, false)}`);
      });
      const [, second] = (await store.tables("Shop"))!;
      const before = pages.get("Shop")!;
      await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "write", key: second!.key, expects: second!.revision, model: table(["B"], ["22"]) }] }));
      const at = before.indexOf("| 2 |");
      expect(seen).toEqual([`| B |\n|---|\n| 2 | ${at + 3}-${at + 3}`, `moved ${before.length + 1}`]);
    });

    it("tells the binding of the write as it is made on the open page changed since it was planned", async () => {
      const { pages, platform } = pagesOf({ Shop: [table(["A"], ["1"]), table(["B"], ["2"])] }, "Shop");
      const seen: string[] = [];
      const store = storeOf(platform, async (text, span) => {
        seen.push(`${span.from} ${text.length}`);
        return (moved) => seen.push(String(moved(span.to + 1, false) - (span.to + 1)));
      });
      const [, second] = (await store.tables("Shop"))!;
      const plan = await store.plan({ document: "Shop", edits: [{ kind: "write", key: second!.key, expects: second!.revision, model: table(["B"], ["22"]) }] });
      const typed = `Typed meanwhile.\n${pages.get("Shop")!}`;
      pages.set("Shop", typed);
      expect((await store.apply(plan)).written).toBe(true);
      // (Where the table is in the page as it is now, in that text)
      expect(seen).toEqual([`${typed.indexOf("| B |")} ${typed.length}`, "1"]);
      expect(pages.get("Shop")).toContain("Typed meanwhile.\n");
    });

    it("makes a new table where the cursor is, or under a key the caller reserved", async () => {
      const { pages, platform } = pagesOf({ Shop: [table(["A"], ["1"])] }, "Shop");
      const store = storeOf(platform);
      (platform.editor as { cursor?: () => number }).cursor = () => 3;
      const at = await store.insertAtCursor("Shop");
      expect(at).toBeDefined();
      const report = await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "insert", model: table(["N"], ["n"]), at }] }));
      expect(pages.get("Shop")).toBe("Intro.\n\n| N |\n|---|\n| n |\n\n| A |\n|---|\n| 1 |\n");
      expect((await store.tables("Shop"))![0]!.key).toBe(report.inserted[0]);
    });

    it("reads a page's text read last again as it read it: the same tables, none decoded anew", () => {
      const { pages, platform } = pagesOf({ Shop: [table(["A"], ["1"])] }, "Shop");
      const store = storeOf(platform);
      const first = store.tablesOfText("Shop", pages.get("Shop")!);
      expect(store.tablesOfText("Shop", pages.get("Shop")!)).toBe(first);
      expect(store.tablesOfText("Shop", `${pages.get("Shop")!}\nMore.\n`)).not.toBe(first);
    });

    it("writes a model over the table it was read from where the page was read anew since, that table parsed anew", async () => {
      const { pages, platform } = pagesOf({ Shop: [] }, "Shop");
      pages.set("Shop", "Intro.\n\n| A  | B |\n|---|---|\n| 1  | 2 | extra |\n| <meta core.table widths.-c-b.size='9'> |\n");
      const store = storeOf(platform);
      const [shop] = (await store.tables("Shop"))!;
      // Typed above it, the page read again, the table's text parsed anew (parseTable keeps a few)
      pages.set("Shop", `Intro typed.\n\n${pages.get("Shop")!.slice("Intro.\n\n".length)}`);
      for (let i = 0; i < 20; i++) parseTable(`| X${i} |\n|---|\n| 1 |`);
      await store.tables("Shop");
      const read = shop!.model;
      const b = read.columns[1]!;
      const model = { ...read, columns: [read.columns[0]!, { ...b, attributes: withAttributeIn(b.attributes, "widths", "size", undefined) }] };
      await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "write", key: shop!.key, expects: shop!.revision, model }] }));
      // (Its width taken off, the rest as written: the metadata row holding nothing more goes)
      expect(pages.get("Shop")).toBe("Intro typed.\n\n| A  | B |\n|---|---|\n| 1  | 2 | extra |\n");
    });

    it("tidies a table keeping the metadata of a column none of its model's comes from, as any write", async () => {
      const { pages, platform } = pagesOf({ Shop: [] }, "Shop");
      pages.set("Shop", "| A | B |\n|---|---|\n| 1 | 2 |\n| <meta core.table widths.-c-b.size='9'> |\n");
      const store = storeOf(platform);
      const [shop] = (await store.tables("Shop"))!;
      const withoutB = { ...shop!.model, columns: [shop!.model.columns[0]!], rows: shop!.model.rows.map((row) => ({ ...row, cells: [row.cells[0]!] })) };
      await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "write", key: shop!.key, expects: shop!.revision, model: withoutB, tidy: true }] }));
      expect(pages.get("Shop")).toContain("widths.-c-b.size='9'");
    });

    it("writes a table's model over the table it replaces, never over another of the page it was read from", async () => {
      const { pages, platform } = pagesOf({ Shop: [] }, "Shop");
      pages.set("Shop", "- item\n\n    | A |\n    |---|\n    | 1 |\n\nText.\n\n| B |\n|---|\n| 2 |\n");
      const store = storeOf(platform);
      const [a, b] = (await store.tables("Shop"))!;
      await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "write", key: b!.key, expects: b!.revision, model: a!.model }] }));
      expect(pages.get("Shop")).toBe("- item\n\n    | A |\n    |---|\n    | 1 |\n\nText.\n\n| A |\n|---|\n| 1 |\n");
      // Nor over a table of another page
      pages.set("Other", "- item\n\n    | C |\n    |---|\n    | 3 |\n");
      const [c] = (await store.tables("Other"))!;
      const [, written] = (await store.tables("Shop"))!;
      await store.apply(await store.plan({ document: "Shop", edits: [{ kind: "write", key: written!.key, expects: written!.revision, model: c!.model }] }));
      expect(pages.get("Shop")).toBe("- item\n\n    | A |\n    |---|\n    | 1 |\n\nText.\n\n| C |\n|---|\n| 3 |\n");
    });

    it("reads a model back as written: a tag typed into a cell's text is an attribute", () => {
      const { platform } = pagesOf({ Shop: [] }, "Shop");
      const typed = table(["A"], ["x <meta x.y='1'>"]);
      const read = storeOf(platform).asRead(typed);
      expect(read.rows[0]!.cells[0]!.content).toBe("x");
      expect(attributeIn(read.rows[0]!.cells[0]!.attributes, "x", "y")).toBe("1");
      expect(attributeIn(withAttributeIn(read.rows[0]!.cells[0]!.attributes, "x", "y", undefined), "x", "y")).toBeUndefined();
    });
  });
});
