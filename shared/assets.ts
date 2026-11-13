// What Silverware Layout's assets (docs/silverware-layout-assets.md) and whoever registers a type of asset or an action
// agree on: an embed's asset as a union by kind, a type's match, icon and renderers, a renderer's context, an action.
// A type provides renderers; Silverware Layout decides what is rendered (the view, the size, the host's own drawing,
// the card). A type and an action use only what they are handed, and import nothing of Silverware Layout. As
// shared/layout.ts: Silverware Layout's API as a plugin's init page hands it over, or a stand-in without it (`assetsOf`).

/** The version of the assets' API this file is written for: another is taken as none (updated apart) */
export const ASSETS_VERSION = 1;

/** What an embed shows: a file of the space, a file of the web; later a page. Each kind its own required properties */
export type Asset = { readonly alt?: string } & (
  | { readonly kind: "file"; readonly path: string; readonly url: string; readonly mime?: string }
  | { readonly kind: "web"; readonly url: string; readonly mime?: string }
  | { readonly kind: "page"; readonly page: string; readonly section?: string }
);

/** How an asset is shown: a card with its icon, a small preview, or itself (a player, a viewer) */
export type AssetView = "icon" | "preview" | "embed";

/** Where an asset is rendered: in place of an embed, or (later) by a link in a line */
export type Placement = "block" | "inline";

/** The room an asset is drawn into, px, as it is now; told as it changes (a panel resized) */
export type Viewport = {
  readonly width: number;
  readonly height: number;
  onChange(changed: () => void, options?: { readonly signal?: AbortSignal }): void;
};

/** A type's own metadata keys of an embed: their values as written, read by the helpers, written through Silverware Layout */
export type AssetMetadata = {
  readonly values: Readonly<Record<string, string>>;
  number(key: string): number | undefined;
  boolean(key: string): boolean | undefined;
  text(key: string): string | undefined;
  /** Values written (a value, or null: taken off); why not, as text */
  write(changes: Readonly<Record<string, string | number | boolean | null>>): Promise<string | undefined>;
};

/** What a renderer is handed */
export type RenderContext = {
  readonly asset: Asset;
  readonly viewport: Viewport;
  readonly metadata: AssetMetadata;
  // Aborted when the render ends (drawn anew, another view, the page closed): what the renderer started ends with it
  readonly signal: AbortSignal;
  readonly placement: Placement;
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
  readonly match: AssetMatch;
  // A plain image: a URL (drawn as <img>) or SVG text (inlined: currentColor follows the theme)
  readonly icon: string;
  // A view left out is drawn by the host where it can (Silverware Layout draws the card, `icon`, for every type)
  readonly views?: { readonly preview?: Renderer; readonly embed?: Renderer };
  // Where its renderers draw (none: in place of an embed alone)
  readonly placements?: readonly Placement[];
  // Fields it adds to its card (a PDF's pages)
  readonly card?: (context: RenderContext) => Readonly<Record<string, string>> | Promise<Readonly<Record<string, string>>>;
  // Why its own metadata are wrong, as text; undefined where they are right
  readonly validate?: (values: Readonly<Record<string, string>>) => string | undefined;
};

/** What an action is handed */
export type ActionContext = {
  readonly asset: Asset;
  /** The asset rendered in a container of the action's (a panel, a popover), as Silverware Layout renders it */
  render(view: Exclude<AssetView, "icon">, container: HTMLElement): Promise<void>;
  /** A URL opened in a new tab of the browser */
  open(url: string): void;
};

/** What an asset can be shown as, for an action to decide whether it fits */
export type Capabilities = { readonly views: readonly AssetView[] };

/** An action of a gesture on an asset (a click on its card or its preview) */
export type AssetAction = {
  readonly name: string;
  // What the user is shown (none: its name)
  readonly label?: string;
  fits(asset: Asset, can: Capabilities): boolean;
  run(context: ActionContext): unknown;
};

/** What a plugin registers types and actions with */
export type Assets = {
  readonly version: number;
  readonly types: { register(type: AssetType): () => void };
  readonly actions: { register(action: AssetAction): () => void };
};

/** Silverware Layout's assets API as handed over, where it is of this version; else the stand-in, registering nothing */
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
