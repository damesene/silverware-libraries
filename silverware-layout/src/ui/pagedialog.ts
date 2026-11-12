// The Page layout dialog (the command "Silverware Layout: Page layout"), three tabs, each row named by where it holds
// (this page, all pages, this device), the same in each: a slider, the value typed and ↺, and under them what it
// follows while it has no value of its own (the field empty, that value its placeholder); moved or typed in, it is its
// own, ↺ takes it back:
// - Page width: this page's (or all pages') and all pages' (or the theme's), in px or % of the pane, the sliders
//   marked with the guides and snapping to them.
// - Font: the editor's font size for all pages (or the theme's) and this device's zoom (or the size of all pages), as
//   Ctrl + scroll sets it, with whether Ctrl + scroll zooms at all (docs/silverware-layout-font-size.md).
//   While a slider is held, the dialog all but goes, its slider alone shown: the page under it seen as it changes
//   (on a phone the dialog takes the screen).
//   What is set shows on the page at once (the dialog held at the window's top, the page seen under it).
// - Guides: the widths a drag snaps to (a widget's bar, these sliders), each typed in its own row, in px or % of the
//   pane (the same switch as a width's), or by its slider, which held shows them on the page as it moves; Full width a
//   box. Preview, held, shows them on the page as typed, the dialog all but gone meanwhile; Default guides puts the
//   default ones back, once confirmed (saved, as all, on Save). Ascending as the tab is drawn, left in the order typed
//   until it is drawn again.
// Save writes what changed (the page's into its frontmatter, the default, the guides and the font into CONFIG), Cancel
// or Esc puts the page back. The shared dialog, tabs and controls (shared/), classes `swl-dialog-*`.
import { type SegmentedControl, segmentedControl } from "../../../shared/controls.ts";
import { type Dialog, Dialogs } from "../../../shared/dialog.ts";
import { el } from "../../../shared/elements.ts";
import { tabs } from "../../../shared/tabs.ts";
import { DEFAULT_GUIDES, FONT_SIZE_LIMITS, GUIDE_LIMITS, type Guide, guideName, guideOf, percentOf, validateFontSize, validateGuide } from "../model/settings.ts";
import { sameWidth, TEXT_WIDTH_LIMITS, validateTextWidth, type Width, type WidthUnit } from "../model/width.ts";
import { widthInPane } from "../core/widgetwidth.ts";
import { ICONS } from "./icons.ts";

const BASE = "swl-dialog";
// The segmented controls' base: shared/segments.css in the style page by the plugin's own
const SEGMENTS_BASE = "swl";
// How near a guide a slider's value snaps to it: px, and % of the pane
const SNAP: Readonly<Record<WidthUnit, number>> = { px: 12, "%": 1 };

const UNITS = [
  { value: "px", label: "px", title: "Pixels" },
  { value: "%", label: "%", title: "Percent of the editor's width" },
] as const;

/** What the dialog shows and saves, and how it shows a width on the page meanwhile */
export type PageDialogStore = {
  readonly page: string;
  // As saved now: the page's own width, the default, the guides
  readonly pageWidth: Width | undefined;
  readonly defaultWidth: Width | undefined;
  readonly guides: readonly Guide[];
  // Whether settings can be saved here (else only this page's width)
  readonly canSaveSettings: boolean;
  // Narrower than this (px), the pane gets no width of Silverware Layout's (a phone): said on the Page width tab
  readonly minPaneWidth: number;
  // The editor's pane now (px): a slider's room, and what % are of
  paneWidth(): number;
  // The text's width the theme gives (px), Silverware Layout's own set aside
  themeWidth(): number;
  // The editor's font size for every page (none: the theme's), whether Font zoom is on, this device's zoom (none: none)
  readonly fontSize: number | undefined;
  readonly fontZoom: boolean;
  readonly zoom: number | undefined;
  // The font size the theme gives (px)
  themeFontSize(): number;
  // The page shown as it would be with these, until `restore`
  preview(shown: Preview): void;
  restore(): void;
  // Each saved; why not, as text
  savePage(width: Width | undefined): Promise<string | undefined>;
  saveDefault(width: Width | undefined): Promise<string | undefined>;
  saveGuides(guides: readonly Guide[]): Promise<string | undefined>;
  saveFont(fontSize: number | undefined, fontZoom: boolean): Promise<string | undefined>;
  // This device's zoom kept (none: taken off)
  saveZoom(size: number | undefined): void;
  // The guides shown on the page as a drag shows them (the page's width with them), until the function given back
  previewGuides(guides: readonly Guide[]): () => void;
  confirm(question: string): Promise<boolean>;
  flash(message: string, type: "info" | "error"): void;
};

/** What the page is shown with while the dialog is open */
export type Preview = {
  readonly pageWidth: Width | undefined;
  readonly defaultWidth: Width | undefined;
  readonly fontSize: number | undefined;
  readonly fontZoom: boolean;
  readonly zoom: number | undefined;
};

