// The Page layout dialog (the command "Silverware Layout: Page layout"), two tabs:
// - Page: the width of this page's text (the default, or its own) and the default of every page (the theme's, or its
//   own). Each set by a slider marked with the guides, snapping to them, or typed, in px or % of the pane; a row
//   following another shows the width it follows, and is its own as soon as either is moved or typed in.
//   What is set shows on the page at once (the dialog held at the window's top, the page seen under it).
// - Guides: the widths a drag snaps to (a widget's bar, these sliders), each typed in its own row; Full width a box.
//   Ascending as the tab is drawn, left in the order typed until it is drawn again.
// Save writes what changed (the page's into its frontmatter, the default and the guides into CONFIG), Cancel or Esc
// puts the page back. The shared dialog, tabs and controls (shared/), classes `swl-dialog-*`.
import { type SegmentedControl, segmentedControl } from "../../../shared/controls.ts";
import { type Dialog, Dialogs } from "../../../shared/dialog.ts";
import { el } from "../../../shared/elements.ts";
import { tabs } from "../../../shared/tabs.ts";
import { type Guide, validateGuide } from "../model/settings.ts";
import { sameWidth, TEXT_WIDTH_LIMITS, validateTextWidth, type Width, type WidthUnit } from "../model/width.ts";
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
  // The editor's pane now (px): a slider's room, and what % are of
  paneWidth(): number;
  // The text's width the theme gives (px), Silverware Layout's own set aside
  themeWidth(): number;
  // The page shown as it would be with these (the page's own, the default), until `restore`
  preview(pageWidth: Width | undefined, defaultWidth: Width | undefined): void;
  restore(): void;
  // Each saved; why not, as text
  savePage(width: Width | undefined): Promise<string | undefined>;
  saveDefault(width: Width | undefined): Promise<string | undefined>;
  saveGuides(guides: readonly Guide[]): Promise<string | undefined>;
  confirm(question: string): Promise<boolean>;
  flash(message: string, type: "info" | "error"): void;
};

/** A width being set: its own (or what it follows), its number as typed and its unit */
type Field = { own: boolean; amount: string; unit: WidthUnit };

const fieldOf = (width: Width | undefined): Field => ({ own: !!width, amount: width ? String(width.amount) : "", unit: width?.unit ?? "px" });

/** A field's width: none where it follows another, else its number and unit, or why it is no width */
function widthOf(field: Field): { readonly width?: Width; readonly problem?: string } {
  if (!field.own) return {};
  const text = field.amount.trim();
  if (!text) return { problem: "Type a width, or pick the one it follows" };
  const amount = Number(text);
  const width = { amount, unit: field.unit };
  const problem = Number.isFinite(amount) ? validateTextWidth(width) : "A width is a number";
  return problem ? { problem } : { width };
}

/** A width in the other unit, of a pane: px as % of it and back, whole */
const converted = (amount: number, to: WidthUnit, pane: number): number => {
  const value = to === "%" ? Math.round((amount / pane) * 100) : Math.round((amount * pane) / 100);
  const { min, max } = TEXT_WIDTH_LIMITS[to];
  return Math.min(max, Math.max(min, value));
};

/** A guide as a slider in `unit` has it, in a pane */
const guideAt = (guide: Guide, unit: WidthUnit, pane: number): number => (guide === "full" ? (unit === "%" ? 100 : Math.round(pane)) : unit === "%" ? Math.round((guide / pane) * 100) : guide);

/** One width's row of the Page tab: what it follows or its own, a slider marked with the guides, a number and unit */
type WidthRow = { readonly element: HTMLElement; readonly field: Field; show(): void };

