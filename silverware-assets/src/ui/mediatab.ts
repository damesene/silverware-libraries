// The tabs of the assets' settings in the settings window (docs/silverware-assets.md, *Settings and the Media tab*;
// docs/silverware-assets-label.md, *The settings dialog*; docs/silverware-assets-files-tab.md), each one thing a user
// sets, a line on top saying what: Files (all files' way of showing, inserting and opening a file, then a row per type,
// one open, its own marked; the saved previews), Appearance (how a file looks as it is shown, picked by a switch: a
// preview's label and size, a full file's label and a document's height, for all files and per type; a card; a link's
// icon; the label, the card and the link edited on a sample, ui/labeleditor.ts and ui/cardeditor.ts). One set of
// settings behind them all, saved once on Save: the first tab answers for the others (the window asks each tab that
// changed to save, and the settings are written whole).
import { el } from "../../../shared/elements.ts";
import { type AssetSettings, type CardField, DEFAULT_ASSET_SETTINGS, type Gesture, INSERT_AS, type InsertAs, type LinkField, type PreviewLabel, type PreviewSize, sameLabel, type View, VIEWS } from "../model/settings.ts";
import { dateText, iconElement } from "./card.ts";
import { segmentedControl } from "../../../shared/controls.ts";
import { CHEVRON_RIGHT } from "../../../shared/glyphs.ts";
import { cardEditor, linkEditor } from "./cardeditor.ts";
import { labelEditor } from "./labeleditor.ts";

const VIEW_LABELS: Readonly<Record<View, string>> = { card: "Card", preview: "Preview", full: "Full" };
// How a file is inserted, as its pick lists say it (docs/silverware-assets-insert.md)
const INSERT_LABELS: Readonly<Record<InsertAs, string>> = { shown: "Same as shown", link: "Link", ...VIEW_LABELS };
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

/** A registered type as the tabs show it: its name (as kept), its label (as read), its icon, whether it is a document (its height set) */
export type RowType = { readonly name: string; readonly label: string; readonly icon: string; readonly document?: boolean; readonly storesPreview?: boolean };

