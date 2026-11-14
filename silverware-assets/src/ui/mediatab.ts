// The Assets tab of the settings window (docs/silverware-assets.md, *Settings and the Media tab*): how a file is
// shown and what a click and a Shift+click on it do, for all types and per type ("Default": as for all), what its card
// shows, where it stays as its width is dragged. The window shows it among its tabs, saves it on Save.
import { el } from "../../../shared/elements.ts";
import { type AssetSettings, type CardField, type Gesture, type PreviewSize, type View, VIEWS } from "../model/settings.ts";
import { iconElement } from "./card.ts";

const VIEW_LABELS: Readonly<Record<View, string>> = { icon: "Card", preview: "Preview", embed: "Original" };
const NONE = "";
// The heights a preview may be given (px)
const MIN_HEIGHT = 40;
const MAX_HEIGHT = 2000;
const DEFAULT = "*";

/** A tab of a settings window: its panel, whether it changed, its save (why not, as text) */
export type SettingsTab = {
  readonly id: string;
  readonly title: string;
  readonly panel: HTMLElement;
  changed(): boolean;
  save(): Promise<string | undefined>;
};

export type MediaTabInput = {
  readonly settings: AssetSettings;
  // The registered types (their names and icons) and actions (their names and labels), in the order registered
  readonly types: readonly { readonly name: string; readonly icon: string }[];
  readonly actions: readonly { readonly name: string; readonly label?: string }[];
};

/** A height typed (px, whole, within the bounds); anything else: the one it had */
function heightOf(typed: string, had: number): number {
  const value = Math.round(Number(typed));
  return typed.trim() && Number.isFinite(value) && value >= MIN_HEIGHT && value <= MAX_HEIGHT ? value : had;
}

/** A side of a preview's size typed (px, whole, within the bounds); empty: none (all files'); anything else: the one it had */
function sideOf(typed: string, had: number | undefined): number | undefined {
  if (!typed.trim()) return undefined;
  const value = Math.round(Number(typed));
  return Number.isFinite(value) && value >= MIN_HEIGHT && value <= MAX_HEIGHT ? value : had;
}

/** A field of a preview's side (px): its value, or empty where it follows another (that one its placeholder) */
function sideField(doc: Document, label: string, value: number | undefined, follows: string): HTMLInputElement {
  const field = el(doc, "input", { class: "swa-settings-number swa-settings-side", attrs: { type: "number", min: MIN_HEIGHT, max: MAX_HEIGHT, step: 10, placeholder: follows, "aria-label": label } });
  field.value = value === undefined ? "" : String(value);
  return field;
}

/** A select of options, value first */
function select(doc: Document, label: string, options: readonly (readonly [string, string])[], value: string): HTMLSelectElement {
  const field = el(doc, "select", { class: "swa-settings-select", attrs: { "aria-label": label } });
  for (const [v, text] of options) field.append(el(doc, "option", { text, attrs: { value: v } }));
  field.value = value;
  return field;
}

