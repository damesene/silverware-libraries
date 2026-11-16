// The assets' settings (docs/silverware-assets.md, *Settings and the Media tab*): how an asset is shown and
// what a click on it does, a default and an override per type, and each view's own (a preview's, a file's shown full, a
// card's, a link's: as the Appearance tab, docs/silverware-assets-names.md). Types and actions are named here as data,
// never as code. Pure.

export type View = "card" | "preview" | "full";
export type Gesture = "click" | "shift+click";
export type CardField = "icon" | "name" | "size" | "modified";
// What a link to a file shows besides its text: its type's icon (none: a small arrow after it opens its menu)
export type LinkField = "icon";
// What a preview's label may show (docs/silverware-assets-label.md): the type's icon, the alt text (else the name), the
// name, the size, the date changed
export type LabelField = "icon" | "alt" | "name" | "size" | "modified";

export const VIEWS: readonly View[] = ["card", "preview", "full"];

/**
 * How a file is inserted (pasted, dropped, uploaded: docs/silverware-assets-insert.md): as its view shows it (`shown`:
 * as *Show as* says, no view written), a link, or a view of its own
 */
export type InsertAs = "shown" | "link" | View;
export const INSERT_AS: readonly InsertAs[] = ["shown", "link", "card", "preview", "full"];
export const GESTURES: readonly Gesture[] = ["click", "shift+click"];
export const CARD_FIELDS: readonly CardField[] = ["icon", "name", "size", "modified"];
export const LINK_FIELDS: readonly LinkField[] = ["icon"];
export const LABEL_FIELDS: readonly LabelField[] = ["icon", "alt", "name", "size", "modified"];

/** A property of a preview's label, shown or not */
export type LabelPart = { readonly field: LabelField; readonly on: boolean };
/** A preview's label: the properties above it and under it, in order (each property once, in one of the two) */
export type PreviewLabel = { readonly above: readonly LabelPart[]; readonly below: readonly LabelPart[] };

export type AssetSettings = {
  // The view of an embed without its own: per type, else the default
  readonly views: { readonly default: View; readonly types: Readonly<Record<string, View>> };
  // The action of a gesture: per type, else the default (an action's name; none: no action)
  readonly actions: { readonly default: Readonly<Partial<Record<Gesture, string>>>; readonly types: Readonly<Record<string, Readonly<Partial<Record<Gesture, string>>>>> };
  // A preview: its size for all files (its width none: as wide as it fits) and per type its width and height (none:
  // all files'; an image fits in it, its ratio kept; a PDF's is so large), its label for all files and a type's own
  readonly preview: { readonly width?: number; readonly height: number; readonly types: Readonly<Record<string, PreviewSize>>; readonly labels: Labels };
  // A file shown full: a document's height where nothing gives one (a PDF's viewer, a reader of Word or Excel: no height
  // of their own), for all files and a type's own; its label alike (none shown unless the user turns one on: a file
  // shown as SilverBullet draws it)
  readonly full: { readonly height: number; readonly types: Readonly<Record<string, { readonly height?: number }>>; readonly labels: Labels };
  // What a card shows
  readonly card: { readonly fields: readonly CardField[] };
  // What a link to a file of the space (`[[report.pdf]]`) shows besides its text: its type's icon (its menu's way in);
  // without it, a small arrow after it is
  readonly link: { readonly fields: readonly LinkField[] };
  // Whether a preview slow to make (a PDF's page) is kept in the space once made (docs/silverware-assets-stored-previews.md);
  // off, each is made as it is shown, Regenerate preview not offered (those kept are left: Clean up previews)
  readonly storePreviews: boolean;
  // The folder previews are kept in, from the space's top (a name starting with `_`: out of SilverBullet's pickers)
  readonly previewFolder: string;
  // Files pasted, dropped and uploaded put in by Silverware Assets' dialog (off: SilverBullet's own), and how each is
  // inserted: all files', and a type's own
  readonly insert: { readonly enabled: boolean; readonly as: { readonly default: InsertAs; readonly types: Readonly<Record<string, InsertAs>> } };
};

/** A view's labels: all files', and a type's own (whole, not in part) */
export type Labels = { readonly default: PreviewLabel; readonly types: Readonly<Record<string, PreviewLabel>> };

