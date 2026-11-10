// A space of pages in memory with an index as SilverBullet's has them (each
// page's frontmatter its keys, its name, its tags), for the pages store's
// tests and the playground. `lagging`: the index has a page's change only
// when `catchUp()` is called, as SilverBullet's indexes a page written a
// moment after, so the store's holding of what it wrote can be tried;
// `toldEarly` with it: the index tells of a page as it is written, before a
// query has it (as SilverBullet's did, seen 2026-11-07).
import { localStamp, tasksIn } from "../../domain/system.ts";
import { readFrontmatter } from "../../../../shared/pages/frontmatter.ts";
import { readYamlMap } from "../../../../shared/yaml/tree.ts";
import type { Editor, Index, IndexChange, IndexedObject, Platform, Space } from "../../../../shared/platform.ts";

export type MemoryPages = {
  readonly platform: Pick<Platform, "editor" | "space" | "index">;
  readonly pages: Map<string, string>;
  /** The index brought up to the pages, each page changed since told (a lagging index only) */
  catchUp(): void;
  /** A page's text written outside the store (by hand), the index told */
  writeOutside(page: string, text: string): void;
  /** A page removed outside the store, the index told */
  removeOutside(page: string): void;
};

/** A page's index object as SilverBullet's index has it: its frontmatter's keys, its name and tags over them */
export function indexObject(name: string, text: string): IndexedObject {
  const { yaml } = readFrontmatter(text);
  const read = yaml ? readYamlMap(text.slice(yaml.from, yaml.to)) : { value: {} };
  const frontmatter = "value" in read ? (read.value as Record<string, unknown>) : {};
  const tags = frontmatter.tags;
  return { ...frontmatter, name, tags: Array.isArray(tags) ? tags.map(String) : typeof tags === "string" ? [tags] : [] };
}

export function memoryPages(initial: Readonly<Record<string, string>> = {}, options: { readonly lagging?: boolean; readonly toldEarly?: boolean; readonly open?: string } = {}): MemoryPages {
  const pages = new Map(Object.entries(initial));
  const indexed = new Map<string, IndexedObject>();
  const listeners = new Set<(change: IndexChange) => void>();
  const pending = new Set<string>();
  // Each page's dates as SilverBullet's index has them (made once, written with each change), from a clock of its own that
  // moves a second a change, so they differ and sort
  const dates = new Map<string, { created: string; lastModified: string }>();
  let clock = new Date(2026, 10, 1, 9, 0, 0).getTime();
  const dated = (page: string, text: string) => {
    const now = localStamp(new Date((clock += 1000)));
    const known = dates.get(page);
    dates.set(page, { created: known?.created ?? now, lastModified: now });
    return { ...indexObject(page, text), ...dates.get(page) };
  };
  const tell = (page: string, early: boolean) => {
    for (const listener of listeners) listener({ document: page, deleted: !pages.has(page), ...(early ? { early: true } : {}) });
  };
  // Indexed: told as the index starts on it, then whole (told early already: whole alone)
  const index = (page: string) => {
    if (!options.toldEarly) tell(page, true);
    const text = pages.get(page);
    if (text === undefined) indexed.delete(page);
    else indexed.set(page, dated(page, text));
    tell(page, false);
  };
  const changed = (page: string) => {
    if (options.toldEarly) tell(page, true);
    if (options.lagging) pending.add(page);
    else index(page);
  };
  for (const page of pages.keys()) indexed.set(page, dated(page, pages.get(page)!));
  const editor: Editor = {
    documentName: () => {
      if (options.open === undefined) throw new Error("no page is open");
      return options.open;
    },
    text: () => pages.get(options.open!) ?? "",
    replace: (from, to, insert) => {
      const text = pages.get(options.open!) ?? "";
      pages.set(options.open!, text.slice(0, from) + insert + text.slice(to));
      changed(options.open!);
    },
  };
  const space: Space = {
    read: (name) => {
      const text = pages.get(name);
      if (text === undefined) throw new Error(`no page ${name}`);
      return text;
    },
    write: (name, text) => {
      pages.set(name, text);
      changed(name);
    },
    list: () => [...pages.keys()],
    remove: (name) => {
      pages.delete(name);
      changed(name);
    },
    rename: (from, to) => {
      if ([...pages.keys()].some((one) => one.toLowerCase() === to.toLowerCase() && one !== from)) return { problem: `${to} exists` };
      pages.set(to, pages.get(from)!);
      pages.delete(from);
      changed(from);
      changed(to);
      return {};
    },
  };
  const indexApi: Index = {
    objects: (tag) => [...indexed.values()].filter((object) => (object.tags as readonly string[]).includes(tag)),
    // Its own: the keys its objects have beside a page's frontmatter, the dates it keeps, the tasks of a page's text
    reservedKeys: new Set(["name", "tags", "created", "lastModified"]),
    documentDates: (object) => ({ ...(typeof object.created === "string" ? { created: object.created } : {}), ...(typeof object.lastModified === "string" ? { modified: object.lastModified } : {}) }),
    tasks: (documents) => {
      const counts = new Map<string, { done: number; total: number }>();
      for (const page of documents) {
        const text = indexed.has(page) ? (pages.get(page) ?? "") : "";
        const count = tasksIn(text.slice(readFrontmatter(text).bodyStart));
        if (count.total) counts.set(page, count);
      }
      return counts;
    },
    onChanged: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  return {
    platform: { editor, space, index: indexApi },
    pages,
    catchUp: () => {
      for (const page of [...pending]) index(page);
      pending.clear();
    },
    writeOutside: (page, text) => {
      pages.set(page, text);
      changed(page);
    },
    removeOutside: (page) => {
      pages.delete(page);
      changed(page);
    },
  };
}
