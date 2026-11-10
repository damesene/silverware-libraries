// Version 2 (2026-11-10): toolbars. Before, the favourites were a device's:
// `favorites` Click's rows, `favorites-touch` Touch's own (shown while
// `favorites-touch-enabled`, else Click's showed by finger), and where and
// when the toolbar showed were each device's settings (`placement`,
// `placement-touch`, `show`, `show-touch`). Now a toolbar is
// `{ name, useFor, placement, show, rows }` (core/toolbars.ts). The settings
// of before become toolbars showing what each way of working showed: Click's
// rows where and when Click's toolbar showed, Touch's (its own, or Click's)
// where and when Touch's did; one toolbar for both where they showed the same
// rows the same way; Touch's own kept off, a toolbar used for none (nothing
// lost). A docked toolbar of before showed every row in one line, so a docked
// one's rows are joined into one as it showed them (a separator between rows
// whose items are not all pinned). The keys of before are taken out.
import { DEFAULT_FAVORITES, DEFAULT_TOUCH_FAVORITES } from "../core/favorites.ts";
import { type Placement, PLACEMENTS, type ShowWhen, SHOWS } from "../core/toolbars.ts";
import { listOf } from "../lists.ts";
import type { Migration, ReadSetting } from "./index.ts";

const FAVORITES = "silverware.toolbar.favorites";
const TOUCH = "silverware.toolbar.favorites-touch";
const TOUCH_ON = "silverware.toolbar.favorites-touch-enabled";
const PLACEMENT = "silverware.toolbar.placement";
const PLACEMENT_TOUCH = "silverware.toolbar.placement-touch";
const SHOW = "silverware.toolbar.show";
const SHOW_TOUCH = "silverware.toolbar.show-touch";
const GESTURES = "silverware.toolbar.modules.gestures.enabled";

// The keys of before besides the favourites: taken out once migrated
const BEFORE = [TOUCH, TOUCH_ON, PLACEMENT, PLACEMENT_TOUCH, SHOW, SHOW_TOUCH];

export const toolbars: Migration = {
  version: 2,
  name: "toolbars",
  migrate: async (read: ReadSetting) => {
    const favorites = await read(FAVORITES);
    const before = await Promise.all(BEFORE.map((path) => read(path)));
    const gone = Object.fromEntries(BEFORE.map((path) => [path, undefined]));
    // Toolbars already (written by hand in this model): only the keys of before taken out
    if (isToolbars(favorites)) return before.some((value) => value !== undefined) ? gone : {};
    const click = rowsOf(favorites);
    if (!click && before.every((value) => value === undefined)) return {};
    const [touchValue, touchOn, placement, placementTouch, show, showTouch] = before;
    const touch = rowsOf(touchValue);
    const gestures = (await read(GESTURES)) !== false;
    // As the settings of before read them (bridge.ts readSettings then)
    const clickRows = click ?? DEFAULT_FAVORITES;
    const touchRows = touch ?? (gestures ? DEFAULT_TOUCH_FAVORITES : undefined);
    const touchShown = (touchOn == null ? !(click && !touch) : touchOn !== false) && !!touchRows;
    const clickAt = { placement: valueOf(PLACEMENTS, placement, "selection"), show: valueOf(SHOWS, show, "selection") };
    const touchAt = { placement: valueOf(PLACEMENTS, placementTouch, "bottom"), show: valueOf(SHOWS, showTouch, "writing") };
    const byFinger = touchShown ? touchRows! : clickRows;
    const names = new Set<string>();
    const toolbar = (rows: readonly unknown[], at: { placement: Placement; show: ShowWhen }, useFor: readonly string[], name?: string) => ({
      name: unique(name ?? (at.placement === "selection" ? "Float" : "Docked"), names),
      ...(useFor.length ? { useFor: [...useFor] } : {}),
      ...at,
      rows: at.placement === "selection" ? [...rows] : (joined(rows) ?? [...rows]),
    });
    const out = [];
    // The same rows the same way: one toolbar for both
    if (byFinger === clickRows && clickAt.placement === touchAt.placement && clickAt.show === touchAt.show) out.push(toolbar(clickRows, clickAt, ["click", "touch"]));
    else out.push(toolbar(clickRows, clickAt, ["click"]), toolbar(byFinger, touchAt, ["touch"]));
    // Touch's own, turned off: kept, for none
    if (touch && !touchShown) out.push(toolbar(touch, touchAt, [], "Touch"));
    return { [FAVORITES]: out, ...gone };
  },
};

/** Rows of favourites as configured (a list of lists), else undefined */
function rowsOf(value: unknown): unknown[] | undefined {
  const rows = listOf(value);
  return rows && rows.every((row) => listOf(row)) ? rows.map((row) => listOf(row)!) : undefined;
}

/** Whether a value is toolbars (a list of objects with a name), the model of now */
function isToolbars(value: unknown): boolean {
  const list = listOf(value);
  return !!list?.length && list.every((one) => !!one && typeof one === "object" && !listOf(one) && typeof (one as Record<string, unknown>).name === "string");
}

/** One of the values, else the default (a value of before such as auto or mobile, too) */
function valueOf<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

/** A name not taken yet: `name`, else `name 2`… (taken now) */
function unique(name: string, names: Set<string>): string {
  let free = name;
  for (let n = 2; names.has(free.toLowerCase()); n++) free = `${name} ${n}`;
  names.add(free.toLowerCase());
  return free;
}

/** Rows joined into one as a docked toolbar of before showed them; undefined: nothing to join (one row) */
export function joined(rows: readonly unknown[]): unknown[][] | undefined {
  if (rows.length < 2) return undefined;
  const row: unknown[] = [];
  let shown = false;
  for (const items of rows.map((one) => listOf(one) ?? [])) {
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
