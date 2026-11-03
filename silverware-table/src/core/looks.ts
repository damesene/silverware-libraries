// The looks features want for a table's cells and headers (Feature.looks, in
// model terms), merged for the adapter that applies them (core/adapter.ts):
// the features in their order, a later display or value winning, marks and
// titles added.
import type { CellDisplay, CellLook, CellRef, HeaderIcon, HeaderLook, TableLooks } from "./feature.ts";

/** The looks of a table's cells and headers merged: features in their order, a later display or value winning */
export type MergedLooks = {
  readonly cells: ReadonlyMap<string, MergedCell>;
  readonly headers: ReadonlyMap<number, MergedHeader>;
};
export type MergedCell = { display?: CellDisplay; value?: string; sortKey?: string; marks: string[]; titles: string[]; vars?: Record<string, string> };
export type MergedHeader = { icons: HeaderIcon[]; marks: string[]; titles: string[]; hidesTag: ((name: string) => boolean)[] };

export const refKey = (ref: CellRef): string => `${ref.row}:${ref.column}`;

export function mergeLooks(all: readonly (TableLooks | undefined)[]): MergedLooks {
  const cells = new Map<string, MergedCell>();
  const headers = new Map<number, MergedHeader>();
  for (const looks of all) {
    for (const look of looks?.cells ?? []) {
      const key = refKey(look);
      let merged = cells.get(key);
      if (!merged) cells.set(key, (merged = { marks: [], titles: [] }));
      mergeCell(merged, look);
    }
    for (const look of looks?.headers ?? []) {
      let merged = headers.get(look.column);
      if (!merged) headers.set(look.column, (merged = { icons: [], marks: [], titles: [], hidesTag: [] }));
      mergeHeader(merged, look);
    }
  }
  return { cells, headers };
}

function mergeCell(merged: MergedCell, look: CellLook): void {
  if (look.display !== undefined) merged.display = look.display;
  if (look.value !== undefined) merged.value = look.value;
  if (look.sortKey !== undefined) merged.sortKey = look.sortKey;
  if (look.marks) merged.marks.push(...look.marks);
  if (look.title) merged.titles.push(look.title);
  // Only Silverware Table's own properties: a feature sets what its CSS reads, never a style of its own
  for (const [name, value] of Object.entries(look.vars ?? {})) if (name.startsWith("--swt-")) (merged.vars ??= {})[name] = value;
}

function mergeHeader(merged: MergedHeader, look: HeaderLook): void {
  if (look.icons) merged.icons.push(...look.icons);
  if (look.marks) merged.marks.push(...look.marks);
  if (look.title) merged.titles.push(look.title);
  if (look.hidesTag) merged.hidesTag.push(look.hidesTag);
}
