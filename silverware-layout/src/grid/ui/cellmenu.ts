// A grid's cell's "…" (docs/silverware-layout-grid.md, *The grid's and a cell's "…" menu*): at the cell's top right as
// the pointer is over it (always on a touch screen), its menu what can be done with the cell (moved, a column added
// after it, moved out of the grid) and with the grid (its number of columns, a column added, the grid taken apart).
// One button a cell, not one for the grid besides: the two would lie at the same corner.
import { el } from "../../../../shared/elements.ts";
import { opensMenu, type PopupItem } from "../../ui/popupmenu.ts";

/** What a cell's menu does */
export type CellAction =
  | { readonly kind: "move"; readonly by: -1 | 1 }
  | { readonly kind: "addAfter" }
  | { readonly kind: "takeOut" }
  | { readonly kind: "columns"; readonly columns: string | null }
  | { readonly kind: "addColumn" }
  | { readonly kind: "ungrid" };

const COLUMN_CHOICES: readonly (readonly [string | null, string])[] = [
  [null, "Columns: automatic"],
  ["2", "2 columns"],
  ["3", "3 columns"],
  ["4", "4 columns"],
];

/** A "…" on each cell of a grid drawn: `state` the grid as now (its columns attribute, its number of cells), `act` what is chosen */
export function addCellMenus(doc: Document, grid: HTMLElement, state: () => { readonly columns: string | undefined; readonly cells: number }, act: (cell: number, action: CellAction) => void): void {
  grid.querySelectorAll<HTMLElement>(":scope > .swl-grid-cell").forEach((cell, index) => {
    const button = el(doc, "button", { class: "swl-grid-cell-more", title: "Column…", text: "…", attrs: { type: "button" } });
    opensMenu(doc, button, () => {
      const now = state();
      const item = (label: string, action: CellAction, disabled?: string): PopupItem => ({ label, run: () => act(index, action), ...(disabled ? { disabled } : {}) });
      return {
        title: `Column ${index + 1} of ${now.cells}`,
        sections: [
          [
            item("Move left", { kind: "move", by: -1 }, index === 0 ? "It is the first" : undefined),
            item("Move right", { kind: "move", by: 1 }, index === now.cells - 1 ? "It is the last" : undefined),
            item("Add a column after it", { kind: "addAfter" }),
            item("Move out of the grid", { kind: "takeOut" }),
          ],
          COLUMN_CHOICES.map(([columns, label]) => ({ label, checked: (now.columns ?? null) === columns, run: () => act(index, { kind: "columns", columns }) })),
          [item("Add a column at the end", { kind: "addColumn" }), item("Remove the grid, its content kept", { kind: "ungrid" })],
        ],
      };
    });
    cell.append(button);
  });
}
