// The dividers between a grid's columns (docs/silverware-layout-grid.md, *Column widths*): a quiet line in the gap
// between two columns, plain as the pointer is over it, dragged to change the two columns' shares (their sum kept, the
// others as they are), snapping to the usual ratios (model/columns.ts), each ratio's place a quiet dashed guide in the
// grid while it is dragged (the one snapped to plain), the ratio or the shares said by the divider as it moves; a double click makes the two even. What is dragged is shown at once (the grid's column template); written
// as the `columns` attribute on release. Where the columns are is read from the grid as laid out (its computed template
// and gap), so any `columns` (a count, shares, %, px) and any number of rows are taken alike. A grid of one column (a
// narrow pane stacks its cells) has none.
import { el } from "../../../../shared/elements.ts";
import { columnsOf, dividedWidths, type DividerPlace, ratioPlaces, templateOf, withinShares } from "../model/columns.ts";
import { showColumns } from "./view.ts";

const DIVIDER = "swl-grid-divider";
const LABEL = "swl-grid-divider-label";
const DRAGGING = "data-swl-dragging";
const GUIDE = "swl-grid-guide";
const GUIDE_NEAR = "swl-grid-guide-near";
// The narrowest share a ratio's guide is shown for (as dividedWidths lets a column be)
const MIN_SHARE = 0.1;

/** The columns of a grid as laid out: each one's width and the gap between them (px) */
function laidOut(grid: HTMLElement): { readonly widths: number[]; readonly gap: number } {
  const style = getComputedStyle(grid);
  const widths = style.gridTemplateColumns
    .split(/\s+/)
    .map((track) => parseFloat(track))
    .filter((width) => Number.isFinite(width));
  const gap = parseFloat(style.columnGap) || 0;
  return { widths, gap };
}

/** Where each divider is (px from the grid's left edge): the middle of each gap between two columns */
function dividerPlaces(widths: readonly number[], gap: number): number[] {
  const places: number[] = [];
  let at = 0;
  for (let i = 0; i < widths.length - 1; i++) {
    at += widths[i]!;
    places.push(at + gap / 2);
    at += gap;
  }
  return places;
}

// The name of the places by the text's edges
const TEXT_EDGE = "Page width";

/** What the label says: the ratio snapped to (`2 : 1`), the text's edge, else the two columns' shares of their sum (`40 % · 60 %`) */
function said(first: number, second: number, ratio: readonly [number, number] | undefined, name: string | undefined): string {
  if (ratio) return `${ratio[0]} : ${ratio[1]}`;
  if (name) return name;
  const share = Math.round((first / (first + second)) * 100);
  return `${share} % · ${100 - share} %`;
}

/**
 * Dividers on a grid drawn, placed as the pointer comes over it (and as one is dragged): `write` gets the `columns`
 * to write on release (the widths as dragged, written as simply as they can be), or `even` for columns all even;
 * `textEdges` where the page's text is (x in the window), a column's edge snapping to it too (a grid wider than the
 * text: its column lined up with the text above and below it)
 */