/** The font size being set: its own (or the theme's), its number as typed */
type FontField = { own: boolean; amount: string };

/** The font size of a field: none where it follows the theme, else its number, or why it is none */
function fontSizeOf(field: FontField): { readonly size?: number; readonly problem?: string } {
  if (!field.own) return {};
  const text = field.amount.trim();
  if (!text) return {};
  const size = Number(text);
  const problem = validateFontSize(size);
  return problem ? { problem } : { size };
}

/** A width being set: its own (or what it follows), its number as typed and its unit */
type Field = { own: boolean; amount: string; unit: WidthUnit };

const fieldOf = (width: Width | undefined): Field => ({ own: !!width, amount: width ? String(width.amount) : "", unit: width?.unit ?? "px" });

/** A field's width: none where it follows another, else its number and unit, or why it is no width */
function widthOf(field: Field): { readonly width?: Width; readonly problem?: string } {
  if (!field.own) return {};
  const text = field.amount.trim();
  if (!text) return {};
  const amount = Number(text);
  const width = { amount, unit: field.unit };
  const problem = Number.isFinite(amount) ? validateTextWidth(width) : "A width is a number";
  return problem ? { problem } : { width };
}

/** A width in the other unit, of a pane: px as % of it and back, whole */
const converted = (amount: number, to: WidthUnit, pane: number, limits = TEXT_WIDTH_LIMITS): number => {
  const value = to === "%" ? Math.round((amount / pane) * 100) : Math.round((amount * pane) / 100);
  const { min, max } = limits[to];
  return Math.min(max, Math.max(min, value));
};

/** A guide in a pane (px): its pixels, its share of the pane, the pane (as a widget's width is) */
const guidePixels = widthInPane;

/** A guide as a slider in `unit` has it, in a pane */
const guideAt = (guide: Guide, unit: WidthUnit, pane: number): number => {
  if (unit === "px") return Math.round(guidePixels(guide, pane));
  return guide === "full" ? 100 : typeof guide === "string" ? percentOf(guide)! : Math.round((guide / pane) * 100);
};

/** A guide as a tick under a slider names it */
const tickName = (guide: Guide): string => (guide === "full" ? "Full" : typeof guide === "string" ? `${percentOf(guide)}%` : String(guide));

/** One width's row of the Page tab: what it follows or its own, a slider marked with the guides, a number and unit */
type WidthRow = { readonly element: HTMLElement; readonly field: Field; show(): void };

/** A guide's row of the Guides tab: its number as typed, its unit */
type GuideRow = { readonly element: HTMLElement; readonly input: HTMLInputElement; readonly slider: HTMLInputElement; unit: WidthUnit };

/** Why a guide's row holds no guide (empty: none, nothing to say) */
const rowProblem = (row: GuideRow): string | undefined => (row.input.value.trim() ? validateGuide(Number(row.input.value), row.unit) : undefined);

export class PageDialog {
  private readonly dialogs: Dialogs;
  private dialog: Dialog | undefined;
  private store: PageDialogStore | undefined;
  private saving = false;
  private page: WidthRow | undefined;
  private fallback: WidthRow | undefined;
  private guideRows: GuideRow[] = [];
  private guideList: HTMLElement | undefined;
  private full: HTMLInputElement | undefined;
  private resetGuides: HTMLButtonElement | undefined;
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;
  // The font size of all pages, this device's zoom (none: the size of all pages), whether Ctrl + scroll zooms
  private fontField: FontField = { own: false, amount: "" };
  private device: FontField = { own: false, amount: "" };
  private fontZoom: HTMLInputElement | undefined;
  // This device's row drawn again (its slider follows the font's size while it has no zoom of its own)
  private drawDevice: (() => void) | undefined;
  // How many of its controls are held now (a slider, Preview): the guides' sliders keep their room meanwhile
  private holds = 0;

  constructor(private readonly doc: Document) {
    this.dialogs = new Dialogs(doc, { base: BASE, closeIcon: ICONS.close });
  }

  get isOpen(): boolean {
    return this.dialogs.isOpen;
  }

  /**
   * The font as set in the dialog now, for the font zoom while it is open (Ctrl + scroll and Ctrl+0 then set This
   * device's row, as its slider does, kept on Save): whether Ctrl + scroll zooms, the size of all pages (none: the
   * theme's), this device's zoom (none: none)
   */
  get font(): { readonly zooms: boolean; readonly size: number | undefined; readonly zoom: number | undefined } {
    return { zooms: !!this.fontZoom?.checked, size: fontSizeOf(this.fontField).size, zoom: fontSizeOf(this.device).size };
  }

  /** This device's zoom set (none: the size of all pages again), as its row's slider sets it */
  setZoom(size: number | undefined): void {
    this.device.own = size !== undefined;
    this.device.amount = size === undefined ? "" : String(size);
    this.update();
  }