/** Whether two labels are the same: each property in the same place, order and state */
export function sameLabel(a: PreviewLabel, b: PreviewLabel): boolean {
  const same = (x: readonly LabelPart[], y: readonly LabelPart[]) => x.length === y.length && x.every((part, i) => part.field === y[i]!.field && part.on === y[i]!.on);
  return same(a.above, b.above) && same(a.below, b.below);
}

/** A type's label as a view shows it (a preview's, a file's shown full): its own, else all files' */
export function labelFor(settings: AssetSettings, type: string, view: "preview" | "full" = "preview"): PreviewLabel {
  const labels = settings[view].labels;
  return labels.types[type] ?? labels.default;
}

/** A document's height shown full for a type: its own, else all files' (px) */
export const fullHeight = (settings: AssetSettings, type: string): number => settings.full.types[type]?.height ?? settings.full.height;

/** A preview's size of a type's own: its width and height (px), each none where all files' holds */
export type PreviewSize = { readonly width?: number; readonly height?: number };

/** The least and the most a preview's side may be (px) */
export const PREVIEW_LIMITS = { min: 40, max: 2000 } as const;

/** A preview's size for a type: its own width and height, else all files' (the width none: as wide as it fits) */
export function previewSize(settings: AssetSettings, type: string): { readonly width?: number; readonly height: number } {
  const own = settings.preview.types[type] ?? {};
  const width = own.width ?? settings.preview.width;
  return { ...(width === undefined ? {} : { width }), height: own.height ?? settings.preview.height };
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
    preview: {
      ...(settings.preview.width === undefined ? {} : { width: settings.preview.width }),
      height: settings.preview.height,
      types: Object.fromEntries(Object.entries(settings.preview.types).map(([k, v]) => [k, { ...v }])),
      labels: storedLabels(settings.preview.labels),
    },
    full: { height: settings.full.height, types: Object.fromEntries(Object.entries(settings.full.types).map(([k, v]) => [k, { ...v }])), labels: storedLabels(settings.full.labels) },
    card: { fields: [...settings.card.fields] },
    link: { fields: [...settings.link.fields] },
    // (Former settings, taken out of CONFIG as the settings are saved: where a file stands, Silverware Layout's now; a
    // view's settings before they were kept by view, docs/silverware-assets-names.md)
    originals: undefined,
    anchor: undefined,
    heights: undefined,
    previews: undefined,
    labels: undefined,
    originalLabels: undefined,
    linkIcons: undefined,
    storePreviews: settings.storePreviews,
    previewFolder: settings.previewFolder,
    insert: { enabled: settings.insert.enabled, as: { default: settings.insert.as.default, types: { ...settings.insert.as.types } } },
  };
}

/** A view's labels as kept: all files' and each type's own */
function storedLabels(labels: Labels): Record<string, unknown> {
  return { default: storedLabel(labels.default), types: Object.fromEntries(Object.entries(labels.types).map(([k, v]) => [k, storedLabel(v)])) };
}

/** A label as kept: each place a list of `{ field, on }` */
function storedLabel(label: PreviewLabel): Record<string, unknown> {
  const place = (parts: readonly LabelPart[]) => parts.map((part) => ({ field: part.field, on: part.on }));
  return { above: place(label.above), below: place(label.below) };
}

/** The label a preview has unless the user sets another: its type's icon and its alt text (else its name) above it, the rest off */
export const DEFAULT_LABEL: PreviewLabel = {
  above: [
    { field: "icon", on: true },
    { field: "alt", on: true },
    { field: "name", on: false },
  ],
  below: [
    { field: "size", on: false },
    { field: "modified", on: false },
  ],
};

/** A full file's label unless the user sets another: none, every property off where a preview's has it */
export const NO_LABEL: PreviewLabel = {
  above: DEFAULT_LABEL.above.map((part) => ({ ...part, on: false })),
  below: DEFAULT_LABEL.below.map((part) => ({ ...part, on: false })),
};

