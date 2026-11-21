import { describe, expect, it } from "vitest";
import { serializeTable } from "../../markdown.ts";
import { TableRegister } from "../../core/tables.ts";
import type { TablePlatform } from "../../core/platform.ts";
import type { TableModel } from "../../model/model.ts";
import { storeContract, table } from "../contract.ts";
import { MarkdownStore } from "./store.ts";
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

const storeOf = (platform: Pick<TablePlatform, "editor" | "space">) => new MarkdownStore(() => platform, new TableRegister(), async () => serializeTable);

storeContract("markdown in pages, the open page's through the editor", (documents) => {
  const open = Object.keys(documents)[0] ?? "";
  const { pages, platform } = pagesOf(documents, open);
  return { store: storeOf(platform), replace: (document, tables) => void pages.set(document, textOf(tables)) };
});

storeContract("markdown in pages, none open: through the space", (documents) => {
  const { pages, platform } = pagesOf(documents, "");
  return { store: storeOf(platform), replace: (document, tables) => void pages.set(document, textOf(tables)) };
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
});