  open(store: PageDialogStore): void {
    if (this.isOpen) return;
    this.store = store;
    this.saving = false;
    this.render();
  }

  private render(): void {
    const { doc } = this;
    const store = this.store!;
    this.page = this.widthRow("This page", "all pages' width", fieldOf(store.pageWidth), () => this.inherited("page"));
    this.fallback = this.widthRow("All pages", "your theme's width", fieldOf(store.defaultWidth), () => this.inherited("fallback"));
    if (!store.canSaveSettings) this.fallback.element.classList.add(`${BASE}-readonly`);
    // (All pages first, as on the Font tab: what holds everywhere, then what holds here alone)
    this.fallback.element.dataset.swlRow = "all";
    this.page.element.dataset.swlRow = "page";
    const pagePanel = el(doc, "div", `${BASE}-widths`, this.fallback.element, this.page.element);
    // On a screen too narrow for widths (a phone): said first, that what is set here shows on a wider one
    if (store.paneWidth() < store.minPaneWidth) {
      pagePanel.prepend(
        el(
          doc,
          "p",
          { class: `${BASE}-notice`, attrs: { role: "note" } },
          el(doc, "span", { class: `${BASE}-notice-icon`, html: ICONS.info }),
          el(doc, "span", { text: `Widths apply on screens wider than ${store.minPaneWidth} px. On this one, the text fills the screen.` }),
        ),
      );
    }
    const [fontRow, deviceRow] = this.fontRows();
    if (!store.canSaveSettings) fontRow!.classList.add(`${BASE}-readonly`);
    const fontPanel = el(doc, "div", `${BASE}-widths`, fontRow!, deviceRow!);

    // The guides: each its row, ascending as drawn; Full width a box of its own
    this.guideList = el(doc, "div", { class: `${BASE}-guide-list`, attrs: { role: "list" } });
    const add = el(doc, "button", { class: `${BASE}-add`, text: "+ Add guide", run: () => this.addGuide("", "px", true) });
    this.full = el(doc, "input", { attrs: { type: "checkbox" } });
    this.full.addEventListener("change", () => this.update());
    this.showGuides(store.guides);
    // Default guides: the default ones back in the rows, once confirmed (the user's own would go); saved on Save
    this.resetGuides = el(doc, "button", {
      class: `${BASE}-guides-reset`,
      html: ICONS.reset,
      attrs: { title: `Put the default guides back: ${DEFAULT_GUIDES.map(guideName).join(", ")}` },
      run: () => void this.defaultGuides(),
    });
    this.resetGuides.append("Default guides");
    const fullRow = el(doc, "label", `${BASE}-full`, this.full, "Full width");
    // Preview: held (a press, a finger, Space or Enter), the guides as typed on the page, the dialog all but gone
    const preview = el(doc, "button", { class: `${BASE}-preview`, html: ICONS.eye, attrs: { title: "Hold to see the guides on the page" } });
    preview.append("Preview");
    const previewBox = el(doc, "div", `${BASE}-preview-box`, preview);
    const startPreview = (byKey: boolean) => this.hold(previewBox, store.previewGuides(this.currentGuides()), byKey);
    preview.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      startPreview(false);
    });
    preview.addEventListener("keydown", (e) => {
      if ((e.key !== " " && e.key !== "Enter") || e.repeat) return;
      e.preventDefault();
      startPreview(true);
    });
    // (Preview held shows its own box alone: Default guides beside it, not in it)
    const actions = el(doc, "div", `${BASE}-guide-actions`, previewBox, this.resetGuides);
    // (Preview and Default guides first, over the list: found at once, not under a list of any length)
    const guidesPanel = el(doc, "div", `${BASE}-guides`, actions, this.guideList, add, fullRow);
    // Settings that cannot be saved here cannot be changed either (Save would leave them as they are); Preview still shows
    if (!store.canSaveSettings) {
      guidesPanel.classList.add(`${BASE}-readonly`);
      for (const part of [this.fallback.element, guidesPanel, this.fontZoom!]) {
        const controls = part instanceof HTMLInputElement ? [part] : part.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button");
        for (const control of controls) if (control !== preview) control.disabled = true;
      }
    }
    // (The sliders made before the guides' rows: marked with them now)
    this.page.show();
    this.fallback.show();

    const { bar, panels, select } = tabs(doc, BASE, "swl", [
      { id: "page", title: "Page width", panel: pagePanel },
      { id: "font", title: "Font", panel: fontPanel },
      { id: "guides", title: "Guides", panel: guidesPanel },
    ]);
    // (The sliders marked with the guides as typed, as the Page tab shows again)
    bar.addEventListener("click", () => {
      this.page?.show();
      this.fallback?.show();
    });
    const content = doc.createDocumentFragment();
    content.append(...panels);
    this.note = el(doc, "div", `${BASE}-note`);
    // (Cancel asked for: closed without asking, the page put back; Esc, × or a press beside it ask where changes would be lost)
    const cancel = el(doc, "button", {
      class: `${BASE}-cancel`,
      text: "Cancel",
      run: () => {
        if (!this.saving) this.close();
      },
    });
    this.saveButton = el(doc, "button", { class: `${BASE}-save`, text: "Save", run: () => void this.save() });
    const footer = doc.createDocumentFragment();
    footer.append(this.note, cancel, this.saveButton);

    this.dialog = this.dialogs.open({
      title: "Page layout",
      subtitle: store.page,
      bar,
      content,
      footer,
      anchor: "top",
      dismiss: () => this.dismiss(),
      closed: () => {
        if (!this.saving) store.restore();
      },
    });
    select("page");
    this.update();
  }

  /** What a row follows where it has no width of its own, in px: the default (else the theme's), the theme's */
  private inherited(row: "page" | "fallback"): number {
    const store = this.store!;
    const pane = store.paneWidth();
    const px = (width: Width | undefined) => (width ? (width.unit === "px" ? width.amount : (width.amount * pane) / 100) : store.themeWidth());
    // (All pages' row as set now; while it is being made, its width as saved)
    return row === "page" ? px(this.fallback ? widthOf(this.fallback.field).width : store.defaultWidth) : store.themeWidth();
  }

  /** Rows of these guides (those typed before gone), ascending in the pane now; Full width ticked where full is one */
  private showGuides(guides: readonly Guide[]): void {
    const pane = this.store!.paneWidth();
    this.guideRows = [];
    this.guideList?.replaceChildren();
    // (Ascending as shown in the pane now: pixels and percents among each other)
    const rows = guides.filter((guide) => guide !== "full").sort((a, b) => guidePixels(a, pane) - guidePixels(b, pane));
    for (const guide of rows) this.addGuide(typeof guide === "string" ? String(percentOf(guide)) : String(guide), typeof guide === "string" ? "%" : "px", false);
    if (this.full) this.full.checked = guides.includes("full");
  }

  /** Default guides pressed: asked, then the default guides in the rows (the sliders marked with them), Save to keep */
  private async defaultGuides(): Promise<void> {
    const store = this.store!;
    const names = DEFAULT_GUIDES.map(guideName).join(", ");
    if (!(await store.confirm(`Put the default guides back (${names})? The guides you set here go; Save keeps the change.`))) return;
    this.showGuides(DEFAULT_GUIDES);
    this.page?.show();
    this.fallback?.show();
    this.update();
  }

  /** The guides as typed now, in pixels or percents (those that are no guide left out), and Full width */
  private currentGuides(): Guide[] {
    const guides: Guide[] = [];
    for (const row of this.guideRows) {
      if (!row.input.value.trim() || rowProblem(row)) continue;
      const guide = guideOf(Number(row.input.value), row.unit);
      if (!guides.includes(guide)) guides.push(guide);
    }
    if (this.full?.checked) guides.push("full");
    return guides;
  }

  /**
   * A row of a value: its name (what it is for: this page, all pages, this device) beside a slider, the value typed and
   * ↺; under them what it follows while it has no value of its own (the field empty, the followed value its
   * placeholder). Moved or typed in, it is its own; ↺ (shown while it is) takes it back
   */
  private rowOf(name: string, controls: HTMLElement, note: HTMLElement, ...more: HTMLElement[]): HTMLElement {
    return el(this.doc, "div", `${BASE}-row`, el(this.doc, "span", { class: `${BASE}-row-name`, text: name }), controls, note, ...more);
  }

  /** ↺: the value of its own taken back, what the row follows again */
  private resetButton(title: string, run: () => void): HTMLButtonElement {
    return el(this.doc, "button", { class: `${BASE}-reset`, html: ICONS.reset, attrs: { "aria-label": title, title }, run });
  }

  private widthRow(name: string, follows: string, field: Field, inherited: () => number): WidthRow {
    const { doc } = this;
    const store = this.store!;
    const slider = el(doc, "input", { class: `${BASE}-slider`, attrs: { type: "range", step: "1", "aria-label": `${name}: width` } });
    const ticks = el(doc, "div", { class: `${BASE}-ticks`, attrs: { "aria-hidden": "true" } });
    const amount = el(doc, "input", { class: `${BASE}-amount`, attrs: { type: "number", inputmode: "numeric", step: "1", "aria-label": `${name}: width in ${field.unit}` } });
    let unit: SegmentedControl<WidthUnit> | undefined;
    unit = segmentedControl(doc, SEGMENTS_BASE, `${name}: unit`, UNITS, field.unit, (value) => {
      // (The width it follows converted too: the field shows it, the slider starts from it)
      const now = field.own ? Number(field.amount) : NaN;
      if (Number.isFinite(now)) field.amount = String(converted(now, value, store.paneWidth()));
      field.unit = value;
      show();
      this.update();
    });
    const reset = this.resetButton(`Use ${follows}`, () => {
      field.own = false;
      field.amount = "";
      show();
      this.update();
    });
    const note = el(doc, "div", `${BASE}-row-note`);
    const range = () => {
      const pane = store.paneWidth();
      if (field.unit === "%") return { min: TEXT_WIDTH_LIMITS["%"].min, max: 100 };
      const widest = Math.max(pane, Number(field.amount) || 0, ...this.currentGuides().map((guide) => guidePixels(guide, pane)));
      return { min: TEXT_WIDTH_LIMITS.px.min, max: Math.ceil(widest / 100) * 100 };
    };
    // The guides as marks under the slider, where their values are on it
    const drawTicks = () => {
      const { min, max } = range();
      const pane = store.paneWidth();
      ticks.replaceChildren(
        ...this.currentGuides().flatMap((guide) => {
          const at = guideAt(guide, field.unit, pane);
          if (at < min || at > max) return [];
          return [el(doc, "span", { class: `${BASE}-tick`, text: tickName(guide), attrs: { style: `left: ${((at - min) / (max - min)) * 100}%` } })];
        }),
      );
    };
    const followed = () => Math.round(field.unit === "px" ? inherited() : converted(inherited(), "%", store.paneWidth()));
    const show = () => {
      const { min, max } = range();
      slider.min = String(min);
      slider.max = String(max);
      const shown = field.own ? Number(field.amount) : followed();
      if (Number.isFinite(shown)) slider.value = String(Math.round(shown));
      if (amount.value !== field.amount || !field.own) amount.value = field.own ? field.amount : "";
      amount.placeholder = String(followed());
      amount.setAttribute("aria-label", `${name}: width in ${field.unit}`);
      slider.disabled = amount.disabled = reset.disabled = !this.editable(row);
      unit!.set(field.unit);
      row.classList.toggle(`${BASE}-follows`, !field.own);
      note.textContent = field.own ? "" : `Uses ${follows}`;
      drawTicks();
    };
    this.slides(slider);
    slider.addEventListener("input", () => {
      field.own = true;
      // Near a guide: on it, as a widget's bar snaps
      let value = Number(slider.value);
      const pane = store.paneWidth();
      for (const guide of this.currentGuides()) {
        const at = guideAt(guide, field.unit, pane);
        if (Math.abs(at - value) <= SNAP[field.unit]) value = at;
      }
      field.amount = String(value);
      show();
      this.update();
    });
    amount.addEventListener("input", () => {
      // Typed in: its own width; emptied: the one it follows again
      field.own = !!amount.value.trim();
      field.amount = amount.value;
      const value = Number(amount.value);
      if (field.own && Number.isFinite(value)) slider.value = String(value);
      row.classList.toggle(`${BASE}-follows`, !field.own);
      note.textContent = field.own ? "" : `Uses ${follows}`;
      this.update();
    });
    const row = this.rowOf(
      name,
      el(doc, "div", `${BASE}-width-controls`, el(doc, "div", `${BASE}-slider-box`, slider, ticks), el(doc, "div", `${BASE}-width-value`, amount, unit.element, reset)),
      note,
    );
    row.classList.add(`${BASE}-width-row`);
    show();
    return { element: row, field, show };
  }

  /**
   * The Font tab: the editor's font size for all pages (the theme's, or its own), and this device's zoom (the size of
   * all pages, or its own, as Ctrl + scroll sets it), with whether Ctrl + scroll zooms at all; each a slider (5 to 40
   * px), the size typed and ↺
   */
  private fontRows(): HTMLElement[] {
    const { doc } = this;
    const store = this.store!;
    const field: FontField = (this.fontField = { own: store.fontSize !== undefined, amount: store.fontSize === undefined ? "" : String(store.fontSize) });
    const sizeSlider = (label: string) =>
      el(doc, "input", { class: `${BASE}-slider`, attrs: { type: "range", step: "1", min: String(FONT_SIZE_LIMITS.min), max: String(FONT_SIZE_LIMITS.max), "aria-label": label } });
    const sizeField = (label: string) => el(doc, "input", { class: `${BASE}-amount`, attrs: { type: "number", inputmode: "numeric", step: "1", "aria-label": label } });
    const controls = (slider: HTMLInputElement, amount: HTMLInputElement, reset: HTMLButtonElement) =>
      el(doc, "div", `${BASE}-width-controls`, el(doc, "div", `${BASE}-slider-box ${BASE}-slider-plain`, slider), el(doc, "div", `${BASE}-width-value`, amount, el(doc, "span", `${BASE}-unit`, "px"), reset));

    // All pages: the theme's size, or its own
    const slider = sizeSlider("Font size");
    const amount = sizeField("Font size in px");
    const note = el(doc, "div", `${BASE}-row-note`);
    const reset = this.resetButton("Use your theme's size", () => {
      field.own = false;
      field.amount = "";
      show();
      this.update();
    });
    const show = () => {
      const shown = field.own ? Number(field.amount) : store.themeFontSize();
      if (Number.isFinite(shown)) slider.value = String(Math.round(shown));
      if (amount.value !== field.amount || !field.own) amount.value = field.own ? field.amount : "";
      amount.placeholder = String(store.themeFontSize());
      slider.disabled = amount.disabled = reset.disabled = !this.editable(row);
      row.classList.toggle(`${BASE}-follows`, !field.own);
      note.textContent = field.own ? "" : "Uses your theme's size";
    };
    this.slides(slider);
    slider.addEventListener("input", () => {
      field.own = true;
      field.amount = slider.value;
      show();
      this.update();
    });
    amount.addEventListener("input", () => {
      field.own = !!amount.value.trim();
      field.amount = amount.value;
      const value = Number(amount.value);
      if (field.own && Number.isFinite(value)) slider.value = String(value);
      row.classList.toggle(`${BASE}-follows`, !field.own);
      note.textContent = field.own ? "" : "Uses your theme's size";
      this.update();
    });
    const row = this.rowOf("All pages", controls(slider, amount, reset), note);
    row.classList.add(`${BASE}-font-row`);
    show();

    // This device: the size of all pages, or its own (as Ctrl + scroll sets it); Ctrl + scroll on or off, its row there
    // either way (off: quiet, kept as it is)
    const device: FontField = (this.device = { own: store.zoom !== undefined, amount: store.zoom === undefined ? "" : String(store.zoom) });
    const fallback = () => fontSizeOf(this.fontField).size ?? store.themeFontSize();
    const zoomSlider = sizeSlider("This device's font size");
    const zoomAmount = sizeField("This device's font size in px");
    const zoomNote = el(doc, "div", `${BASE}-row-note`);
    const zoomReset = this.resetButton("Use the size of all pages", () => {
      device.own = false;
      device.amount = "";
      this.update();
    });
    this.fontZoom = el(doc, "input", { attrs: { type: "checkbox" } });
    this.fontZoom.checked = store.fontZoom;
    this.fontZoom.addEventListener("change", () => this.update());
    const zoomBox = el(doc, "label", { class: `${BASE}-zoom`, attrs: { title: "Ctrl+0 puts the size of all pages back" } }, this.fontZoom, "Ctrl + scroll zooms here");
    this.slides(zoomSlider);
    zoomSlider.addEventListener("input", () => {
      device.own = true;
      device.amount = zoomSlider.value;
      this.update();
    });
    zoomAmount.addEventListener("input", () => {
      device.own = !!zoomAmount.value.trim();
      device.amount = zoomAmount.value;
      this.update();
    });
    const deviceRow = this.rowOf("This device", controls(zoomSlider, zoomAmount, zoomReset), zoomNote, zoomBox);
    deviceRow.classList.add(`${BASE}-device`);
    // (Drawn again with every change: it follows the size of all pages while it has none of its own)
    this.drawDevice = () => {
      const on = !!this.fontZoom?.checked;
      const shown = device.own ? Number(device.amount) : fallback();
      if (Number.isFinite(shown)) zoomSlider.value = String(Math.round(shown));
      if (zoomAmount.value !== device.amount || !device.own) zoomAmount.value = device.own ? device.amount : "";
      zoomAmount.placeholder = String(fallback());
      zoomSlider.disabled = zoomAmount.disabled = zoomReset.disabled = !on;
      deviceRow.classList.toggle(`${BASE}-follows`, !device.own);
      deviceRow.classList.toggle(`${BASE}-off`, !on);
      zoomNote.textContent = device.own ? "" : "Uses the size of all pages";
    };
    this.drawDevice();
    return [row, deviceRow];
  }

  /**
   * While a slider is held (by a finger or a mouse), the dialog all but goes, the slider and its value alone shown
   * (`${BASE}-sliding` on the dialog, `${BASE}-held` on the controls held): what it changes is seen on the page under
   * the dialog, which on a phone takes the whole screen. Back as it is let go
   */
  private slides(slider: HTMLInputElement): void {
    slider.addEventListener("pointerdown", () => {
      const held = slider.closest<HTMLElement>(`.${BASE}-width-controls`);
      if (held) this.hold(held);
    });
  }

  /**
   * The dialog all but gone while something of it is held (`held` alone shown), back as it is let go: the pointer up
   * or taken away, or, held by a key (Preview by Space or Enter), the key up; `ended` then
   */
  private hold(held: HTMLElement, ended?: () => void, byKey = false): void {
    const box = held.closest<HTMLElement>(`.${BASE}`);
    if (!box) return;
    box.classList.add(`${BASE}-sliding`);
    held.classList.add(`${BASE}-held`);
    this.holds++;
    const view = this.doc.defaultView;
    const types = byKey ? ["keyup", "pointercancel"] : ["pointerup", "pointercancel"];
    const end = () => {
      this.holds--;
      box.classList.remove(`${BASE}-sliding`);
      held.classList.remove(`${BASE}-held`);
      for (const type of types) view?.removeEventListener(type, end, true);
      ended?.();
      // (The guides' sliders fitted to what was set meanwhile; not where the dialog closed while it was held: the page
      // would show again what it put back)
      if (this.isOpen) this.update();
    };
    for (const type of types) view?.addEventListener(type, end, true);
  }

  /**
   * The room of the guides' sliders in px: one for all, so their places compare (on a phone too), to the pane's width or
   * the widest guide typed now (or `more`), whichever is wider, in whole hundreds
   */
  private guideRoom(more = 0): number {
    const pane = this.store!.paneWidth();
    const widest = Math.max(pane, more, ...this.currentGuides().map((guide) => guidePixels(guide, pane)));
    return Math.min(GUIDE_LIMITS.px.max, Math.ceil(widest / 100) * 100);
  }

  /** The guides' sliders in px given the room of the guides as typed now (not while one is held: it would jump) */
  private fitGuideSliders(): void {
    if (this.holds) return;
    const room = String(this.guideRoom());
    for (const row of this.guideRows) {
      if (row.unit !== "px" || row.slider.max === room) continue;
      row.slider.max = room;
      if (row.input.value.trim() && Number.isFinite(Number(row.input.value))) row.slider.value = row.input.value;
    }
  }

  /** Whether a row can be changed here (all pages' width only where settings can be saved) */
  private editable(row: HTMLElement): boolean {
    return !row.closest(`.${BASE}-readonly`);
  }

  /**
   * A guide's row: a slider (held: the guides on the page as it moves, the dialog all but gone), its number typed
   * straight in, its unit switched (px or % of the pane: the number converted, as a width's), a × taking it out;
   * `focus`: the new one, to type in
   */
  private addGuide(value: string, unit: WidthUnit, focus: boolean): void {
    const { doc } = this;
    const store = this.store!;
    const input = el(doc, "input", { class: `${BASE}-guide-amount`, attrs: { type: "number", inputmode: "numeric", step: "1" } });
    input.value = value;
    const slider = el(doc, "input", { class: `${BASE}-slider ${BASE}-guide-slider`, attrs: { type: "range", step: "1" } });
    const row: GuideRow = { element: el(doc, "div", { class: `${BASE}-guide-row`, attrs: { role: "listitem" } }), input, slider, unit };
    // The slider's room: % of the pane to its whole; px from the least to the pane's width (or the value, wider)
    const limits = () => {
      const { min, max } = GUIDE_LIMITS[row.unit];
      input.min = String(min);
      input.max = String(max);
      input.setAttribute("aria-label", `Guide width in ${row.unit}`);
      slider.setAttribute("aria-label", `Guide width (${row.unit})`);
      slider.min = String(min);
      slider.max = String(row.unit === "%" ? max : this.guideRoom(Number(input.value) || 0));
      if (input.value.trim() && Number.isFinite(Number(input.value))) slider.value = input.value;
      else slider.value = String(row.unit === "%" ? 80 : Math.round(store.paneWidth() * 0.8));
    };
    limits();
    // While the slider is held: the guides on the page, drawn again as it moves
    let stopPreview: (() => void) | undefined;
    const previewAgain = () => {
      if (!stopPreview) return;
      stopPreview();
      stopPreview = store.previewGuides(this.currentGuides());
    };
    slider.addEventListener("pointerdown", () => {
      stopPreview = store.previewGuides(this.currentGuides());
      this.hold(row.element, () => {
        stopPreview?.();
        stopPreview = undefined;
      });
    });
    slider.addEventListener("input", () => {
      input.value = slider.value;
      this.update();
      previewAgain();
    });
    input.addEventListener("input", () => {
      if (input.value.trim() && Number.isFinite(Number(input.value))) slider.value = input.value;
      this.update();
    });
    const units = segmentedControl(doc, SEGMENTS_BASE, "Guide's unit", UNITS, unit, (to) => {
      const now = Number(input.value);
      const pane = store.paneWidth();
      if (input.value.trim() && Number.isFinite(now) && pane > 0) input.value = String(converted(now, to, pane, GUIDE_LIMITS));
      row.unit = to;
      limits();
      this.update();
    });
    const remove = el(doc, "button", {
      class: `${BASE}-remove`,
      html: ICONS.close,
      attrs: { "aria-label": "Remove this guide" },
      run: () => {
        row.element.remove();
        this.guideRows = this.guideRows.filter((one) => one !== row);
        this.update();
      },
    });
    row.element.append(el(doc, "div", `${BASE}-guide-slider-box`, slider), input, units.element, remove);
    this.guideRows.push(row);
    this.guideList?.append(row.element);
    if (focus) input.focus();
    this.update();
  }

  /** What is wrong (said, Save off), what changed (Save on), the page shown as it would be */
  private update(): void {
    const store = this.store;
    if (!store || !this.page || !this.fallback) return;
    const page = widthOf(this.page.field);
    const fallback = widthOf(this.fallback.field);
    const guides = this.currentGuides();
    if (this.resetGuides) this.resetGuides.disabled = !this.editable(this.resetGuides) || (guides.length === DEFAULT_GUIDES.length && DEFAULT_GUIDES.every((guide) => guides.includes(guide)));
    const badGuide = this.guideRows.find((row) => !!rowProblem(row));
    for (const row of this.guideRows) row.input.classList.toggle(`${BASE}-invalid`, !!rowProblem(row));
    this.fitGuideSliders();
    // The rows following another shown as what they follow now (This page the width of all pages, This device the
    // font's size), as that one changes
    if (!this.page.field.own) this.page.show();
    this.drawDevice?.();
    const font = fontSizeOf(this.fontField);
    const zoom = fontSizeOf(this.device);
    const problem = page.problem ?? fallback.problem ?? font.problem ?? zoom.problem ?? (badGuide ? rowProblem(badGuide) : undefined);
    if (!page.problem && !fallback.problem && !font.problem && !zoom.problem) {
      store.preview({ pageWidth: page.width, defaultWidth: fallback.width, fontSize: font.size, fontZoom: !!this.fontZoom?.checked, zoom: zoom.size });
    }
    if (this.saveButton) {
      this.saveButton.textContent = this.saving ? "Saving…" : "Save";
      this.saveButton.disabled = this.saving || !!problem || !this.changed();
    }
    if (this.note) {
      this.note.textContent = problem ?? "";
      this.note.classList.toggle(`${BASE}-problem`, !!problem);
    }
  }

  private changed(): boolean {
    const store = this.store;
    if (!store || !this.page || !this.fallback) return false;
    const guides = this.currentGuides();
    const sameGuides = guides.length === store.guides.length && guides.every((guide) => store.guides.includes(guide));
    return !sameWidth(widthOf(this.page.field).width, store.pageWidth) || !sameWidth(widthOf(this.fallback.field).width, store.defaultWidth) || !sameGuides || this.fontChanged() || this.zoomChanged();
  }

  /** Whether the font size or Font zoom differ from what is saved */
  private fontChanged(): boolean {
    const store = this.store!;
    return fontSizeOf(this.fontField).size !== store.fontSize || !!this.fontZoom?.checked !== store.fontZoom;
  }

  /** Whether this device's zoom is set otherwise than it is kept (its slider moved, typed, ↺) */
  private zoomChanged(): boolean {
    return fontSizeOf(this.device).size !== this.store!.zoom;
  }

  /** Esc, × or a press beside it: whether it closes, after asking where changes would be lost */
  private async dismiss(): Promise<boolean> {
    if (this.saving) return false;
    if (!this.changed()) return true;
    return this.store!.confirm("Close Page layout without saving your changes?");
  }

  close(): void {
    this.dialog?.close();
    this.dialog = undefined;
  }

  /** Saves what changed (the guides, the default, the page's width), closes */
  private async save(): Promise<void> {
    const store = this.store;
    if (!store || this.saving || !this.page || !this.fallback) return;
    const page = widthOf(this.page.field);
    const fallback = widthOf(this.fallback.field);
    const font = fontSizeOf(this.fontField);
    if (page.problem || fallback.problem || font.problem || fontSizeOf(this.device).problem) return;
    this.saving = true;
    this.update();
    const problems: string[] = [];
    const guides = this.currentGuides();
    const sameGuides = guides.length === store.guides.length && guides.every((guide) => store.guides.includes(guide));
    if (!sameGuides && store.canSaveSettings) {
      const problem = await store.saveGuides(guides).catch((e: unknown) => String(e));
      if (problem) problems.push(`the guides: ${problem}`);
    }
    if (!sameWidth(fallback.width, store.defaultWidth) && store.canSaveSettings) {
      const problem = await store.saveDefault(fallback.width).catch((e: unknown) => String(e));
      if (problem) problems.push(`the default: ${problem}`);
    }
    if (this.fontChanged() && store.canSaveSettings) {
      const problem = await store.saveFont(font.size, !!this.fontZoom?.checked).catch((e: unknown) => String(e));
      if (problem) problems.push(`the font size: ${problem}`);
    }
    if (this.zoomChanged()) store.saveZoom(fontSizeOf(this.device).size);
    if (!sameWidth(page.width, store.pageWidth)) {
      const problem = await store.savePage(page.width).catch((e: unknown) => String(e));
      if (problem) problems.push(`this page: ${problem}`);
    }
    if (problems.length) store.flash(`Silverware Layout could not save ${problems.join("; ")}`, "error");
    this.close();
    this.saving = false;
    // What is saved is shown (what could not be, as it was)
    store.restore();
  }
}