export const DEFAULT_ASSET_SETTINGS: AssetSettings = {
  views: { default: "full", types: {} },
  actions: { default: { click: "open-tab", "shift+click": "open-tab" }, types: {} },
  preview: { height: 160, types: {}, labels: { default: DEFAULT_LABEL, types: {} } },
  full: { height: 480, types: {}, labels: { default: NO_LABEL, types: {} } },
  card: { fields: ["icon", "name"] },
  link: { fields: ["icon"] },
  storePreviews: true,
  previewFolder: "_silverware-assets-previews",
  insert: { enabled: true, as: { default: "shown", types: {} } },
};

const isView = (value: unknown): value is View => typeof value === "string" && (VIEWS as readonly string[]).includes(value);
const isInsertAs = (value: unknown): value is InsertAs => typeof value === "string" && (INSERT_AS as readonly string[]).includes(value);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/**
 * Why a folder cannot keep previews, as text; none where it can. A path from the space's top, its parts plain names:
 * none empty, none `..`, none starting with a dot (SilverBullet reads no such path)
 */
export function validatePreviewFolder(folder: string): string | undefined {
  const parts = folder.replace(/^\/+|\/+$/g, "").split("/");
  if (!folder.trim() || parts.some((part) => !part.trim())) return "the folder has no name, or an empty part";
  if (parts.some((part) => part.startsWith("."))) return `"${folder}": SilverBullet reads no folder whose name starts with a dot`;
  if (/[\\:*?"<>|]/.test(folder)) return `"${folder}": a folder's name has none of \\ : * ? " < > |`;
  return undefined;
}

/** The previews' folder as configured, its slashes at either end taken off (none, or one that cannot: the default) */
function readPreviewFolder(value: unknown, problems: string[]): string {
  if (value === undefined) return DEFAULT_ASSET_SETTINGS.previewFolder;
  const folder = typeof value === "string" ? value.trim().replace(/^\/+|\/+$/g, "") : "";
  const problem = typeof value === "string" ? validatePreviewFolder(folder) : "the previews' folder is no text";
  if (problem) problems.push(problem);
  return problem ? DEFAULT_ASSET_SETTINGS.previewFolder : folder;
}

/** The settings as configured (a value not read: its default), and what was not read, as text */
export function readAssetSettings(value: unknown): { readonly settings: AssetSettings; readonly problems: readonly string[] } {
  const given = record(value);
  const problems: string[] = [];
  const views = record(given.views);
  const viewDefault = views.default === undefined ? DEFAULT_ASSET_SETTINGS.views.default : isView(views.default) ? views.default : (problems.push(`"${String(views.default)}" is no view (card, preview or full)`), DEFAULT_ASSET_SETTINGS.views.default);
  const viewTypes: Record<string, View> = {};
  for (const [type, view] of Object.entries(record(views.types))) {
    if (isView(view)) viewTypes[type] = view;
    else problems.push(`"${String(view)}" is no view (card, preview or full), for ${type}`);
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
  // (A view's fields as configured: those known, in their order; none given, its default)
  const fields = <F extends string>(value: unknown, known: readonly F[], fallback: readonly F[]): readonly F[] => {
    const list = record(value).fields;
    if (Array.isArray(list)) return list.filter((field): field is F => (known as readonly unknown[]).includes(field));
    // (An empty list comes back from CONFIG as an empty table, `{}`: none shown, not the default)
    return list && typeof list === "object" && !Object.keys(list).length ? [] : fallback;
  };
  const preview = record(given.preview);
  const full = record(given.full);
  const height = (value: unknown, fallback: number) => (typeof value === "number" && value > 0 ? value : fallback);
  return {
    settings: {
      views: { default: viewDefault, types: viewTypes },
      actions: { default: actions.default === undefined ? DEFAULT_ASSET_SETTINGS.actions.default : gestures(actions.default), types: actionTypes },
      preview: { ...readPreviewSizes(preview), height: height(preview.height, DEFAULT_ASSET_SETTINGS.preview.height), labels: readLabels(preview.labels, DEFAULT_LABEL) },
      full: { height: height(full.height, DEFAULT_ASSET_SETTINGS.full.height), types: readFullHeights(full.types), labels: readLabels(full.labels, NO_LABEL) },
      card: { fields: fields(given.card, CARD_FIELDS, DEFAULT_ASSET_SETTINGS.card.fields) },
      link: { fields: fields(given.link, LINK_FIELDS, DEFAULT_ASSET_SETTINGS.link.fields) },
      storePreviews: given.storePreviews !== false,
      previewFolder: readPreviewFolder(given.previewFolder, problems),
      insert: readInsert(given.insert, problems),
    },
    problems,
  };
}

/** How files are inserted as configured: on unless turned off, how each is inserted (one not read: as shown, said) */
function readInsert(value: unknown, problems: string[]): AssetSettings["insert"] {
  const given = record(value);
  const as = record(given.as);
  const one = (value: unknown, of?: string): InsertAs | undefined => {
    if (isInsertAs(value)) return value;
    problems.push(`"${String(value)}" is no way to insert a file (shown, link, card, preview or full)${of ? `, for ${of}` : ""}`);
    return undefined;
  };
  const types: Record<string, InsertAs> = {};
  for (const [type, value] of Object.entries(record(as.types))) {
    const read = one(value, type);
    if (read) types[type] = read;
  }
  return { enabled: given.enabled !== false, as: { default: as.default === undefined ? "shown" : (one(as.default) ?? "shown"), types } };
}

/** How a file of a type is inserted: the type's own, else all files' */
export const insertAsFor = (settings: AssetSettings, type: string): InsertAs => settings.insert.as.types[type] ?? settings.insert.as.default;

/** The labels of a view as configured: all files' (none: `fallback`) and each type's own */
function readLabels(value: unknown, fallback: PreviewLabel): Labels {
  const given = record(value);
  const types: Record<string, PreviewLabel> = {};
  for (const [type, one] of Object.entries(record(given.types))) types[type] = readLabel(one);
  return { default: given.default === undefined ? fallback : readLabel(given.default), types };
}

/**
 * A label as configured, read leniently: each place a list of `{ field, on }` (a field's name alone: on); a property
 * unknown dropped, one given twice kept where it is first, one missing added under the preview, off
 */
export function readLabel(value: unknown): PreviewLabel {
  const given = record(value);
  const seen = new Set<LabelField>();
  const place = (one: unknown): LabelPart[] =>
    (Array.isArray(one) ? one : []).flatMap((item): LabelPart[] => {
      const part = typeof item === "string" ? { field: item, on: true } : record(item);
      const field = part.field;
      if (!(LABEL_FIELDS as readonly unknown[]).includes(field) || seen.has(field as LabelField)) return [];
      seen.add(field as LabelField);
      return [{ field: field as LabelField, on: part.on !== false }];
    });
  const above = place(given.above);
  const below = place(given.below);
  for (const field of LABEL_FIELDS) if (!seen.has(field)) below.push({ field, on: false });
  return { above, below };
}

/** Where the settings of SilverBullet's markdown shown as written are (the Configuration Manager's block: booleans) */
export const SYNTAX_PATHS = {
  hides: "silverware.assets.syntaxMode.hideAssets",
} as const;

/**
 * What Silverware Assets does while SilverBullet shows the markdown as written (Editor: Toggle Markdown Syntax
 * Rendering): embedded files hidden (SilverBullet draws them there still). On unless the user turns it off. (A click
 * on a link there is Silverware Layout's: its Markdown tab, since 2026-11-15)
 */
export type SyntaxModeSettings = { readonly hideAssets: boolean };

/** The settings of the markdown shown as written, as configured (anything but false: on) */
export const readSyntaxModeSettings = (get: (path: string) => unknown): SyntaxModeSettings => ({
  hideAssets: get(SYNTAX_PATHS.hides) !== false,
});

/** Each type's own document height shown full as configured: a number within PREVIEW_LIMITS, anything else none */
function readFullHeights(value: unknown): Readonly<Record<string, { readonly height?: number }>> {
  const types: Record<string, { readonly height: number }> = {};
  for (const [type, one] of Object.entries(record(value))) {
    const height = record(one).height;
    if (typeof height === "number" && height >= PREVIEW_LIMITS.min && height <= PREVIEW_LIMITS.max) types[type] = { height: Math.round(height) };
  }
  return types;
}

/** A preview's sizes as configured (its width for all files, each type's): each side a number within PREVIEW_LIMITS, anything else none */
function readPreviewSizes(given: Record<string, unknown>): { readonly width?: number; readonly types: Readonly<Record<string, PreviewSize>> } {
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
