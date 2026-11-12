// Silverware Layout's entries in a `silverware-database` block (shared/layout.ts, docs/silverware-layout.md): kept as
// lines of the block under the name `layout` (`layout.width: 1100`), as the block keeps a place's state, without
// reading their meaning. The block's form is block.ts's.
import type { LayoutChanges, LayoutEntries } from "../../../../shared/layout.ts";
import { readBlock, writeBlock } from "./block.ts";

const PREFIX = "layout.";

/** Silverware Layout's entries a block keeps, by their keys (`width`), as text */
export function layoutEntries(body: string): LayoutEntries {
  const entries: Record<string, string> = {};
  for (const [key, value] of readBlock(body)) {
    if (key.startsWith(PREFIX) && value !== null && value !== undefined && typeof value !== "object") entries[key.slice(PREFIX.length)] = String(value);
  }
  return entries;
}

/** The block with Silverware Layout's entries changed (null: a key's line gone), every other line as it was */
export function withLayout(body: string, changes: LayoutChanges): string {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) values[`${PREFIX}${key}`] = value === null ? undefined : value;
  return writeBlock(body, values);
}
