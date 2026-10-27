// Where the docked toolbar goes, and what moves it: SilverBullet's editor (its
// box: the toolbar not over its sidebars), the on-screen keyboard and
// SilverBullet's keyboard bar over it, each changing apart from the page's
// scroll; and whether the focus is still the editor's (a table's cell edited),
// so the room kept for the toolbar stays. What it assumes about SilverBullet's
// DOM is in dom.ts; the controller asks it where and is told when that moved.
import { CONTENT_SELECTOR, editorBox, inEditor, keyboardBarTop, pinnedViewBottom, viewTopOf } from "../dom.ts";
import type { Dock } from "./bar.ts";

export class Docking {
  // The last press was in SilverBullet's editor (`stillEditing`)
  private pressedInEditor = false;
  // SilverBullet's keyboard bar put in or taken out, its view measured anew: no event tells it
  private readonly watch: MutationObserver;
  private frame = 0;
  private watching = false;

  constructor(
    private readonly doc: Document,
    // Where the toolbar is docked now, if it is (shown)
    private readonly current: () => Dock | undefined,
    // Where it docks may have changed: placed again
    private readonly moved: () => void,
  ) {
    this.watch = new MutationObserver(() => {
      if (this.frame) return;
      this.frame = doc.defaultView!.requestAnimationFrame(() => {
        this.frame = 0;
        // Not docked any more: no longer watched (docked again, watched again)
        const was = this.current();
        if (!was) return this.follow(false);
        // (Its line, or the editor's box: a sidebar opened or closed)
        const at = this.at(was.edge);
        if (at.line !== was.line || at.left !== was.left || at.width !== was.width) this.moved();
      });
    });
  }

  start(): void {
    const win = this.doc.defaultView!;
    win.addEventListener("pointerdown", this.onPointer, { capture: true, passive: true });
    // The on-screen keyboard coming or going: the docked toolbar stays over it
    win.visualViewport?.addEventListener("resize", this.moved);
    win.visualViewport?.addEventListener("scroll", this.moved);
    // The keyboard overlaying the page (SilverBullet's on a phone): only it tells it came or went
    virtualKeyboardOf(win)?.addEventListener("geometrychange", this.moved);
  }

  stop(): void {
    const win = this.doc.defaultView!;
    win.removeEventListener("pointerdown", this.onPointer, { capture: true });
    win.visualViewport?.removeEventListener("resize", this.moved);
    win.visualViewport?.removeEventListener("scroll", this.moved);
    virtualKeyboardOf(win)?.removeEventListener("geometrychange", this.moved);
    this.follow(false);
  }

  /**
   * Where the toolbar docks at an edge: across SilverBullet's editor (else the
   * window), so not over its sidebars; at the top, the editor's top (not its
   * view's: the view is below the room kept for the toolbar); at the bottom,
   * on the line `line` says, within the editor
   */
  at(edge: Dock["edge"]): Dock {
    const win = this.doc.defaultView!;
    const box = editorBox(this.doc);
    const left = box ? Math.max(0, box.left) : 0;
    const width = box ? Math.min(win.innerWidth, box.right) - left : win.innerWidth;
    if (edge === "top") return { edge, line: box ? box.top : viewTopOf(this.doc.querySelector(CONTENT_SELECTOR)), left, width };
    const line = this.line();
    return { edge, line: box ? Math.min(line, box.bottom) : line, left, width };
  }

  /** What moves it watched while it is docked, or no longer (elements put in and taken out only: no text) */
  follow(on: boolean): void {
    if (on === this.watching) return;
    this.watching = on;
    if (on) {
      this.watch.observe(this.doc.body, { childList: true, subtree: true });
      // (SilverBullet's view above the keyboard measured anew: its variables on html)
      this.watch.observe(this.doc.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
      return;
    }
    this.watch.disconnect();
    if (this.frame) this.doc.defaultView!.cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /**
   * Whether what has the focus is still SilverBullet's editor: a field in it (a
   * table's cell editor), or none after a press in it (a table takes the focus
   * on a touch)
   */
  stillEditing(active: Element | null): boolean {
    return inEditor(active) || ((!active || active === this.doc.body) && this.pressedInEditor);
  }

  /**
   * The line the toolbar docked at the bottom stands on: SilverBullet's
   * keyboard bar's top where it shows; else the bottom of what SilverBullet
   * shows above the keyboard, where it pins its UI there (a phone); else the
   * on-screen keyboard's top: where it overlays the page (the VirtualKeyboard
   * API's `overlaysContent`: the window and the visual viewport keep their
   * size) its own rectangle's, else the visual viewport's bottom
   */
  private line(): number {
    const win = this.doc.defaultView!;
    const view = win.visualViewport;
    const keyboard = virtualKeyboardOf(win);
    const overlaid = keyboard?.overlaysContent && keyboard.boundingRect && keyboard.boundingRect.height > 0 ? keyboard.boundingRect.top : undefined;
    return keyboardBarTop(this.doc) ?? pinnedViewBottom(this.doc) ?? overlaid ?? (view ? view.offsetTop + view.height : win.innerHeight);
  }

  private onPointer = (e: PointerEvent): void => {
    this.pressedInEditor = e.target instanceof Node && inEditor(e.target);
  };
}

/** The VirtualKeyboard API (Chrome on Android), where there is one: what the toolbar reads of it */
type VirtualKeyboard = EventTarget & { readonly overlaysContent?: boolean; readonly boundingRect?: DOMRect };
function virtualKeyboardOf(win: Window): VirtualKeyboard | undefined {
  return (win.navigator as Navigator & { virtualKeyboard?: VirtualKeyboard }).virtualKeyboard;
}
