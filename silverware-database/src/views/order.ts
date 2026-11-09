// A row's place by hand, from the views that list items one under another (the
// table, the list): its grip dragged among the rows (shared/drag.ts: the others
// sliding aside, by mouse or finger), or Alt+↑ ↓ on it; written as the item's
// place before or after its new neighbour (the core ranks it there). The grip
// does nothing while the view is sorted: an order by hand would not show.
import { reorder } from "../../../shared/drag.ts";
import { el } from "../../../shared/elements.ts";
import type { ViewHost } from "../core/view.ts";
import type { Item } from "../model/database.ts";
import { svg } from "./icons.ts";

const GRIP = svg('<circle cx="6" cy="4" r="1.1" fill="currentColor"/><circle cx="10" cy="4" r="1.1" fill="currentColor"/><circle cx="6" cy="8" r="1.1" fill="currentColor"/><circle cx="10" cy="8" r="1.1" fill="currentColor"/><circle cx="6" cy="12" r="1.1" fill="currentColor"/><circle cx="10" cy="12" r="1.1" fill="currentColor"/>');

/**
 * An item's grip: `row` (an element of `container`'s, matched by `selector`, each with its item's key as `data-item`)
 * dragged to its place among them, or moved one up or down by Alt+↑ ↓
 */
export function rowGrip(host: ViewHost, item: Item, row: () => HTMLElement, container: () => HTMLElement, selector: string): HTMLElement {
  const doc = host.document;
  const sorted = host.listing.sort.length > 0;
  const grip = el(doc, "button", {
    class: "swd-row-grip",
    html: GRIP,
    title: "Drag to move (Alt+↑ ↓)",
    attrs: { "aria-label": `Move ${item.name} (Alt+Up, Alt+Down)`, ...(sorted ? { disabled: "" } : {}) },
  });
  if (sorted) return grip;
  const keysOf = () => [...container().querySelectorAll<HTMLElement>(selector)].map((one) => one.dataset.item ?? "");
  // To `index` among the others (the order before the move: a drag moves the row as it goes); its place where it is: nothing written
  const moveTo = (index: number, keys: readonly string[]) => {
    const from = keys.indexOf(item.key);
    const others = keys.filter((key) => key !== item.key);
    const to = Math.max(0, Math.min(others.length, index));
    // (Where it was: nothing written, the row where it was)
    if (to === from) return;
    const byKey = (key: string | undefined) => host.items.find((one) => one.key === key);
    const before = byKey(others[to]);
    const after = byKey(others[to - 1]);
    const box = row().closest(".swd-place-body");
    // (In its group, where the view draws groups: an item in several, a multi-select's, has a row in each)
    const group = row().closest<HTMLElement>("[data-group]")?.dataset.group;
    void host.move(item, before ? { before } : after ? { after } : {}).then(() => {
      // The focus back on its grip, the view drawn anew (a keyboard's user goes on from there)
      const within = group === undefined ? box : box?.querySelector(`[data-group="${CSS.escape(group)}"]`);
      within?.querySelector<HTMLElement>(`[data-item="${CSS.escape(item.key)}"] .swd-row-grip`)?.focus({ preventScroll: true });
    });
  };
  grip.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const keys = keysOf();
    const dragged = row();
    // Where it was: put back there where the drag is cancelled (Esc) or comes to nothing
    const parent = dragged.parentElement;
    const next = dragged.nextSibling;
    // Its cells held at their widths while it is dragged: the copy following the pointer is drawn as the row is (a table's row
    // out of its table would shrink each cell to its content)
    const cells = [...dragged.children].filter((one): one is HTMLElement => one instanceof HTMLElement);
    for (const cell of cells) cell.style.width = `${cell.getBoundingClientRect().width}px`;
    const putBack = () => {
      if (dragged.isConnected && parent && dragged.parentElement === parent && dragged.nextSibling !== next) parent.insertBefore(dragged, next);
    };
    reorder(event, {
      element: dragged,
      base: "swd-rows",
      flow: "block",
      containers: () => [container()],
      items: (box) => [...box.querySelectorAll<HTMLElement>(selector)],
      done: (to) => {
        for (const cell of cells) cell.style.removeProperty("width");
        // The view drawn anew while it was dragged (the data changed): where it was let go means nothing now, nothing written
        if (!dragged.isConnected) return void host.refresh();
        if (!to) return putBack();
        moveTo(to.index, keys);
      },
    });
  });
  grip.addEventListener("keydown", (event) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const keys = keysOf();
    const at = keys.indexOf(item.key);
    moveTo(at + (event.key === "ArrowUp" ? -1 : 1), keys);
  });
  return grip;
}
