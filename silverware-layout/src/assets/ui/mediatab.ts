// The Media tab of the Page layout dialog (docs/silverware-layout-assets.md, *Settings and the Media tab*): how a
// medium is shown and what a click and a Shift+click on it do, for all types and per type ("Default": as for all),
// what its card shows, where it stays as its width is dragged. The dialog shows it among its tabs, saves it on Save.
import { el } from "../../../../shared/elements.ts";
import type { DialogTabPart } from "../../ui/pagedialog.ts";
import { type AssetSettings, type Gesture, type View, VIEWS } from "../model/settings.ts";
import { iconElement } from "./card.ts";

const VIEW_LABELS: Readonly<Record<View, string>> = { icon: "Card", preview: "Preview", embed: "In full" };
const NONE = "";
const DEFAULT = "*";

export type MediaTabInput = {
  readonly settings: AssetSettings;
  // The registered types (their names and icons) and actions (their names and labels), in the order registered
  readonly types: readonly { readonly name: string; readonly icon: string }[];
  readonly actions: readonly { readonly name: string; readonly label?: string }[];
};

/** A select of options, value first */
function select(doc: Document, label: string, options: readonly (readonly [string, string])[], value: string): HTMLSelectElement {
  const field = el(doc, "select", { class: "swl-media-select", attrs: { "aria-label": label } });
  for (const [v, text] of options) field.append(el(doc, "option", { text, attrs: { value: v } }));
  field.value = value;
  return field;
}

export function mediaTab(doc: Document, input: MediaTabInput, save: (settings: AssetSettings) => Promise<string | undefined>): DialogTabPart {
  const { settings } = input;
  const views = VIEWS.map((view) => [view, VIEW_LABELS[view]] as const);
  const actions = [...input.actions.map(({ name, label }) => [name, label ?? name] as const), [NONE, "Nothing"] as const];

  // All files
  const allView = select(doc, "All files: shown as", views, settings.views.default);
  const allClick = select(doc, "All files: a click", actions, settings.actions.default.click ?? NONE);
  const allShift = select(doc, "All files: a Shift+click", actions, settings.actions.default["shift+click"] ?? NONE);
  const anchor = select(doc, "Width dragged", [["start", "Stays at the start"], ["center", "Centred"]], settings.anchor);
  const cardIcon = el(doc, "input", { attrs: { type: "checkbox" } });
  cardIcon.checked = settings.card.includes("icon");
  const all = el(
    doc,
    "div",
    "swl-media-all",
    el(doc, "div", "swl-media-heading", "All files"),
    el(doc, "label", "swl-media-field", "Shown as", allView),
    el(doc, "label", "swl-media-field", "A click", allClick),
    el(doc, "label", "swl-media-field", "A Shift+click", allShift),
    el(doc, "label", "swl-media-field", "Width dragged", anchor),
    el(doc, "label", "swl-media-check", cardIcon, "Cards show the file's icon"),
  );

  // Per type: "Default" follows All files
  const rows = input.types.map((type) => {
    const own = (gesture: Gesture) => settings.actions.types[type.name]?.[gesture];
    const view = select(doc, `${type.name}: shown as`, [[DEFAULT, "Default"], ...views], settings.views.types[type.name] ?? DEFAULT);
    const click = select(doc, `${type.name}: a click`, [[DEFAULT, "Default"], ...actions], own("click") ?? DEFAULT);
    const shift = select(doc, `${type.name}: a Shift+click`, [[DEFAULT, "Default"], ...actions], own("shift+click") ?? DEFAULT);
    const row = el(doc, "div", "swl-media-type", el(doc, "span", "swl-media-type-name", iconElement(doc, type.icon), type.name), view, click, shift);
    return { name: type.name, view, click, shift, row };
  });
  const table = el(
    doc,
    "div",
    "swl-media-types",
    el(doc, "div", "swl-media-type swl-media-type-head", el(doc, "span", { text: "Type" }), el(doc, "span", { text: "Shown as" }), el(doc, "span", { text: "Click" }), el(doc, "span", { text: "Shift+click" })),
    ...rows.map((one) => one.row),
  );

  /** The settings as the tab has them now */
  const current = (): AssetSettings => {
    const viewTypes: Record<string, View> = {};
    const actionTypes: Record<string, Partial<Record<Gesture, string>>> = {};
    for (const one of rows) {
      if (one.view.value !== DEFAULT) viewTypes[one.name] = one.view.value as View;
      const gestures: Partial<Record<Gesture, string>> = {};
      if (one.click.value !== DEFAULT) gestures.click = one.click.value;
      if (one.shift.value !== DEFAULT) gestures["shift+click"] = one.shift.value;
      if (Object.keys(gestures).length) actionTypes[one.name] = gestures;
    }
    const defaults: Partial<Record<Gesture, string>> = {};
    defaults.click = allClick.value;
    defaults["shift+click"] = allShift.value;
    return {
      ...settings,
      views: { default: allView.value as View, types: viewTypes },
      actions: { default: defaults, types: actionTypes },
      card: cardIcon.checked ? ["icon", "name"] : ["name"],
      anchor: anchor.value === "center" ? "center" : "start",
    };
  };
  const was = JSON.stringify(current());

  return {
    id: "media",
    title: "Media",
    panel: el(doc, "div", "swl-media", all, table),
    changed: () => JSON.stringify(current()) !== was,
    save: () => save(current()),
  };
}