export function mediaTab(doc: Document, input: MediaTabInput, save: (settings: AssetSettings) => Promise<string | undefined>): SettingsTab {
  const { settings } = input;
  const views = VIEWS.map((view) => [view, VIEW_LABELS[view]] as const);
  const actions = [...input.actions.map(({ name, label }) => [name, label ?? name] as const), [NONE, "Nothing"] as const];

  // All files
  const allView = select(doc, "All files: shown as", views, settings.views.default);
  const allClick = select(doc, "All files: a click", actions, settings.actions.default.click ?? NONE);
  const allShift = select(doc, "All files: a Shift+click", actions, settings.actions.default["shift+click"] ?? NONE);
  const anchor = select(doc, "Width dragged", [["start", "Stays at the start"], ["center", "Centred"]], settings.anchor);
  // A preview's height where its embed gives none (px): a number typed, one that is none kept as it was
  const previewHeight = el(doc, "input", { class: "swa-settings-number", attrs: { type: "number", min: MIN_HEIGHT, max: MAX_HEIGHT, step: 10, "aria-label": "A preview's height (px)" } });
  previewHeight.value = String(settings.heights.preview);
  // A preview's width for all files (none: as wide as it fits)
  const previewWidth = sideField(doc, "A preview's width (px)", settings.previews.width, "auto");
  // (The original's: a viewer of SilverBullet's that has no height of its own, a PDF's)
  const embedHeight = el(doc, "input", { class: "swa-settings-number", attrs: { type: "number", min: MIN_HEIGHT, max: MAX_HEIGHT, step: 10, "aria-label": "An original PDF's height (px)" } });
  embedHeight.value = String(settings.heights.embed);
  // What a card shows besides the file's name, each a box
  const cardField = (field: CardField) => {
    const box = el(doc, "input", { attrs: { type: "checkbox" } });
    box.checked = settings.card.includes(field);
    return box;
  };
  const cardIcon = cardField("icon");
  const cardSize = cardField("size");
  const cardDate = cardField("modified");
  const linkIcons = el(doc, "input", { attrs: { type: "checkbox" } });
  linkIcons.checked = settings.linkIcons;
  const all = el(
    doc,
    "div",
    "swa-settings-all",
    el(doc, "div", "swa-settings-heading", "All files"),
    el(doc, "label", "swa-settings-field", "Shown as", allView),
    el(doc, "label", "swa-settings-field", "A click", allClick),
    el(doc, "label", "swa-settings-field", "A Shift+click", allShift),
    el(doc, "label", "swa-settings-field", "Width dragged", anchor),
    el(doc, "label", "swa-settings-field", "A preview's size", el(doc, "span", "swa-settings-unit", previewWidth, "×", previewHeight, "px")),
    el(doc, "label", "swa-settings-field", "An original PDF's height", el(doc, "span", "swa-settings-unit", embedHeight, "px")),
    el(doc, "div", "swa-settings-checks", el(doc, "span", { text: "Cards show" }), el(doc, "label", "swa-settings-check", cardIcon, "Its icon"), el(doc, "label", "swa-settings-check", cardSize, "Its size"), el(doc, "label", "swa-settings-check", cardDate, "Its date")),
    el(doc, "div", "swa-settings-checks", el(doc, "label", "swa-settings-check", linkIcons, "Links to files show the file's icon")),
  );

  // Per type: "Default" follows All files
  const rows = input.types.map((type) => {
    const own = (gesture: Gesture) => settings.actions.types[type.name]?.[gesture];
    const view = select(doc, `${type.name}: shown as`, [[DEFAULT, "Default"], ...views], settings.views.types[type.name] ?? DEFAULT);
    const click = select(doc, `${type.name}: a click`, [[DEFAULT, "Default"], ...actions], own("click") ?? DEFAULT);
    const shift = select(doc, `${type.name}: a Shift+click`, [[DEFAULT, "Default"], ...actions], own("shift+click") ?? DEFAULT);
    // Its preview's size: empty, all files' (their values its placeholders)
    const size = settings.previews.types[type.name] ?? {};
    const width = sideField(doc, `${type.name}: a preview's width (px)`, size.width, settings.previews.width === undefined ? "auto" : String(settings.previews.width));
    const height = sideField(doc, `${type.name}: a preview's height (px)`, size.height, String(settings.heights.preview));
    const row = el(doc, "div", "swa-settings-type", el(doc, "span", "swa-settings-type-name", iconElement(doc, type.icon), type.name), view, click, shift, el(doc, "span", "swa-settings-unit", width, "×", height));
    return { name: type.name, view, click, shift, width, height, row };
  });
  const table = el(
    doc,
    "div",
    "swa-settings-types",
    el(doc, "div", "swa-settings-type swa-settings-type-head", el(doc, "span", { text: "Type" }), el(doc, "span", { text: "Shown as" }), el(doc, "span", { text: "Click" }), el(doc, "span", { text: "Shift+click" }), el(doc, "span", { text: "Preview (px)" })),
    ...rows.map((one) => one.row),
  );

  /** The settings as the tab has them now */
  const current = (): AssetSettings => {
    const viewTypes: Record<string, View> = {};
    const previewTypes: Record<string, PreviewSize> = {};
    const actionTypes: Record<string, Partial<Record<Gesture, string>>> = {};
    for (const one of rows) {
      if (one.view.value !== DEFAULT) viewTypes[one.name] = one.view.value as View;
      const gestures: Partial<Record<Gesture, string>> = {};
      if (one.click.value !== DEFAULT) gestures.click = one.click.value;
      if (one.shift.value !== DEFAULT) gestures["shift+click"] = one.shift.value;
      if (Object.keys(gestures).length) actionTypes[one.name] = gestures;
      const had = settings.previews.types[one.name] ?? {};
      const width = sideOf(one.width.value, had.width);
      const height = sideOf(one.height.value, had.height);
      if (width !== undefined || height !== undefined) previewTypes[one.name] = { ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }) };
    }
    const allWidth = sideOf(previewWidth.value, settings.previews.width);
    const defaults: Partial<Record<Gesture, string>> = {};
    defaults.click = allClick.value;
    defaults["shift+click"] = allShift.value;
    return {
      ...settings,
      views: { default: allView.value as View, types: viewTypes },
      actions: { default: defaults, types: actionTypes },
      card: [...(cardIcon.checked ? (["icon"] as const) : []), "name", ...(cardSize.checked ? (["size"] as const) : []), ...(cardDate.checked ? (["modified"] as const) : [])],
      anchor: anchor.value === "center" ? "center" : "start",
      heights: { preview: heightOf(previewHeight.value, settings.heights.preview), embed: heightOf(embedHeight.value, settings.heights.embed) },
      previews: { ...(allWidth === undefined ? {} : { width: allWidth }), types: previewTypes },
      linkIcons: linkIcons.checked,
    };
  };
  const was = JSON.stringify(current());

  return {
    id: "assets",
    title: "Assets",
    panel: el(doc, "div", "swa-settings", all, table),
    changed: () => JSON.stringify(current()) !== was,
    save: () => save(current()),
  };
}
