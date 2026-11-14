// Text dragged into a grid's cells and out of them, always moved (docs/silverware-layout-grid.md, *Dragging text*):
// where a drag began (the page's own text, as the host tells it; a cell's rendering, its markdown carried; a cell's
// field) is kept as it begins; dropped on a cell not edited, its text is written there where it was let go and taken
// out of where it came from as one edit where the host writes moves; dropped elsewhere, it is taken out of the cell or
// field it came from once dropped. The grids are asked through `DragGrids` alone.
import type { Grid } from "../../../shared/markdown/grid.ts";
import { withMarksAround } from "../../../shared/markdown/marks.ts";
import type { TextEditor } from "../../../shared/editor.ts";
import type { CellPlace, GridHost, MoveWrite } from "./grids.ts";
import { blankLineAt, endAt, offsetInCell, selectionInCell } from "./ui/cellpoint.ts";
import { caretWord } from "./ui/celleditor.ts";

/** What the drag asks of the grids */
export type DragGrids = {
  host(): GridHost;
  // The grid a node is in, and its cell
  gridOf(target: EventTarget | null): { readonly element: HTMLElement; readonly cell: HTMLElement | undefined } | undefined;
  // The grid of the page's text a grid drawn was last found as
  placedOf(grid: HTMLElement): Grid | undefined;
  // A grid drawn as a page's text has it now
  found(text: string, grid: HTMLElement): { readonly grid: Grid; readonly occurrence: number; readonly of: number } | undefined;
  // The grids drawn, in the page's order
  drawn(): HTMLElement[];
  // The field of the cell edited, where a node is in it, and that cell's place
  fieldAt(node: Node): { readonly editor: TextEditor; readonly place: CellPlace } | undefined;
  // A write in turn with the cells' writes, the places it writes taken to their grids drawn anew
  inTurn(places: readonly CellPlace[], task: () => Promise<string | undefined>, fail?: (problem: string) => void): void;
  // Once a grid written is drawn anew
  redrawn(grid: HTMLElement, nth: number): Promise<void>;
};

/** Where a drag began, as far as a drop on a cell moves its text from there */
type DragSource =
  // The page's own text (its editor's selection, read as it is dropped)
  | { readonly kind: "page" }
  // A cell's rendering: its markdown's range, as the grid was read
  | { readonly kind: "cell"; readonly grid: HTMLElement; readonly index: number; readonly from: number; readonly to: number; readonly text: string }
  // A cell's field: its range, its cell's place
  | { readonly kind: "field"; readonly editor: TextEditor; readonly place: CellPlace; readonly from: number; readonly to: number; readonly text: string };

export class GridDrag {
  constructor(
    private readonly doc: Document,
    private readonly grids: DragGrids,
  ) {}

  /** Drags followed from now on */
  start(): void {
    // (In the capture phase: a drop on a cell is the grid's, not the host's editor's, which would take it at the grid's
    // start, or not at all; a cell edited takes a drop in its field itself)
    this.doc.addEventListener("dragstart", (event) => this.dragStart(event), true);
    this.doc.addEventListener("dragover", (event) => this.dragOver(event), true);
    this.doc.addEventListener("dragleave", (event) => event.relatedTarget === null && this.showDrop(undefined), true);
    this.doc.addEventListener("drop", (event) => {
      this.droppedOn = event.target;
      this.droppedEvent = event;
      void this.drop(event);
    }, true);
    this.doc.addEventListener("dragend", (event) => void this.dragEnd(event), true);
  }

  /** The cell text dragged over would be dropped in: one not edited, the text plain text (a file: another's), none else */
  private dropCell(event: DragEvent): { readonly element: HTMLElement; readonly cell: HTMLElement } | undefined {
    const types = [...(event.dataTransfer?.types ?? [])];
    if (!types.includes("text/plain") || types.includes("Files")) return undefined;
    const at = this.grids.gridOf(event.target);
    return at?.cell && !at.cell.classList.contains("swl-grid-editing") ? { element: at.element, cell: at.cell } : undefined;
  }

  /** Text dragged over a cell: the drop allowed there, the cell marked; over anything else, the mark gone */
  private dragOver(event: DragEvent): void {
    const at = this.dropCell(event);
    this.showDrop(at?.cell);
    if (!at) return;
    event.preventDefault();
    event.stopPropagation();
    // (A move where the drag allows one; a copy where it allows that alone, another window's: else no drop came)
    const allowed = event.dataTransfer?.effectAllowed ?? "uninitialized";
    if (event.dataTransfer) event.dataTransfer.dropEffect = /move|all|uninitialized/i.test(allowed) ? "move" : "copy";
  }

  // The drag going on (where it began), whether a drop on a cell took it, and what the last drop was on
  private dragging: DragSource | undefined;
  private dropTaken = false;
  private droppedOn: EventTarget | null = null;
  private droppedEvent: DragEvent | undefined;

