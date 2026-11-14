// The tabs of the assets' settings in the settings window (docs/silverware-assets.md, *Settings and the Media tab*;
// docs/silverware-assets-label.md, *The settings dialog*), each one thing a user sets, a line on top saying
// what: Files (how a file is shown and what a click and a Shift+click do, for all files and per type, "Like all files"
// following them), Appearance (how a file looks as it is shown, picked by a switch: a preview's label, size and
// for all files and per type; an original PDF's height; a card; a link's icon (where a file stands is Silverware
// Layout's: docs/silverware-layout-align.md); the
// label, the card and the link edited on a sample, ui/labeleditor.ts and ui/cardeditor.ts). One set of settings behind
// them all, saved once on Save: the first tab answers for the others (the window asks each tab that changed to save,
// and the settings are written whole).
import { el } from "../../../shared/elements.ts";
import { type AssetSettings, type CardField, type Gesture, type PreviewLabel, type PreviewSize, sameLabel, type View, VIEWS } from "../model/settings.ts";
import { dateText, iconElement } from "./card.ts";
import { segmentedControl } from "../../../shared/controls.ts";
import { CHEVRON_RIGHT } from "../../../shared/glyphs.ts";
import { cardEditor, linkEditor } from "./cardeditor.ts";
import { labelEditor } from "./labeleditor.ts";

const VIEW_LABELS: Readonly<Record<View, string>> = { icon: "Card", preview: "Preview", embed: "Original" };
const NONE = "";
// The heights a preview may be given (px)
const MIN_HEIGHT = 40;
const MAX_HEIGHT = 2000;
const DEFAULT = "*";
// What a type's pick list says where it follows all files
const LIKE_ALL = "Like all files";

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

/** A tab's panel: its line saying what it sets, then its sections */
function panelOf(doc: Document, id: string, intro: string, ...sections: HTMLElement[]): HTMLElement {
  return el(doc, "div", { class: "swa-settings", attrs: { "data-swa-tab": id } }, el(doc, "p", "swa-settings-intro", intro), ...sections);
}

/** A section: its heading, its rows */
function section(doc: Document, heading: string, ...rows: (HTMLElement | string)[]): HTMLElement {
  return el(doc, "section", "swa-settings-section", el(doc, "div", "swa-settings-heading", heading), ...rows);
}

/** A type's name with its icon, a row's first cell */
const typeName = (doc: Document, type: { readonly name: string; readonly icon: string }) => el(doc, "span", "swa-settings-type-name", iconElement(doc, type.icon), type.name);

