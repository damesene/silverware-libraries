import { describe, expect, it } from "vitest";
import { serializeTable, type Table } from "../../markdown.ts";
import { TableRegister } from "../../core/tables.ts";
import type { TablePlatform } from "../../core/platform.ts";
import { storeContract } from "../contract.ts";
import { MarkdownStore } from "./store.ts";

// Pages in memory, one of them open in the editor; each a line of text between its tables
function pagesOf(documents: Readonly<Record<string, readonly Table[]>>, open: string) {
  const pages = new Map(Object.entries(documents).map(([name, tables]) => [name, textOf(tables)]));
  const platform: Pick<TablePlatform, "editor" | "space"> = {
    editor: {
      documentName: () => open,
      text: () => pages.get(open) ?? "",
      replace: () => {
        throw new Error("not written here");
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

const textOf = (tables: readonly Table[]) => ["Intro.", ...tables.map((table) => serializeTable(table))].join("\n\n") + "\n";

storeContract("markdown in pages, the open page's through the editor", (documents) => {
  const open = Object.keys(documents)[0] ?? "";
  const { pages, platform } = pagesOf(documents, open);
  return { store: new MarkdownStore(() => platform, new TableRegister()), replace: (document, tables) => void pages.set(document, textOf(tables)) };
});

describe("the markdown store", () => {
  it("reads a page not open through the space, none where the platform reads no other page", async () => {
    const table: Table = { rows: [{ cells: ["A"] }, { cells: ["1"] }], align: [""], indent: "", padded: false };
    const { platform } = pagesOf({ Open: [], Other: [table] }, "Open");
    expect(await new MarkdownStore(() => platform, new TableRegister()).tables("Other")).toHaveLength(1);
    const { space: _, ...editorOnly } = platform;
    expect(await new MarkdownStore(() => editorOnly, new TableRegister()).tables("Other")).toBeNull();
  });
});