  /** A drag begun: where, for a drop to move its text from there; from a cell's rendering, its markdown carried (not the rendered text) */
  private dragStart(event: DragEvent): void {
    this.dragging = undefined;
    this.dropTaken = false;
    this.droppedOn = null;
    this.droppedEvent = undefined;
    const target = event.target instanceof Node ? event.target : null;
    if (!target) return;
    const field = this.grids.fieldAt(target);
    if (field) {
      const { editor, place } = field;
      const { from, to } = editor.getSelection();
      if (from < to) this.dragging = { kind: "field", editor, place, from, to, text: editor.getText().slice(from, to) };
      return;
    }
    const at = this.grids.gridOf(target instanceof Element ? target : target.parentElement);
    if (at?.cell) {
      const grid = this.grids.placedOf(at.element);
      const index = Number(at.cell.getAttribute("data-swl-cell"));
      const cell = grid?.cells[index];
      const selection = this.doc.getSelection();
      if (!grid || !cell || !selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode || !at.cell.contains(selection.anchorNode) || !at.cell.contains(selection.focusNode)) return;
      const range = withMarksAround(cell.content, selectionInCell(cell.content, at.cell, { anchor: { node: selection.anchorNode, offset: selection.anchorOffset }, focus: { node: selection.focusNode, offset: selection.focusOffset } }));
      if (range.from >= range.to) return;
      const text = cell.content.slice(range.from, range.to);
      this.dragging = { kind: "cell", grid: at.element, index, from: range.from, to: range.to, text };
      event.dataTransfer?.setData("text/plain", text);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "copyMove";
      return;
    }
    if (this.grids.host().isPageText?.(target)) this.dragging = { kind: "page" };
  }

  /**
   * A drag ended: dropped somewhere else than a cell (the page's editor, another field), its text taken out of the cell
   * or the field it came from, where it is still there (a field's own move within it done by the field)
   */
  private async dragEnd(event: DragEvent): Promise<void> {
    this.showDrop(undefined);
    const source = this.dragging;
    this.dragging = undefined;
    // (Dropped: in the page, where what it was dropped on took it (its default held back: it wrote it itself; an
    // editable field: the browser writes it there); in another window, where the browser says one took it; a drag
    // given up, or dropped on what took nothing: the text kept where it was)
    const inPage = this.droppedEvent;
    const dropped = inPage ? inPage.defaultPrevented || takesText(inPage.target) : (event.dataTransfer?.dropEffect ?? "none") !== "none";
    if (!source || this.dropTaken || !dropped) return;
    if (source.kind === "field") {
      const inside = this.droppedOn instanceof Node && (source.editor.element === this.droppedOn || source.editor.element.contains(this.droppedOn));
      if (!inside && source.editor.getText().slice(source.from, source.to) === source.text) source.editor.replaceRange(source.from, source.to, "");
      return;
    }
    if (source.kind === "cell") this.takeOutOfCell(source);
  }

  /** A cell's text dropped elsewhere taken out of it, where it is still as it was read, in turn with the cells' writes */
  private takeOutOfCell(source: Extract<DragSource, { kind: "cell" }>): void {
    const place: CellPlace = { grid: source.grid, nth: this.grids.drawn().indexOf(source.grid), index: source.index };
    this.grids.inTurn([place], async () => {
      const text = await this.grids.host().pageText();
      const found = place.grid.isConnected ? this.grids.found(text, place.grid) : undefined;
      const cell = found?.grid.cells[place.index];
      if (!found || !cell || cell.content.slice(source.from, source.to) !== source.text) return "the text moved changed in the page meanwhile";
      const content = cell.content.slice(0, source.from) + cell.content.slice(source.to);
      const problem = await this.grids.host().writeCell({ body: found.grid.body, occurrence: found.occurrence, of: found.of, cell: place.index, content });
      if (!problem) await this.grids.redrawn(place.grid, place.nth);
      return problem;
    });
  }

  private dropShown: HTMLElement | undefined;

  /** The cell text would be dropped in marked (none: no mark) */
  private showDrop(cell: HTMLElement | undefined): void {
    if (cell === this.dropShown) return;
    this.dropShown?.classList.remove("swl-grid-drop");
    cell?.classList.add("swl-grid-drop");
    this.dropShown = cell;
  }

