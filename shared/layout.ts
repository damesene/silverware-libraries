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
 * Silverware Layout's entries for one widget: its keys and their values, as text whose meaning is Silverware Layout's
 * (`width`; `align`: where it stands, `left`, `center` or `right`, docs/silverware-layout-align.md). The widget's
 * plugin keeps every key apart from its own, under the name `layout` in its own form (`layout.width` in a table's
 * metadata, a chart's `%% layout.width: 1100`, a database block's `layout.width: 1100`), and gives back what it kept
 * as it was written: a key it does not know is kept like any other. Silverware Layout reads and writes them through
 * the provider alone, never in the widget's markdown.
 */
export type LayoutEntries = Readonly<Record<string, string>>;

/** Entries changed in one write: a value set, or `null` for a key taken off (a reset) */
export type LayoutChanges = Readonly<Record<string, string | null>>;

/**
 * Where a widget stands (the entry `align`), and so stays as its width changes: at the left (a width grows to the
 * right, as an image in a text), centred (on both sides) or at the right (to the left, its handle at its left edge)
 */
export type LayoutAlign = "left" | "center" | "right";

/** A kind of widget a provider draws: its id (among the provider's), its name for the user, where it stands unless set (none: centred) */
export type LayoutKind = { readonly id: string; readonly name: string; readonly align?: LayoutAlign };

/**
 * A widget plugin's part that Silverware Layout talks to, one per kind of widget a plugin draws.
 *
 * The element its selector matches is the widget's box. While the widget is in the page's flow, the box's width is
 * Silverware Layout's: the plugin sets no `width`, `max-width` or margin on it and never replaces its `style`
 * attribute whole (Silverware Layout's variables are in it). What the widget lays out inside the box stays its own;
 * its style page may tell a box laid out at a width by `data-swl-width` on it (a medium then filling its frame). A
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
  // Optional: the kinds of widget it draws (a medium's preview and original, a table), each its default alignment, the
  // user's own default of each set in Silverware Layout's dialog; and which kind the widget whose element this is (none
  // said: the first). A widget stands as its entry `align` says, else its kind's default as the user set it, else as
  // its kind says, else centred. A provider with no kinds: its widgets as they are drawn (a width centred) where no
  // entry says otherwise
  readonly kinds?: readonly LayoutKind[];
  kindOf?(element: Element): string;
  // Optional: whether the widget whose element this is may be widened by the handle (none: yes). One that may not (a
  // preview, its size its plugin's settings') has the handle's grip alone: its menu, where it stands
  resizable?(element: Element): boolean;
  // Optional: whether its widgets' sizes follow the content's scale (shared/contentscale.ts: this device's font zoom,
  // where its user asked files to follow it): a width kept in px shown that many times wider, a drag's written back as
  // it would be at the scale of 1. None: not (a table's, a chart's)
  readonly scales?: boolean;
  // Optional: what a widget without a width of its own is: as wide as the text ("text", a table: none said) or of its
  // own size ("own", a medium: SilverBullet's size or the file's). Where its own, the text's width a drag snaps to is
  // kept as its pixels: none would give it back its own size
  readonly unsized?: "text" | "own";
  // Optional: the box the widget is laid out in, where it is not the page's text (a medium in markdown rendered outside
  // the editor, a grid's cell): its width then a share of that box's, snapped to its quarters, never wider; neither the
  // text's width nor the guides apply. None (or undefined): the page's text
  room?(element: Element): Element | undefined;
  // Optional: what the widget's plugin adds to the handle's menu (a click on its grip), under Silverware Layout's own
  // (Align, Width), a separator before each section: a grid's columns and borders. None: Layout's alone
  menu?(element: Element): readonly (readonly LayoutMenuEntry[])[];
};

/**
 * An item a provider adds to the handle's menu: its label, what it does (a promise where it writes: the handle placed
 * again once it is done, the widget drawn anew by then), a choice shown on (checked), why it cannot be (disabled)
 */
export type LayoutMenuItem = { readonly label: string; readonly run: () => unknown; readonly checked?: boolean; readonly disabled?: string; readonly danger?: boolean };

/**
 * A row of choices side by side a provider adds to the handle's menu (a grid's number of columns), after its label:
 * each its look (an SVG's text, or a short text: `2`, `XS`), its title, the one set active, why it cannot be
 * (disabled), what it does (a promise where it writes, as an item's)
 */
export type LayoutMenuChoices = {
  readonly kind: "segmented";
  readonly label: string;
  // (`keepsOpen`: the menu left open, shown anew once it is done: a choice that offers more, a grid's Auto its min width)
  readonly options: readonly { readonly icon: string; readonly title: string; readonly active?: boolean; readonly disabled?: string; readonly keepsOpen?: boolean; readonly run: () => unknown }[];
};

/** An entry of a provider's section of the handle's menu: an item, or a row of choices */
export type LayoutMenuEntry = LayoutMenuItem | LayoutMenuChoices;

/** What a widget's plugin registers its providers with: Silverware Layout's API (`silverware.layout.api`), or the stand-in without it */
export type Layout = {
  readonly version: number;
  // A provider registered, its widgets laid out from now on (one of the same name replaced); the function given back
  // unregisters it
  register(provider: LayoutProvider): () => void;
  // Optional: every widget laid out again, where a plugin changed what its provider reads of a widget already in the
  // page without putting a node into it (a medium's view changed by its menu). The stand-in's does nothing
  layOutAgain?(): void;
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
  layOutAgain: () => undefined,
};
