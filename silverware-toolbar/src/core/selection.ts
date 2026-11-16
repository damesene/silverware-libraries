// Follows the selection in the page's text (dom.ts: not a widget's, not
// another editor's): told once one is made, which is once the mouse is let go
// (not while dragging), or a moment after the keys that made it; told at once
// when there is none any more. The caret too, a moment after it moved (the
// toolbar shown always follows it). Also the selection in an editing surface
// (Silverware Editor's editor, shared/editor.ts), read in its shadow root.
import type { EditingSurface } from "../../../shared/editor.ts";
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
    // The editing surface a node is in (none: it is in none)
    private readonly surfaceAt: (node: Node) => EditingSurface | undefined = () => undefined,
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
    const range = this.selection();
    if (!range || range.collapsed) return undefined;
    const content = this.textOf(range.startContainer);
    return content && this.textOf(range.endContainer) === content ? range : undefined;
  }

  /** The caret in the page's text now, if the selection is one */
  caret(): Range | undefined {
    const range = this.selection();
    return range && range.collapsed && this.textOf(range.startContainer) ? range : undefined;
  }

  /** What text a node is in: the page's editable area, or an editing surface's element; none where neither */
  private textOf(node: Node): Element | undefined {
    return pageContentOf(node) ?? this.surfaceAt(node)?.element;
  }

  /**
   * The selection's range: in the shadow root of the surface focused (the document's selection shows its host alone
   * there, in Chromium), else the document's
   */
  private selection(): Range | undefined {
    const selection = this.doc.getSelection();
    if (!selection || selection.rangeCount === 0) return undefined;
    const active = this.doc.activeElement;
    const root = active?.shadowRoot;
    if (!active || !root || !this.surfaceAt(active)) return selection.getRangeAt(0);
    return shadowRange(this.doc, selection, root) ?? selection.getRangeAt(0);
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

/**
 * A selection in a shadow root as a range of its nodes: the standard's composed ranges where the browser has them,
 * else the root's own selection (Chromium before them); none where neither (Firefox: the document's has its nodes)
 */
function shadowRange(doc: Document, selection: Selection, root: ShadowRoot): Range | undefined {
  type Composed = { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] };
  try {
    const composed = (selection as Selection & Composed).getComposedRanges?.({ shadowRoots: [root] })[0];
    if (composed && root.contains(composed.startContainer)) {
      const range = doc.createRange();
      range.setStart(composed.startContainer, composed.startOffset);
      range.setEnd(composed.endContainer, composed.endOffset);
      return range;
    }
  } catch {
    // (An older form of getComposedRanges: the root's own selection below)
  }
  const own = (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection?.();
  return own && own.rangeCount > 0 ? own.getRangeAt(0) : undefined;
}
