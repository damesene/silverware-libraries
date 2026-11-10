// Version 2 (2026-11-10): the toolbar docked shows each row of its
// favourites as a line of its own, its items pinned left and right at that
// line's ends; before, it was one line, the rows one after another with a
// separator between them, every item pinned at that line's ends. So the
// favourites for touch (the device the toolbar docks on by default), and
// Click's where Click's toolbar is docked, are joined into one row as it
// showed them: a separator between two rows where both have items that are
// not pinned (one of pinned items alone added none), the pinned ones staying
// pinned. The new model's rows are kept as they are: this runs once.
import { listOf } from "../lists.ts";
import type { Migration, ReadSetting } from "./index.ts";

const TOUCH = "silverware.toolbar.favorites-touch";
const CLICK = "silverware.toolbar.favorites";
const CLICK_PLACEMENT = "silverware.toolbar.placement";

export const touchRowsJoined: Migration = {
  version: 2,
  name: "favourites docked in one row",
  migrate: async (read: ReadSetting) => {
    const changes: Record<string, unknown> = {};
    const touch = joined(await read(TOUCH));
    if (touch) changes[TOUCH] = touch;
    const placement = await read(CLICK_PLACEMENT);
    if (placement === "bottom" || placement === "top") {
      const click = joined(await read(CLICK));
      if (click) changes[CLICK] = click;
    }
    return changes;
  },
};

/** Rows of favourites as configured joined into one, as the docked toolbar showed them; undefined: nothing to join (not rows, one row) */
export function joined(value: unknown): unknown[][] | undefined {
  const rows = listOf(value)?.map(listOf);
  if (!rows || rows.length < 2 || rows.some((row) => !row)) return undefined;
  const row: unknown[] = [];
  let shown = false;
  for (const items of rows as unknown[][]) {
    const has = items.some((item) => !separator(item) && !pinned(item));
    if (shown && has) row.push({ type: "separator" });
    row.push(...items);
    shown ||= has;
  }
  return [row];
}

const field = (item: unknown, key: string): unknown => (item && typeof item === "object" ? (item as Record<string, unknown>)[key] : undefined);
const separator = (item: unknown) => field(item, "type") === "separator";
const pinned = (item: unknown) => field(item, "pin") === "left" || field(item, "pin") === "right";