export function addColumnDividers(doc: Document, grid: HTMLElement, write: (columns: string, even: boolean) => void, textEdges?: () => { readonly left: number; readonly right: number } | undefined): void {
  let dividers: HTMLElement[] = [];
  const place = () => {
    const { widths, gap } = laidOut(grid);
    const places = widths.length > 1 ? dividerPlaces(widths, gap) : [];
    while (dividers.length > places.length) dividers.pop()!.remove();
    while (dividers.length < places.length) {
      const index = dividers.length;
      const divider = el(doc, "div", { class: DIVIDER, attrs: { role: "separator", "aria-orientation": "vertical", title: "Drag to change the columns' widths; double-click to make them even" } });
      watch(divider, index);
      dividers.push(divider);
      grid.append(divider);
    }
    dividers.forEach((divider, i) => divider.style.setProperty("left", `${places[i]}px`));
  };
  const watch = (divider: HTMLElement, index: number) => {
    let drag: { readonly pointer: number; readonly x: number; readonly widths: number[] } | undefined;
    let label: HTMLElement | undefined;
    // The guides of the places the two columns' divider snaps to: each ratio's, the text's edges
    let guides: { readonly element: HTMLElement; readonly ratio?: readonly [number, number]; readonly name?: string }[] = [];
    // The places by the text's edges, from the first column's left edge
    let others: DividerPlace[] = [];
    let now: number[] | undefined;
    divider.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      // (The grid's own: no cell edited, nothing of the editor's under it)
      event.preventDefault();
      event.stopPropagation();
      drag = { pointer: event.pointerId, x: event.clientX, widths: laidOut(grid).widths };
      now = undefined;
      divider.setPointerCapture?.(event.pointerId);
      divider.setAttribute(DRAGGING, "");
      label = el(doc, "div", { class: LABEL });
      divider.append(label);
      // Each ratio's place, from the first of the two columns' left edge (the dividers' places say where it starts)
      const { widths, gap } = laidOut(grid);
      const start = widths.slice(0, index).reduce((sum, width) => sum + width + gap, 0);
      const sum = widths[index]! + widths[index + 1]!;
      const shown = new Set<number>();
      guides = ratioPlaces(sum).flatMap(({ ratio, at }) => {
        // (One a place: 1 : 1 alone of its equals; none narrower than a column may be made)
        if (at < sum * MIN_SHARE || at > sum * (1 - MIN_SHARE) || shown.has(Math.round(at))) return [];
        shown.add(Math.round(at));
        const element = el(doc, "div", { class: GUIDE }, el(doc, "span", { class: `${GUIDE}-label`, text: `${ratio[0]} : ${ratio[1]}` }));
        element.style.setProperty("left", `${start + at + gap / 2}px`);
        grid.append(element);
        return [{ element, ratio }];
      });
      // The text's edges: the first column's right edge on the text's right one, the second's left edge on its left
      // one (a column lined up with the text above and below the grid); their guides where the divider will be, as
      // the ratios' (the gap's middle: a guide on the column's edge itself stood apart from the divider snapped to it)
      const text = textEdges?.();
      const left = grid.getBoundingClientRect().left + start;
      others = text
        ? [
            { at: text.right - left, name: TEXT_EDGE },
            { at: text.left - left - gap, name: TEXT_EDGE },
          ]
            .filter((one) => withinShares(one.at, sum) && !shown.has(Math.round(one.at)))
            .map(({ at, name }) => {
              const element = el(doc, "div", { class: `${GUIDE} ${GUIDE}-text` }, el(doc, "span", { class: `${GUIDE}-label`, text: name }));
              element.style.setProperty("left", `${start + at + gap / 2}px`);
              grid.append(element);
              guides.push({ element, name: `${name}@${Math.round(at)}` });
              return { at, name: `${name}@${Math.round(at)}` };
            })
        : [];
    });
    divider.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      const [first, second] = [drag.widths[index]!, drag.widths[index + 1]!];
      const moved = dividedWidths(first, second, event.clientX - drag.x, others);
      now = drag.widths.map((width, i) => (i === index ? moved.first : i === index + 1 ? moved.second : width));
      showColumns(grid, templateOf(now));
      if (label) label.textContent = said(moved.first, moved.second, moved.ratio, moved.name?.split("@")[0]);
      for (const guide of guides) {
        const near = guide.ratio ? !!moved.ratio && guide.ratio[0] === moved.ratio[0] && guide.ratio[1] === moved.ratio[1] : !!guide.name && guide.name === moved.name;
        guide.element.classList.toggle(GUIDE_NEAR, near);
      }
      place();
    });
    const end = (event: PointerEvent, keep: boolean) => {
      if (!drag || event.pointerId !== drag.pointer) return;
      drag = undefined;
      divider.removeAttribute(DRAGGING);
      label?.remove();
      label = undefined;
      for (const guide of guides) guide.element.remove();
      guides = [];
      if (keep && now) write(columnsOf(now), false);
    };
    divider.addEventListener("pointerup", (event) => end(event, true));
    divider.addEventListener("pointercancel", (event) => end(event, false));
    // (A click on it is no click in a cell)
    divider.addEventListener("click", (event) => event.stopPropagation());
    divider.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      const widths = laidOut(grid).widths;
      const pair = (widths[index]! + widths[index + 1]!) / 2;
      const even = widths.map((width, i) => (i === index || i === index + 1 ? pair : width));
      showColumns(grid, templateOf(even));
      const columns = columnsOf(even);
      write(columns, /^\d+$/.test(columns));
    });
  };
  grid.addEventListener("pointerenter", place);
  // (A pointer's first press, a touch screen's: placed then)
  grid.addEventListener("pointerdown", place, { capture: true });
}
