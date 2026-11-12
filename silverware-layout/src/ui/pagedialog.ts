// The Page layout dialog (the command "Silverware Layout: Page layout"): the width of this page's text (the default, a
// preset, or a number in px or % of the pane) and the default text width of every page (none: the theme's). What is
// set shows on the page at once; Save writes it (the page's into its frontmatter, the default into CONFIG), Cancel or
// Esc puts the page back as it was. The shared dialog and controls (shared/), classes `swl-dialog-*`.
import { type SegmentedControl, segmentedControl, settingLabel } from "../../../shared/controls.ts";
import { type Dialog, Dialogs } from "../../../shared/dialog.ts";
import { el } from "../../../shared/elements.ts";
import type { Preset } from "../model/settings.ts";
import { sameWidth, TEXT_WIDTH_LIMITS, validateTextWidth, type Width, type WidthUnit } from "../model/width.ts";
import { ICONS } from "./icons.ts";

const BASE = "swl-dialog";
// The segmented control's base: shared/segments.css in the style page by the plugin's own
const SEGMENTS_BASE = "swl";

const UNITS = [
  { value: "px", label: "px", title: "Pixels" },
  { value: "%", label: "%", title: "Percent of the editor's pane" },
] as const;

/** What the dialog shows and saves, and how it shows a width on the page meanwhile */
export type PageDialogStore = {
  readonly page: string;
  // As saved now: the page's own width, the default
  readonly pageWidth: Width | undefined;
  readonly defaultWidth: Width | undefined;
  readonly presets: readonly Preset[];
  // Whether the default can be saved here (else it is only shown)
  readonly canSaveDefault: boolean;
  // The page shown as it would be with these (the page's own, the default), until `restore`
  preview(pageWidth: Width | undefined, defaultWidth: Width | undefined): void;
  restore(): void;
  // Each saved; why not, as text
  savePage(width: Width | undefined): Promise<string | undefined>;
  saveDefault(width: Width | undefined): Promise<string | undefined>;
  confirm(question: string): Promise<boolean>;
  flash(message: string, type: "info" | "error"): void;
};

/** A width being typed: its number as typed (empty: none) and its unit */
type Field = { amount: string; unit: WidthUnit };

const fieldOf = (width: Width | undefined): Field => ({ amount: width ? String(width.amount) : "", unit: width?.unit ?? "px" });

/** A field's width: none where it is empty, else its number and unit, or why it is no width */
function widthOf(field: Field): { readonly width?: Width; readonly problem?: string } {
  const text = field.amount.trim();
  if (!text) return {};
  const amount = Number(text);
  const width = { amount, unit: field.unit };
  const problem = Number.isFinite(amount) ? validateTextWidth(width) : "A width is a number";
  return problem ? { problem } : { width };
}

/** A width as typed: its element, its number's field and its unit's control */
type WidthField = { readonly element: HTMLElement; readonly input: HTMLInputElement; readonly unit: SegmentedControl<WidthUnit> };

const shownWidth = (width: Width) => `${width.amount} ${width.unit === "px" ? "px" : "%"}`;

export class PageDialog {
  private readonly dialogs: Dialogs;
  private dialog: Dialog | undefined;
  private store: PageDialogStore | undefined;
  private page: Field = fieldOf(undefined);
  private fallback: Field = fieldOf(undefined);
  private saving = false;
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;
  private pageField: WidthField | undefined;
  private fallbackField: WidthField | undefined;
  private presetButtons: { readonly button: HTMLButtonElement; readonly width: Width | undefined }[] = [];

  constructor(private readonly doc: Document) {
    this.dialogs = new Dialogs(doc, { base: BASE, closeIcon: ICONS.close });
  }

  get isOpen(): boolean {
    return this.dialogs.isOpen;
  }

  open(store: PageDialogStore): void {
    if (this.isOpen) return;
    this.store = store;
    this.page = fieldOf(store.pageWidth);
    this.fallback = fieldOf(store.defaultWidth);
    this.saving = false;
    this.render();
  }

