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
import { borderAttribute, borderOf } from "./model/border.ts";
import { columnsWithout, columnTemplate, fitsColumns, minWidthOf, validateMinWidth } from "./model/columns.ts";
import { RENDERED_VERSION, type Rendered, type RenderedItem, type RenderedRange } from "../../../shared/rendered.ts";
import { type Drawn, drawnIn, itemsOf } from "./drawn.ts";
import type { LayoutMenuEntry } from "../../../shared/layout.ts";
import { addCellGrips, type CellAction, gridMenu, type GridMenuState } from "./ui/columngrips.ts";
import { caretWord, type CellEditing, editCell } from "./ui/celleditor.ts";
import { type EditorLook, type Editors, editorsOf, type FieldDrawing, type LinkOpening } from "../../../shared/editor.ts";
import { LOOK_SAMPLE, sampleLook } from "../../../shared/editorlook.ts";
import { addColumnDividers } from "./ui/dividers.ts";
import { drawGrid, keepBlankLines, plainCell, showBorder, showColumns, showFit } from "./ui/view.ts";
import { takeOver } from "./takeover.ts";
import { offsetOf } from "./ui/offsets.ts";
import { blankLineAt, type Caret, type CellPoint, endAt, offsetInCell, selectionInCell } from "./ui/cellpoint.ts";
import { GridDrag } from "./drag.ts";
import type { GridPlace, MoveMode } from "../../../shared/markdown/gridbuild.ts";
import { type Picked, type Picking, pickPlace } from "./ui/placepicker.ts";

/** A cell to write: the grid by its body as read and its place among those alike, the cell, its new markdown */
export type CellWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly cell: number; readonly content: string };

/** A grid's attributes to write (a value, or null: taken off), the grid found as a cell's is */
export type AttributesWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly attributes: Readonly<Record<string, string | null>> };

/** Text moved as one edit: taken out of the page where it is still as read, cells of grids given their content (by index) */
export type MoveWrite = {
  readonly takeOut?: { readonly from: number; readonly to: number; readonly was: string };
  readonly grids: readonly { readonly body: string; readonly occurrence: number; readonly of: number; readonly contents: Readonly<Record<number, string>> }[];
};

/** A grid's cells to change (shared/pages' `GridCellsChange`, named here apart), the grid found as a cell's is */
export type CellsChange =
  | { readonly kind: "move"; readonly cell: number; readonly by: -1 | 1 }
  | { readonly kind: "add"; readonly after?: number }
  | { readonly kind: "takeOut"; readonly cell: number }
  | { readonly kind: "remove"; readonly cell: number }
  | { readonly kind: "ungrid" };
export type CellsWrite = { readonly body: string; readonly occurrence: number; readonly of: number; readonly cells: CellsChange };

/** The blocks of a range of the page moved into a grid (found as a cell's is) at a place, by a mode, as one edit */
export type IntoGridWrite = {
  readonly from: number;
  readonly to: number;
  readonly was: string;
  readonly body: string;
  readonly occurrence: number;
  readonly of: number;
  readonly mode: MoveMode;
  readonly place: GridPlace;
};

/** What the grids ask of the host whose page they are in */
export type GridHost = {
  /** Whether the user means what cannot be undone but by the page's undo (a cell deleted, its content with it), asked in the host's dialog (none: the browser's) */
  confirmDelete?(question: string): Promise<boolean>;
  /** A value asked of the user, `value` given as it is now, in the host's dialog (none: the browser's); none where it is cancelled */
  ask?(question: string, value: string): Promise<string | undefined>;
  /** A cell's markdown rendered as the host renders a page (its elements marked with `data-pos`, their offsets in it; an offset of 0 may be left unmarked) */
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
  /** What a cell's markdown is edited in (shared/editor.ts: Silverware Editor's API, or the stand-in's `<textarea>`; none: the stand-in) */
  readonly editors?: Editors;
  // How the host behaves, where the grids allow for it (none: they need not; SilverBullet's: host/silverbullet/behaviour.ts)
  /** The page's text as the grid of this body being drawn is in it, where the host draws before its text is the new one (none: `pageText`) */
  textForDrawing?(body: string): Promise<string>;
  /** When a cell left by a press may be written, where the host would undo what the press did as the grid is drawn anew (none: at once) */
  afterPress?(doc: Document): Promise<void>;
  /** The page's editor a cell is in given the focus back as the cell is left (none: nothing) */
  focusPage?(cell: HTMLElement): void;
  /** Whether a press is beside a grid on its line or in the margin at its height, where the host's editor would put its cursor into the grid's text (none: none is) */
  pressBesideGrid?(event: MouseEvent): boolean;
  /** Whether a node is in the page's own text (not a widget's): a drag begun there moves the page's selection (none: no drag of the page's moved) */
  isPageText?(node: Node): boolean;
  /** The page's selection, offsets of its text (none: none known) */
  pageSelection?(): Promise<{ readonly from: number; readonly to: number } | undefined>;
  /** Text moved as one edit (none: a drop copies, the cells written apart); why not, as text */
  writeMove?(move: MoveWrite): Promise<string | undefined>;
  /** The page's blocks moved into a grid as one edit (none: Move to grid is not offered); why not, as text */
  moveIntoGrid?(write: IntoGridWrite): Promise<string | undefined>;
  /** What a cell's field draws as the page draws it (shared/editor.ts `FieldDrawing`: an embed, a link's icon and its menu's arrow); none: its markdown */
  fieldDrawing?(): Promise<FieldDrawing>;
  /** A link pressed in a cell's field followed as the page follows one (its markdown; in a new tab or in place); none: a press puts the caret there */
  followLink?(markdown: string, how: LinkOpening): unknown;
  /** A key a cell's field kept from the page (its editor stops every key), told where it is a shortcut of the host's that does nothing there (none: nothing told) */
  keyKept?(event: KeyboardEvent): void;
};

