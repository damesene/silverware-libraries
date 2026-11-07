// A Space over a map of pages, its index made by the scanner as SilverBullet's
// would have it (a tag once per page and context; a hashtag in a paragraph is
// the page's; a table row's and a heading's are theirs, as the init page's
// Lua reads them): the unit tests and the playground work with it.
import { breather } from "../../../shared/pages/batch.ts";
import { tagUses } from "../../../shared/pages/tags/edit.ts";
import type { TagContext } from "../../../shared/pages/tags/scan.ts";
import { pageWriter, type PageWriter } from "../../../shared/pages/writer.ts";
import type { Space, TagRecord, WritingPlatform } from "./space.ts";

const PARENT: Readonly<Record<TagContext, string>> = { page: "page", paragraph: "page", item: "item", task: "task", table: "table", heading: "header" };

export type MemorySpace = Space & {
  readonly pages: Map<string, string>;
  current: string | undefined;
  // Its editor and space for the page writer (handed to the controller apart, as SilverBullet's are)
  readonly platform: WritingPlatform;
};

const writers = new WeakMap<MemorySpace, PageWriter>();

/** The one page writer of a space in memory, as a test asks for it (the controller makes its own) */
export function writerOf(space: MemorySpace): PageWriter {
  let writer = writers.get(space);
  if (!writer) writers.set(space, (writer = pageWriter(space.platform)));
  return writer;
}

export function memorySpace(pages: Readonly<Record<string, string>>, options: { readonly current?: string; readonly changed?: (page: string, text: string) => void; readonly navigated?: (page: string) => void } = {}): MemorySpace {
  const map = new Map(Object.entries(pages));
  const space: MemorySpace = {
    pages: map,
    current: options.current,
    pageNames: async () => [...map.keys()].sort(),
    tagRecords: async () => {
      const records: TagRecord[] = [];
      // (Thousands of pages read here at once: the browser given its turns, as an index's query would)
      const breathe = breather();
      for (const [page, text] of map) {
        await breathe();
        const seen = new Set<string>();
        for (const use of tagUses(text)) {
          const parent = PARENT[use.context];
          const key = `${use.name}\u0000${parent}`;
          if (seen.has(key)) continue;
          seen.add(key);
          records.push({ name: use.name, page, parent });
        }
      }
      return records;
    },
    read: async (page) => {
      const text = map.get(page);
      if (text === undefined) throw new Error(`no page ${page}`);
      return text;
    },
    platform: {
      editor: {
        documentName: async () => {
          if (space.current === undefined) throw new Error("no page is open");
          return space.current;
        },
        text: async () => map.get(space.current ?? "") ?? "",
        replace: async (from, to, insert) => {
          const page = space.current ?? "";
          const text = map.get(page) ?? "";
          const after = text.slice(0, from) + insert + text.slice(to);
          map.set(page, after);
          options.changed?.(page, after);
        },
      },
      space: {
        read: async (page) => {
          const text = map.get(page);
          if (text === undefined) throw new Error(`no page ${page}`);
          return text;
        },
        write: async (page, text) => {
          map.set(page, text);
          options.changed?.(page, text);
        },
        list: async () => [...map.keys()].sort(),
      },
    },
    currentPage: async () => space.current,
    navigate: async (page) => {
      space.current = page;
      options.navigated?.(page);
    },
    settled: async () => undefined,
  };
  return space;
}
