// The charts drawn: each a box with a canvas and its Chart.js instance, kept
// while shown so it can follow its source and the theme in place.
//
// The box is an element of its own (`swc-chart`), so it knows when it enters
// and leaves the document: SilverBullet renders a code widget more than once
// (verified: twice each on opening a page), one of the elements never shown;
// CodeMirror takes a widget's element out and may put the same element back
// (drawing the page anew after an edit, scrolling it back into view). Its
// Chart.js instance is destroyed once it has been out a while (Chart.js keeps
// listeners and a resize observer otherwise), and made again if it comes back:
// destroyed for good at once, a chart came back as an empty box (seen about once
// in ten edits of a table).
import type { ChartFormat } from "./format.ts";
import type { ChartModel } from "./model.ts";
import type { SourceData } from "./module.ts";
import type { ChartConfig } from "./type.ts";

/** What the core uses of Chart.js: an instance on a canvas, its data and options replaced and updated */
export type ChartInstance = {
  data: unknown;
  options: unknown;
  update(mode?: string): void;
  destroy(): void;
};
export type ChartConstructor = new (canvas: HTMLCanvasElement, config: ChartConfig) => ChartInstance;

export type Drawn = {
  readonly box: ChartBox;
  // The page it is on, and its model as its block has it (its source not read yet)
  readonly page: string;
  readonly model: ChartModel;
  // Its block (its language and text, which find it in the page) and the format it was read by
  readonly language: string;
  readonly body: string;
  readonly format: ChartFormat;
  // Its source's data as last drawn (undefined: the block's own)
  data: SourceData | undefined;
};

// An element never shown, or shown and then out of the document, this long: its chart destroyed
const OUT_MS = 10_000;

/** The element a chart is drawn in: its chart made as it is, destroyed once out of the document a while, made again if it comes back */
export interface ChartBox extends HTMLElement {
  readonly chart: ChartInstance | undefined;
  /** Its chart made (now, and again as it comes back) by `make`; `entered`/`left` told as it is drawn or destroyed */
  setUp(make: () => ChartInstance, entered: () => void, left: () => void): void;
  /** Its chart made anew (Reload) */
  remake(): void;
}

const TAG = "swc-chart";

/** A chart's box in `doc` (the element defined there the first time) */
export function chartBox(doc: Document): ChartBox {
  const registry = doc.defaultView?.customElements;
  if (registry && !registry.get(TAG)) {
    const Base = doc.defaultView!.HTMLElement;
    registry.define(
      TAG,
      class extends Base implements ChartBox {
        // Private fields, not properties: SilverBullet walks a widget's element to show it, and a Chart.js
        // instance on it (its references round to itself) overflowed the stack
        #chart: ChartInstance | undefined;
        #make: (() => ChartInstance) | undefined;
        #entered: (() => void) | undefined;
        #left: (() => void) | undefined;
        #timer: ReturnType<typeof setTimeout> | undefined;

        get chart(): ChartInstance | undefined {
          return this.#chart;
        }

        setUp(make: () => ChartInstance, entered: () => void, left: () => void): void {
          this.#make = make;
          this.#entered = entered;
          this.#left = left;
          this.#chart = make();
          entered();
          // (One never put in the document: SilverBullet's spare rendering)
          if (!this.isConnected) this.#outLater();
        }

        remake(): void {
          if (!this.#make) return;
          this.#chart?.destroy();
          this.#chart = this.#make();
        }

        connectedCallback(): void {
          clearTimeout(this.#timer);
          if (!this.#chart && this.#make) {
            this.#chart = this.#make();
            this.#entered?.();
          }
        }

        disconnectedCallback(): void {
          this.#outLater();
        }

        #outLater(): void {
          clearTimeout(this.#timer);
          this.#timer = setTimeout(() => {
            if (this.isConnected || !this.#chart) return;
            this.#chart.destroy();
            this.#chart = undefined;
            this.#left?.();
          }, OUT_MS);
        }
      },
    );
  }
  return doc.createElement(TAG) as ChartBox;
}

export class DrawnCharts {
  private readonly drawn = new Set<Drawn>();

  add(entry: Drawn): void {
    this.drawn.add(entry);
  }

  remove(entry: Drawn): void {
    this.drawn.delete(entry);
  }

  /** The charts in the document now, drawn */
  shown(): Drawn[] {
    return [...this.drawn].filter((entry) => entry.box.isConnected && entry.box.chart);
  }

  /** A chart drawn anew with a configuration: its data and options replaced, animated where only the data changed */
  static redraw(entry: Drawn, config: ChartConfig): void {
    const chart = entry.box.chart;
    if (!chart) return;
    chart.data = config.data;
    chart.options = config.options ?? {};
    chart.update();
  }
}
