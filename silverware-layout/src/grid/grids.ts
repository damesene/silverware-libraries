// The grids of a host's page (docs/silverware-layout-grid.md): each drawn as the host asks for it (SilverBullet: its
// custom syntax's renderer, given the grid's body), its cells' markdown rendered by the host, its columns as its
// `<grid>` line's attributes say. The host hands the renderer no attributes and draws a grid anew only as its body
// changes, so the attributes are read from the page's text, and set again on the grids drawn as the page changes
// (`refresh`): a `columns` edited shows without a new drawing.
//
// A click in a cell edits its markdown in place, written when the cell is left (one edit); an Alt+click shows the raw
// text with the cursor where the click was. Which of the page's grids a grid drawn is: the one of its body, by its
// order among the grids of that body drawn (core/match.ts).
import type { Attributes } from "../../../shared/markdown/attributes.ts";
import { type Grid, readGridBody, readGrids } from "../../../shared/markdown/grid.ts";
import { gridsOfBody } from "./core/match.ts";
import { positionInCell } from "./core/position.ts";
import { columnTemplate } from "./model/columns.ts";
import { RENDERED_VERSION, type Rendered, type RenderedItem, type RenderedRange } from "../../../shared/rendered.ts";
import { type Drawn, drawnIn, itemsOf } from "./drawn.ts";
import { addCellMenus, type CellAction } from "./ui/cellmenu.ts";
import { caretWord, editCell } from "./ui/celleditor.ts";
import { drawGrid, plainCell, showColumns } from "./ui/view.ts";

/** A cell to write: the grid by its body as read and its place among those alike, the cell, its new markdown */
export type CellWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly cell: number; readonly content: string };

/** A grid's attributes to write (a value, or null: taken off), the grid found as a cell's is */
export type AttributesWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly attributes: Readonly<Record<string, string | null>> };

/** A grid's cells to change (shared/pages' `GridCellsChange`, named here apart), the grid found as a cell's is */
export type CellsChange =
  | { readonly kind: "move"; readonly cell: number; readonly by: -1 | 1 }
  | { readonly kind: "add"; readonly after?: number }
  | { readonly kind: "takeOut"; readonly cell: number }
  | { readonly kind: "ungrid" };
export type CellsWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly cells: CellsChange };

/** What the grids ask of the host whose page they are in */
export type GridHost = {
  /** A cell's markdown rendered as the host renders a page (its elements marked with `data-pos`, their offsets in it) */
  renderMarkdown(text: string): Promise<string>;
  /** The page's text now */
  pageText(): Promise<string>;
  /** A cell's markdown written into the page (one edit); why not, as text */
  writeCell(write: CellWrite): Promise<string | undefined>;
  /** A grid's attributes written on its `<grid>` line (one edit); why not, as text */
  writeAttributes(write: AttributesWrite): Promise<string | undefined>;
  /** A grid's cells changed (one edit): moved, added, taken out, all taken apart; why not, as text */
  changeCells?(write: CellsWrite): Promise<string | undefined>;
  /** The page's cursor put at an offset in its text, the raw text shown there */
  moveCursor(at: number): void;
  /** A problem said to the user */
  problem(message: string): void;
  /** A grid's element handed to the host, which draws it in a frame of its own: the frame made bare once it is in the page (its menu) */
  settle?(element: HTMLElement): void;
};

// How long after a grid is drawn its attributes are read again (it is in the page by then, its order among its alike known)
const SETTLE_MS = 50;
// How far a press and its release are apart to be a drag that selects (px)
const DRAG_PX = 4;
// What a click in a cell leaves to the cell's rendering: a link, a tag, a button, a field, an editor open
const OWN_CLICKS = "a, button, input, textarea, select, label, [data-ref]";

/** A body or a cell's markdown as compared: its line breaks LF, no blank lines at its end */
const same = (text: string) => text.replace(/\r\n/g, "\n").replace(/\s+$/, "");

/**
 * Each cell marked with where its markdown is in the page (`data-swl-pos`, `data-swl-end`); whether any changed
 * (what the grid drew is told again then: shared/rendered.ts). Read by no one else: what is drawn and where is told
 */
