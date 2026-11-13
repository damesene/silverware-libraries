// What Silverware Layout and a plugin drawing widgets (a table, a database, a chart) agree on, so that Silverware
// Layout lays the page out, widgets' boxes included, knowing no widget by name or format (docs/silverware-layout.md,
// *The contract between Silverware Layout and a widget's plugin*): Silverware Layout's API as a plugin's init page
// hands it over, or its stand-in without it (`layoutOf`), and the provider a widget's plugin registers with it.
//
// Responsibilities: the widget's plugin draws the widget and keeps Silverware Layout's entries for it in its own
// markdown, in its own form, without understanding them; Silverware Layout alone reads their meaning and shows them,
// on the element the provider's selector matches. Without Silverware Layout nothing of the layout shows.

/** The version of Silverware Layout's API this file is written for: another is taken as none (updated apart) */
export const LAYOUT_VERSION = 1;

/**
 * Silverware Layout's entries for one widget: its keys (`width`) and their values, as text whose meaning is Silverware
 * Layout's. The widget's plugin keeps every key apart from its own, under the name `layout` in its own form
 * (`layout.width` in a table's metadata, a chart's `%% layout.width: 1100`, a database block's `layout.width: 1100`),
 * and gives back what it kept as it was written: a key it does not know is kept like any other.
 */
export type LayoutEntries = Readonly<Record<string, string>>;

/** Entries changed in one write: a value set, or `null` for a key taken off (a reset) */
export type LayoutChanges = Readonly<Record<string, string | null>>;

/**
 * Where a widget stays as its width changes: centred on the text (a drag of its right edge widens it on both sides),
 * or at the text's start (it grows to the right alone, as an image in a text)
 */
export type LayoutAnchor = "center" | "start";

/**
 * A widget plugin's part that Silverware Layout talks to, one per kind of widget a plugin draws.
 *
 * The element its selector matches is the widget's box. While the widget is in the page's flow, the box's width is
 * Silverware Layout's: the plugin sets no `width`, `max-width` or margin on it and never replaces its `style`
 * attribute whole (Silverware Layout's variables are in it). What the widget lays out inside the box stays its own. A
 * plugin taking the widget out of the page's flow (over the window, onto a sheet) marks it, or an element around it,
 * with `data-silverware-over-window` (shared/overwindow.ts): Silverware Layout stands back there.
 */
export type LayoutProvider = {
  // Who it is: a provider registered under a name already registered replaces it (Space Lua loaded again runs the
  // plugins' init pages again, and Silverware Layout's API is the same object)
  readonly name: string;
  // The CSS selector of its widgets' elements as rendered in the editor (`.sb-table-widget`): the widget's own outer
  // element, never an element of the editor's around it
  readonly selector: string;
  // The entries kept for the widget whose element this is, `{}` where it has none. Synchronous: called as SilverBullet
  // renders the widget, so that it is laid out before it is painted
  read(element: Element): LayoutEntries;
  // The widget's entries changed in its markdown in one edit (one step of undo), the plugin's own way. Resolves to
  // `undefined` where written, or to why not, as text for the user (a plugin that may store nothing new: Silverware
  // Layout then shows the change for the view only)
  write(element: Element, changes: LayoutChanges): Promise<string | undefined>;
  // Optional: the part of the widget the user sees (top and bottom in the window), where it is not its whole box: a
  // table holding its header in view while its rows scroll away, those above the header hidden. Silverware Layout
  // places the handle of its width by it. None (or undefined): the widget's box
  seen?(element: Element): { readonly top: number; readonly bottom: number } | undefined;
  // Optional: where the widget whose element this is stays as its width changes (none: centred). A widget's own (a
  // setting may choose it), asked as it is laid out
  anchor?(element: Element): LayoutAnchor;
};

/** What a widget's plugin registers its providers with: Silverware Layout's API (`silverware.layout.api`), or the stand-in without it */
export type Layout = {
  readonly version: number;
  // A provider registered, its widgets laid out from now on (one of the same name replaced); the function given back
  // unregisters it
  register(provider: LayoutProvider): () => void;
};

/**
 * What a widget's plugin registers its providers with: Silverware Layout's API as the plugin's init page hands it
 * over, where it is there and of the version this file is written for; else the stand-in, which lays nothing out. A
 * plugin calls it once and never asks which it got
 */
export function layoutOf(given: unknown): Layout {
  if (given && typeof given === "object") {
    const api = given as Partial<Layout>;
    if (api.version === LAYOUT_VERSION && typeof api.register === "function") return api as Layout;
  }
  return STAND_IN;
}

const STAND_IN: Layout = {
  version: LAYOUT_VERSION,
  register: () => () => undefined,
};
