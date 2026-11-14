// The handle of a widget's width (docs/silverware-layout.md, *What it does*): a bar beside the right edge of the widget
// the pointer is over, outside its box (as Confluence's beside a table), quiet until the pointer is on it. Dragging it
// widens or narrows the widget on both sides (it stays centred on the text), snapping to the text's width and to the
// guides; every frame only shown, the width written on release (one edit). A double click takes the width off (the
// text's again), Esc during a drag puts it back. The arrow keys on the focused bar change the width by 10 px (Shift:
// 50), written once they rest a moment. The handle is the plugin's own element in the body, never in SilverBullet's
// editor, so a press on it moves no cursor. A finger has no hover: a touch on a widget shows its handle, a touch
// elsewhere hides it, a double tap is the double click.
import { el } from "../../../shared/elements.ts";
import type { LayoutAnchor } from "../../../shared/layout.ts";
import type { Guide } from "../model/settings.ts";
import { draggedRoomWidth, draggedWidth, MIN_ROOM_WIDTH, MIN_WIDGET_WIDTH, PANE_GUTTER, roomTargets, type SnapTarget, snapped, snapTargets, type WidgetWidth, widestWidth, widthName } from "../core/widgetwidth.ts";
import { EdgeLines } from "./edges.ts";
import { GuideLines } from "./guidelines.ts";

const BASE = "swl-handle";
// The bar's height at most and at least (px): centred on the part of the widget in view, so a tall table's is in view
const BAR_MAX = 120;
const BAR_MIN = 24;
// How long the pointer may be off the widget and the handle before the handle goes (ms): the way from one to the other
const LEAVE_MS = 400;
// How far right of a widget's edge the pointer shows its handle (px): where the bar is. A widget showing a document of
// its own (a PDF's viewer, Chromium 2026-11-14) takes every move over it, the page told of none: its handle is found
// from beside it
const EDGE_ZONE = 16;
// How long the arrow keys rest before their width is written (ms)
const KEYS_MS = 400;
// The most between two taps of a finger on the bar for a double tap (ms)
const DOUBLE_TAP_MS = 400;

/** What the handle asks of whoever lays the widgets out */
export type HandleHost<W> = {
  // The widget a node is in, where one is laid out (in the page's flow)
  widgetAt(node: Element): W | undefined;
  element(widget: W): HTMLElement;
  // Its width as kept (none: the text's)
  kept(widget: W): WidgetWidth | undefined;
  // Shown at a width, nothing written
  show(element: HTMLElement, width: WidgetWidth | undefined): void;
  // Written (none: taken off)
  write(widget: W, width: WidgetWidth | undefined): Promise<void>;
  textWidth(): number;
  paneWidth(): number;
  guides(): readonly Guide[];
  // The part of the window the page is seen in (below SilverBullet's top bar), top and bottom
  view(): { readonly top: number; readonly bottom: number };
  // The part of a widget the user sees, where its plugin says it is not its whole box (a held header)
  seen(widget: W): { readonly top: number; readonly bottom: number } | undefined;
  // Where a drag's guides go: the box the page scrolls in, so they lie under its widgets (none: over the page)
  guideLayer(): HTMLElement | undefined;
  // Whether widgets are laid out now (not in a narrow pane)
  enabled(): boolean;
  // Where a widget stays as its width changes (none: centred): a drag widens it on both sides, or to the right alone
  anchor?(widget: W): LayoutAnchor;
  // The width of the box a widget is laid out in, where it is not the page's text (a cell): its quarters its snaps, no wider
  room?(widget: W): number | undefined;
  // What a widget without a width of its own is (none: as wide as the text): of its own size, the text's width it snaps to kept as pixels
  unsized?(widget: W): "text" | "own";
  // Whether each edge of a widget is dragged alone too (ui/edges.ts), and what that asks: where the text's middle is
  // (x in the window), a width and a shift off that middle shown (nothing written), and written in one edit
  edges?(widget: W): boolean;
  textMiddle?(): number | undefined;
  showPlace?(element: HTMLElement, width: WidgetWidth | undefined, shift: number): void;
  writePlace?(widget: W, width: WidgetWidth | undefined, shift: number): Promise<void>;
};

type Drag = { readonly pointer: number; readonly x: number; readonly start: number; readonly was: WidgetWidth | undefined; now: WidgetWidth | undefined; moved: boolean };

