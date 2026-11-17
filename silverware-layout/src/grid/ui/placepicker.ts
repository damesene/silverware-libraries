// The place in a grid text moved into it goes, picked by the user (Move to grid, docs/silverware-layout-grid.md
// *Moving text into a grid*): the grids outlined, a mark following the pointer where it would go (a line between cells
// for new cells, labelled with how many; a line in a cell where its blocks meet, the cell outlined, to add it there),
// a bar saying what to do with Cancel. A click picks; on a touch screen a tap shows the mark and a second tap on the
// same place picks it. Esc, Cancel or a click away from the grids gives up. Every press over a grid is the picker's
// while it is shown (taken at the window's capture, before the grids' and the host's own), one away from them is
// left alone. What a point picks is core/placepick.ts'.
import { el } from "../../../../shared/elements.ts";
import type { GridPlace } from "../../../../shared/markdown/gridbuild.ts";
import { type Box, type CellShape, distanceTo, type GridShape, NEAR_PX, pickAt, type PickedPlace, samePick } from "../core/placepick.ts";
import { isMarked, offsetOf } from "./offsets.ts";
import { drawnBlocks } from "./cellparts.ts";

/** What is picked for */
export type PickRequest = {
  // The grids drawn in the page, in its order (asked anew as they are drawn anew)
  readonly grids: () => readonly HTMLElement[];
  // Whether it may go into a cell too (else new cells alone), and how many new cells it makes
  readonly into: boolean;
  readonly cells: number;
  // What the bar says is moved ("3 blocks")
  readonly what: string;
};

/** A place picked: the grid drawn, where in it */
export type Picked = { readonly grid: HTMLElement; readonly place: GridPlace };

/** A pick going on: its answer (none: given up), and how to give it up from outside (the page changed) */
export type Picking = { readonly picked: Promise<Picked | undefined>; cancel(): void };

// The root marked while picking (the grids outlined, their own controls hidden: the style page)
const PICKING = "data-swl-picking";
// A cell the text would go into
const TARGET_CELL = "swl-grid-pick-cell";
/** A grid as drawn now, measured */
function shapeOf(grid: HTMLElement): GridShape {
  const win = grid.ownerDocument.defaultView;
  const style = win?.getComputedStyle(grid);
  const tracks = style?.gridTemplateColumns.split(/\s+/).filter(Boolean).length ?? 1;
  const cells: CellShape[] = [...grid.querySelectorAll<HTMLElement>(":scope > .swl-grid-cell")].map((cell) => ({
    box: cell.getBoundingClientRect(),
    // (Its blocks as its rendering has them: the first at the cell's start, each other one marked with its offset)
    blocks: drawnBlocks(cell)
      .filter((child, i) => i === 0 || isMarked(child))
      .map((child) => ({ offset: offsetOf(child), box: child.getBoundingClientRect() }))
      .filter((block) => block.box.bottom > block.box.top),
  }));
  return { box: grid.getBoundingClientRect(), cells, sideBySide: tracks > 1, columnGap: parseFloat(style?.columnGap ?? "") || 0, rowGap: parseFloat(style?.rowGap ?? "") || 0 };
}

