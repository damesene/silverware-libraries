// Version 2 (2026-11-10): the toolbar docked shows each row of its
// favourites as a line of its own, its items pinned left and right at that
// line's ends; before, it was one line, the rows one after another with a
// separator between them, every item pinned at that line's ends. So the
// favourites for touch where Touch's toolbar is docked (its default: bottom),
// and Click's where Click's is, are joined into one row as it
// showed them: a separator between two rows where both have items that are
// not pinned (one of pinned items alone added none), the pinned ones staying
// pinned. Where a finger showed Click's docked (no favourites for touch of
// the space's own, their switch not set on: bridge.ts readSettings), they
// become the favourites for touch, joined, turned on: a computer keeps
// Click's rows as they were. The new model's rows are kept as they are: this
// runs once.
import { listOf } from "../lists.ts";
import type { Migration, ReadSetting } from "./index.ts";

const TOUCH = "silverware.toolbar.favorites-touch";
const CLICK = "silverware.toolbar.favorites";
const CLICK_PLACEMENT = "silverware.toolbar.placement";
const TOUCH_PLACEMENT = "silverware.toolbar.placement-touch";
const TOUCH_ON = "silverware.toolbar.favorites-touch-enabled";

/** Whether a placement as configured docks the toolbar (`fallback`: the device's default where not set) */
const docks = (placement: unknown, fallback: boolean) => (placement === undefined ? fallback : placement === "bottom" || placement === "top");

export const touchRowsJoined: Migration = {
  version: 2,
  name: "favourites docked in one row",
  migrate: async (read: ReadSetting) => {
    const changes: Record<string, unknown> = {};
    if (docks(await read(TOUCH_PLACEMENT), true)) {
      const own = await read(TOUCH);
      const touch = joined(own);
      if (touch) changes[TOUCH] = touch;
      // A finger shown Click's (none of its own, not turned on): those, joined, its own now
      else if (own === undefined && (await read(TOUCH_ON)) !== true) {
        const click = joined(await read(CLICK));
        if (click) Object.assign(changes, { [TOUCH]: click, [TOUCH_ON]: true });
      }
    }
    if (docks(await read(CLICK_PLACEMENT), false)) {
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