export class WidthHandle<W> {
  private readonly box: HTMLElement;
  private readonly bar: HTMLButtonElement;
  private widget: W | undefined;
  private drag: Drag | undefined;
  private leaveTimer: ReturnType<typeof setTimeout> | undefined;
  private keysTimer: ReturnType<typeof setTimeout> | undefined;
  private keyed: { readonly widget: W; width: number } | undefined;
  // While a drag goes on: a guide for each width it snaps to, a quiet line each side of the text's middle
  private readonly lines: GuideLines;
  // A widget's edges dragged alone, where its provider has them (a line on each)
  private readonly edges: EdgeLines<W>;
  // The guide the drag snapped to last, lit as the page scrolls meanwhile
  private near: string | undefined;
  // Where the widget's middle was last: a widget drawn anew (after a write) is found there again
  private middle: { readonly x: number; readonly y: number } | undefined;
  // When a finger last tapped the bar, and when two taps took a width off: a browser may send a double click after
  // them as well, not taken twice
  private tapped = -Infinity;
  private tappedTwice = -Infinity;

  constructor(
    private readonly doc: Document,
    private readonly host: HandleHost<W>,
  ) {
    this.bar = el(doc, "button", { class: `${BASE}-bar`, attrs: { "aria-label": "Widget width: drag, or the arrow keys; a double click for the text's width" } });
    this.box = el(doc, "div", { class: BASE, attrs: { hidden: "" } }, this.bar);
    this.lines = new GuideLines(doc, host);
    this.edges = new EdgeLines(doc, host, this.lines);
    doc.body.append(this.box);
    doc.addEventListener("pointermove", (e) => this.pointed(e), { passive: true });
    doc.addEventListener("pointerdown", (e) => this.touched(e), { capture: true, passive: true });
    doc.addEventListener("scroll", () => this.follow(), { capture: true, passive: true });
    doc.defaultView?.addEventListener("resize", () => this.follow());
    this.bar.addEventListener("pointerdown", (e) => this.pressed(e));
    this.bar.addEventListener("pointermove", (e) => this.dragged(e));
    this.bar.addEventListener("pointerup", (e) => void this.released(e));
    this.bar.addEventListener("pointercancel", () => this.cancel());
    this.bar.addEventListener("dblclick", (e) => {
      e.preventDefault();
      if (e.timeStamp - this.tappedTwice > DOUBLE_TAP_MS * 2) this.takeOff();
    });
    this.bar.addEventListener("keydown", (e) => this.key(e));
    doc.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.drag) {
        e.preventDefault();
        e.stopPropagation();
        this.cancel();
      }
    }, true);
  }

  /** The element of the widget the handle is for, while it shows */
  get shownFor(): HTMLElement | undefined {
    return this.widget && !this.box.hidden ? this.host.element(this.widget) : undefined;
  }

  private pointed(e: PointerEvent): void {
    if (this.drag || this.edges.dragging || e.pointerType === "touch") return;
    const target = e.target instanceof Element ? e.target : undefined;
    if (!target) return;
    if (this.box.contains(target) || this.edges.contains(target)) return this.stay();
    const widget = this.host.enabled() ? (this.host.widgetAt(target) ?? this.besideEdge(e.clientX, e.clientY)) : undefined;
    if (widget) {
      this.stay();
      this.showFor(widget);
    } else if (!this.box.hidden && !this.leaveTimer) this.leaveTimer = setTimeout(() => this.hide(), LEAVE_MS);
  }

  /** The widget whose right edge a point is just beside, where its bar is */
  private besideEdge(x: number, y: number): W | undefined {
    const near = this.doc.elementFromPoint(x - EDGE_ZONE, y);
    const widget = near ? this.host.widgetAt(near) : undefined;
    if (!widget) return undefined;
    const right = this.host.element(widget).getBoundingClientRect().right;
    return x >= right && x <= right + EDGE_ZONE ? widget : undefined;
  }

  /** A finger (or a pen) on the page, which has no hover: on a widget its handle shows, elsewhere it goes */
  private touched(e: PointerEvent): void {
    if (this.drag || this.edges.dragging || e.pointerType === "mouse") return;
    const target = e.target instanceof Element ? e.target : undefined;
    if (!target || this.box.contains(target) || this.edges.contains(target)) return;
    const widget = this.host.enabled() ? this.host.widgetAt(target) : undefined;
    if (widget) {
      this.stay();
      this.showFor(widget);
    } else this.hide();
  }

  /** The width taken off: the text's again */
  private takeOff(): void {
    this.place();
    if (this.widget && !this.box.hidden) void this.host.write(this.widget, undefined).then(() => this.settle());
  }

  private stay(): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = undefined;
  }

  private showFor(widget: W): void {
    this.widget = widget;
    this.box.hidden = false;
    this.place();
    this.label();
  }

  private hide(): void {
    this.stay();
    if (this.drag || this.edges.dragging) return;
    this.box.hidden = true;
    this.widget = undefined;
    this.edges.hide();
  }

  /** Placed by the widget's right edge, centred on the part of it in view */
  private place(): void {
    let element = this.widget && this.host.element(this.widget);
    if (!element?.isConnected) {
      // Drawn anew (its plugin wrote it): the widget where it was, if one is there
      const at = this.middle && this.doc.elementFromPoint(this.middle.x, this.middle.y);
      const again = at ? this.host.widgetAt(at) : undefined;
      if (!again) return this.hide();
      this.widget = again;
      element = this.host.element(again);
    }
    const rect = element.getBoundingClientRect();
    // The part of the widget in view: the bar centred on it, BAR_MAX at most (a tall table's bar stays in view as it
    // scrolls); of what its plugin says is seen of it (a table's held header, the rows under it hidden)
    const view = this.host.view();
    const seen = this.host.seen(this.widget!) ?? rect;
    const top = Math.max(seen.top, view.top);
    const bottom = Math.max(top, Math.min(seen.bottom, view.bottom));
    const height = Math.min(BAR_MAX, Math.max(BAR_MIN, bottom - top));
    this.middle = { x: rect.left + rect.width / 2, y: top + Math.min((bottom - top) / 2, 20) };
    // (Held in the view: a sliver of a widget in view gets the least bar, not out over the top bar)
    const at = Math.min(Math.max(top + (bottom - top - height) / 2, view.top), view.bottom - height);
    Object.assign(this.box.style, { left: `${Math.round(rect.right + 6)}px`, top: `${Math.round(at)}px`, height: `${Math.round(height)}px` });
    // (A widget whose edges are dragged has its lines in place of the bar: one control a side)
    this.box.classList.toggle(`${BASE}-bare`, !!this.host.edges?.(this.widget!));
    this.edges.show(this.widget);
  }

  /** Placed again as the page scrolls or the window changes; gone where its widget is (drawn anew, scrolled away) */
  private follow(): void {
    if (this.box.hidden) return;
    this.place();
    this.label();
    if (this.drag) this.placeGuides(this.near);
  }

  /** Followed a while after a write: the widget is drawn anew a moment later, at its new width */
  private settle(): void {
    for (const ms of [50, 200, 600]) setTimeout(() => this.follow(), ms);
  }

  /** What the bar says: the width now */
  private label(): void {
    if (!this.widget) return;
    const kept = this.drag ? this.drag.now : this.host.kept(this.widget);
    const named = widthName(kept);
    this.bar.title = `Width: ${named}. Drag to change it, double-click for the text's width`;
  }

  private pressed(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    // (Its widget drawn anew since it was shown, after a write: the one where it was taken)
    this.place();
    if (!this.widget || this.box.hidden) return;
    this.bar.setPointerCapture(e.pointerId);
    const element = this.host.element(this.widget);
    const was = this.host.kept(this.widget);
    this.drag = { pointer: e.pointerId, x: e.clientX, start: element.getBoundingClientRect().width, was, now: was, moved: false };
    this.box.classList.add(`${BASE}-dragging`);
    this.showGuides();
  }

  /** The guides of a drag: the targets it can snap to, placed by its widget's middle */
  private showGuides(): void {
    const middle = this.middleOf();
    if (middle === undefined) return;
    this.lines.show(this.targets(), middle, this.anchorOf());
  }

  /** The guides placed again by the widget's middle (the page scrolled, the widget wider), the one of `near` lit */
  private placeGuides(near: string | undefined): void {
    const middle = this.middleOf();
    if (middle !== undefined) this.lines.place(middle, near, this.anchorOf());
  }

  /** The width of the room the widget is in, where it is not the page's text */
  private roomOf(): number | undefined {
    return this.widget ? this.host.room?.(this.widget) : undefined;
  }

  /** What the widget's width snaps to: its room's quarters, else the text's width and the guides */
  private targets(): SnapTarget[] {
    const room = this.roomOf();
    const unsized = this.widget ? this.host.unsized?.(this.widget) : undefined;
    if (room !== undefined) return roomTargets(room);
    // (A widget at the text's start reaches the pane's right edge alone: a guide wider, Full width, none of its)
    const widest = widestWidth(this.host.paneWidth(), this.anchorOf(), this.host.textWidth());
    return snapTargets(this.host.textWidth(), this.host.guides(), this.host.paneWidth(), unsized).filter((target) => target.width <= widest + 0.5);
  }

  /** Where a drag by `moved` from `start` takes the width: within its room, else within the pane */
  private draggedTo(start: number, moved: number): number {
    const room = this.roomOf();
    return room !== undefined ? draggedRoomWidth(start, moved, room, this.anchorOf()) : draggedWidth(start, moved, this.host.paneWidth(), this.anchorOf(), this.host.textWidth());
  }

  /** Where the widget dragged stays as its width changes */
  private anchorOf(): LayoutAnchor {
    return (this.widget && this.host.anchor?.(this.widget)) || "center";
  }

  /** Where the guides are placed from (x in the window): the widget's middle, or its left edge where it stays at the start; none where it is not in the page */
  private middleOf(): number | undefined {
    const element = this.widget && this.host.element(this.widget);
    if (!element?.isConnected) return undefined;
    const rect = element.getBoundingClientRect();
    return this.anchorOf() === "start" ? rect.left : rect.left + rect.width / 2;
  }

  private dragged(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointer || !this.widget) return;
    const moved = e.clientX - drag.x;
    if (!drag.moved && Math.abs(moved) < 2) return;
    drag.moved = true;
    const snap = snapped(this.draggedTo(drag.start, moved), this.targets());
    drag.now = snap.kept;
    this.host.show(this.host.element(this.widget), snap.kept);
    this.place();
    this.near = snap.name;
    this.placeGuides(snap.name);
    this.label();
  }

  private async released(e: PointerEvent): Promise<void> {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointer) return;
    this.end();
    // A finger's two taps: the double click it has not
    if (!drag.moved && e.pointerType !== "mouse") {
      if (e.timeStamp - this.tapped <= DOUBLE_TAP_MS) {
        this.tapped = -Infinity;
        this.tappedTwice = e.timeStamp;
        return this.takeOff();
      }
      this.tapped = e.timeStamp;
    }
    if (drag.moved && this.widget && drag.now !== drag.was) await this.host.write(this.widget, drag.now);
    this.label();
    this.settle();
  }

  /** A drag ended without writing (Esc, the pointer taken away): the widget as it was */
  private cancel(): void {
    const drag = this.drag;
    if (!drag) return;
    this.end();
    if (this.widget) this.host.show(this.host.element(this.widget), drag.was);
    this.place();
    this.label();
  }

  private end(): void {
    if (this.drag && this.bar.hasPointerCapture(this.drag.pointer)) this.bar.releasePointerCapture(this.drag.pointer);
    this.drag = undefined;
    this.box.classList.remove(`${BASE}-dragging`);
    this.lines.clear();
  }

  private key(e: KeyboardEvent): void {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step || !this.widget) return;
    e.preventDefault();
    const widget = this.widget;
    const from = this.keyed?.widget === widget ? this.keyed.width : this.host.element(widget).getBoundingClientRect().width;
    const to = Math.round(from + step * (e.shiftKey ? 50 : 10));
    const room = this.roomOf();
    const width = room !== undefined ? Math.max(Math.min(MIN_ROOM_WIDTH, room), Math.min(room, to)) : Math.max(MIN_WIDGET_WIDTH, Math.min(this.host.paneWidth() - PANE_GUTTER, to));
    this.keyed = { widget, width };
    this.host.show(this.host.element(widget), width);
    this.place();
    clearTimeout(this.keysTimer);
    this.keysTimer = setTimeout(() => {
      const keyed = this.keyed;
      this.keyed = undefined;
      if (keyed) void this.host.write(keyed.widget, keyed.width).then(() => this.settle());
    }, KEYS_MS);
  }
}
