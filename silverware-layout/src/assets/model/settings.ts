// The assets' settings (docs/silverware-layout-assets.md, *Settings and the Media tab*): how an asset is shown and
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
};

export const DEFAULT_ASSET_SETTINGS: AssetSettings = {
  views: { default: "embed", types: {} },
  actions: { default: { click: "open-tab", "shift+click": "open-tab" }, types: {} },
  card: ["icon", "name"],
  heights: { preview: 160, embed: 480 },
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
    },
    problems,
  };
}
