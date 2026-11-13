// A grid's width laid out by Silverware Layout's handle, as any widget's (shared/layout.ts): the grid registers as a
// provider, its widget the frame the host draws it in (SilverBullet's, given the class `swl-grid-widget` by the init
// page; the playground's alike), its entries kept as attributes of its `<grid>` line (`width="1100"`), Layout's key
// as the attribute's name. Layout's core knows no grid: the binding registers this as a widget plugin would.
import type { LayoutChanges, LayoutEntries, LayoutProvider } from "../../../shared/layout.ts";
import type { Grids } from "./grids.ts";

// Layout's keys a grid keeps (its others are the grid's own: columns)
const LAYOUT_KEYS = ["width"] as const;

export function gridProvider(grids: Grids): LayoutProvider {
  const gridIn = (element: Element) => element.querySelector<HTMLElement>(":scope .swl-grid");
  return {
    name: "silverware-layout-grid",
    selector: ".swl-grid-widget",
    read: (element): LayoutEntries => {
      const grid = gridIn(element);
      const attributes = grid ? grids.attributesOf(grid) : {};
      return Object.fromEntries(LAYOUT_KEYS.flatMap((key) => (attributes[key] ? [[key, attributes[key]]] : [])));
    },
    write: async (element, changes: LayoutChanges) => {
      const grid = gridIn(element);
      if (!grid) return "the grid is not drawn";
      return grids.writeAttributes(grid, changes);
    },
  };
}