  /**
   * Text dropped on a cell: written into its markdown where the drop was (as a click there puts the caret) and taken
   * out of where it was dragged from, as one edit where the host writes moves (the page's text, a cell's, a field's: its
   * cell written as the field has it then, the field going on); from elsewhere, written alone
   */
  private async drop(event: DragEvent): Promise<void> {
    const at = this.dropCell(event);
    this.showDrop(undefined);
    if (!at) return;
    event.preventDefault();
    event.stopPropagation();
    const source = this.dragging;
    this.dropTaken = true;
    const dropped = source && source.kind !== "page" ? source.text : (event.dataTransfer?.getData("text/plain") ?? "");
    if (!dropped) return;
    // (Where it was dropped read at once: the rendering may be drawn anew meanwhile; the page's selection too)
    const caret = caretWord(this.doc, event.clientX, event.clientY);
    const index = Number(at.cell.getAttribute("data-swl-cell"));
    const place: CellPlace = { grid: at.element, nth: this.grids.drawn().indexOf(at.element), index };
    const cellElement = at.cell;
    const target = event.target as Element;
    const y = event.clientY;
    const selection = source?.kind === "page" ? await this.grids.host().pageSelection?.().catch(() => undefined) : undefined;
    const fail = (problem: string) => this.grids.host().problem(`Silverware Layout: the text was not moved: ${problem}`);
    const places = source?.kind === "cell" ? [place, { grid: source.grid, nth: this.grids.drawn().indexOf(source.grid), index: source.index }] : source?.kind === "field" ? [place, source.place] : [place];
    this.grids.inTurn(places, async () => {
      const text = await this.grids.host().pageText();
      const found = place.grid.isConnected ? this.grids.found(text, place.grid) : undefined;
      const cell = found?.grid.cells[index];
      if (!found || !cell) return "this grid changed in the page since it was drawn";
      let offset = endAt(cell.content, cellElement, y) ?? blankLineAt(cell.content, cellElement, y) ?? offsetInCell(cell.content, cellElement, target, caret);
      const into = (content: string, at: number) => content.slice(0, at) + dropped + content.slice(at);
      const grids: { body: string; occurrence: number; of: number; contents: Record<number, string> }[] = [];
      let takeOut: MoveWrite["takeOut"];
      if (source?.kind === "cell" || source?.kind === "field") {
        // (Out of a cell's markdown as the page has it; out of a field's text as the field has it, its edits so far
        // written with it)
        const sourceGrid = source.kind === "cell" ? source.grid : source.place.grid;
        const sourceIndex = source.kind === "cell" ? source.index : source.place.index;
        const from = sourceGrid.isConnected ? this.grids.found(text, sourceGrid) : undefined;
        const was = from?.grid.cells[sourceIndex];
        const whole = source.kind === "cell" ? was?.content : source.editor.getText();
        if (!from || !was || whole === undefined || whole.slice(source.from, source.to) !== source.text) return "the text moved changed in the page meanwhile";
        const out = whole.slice(0, source.from) + whole.slice(source.to);
        if (from.grid.from === found.grid.from) {
          // Within one grid: both cells at once; within one cell, dropped where it was taken from: nothing to do
          if (sourceIndex === index) {
            if (offset >= source.from && offset <= source.to) return undefined;
            if (offset > source.to) offset -= source.to - source.from;
            grids.push({ body: found.grid.body, occurrence: found.occurrence, of: found.of, contents: { [index]: into(out, offset) } });
          } else grids.push({ body: found.grid.body, occurrence: found.occurrence, of: found.of, contents: { [sourceIndex]: out, [index]: into(cell.content, offset) } });
        } else {
          grids.push({ body: from.grid.body, occurrence: from.occurrence, of: from.of, contents: { [sourceIndex]: out } });
          grids.push({ body: found.grid.body, occurrence: found.occurrence, of: found.of, contents: { [index]: into(cell.content, offset) } });
        }
      } else {
        // The page's own text: taken out where it is still the text dropped, and not the grid's own
        if (source?.kind === "page" && selection && selection.from < selection.to && text.slice(selection.from, selection.to) === dropped) {
          if (selection.to > found.grid.from && selection.from < found.grid.to) return "a grid's text cannot be moved into the grid";
          takeOut = { from: selection.from, to: selection.to, was: dropped };
        }
        grids.push({ body: found.grid.body, occurrence: found.occurrence, of: found.of, contents: { [index]: into(cell.content, offset) } });
      }
      const write = this.grids.host().writeMove;
      let problem: string | undefined;
      if (write) problem = await write({ ...(takeOut ? { takeOut } : {}), grids });
      else {
        // (A host writing no moves: each cell written apart, nothing taken out of the page)
        for (const one of grids) for (const [cellIndex, content] of Object.entries(one.contents)) problem ??= await this.grids.host().writeCell({ body: one.body, occurrence: one.occurrence, of: one.of, cell: Number(cellIndex), content });
      }
      if (problem) return problem;
      // A field's text taken out of it too, as its cell has it now
      if (source?.kind === "field" && source.editor.getText().slice(source.from, source.to) === source.text) source.editor.replaceRange(source.from, source.to, "");
      await this.grids.redrawn(place.grid, place.nth);
      return undefined;
    }, fail);
  }
}

/** Whether a drop's target takes text by the browser's own drop: an editable field, or editable content */
function takesText(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return !!element && (element.closest("textarea, input") !== null || (element instanceof HTMLElement && element.isContentEditable));
}