  private render(): void {
    const { doc } = this;
    const store = this.store!;

    // This page: the default or a preset in one click, or a width typed
    const presets = el(doc, "div", { class: `${BASE}-presets`, attrs: { role: "group", "aria-label": "Presets" } });
    const presetWidths: { readonly name: string; readonly width: Width | undefined }[] = [
      { name: "Default", width: undefined },
      ...store.presets.map((preset) => ({ name: preset.name, width: preset.width === "full" ? ({ amount: 100, unit: "%" } as const) : preset.width })),
    ];
    this.presetButtons = presetWidths.map(({ name, width }) => {
      const button = el(doc, "button", {
        class: `${BASE}-preset`,
        text: name,
        title: width ? shownWidth(width) : "The default text width",
        run: () => {
          this.page = fieldOf(width);
          this.showFields();
          this.update();
        },
      });
      presets.append(button);
      return { button, width };
    });
    this.pageField = this.widthField("This page's text width", () => this.page, (field) => (this.page = field));
    const pageCard = el(
      doc,
      "div",
      `${BASE}-card`,
      el(doc, "div", `${BASE}-row`, settingLabel(doc, BASE, "This page", `Its text's width: the default, a preset, or a width of its own (${TEXT_WIDTH_LIMITS.px.min} to ${TEXT_WIDTH_LIMITS.px.max} px, or ${TEXT_WIDTH_LIMITS["%"].min} to 100 % of the editor's pane).`)),
      el(doc, "div", `${BASE}-row`, presets),
      el(doc, "div", `${BASE}-row`, this.pageField.element),
    );

    // The default of every page without its own
    this.fallbackField = this.widthField("Default text width", () => this.fallback, (field) => (this.fallback = field));
    const fallbackCard = el(
      doc,
      "div",
      `${BASE}-card`,
      el(doc, "div", `${BASE}-row`, settingLabel(doc, BASE, "Every page", "The default text width of pages without their own. Empty: your theme's.")),
      el(doc, "div", `${BASE}-row`, this.fallbackField.element),
    );

    const content = el(doc, "div", `${BASE}-content`, pageCard, fallbackCard);
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
      content,
      footer,
      focus: this.pageField.input,
      dismiss: () => this.dismiss(),
      closed: () => {
        if (!this.saving) store.restore();
      },
    });
    this.showFields();
    this.update();
  }

  /** A width's number and its unit (px or %), told as either changes */
  private widthField(name: string, now: () => Field, set: (field: Field) => void): WidthField {
    const { doc } = this;
    const input = el(doc, "input", { class: `${BASE}-amount`, attrs: { type: "number", inputmode: "decimal", step: "1", "aria-label": name } });
    input.addEventListener("input", () => {
      set({ ...now(), amount: input.value });
      this.update();
    });
    const unit = segmentedControl(doc, SEGMENTS_BASE, `${name}: unit`, UNITS, now().unit, (value) => {
      set({ ...now(), unit: value });
      this.update();
    });
    return { element: el(doc, "div", `${BASE}-width`, input, unit.element), input, unit };
  }

  /** The fields as the values are (a preset picked) */
  private showFields(): void {
    for (const [shown, field] of [
      [this.pageField, this.page],
      [this.fallbackField, this.fallback],
    ] as const) {
      if (!shown) continue;
      if (shown.input.value !== field.amount) shown.input.value = field.amount;
      shown.unit.set(field.unit);
    }
  }

  /** What changed from what is saved, what is wrong, the page shown as it would be */
  private update(): void {
    const store = this.store;
    if (!store) return;
    const page = widthOf(this.page);
    const fallback = widthOf(this.fallback);
    const problem = page.problem ?? fallback.problem;
    const pageChanged = !page.problem && !sameWidth(page.width, store.pageWidth);
    const fallbackChanged = !fallback.problem && !sameWidth(fallback.width, store.defaultWidth);
    this.pageField?.input.classList.toggle(`${BASE}-invalid`, !!page.problem);
    this.fallbackField?.input.classList.toggle(`${BASE}-invalid`, !!fallback.problem);
    if (this.pageField) this.pageField.input.placeholder = store.defaultWidth || fallback.width ? `Default (${shownWidth((fallback.width ?? store.defaultWidth)!)})` : "Default (theme's)";
    if (this.fallbackField) {
      this.fallbackField.input.placeholder = "Theme's";
      this.fallbackField.input.disabled = !store.canSaveDefault;
    }
    for (const { button, width } of this.presetButtons) button.setAttribute("aria-pressed", String(!page.problem && sameWidth(width, page.width)));
    if (!problem) store.preview(page.width, fallback.width);
    if (this.saveButton) {
      this.saveButton.textContent = this.saving ? "Saving…" : "Save";
      this.saveButton.disabled = this.saving || !!problem || !(pageChanged || fallbackChanged);
    }
    if (this.note) {
      this.note.textContent = problem ?? (!store.canSaveDefault ? "The default cannot be saved here." : "");
      this.note.classList.toggle(`${BASE}-problem`, !!problem);
    }
  }

  private changed(): boolean {
    const store = this.store;
    if (!store) return false;
    const page = widthOf(this.page);
    const fallback = widthOf(this.fallback);
    return !!page.problem || !!fallback.problem || !sameWidth(page.width, store.pageWidth) || !sameWidth(fallback.width, store.defaultWidth);
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

  /** Saves what changed (the page's width, the default), closes */
  private async save(): Promise<void> {
    const store = this.store;
    if (!store || this.saving) return;
    const page = widthOf(this.page);
    const fallback = widthOf(this.fallback);
    if (page.problem || fallback.problem) return;
    this.saving = true;
    this.update();
    const problems: string[] = [];
    if (!sameWidth(fallback.width, store.defaultWidth) && store.canSaveDefault) {
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
