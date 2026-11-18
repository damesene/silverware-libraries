// What Silverware Assets (docs/silverware-assets.md) and whoever registers a type of asset or an action
// agree on: an embed's asset as a union by kind, a type's match, icon and renderers, a renderer's context, an action.
// A type provides renderers; Silverware Assets decides what is rendered (the view, the size, the host's own drawing,
// the card). A type and an action use only what they are handed, and import nothing of Silverware Assets. As
// shared/layout.ts: Silverware Assets' API as a plugin's init page hands it over, or a stand-in without it (`assetsOf`).
import type { FieldDrawing } from "./editor.ts";
import type { SheetArea } from "./sheetarea.ts";

/** The version of the assets' API this file is written for: another is taken as none (updated apart) */
export const ASSETS_VERSION = 1;

/**
 * The attribute a renderer marks its element with where it is as wide as the line it is in (a document's reader, read
 * at any width), not as what it draws; in a panel it fills the panel, its height too (`RenderContext.fills`)
 */
export const ASSET_WIDE_ATTRIBUTE = "data-asset-wide";

/** What an embed shows: a file of the space, a file of the web; later a page. Each kind its own required properties */
export type Asset = { readonly alt?: string } & (
  | { readonly kind: "file"; readonly path: string; readonly url: string; readonly mime?: string }
  | { readonly kind: "web"; readonly url: string; readonly mime?: string }
  | { readonly kind: "page"; readonly page: string; readonly section?: string }
);

/** How an asset is shown: a card with its icon, a small preview, or itself in full (a player, a viewer) */
export type AssetView = "card" | "preview" | "full";

/** Where an asset is rendered: in place of an embed, or (later) by a link in a line */
export type Placement = "block" | "inline";

/** The room an asset is drawn into, px, as it is now; told as it changes (a panel resized) */
export type Viewport = {
  readonly width: number;
  readonly height: number;
  onChange(changed: () => void, options?: { readonly signal?: AbortSignal }): void;
};

/** A type's own metadata keys of an embed: their values as written, read by the helpers, written through Silverware Assets */
export type AssetMetadata = {
  readonly values: Readonly<Record<string, string>>;
  number(key: string): number | undefined;
  boolean(key: string): boolean | undefined;
  text(key: string): string | undefined;
  /** Values written (a value, or null: taken off); why not, as text */
  write(changes: Readonly<Record<string, string | number | boolean | null>>): Promise<string | undefined>;
};

/**
 * A file's preview kept in the space (docs/silverware-assets-stored-previews.md): what its type made of it once (an
 * image, its HTML), read back in place of making it again while it is newer than the file. Its type decides what it
 * keeps and draws it itself; Silverware Assets keeps it, by its kind (`image/webp`, `image/png`, `text/html`)
 */
export type StoredPreview = {
  /** What was kept of a kind, where it is newer than the file (none: none kept, or the file changed since) */
  read(kind: string): Promise<Blob | undefined>;
  /** Kept, its kind its blob's type; why not, as text (a space that cannot be written: drawn as before) */
  write(data: Blob): Promise<string | undefined>;
  // Asked to be made anew (Regenerate preview): nothing kept taken, the type's own memory neither
  readonly anew?: boolean;
};

/** What a renderer is handed */
export type RenderContext = {
  readonly asset: Asset;
  readonly viewport: Viewport;
  readonly metadata: AssetMetadata;
  // Aborted when the render ends (drawn anew, another view, the page closed): what the renderer started ends with it
  readonly signal: AbortSignal;
  readonly placement: Placement;
  // Drawn into a container of its own (a side panel, the enlarged view), not the page: its room's height its own too
  readonly fills?: boolean;
  // A preview of a file of the space, where its type keeps previews (`storesPreview`) and the host can keep them
  readonly stored?: StoredPreview;
};

/** A renderer: an element, or null for the host to draw this asset as it draws it */
export type Renderer = (context: RenderContext) => HTMLElement | null | Promise<HTMLElement | null>;

/** Which assets a type takes; the more specific match wins (test, then ext, then an exact mime, then a mime wildcard, then kind alone) */
export type AssetMatch = {
  readonly kind: readonly Asset["kind"][];
  readonly ext?: readonly string[];
  readonly mime?: string;
  readonly test?: (asset: Asset) => boolean;
};

/** A type of asset, as registered */
export type AssetType = {
  readonly name: string;
  // What its files are called where people read it (a settings' row: "Images", "Word (DOCX)"); none: its name
  readonly label?: string;
  // Whether it is a document drawn full in a box of a height the settings give (a PDF's viewer, a reader of Word or
  // Excel: no height of its own), its height set per type; none: its files have their own size (an image, a video)
  readonly document?: boolean;
  readonly match: AssetMatch;
  // A plain image: a URL (drawn as <img>) or SVG text (inlined: currentColor follows the theme)
  readonly icon: string;
  // A view left out is drawn by the host where it can (Silverware Assets draws the card for every type)
  readonly views?: { readonly preview?: Renderer; readonly full?: Renderer };
  // Where its renderers draw (none: in place of an embed alone)
  readonly placements?: readonly Placement[];
  // Fields it adds to its card (a PDF's pages)
  readonly card?: (context: RenderContext) => Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>;
  // Why its own metadata are wrong, as text; undefined where they are right
  readonly validate?: (values: Readonly<Record<string, string>>) => string | undefined;
  // Whether its preview is kept in the space (`RenderContext.stored`, Regenerate preview in its menu): one slow to make
  readonly storesPreview?: boolean;
  // Whether it is costly to draw in any view (a document read whole and laid out in the page's script): where a file
  // is drawn before it is written (Silverware Assets' insert dialog), a large one is drawn on a click alone
  readonly costly?: boolean;
};

