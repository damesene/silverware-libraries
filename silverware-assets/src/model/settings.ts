// The assets' settings (docs/silverware-assets.md, *Settings and the Media tab*): how an asset is shown and
// what a click on it does, a default and an override per type, what the card shows, a view's default height. Types and
// actions are named here as data, never as code. Pure.

export type View = "icon" | "preview" | "embed";
export type Gesture = "click" | "shift+click";
export type CardField = "icon" | "name" | "size" | "modified";

export const VIEWS: readonly View[] = ["icon", "preview", "embed"];
export const GESTURES: readonly Gesture[] = ["click", "shift+click"];
export const CARD_FIELDS: readonly CardField[] = ["icon", "name", "size", "modified"];

export type AssetSettings = {
  // The view of an embed without its own: per type, else the default
  readonly views: { readonly default: View; readonly types: Readonly<Record<string, View>> };
  // The action of a gesture: per type, else the default (an action's name; none: no action)
  readonly actions: { readonly default: Readonly<Partial<Record<Gesture, string>>>; readonly types: Readonly<Record<string, Readonly<Partial<Record<Gesture, string>>>>> };
  readonly card: readonly CardField[];
  // A view's height where nothing gives one (px)
  readonly heights: Readonly<Record<"preview" | "embed", number>>;
  // A preview's size: its width for all files (none: as wide as it fits), and per type its width and height (none:
  // all files'); the height for all files is `heights.preview`. An image fits in it, its ratio kept; a PDF's is so large
  readonly previews: { readonly width?: number; readonly types: Readonly<Record<string, PreviewSize>> };
  // Where an asset stays as its width is dragged: at the text's start (it grows to the right), or centred
  readonly anchor: "start" | "center";
  // Whether a link to a file of the space (`[[report.pdf]]`) shows its type's icon before its text
  readonly linkIcons: boolean;
};

/** A preview's size of a type's own: its width, its height (px), each none where all files' holds */
export type PreviewSize = { readonly width?: number; readonly height?: number };

/** The least and the most a preview's side may be (px) */
export const PREVIEW_LIMITS = { min: 40, max: 2000 } as const;

/** A preview's size for a type: its own width and height, else all files' (the height `heights.preview`, the width none: as wide as it fits) */
export function previewSize(settings: AssetSettings, type: string): { readonly width?: number; readonly height: number } {
  const own = settings.previews.types[type] ?? {};
  const width = own.width ?? settings.previews.width;
  return { ...(width === undefined ? {} : { width }), height: own.height ?? settings.heights.preview };
}

/** Where the settings are kept (read whole): Silverware Assets' own block of CONFIG (tables the Configuration Manager would lose) */
export const ASSETS_PATH = "silverware.assets";

/** The settings as kept, each key its own path (`silverware.assets.views`…): other settings under `silverware.assets` left as they are */
export function storedAssetPaths(settings: AssetSettings): Record<string, unknown> {
  return Object.fromEntries(Object.entries(storedAssetSettings(settings)).map(([key, value]) => [`${ASSETS_PATH}.${key}`, value]));
}

/** The settings as kept: plain data, as Lua writes a table */
export function storedAssetSettings(settings: AssetSettings): Record<string, unknown> {
  return {
    views: { default: settings.views.default, types: { ...settings.views.types } },
    actions: { default: { ...settings.actions.default }, types: Object.fromEntries(Object.entries(settings.actions.types).map(([k, v]) => [k, { ...v }])) },
    card: [...settings.card],
    heights: { ...settings.heights },
    previews: { ...(settings.previews.width === undefined ? {} : { width: settings.previews.width }), types: Object.fromEntries(Object.entries(settings.previews.types).map(([k, v]) => [k, { ...v }])) },
    anchor: settings.anchor,
    linkIcons: settings.linkIcons,
  };
}

export const DEFAULT_ASSET_SETTINGS: AssetSettings = {
  views: { default: "embed", types: {} },
  actions: { default: { click: "open-tab", "shift+click": "open-tab" }, types: {} },
  card: ["icon", "name"],
  heights: { preview: 160, embed: 480 },
  previews: { types: {} },
  anchor: "start",
  linkIcons: true,
};