/** A guide's row of the Guides tab: its number as typed */
type GuideRow = { readonly element: HTMLElement; readonly input: HTMLInputElement };

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
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;

  constructor(private readonly doc: Document) {
    this.dialogs = new Dialogs(doc, { base: BASE, closeIcon: ICONS.close });
  }

  get isOpen(): boolean {
    return this.dialogs.isOpen;
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
    this.page = this.widthRow("This page", "Default", fieldOf(store.pageWidth), () => this.inherited("page"));
    this.fallback = this.widthRow("All pages", "Theme", fieldOf(store.defaultWidth), () => this.inherited("fallback"));
    if (!store.canSaveSettings) this.fallback.element.classList.add(`${BASE}-readonly`);
    const pagePanel = el(doc, "div", `${BASE}-widths`, this.page.element, this.fallback.element);

    // The guides: each its row, ascending as drawn; Full width a box of its own
    this.guideList = el(doc, "div", { class: `${BASE}-guide-list`, attrs: { role: "list" } });
    this.guideRows = [];
    for (const guide of [...store.guides].filter((g): g is number => g !== "full").sort((a, b) => a - b)) this.addGuide(String(guide), false);
    const add = el(doc, "button", { class: `${BASE}-add`, text: "+ Add guide", run: () => this.addGuide("", true) });
    this.full = el(doc, "input", { attrs: { type: "checkbox" } });
    this.full.checked = store.guides.includes("full");
    this.full.addEventListener("change", () => this.update());
    const fullRow = el(doc, "label", `${BASE}-full`, this.full, "Full width");
    const guidesPanel = el(doc, "div", `${BASE}-guides`, this.guideList, add, fullRow);
    if (!store.canSaveSettings) guidesPanel.classList.add(`${BASE}-readonly`);
    // (The sliders made before the guides' rows: marked with them now)
    this.page.show();
    this.fallback.show();

    const { bar, panels, select } = tabs(doc, BASE, "swl", [
      { id: "page", title: "Page", panel: pagePanel },
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

  /** The guides as typed now, in pixels (those that are no guide left out), and Full width */
  private currentGuides(): Guide[] {
    const guides: Guide[] = [];
    for (const row of this.guideRows) {
      const value = Number(row.input.value);
      if (row.input.value.trim() && !validateGuide(value) && !guides.includes(value)) guides.push(value);
    }
    if (this.full?.checked) guides.push("full");
    return guides;
  }

  private widthRow(name: string, follows: string, field: Field, inherited: () => number): WidthRow {
    const { doc } = this;
    const store = this.store!;
    const mode = segmentedControl(
      doc,
      SEGMENTS_BASE,
      `${name}: width`,
      [
        { value: "follows", label: follows, title: follows === "Theme" ? "Your theme's width" : "The width of all pages" },
        { value: "own", label: "Own", title: "A width of its own" },
      ] as const,
      field.own ? "own" : "follows",
      (value) => {
        field.own = value === "own";
        // Its own from what it follows, the slider starting where the text is now
        if (field.own && !field.amount.trim()) field.amount = String(field.unit === "px" ? Math.round(inherited()) : converted(inherited(), "%", store.paneWidth()));
        show();
        this.update();
      },
    );
    const slider = el(doc, "input", { class: `${BASE}-slider`, attrs: { type: "range", step: "1", "aria-label": `${name}: width` } });
    const ticks = el(doc, "div", { class: `${BASE}-ticks`, attrs: { "aria-hidden": "true" } });
    const amount = el(doc, "input", { class: `${BASE}-amount`, attrs: { type: "number", inputmode: "numeric", step: "1", "aria-label": `${name}: width in ${field.unit}` } });
    let unit: SegmentedControl<WidthUnit> | undefined;
    unit = segmentedControl(doc, SEGMENTS_BASE, `${name}: unit`, UNITS, field.unit, (value) => {
      const now = Number(field.amount);
      if (field.amount.trim() && Number.isFinite(now)) field.amount = String(converted(now, value, store.paneWidth()));
      field.unit = value;
      show();
      this.update();
    });
    const range = () => {
      const pane = store.paneWidth();
      if (field.unit === "%") return { min: TEXT_WIDTH_LIMITS["%"].min, max: 100 };
      const widest = Math.max(pane, Number(field.amount) || 0, ...this.currentGuides().map((guide) => (guide === "full" ? pane : guide)));
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
          return [el(doc, "span", { class: `${BASE}-tick`, text: guide === "full" ? "Full" : String(guide), attrs: { style: `left: ${((at - min) / (max - min)) * 100}%` } })];
        }),
      );
    };
    const show = () => {
      const { min, max } = range();
      slider.min = String(min);
      slider.max = String(max);
      const shown = field.own ? Number(field.amount) : field.unit === "px" ? inherited() : converted(inherited(), "%", store.paneWidth());
      if (Number.isFinite(shown)) slider.value = String(Math.round(shown));
      if (amount.value !== field.amount || !field.own) amount.value = field.own ? field.amount : "";
      amount.placeholder = String(Math.round(field.unit === "px" ? inherited() : converted(inherited(), "%", store.paneWidth())));
      amount.setAttribute("aria-label", `${name}: width in ${field.unit}`);
      // (Never off: moved or typed in, a row following another takes a width of its own)
      slider.disabled = !this.editable(row);
      amount.disabled = !this.editable(row);
      mode.set(field.own ? "own" : "follows");
      unit!.set(field.unit);
      row.classList.toggle(`${BASE}-follows`, !field.own);
      drawTicks();
    };
    slider.addEventListener("input", () => {
      field.own = true;
      mode.set("own");
      row.classList.remove(`${BASE}-follows`);
      // Near a guide: on it, as a widget's bar snaps
      let value = Number(slider.value);
      const pane = store.paneWidth();
      for (const guide of this.currentGuides()) {
        const at = guideAt(guide, field.unit, pane);
        if (Math.abs(at - value) <= SNAP[field.unit]) value = at;
      }
      field.amount = String(value);
      amount.value = field.amount;
      slider.value = field.amount;
      this.update();
    });
    amount.addEventListener("input", () => {
      // Typed in: its own width; emptied: the one it follows again
      field.own = !!amount.value.trim();
      mode.set(field.own ? "own" : "follows");
      row.classList.toggle(`${BASE}-follows`, !field.own);
      field.amount = amount.value;
      const value = Number(amount.value);
      if (amount.value.trim() && Number.isFinite(value)) slider.value = String(value);
      this.update();
    });
    const row = el(
      doc,
      "div",
      `${BASE}-width-row`,
      el(doc, "div", `${BASE}-width-head`, el(doc, "span", { class: `${BASE}-width-name`, text: name }), mode.element),
      el(doc, "div", `${BASE}-width-controls`, el(doc, "div", `${BASE}-slider-box`, slider, ticks), el(doc, "div", `${BASE}-width-value`, amount, unit.element)),
    );
    show();
    return { element: row, field, show };
  }

  /** Whether a row can be changed here (all pages' width only where settings can be saved) */
  private editable(row: HTMLElement): boolean {
    return !row.closest(`.${BASE}-readonly`);
  }

  /** A guide's row: its number typed straight in, a × taking it out; `focus`: the new one, to type in */
  private addGuide(value: string, focus: boolean): void {
    const { doc } = this;
    const input = el(doc, "input", { class: `${BASE}-guide-amount`, attrs: { type: "number", inputmode: "numeric", step: "1", min: "200", max: "10000", "aria-label": "Guide width in px" } });
    input.value = value;
    input.addEventListener("input", () => this.update());
    const row: GuideRow = { element: el(doc, "div", { class: `${BASE}-guide-row`, attrs: { role: "listitem" } }), input };
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
    row.element.append(input, el(doc, "span", `${BASE}-unit`, "px"), remove);
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
    const badGuide = this.guideRows.find((row) => row.input.value.trim() && validateGuide(Number(row.input.value)));
    for (const row of this.guideRows) row.input.classList.toggle(`${BASE}-invalid`, row === badGuide || (!!row.input.value.trim() && !!validateGuide(Number(row.input.value))));
    const problem = page.problem ?? fallback.problem ?? (badGuide ? validateGuide(Number(badGuide.input.value)) : undefined);
    if (!page.problem && !fallback.problem) store.preview(page.width, fallback.width);
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
    return !sameWidth(widthOf(this.page.field).width, store.pageWidth) || !sameWidth(widthOf(this.fallback.field).width, store.defaultWidth) || !sameGuides;
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
    if (page.problem || fallback.problem) return;
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