/** The place in a grid the user picks */
export function pickPlace(doc: Document, request: PickRequest): Picking {
  const win = doc.defaultView ?? window;
  const coarse = win.matchMedia?.("(pointer: coarse)").matches ?? false;
  const press = coarse ? "Tap" : "Click";
  const hint = request.into
    ? `${press} between cells for a new cell, or in a cell to add it there`
    : `${press} between cells: ${request.cells === 1 ? "a new cell goes" : `${request.cells} new cells go`} there`;
  let finish: (picked: Picked | undefined) => void = () => {};
  const picked = new Promise<Picked | undefined>((resolve) => (finish = resolve));
  const cancel = () => end(undefined);
  const bar = el(
    doc,
    "div",
    { class: "swl-pick-bar", attrs: { role: "status" } },
    el(doc, "span", { class: "swl-pick-bar-text" }, el(doc, "strong", { text: `Move ${request.what} into a grid` }), el(doc, "span", { text: `${hint}. ${coarse ? "Tap again to confirm." : "Esc cancels."}` })),
    el(doc, "button", { class: "swl-pick-bar-cancel", text: "Cancel", run: cancel }),
  );
  const line = el(doc, "div", { class: "swl-pick-mark", attrs: { hidden: "", "aria-hidden": "true" } });
  const label = el(doc, "div", { class: "swl-pick-label", attrs: { hidden: "", "aria-hidden": "true" } });
  doc.body.append(bar, line, label);
  doc.documentElement.setAttribute(PICKING, "");

  // What is shown now (a tap's, which a second tap on it confirms), the cell outlined, and where the pointer last was
  let shown: { readonly grid: HTMLElement; readonly pick: PickedPlace } | undefined;
  let outlined: HTMLElement | undefined;
  let pointer: { readonly x: number; readonly y: number } | undefined;
  // Whether the press going on is a touch's (a click may not say: an older browser's is a mouse event), and a second
  // tap on the place shown (it picks it)
  let touching = false;
  let confirming = false;

  /** What a point picks: the grid it is over or near (the nearest of those), where in it */
  const pickOf = (x: number, y: number): { readonly grid: HTMLElement; readonly pick: PickedPlace } | undefined => {
    let nearest: { readonly grid: HTMLElement; readonly shape: GridShape; readonly distance: number } | undefined;
    for (const grid of request.grids()) {
      if (!grid.isConnected) continue;
      const shape = shapeOf(grid);
      const distance = distanceTo(shape.box, x, y);
      if (distance <= NEAR_PX && (!nearest || distance < nearest.distance)) nearest = { grid, shape, distance };
    }
    return nearest && { grid: nearest.grid, pick: pickAt(nearest.shape, x, y, request.into) };
  };

  const place = (element: HTMLElement, box: Box) => {
    element.style.left = `${box.left}px`;
    element.style.top = `${box.top}px`;
    element.style.width = `${Math.max(0, box.right - box.left)}px`;
    element.style.height = `${Math.max(0, box.bottom - box.top)}px`;
  };

  /** The mark drawn for what is picked (none: none) */
  const show = (at: { readonly grid: HTMLElement; readonly pick: PickedPlace } | undefined) => {
    shown = at;
    const cell = at?.pick.mark.kind === "inside" ? at.grid.querySelectorAll<HTMLElement>(":scope > .swl-grid-cell")[at.pick.mark.cell] : undefined;
    if (cell !== outlined) {
      outlined?.classList.remove(TARGET_CELL);
      cell?.classList.add(TARGET_CELL);
      outlined = cell;
    }
    line.hidden = label.hidden = !at;
    if (!at) return;
    const { mark } = at.pick;
    const vertical = mark.kind === "between" && mark.vertical;
    line.setAttribute("data-swl-pick", mark.kind === "inside" ? "inside" : vertical ? "between-columns" : "between-rows");
    // (A line 4 px thick, centred where it goes)
    place(line, vertical ? { left: mark.at - 2, right: mark.at + 2, top: mark.from, bottom: mark.to } : { left: mark.from, right: mark.to, top: mark.at - 2, bottom: mark.at + 2 });
    label.textContent = mark.kind === "inside" ? "Into this cell" : request.cells === 1 ? "New cell" : `${request.cells} new cells`;
    const width = label.offsetWidth;
    const height = label.offsetHeight;
    // (Into a cell: on its outline's top edge at its left, as a legend, off the text; else above where it goes, a
    // column's line at its top, a row's at its middle, under it where the window's top is near)
    const cellTop = cell?.getBoundingClientRect().top;
    const x = cellTop !== undefined ? mark.from + 8 + width / 2 : vertical ? mark.at : (mark.from + mark.to) / 2;
    const top = cellTop !== undefined ? cellTop + height / 2 + 2 : vertical ? mark.from : mark.at;
    const above = top - height - 8;
    label.style.left = `${Math.min(Math.max(4, x - width / 2), win.innerWidth - width - 4)}px`;
    label.style.top = `${above >= 4 ? above : top + 10}px`;
  };

  const inBar = (target: EventTarget | null) => target instanceof Node && bar.contains(target);
  const hold = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const listeners: [string, (event: never) => void, AddEventListenerOptions][] = [
    [
      "pointermove",
      (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        pointer = { x: event.clientX, y: event.clientY };
        show(pickOf(event.clientX, event.clientY));
      },
      { capture: true },
    ],
    [
      "pointerdown",
      (event: PointerEvent) => {
        if (inBar(event.target)) return;
        const at = pickOf(event.clientX, event.clientY);
        if (!at) return;
        // (Over a grid the picker's: no cell edited, no divider dragged, the page's editor keeps its selection)
        hold(event);
        touching = event.pointerType === "touch";
        confirming = touching && shown?.grid === at.grid && samePick(shown.pick, at.pick);
        if (touching) show(at);
      },
      { capture: true },
    ],
    ["mousedown", (event: MouseEvent) => !inBar(event.target) && pickOf(event.clientX, event.clientY) && hold(event), { capture: true }],
    ["mouseup", (event: MouseEvent) => !inBar(event.target) && pickOf(event.clientX, event.clientY) && hold(event), { capture: true }],
    [
      "click",
      (event: MouseEvent) => {
        if (inBar(event.target)) return;
        const at = pickOf(event.clientX, event.clientY);
        // (A click away from the grids gives up, and is the page's as ever)
        if (!at) return cancel();
        hold(event);
        // (A tap shows where; a second on the same place picks it)
        if (touching && !confirming) return show(at);
        end({ grid: at.grid, place: at.pick.place });
      },
      { capture: true },
    ],
    ["dblclick", (event: MouseEvent) => !inBar(event.target) && pickOf(event.clientX, event.clientY) && hold(event), { capture: true }],
    [
      "keydown",
      (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        hold(event);
        cancel();
      },
      { capture: true },
    ],
    // (Scrolled or resized: the mark follows the place under a mouse's pointer; a tap's is gone, the place moved off it)
    ["scroll", () => moved(), { capture: true, passive: true }],
    ["resize", () => moved(), { passive: true }],
  ];
  function moved(): void {
    if (pointer && !touching) show(pickOf(pointer.x, pointer.y));
    else if (shown) show(undefined);
  }
  for (const [type, listener, options] of listeners) win.addEventListener(type, listener as EventListener, options);

  let ended = false;
  function end(result: Picked | undefined): void {
    if (ended) return;
    ended = true;
    for (const [type, listener, options] of listeners) win.removeEventListener(type, listener as EventListener, options);
    outlined?.classList.remove(TARGET_CELL);
    bar.remove();
    line.remove();
    label.remove();
    doc.documentElement.removeAttribute(PICKING);
    finish(result);
  }
  return { picked, cancel };
}