export function mediaTabs(doc: Document, input: MediaTabInput, save: (settings: AssetSettings) => Promise<string | undefined>): SettingsTab[] {
  const { settings } = input;
  const views = VIEWS.map((view) => [view, VIEW_LABELS[view]] as const);
  const actions = [...input.actions.map(({ name, label }) => [name, label ?? name] as const), [NONE, "Nothing"] as const];

  // Files: how a file is shown, what a click and a Shift+click do; all files', then each type's
  const allView = select(doc, "All files: shown as", views, settings.views.default);
  const allClick = select(doc, "All files: a click", actions, settings.actions.default.click ?? NONE);
  const allShift = select(doc, "All files: a Shift+click", actions, settings.actions.default["shift+click"] ?? NONE);
  const fileRows = input.types.map((type) => {
    const own = (gesture: Gesture) => settings.actions.types[type.name]?.[gesture];
    const view = select(doc, `${type.name}: shown as`, [[DEFAULT, LIKE_ALL], ...views], settings.views.types[type.name] ?? DEFAULT);
    const click = select(doc, `${type.name}: a click`, [[DEFAULT, LIKE_ALL], ...actions], own("click") ?? DEFAULT);
    const shift = select(doc, `${type.name}: a Shift+click`, [[DEFAULT, LIKE_ALL], ...actions], own("shift+click") ?? DEFAULT);
    return { name: type.name, view, click, shift, row: el(doc, "div", "swa-settings-row", typeName(doc, type), view, click, shift) };
  });
  const filesGrid = el(
    doc,
    "div",
    "swa-settings-grid swa-settings-grid-files",
    el(doc, "div", "swa-settings-row swa-settings-head", el(doc, "span"), el(doc, "span", { text: "Shown as" }), el(doc, "span", { text: "A click" }), el(doc, "span", { text: "A Shift+click" })),
    el(doc, "div", "swa-settings-row swa-settings-all-row", el(doc, "span", "swa-settings-type-name", "All files"), allView, allClick, allShift),
    el(doc, "div", "swa-settings-divider"),
    ...fileRows.map((one) => one.row),
  );

  // Preview: a row for all files and one for each type (docs/silverware-assets-label.md, *Per type*, as Silverware
  // Database's properties: one open at a time), a type's marked Own where it has a label or a size of its own; open, a
  // row holds its label and its size (a type's made its own as they are changed), and a type's way back to all files' own
  const previewHeight = el(doc, "input", { class: "swa-settings-number swa-settings-side", attrs: { type: "number", min: MIN_HEIGHT, max: MAX_HEIGHT, step: 10, "aria-label": "A preview's height (px)" } });
  previewHeight.value = String(settings.heights.preview);
  const previewWidth = sideField(doc, "A preview's width (px)", settings.previews.width, "auto");
  const sizes = new Map(
    input.types.map((type) => {
      const size = settings.previews.types[type.name] ?? {};
      return [
        type.name,
        {
          width: sideField(doc, `${type.name}: a preview's width (px)`, size.width, settings.previews.width === undefined ? "auto" : String(settings.previews.width)),
          height: sideField(doc, `${type.name}: a preview's height (px)`, size.height, String(settings.heights.preview)),
        },
      ] as const;
    }),
  );
  // (A type's fields follow all files' as they change: their placeholders)
  const followSizes = () => {
    for (const one of sizes.values()) {
      one.width.placeholder = previewWidth.value.trim() || "auto";
      one.height.placeholder = previewHeight.value.trim() || String(settings.heights.preview);
    }
  };
  previewWidth.addEventListener("input", followSizes);
  previewHeight.addEventListener("input", followSizes);
  const labels: { default: PreviewLabel; types: Record<string, PreviewLabel> } = { default: settings.labels.default, types: { ...settings.labels.types } };
  // The row open, its label shown in the one editor
  let opened = DEFAULT;
  const editor = labelEditor(
    doc,
    (label) => {
      if (opened === DEFAULT) labels.default = label;
      // (A type's own only where it differs from all files': a property dropped back where it was keeps it theirs)
      else if (sameLabel(label, labels.default)) delete labels.types[opened];
      else labels.types[opened] = label;
    },
    dateText(Date.now()) ?? "",
  );
  // (All files' sample: an image's, the most common preview)
  const sampleType = (name: string) => input.types.find((type) => type.name === name) ?? input.types.find((type) => type.name === "image") ?? input.types[0];
  /** A type's own preview size as it will be kept (a side typed out of bounds: the one it had); none of either: none */
  const keptOf = (type: string): PreviewSize | undefined => {
    const size = sizes.get(type);
    const had = settings.previews.types[type] ?? {};
    const width = size && sideOf(size.width.value, had.width);
    const height = size && sideOf(size.height.value, had.height);
    if (width === undefined && height === undefined) return undefined;
    return { ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }) };
  };
  /** Whether a type differs from all files: a label of its own, or a size of its own as it will be kept */
  const isOwn = (type: string) => type in labels.types || keptOf(type) !== undefined;
  const rows = [{ name: DEFAULT, title: "All files", icon: undefined as string | undefined }, ...input.types.map((type) => ({ name: type.name, title: type.name, icon: type.icon as string | undefined }))];
  const list = el(doc, "div", { class: "swa-types", attrs: { role: "list", "aria-label": "A preview, for all files and per type" } });
  /** A row's element, by its type's name (as given: no selector made of it) */
  const rowElement = (name: string) => [...list.children].find((one) => one.getAttribute("data-swa-type") === name);
  const ownMark = () => el(doc, "span", { class: "swa-type-mark", text: "Own", title: "Set apart from all files" });
  /** A row's head: its icon, its name, Own where it differs from all files (what, said as it is opened), a chevron */
  const headOf = (row: (typeof rows)[number]) => {
    const head = el(
      doc,
      "button",
      { class: "swa-type-head", attrs: { type: "button", "aria-expanded": String(opened === row.name) } },
      row.icon ? iconElement(doc, row.icon) : el(doc, "span", { class: "swa-icon swa-type-all", attrs: { "aria-hidden": "true" } }),
      el(doc, "span", { class: "swa-type-name", text: row.title }),
      ...(row.name !== DEFAULT && isOwn(row.name) ? [ownMark()] : []),
      el(doc, "span", { class: "swa-type-chevron", html: CHEVRON_RIGHT }),
    );
    head.addEventListener("click", () => {
      opened = opened === row.name ? "" : row.name;
      drawList(row.name);
    });
    return head;
  };
  /**
   * An open row's details: its label and its size; a type's made its own as they are changed (its label as it is
   * edited, its size as one is typed), taken back to all files' by one button, shown where it differs
   */
  const detailsOf = (row: (typeof rows)[number]) => {
    const all = row.name === DEFAULT;
    editor.show(all ? labels.default : (labels.types[row.name] ?? labels.default), sampleType(row.name));
    const size = all ? { width: previewWidth, height: previewHeight } : sizes.get(row.name)!;
    const reset = all
      ? []
      : [
          el(
            doc,
            "div",
            { class: "swa-type-reset", attrs: { ...(isOwn(row.name) ? {} : { hidden: "" }) } },
            el(doc, "button", {
              class: "swa-settings-button",
              text: "↺ Reset to all files",
              title: "Its label and its size as all files' again",
              run: () => {
                delete labels.types[row.name];
                size.width.value = "";
                size.height.value = "";
                drawList(row.name);
                list.dispatchEvent(new Event("change", { bubbles: true }));
              },
            }),
          ),
        ];
    return el(
      doc,
      "div",
      "swa-type-details",
      ...reset,
      section(doc, "Label", editor.element),
      section(
        doc,
        "Size",
        el(doc, "p", "swa-settings-note", all ? "Width × height in px; an image fits in it, its proportions kept. Width empty: as wide as there is room." : "Width × height in px. Empty: like all files."),
        el(doc, "div", "swa-type-size", el(doc, "span", "swa-settings-unit", size.width, "×", size.height, "px")),
      ),
    );
  };
  /** The list drawn as it is now; `focus`: that row's head focused (it was pressed, or its button was: the focus not lost to the page) */
  const drawList = (focus?: string) => {
    list.replaceChildren(
      ...rows.map((row) => {
        const open = opened === row.name;
        return el(doc, "div", { class: `swa-type${open ? " swa-type-open" : ""}`, attrs: { role: "listitem", "data-swa-type": row.name } }, headOf(row), ...(open ? [detailsOf(row)] : []));
      }),
    );
    if (focus !== undefined) rowElement(focus)?.querySelector<HTMLElement>(".swa-type-head")?.focus();
  };
  // (A size typed or a label changed: the open row's mark and way back as they are now, nothing else redrawn: only it
  // can change, and its fields keep their focus)
  const markOpen = () => {
    if (opened === DEFAULT) return;
    const row = rowElement(opened);
    const own = isOwn(opened);
    const head = row?.querySelector(":scope > .swa-type-head");
    const mark = head?.querySelector(".swa-type-mark");
    if (own && head && !mark) head.querySelector(".swa-type-chevron")?.before(ownMark());
    if (!own) mark?.remove();
    const reset = row?.querySelector<HTMLElement>(":scope > .swa-type-details > .swa-type-reset");
    if (reset) reset.hidden = !own;
  };
  list.addEventListener("input", markOpen);
  // (The label editor's change, within the open row, bubbles to the list)
  list.addEventListener("change", markOpen);
  drawList();

  // Original: a PDF's height, for all files
  const embedHeight = el(doc, "input", { class: "swa-settings-number", attrs: { type: "number", min: MIN_HEIGHT, max: MAX_HEIGHT, step: 10, "aria-label": "An original PDF's height (px)" } });
  embedHeight.value = String(settings.heights.embed);

  // A card (what it shows besides the file's name) and a link's icon, each edited on a sample of a PDF's
  const pdfIcon = (input.types.find((type) => type.name === "pdf") ?? input.types[0])?.icon ?? "";
  let card: CardField[] = [...settings.card];
  let linkIcons = settings.linkIcons;
  const cardSection = cardEditor(doc, settings.card, pdfIcon, (fields) => void (card = fields));
  const linkSection = linkEditor(doc, settings.linkIcons, pdfIcon, (shown) => void (linkIcons = shown));

  // Appearance: what is edited, a preview (its label, its size), a card or a link, picked; one shown at a time
  const looks = {
    preview: el(
      doc,
      "div",
      { class: "swa-settings-look", attrs: { "data-swa-look": "preview" } },
      el(doc, "p", "swa-settings-note", "A file shown small (“Preview” on the Files tab), the label of your choice with it: for all files, and a type's own where it differs (marked Own)."),
      list,
    ),
    card: el(doc, "div", { class: "swa-settings-look", attrs: { "data-swa-look": "card" } }, el(doc, "p", "swa-settings-note", "A file shown as its icon and name (“Card” on the Files tab), for all files."), cardSection),
    original: el(
      doc,
      "div",
      { class: "swa-settings-look", attrs: { "data-swa-look": "original" } },
      el(doc, "p", "swa-settings-note", "A file shown as SilverBullet draws it (“Original” on the Files tab), for all files."),
      section(doc, "A PDF's height", el(doc, "p", "swa-settings-note", "An original PDF's viewer, where its embed gives no size."), el(doc, "span", "swa-settings-unit", embedHeight, "px")),
    ),
    link: el(doc, "div", { class: "swa-settings-look", attrs: { "data-swa-look": "link" } }, el(doc, "p", "swa-settings-note", "A link to a file in your text, [[report.pdf]], for all files."), linkSection),
  };
  type Look = keyof typeof looks;
  const showLook = (look: Look) => {
    for (const [name, one] of Object.entries(looks)) one.hidden = name !== look;
  };
  const lookSwitch = segmentedControl<Look>(
    doc,
    "swa",
    "What is shown",
    [
      { value: "preview", label: "Preview" },
      { value: "original", label: "Original" },
      { value: "card", label: "Card" },
      { value: "link", label: "Link" },
    ],
    "preview",
    showLook,
  );
  showLook("preview");

  /** The settings as the tabs have them now */
  const current = (): AssetSettings => {
    const viewTypes: Record<string, View> = {};
    const actionTypes: Record<string, Partial<Record<Gesture, string>>> = {};
    for (const one of fileRows) {
      if (one.view.value !== DEFAULT) viewTypes[one.name] = one.view.value as View;
      const gestures: Partial<Record<Gesture, string>> = {};
      if (one.click.value !== DEFAULT) gestures.click = one.click.value;
      if (one.shift.value !== DEFAULT) gestures["shift+click"] = one.shift.value;
      if (Object.keys(gestures).length) actionTypes[one.name] = gestures;
    }
    const previewTypes: Record<string, PreviewSize> = {};
    for (const name of sizes.keys()) {
      const kept = keptOf(name);
      if (kept) previewTypes[name] = kept;
    }
    const allWidth = sideOf(previewWidth.value, settings.previews.width);
    return {
      ...settings,
      views: { default: allView.value as View, types: viewTypes },
      actions: { default: { click: allClick.value, "shift+click": allShift.value }, types: actionTypes },
      card: [...card],
      heights: { preview: heightOf(previewHeight.value, settings.heights.preview), embed: heightOf(embedHeight.value, settings.heights.embed) },
      previews: {
        ...(allWidth === undefined ? {} : { width: allWidth }),
        types: previewTypes,
      },
      linkIcons,
      labels: { default: labels.default, types: { ...labels.types } },
    };
  };
  const was = JSON.stringify(current());
  const changed = () => JSON.stringify(current()) !== was;
  // (The others' changes are the first tab's to tell and save: one write)
  const tab = (id: string, title: string, panel: HTMLElement, first = false): SettingsTab => ({ id, title, panel, changed: first ? changed : () => false, save: first ? () => save(current()) : async () => undefined });

  return [
    tab(
      "assets",
      "Files",
      panelOf(doc, "files", "How an embedded file is shown where its embed does not say, and what a click on it does. A type set to “Like all files” follows the first row.", filesGrid),
      true,
    ),
    tab("appearance", "Appearance", panelOf(doc, "appearance", "How a file looks where it is shown: as a preview, as the original, as a card, or as a link to it.", el(doc, "div", "swa-settings-looks", lookSwitch.element), ...Object.values(looks))),
  ];
}
