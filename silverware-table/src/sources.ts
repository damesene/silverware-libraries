// The sources of the space: tables no page has, which the host gives as plain
// data (SilverBullet's: host/sources.ts, a Space Lua function each; the
// playground's and the tests': `memorySources`), all through one interface,
// `SourceProvider`. The sources module (features/sources.ts) offers them to
// the formulas, which read them as `@name` (`@tasks[due]`). Nothing here knows
// where they come from.
import type { Table } from "./markdown.ts";

/** What a source gives: its columns' names, and its rows, each a text per column ("" where empty) */
export type SourceData = { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] };

/** The sources a host gives */
export type SourceProvider = {
  /** The names of the sources defined, as defined, read or not yet */
  names(): readonly string[];
  /**
   * A source's data as last read (by its name, compared ignoring case): the
   * same object until it is read anew and differs; undefined where none is
   * defined so, or it is not read yet
   */
  read(name: string): SourceData | undefined;
  /** `listener` called whenever a source changed (read anew and different, defined, gone); the function returned stops it */
  changed(listener: () => void): () => void;
};

/**
 * What the sources module offers the formulas (ModelHost.offered("sources")):
 * the sources as tables of the markdown model, the same object while their
 * data are the same; `version` counts their changes
 */
export type SourcesOffer = {
  /** The sources' names, as defined */
  readonly names: () => readonly string[];
  /** A source as a table: its columns the header; null where none is defined so, undefined where it is not read yet */
  readonly table: (name: string) => Table | null | undefined;
  readonly version: () => number;
};

/** A provider of sources kept in memory (the playground's, the tests'): `set` gives one (or takes it away: undefined) */
export function memorySources(given: Readonly<Record<string, SourceData>> = {}): SourceProvider & { set(name: string, data: SourceData | undefined): void } {
  const sources = new Map<string, { name: string; data: SourceData }>(Object.entries(given).map(([name, data]) => [name.toLowerCase(), { name, data }]));
  const listeners = new Set<() => void>();
  return {
    names: () => [...sources.values()].map((s) => s.name),
    read: (name) => sources.get(name.toLowerCase())?.data,
    changed: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    set: (name, data) => {
      if (data) sources.set(name.toLowerCase(), { name, data });
      else sources.delete(name.toLowerCase());
      for (const listener of listeners) listener();
    },
  };
}