export type MediaTabInput = {
  readonly settings: AssetSettings;
  // The registered types and actions (their names and labels), in the order registered
  readonly types: readonly RowType[];
  readonly actions: readonly { readonly name: string; readonly label?: string }[];
  // Clean up previews (the command's): the previews kept of files gone or changed taken away, said how many; none: no button
  readonly cleanUp?: () => Promise<void>;
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

export function mediaTabs(doc: Document, input: MediaTabInput, save: (settings: AssetSettings) => Promise<string | undefined>): SettingsTab[] {
  const { settings } = input;
  const actions = [...input.actions.map(({ name, label }) => [name, label ?? name] as const), [NONE, "Nothing"] as const];
  const inserts = INSERT_AS.map((as) => [as, INSERT_LABELS[as]] as const);
  const textOf = (options: readonly (readonly [string, string])[], value: string) => options.find(([v]) => v === value)?.[1] ?? value;

  // Files (docs/silverware-assets-files-tab.md): all files' four settings first, one under another; then a row per type,
  // closed saying what it sets of its own, one open at a time with its four and its way back to all files'
  const views = VIEWS.map((view) => [view, VIEW_LABELS[view]] as const);
  const allView = select(doc, "All files: shown as", views, settings.views.default);
  const allInsert = select(doc, "All files: inserted as", inserts, settings.insert.as.default);
  const allClick = select(doc, "All files: click", actions, settings.actions.default.click ?? NONE);
  const allShift = select(doc, "All files: Shift+click", actions, settings.actions.default["shift+click"] ?? NONE);
  // Files pasted, dropped and uploaded through the dialog (docs/silverware-assets-insert.md), off: SilverBullet's own;
  // under Inserted as, in its control's column (its name at its pick list's height)
  const insertOn = el(doc, "input", { attrs: { type: "checkbox" } });
  insertOn.checked = settings.insert.enabled;
  const allBlock = el(
    doc,
    "div",
    "swa-files-settings",
    settingLine(doc, "Shown as", allView),
    settingLine(doc, "Inserted as", allInsert),
    el(
      doc,
      "div",
      "swa-files-under",
      el(doc, "label", "swa-settings-check", insertOn, "Use the insert dialog for pasted, dropped and uploaded files"),
      el(doc, "p", "swa-settings-note", "A dialog to name each file and see how it is inserted. Off: SilverBullet's own prompt."),
    ),
    settingLine(doc, "Click", allClick),
    settingLine(doc, "Shift+click", allShift),
  );

  /** A type's four settings: its own or all files' (`DEFAULT`) */
  const fileTypes = input.types.map((type) => {
    const own = (gesture: Gesture) => settings.actions.types[type.name]?.[gesture];
    const view = select(doc, `${type.label}: shown as`, [[DEFAULT, LIKE_ALL], ...views], settings.views.types[type.name] ?? DEFAULT);
    const insert = select(doc, `${type.label}: inserted as`, [[DEFAULT, LIKE_ALL], ...inserts], settings.insert.as.types[type.name] ?? DEFAULT);
    const click = select(doc, `${type.label}: click`, [[DEFAULT, LIKE_ALL], ...actions], own("click") ?? DEFAULT);
    const shift = select(doc, `${type.label}: Shift+click`, [[DEFAULT, LIKE_ALL], ...actions], own("shift+click") ?? DEFAULT);
    for (const one of [view, insert, click, shift]) one.addEventListener("change", () => changedType(type.name));
    const details = el(doc, "div", "swa-files-settings", settingLine(doc, "Shown as", view), settingLine(doc, "Inserted as", insert), settingLine(doc, "Click", click), settingLine(doc, "Shift+click", shift));
    return {
      ...type,
      details,
      view,
      insert,
      click,
      shift,
      reset: () => {
        for (const one of [view, insert, click, shift]) one.value = DEFAULT;
      },
    };
  });
  type FileType = (typeof fileTypes)[number];
  /** What a type sets of its own, said: "Shown as Preview, Click Open enlarged"; none: all files' */
  const ownOf = (one: FileType) =>
    [
      one.view.value !== DEFAULT ? `Shown as ${textOf(views, one.view.value)}` : "",
      one.insert.value !== DEFAULT ? `Inserted as ${textOf(inserts, one.insert.value)}` : "",
      one.click.value !== DEFAULT ? `Click ${textOf(actions, one.click.value)}` : "",
      one.shift.value !== DEFAULT ? `Shift+click ${textOf(actions, one.shift.value)}` : "",
    ]
      .filter(Boolean)
      .join(", ");
  /** "Like all files" in a type's lists says what that gives now (all files' choice changed: said again) */
  const followAll = () => {
    for (const one of fileTypes) {
      const like = (field: HTMLSelectElement, text: string) => void (field.options[0]!.textContent = `${LIKE_ALL} · ${text}`);
      like(one.view, textOf(views, allView.value));
      like(one.insert, textOf(inserts, allInsert.value));
      like(one.click, textOf(actions, allClick.value));
      like(one.shift, textOf(actions, allShift.value));
    }
  };
  for (const one of [allView, allInsert, allClick, allShift]) one.addEventListener("change", followAll);
  followAll();
  const fileList = typeRows(doc, fileTypes, "Each type's own: shown as, inserted as, click", {
    summary: (type) => ownOf(fileTypes.find((one) => one.name === type)!),
    details: (type) => [fileTypes.find((one) => one.name === type)!.details],
    reset: (type) => fileTypes.find((one) => one.name === type)!.reset(),
  });
  const changedType = (type: string) => fileList.refresh(type);

  // Saved previews (docs/silverware-assets-stored-previews.md): saved or not, the folder (live while saving is on), and
  // what was kept of files gone taken away (also with saving off: what was kept before)
  const storePreviews = el(doc, "input", { attrs: { type: "checkbox" } });
  storePreviews.checked = settings.storePreviews;
  // The folder they are kept in, moved there with what it holds as it is saved (src/index.ts)
  const previewFolder = el(doc, "input", { class: "swa-settings-folder", attrs: { type: "text", spellcheck: "false", "aria-label": "Folder of the saved previews", placeholder: DEFAULT_ASSET_SETTINGS.previewFolder } });
  previewFolder.value = settings.previewFolder;
  const folderLive = () => void (previewFolder.disabled = !storePreviews.checked);
  storePreviews.addEventListener("change", folderLive);
  folderLive();
  const cleanUp = input.cleanUp;
  const keeping = input.types.filter((type) => type.storesPreview).map((type) => type.label);
  let cleanButton: HTMLButtonElement;
  const storeSection = section(
    doc,
    "Saved previews",
    el(doc, "label", "swa-settings-check", storePreviews, "Save slow previews in the space"),
    el(
      doc,
      "p",
      "swa-settings-note",
      // (Said of the types that keep one: those of Silverware Assets PDF, DOCX and XLSX, where they are installed)
      keeping.length
        ? `Previews slow to make (${keeping.join(", ")}) are made once, then loaded fast on every device. Off: made each time they are shown.`
        : "No type installed makes previews slow enough to save them (Silverware Assets PDF, DOCX and XLSX do).",
    ),
    el(
      doc,
      "div",
      "swa-settings-indent",
      el(doc, "div", "swa-settings-fields", el(doc, "label", "swa-settings-field", el(doc, "span", { text: "Folder" }), previewFolder)),
      el(doc, "p", "swa-settings-note", "From the space root; a name starting with _ stays hidden in SilverBullet. Changing it moves the saved previews there."),
      ...(cleanUp
        ? [
            el(
              doc,
              "div",
              "swa-settings-action",
              (cleanButton = el(doc, "button", {
                class: "swa-settings-button",
                text: "Clean up previews",
                attrs: { type: "button" },
                run: () => {
                  cleanButton.disabled = true;
                  void cleanUp().finally(() => (cleanButton.disabled = false));
                },
              })),
              el(doc, "span", "swa-settings-note", "Takes away saved previews whose file was deleted or has changed."),
            ),
          ]
        : []),
    ),
  );

  // Preview: a row for all files and one for each type (docs/silverware-assets-label.md, *Per type*, as Silverware
  // Database's properties: one open at a time), a type's marked Own where it has a label or a size of its own; open, a
  // row holds its label and its size (a type's made its own as they are changed), and a type's way back to all files' own
  const previewHeight = el(doc, "input", { class: "swa-settings-number swa-settings-side", attrs: { type: "number", min: MIN_HEIGHT, max: MAX_HEIGHT, step: 10, "aria-label": "A preview's height (px)" } });
  previewHeight.value = String(settings.preview.height);
  const previewWidth = sideField(doc, "A preview's width (px)", settings.preview.width, "auto");
  const sizes = new Map(
    input.types.map((type) => {
      const size = settings.preview.types[type.name] ?? {};
      return [
        type.name,
        {
          width: sideField(doc, `${type.label}: a preview's width (px)`, size.width, settings.preview.width === undefined ? "auto" : String(settings.preview.width)),
          height: sideField(doc, `${type.label}: a preview's height (px)`, size.height, String(settings.preview.height)),
        },
      ] as const;
    }),
  );
  // (A type's fields follow all files' as they change: their placeholders)
  const followSizes = () => {
    for (const one of sizes.values()) {
      one.width.placeholder = previewWidth.value.trim() || "auto";
      one.height.placeholder = previewHeight.value.trim() || String(settings.preview.height);
    }
  };
  previewWidth.addEventListener("input", followSizes);
  previewHeight.addEventListener("input", followSizes);
  const labels: { default: PreviewLabel; types: Record<string, PreviewLabel> } = { default: settings.preview.labels.default, types: { ...settings.preview.labels.types } };
  /** A type's own preview size as it will be kept (a side typed out of bounds: the one it had); none of either: none */
  const keptOf = (type: string): PreviewSize | undefined => {
    const size = sizes.get(type);
    const had = settings.preview.types[type] ?? {};
    const width = size && sideOf(size.width.value, had.width);
    const height = size && sideOf(size.height.value, had.height);
    if (width === undefined && height === undefined) return undefined;
    return { ...(width === undefined ? {} : { width }), ...(height === undefined ? {} : { height }) };
  };
  const list = labelRows(doc, input.types, labels, "A preview, for all files and per type", {
    owns: (type) => keptOf(type) !== undefined,
    reset: (type) => {
      const size = sizes.get(type)!;
      size.width.value = "";
      size.height.value = "";
    },
    details: (type) => {
      const all = type === DEFAULT;
      const size = all ? { width: previewWidth, height: previewHeight } : sizes.get(type)!;
      return [
        section(
          doc,
          "Size",
          el(doc, "p", "swa-settings-note", all ? "Width × height in px; the file fits inside, keeping its proportions. Empty width: as wide as the line." : "Width × height in px. Empty: like all files."),
          el(doc, "div", "swa-type-size", el(doc, "span", "swa-settings-unit", size.width, "×", size.height, "px")),
        ),
      ];
    },
  });

  // Full: a file's label for all files and per type, none shown unless one is turned on; a document's height (a PDF,
  // a Word or Excel document: no height of its own) for all files and a document type's own
  const fullLabels: { default: PreviewLabel; types: Record<string, PreviewLabel> } = { default: settings.full.labels.default, types: { ...settings.full.labels.types } };
  const fullHeight = el(doc, "input", { class: "swa-settings-number swa-settings-side", attrs: { type: "number", min: MIN_HEIGHT, max: MAX_HEIGHT, step: 10, "aria-label": "Document height (px)" } });
  fullHeight.value = String(settings.full.height);
  const fullHeights = new Map(input.types.filter((type) => type.document).map((type) => [type.name, sideField(doc, `${type.label}: document height (px)`, settings.full.types[type.name]?.height, String(settings.full.height))] as const));
  fullHeight.addEventListener("input", () => {
    for (const one of fullHeights.values()) one.placeholder = fullHeight.value.trim() || String(settings.full.height);
  });
  /** A document type's own height as it will be kept (typed out of bounds: the one it had); none: all files' */
  const fullKeptOf = (type: string): number | undefined => {
    const field = fullHeights.get(type);
    return field && sideOf(field.value, settings.full.types[type]?.height);
  };
  const fullList = labelRows(doc, input.types, fullLabels, "A file shown full, for all files and per type", {
    owns: (type) => fullKeptOf(type) !== undefined,
    reset: (type) => {
      const field = fullHeights.get(type);
      if (field) field.value = "";
    },
    details: (type) => {
      const field = type === DEFAULT ? fullHeight : fullHeights.get(type);
      if (!field) return [];
      return [
        section(
          doc,
          "Document height",
          el(doc, "p", "swa-settings-note", type === DEFAULT ? "A PDF, a Word or Excel document shown full scrolls in a box this tall, unless its embed gives its own size (|600x800)." : "Empty: like all files."),
          el(doc, "span", "swa-settings-unit", field, "px"),
        ),
      ];
    },
  });

  // A card (what it shows besides the file's name) and a link's icon, each edited on a sample of a PDF's
  const pdfIcon = (input.types.find((type) => type.name === "pdf") ?? input.types[0])?.icon ?? "";
  let card: CardField[] = [...settings.card.fields];
  let link: LinkField[] = [...settings.link.fields];
  const cardSection = cardEditor(doc, settings.card.fields, pdfIcon, (fields) => void (card = fields));
  const linkSection = linkEditor(doc, settings.link.fields.includes("icon"), pdfIcon, (shown) => void (link = shown ? ["icon"] : []));

  // Appearance: what is edited, a preview (its label, its size), a card or a link, picked; one shown at a time
  const looks = {
    preview: el(
      doc,
      "div",
      { class: "swa-settings-look", attrs: { "data-swa-look": "preview" } },
      el(doc, "p", "swa-settings-note", "A small picture of the file with an optional label; for all files, or per type (marked Own)."),
      list,
    ),
    card: el(doc, "div", { class: "swa-settings-look", attrs: { "data-swa-look": "card" } }, el(doc, "p", "swa-settings-note", "The file's icon and name."), cardSection),
    full: el(
      doc,
      "div",
      { class: "swa-settings-look", attrs: { "data-swa-look": "full" } },
      el(doc, "p", "swa-settings-note", "The file as SilverBullet shows it, with an optional label, and a document's height; for all files, or per type."),
      fullList,
    ),
    link: el(doc, "div", { class: "swa-settings-look", attrs: { "data-swa-look": "link" } }, el(doc, "p", "swa-settings-note", "A link to a file in your text, like [[report.pdf]]."), linkSection),
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
      { value: "link", label: "Link" },
      { value: "card", label: "Card" },
      { value: "preview", label: "Preview" },
      { value: "full", label: "Full" },
    ],
    "preview",
    showLook,
  );
  showLook("preview");

  /** The settings as the tabs have them now */
  const current = (): AssetSettings => {
    const viewTypes: Record<string, View> = {};
    const insertTypes: Record<string, InsertAs> = {};
    const actionTypes: Record<string, Partial<Record<Gesture, string>>> = {};
    for (const one of fileTypes) {
      if (one.view.value !== DEFAULT) viewTypes[one.name] = one.view.value as View;
      if (one.insert.value !== DEFAULT) insertTypes[one.name] = one.insert.value as InsertAs;
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
    const fullTypes: Record<string, { height: number }> = {};
    for (const name of fullHeights.keys()) {
      const height = fullKeptOf(name);
      if (height !== undefined) fullTypes[name] = { height };
    }
    const allWidth = sideOf(previewWidth.value, settings.preview.width);
    return {
      ...settings,
      views: { default: allView.value as View, types: viewTypes },
      actions: { default: { click: allClick.value, "shift+click": allShift.value }, types: actionTypes },
      preview: {
        ...(allWidth === undefined ? {} : { width: allWidth }),
        height: heightOf(previewHeight.value, settings.preview.height),
        types: previewTypes,
        labels: { default: labels.default, types: { ...labels.types } },
      },
      full: { height: heightOf(fullHeight.value, settings.full.height), types: fullTypes, labels: { default: fullLabels.default, types: { ...fullLabels.types } } },
      card: { fields: [...card] },
      link: { fields: [...link] },
      storePreviews: storePreviews.checked,
      // (Empty: the default; its slashes at either end taken off)
      previewFolder: previewFolder.value.trim().replace(/^\/+|\/+$/g, "") || DEFAULT_ASSET_SETTINGS.previewFolder,
      insert: { enabled: insertOn.checked, as: { default: allInsert.value as InsertAs, types: insertTypes } },
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
      panelOf(
        doc,
        "files",
        "How files are shown, inserted and opened: for all files, and a type's own where it differs. How one file is shown, chosen in its … menu, wins over both.",
        section(doc, "All files", allBlock),
        section(doc, "Per type", fileList.element),
        storeSection,
      ),
      true,
    ),
    tab("appearance", "Appearance", panelOf(doc, "appearance", "How each way of showing a file looks.", el(doc, "div", "swa-settings-looks", lookSwitch.element), ...Object.values(looks))),
  ];
}

/** A setting's line: its name, then its control */
function settingLine(doc: Document, name: string, control: HTMLElement): HTMLElement {
  return el(doc, "div", "swa-files-line", el(doc, "span", "swa-files-name", name), control);
}

/** The Files tab's rows of types: closed, what a type sets of its own (else "Like all files"); open, its settings */
type TypeRowsHow = {
  // What a type sets of its own, said; "": none
  summary(type: string): string;
  details(type: string): HTMLElement[];
  // Its settings taken back to all files'
  reset(type: string): void;
};

/**
 * A row for each type (as the Appearance tab's: one open at a time), closed saying what it sets of its own, marked Own
 * where it does; open, its settings and its way back to all files'. `refresh`: a type's row told again (its settings
 * changed), nothing else drawn again (its fields keep their focus)
 */
function typeRows(doc: Document, types: readonly RowType[], name: string, how: TypeRowsHow): { readonly element: HTMLElement; refresh(type: string): void } {
  let opened = "";
  const list = el(doc, "div", { class: "swa-types swa-file-types", attrs: { role: "list", "aria-label": name } });
  const rowElement = (type: string) => [...list.children].find((one) => one.getAttribute("data-swa-row-type") === type);
  const summaryOf = (type: string) => {
    const own = how.summary(type);
    return el(doc, "span", { class: `swa-type-summary${own ? "" : " swa-type-summary-none"}`, text: own || LIKE_ALL });
  };
  const headOf = (type: RowType) => {
    const own = !!how.summary(type.name);
    const head = el(
      doc,
      "button",
      { class: "swa-type-head", attrs: { type: "button", "aria-expanded": String(opened === type.name) } },
      iconElement(doc, type.icon),
      el(doc, "span", { class: "swa-type-name", text: type.label }),
      ...(own ? [el(doc, "span", { class: "swa-type-mark", text: "Own", title: "Differs from All files" })] : []),
      ...(opened === type.name ? [] : [summaryOf(type.name)]),
      el(doc, "span", { class: "swa-type-chevron", html: CHEVRON_RIGHT }),
    );
    head.addEventListener("click", () => {
      opened = opened === type.name ? "" : type.name;
      draw(type.name);
    });
    return head;
  };
  const detailsOf = (type: RowType) => {
    const reset = el(
      doc,
      "div",
      { class: "swa-type-reset", attrs: { ...(how.summary(type.name) ? {} : { hidden: "" }) } },
      el(doc, "button", {
        class: "swa-settings-button",
        text: "↺ Reset to all files",
        attrs: { type: "button" },
        run: () => {
          how.reset(type.name);
          draw(type.name);
          list.dispatchEvent(new Event("change", { bubbles: true }));
        },
      }),
    );
    return el(doc, "div", "swa-type-details", reset, ...how.details(type.name));
  };
  const draw = (focus?: string) => {
    list.replaceChildren(
      ...types.map((type) => {
        const open = opened === type.name;
        return el(doc, "div", { class: `swa-type${open ? " swa-type-open" : ""}`, attrs: { role: "listitem", "data-swa-row-type": type.name } }, headOf(type), ...(open ? [detailsOf(type)] : []));
      }),
    );
    if (focus !== undefined) rowElement(focus)?.querySelector<HTMLElement>(".swa-type-head")?.focus();
  };
  draw();
  return {
    element: list,
    refresh: (type) => {
      const row = rowElement(type);
      const head = row?.querySelector(":scope > .swa-type-head");
      const one = types.find((t) => t.name === type);
      if (!row || !head || !one) return;
      head.replaceWith(headOf(one));
      const reset = row.querySelector<HTMLElement>(":scope > .swa-type-details > .swa-type-reset");
      if (reset) reset.hidden = !how.summary(type);
    },
  };
}

/** What a view's rows add to a type's label (a preview's: its size) */
type RowsExtra = {
  // Whether a type has something of its own besides its label
  owns(type: string): boolean;
  // That taken back to all files' (its label is, by the rows)
  reset(type: string): void;
  // The open row's own sections after its label (all files' row: `DEFAULT`)
  details(type: string): HTMLElement[];
};

/**
 * A view's label for all files and for each type (docs/silverware-assets-label.md, *Per type*, as Silverware Database's
 * properties: one row open at a time): a type's marked Own where it differs (a label of its own, or what `extra` says),
 * made its own as it is changed, taken back to all files' by one button; `labels` kept as edited
 */
function labelRows(
  doc: Document,
  types: readonly RowType[],
  labels: { default: PreviewLabel; types: Record<string, PreviewLabel> },
  name: string,
  extra?: RowsExtra,
): HTMLElement {
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
  // (All files' sample: an image's, the most common)
  const sampleType = (type: string) => types.find((one) => one.name === type) ?? types.find((one) => one.name === "image") ?? types[0];
  /** Whether a type differs from all files: a label of its own, or what the view keeps of its own */
  const isOwn = (type: string) => type in labels.types || !!extra?.owns(type);
  const rows = [{ name: DEFAULT, title: "All files", icon: undefined as string | undefined }, ...types.map((type) => ({ name: type.name, title: type.label, icon: type.icon as string | undefined }))];
  const list = el(doc, "div", { class: "swa-types", attrs: { role: "list", "aria-label": name } });
  /** A row's element, by its type's name (as given: no selector made of it) */
  const rowElement = (type: string) => [...list.children].find((one) => one.getAttribute("data-swa-row-type") === type);
  const ownMark = () => el(doc, "span", { class: "swa-type-mark", text: "Own", title: "Differs from All files" });
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
  /** An open row's details: its label and what the view adds; a type's taken back to all files' by one button, shown where it differs */
  const detailsOf = (row: (typeof rows)[number]) => {
    const all = row.name === DEFAULT;
    editor.show(all ? labels.default : (labels.types[row.name] ?? labels.default), sampleType(row.name));
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
              title: "Use All files' settings again",
              run: () => {
                delete labels.types[row.name];
                extra?.reset(row.name);
                drawList(row.name);
                list.dispatchEvent(new Event("change", { bubbles: true }));
              },
            }),
          ),
        ];
    return el(doc, "div", "swa-type-details", ...reset, section(doc, "Label", editor.element), ...(extra?.details(row.name) ?? []));
  };
  /** The list drawn as it is now; `focus`: that row's head focused (it was pressed, or its button was: the focus not lost to the page) */
  const drawList = (focus?: string) => {
    list.replaceChildren(
      ...rows.map((row) => {
        const open = opened === row.name;
        return el(doc, "div", { class: `swa-type${open ? " swa-type-open" : ""}`, attrs: { role: "listitem", "data-swa-row-type": row.name } }, headOf(row), ...(open ? [detailsOf(row)] : []));
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
  return list;
}