/** What an action is handed */
export type ActionContext = {
  readonly asset: Asset;
  /**
   * The asset rendered in a container of the action's (a panel, a popover), as Silverware Assets renders it; what the
   * rendering started ends with `signal` (the action's: its panel closed), else as the file is drawn anew in the page
   */
  render(view: Exclude<AssetView, "card">, container: HTMLElement, signal?: AbortSignal): Promise<void>;
  /** A URL opened in a new tab of the browser */
  open(url: string): void;
  /** Where a panel beside the page goes, as the host gives it (none: the window) */
  readonly sheetArea?: SheetArea;
};

/** What an asset can be shown as, for an action to decide whether it fits */
export type Capabilities = { readonly views: readonly AssetView[] };

/** An action on an asset: in its menu where it fits, and of a gesture on it (a click on its card or its preview) */
export type AssetAction = {
  readonly name: string;
  // What the user is shown (none: its name)
  readonly label?: string;
  // false: in an asset's menu alone, no gesture's (not offered for a click in the settings): a copy of the file
  readonly gesture?: boolean;
  // Where it goes in an asset's menu (docs/silverware-assets-menu.md): with the ways of opening the file ("open"), or
  // with what is done with the file itself, a copy, a download ("file"). None: "open"
  readonly group?: "open" | "file";
  fits(asset: Asset, can: Capabilities): boolean;
  run(context: ActionContext): unknown;
};

/** What an asset is called where it is shown: its alt text, else its file's name, its URL's, its page's */
export function assetName(asset: Asset): string {
  if (asset.alt) return asset.alt;
  if (asset.kind === "file") return asset.path.split("/").pop() ?? asset.path;
  if (asset.kind === "web") return asset.url.split(/[?#]/, 1)[0]!.split("/").pop() || asset.url;
  return asset.page;
}

/** The room a preview is drawn into (px): it fits in it, its proportions kept */
export type PreviewBox = { readonly width: number; readonly height: number };

/**
 * Files given by an event (a paste, a drop), read in it (its clipboard's and its drop's data are read there alone):
 * the files, the HTML and the address list beside them, which may hold an image's address on the web; where they came
 * from (a pasted image's name is the time's: the clipboard names every one alike)
 */
export type GivenFiles = { readonly files: readonly File[]; readonly html?: string; readonly uriList?: string; readonly source: "clipboard" | "drop" };

/** A file added through Silverware Assets' dialog: the target a link names, its title where one was given */
export type AddedFile = { readonly target: string; readonly title?: string };

/** Where files uploaded through Silverware Assets' dialog go: the folder their names are offered in (from the space's top) */
export type FilesPlace = { readonly folder: string };

/** What a plugin registers types and actions with */
export type Assets = {
  readonly version: number;
  readonly types: { register(type: AssetType): () => void };
  readonly actions: { register(action: AssetAction): () => void };
  /**
   * Optional: what Silverware Assets draws in another plugin's editor field of a page's markdown (its targets resolved
   * against `page`), as the page draws it: an embed, a file's link's icon and menu (shared/editor.ts `FieldDrawing`);
   * what they change written into the field where it gives them their markdown to edit. Each none where it draws none
   * (not started yet, no file's)
   */
  readonly fieldDrawing?: (page: string) => FieldDrawing;
  /**
   * Optional: a file's preview, its target as a link names it (a path of the space resolved against `page`, or an
   * address of the web), by its type's own renderer, fitted in `box`: no frame, label, menu nor click of its own. Where
   * its type keeps previews in the space (a PDF's, a document's), only the one kept is drawn, none made anew. Resolved
   * once drawn; null where none is (no type takes it, none kept, it failed): the caller draws its own. What it started
   * ends with `signal`
   */
  readonly drawPreview?: (target: string, page: string, box: PreviewBox, signal: AbortSignal) => Promise<HTMLElement | null>;
  /** Optional: a file shown in Silverware Assets' side panel, its target as a link names it (an address of the web: in a new tab where no panel takes it) */
  readonly showFile?: (target: string, page: string) => void;
  /**
   * Optional: files added through Silverware Assets' insert dialog: those an event gave (a link alone too: `uriList`),
   * or picked in it (the device's files, a link, a file of the space), their names offered in `place.folder`, nothing
   * asked of how they are shown (a link is the caller's to write). Resolved once they are written: each the target a
   * link names (a path of the space, an address of the web linked) and its title where one was given, in their order;
   * undefined where cancelled. A file not written is said, and left out
   */
  readonly insertFiles?: (given: GivenFiles | undefined, place: FilesPlace) => Promise<readonly AddedFile[] | undefined>;
  /**
   * Optional: files of the space deleted, as *Delete file…* deletes one, the previews kept of them with them; nothing
   * asked (the caller asks, naming them). Resolved with the paths not deleted, nothing said of them (the caller says)
   */
  readonly deleteFiles?: (paths: readonly string[]) => Promise<readonly string[]>;
};

/** Silverware Assets' API as handed over, where it is of this version; else the stand-in, registering nothing */
export function assetsOf(given: unknown): Assets {
  if (given && typeof given === "object") {
    const api = given as Partial<Assets>;
    if (api.version === ASSETS_VERSION && api.types && api.actions) return api as Assets;
  }
  return STAND_IN;
}

const STAND_IN: Assets = {
  version: ASSETS_VERSION,
  types: { register: () => () => undefined },
  actions: { register: () => () => undefined },
};
