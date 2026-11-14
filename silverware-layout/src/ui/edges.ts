// The edges of a widget dragged alone (docs/silverware-layout-grid.md, *Its edges*): for a widget whose provider says so
// (`edges`: a grid), a line on its left and right edge, over the part of it in view, as the handle shows for it. Dragged,
// that edge alone moves, the other standing (the handle's bar beside it still widens it on both sides): its place off
// the text's middle kept as its `shift` beside its width, snapping to where the text's width and the guides put an
// edge, their guides shown as for the bar; every frame only shown, written on release. A double click puts it back on
// the text's middle, its width kept. The lines are the plugin's own elements in the body, as the bar.
import { el } from "../../../shared/elements.ts";
import { draggedEdge, type Edges, snapTargets, type WidgetWidth } from "../core/widgetwidth.ts";
import type { GuideLines } from "./guidelines.ts";
import type { HandleHost } from "./handle.ts";

const BASE = "swl-edge";
const DRAGGING = "swl-edge-dragging";

type Drag = { readonly pointer: number; readonly x: number; readonly edge: "left" | "right"; readonly start: Edges; now?: { readonly width: WidgetWidth | undefined; readonly shift: number } };

export class EdgeLines<W> {
  private readonly left: HTMLElement;
  private readonly right: HTMLElement;
  private widget: W | undefined;
  private drag: Drag | undefined;

  constructor(
    doc: Document,
    private readonly host: HandleHost<W>,
    private readonly lines: GuideLines,
  ) {
    const line = (edge: "left" | "right") => {
      const element = el(doc, "div", { class: `${BASE} ${BASE}-${edge}`, attrs: { hidden: "", role: "separator", "aria-orientation": "vertical", title: `Drag to move the ${edge} edge alone; double-click to centre it on the text` } });
      element.addEventListener("pointerdown", (e) => this.pressed(e, edge));
      element.addEventListener("pointermove", (e) => this.dragged(e));
      element.addEventListener("pointerup", (e) => void this.released(e));
      element.addEventListener("pointercancel", () => this.cancel());
      element.addEventListener("dblclick", (e) => {
        e.preventDefault();
        void this.centre();
      });
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
    this.drag = { pointer: e.pointerId, x: e.clientX, edge, start: now.edges };
    (edge === "left" ? this.left : this.right).classList.add(DRAGGING);
    this.lines.show(this.targets(), now.middle, "center");
  }

  private dragged(e: PointerEvent): void {
    const drag = this.drag;
    if (!drag || e.pointerId !== drag.pointer || !this.widget) return;
    const middle = this.host.textMiddle?.();
    if (middle === undefined) return;
    const moved = draggedEdge(drag.start, drag.edge, e.clientX - drag.x, this.host.paneWidth(), this.targets());
    drag.now = { width: moved.width, shift: moved.shift };
    this.host.showPlace?.(this.host.element(this.widget), moved.width, moved.shift);
    this.lines.place(middle, moved.name, "center");
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
