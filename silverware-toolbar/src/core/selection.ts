// Follows the selection in the page's text (dom.ts: not a widget's, not
// another editor's): told once one is made, which is once the mouse is let go
// (not while dragging), or a moment after the keys that made it; told at once
// when there is none any more. The caret too, a moment after it moved (the
// toolbar shown always follows it).
import { pageContentOf } from "../dom.ts";

// After the last change of a selection made with the keyboard: Shift+arrows pressed again soon go on
const SETTLE_MS = 200;

export class SelectionWatcher {
  private pressed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private caretTimer: ReturnType<typeof setTimeout> | undefined;
  private shown = false;

  constructor(
    private readonly doc: Document,
    // The selection made (a range of the page's text), or none (undefined)
    private readonly changed: (range: Range | undefined) => void,
    // Nodes whose selection is left alone (the toolbar's own fields: the popup's search)
    private readonly ignores: (node: Node) => boolean,
    // The caret in the page's text moved (or came there), a moment after
    private readonly caretMoved: (range: Range) => void = () => undefined,
  ) {}

  start(): void {
    const win = this.doc.defaultView!;
    this.doc.addEventListener("selectionchange", this.onChange);
    win.addEventListener("mousedown", this.onDown, true);
    win.addEventListener("mouseup", this.onUp, true);
    // A drag let go outside the window may send no mouseup: the window losing focus ends it
    win.addEventListener("blur", this.onUp);
  }

  stop(): void {
    const win = this.doc.defaultView!;
    this.doc.removeEventListener("selectionchange", this.onChange);
    win.removeEventListener("mousedown", this.onDown, true);
    win.removeEventListener("mouseup", this.onUp, true);
    win.removeEventListener("blur", this.onUp);
    clearTimeout(this.timer);
    clearTimeout(this.caretTimer);
  }

  /** The selection in the page's text now, if there is one (not collapsed) */
  current(): Range | undefined {
    const selection = this.doc.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return undefined;
    const range = selection.getRangeAt(0);
    const content = pageContentOf(range.startContainer);
    return content && pageContentOf(range.endContainer) === content ? range : undefined;
  }

  /** The caret in the page's text now, if the selection is one */
  caret(): Range | undefined {
    const selection = this.doc.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return undefined;
    const range = selection.getRangeAt(0);
    return pageContentOf(range.startContainer) ? range : undefined;
  }

  private onDown = (e: MouseEvent): void => {
    if (e.button === 0 && !(e.target instanceof Node && this.ignores(e.target))) this.pressed = true;
  };

  private onUp = (): void => {
    if (!this.pressed) return;
    this.pressed = false;
    this.settle(0);
  };

  private onChange = (): void => {
    const anchor = this.doc.getSelection()?.anchorNode;
    if (anchor && this.ignores(anchor)) return;
    // None any more: said at once; made or changed: once the mouse is let go, or the keys pause
    if (!this.current()) {
      clearTimeout(this.timer);
      this.tell(undefined);
      clearTimeout(this.caretTimer);
      this.caretTimer = setTimeout(() => {
        const caret = this.caret();
        if (caret) this.caretMoved(caret);
      }, SETTLE_MS);
      return;
    }
    clearTimeout(this.caretTimer);
    if (!this.pressed) this.settle(SETTLE_MS);
  };

  private settle(delay: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.tell(this.current()), delay);
  }

  private tell(range: Range | undefined): void {
    // None told once only
    if (!range && !this.shown) return;
    this.shown = !!range;
    this.changed(range);
  }
}
