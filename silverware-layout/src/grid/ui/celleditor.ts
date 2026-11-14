// A grid's cell edited in place (docs/silverware-layout-grid.md, *Editing*): its rendering replaced by its markdown in
// an editor (shared/editor.ts: Silverware Editor's where it is installed, else a `<textarea>`), as tall as its text, the
// grid keeping its shape. Left (the focus gone, Esc, Ctrl/Cmd+Enter), the text is handed back once, with when to write
// it; the cell shows its rendering again until the host draws the grid anew. The grid drawn anew while it is edited
// (another cell written, left by the press that opened this one), the editor goes into the new drawing's cell
// (`moveTo`), what was typed kept.
import type { EditorEmbed, Editors, TextEditor, TextSelection } from "../../../../shared/editor.ts";

/** What a cell edited asks of the host (src/grid/grids.ts' `GridHost`, its answers there) */
export type CellHost = {
  // When a cell left by a press may be written
  afterPress(doc: Document): Promise<void>;
  // The page's editor around a cell given the focus back
  focusPage(cell: HTMLElement): void;
  // What draws an embed in the field as an image (none: its markdown)
  readonly embed?: (markdown: string) => EditorEmbed | undefined;
};

/** A cell edited: its editor, and moving it into the same cell of the grid drawn anew */
export type CellEditing = {
  readonly editor: TextEditor;
  moveTo(cell: HTMLElement): void;
};

/**
 * The cell's markdown edited in place, the cursor at `at` in it or a selection (none: at its end), in an editor of
 * `editors`; `done` gets the text as left (once), and when it may be written (`settled`: at once where left by a key,
 * once the press is over where left by one)
 */
export function editCell(cell: HTMLElement, markdown: string, at: number | TextSelection | undefined, editors: Editors, host: CellHost, done: (text: string, settled: Promise<void>) => void): CellEditing {
  const doc = cell.ownerDocument;
  let shown = [...cell.childNodes];
  let left = false;
  // Being moved into another cell: the focus lost as it goes is not the cell left
  let moving = false;
  // The focus lost to nothing without a press (the host taking it as it draws the grid anew after another cell's
  // write, the grid taken out of the page): the cell not left, waiting for the new drawing (`moveTo`) or the focus back
  let lost = false;
  // A press going on (from its pointerdown to its release): a blur then is the user's, the cell left
  let pressing = false;
  const presses = new AbortController();
  let editor: TextEditor | undefined;
  // Left by a key (Esc, Ctrl/Cmd+Enter) or by the focus gone (a press elsewhere)
  const leave = (byKey: boolean) => {
    if (left || moving || !editor) return;
    left = true;
    lost = false;
    presses.abort();
    const text = editor.getText();
    // The page's editor the cell is in given the focus back, as it had it before (the host's `focusPage`). Left by a
    // press, only once the press is over and nothing took the focus: focused in the middle of a tap on the page's text
    // (a phone), the page's editor said it had the focus but took no typing, its cursor not placed
    const refocus = (from: HTMLElement) => {
      if (doc.activeElement === null || doc.activeElement === doc.body) host.focusPage(from);
    };
    const hadFocus = editor.hasFocus() || editor.element.contains(doc.activeElement);
    const close = (shut: TextEditor, from: HTMLElement, rendering: ChildNode[]) => {
      shut.destroy();
      from.replaceChildren(...rendering);
      from.classList.remove("swl-grid-editing");
    };
    if (!byKey) {
      const [shut, from, rendering] = [editor, cell, shown];
      setTimeout(() => {
        close(shut, from, rendering);
        refocus(from);
      }, 0);
      // Written when the host says a write may go after a press (the grid drawn anew after it)
      done(text, host.afterPress(doc));
      return;
    }
    const from = cell;
    close(editor, cell, shown);
    if (hadFocus) host.focusPage(from);
    done(text, Promise.resolve());
  };
  editor = editors.create(doc, {
    text: markdown,
    className: "swl-grid-editor",
    label: "The cell's markdown",
    spellcheck: true,
    selection: at,
    ...(host.embed ? { embed: host.embed } : {}),
    keys: { Escape: () => (leave(true), true), "Mod-Enter": () => (leave(true), true) },
    onBlur: () => {
      if (left || moving || !editor) return;
      if (pressing) return leave(false);
      // (Without a press: lost at once (moved meanwhile, the focus given back there), where the focus went told a task
      // later. To an element of its own (Tab, a field focused by a script): left. Still the editor's (the window
      // left): nothing. To nothing: waited for)
      lost = true;
      setTimeout(() => {
        if (!lost || left || !editor) return;
        const active = doc.activeElement;
        if (editor.hasFocus() || (active && editor.element.contains(active))) return void (lost = false);
        if (active && active !== doc.body) {
          lost = false;
          return leave(false);
        }
        const kept = editor;
        // (In the page still: its focus given back after a moment, the grid not drawn anew; taken out: left, the
        // grid drawn anew none came)
        setTimeout(() => {
          if (!lost || left) return;
          lost = false;
          if (kept.element.isConnected) kept.focus();
          else leave(false);
        }, kept.element.isConnected ? LOST_MS : REMOVED_MS);
      }, 0);
    },
  });
  const win = doc.defaultView;
  if (win) {
    win.addEventListener(
      "pointerdown",
      (event) => {
        pressing = true;
        // (Lost, a press elsewhere: the cell left as by that press)
        if (lost && editor && !(event.target instanceof Node && editor.element.contains(event.target))) {
          lost = false;
          leave(false);
        }
      },
      { capture: true, signal: presses.signal },
    );
    for (const type of ["pointerup", "pointercancel"]) win.addEventListener(type, () => setTimeout(() => (pressing = false), 0), { capture: true, signal: presses.signal });
  }
  // (One showing the markdown as rendered looks as the cell did: only what the caret is at changes, as in the page)
  if (editor.preview) editor.element.classList.add("swl-grid-editor-preview");
  cell.classList.add("swl-grid-editing");
  cell.replaceChildren(editor.element);
  editor.focus();
  // (Where the cursor was asked once it is in the page and focused: a field's selection is its own then)
  if (at === undefined || typeof at === "number") editor.setSelection(at ?? markdown.length);
  else editor.setSelection(at.from, at.to, at.backward);
  const shownEditor = editor;
  return {
    editor: shownEditor,
    moveTo: (to) => {
      if (left || to === cell) return;
      // (Its selection kept: an element moved loses the focus, given back with the selection it had)
      const selection = shownEditor.getSelection();
      const focused = shownEditor.hasFocus() || lost;
      lost = false;
      moving = true;
      shown = [...to.childNodes];
      cell = to;
      to.classList.add("swl-grid-editing");
      to.replaceChildren(shownEditor.element);
      if (focused) shownEditor.focus();
      shownEditor.setSelection(selection.from, selection.to, selection.backward);
      // (A blur the move fires comes before the focus is given back, or a task later)
      setTimeout(() => (moving = false), 0);
    },
  };
}

// How long an editor that lost the focus to nothing waits before taking it back, in the page still (`moveTo` gives it
// back as the grid is drawn anew), and taken out of it with its grid (left where no new drawing came)
const LOST_MS = 300;
const REMOVED_MS = 3000;

/**
 * The word under a point in the rendering and how far into it the point is, as the browser places a caret there
 * (none where it cannot: an image, a browser without caretPositionFromPoint or caretRangeFromPoint)
 */
export function caretWord(doc: Document, x: number, y: number): { readonly node: Node; readonly offset: number } | undefined {
  const withPosition = doc as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  const position = withPosition.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };
  const range = doc.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : undefined;
}
