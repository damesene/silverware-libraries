// The charts drawn: each a box with a canvas and its Chart.js instance, kept
// while shown so it can follow its source and the theme in place.
//
// SilverBullet renders a code widget more than once (verified: twice each on
// opening a page), one of the elements never shown; and it removes a widget's
// element when it scrolls far out of view or the page changes. A chart whose
// element is gone is destroyed (Chart.js keeps listeners and a resize
// observer otherwise).
import type { ChartModel } from "./model.ts";
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
  readonly box: HTMLElement;
  readonly chart: ChartInstance;
  // The page it is on, and its model as its block has it (its source not read yet)
  readonly page: string;
  readonly model: ChartModel;
  // Made at (ms), and whether it was seen in the document since
  readonly made: number;
  seen: boolean;
};

// An element never shown within this time is taken as SilverBullet's spare rendering
const UNSEEN_MS = 10_000;

export class DrawnCharts {
  private readonly drawn = new Set<Drawn>();

  add(entry: Drawn): void {
    this.drawn.add(entry);
  }

  /** The charts still shown (or about to be), those gone destroyed */
  shown(now = Date.now()): Drawn[] {
    const out: Drawn[] = [];
    for (const entry of this.drawn) {
      if (entry.box.isConnected) {
        entry.seen = true;
        out.push(entry);
      } else if (entry.seen || now - entry.made > UNSEEN_MS) {
        entry.chart.destroy();
        this.drawn.delete(entry);
      }
    }
    return out;
  }

  /** A chart drawn anew with a configuration: its data and options replaced, animated where only the data changed */
  static redraw(entry: Drawn, config: ChartConfig): void {
    entry.chart.data = config.data;
    entry.chart.options = config.options ?? {};
    entry.chart.update();
  }
}
