// Markdown rendered outside SilverBullet's editor (Silverware Layout's grid cells): what was drawn there and where it
// is in the page's text, for a plugin that decorates what is drawn (Silverware Assets: a file embedded or linked).
// The contract between them, as shared/layout.ts is between Silverware Layout and the widgets' plugins
// (docs/silverware-assets-split.md, *The one place they meet*): the one drawing offers it, the one decorating asks for
// it, neither reads the other's HTML. Handed over as `silverware.layout.api.rendered`. The other way, the plugin that
// draws files registers what draws an embed in an editor of that markdown (a grid's cell edited: `drawEmbeds`), so that
// a file looks there as in the page.
import type { EditorEmbed } from "./editor.ts";

/** The version of this contract: a plugin asks for the one it was built for, and gets a stand-in otherwise */
export const RENDERED_VERSION = 1;

/** A file embedded or linked, as drawn outside the editor */
export type RenderedItem = {
  readonly kind: "embed" | "link";
  // Its medium (<img>, <video>, <audio>, <object>), or the place drawn for a file the host draws none of; a link's <a>
  readonly element: HTMLElement;
  // Its target as written in the page (a wiki link's name, a markdown link's URL), and its form
  readonly target: string;
  readonly style: "wiki" | "markdown";
  // Where its text starts in the page's text
  readonly position: number;
  // The box it is drawn in (a grid's cell): what a width given to it is a share of
  readonly room: HTMLElement;
};

/** A range of the page's text drawn outside the editor (a grid's cell) */
export type RenderedRange = { readonly from: number; readonly to: number };

/**
 * What draws an embed in an editor of markdown rendered outside the page's (a grid's cell edited), read-only (no menu,
 * nothing written: the text is not the page's yet): its markdown (`![[report.pdf]]`) and the page it is in (its target
 * resolved from it). None: left as its markdown
 */
export type EmbedDrawer = (markdown: string, page: string) => EditorEmbed | undefined;

export type Rendered = {
  readonly version: number;
  /** What is drawn outside the editor now, its places known */
  items(): readonly RenderedItem[];
  /**
   * The ranges of a page's text (as given: the one its caller read) drawn outside the editor, whether drawn now or not
   * (a grid scrolled away): their embeds are none of the editor's own widgets
   */
  ranges(text: string): readonly RenderedRange[];
  /**
   * Told as what is drawn changes: items drawn, drawn anew, or given their places later (a block drawn while the
   * editor's text was still the page before); given what is drawn now. The function given back stops it
   */
  onChange(listener: (items: readonly RenderedItem[]) => void): () => void;
  /**
   * What draws embeds in its editors, registered (one registered again replaces it); the function given back takes it
   * off. Optional: a Silverware Layout before it has none (its other parts used still)
   */
  drawEmbeds?(drawer: EmbedDrawer): () => void;
};

const STAND_IN: Rendered = { version: RENDERED_VERSION, items: () => [], ranges: () => [], onChange: () => () => undefined, drawEmbeds: () => () => undefined };

/** The API as handed over, where it is of this version; else the stand-in: nothing drawn, nothing told */
export function renderedOf(given: unknown): Rendered {
  if (given && typeof given === "object") {
    const api = given as Partial<Rendered>;
    if (api.version === RENDERED_VERSION && typeof api.items === "function" && typeof api.ranges === "function" && typeof api.onChange === "function") return api as Rendered;
  }
  return STAND_IN;
}