function markPlaces(element: HTMLElement, grid: Grid): boolean {
  let changed = false;
  element.querySelectorAll<HTMLElement>(":scope > .swl-grid-cell").forEach((cellElement, index) => {
    const cell = grid.cells[index];
    if (!cell) return;
    if (cellElement.getAttribute("data-swl-pos") !== String(cell.contentFrom)) {
      cellElement.setAttribute("data-swl-pos", String(cell.contentFrom));
      changed = true;
    }
    if (cellElement.getAttribute("data-swl-end") !== String(cell.contentTo)) {
      cellElement.setAttribute("data-swl-end", String(cell.contentTo));
      changed = true;
    }
  });
  return changed;
}

/** `then` once an element is in the page: watched for a while, as a host puts what a renderer gives into the page a while later */
function whenConnected(element: HTMLElement, then: () => void, within = 30_000): void {
  if (element.isConnected) return then();
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  if (!win || !doc.body) return;
  const observer = new win.MutationObserver(() => {
    if (!element.isConnected) return;
    stop();
    then();
  });
  const timer = win.setTimeout(() => stop(), within);
  const stop = () => {
    observer.disconnect();
    win.clearTimeout(timer);
  };
  observer.observe(doc.body, { childList: true, subtree: true });
}

/** Whether two sets of attributes are the same */
function sameAttributes(a: Attributes | undefined, b: Attributes): boolean {
  if (!a) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

export class Grids {
  // Each grid drawn, its body (what it is found in the page by)
  private readonly bodies = new WeakMap<HTMLElement, string>();
  // Each grid drawn, its attributes as the page's text had them when last read (asked synchronously: its width)
  private readonly attributes = new WeakMap<HTMLElement, Attributes>();
  // Each grid drawn: what it drew in its cells (taken as drawn), and the grid in the page's text it was last found as
  private readonly drawnItems = new WeakMap<HTMLElement, readonly Drawn[]>();
  private readonly placed = new WeakMap<HTMLElement, Grid>();
  // What is drawn changed since last told (a grid drawn or placed anew), and who is told
  private changedSinceTold = false;
  private readonly listeners = new Set<(items: readonly RenderedItem[]) => void>();
  /** What the grids drew in their cells and where it is in the page, for another to decorate (shared/rendered.ts) */
  readonly rendered: Rendered = {
    version: RENDERED_VERSION,
    items: () => this.items(),
    ranges: () => this.ranges(),
    onChange: (listener) => {
      this.listeners.add(listener);
      return () => void this.listeners.delete(listener);
    },
  };
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  // The last press in a cell: its cell, where it was, the caret there
  private pressed: { readonly cell: HTMLElement; readonly x: number; readonly y: number; readonly caret: Caret | undefined } | undefined;
  private started = false;
  /** Told as a grid drawn gets other attributes than it had (its width typed by hand: laid out again) */
  onAttributes: (() => void) | undefined;

  constructor(
    private readonly doc: Document,
    private host: GridHost,
  ) {}

  /** The host's API handed over anew (the host's scripts loaded again): asked from now on */
  useHost(host: GridHost): void {
    this.host = host;
  }

  /** The clicks in the grids followed from now on (once per document: Space Lua loaded again starts nothing twice) */
  start(): void {
    if (this.started) return;
    this.started = true;
    // An Alt+click is the grid's before the host's (SilverBullet's puts the cursor at the grid's start): taken as the
    // press comes, its click after it held back too
    this.doc.addEventListener("mousedown", (event) => this.altPress(event), true);
    // Where a press in a cell was (a drag from there to where it is let go selects: its click follows the release)
    this.doc.addEventListener(
      "mousedown",
      (event) => {
        const at = event.button === 0 && !event.altKey ? this.gridOf(event.target) : undefined;
        this.pressed = at?.cell ? { cell: at.cell, x: event.clientX, y: event.clientY, caret: caretWord(this.doc, event.clientX, event.clientY) } : undefined;
        // The press the grid's, not the page editor's (its click handler not told of it: a click in a grid is the
        // grid's). (A field being edited, a link, a button: their own, as the click's)
        if (at?.cell && !at.cell.classList.contains("swl-grid-editing") && !(event.target as Element).closest(OWN_CLICKS)) event.stopPropagation();
      },
      true,
    );
    this.doc.addEventListener("click", (event) => {
      if (event.altKey && this.gridOf(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    this.doc.addEventListener("click", (event) => void this.click(event));
    // A task's box in a cell: the grid's to toggle in the cell's markdown (the host would toggle it elsewhere, or not)
    this.doc.addEventListener(
      "click",
      (event) => {
        const box = event.target instanceof Element ? event.target.closest<HTMLInputElement>('input[type="checkbox"]') : null;
        const at = box ? this.gridOf(box) : undefined;
        if (!box || !at?.cell || at.cell.classList.contains("swl-grid-editing")) return;
        event.preventDefault();
        event.stopPropagation();
        void this.toggleTask(at.element, at.cell, box);
      },
      true,
    );
  }

  /** A grid drawn of its body: its cells rendered by the host, its columns as the first grid of that body in the page has them */
  async render(body: string): Promise<HTMLElement> {
    const cells = readGridBody(body);
    const [html, text] = await Promise.all([
      Promise.all(cells.map((cell) => this.host.renderMarkdown(cell.content).catch(() => plainCell(this.doc, cell.content)))),
      this.host.pageText().catch(() => ""),
    ]);
    const first = gridsOfBody(text, body)[0];
    const attributes = first?.attributes ?? {};
    const element = drawGrid(this.doc, columnTemplate(attributes.columns, cells.length), html);
    this.bodies.set(element, body);
    this.attributes.set(element, attributes);
    // What it drew, before anything else touches it (another may frame a medium to decorate it)
    this.drawnItems.set(element, drawnIn(element));
    this.changedSinceTold = true;
    // Where its cells are in the page (the first grid of its body; set again as it is found among its alike)
    if (first) {
      markPlaces(element, first);
      this.placed.set(element, first);
    }
    // Each cell's "…": what can be done with it and with the grid
    if (this.host.changeCells) addCellMenus(this.doc, element, () => ({ columns: this.attributesOf(element).columns, cells: cells.length }), (cell, action) => void this.cellAction(element, cell, action));
    this.host.settle?.(element);
    // In the page, its order among the grids of its body is known: its own attributes then (and what it drew told)
    this.refreshSoon();
    whenConnected(element, () => this.refreshSoon());
    return element;
  }

  /**
   * A grid of another page's text drawn, as its own `<grid>` line says (a page embedded in this one, which the host
   * shows as text): its cells rendered, not edited here (it is no grid of this page: no click nor Alt+click is its)
   */
  async drawText(gridText: string): Promise<HTMLElement | undefined> {
    const grid = readGrids(gridText)[0];
    if (!grid) return undefined;
    const cells = readGridBody(grid.body);
    const html = await Promise.all(cells.map((cell) => this.host.renderMarkdown(cell.content).catch(() => plainCell(this.doc, cell.content))));
    const element = drawGrid(this.doc, columnTemplate(grid.attributes.columns, cells.length), html);
    element.classList.add("swl-grid-shown");
    return element;
  }

  /** The grids drawn given their attributes again, as the page's text has them now (a `<grid>` line edited) */
  async refresh(): Promise<void> {
    const drawn = this.drawn();
    if (!drawn.length) return;
    const text = await this.host.pageText().catch(() => undefined);
    if (text === undefined) return;
    let changed = false;
    for (const element of drawn) {
      const found = this.found(text, element);
      if (!found) continue;
      showColumns(element, columnTemplate(found.grid.attributes.columns, element.querySelectorAll(":scope > .swl-grid-cell").length));
      if (markPlaces(element, found.grid)) this.changedSinceTold = true;
      this.placed.set(element, found.grid);
      if (!sameAttributes(this.attributes.get(element), found.grid.attributes)) changed = true;
      this.attributes.set(element, found.grid.attributes);
    }
    if (changed) this.onAttributes?.();
    this.tell();
  }

  /** What the grids in the page drew, their places known */
  private items(): RenderedItem[] {
    return this.drawn().flatMap((element) => {
      const grid = this.placed.get(element);
      const drawn = this.drawnItems.get(element);
      return grid && drawn ? itemsOf(element, drawn, grid) : [];
    });
  }

  /** The ranges of the page's text the grids in the page drew, their cells' markdown */
  private ranges(): RenderedRange[] {
    return this.drawn().flatMap((element) => this.placed.get(element)?.cells.map((cell) => ({ from: cell.contentFrom, to: cell.contentTo })) ?? []);
  }

  /** Who listens told of what is drawn, where it changed since last told and some of it is in the page */
  private tell(): void {
    if (!this.changedSinceTold || !this.listeners.size) return;
    const items = this.items();
    if (!this.drawn().some((element) => this.placed.has(element))) return;
    this.changedSinceTold = false;
    for (const listener of this.listeners) {
      try {
        listener(items);
      } catch (error) {
        console.error("Silverware Layout: a listener of what grids draw failed", error);
      }
    }
  }

  /** A grid drawn's attributes as last read (none drawn: none) */
  attributesOf(element: HTMLElement): Attributes {
    return this.attributes.get(element) ?? {};
  }

  /** A grid drawn's attributes written (a value, or null: taken off); why not, as text */
  async writeAttributes(element: HTMLElement, attributes: Readonly<Record<string, string | null>>): Promise<string | undefined> {
    const text = await this.host.pageText().catch(() => undefined);
    const found = text === undefined ? undefined : this.found(text, element);
    if (!found) return "this grid changed in the page since it was drawn";
    const problem = await this.host.writeAttributes({ body: found.grid.body, occurrence: found.occurrence, of: found.of, attributes });
    if (problem) return problem;
    // As written (no new drawing comes: the body is the same)
    const kept: Record<string, string> = { ...this.attributesOf(element) };
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) delete kept[name];
      else kept[name] = value;
    }
    this.attributes.set(element, kept);
    return undefined;
  }

  /** What a cell's menu chose, written: the grid's columns as an attribute, a change of its cells by the host */
  async cellAction(element: HTMLElement, cell: number, action: CellAction): Promise<void> {
    const said = (problem: string | undefined) => problem && this.host.problem(`Silverware Layout: the grid was not changed: ${problem}`);
    if (action.kind === "columns") return void said(await this.writeAttributes(element, { columns: action.columns }));
    const text = await this.host.pageText().catch(() => undefined);
    const found = text === undefined ? undefined : this.found(text, element);
    if (!found || !this.host.changeCells) return void said("this grid changed in the page since it was drawn");
    const cells: CellsChange =
      action.kind === "move" ? { kind: "move", cell, by: action.by } : action.kind === "addAfter" ? { kind: "add", after: cell } : action.kind === "takeOut" ? { kind: "takeOut", cell } : action.kind === "addColumn" ? { kind: "add" } : { kind: "ungrid" };
    said(await this.host.changeCells({ body: found.grid.body, occurrence: found.occurrence, of: found.of, cells }).catch((error: unknown) => (error instanceof Error ? error.message : String(error))));
  }

  /** `refresh` a moment later, once (several asked at once: one) */
  refreshSoon(): void {
    if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.refresh();
    }, SETTLE_MS);
  }

  /** The grids drawn in the page, in its order */
  private drawn(): HTMLElement[] {
    return [...this.doc.querySelectorAll<HTMLElement>(".swl-grid")].filter((element) => this.bodies.has(element));
  }

  /** A grid drawn as the page's text has it: the grid, its place among those of its body, how many those are */
  private found(text: string, element: HTMLElement): { readonly grid: Grid; readonly occurrence: number; readonly of: number } | undefined {
    const body = this.bodies.get(element);
    if (body === undefined) return undefined;
    const nth = this.drawn().filter((one) => this.bodies.get(one) === body).indexOf(element);
    const alike = gridsOfBody(text, body);
    if (!alike.length) return undefined;
    const occurrence = Math.min(Math.max(nth, 0), alike.length - 1);
    return { grid: alike[occurrence]!, occurrence, of: alike.length };
  }

  /** The grid drawn and its cell a node is in (none: not in a grid of these) */
  private gridOf(target: EventTarget | null): { readonly element: HTMLElement; readonly cell: HTMLElement | undefined } | undefined {
    if (!(target instanceof Element)) return undefined;
    const element = target.closest<HTMLElement>(".swl-grid");
    if (!element || !this.bodies.has(element)) return undefined;
    return { element, cell: target.closest<HTMLElement>(".swl-grid-cell") ?? undefined };
  }

  /** A click in a cell, not on what its rendering handles itself: the cell edited */
  private async click(event: MouseEvent): Promise<void> {
    if (event.altKey || event.button !== 0 || event.defaultPrevented) return;
    const at = this.gridOf(event.target);
    if (!at?.cell || at.cell.classList.contains("swl-grid-editing")) return;
    if ((event.target as Element).closest(OWN_CLICKS)) return;
    // Where the click was, read before the cell's rendering gives way to its field; text selected in the cell by a
    // drag (its click comes as the button is let go) taken over as the field's selection
    // (The browser's selection where it kept one: in a page's editor it may not, CodeMirror's own taking its place; else
    // the press and the release, where they were apart)
    const caret = caretWord(this.doc, event.clientX, event.clientY);
    const selection = this.doc.getSelection();
    const pressed = this.pressed;
    this.pressed = undefined;
    const selected =
      selection && !selection.isCollapsed && selection.anchorNode && selection.focusNode && at.cell.contains(selection.anchorNode) && at.cell.contains(selection.focusNode)
        ? { anchor: { node: selection.anchorNode, offset: selection.anchorOffset }, focus: { node: selection.focusNode, offset: selection.focusOffset } }
        : pressed && pressed.cell === at.cell && pressed.caret && caret && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > DRAG_PX
          ? { anchor: pressed.caret, focus: caret }
          : undefined;
    const point = { target: event.target as Element, caret, ...(selected ? { selected } : {}) };
    await this.edit(at.element, at.cell, point);
  }

  /** A task's box in a cell clicked: its state in the cell's markdown toggled (`[ ]` done `[x]`, any other undone), written */
  async toggleTask(element: HTMLElement, cellElement: HTMLElement, box: HTMLElement): Promise<void> {
    const index = Number(cellElement.getAttribute("data-swl-cell"));
    const text = await this.host.pageText().catch(() => undefined);
    const found = text === undefined ? undefined : this.found(text, element);
    const cell = found?.grid.cells[index];
    if (!found || !cell) return this.host.problem("Silverware Layout: this grid changed in the page since it was drawn; toggle the task there");
    const content = toggledTask(cell.content, Number(box.getAttribute("data-pos")) || 0);
    if (content === undefined) return this.host.problem("Silverware Layout: the task was not found in the column's markdown");
    const problem = await this.host.writeCell({ body: found.grid.body, occurrence: found.occurrence, of: found.of, cell: index, content }).catch((error: unknown) => (error instanceof Error ? error.message : String(error)));
    if (problem) this.host.problem(`Silverware Layout: the task was not toggled: ${problem}`);
  }

  /** A cell's markdown edited in place, the cursor where a click was in its rendering (none: at its end), written as it is left where it changed */
  async edit(element: HTMLElement, cellElement: HTMLElement, point?: CellPoint): Promise<void> {
    const index = Number(cellElement.getAttribute("data-swl-cell"));
    const text = await this.host.pageText().catch(() => undefined);
    const found = text === undefined ? undefined : this.found(text, element);
    const cell = found?.grid.cells[index];
    if (!found || !cell) {
      this.host.problem("Silverware Layout: this grid changed in the page since it was drawn; edit it there");
      return;
    }
    const at = !point ? undefined : point.selected ? selectionInCell(cell.content, cellElement, point.selected) : offsetInCell(cell.content, cellElement, point.target, point.caret);
    editCell(cellElement, cell.content, at, (content) => {
      if (same(content) === same(cell.content)) return;
      void this.host
        .writeCell({ body: found.grid.body, occurrence: found.occurrence, of: found.of, cell: index, content })
        .then((problem) => problem && this.host.problem(`Silverware Layout: the cell was not written: ${problem}`))
        .catch((error: unknown) => this.host.problem(`Silverware Layout: the cell was not written: ${error instanceof Error ? error.message : String(error)}`));
    });
  }

  /** An Alt+press in a cell: the raw text shown, the cursor where it was in the cell's markdown */
  private altPress(event: MouseEvent): void {
    if (!event.altKey || event.button !== 0) return;
    const at = this.gridOf(event.target);
    if (!at) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const caret = caretWord(this.doc, event.clientX, event.clientY);
    void this.showSource(at.element, at.cell, event.target as Element, caret);
  }

  /** The cursor put where a point of a cell's rendering is in the page's text (no cell: at the grid's start) */
  async showSource(element: HTMLElement, cellElement: HTMLElement | undefined, target: Element, caret: { readonly node: Node; readonly offset: number } | undefined): Promise<void> {
    const text = await this.host.pageText().catch(() => undefined);
    const found = text === undefined ? undefined : this.found(text, element);
    if (!found) return;
    const cell = cellElement ? found.grid.cells[Number(cellElement.getAttribute("data-swl-cell"))] : undefined;
    if (!cell) return this.host.moveCursor(found.grid.from);
    this.host.moveCursor(cell.contentFrom + offsetInCell(cell.content, cellElement!, target, caret));
  }
}

/** A cell's markdown with the task whose state is at `at` (its `[`, the box's `data-pos`) toggled; none where no state is there */
export function toggledTask(content: string, at: number): string | undefined {
  const state = /^\[(.)\]/.exec(content.slice(at));
  if (!state) return undefined;
  return content.slice(0, at + 1) + (state[1] === " " ? "x" : " ") + content.slice(at + 2);
}

/** Where a click was in a cell's rendering: the element, the caret there, and the text selected in the cell, where some was */
type Caret = { readonly node: Node; readonly offset: number };
export type CellPoint = { readonly target: Element; readonly caret: Caret | undefined; readonly selected?: { readonly anchor: Caret; readonly focus: Caret } };

/** A selection in a cell's rendering as one of its markdown: each end where it is there, its direction kept */
function selectionInCell(content: string, cellElement: HTMLElement, selected: { readonly anchor: Caret; readonly focus: Caret }): { readonly from: number; readonly to: number; readonly backward: boolean } {
  const end = (caret: Caret) => offsetInCell(content, cellElement, caret.node instanceof Element ? caret.node : (caret.node.parentElement ?? cellElement), caret);
  const anchor = end(selected.anchor);
  const focus = end(selected.focus);
  return { from: Math.min(anchor, focus), to: Math.max(anchor, focus), backward: focus < anchor };
}

/**
 * Where a point of a cell's rendering is in its markdown: the element it is in that is marked with its place
 * (`data-pos`; SilverBullet leaves 0 out: the cell's first block, unmarked, is at 0), and how far into that element's
 * text the point is, followed through the markdown from there (core/position.ts)
 */
function offsetInCell(content: string, cellElement: HTMLElement, target: Element, caret: Caret | undefined): number {
  const from = caret ? (caret.node instanceof Element ? caret.node : caret.node.parentElement) ?? target : target;
  const marked = from.closest("[data-pos]");
  const element = marked && cellElement.contains(marked) ? marked : ([...cellElement.children].find((child) => child.contains(from)) ?? cellElement);
  const elementPos = element === marked ? Number(marked.getAttribute("data-pos")) || 0 : 0;
  if (!caret || !element.contains(caret.node)) return positionInCell(content, elementPos, "", 0);
  // The element's text before the point
  const range = cellElement.ownerDocument.createRange();
  range.setStart(element, 0);
  range.setEnd(caret.node, caret.offset);
  return positionInCell(content, elementPos, element.textContent ?? "", range.toString().length);
}
