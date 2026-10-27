// A panel an action fills with its own UI (the emoji picker), shown where the
// popup of every action is: under the toolbar, over it where it is docked at
// the bottom. The core places it, closes it on Esc and on a press elsewhere
// (the toolbar's own presses kept: the action's button closes it again), and
// writes what it changes of the page's text (core/action.ts ActionPanel); the
// action knows nothing of where it is shown.
import type { Action } from "./action.ts";
import { type Box, placeByToolbar, roomAbove } from "./place.ts";

export type PanelOptions = {
  // The toolbar's place (undefined: none on screen, the panel at the top of the view)
  readonly rect: Box | undefined;
  readonly viewTop: number;
  // Over the toolbar (docked at the bottom)
  readonly above: boolean;
  // Presses that do not close it (on the toolbar)
  readonly keeps: (node: Node) => boolean;
  // Closed without writing (Esc, a press elsewhere, the action's button again)
  readonly closed: () => void;
};

export class Panel {
  readonly element: HTMLElement;
  private shown: { readonly action: Action; readonly options: PanelOptions; readonly ended?: () => void } | undefined;

  constructor(private readonly doc: Document) {
    this.element = doc.createElement("div");
    this.element.className = "swb-floating swb-panel";
    this.element.setAttribute("role", "dialog");
    this.element.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });
  }

  get isOpen(): boolean {
    return !!this.shown;
  }

  /** Whether it is open for an action (its button again closes it) */
  isOpenFor(action: Action): boolean {
    // (By its id: the toolbar drawn anew, or a slot's own look, gives the same action as another object)
    return this.shown?.action.id === action.id;
  }

  owns(node: Node): boolean {
    return this.element.contains(node);
  }

  /** Emptied and opened for an action, which fills it (`fill`, given the element; what it gives back runs as it closes) */
  open(action: Action, options: PanelOptions, fill: (element: HTMLElement) => void | (() => void)): void {
    this.close(true);
    this.element.replaceChildren();
    this.element.setAttribute("aria-label", action.label);
    if (!this.element.isConnected) this.doc.body.append(this.element);
    this.element.classList.add("swb-visible");
    this.shown = { action, options };
    this.doc.defaultView!.addEventListener("mousedown", this.onPress, true);
    let ended: void | (() => void);
    try {
      ended = fill(this.element);
    } catch (e) {
      // Not left on screen half made
      this.close();
      throw e;
    }
    if (this.shown?.action.id === action.id) this.shown = { action, options, ...(ended ? { ended } : {}) };
    this.place(options.rect, options.viewTop, options.above);
  }

  /** Placed again: by the toolbar (it moved), or as it was (its content's size changed) */
  place(rect = this.shown?.options.rect, viewTop = this.shown?.options.viewTop ?? 0, above = this.shown?.options.above ?? false): void {
    if (!this.shown) return;
    this.shown = { ...this.shown, options: { ...this.shown.options, rect, viewTop, above } };
    // Over the toolbar: as tall as the room above it leaves
    if (above && rect) this.element.style.maxHeight = `${Math.max(160, roomAbove(rect, viewTop))}px`;
    else this.element.style.removeProperty("max-height");
    placeByToolbar(this.element, rect, viewTop, above);
  }

  /** Closed; `written`: by what it wrote (the writer goes on), else the owner is told */
  close(written = false): void {
    const shown = this.shown;
    if (!shown) return;
    this.shown = undefined;
    this.doc.defaultView!.removeEventListener("mousedown", this.onPress, true);
    this.element.classList.remove("swb-visible");
    shown.ended?.();
    if (!written) shown.options.closed();
  }

  remove(): void {
    this.close();
    this.element.remove();
  }

  private onPress = (e: MouseEvent): void => {
    if (!(e.target instanceof Node && (this.owns(e.target) || this.shown?.options.keeps(e.target)))) this.close();
  };
}