// How long after a grid is drawn its attributes are read again (it is in the page by then, its order among its alike known)
const SETTLE_MS = 50;
// How long a grid written is waited for to be drawn anew (the host draws it a moment after its text changed), at most
const REDRAWN_MS = 3000;
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

/** Whether two sets of attributes are the same */
function sameAttributes(a: Attributes | undefined, b: Attributes): boolean {
  if (!a) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** Where a cell edited is: its grid (taken anew as it is drawn anew), that grid's place among those drawn, the cell */
export type CellPlace = { grid: HTMLElement; readonly nth: number; readonly index: number };

export class Grids {
  // Each grid drawn, its body (what it is found in the page by)
  private readonly bodies = new WeakMap<HTMLElement, string>();
  // Each grid drawn, its attributes as the page's text had them when last read (asked synchronously: its width)
  private readonly attributes = new WeakMap<HTMLElement, Attributes>();
  // Each grid drawn: what it drew in its cells (taken as drawn), and the grid in the page's text it was last found as
  private readonly drawnItems = new WeakMap<HTMLElement, readonly Drawn[]>();
  private readonly placed = new WeakMap<HTMLElement, Grid>();
  // The grid drawn last where each starts in the page: the one a grid drawn anew replaces (taken out of the page by
  // the host before the new one is drawn), its cells' rendering taken over (`takeOverUnchanged`)
  private readonly drawnAt = new Map<number, HTMLElement>();
  // The page's text a grid was drawn in (`takeOverUnchanged`: the text before it the same)
  private readonly drawnIn = new WeakMap<HTMLElement, string>();
  // The page the grids are drawn in, as the host said (`pageShown`)
  private pageNow: string | undefined;
  // The sample a cell's field's look is read of, as the host renders it (`lookIn`)
  private lookSample: Promise<string | undefined> | undefined;
  // What is drawn changed since last told (a grid drawn or placed anew), and who is told
  private changedSinceTold = false;
  // The watch of grids put into the page (`watchMounted`)
  private mounted: MutationObserver | undefined;
  private readonly listeners = new Set<(items: readonly RenderedItem[]) => void>();
  /** What the grids drew in their cells and where it is in the page, for another to decorate (shared/rendered.ts; what draws embeds in their fields is the API's, src/index.ts) */
  readonly rendered: Rendered = {
    version: RENDERED_VERSION,
    items: () => this.items(),
    ranges: (text) => gridRanges(text),
    onChange: (listener) => {
      this.listeners.add(listener);
      return () => void this.listeners.delete(listener);
    },
  };
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  // The last press in a cell: its cell, where it was, the caret there
  private pressed: { readonly cell: HTMLElement; readonly x: number; readonly y: number; readonly caret: Caret | undefined } | undefined;
  private started = false;
  // The cells' writes in turn, each once its grid is drawn anew for the one before (a cell left by the press opening
  // another of its grid: that one is written after it, its grid found as it is then), and how many are on their way
  private writing: Promise<void> = Promise.resolve();
  private writes = 0;
  // The cell edited now: its place (its grid the one drawn anew after a write, once it is) and its editing; the places
  // of it and of the writes on their way, each taken to its grid drawn anew
  private editing: { readonly place: CellPlace; readonly session: CellEditing } | undefined;
  private readonly places = new Set<CellPlace>();
  // Cells being opened for editing (the page's text read first): a second click on one meanwhile is no second field
  private readonly opening = new WeakSet<HTMLElement>();
  /** Told as a grid drawn gets other attributes than it had (its width typed by hand: laid out again) */
  onAttributes: (() => void) | undefined;
  /** Where the page's text is (x in the window), where who lays the page out says: a column's edge snaps to it */
  textEdges: (() => { readonly left: number; readonly right: number } | undefined) | undefined;
  /** Whether no widget's handle is shown (a narrow pane): the grid's own menu then in its cells' (none: it is) */
  handleHidden: (() => boolean) | undefined;
  /** The part of the window the page is seen in, where who lays the page out says: a divider's grip held in it (none: the window) */
  view: (() => { readonly top: number; readonly bottom: number }) | undefined;

  // Text dragged into the cells and out of them, always moved (./drag.ts)
  private readonly drag: GridDrag;

  constructor(
    private readonly doc: Document,
    private host: GridHost,
  ) {
    this.drag = new GridDrag(doc, {
      host: () => this.host,
      gridOf: (target) => this.gridOf(target),
      placedOf: (grid) => this.placed.get(grid),
      found: (text, grid) => this.found(text, grid),
      drawn: () => this.drawn(),
      fieldAt: (node) => {
        const editing = this.editing;
        const editor = editing?.session.editor;
        return editing && editor && (editor.element === node || editor.element.contains(node)) ? { editor, place: editing.place } : undefined;
      },
      inTurn: (places, task, fail) => this.inTurn(places, task, fail),
      redrawn: (grid, nth) => this.redrawn(grid, nth),
    });
  }

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
        // A press beside a grid (on its line, or in the margin at its height): nothing, as beside a table (the host's
        // editor would put its cursor into the grid's text and show its markdown)
        if (!at && event.button === 0 && !event.altKey && this.host.pressBesideGrid?.(event)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        this.pressed = at?.cell ? { cell: at.cell, x: event.clientX, y: event.clientY, caret: caretWord(this.doc, event.clientX, event.clientY) } : undefined;
        // The press the grid's, not the page editor's, anywhere in it (a cell, the gap between two, its edge): the
        // editor would put its cursor into the grid's text and show its markdown; the grid takes the focus instead
        // (its tabindex). (A field being edited, a link, a button: their own, as the click's)
        if (at && !at.cell?.classList.contains("swl-grid-editing") && !(event.target as Element).closest(OWN_CLICKS)) event.stopPropagation();
        // A press in the cell edited, beside its field (its padding, the space under its text): the field keeps the
        // focus (else it was left: a quick second click on a cell just opened closed it again)
        const editor = this.editing?.session.editor;
        const field = editor?.element;
        // (The cell's grip kept in the cell edited: its press its own, the cell left as by any press, its text written
        // in turn; what its menu does waits for that write: `cellAction`)
        const ownControl = event.target instanceof Element && !!event.target.closest(OWN_CLICKS);
        if (at?.cell?.classList.contains("swl-grid-editing") && !ownControl && editor && field && event.target instanceof Node && !field.contains(event.target)) {
          event.preventDefault();
          event.stopPropagation();
          // (Under the field: the caret at its end, as a click under a page's last line puts it)
          if (event.clientY > field.getBoundingClientRect().bottom) {
            const end = editor.getText().length;
            editor.setSelection(end);
          }
        }
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
    this.drag.start();
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
      (this.host.textForDrawing ? this.host.textForDrawing(body) : this.host.pageText()).catch(() => ""),
    ]);
    const first = gridsOfBody(text, body)[0];
    const attributes = first?.attributes ?? {};
    const element = drawGrid(this.doc, columnTemplate(attributes.columns, cells.length, attributes["min-width"]), html);
    showFit(element, fitsColumns(attributes.columns));
    showBorder(element, borderOf(attributes));
    this.keepBlankLines(element, cells.map((cell) => cell.content));
    // The cells whose markdown did not change: the rendering of the grid it replaces taken over (its media loaded,
    // decorated), not drawn anew (a write of one cell drew every other again: its images and previews flashed, the
    // page under it jumped)
    // (What it drew taken before: what is taken over was drawn by an earlier drawing, and may be decorated by now)
    this.drawnItems.set(element, drawnIn(element));
    if (first) this.takeOverUnchanged(element, cells.map((cell) => cell.content), first, text);
    this.drawnIn.set(element, text);
    this.bodies.set(element, body);
    this.attributes.set(element, attributes);
    this.changedSinceTold = true;
    // Where its cells are in the page (the first grid of its body; set again as it is found among its alike)
    if (first) {
      markPlaces(element, first);
      this.placed.set(element, first);
      this.rememberAt(first.from, element);
    }
    // Each cell's grip: what can be done with it (the grid's own in its handle's menu: `menuOf`)
    if (this.host.changeCells)
      addCellGrips(
        this.doc,
        element,
        () => this.menuState(element),
        (cell, action) => void this.cellAction(element, cell, action),
        () => (this.handleHidden?.() ? this.menuOf(element) : []),
      );
    // The dividers between its columns: their shares dragged, written as its `columns` (even ones as many as its cells
    // would be anyway: none written)
    if (this.host.changeCells) {
      addColumnDividers(this.doc, element, (columns, even) => {
        const columnsNow = even && Number(columns) === columnsWithout(cells.length) ? null : columns;
        void this.cellAction(element, 0, { kind: "columns", columns: columnsNow });
      }, () => this.textEdges?.(), () => this.view?.());
    }
    this.host.settle?.(element);
    // In the page, its order among the grids of its body is known: its own attributes then (and what it drew told)
    this.refreshSoon();
    // (In the page: what it drew told then, as it is now there to tell. Told before it was put in (the host puts it in
    // when it is scrolled to, any time after drawing it), its files were left out of what was told: `watchMounted`)
    this.watchMounted();
    return element;
  }

  /**
   * What the grids drew told again as one of them is put into the page: SilverBullet draws a grid as it builds its
   * decorations, for the whole page, and puts it in only as it is scrolled to, any time later (and again as it is
   * scrolled back after the editor took it out). One watch of the document for all of them, for as long as it is open
   */
  private watchMounted(): void {
    if (this.mounted) return;
    const win = this.doc.defaultView;
    if (!win || !this.doc.body) return;
    const isGrid = (node: Node): boolean => node instanceof win.HTMLElement && node.classList.contains("swl-grid") && this.bodies.has(node);
    this.mounted = new win.MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof win.HTMLElement)) continue;
          if (isGrid(node) || [...node.querySelectorAll(".swl-grid")].some(isGrid)) {
            this.changedSinceTold = true;
            this.refreshSoon();
            return;
          }
        }
    });
    this.mounted.observe(this.doc.body, { childList: true, subtree: true });
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
    const element = drawGrid(this.doc, columnTemplate(grid.attributes.columns, cells.length, grid.attributes["min-width"]), html);
    showFit(element, fitsColumns(grid.attributes.columns));
    showBorder(element, borderOf(grid.attributes));
    this.keepBlankLines(element, cells.map((cell) => cell.content));
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
      showColumns(element, columnTemplate(found.grid.attributes.columns, element.querySelectorAll(":scope > .swl-grid-cell").length, found.grid.attributes["min-width"]));
      showFit(element, fitsColumns(found.grid.attributes.columns));
      showBorder(element, borderOf(found.grid.attributes));
      if (markPlaces(element, found.grid)) this.changedSinceTold = true;
      this.placed.set(element, found.grid);
      this.rememberAt(found.grid.from, element);
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

  /** Each cell of a grid drawn given the blank lines of its markdown the host's rendering left out */
  private keepBlankLines(element: HTMLElement, contents: readonly string[]): void {
    element.querySelectorAll<HTMLElement>(":scope > .swl-grid-cell").forEach((cell, i) => keepBlankLines(this.doc, cell, contents[i] ?? ""));
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

  /**
   * The rendering of the cells unchanged taken over (takeover.ts) from the grid drawn that this one replaces: the one
   * drawn last where it starts in the page, out of it now (taken out by the host as this one comes; one still in the
   * page is another grid of the same body, never taken), drawn in a page of the same text before it (another page's,
   * opened before the host said so, never: a cell alike renders by its page, a link relative to it)
   */
  private takeOverUnchanged(element: HTMLElement, contents: readonly string[], place: Grid, text: string): void {
    const old = this.drawnAt.get(place.from);
    const oldBody = old && old !== element && !old.isConnected ? this.bodies.get(old) : undefined;
    if (!old || oldBody === undefined || this.drawnIn.get(old)?.slice(0, place.from) !== text.slice(0, place.from)) return;
    const taken = takeOver(
      { element, contents, drawn: this.drawnItems.get(element) ?? [] },
      { element: old, contents: readGridBody(oldBody).map((cell) => cell.content), drawn: this.drawnItems.get(old) ?? [] },
    );
    this.drawnItems.set(element, taken.fresh);
    this.drawnItems.set(old, taken.old);
  }

  /** The page opened is another: the grids drawn in the one before never taken over (a cell alike renders by its page: a link relative to it) */
  pageShown(page: string): void {
    if (page === this.pageNow) return;
    this.pageNow = page;
    // (A place being picked in the page before: given up)
    this.picking?.cancel();
    this.drawnAt.clear();
    // (Rendered again: another page may render otherwise)
    this.lookSample = undefined;
  }

  /**
   * The page's look of what a cell's field draws as rendered (shared/editorlook.ts): its sample rendered once a page,
   * its look read in the cell as the field opens (a zoom, a theme changed since read as they are now); none where it
   * cannot be
   */
  private async lookIn(cell: HTMLElement): Promise<EditorLook | undefined> {
    const rendering = (this.lookSample ??= this.host.renderMarkdown(LOOK_SAMPLE).catch(() => undefined));
    const html = await rendering;
    // (Not rendered: rendered again next time)
    if (html === undefined && this.lookSample === rendering) this.lookSample = undefined;
    return html !== undefined && cell.isConnected ? sampleLook(cell, html) : undefined;
  }

  /** A grid drawn remembered where it starts (the last few places alone: grids moved down the page leave old ones) */
  private rememberAt(from: number, element: HTMLElement): void {
    this.drawnAt.delete(from);
    this.drawnAt.set(from, element);
    while (this.drawnAt.size > 64) this.drawnAt.delete(this.drawnAt.keys().next().value!);
  }

  /** A grid's columns shown as its attributes have them now */
  private showColumnsOf(element: HTMLElement): void {
    const attributes = this.attributesOf(element);
    showColumns(element, columnTemplate(attributes.columns, element.querySelectorAll(":scope > .swl-grid-cell").length, attributes["min-width"]));
    showFit(element, fitsColumns(attributes.columns));
  }

  /** The narrowest a grid's columns may be, asked in px (`now` the grid's `min-width`); none where nothing is given, or what is cannot be read (said why) */
  private async askMinWidth(now: string | undefined): Promise<string | undefined> {
    const question = "The narrowest a column may be, in px (40 to 1200):";
    const ask = this.host.ask ?? (async (text: string, value: string) => (this.doc.defaultView ?? window).prompt(text, value) ?? undefined);
    const given = (await ask(question, String(minWidthOf(now))).catch(() => undefined))?.trim();
    if (!given) return undefined;
    const problem = validateMinWidth(given);
    if (problem) return void this.host.problem(`Silverware Layout: the min width was not set: ${problem}`);
    return given.toLowerCase().replace(/px$/, "");
  }

  /** A grid drawn as its menus show it: its columns attribute, its borders, its number of cells */
  private menuState(element: HTMLElement): GridMenuState {
    const attributes = this.attributesOf(element);
    return { columns: attributes.columns, minWidth: attributes["min-width"], border: borderOf(attributes), cells: element.querySelectorAll(":scope > .swl-grid-cell").length };
  }

  /**
   * The grid's own sections of its handle's menu (docs/silverware-layout-grid-handles.md): its columns, its borders, a
   * cell at the end, the grid taken apart; none where its cells are not written here (a grid of a page embedded)
   */
  menuOf(element: HTMLElement): LayoutMenuEntry[][] {
    if (!this.host.changeCells || !this.bodies.has(element)) return [];
    return gridMenu(this.menuState(element), (action) => this.cellAction(element, 0, action));
  }

  /** What a cell's menu or the grid's chose, written: the grid's columns as an attribute, a change of its cells by the host */
  async cellAction(element: HTMLElement, cell: number, action: CellAction): Promise<void> {
    const said = (problem: string | undefined) => problem && this.host.problem(`Silverware Layout: the grid was not changed: ${problem}`);
    // A cell deleted, its content with it, or its content emptied: asked first, plainly
    if (action.kind === "remove" || action.kind === "clear") {
      const question =
        action.kind === "remove" ? `Delete cell ${cell + 1} and everything in it? Ctrl+Z brings it back.` : `Clear cell ${cell + 1}? Everything in it goes, the cell stays. Ctrl+Z brings it back.`;
      const ask = this.host.confirmDelete ?? (async (text: string) => (this.doc.defaultView ?? window).confirm(text));
      if (!(await ask(question).catch(() => false))) return;
    }
    // (After the cells' writes waiting (a cell left as its grip's menu opened): on the grid as drawn anew by them)
    if (this.writes > 0) {
      const nth = this.drawn().indexOf(element);
      await this.writing;
      if (!element.isConnected) element = this.drawn()[nth] ?? element;
    }
    // Its markdown shown by the page, the cursor at the cell's start (as Alt+click there)
    if (action.kind === "source") {
      const cellElement = element.querySelector<HTMLElement>(`:scope > .swl-grid-cell[data-swl-cell="${cell}"]`) ?? undefined;
      return this.showSource(element, cellElement, cellElement ?? element, undefined);
    }
    // Its columns (a count, widths, or as many as fit: a min width of theirs kept for that alone), shown at once (its body
    // the same, the grid is not drawn anew)
    if (action.kind === "columns" || action.kind === "minWidth" || action.kind === "askMinWidth") {
      let attributes: Readonly<Record<string, string | null>>;
      if (action.kind === "columns") attributes = { columns: action.columns, ...(fitsColumns(action.columns ?? undefined) ? {} : { "min-width": null }) };
      else if (action.kind === "minWidth") attributes = { "min-width": action.minWidth };
      else {
        const given = await this.askMinWidth(this.attributesOf(element)["min-width"]);
        if (given === undefined) return;
        attributes = { "min-width": given };
      }
      const problem = await this.writeAttributes(element, attributes);
      if (!problem) this.showColumnsOf(element);
      return void said(problem);
    }
    // Its content emptied: the cell written empty (one edit), the grid drawn anew by it
    if (action.kind === "clear") {
      const text = await this.host.pageText().catch(() => undefined);
      const found = text === undefined ? undefined : this.found(text, element);
      if (!found) return void said("this grid changed in the page since it was drawn");
      const problem = await this.host.writeCell({ body: found.grid.body, occurrence: found.occurrence, of: found.of, cell, content: "" }).catch((error: unknown) => (error instanceof Error ? error.message : String(error)));
      return void (problem && this.host.problem(`Silverware Layout: the cell was not cleared: ${problem}`));
    }
    if (action.kind === "border") {
      const problem = await this.writeAttributes(element, { border: borderAttribute(action.style) });
      // (Shown at once: its body the same, the grid is not drawn anew)
      if (!problem) showBorder(element, action.style);
      return void said(problem);
    }
    const text = await this.host.pageText().catch(() => undefined);
    const found = text === undefined ? undefined : this.found(text, element);
    if (!found || !this.host.changeCells) return void said("this grid changed in the page since it was drawn");
    const cells: CellsChange =
      action.kind === "move"
        ? { kind: "move", cell, by: action.by }
        : action.kind === "addAfter"
          ? { kind: "add", after: cell }
          : action.kind === "takeOut"
            ? { kind: "takeOut", cell }
            : action.kind === "remove"
              ? { kind: "remove", cell }
              : action.kind === "addCell"
                ? { kind: "add" }
                : { kind: "ungrid" };
    said(await this.host.changeCells({ body: found.grid.body, occurrence: found.occurrence, of: found.of, cells }).catch((error: unknown) => (error instanceof Error ? error.message : String(error))));
  }

  // A place in a grid being picked (Move to grid)
  private picking: Picking | undefined;

  /** Where in which grid drawn text moved goes, as the user picks it (ui/placepicker.ts); none where they give up. One at a time: one asked again gives the one before up */
  pickPlace(into: boolean, cells: number, what: string): Promise<Picked | undefined> {
    this.picking?.cancel();
    const picking = pickPlace(this.doc, { grids: () => this.drawn(), into, cells, what });
    this.picking = picking;
    return picking.picked.finally(() => {
      if (this.picking === picking) this.picking = undefined;
    });
  }

  /**
   * The page's blocks (a range as read) moved into a grid drawn at a place picked, in turn with the cells' writes (the
   * grid found as the page's text has it then), the page's grid drawn anew waited for; a problem said
   */
  moveInto(source: { readonly from: number; readonly to: number; readonly was: string }, mode: MoveMode, picked: Picked): void {
    const write = this.host.moveIntoGrid;
    if (!write) return;
    const place: CellPlace = { grid: picked.grid, nth: this.drawn().indexOf(picked.grid), index: 0 };
    this.inTurn(
      [place],
      async () => {
        const text = await this.host.pageText();
        const found = place.grid.isConnected ? this.found(text, place.grid) : undefined;
        if (!found) return "this grid changed in the page since it was drawn";
        // (Into a cell: its content as drawn with it, its offset that content's; another by then, nothing written)
        const drawnCell = picked.place.kind === "cell" ? readGridBody(this.bodies.get(picked.grid) ?? "")[picked.place.cell]?.content : undefined;
        const where = picked.place.kind === "cell" && drawnCell !== undefined ? { ...picked.place, was: drawnCell } : picked.place;
        const problem = await write({ ...source, body: found.grid.body, occurrence: found.occurrence, of: found.of, mode, place: where });
        if (!problem) await this.redrawn(place.grid, place.nth);
        return problem;
      },
      (problem) => this.host.problem(`Silverware Layout: the text was not moved into the grid: ${problem}`),
    );
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

  /**
   * A write in turn with the cells' writes (each once the one before is written and its grid drawn anew), the places it
   * writes taken to their grids drawn anew meanwhile; `task` gives why it did not write, where it did not
   */
  private inTurn(places: readonly CellPlace[], task: () => Promise<string | undefined>, fail = (problem: string) => this.host.problem(`Silverware Layout: the cell was not written: ${problem}`)): void {
    this.writes++;
    for (const place of places) this.places.add(place);
    this.writing = this.writing
      .then(task)
      .then((problem) => void (problem && fail(problem)))
      .catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
      .finally(() => {
        this.writes--;
        for (const place of places) this.places.delete(place);
      });
  }

  /** A click in a cell, not on what its rendering handles itself: the cell edited */
  private async click(event: MouseEvent): Promise<void> {
    if (event.altKey || event.button !== 0 || event.defaultPrevented) return;
    const at = this.gridOf(event.target);
    if (!at?.cell || at.cell.classList.contains("swl-grid-editing") || this.opening.has(at.cell)) return;
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
    const point = { target: event.target as Element, caret, y: event.clientY, ...(selected ? { selected } : {}) };
    this.opening.add(at.cell);
    try {
      await this.edit(at.element, at.cell, point);
    } finally {
      this.opening.delete(at.cell);
    }
  }

  /** A task's box in a cell clicked: its state in the cell's markdown toggled (`[ ]` done `[x]`, any other undone), written */
  async toggleTask(element: HTMLElement, cellElement: HTMLElement, box: HTMLElement): Promise<void> {
    const index = Number(cellElement.getAttribute("data-swl-cell"));
    const text = await this.host.pageText().catch(() => undefined);
    const found = text === undefined ? undefined : this.found(text, element);
    const cell = found?.grid.cells[index];
    if (!found || !cell) return this.host.problem("Silverware Layout: this grid changed in the page since it was drawn; toggle the task there");
    const content = toggledTask(cell.content, offsetOf(box));
    if (content === undefined) return this.host.problem("Silverware Layout: the task was not found in the cell's markdown");
    const problem = await this.host.writeCell({ body: found.grid.body, occurrence: found.occurrence, of: found.of, cell: index, content }).catch((error: unknown) => (error instanceof Error ? error.message : String(error)));
    if (problem) this.host.problem(`Silverware Layout: the task was not toggled: ${problem}`);
  }

  /** A cell's markdown edited in place, the cursor where a click was in its rendering (none: at its end), written as it is left where it changed */
  async edit(element: HTMLElement, cellElement: HTMLElement, point?: CellPoint): Promise<void> {
    const index = Number(cellElement.getAttribute("data-swl-cell"));
    const nth = this.drawn().indexOf(element);
    // (Where the press was is read in the cell pressed, its rendering: the cell edited may be the grid's drawn anew)
    const pressed = cellElement;
    // (What draws its embeds asked as its text is read: no wait of its own before the field opens, the grid perhaps
    // drawn anew meanwhile)
    const drawing = this.host.fieldDrawing?.().catch(() => undefined);
    // (The page's look of a task's box and a hashtag read once, for its field: as the cell is drawn)
    const look = this.lookIn(cellElement);
    let text = await this.host.pageText().catch(() => undefined);
    let found = text === undefined ? undefined : this.found(text, element);
    // Read as another cell's write had changed the grid, before it was drawn anew: opened once it is, in that drawing
    if (!found && this.writes > 0) {
      await this.writing;
      const again = this.drawn()[nth];
      const againCell = again?.querySelector<HTMLElement>(`:scope > .swl-grid-cell[data-swl-cell="${index}"]`);
      if (again && againCell) [element, cellElement] = [again, againCell];
      text = await this.host.pageText().catch(() => undefined);
      found = text === undefined ? undefined : this.found(text, element);
    }
    const cell = found?.grid.cells[index];
    if (!found || !cell) {
      this.host.problem("Silverware Layout: this grid changed in the page since it was drawn; edit it there");
      return;
    }
    const at = !point
      ? undefined
      : point.selected
        ? selectionInCell(cell.content, pressed, point.selected)
        : ((point.y === undefined ? undefined : (endAt(cell.content, pressed, point.y) ?? blankLineAt(cell.content, pressed, point.y))) ?? offsetInCell(cell.content, pressed, point.target, point.caret));
    const place: CellPlace = { grid: element, nth, index };
    this.places.add(place);
    let session: CellEditing | undefined;
    const [drawn, shown] = await Promise.all([drawing, look]);
    const follow = this.host.followLink?.bind(this.host);
    const cellHost = {
      afterPress: (doc: Document) => this.host.afterPress?.(doc) ?? Promise.resolve(),
      focusPage: (cell: HTMLElement) => this.host.focusPage?.(cell),
      ...(this.host.keyKept ? { keyKept: this.host.keyKept.bind(this.host) } : {}),
      ...(drawn ? { drawing: drawn } : {}),
      ...(shown ? { look: shown } : {}),
      // A link followed once the cell's text is written (the cell left first, in place): a write after it would find
      // the page gone; in a new tab at once, the cell edited on
      ...(follow ? { openLink: (markdown: string, how: LinkOpening) => void (how.newTab ? Promise.resolve() : this.writing).then(() => follow(markdown, how)) } : {}),
      // (Its rendering back in the page: what it drew told again, to be decorated where it was not yet)
      restored: () => {
        this.changedSinceTold = true;
        this.tell();
      },
    };
    session = editCell(cellElement, cell.content, at, this.host.editors ?? editorsOf(undefined), cellHost, (content, settled) => {
      if (session && this.editing?.session === session) this.editing = undefined;
      if (same(content) !== same(cell.content)) this.writeLater(place, content, settled);
      else this.places.delete(place);
    });
    this.editing = { place, session };
  }

  /**
   * A cell's text written once it may be (`settled`) and the writes before it are done, its grid found in the page as
   * it is then (drawn anew by a write before: the one at its place); then the grid drawn anew waited for, so the next
   * finds it so too
   */
  private writeLater(place: CellPlace, content: string, settled: Promise<void>): void {
    this.inTurn([place], async () => {
      await settled;
      // (Its grid as drawn now: drawn anew after a write before, taken to it by `redrawn`; not in the page any more,
      // nothing written: no other grid is taken for it)
      const grid = place.grid;
      const text = await this.host.pageText();
      const found = grid.isConnected ? this.found(text, grid) : undefined;
      if (!found) return "its grid changed in the page meanwhile";
      const problem = await this.host.writeCell({ body: found.grid.body, occurrence: found.occurrence, of: found.of, cell: place.index, content });
      if (problem) return problem;
      await this.redrawn(grid, place.nth);
      return undefined;
    });
  }

  /**
   * Once a grid written is drawn anew (none, after `REDRAWN_MS`: it was not): the places in it taken to the new
   * drawing, the cell edited moved into it. Only a drawing a write of ours made: another (the page left) is no grid of
   * the cell's
   */
  private redrawn(grid: HTMLElement, nth: number): Promise<void> {
    return new Promise((resolve) => {
      const win = this.doc.defaultView;
      const look = () => {
        const now = this.drawn()[nth];
        if (grid.isConnected || !now || now === grid) return false;
        this.retake(grid, now);
        return true;
      };
      if (look() || !win || !this.doc.body) return resolve();
      const observer = new win.MutationObserver(() => look() && done());
      const timer = win.setTimeout(() => done(), REDRAWN_MS);
      const done = () => {
        observer.disconnect();
        win.clearTimeout(timer);
        resolve();
      };
      observer.observe(this.doc.body, { childList: true, subtree: true });
    });
  }

  /** The places in a grid taken to it drawn anew, the cell edited moved there, what was typed in it kept */
  private retake(was: HTMLElement, now: HTMLElement): void {
    for (const place of this.places) if (place.grid === was) place.grid = now;
    const editing = this.editing;
    if (editing?.place.grid !== now) return;
    const cell = now.querySelector<HTMLElement>(`:scope > .swl-grid-cell[data-swl-cell="${editing.place.index}"]`);
    if (cell) editing.session.moveTo(cell);
  }

  /** An Alt+press in a cell: the raw text shown, the cursor where it was in the cell's markdown */
  private altPress(event: MouseEvent): void {
    if (!event.altKey || event.button !== 0) return;
    const at = this.gridOf(event.target);
    if (!at) return;
    // (In the field of the cell edited: the field's own, a file drawn there shows its markdown in it)
    const field = this.editing?.session.editor?.element;
    if (field && event.target instanceof Node && (field === event.target || field.contains(event.target))) return;
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

/** The ranges of a page's text its grids draw outside the editor, drawn now or not: each grid's lines whole */
export function gridRanges(text: string): RenderedRange[] {
  return readGrids(text).map((grid) => ({ from: grid.from, to: grid.to }));
}
