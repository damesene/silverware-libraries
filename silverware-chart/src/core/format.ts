// A format: how a chart is written in a code block. The built-in ones
// (Mermaid, Obsidian Charts) and the user's (silverware.chart.defineFormats)
// alike; the core knows none of them.
import type { ChartModel, Unreadable } from "./model.ts";

export type ChartFormat = {
  // Its id (letters, digits, _), and its name as the menu says it (Convert to …)
  readonly name: string;
  readonly label: string;
  // The code blocks' languages it reads (```mermaid: "mermaid")
  readonly languages: readonly string[];
  /**
   * The block's text (between its fences) as a chart; undefined where it is
   * not one of this format's charts (another Mermaid diagram: handed on to
   * what drew it before), Unreadable where it is but cannot be read
   */
  readonly read: (text: string) => ChartModel | Unreadable | undefined;
  /**
   * The model as the block's text; `previous` the block's text as it was, so
   * what the model does not hold is kept where the format can
   */
  readonly write: (model: ChartModel, previous?: string) => string;
  /**
   * Whether it can write a setting (its key: "smooth", "series.kind"); left
   * out, it writes every one. One it cannot is shown, not offered, in the
   * settings dialog, rather than lost as the block is written
   */
  readonly supports?: (key: string) => boolean;
};
