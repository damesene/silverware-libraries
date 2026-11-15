// A grid's column grips (docs/silverware-layout-grid-handles.md): a small grip at the middle of each column's top edge,
// half above it, shown as the pointer is over the column (on a touch screen while the grid has the focus), its click
// the column's menu: its markdown, moved, a column added after it, moved out of the grid. What acts on the whole grid
// (its columns, its borders, a column at the end, the grid taken apart) is the grid's handle's (`gridMenu`, the grid's
// provider: src/grid/provider.ts). The actions are carried out by the grids (`CellAction`), as they were from a cell's
// "…" before.
import { el } from "../../../../shared/elements.ts";
import { ERASER, TRASH } from "../../../../shared/glyphs.ts";
import type { LayoutMenuEntry } from "../../../../shared/layout.ts";
import { opensMenu, type PopupItem, type PopupMenu, showPopup } from "../../../../shared/popupmenu.ts";
import { columnCount, FIT, fitsColumns, MAX_COLUMNS, MIN_WIDTHS, type MinWidthName, minWidthChoice } from "../model/columns.ts";

// The popup menu's classes: Silverware Layout's
const POPUP = { base: "swl" } as const;

/** What a column's menu or the grid's does */
export type CellAction =
  | { readonly kind: "move"; readonly by: -1 | 1 }
  | { readonly kind: "addAfter" }
  | { readonly kind: "takeOut" }
  | { readonly kind: "remove" }
  | { readonly kind: "clear" }
  | { readonly kind: "columns"; readonly columns: string | null }
  // A grid of columns as many as fit: the narrowest its columns may be (a name, or px), or asked in px
  | { readonly kind: "min"; readonly min: MinWidthName }
  | { readonly kind: "askMin" }
  | { readonly kind: "addColumn" }
  | { readonly kind: "border"; readonly on: boolean }
  | { readonly kind: "ungrid" }
  | { readonly kind: "source" };

/** An item of a grid's menus (shared/popupmenu.ts' `PopupItem`) */
export type GridMenuItem = PopupItem;

/** A grid as its menus show it: its columns attribute (and `min`, where they are as many as fit), its borders, its number of cells */
export type GridMenuState = { readonly columns: string | undefined; readonly min?: string | undefined; readonly border: boolean; readonly cells: number };

/** The column's menu: its sections, for the cell at `index` */
export function columnMenu(index: number, now: GridMenuState, act: (action: CellAction) => void): GridMenuItem[][] {
  const item = (label: string, action: CellAction, disabled?: string): GridMenuItem => ({ label, run: () => act(action), ...(disabled ? { disabled } : {}) });
  return [
    [item("Edit markdown (Alt+click)", { kind: "source" })],
    [
      item("Move left", { kind: "move", by: -1 }, index === 0 ? "It is the first" : undefined),
      item("Move right", { kind: "move", by: 1 }, index === now.cells - 1 ? "It is the last" : undefined),
      item("Add a column after it", { kind: "addAfter" }),
    ],
    [item("Move out of the grid", { kind: "takeOut" })],
    // (Its content emptied, the column kept; or deleted, its content with it: each asked first, the grids' `cellAction`)
    [
      { label: "Clear column…", danger: true, icon: ERASER, run: () => act({ kind: "clear" }) },
      { label: "Delete column…", danger: true, icon: TRASH, run: () => act({ kind: "remove" }) },
    ],
  ];
}

/** The grid's own sections of its handle's menu (after Layout's Align and Width) */
export function gridMenu(now: GridMenuState, act: (action: CellAction) => Promise<void>): LayoutMenuEntry[][] {
  const fit = fitsColumns(now.columns);
  // (Widths of their own, as dragged: no count of them set)
  const count = fit ? undefined : columnCount(now.columns, now.cells);
  const counts = Array.from({ length: MAX_COLUMNS - 1 }, (_, i) => i + 2);
  const columns: LayoutMenuEntry = {
    kind: "segmented",
    label: "Columns",
    options: [
      // (The menu left open: its min width is chosen next)
      { icon: "Auto", title: "As many as fit, each as wide as the others, none under the min width (a gallery)", active: fit, keepsOpen: true, run: () => act({ kind: "columns", columns: FIT }) },
      ...counts.map((n) => ({ icon: String(n), title: `${n} columns`, active: count === n, run: () => act({ kind: "columns", columns: String(n) }) })),
    ],
  };
  const sized: LayoutMenuEntry[] = [];
  if (fit) {
    const min = minWidthChoice(now.min);
    // (Its own width in px the row's last choice: asked, or the one set shown)
    sized.push({
      kind: "segmented",
      label: "Min width",
      options: [
        ...(Object.keys(MIN_WIDTHS) as MinWidthName[]).map((name) => ({
          icon: name.toUpperCase(),
          title: `Columns at least ${MIN_WIDTHS[name]} px wide`,
          active: "name" in min && min.name === name,
          run: () => act({ kind: "min", min: name }),
        })),
        { icon: "custom" in min ? `${min.custom}px` : "px…", title: "Columns at least as wide as you give, in px", active: "custom" in min, run: () => act({ kind: "askMin" }) },
      ],
    });
  }
  return [
    [columns, ...sized],
    [
      { label: "Borders", checked: now.border, run: () => act({ kind: "border", on: !now.border }) },
      { label: "Add a column at the end", run: () => act({ kind: "addColumn" }) },
    ],
    [{ label: "Unwrap grid", run: () => act({ kind: "ungrid" }) }],
  ];
}

/**
 * The grid's own menu shown by a grip (its handle not shown: a phone's narrow pane, no handle beside a widget as wide
 * as the screen), its sections as made now; a choice that keeps it open (Auto) shown anew once it is done
 */
function showGridMenu(doc: Document, at: HTMLElement, sections: () => readonly (readonly LayoutMenuEntry[])[]): void {
  let close: (() => void) | undefined;
  const show = () => {
    const entries = sections().map((section) =>
      section.map((entry) =>
        "kind" in entry
          ? { ...entry, options: entry.options.map((option) => ({ ...option, run: () => void Promise.resolve(option.run()).then(() => option.keepsOpen && close && (close(), show())) })) }
          : { ...entry, run: () => void entry.run() },
      ),
    );
    close = showPopup(doc, POPUP, at, { title: "Grid", sections: entries }, () => (close = undefined));
  };
  show();
}

/**
 * A grip on each column of a grid drawn: `state` the grid as now, `act` what is chosen in a column's menu; `gridSections`
 * the grid's own sections where its handle is not shown (none where it is), a "Grid…" of the column's menu opening them
 * (the column's own actions alone in it, deleting it last)
 */
export function addColumnGrips(
  doc: Document,
  grid: HTMLElement,
  state: () => GridMenuState,
  act: (cell: number, action: CellAction) => void,
  gridSections: () => readonly (readonly LayoutMenuEntry[])[] = () => [],
): void {
  grid.querySelectorAll<HTMLElement>(":scope > .swl-grid-cell").forEach((cell, index) => {
    const grip = el(doc, "button", { class: "swl-grid-column-grip", title: "Column…", attrs: { type: "button", "aria-label": `Column ${index + 1}: its menu` } });
    opensMenu(doc, POPUP, grip, (): PopupMenu => {
      const now = state();
      const sections: GridMenuItem[][] = columnMenu(index, now, (action) => act(index, action));
      if (gridSections().length) sections.splice(sections.length - 1, 0, [{ label: "Grid…", run: () => showGridMenu(doc, grip, gridSections) }]);
      return { title: `Column ${index + 1} of ${now.cells}`, sections };
    });
    cell.append(grip);
  });
}