const isView = (value: unknown): value is View => typeof value === "string" && (VIEWS as readonly string[]).includes(value);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** The settings as configured (a value not read: its default), and what was not read, as text */
export function readAssetSettings(value: unknown): { readonly settings: AssetSettings; readonly problems: readonly string[] } {
  const given = record(value);
  const problems: string[] = [];
  const views = record(given.views);
  const viewDefault = views.default === undefined ? DEFAULT_ASSET_SETTINGS.views.default : isView(views.default) ? views.default : (problems.push(`"${String(views.default)}" is no view (icon, preview or embed)`), DEFAULT_ASSET_SETTINGS.views.default);
  const viewTypes: Record<string, View> = {};
  for (const [type, view] of Object.entries(record(views.types))) {
    if (isView(view)) viewTypes[type] = view;
    else problems.push(`"${String(view)}" is no view (icon, preview or embed), for ${type}`);
  }
  const actions = record(given.actions);
  const gestures = (one: unknown) => {
    const out: Partial<Record<Gesture, string>> = {};
    for (const [gesture, name] of Object.entries(record(one))) {
      if ((GESTURES as readonly string[]).includes(gesture) && typeof name === "string" && name) out[gesture as Gesture] = name;
    }
    return out;
  };
  const actionTypes: Record<string, Partial<Record<Gesture, string>>> = {};
  for (const [type, one] of Object.entries(record(actions.types))) actionTypes[type] = gestures(one);
  const card = Array.isArray(given.card) ? given.card.filter((field): field is CardField => (CARD_FIELDS as readonly unknown[]).includes(field)) : DEFAULT_ASSET_SETTINGS.card;
  const heights = record(given.heights);
  const height = (key: "preview" | "embed") => (typeof heights[key] === "number" && (heights[key] as number) > 0 ? (heights[key] as number) : DEFAULT_ASSET_SETTINGS.heights[key]);
  return {
    settings: {
      views: { default: viewDefault, types: viewTypes },
      actions: { default: actions.default === undefined ? DEFAULT_ASSET_SETTINGS.actions.default : gestures(actions.default), types: actionTypes },
      card,
      heights: { preview: height("preview"), embed: height("embed") },
      previews: readPreviews(given.previews),
      anchor: given.anchor === "center" ? "center" : "start",
      linkIcons: given.linkIcons !== false,
    },
    problems,
  };
}

/** Where the settings of SilverBullet's markdown shown as written are (the Configuration Manager's block: booleans) */
export const SYNTAX_PATHS = {
  hides: "silverware.assets.syntaxMode.hideAssets",
  clicks: "silverware.assets.syntaxMode.clickPlacesCursor",
} as const;

/**
 * What Silverware Assets does while SilverBullet shows the markdown as written (Editor: Toggle Markdown Syntax
 * Rendering): embedded files hidden (SilverBullet draws them there still), a click on a link placing the cursor alone
 * (Ctrl/Cmd+click following it). Both on unless the user turns one off
 */
export type SyntaxModeSettings = { readonly hideAssets: boolean; readonly clickPlacesCursor: boolean };

/** The settings of the markdown shown as written, as configured (anything but false: on) */
export const readSyntaxModeSettings = (get: (path: string) => unknown): SyntaxModeSettings => ({
  hideAssets: get(SYNTAX_PATHS.hides) !== false,
  clickPlacesCursor: get(SYNTAX_PATHS.clicks) !== false,
});

/** A preview's sizes as configured: each side a number within PREVIEW_LIMITS, anything else none */
function readPreviews(value: unknown): AssetSettings["previews"] {
  const given = record(value);
  const side = (one: unknown) => (typeof one === "number" && one >= PREVIEW_LIMITS.min && one <= PREVIEW_LIMITS.max ? Math.round(one) : undefined);
  const types: Record<string, PreviewSize> = {};
  for (const [type, one] of Object.entries(record(given.types))) {
    const size = record(one);
    const width = side(size.width);
    const height = side(size.height);
    if (width !== undefined || height !== undefined) types[type] = { ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }) };
  }
  const width = side(given.width);
  return { ...(width === undefined ? {} : { width }), types };
}
