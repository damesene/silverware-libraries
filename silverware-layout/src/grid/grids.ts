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
import { type Grid, readGridBody } from "../../../shared/markdown/grid.ts";
import { gridsOfBody } from "./core/match.ts";
import { positionInCell, wordAt } from "./core/position.ts";
import { columnTemplate } from "./model/columns.ts";
import { caretWord, editCell } from "./ui/celleditor.ts";
import { drawGrid, plainCell, showColumns } from "./ui/view.ts";

/** A cell to write: the grid by its body as read and its place among those alike, the cell, its new markdown */
export type CellWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly cell: number; readonly content: string };

/** A grid's attributes to write (a value, or null: taken off), the grid found as a cell's is */
export type AttributesWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly attributes: Readonly<Record<string, string | null>> };

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
  /** The page's cursor put at an offset in its text, the raw text shown there */
  moveCursor(at: number): void;
  /** A problem said to the user */
  problem(message: string): void;
  /** A grid's element handed to the host, which draws it in a frame of its own: the frame made bare once it is in the page (its menu) */
  settle?(element: HTMLElement): void;
};

// How long after a grid is drawn its attributes are read again (it is in the page by then, its order among its alike known)
const SETTLE_MS = 50;
// What a click in a cell leaves to the cell's rendering: a link, a tag, a button, a field, an editor open
const OWN_CLICKS = "a, button, input, textarea, select, label, [data-ref]";

/** A body or a cell's markdown as compared: its line breaks LF, no blank lines at its end */
const same = (text: string) => text.replace(/\r\n/g, "\n").replace(/\s+$/, "");

/**
 * Each cell marked with where its markdown is in the page (`data-swl-pos`, `data-swl-end`): Silverware Layout's
 * convention for markdown rendered outside the editor, by which what is in it (an embed, its `data-pos` its offset in
 * the cell) is found in the page's text, knowing no grid
 */
function markPlaces(element: HTMLElement, grid: Grid): void {
  element.querySelectorAll<HTMLElement>(":scope > .swl-grid-cell").forEach((cellElement, index) => {
    const cell = grid.cells[index];
    if (!cell) return;
    if (cellElement.getAttribute("data-swl-pos") !== String(cell.contentFrom)) cellElement.setAttribute("data-swl-pos", String(cell.contentFrom));
    if (cellElement.getAttribute("data-swl-end") !== String(cell.contentTo)) cellElement.setAttribute("data-swl-end", String(cell.contentTo));
  });
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
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
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
    this.doc.addEventListener("click", (event) => {
      if (event.altKey && this.gridOf(event.target)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    this.doc.addEventListener("click", (event) => void this.click(event));
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
    // Where its cells are in the page (the first grid of its body; set again as it is found among its alike)
    if (first) markPlaces(element, first);
    this.host.settle?.(element);
    // In the page, its order among the grids of its body is known: its own attributes then
    this.refreshSoon();
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
      markPlaces(element, found.grid);
      if (!sameAttributes(this.attributes.get(element), found.grid.attributes)) changed = true;
      this.attributes.set(element, found.grid.attributes);
    }
    if (changed) this.onAttributes?.();
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
    await this.edit(at.element, at.cell);
  }

  /** A cell's markdown edited in place, written as it is left where it changed */
  async edit(element: HTMLElement, cellElement: HTMLElement): Promise<void> {
    const index = Number(cellElement.getAttribute("data-swl-cell"));
    const text = await this.host.pageText().catch(() => undefined);
    const found = text === undefined ? undefined : this.found(text, element);
    const cell = found?.grid.cells[index];
    if (!found || !cell) {
      this.host.problem("Silverware Layout: this grid changed in the page since it was drawn; edit it there");
      return;
    }
    editCell(cellElement, cell.content, (content) => {
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
    // The element clicked's place in the cell's markdown (SilverBullet leaves 0 out: none is 0)
    const marked = target.closest("[data-pos]");
    const elementPos = marked && cellElement!.contains(marked) ? Number(marked.getAttribute("data-pos")) || 0 : 0;
    const nodeText = caret?.node.textContent ?? "";
    const word = caret ? wordAt(nodeText, caret.offset) : "";
    const wordStart = caret ? nodeText.lastIndexOf(word, caret.offset) : 0;
    this.host.moveCursor(cell.contentFrom + positionInCell(cell.content, elementPos, word, caret ? caret.offset - Math.max(wordStart, 0) : 0));
  }
}
