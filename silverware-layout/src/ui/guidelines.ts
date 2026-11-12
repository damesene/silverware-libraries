// The guides' lines over the page: for each target (the page's width, each guide the pane can hold) a quiet line each
// side of a middle (a widget is centred on the text, so its edges meet both), the right one named, the names in rows
// where they would touch. Drawn by a widget's handle while it is dragged (its target snapped to lit) and by the Page
// layout dialog's Preview while it is held. Class names `swl-handle-guide*` (the style page's).
import { el } from "../../../shared/elements.ts";

const BASE = "swl-handle";
// A guide's name: at its line's top, a row lower where it would touch the name left of it (px)
const LABEL_TOP = 4;
const LABEL_GAP = 4;

/** Where the lines go: the box the page scrolls in (under its widgets) and the part of the window the page is seen in */
export type GuideLayer = {
  guideLayer(): HTMLElement | undefined;
  view(): { readonly top: number; readonly bottom: number };
};

/** A line's target: its width and its name */
export type GuideTarget = { readonly width: number; readonly name: string };

export class GuideLines {
  private guides: { readonly name: string; readonly width: number; readonly lines: readonly HTMLElement[] }[] = [];

  constructor(
    private readonly doc: Document,
    private readonly host: GuideLayer,
  ) {}

  get shown(): boolean {
    return this.guides.length > 0;
  }

  /** The lines of these targets drawn, placed by `middle` (x in the window), their names in rows */
  show(targets: readonly GuideTarget[], middle: number): void {
    this.clear();
    for (const target of targets) {
      const width = Math.round(target.width);
      const left = el(this.doc, "div", `${BASE}-guide`);
      const right = el(this.doc, "div", { class: `${BASE}-guide`, attrs: { "data-swl-guide": target.name } }, el(this.doc, "span", { class: `${BASE}-guide-label`, text: target.name }));
      (this.host.guideLayer() ?? this.doc.body).append(left, right);
      this.guides.push({ name: target.name, width, lines: [left, right] });
    }
    this.place(middle);
    this.rowLabels();
  }

  /**
   * The lines placed by `middle`, over the whole height the page is seen in: in the box it scrolls in, by its scroll
   * (under its widgets, as Confluence's); else over the window. The one named `near` lit
   */
  place(middle: number, near?: string): void {
    if (!this.guides.length) return;
    const layer = this.host.guideLayer();
    const box = layer?.getBoundingClientRect();
    const view = this.host.view();
    // In the scrolling box its own coordinates (what it scrolled by added), else the window's
    const dx = layer && box ? layer.scrollLeft - box.left : 0;
    const top = layer ? layer.scrollTop : view.top;
    const height = `${Math.round(layer ? layer.clientHeight : view.bottom - view.top)}px`;
    for (const guide of this.guides) {
      const [left, right] = guide.lines;
      for (const [line, x] of [
        [left!, middle - guide.width / 2],
        [right!, middle + guide.width / 2],
      ] as const) {
        line.classList.toggle(`${BASE}-guide-fixed`, !layer);
        Object.assign(line.style, { left: `${Math.round(x + dx)}px`, top: `${Math.round(top)}px`, height });
        line.classList.toggle(`${BASE}-guide-near`, guide.name === near);
      }
    }
  }

  clear(): void {
    for (const guide of this.guides) for (const line of guide.lines) line.remove();
    this.guides = [];
  }

  /**
   * The names in rows: each, from the left, in the first row where it keeps clear of the name before it (two guides
   * near each other, as the page's width and 900 px, had their names over each other). Once a showing: the lines keep
   * their distances while it lasts
   */
  private rowLabels(): void {
    const labels = this.guides
      .map((guide) => guide.lines[1]!.firstElementChild as HTMLElement | null)
      .filter((label): label is HTMLElement => !!label)
      .map((label) => ({ label, box: label.getBoundingClientRect() }))
      .sort((a, b) => a.box.left - b.box.left);
    const ends: number[] = [];
    for (const { label, box } of labels) {
      let row = ends.findIndex((end) => end + LABEL_GAP <= box.left);
      if (row < 0) row = ends.length;
      ends[row] = box.right;
      label.style.top = `${LABEL_TOP + row * (Math.ceil(box.height) + 1)}px`;
    }
  }
}
