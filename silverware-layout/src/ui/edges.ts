// The edges of a widget (docs/silverware-layout-grid.md, *Its edges*): for a widget whose provider says so (`edges`: a
// grid), a line on its left and right edge, over the part of it in view, in place of the handle's bar (the user's
// choice, 2026-11-14: one control a side). Dragged, that edge alone moves, the other standing: its place off the text's
// middle kept as its `shift` beside its width, snapping to where the text's width and the guides put an edge. With Alt,
// both edges move, its middle standing, its width snapping as the bar's did. The guides shown as for the bar; every frame
// only shown, written on release. A double click puts it back on the text's middle, its width kept; with Alt, the
// text's width (none of its own). Focused, the arrow keys move the edge by 10 px (Shift: 50; Alt: both edges), written
// once they rest. The lines are the plugin's own elements in the body, as the bar.
import { el } from "../../../shared/elements.ts";
import { draggedBoth, draggedEdge, type Edges, snapTargets, type WidgetWidth } from "../core/widgetwidth.ts";
import type { GuideLines } from "./guidelines.ts";
import type { HandleHost } from "./handle.ts";

const BASE = "swl-edge";
const DRAGGING = "swl-edge-dragging";
// How long the arrow keys rest before their change is written (ms)
const KEYS_MS = 400;

type Drag = { readonly pointer: number; readonly x: number; readonly edge: "left" | "right"; readonly both: boolean; readonly start: Edges; now?: { readonly width: WidgetWidth | undefined; readonly shift: number } };

export class EdgeLines<W> {
  private readonly left: HTMLElement;
  private readonly right: HTMLElement;
  private widget: W | undefined;
  private drag: Drag | undefined;
  // The arrow keys' change, written once they rest
  private keyed: { readonly widget: W; edges: Edges; width: WidgetWidth | undefined; shift: number } | undefined;
  private keysTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    doc: Document,
    private readonly host: HandleHost<W>,
    private readonly lines: GuideLines,
  ) {
    const line = (edge: "left" | "right") => {
      const element = el(doc, "div", {
        class: `${BASE} ${BASE}-${edge}`,
        attrs: {
          hidden: "",
          tabindex: "0",
          role: "separator",
          "aria-orientation": "vertical",
          "aria-label": `The ${edge} edge: drag, or the arrow keys`,
          title: `Drag to move the ${edge} edge (Alt: both edges, from the middle). Double-click to centre it on the text (Alt: the page's width)`,
        },
      });
      element.addEventListener("pointerdown", (e) => this.pressed(e, edge));
      element.addEventListener("pointermove", (e) => this.dragged(e));
      element.addEventListener("pointerup", (e) => void this.released(e));
      element.addEventListener("pointercancel", () => this.cancel());
      element.addEventListener("dblclick", (e) => {
        e.preventDefault();
        void (e.altKey ? this.takeOff() : this.centre());
      });
      element.addEventListener("keydown", (e) => this.key(e, edge));
      doc.body.append(element);
      return element;
    };
    this.left = line("left");
    this.right = line("right");
  }

  /** Whether a node is one of the lines */
  contains(node: Node): boolean {
    return this.left.contains(node) || this.right.contains(node);
  }

  get dragging(): boolean {
    return !!this.drag;
  }

  /** Shown on a widget's edges where its provider has them dragged alone, over the part of it in view; else hidden */
  show(widget: W | undefined): void {
    if (this.drag) return this.place();
    this.widget = widget && this.host.edges?.(widget) ? widget : undefined;
    this.place();
  }

  hide(): void {
    if (this.drag) return;
    this.widget = undefined;
    this.left.hidden = true;
    this.right.hidden = true;
  }

  private place(): void {
    const element = this.widget && this.host.element(this.widget);
    if (!element?.isConnected) {
      this.left.hidden = true;
      this.right.hidden = true;
      return;
    }
    const rect = element.getBoundingClientRect();
    const view = this.host.view();
    const top = Math.max(rect.top, view.top);
    const bottom = Math.max(top, Math.min(rect.bottom, view.bottom));
    for (const [line, x] of [
      [this.left, rect.left],
      [this.right, rect.right],
    ] as const) {
      line.hidden = bottom <= top;
      Object.assign(line.style, { left: `${Math.round(x)}px`, top: `${Math.round(top)}px`, height: `${Math.round(bottom - top)}px` });
    }
  }

  /** The widget's edges from the text's middle as it is shown now; none where the host says not where the text is */
  private edgesNow(): { readonly edges: Edges; readonly middle: number } | undefined {
    const element = this.widget && this.host.element(this.widget);
    const middle = this.host.textMiddle?.();
    if (!element?.isConnected || middle === undefined) return undefined;
    const rect = element.getBoundingClientRect();
    return { edges: { left: rect.left - middle, right: rect.right - middle }, middle };
  }

  private targets() {
    return snapTargets(this.host.textWidth(), this.host.guides(), this.host.paneWidth());
  }

  private pressed(e: PointerEvent, edge: "left" | "right"): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const now = this.edgesNow();
    if (!now || !this.widget) return;
    (edge === "left" ? this.left : this.right).setPointerCapture?.(e.pointerId);
    // (With Alt, both edges from its middle: the guides about it)
    this.drag = { pointer: e.pointerId, x: e.clientX, edge, both: e.altKey, start: now.edges };
    (edge === "left" ? this.left : this.right).classList.add(DRAGGING);
    this.lines.show(this.targets(), e.altKey ? now.middle + (now.edges.left + now.edges.right) / 2 : now.middle, "center");
  }

  private dragged(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointer || !this.widget) return;
    const middle = this.host.textMiddle?.();
    if (middle === undefined) return;
    const moved = (drag.both ? draggedBoth : draggedEdge)(drag.start, drag.edge, e.clientX - drag.x, this.host.paneWidth(), this.targets());
    drag.now = { width: moved.width, shift: moved.shift };
    this.host.showPlace?.(this.host.element(this.widget), moved.width, moved.shift);
    this.lines.place(drag.both ? middle + moved.shift : middle, moved.name, "center");
    this.place();
  }

  private async released(e: PointerEvent): Promise<void> {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointer) return;
    this.end();
    if (drag.now && this.widget) await this.host.writePlace?.(this.widget, drag.now.width, drag.now.shift);
    for (const ms of [50, 200, 600]) setTimeout(() => this.place(), ms);
  }

  /** A drag ended without writing: the widget as it was */
  private cancel(): void {
    const drag = this.drag;
    if (!drag) return;
    this.end();
    if (this.widget) {
      const width = Math.round(drag.start.right - drag.start.left);
      this.host.showPlace?.(this.host.element(this.widget), width, Math.round((drag.start.left + drag.start.right) / 2));
    }
    this.place();
  }

  private end(): void {
    this.drag = undefined;
    this.left.classList.remove(DRAGGING);
    this.right.classList.remove(DRAGGING);
    this.lines.clear();
  }

  /** The text's width again, none of its own (centred) */
  private async takeOff(): Promise<void> {
    if (!this.widget) return;
    await this.host.writePlace?.(this.widget, undefined, 0);
    for (const ms of [50, 200, 600]) setTimeout(() => this.place(), ms);
  }

  /** An arrow key on a focused line: that edge moved by 10 px (Shift: 50; Alt: both), shown at once, written as the keys rest */
  private key(e: KeyboardEvent, edge: "left" | "right"): void {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step || !this.widget) return;
    e.preventDefault();
    const widget = this.widget;
    const from = this.keyed?.widget === widget ? this.keyed.edges : this.edgesNow()?.edges;
    if (!from) return;
    const moved = (e.altKey ? draggedBoth : draggedEdge)(from, edge, step * (e.shiftKey ? 50 : 10), this.host.paneWidth(), []);
    this.keyed = { widget, edges: moved.edges, width: moved.width, shift: moved.shift };
    this.host.showPlace?.(this.host.element(widget), moved.width, moved.shift);
    this.place();
    clearTimeout(this.keysTimer);
    this.keysTimer = setTimeout(() => {
      const keyed = this.keyed;
      this.keyed = undefined;
      if (keyed) void this.host.writePlace?.(keyed.widget, keyed.width, keyed.shift);
    }, KEYS_MS);
  }

  /** Back on the text's middle, its width kept */
  private async centre(): Promise<void> {
    const now = this.edgesNow();
    if (!now || !this.widget) return;
    const width = Math.round(now.edges.right - now.edges.left);
    const kept = this.targets().find((target) => Math.round(target.width) === width);
    await this.host.writePlace?.(this.widget, kept ? kept.kept : width, 0);
    for (const ms of [50, 200, 600]) setTimeout(() => this.place(), ms);
  }
}
