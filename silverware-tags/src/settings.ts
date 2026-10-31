// The settings dialog: the command "Silverware Tags: Settings" and the gear in
// the window's foot. Tabs General (Hide and protect meta pages) and Modules
// (each one's switch, with what it does). It reads the configuration when it
// opens and writes nothing until Save, then reloads (Save and reload): modules
// are created, and the library page defines their commands and the panel (its
// Meta segment by the protection of meta pages), as Silverware Tags starts. Of
// one height whatever its tab shows.
// The shared dialog, tabs and controls (shared/), in the toolbar's settings'
// look (classes `swg-settings-*`).
import { settingRow, switchControl } from "../../shared/controls.ts";
import { type Dialog, Dialogs } from "../../shared/dialog.ts";
import { tabs } from "../../shared/tabs.ts";
import { MODULE_DESCRIPTIONS, MODULE_LABELS, MODULE_NAMES, type ModuleName, NEW_TAGS_FORM_LABELS, NEW_TAGS_FORMS, type NewTagsForm, PATHS, type Settings } from "./bridge.ts";
import { ICONS } from "./ui/icons.ts";

const BASE = "swg-settings";

/** Where the settings are read and saved: SilverBullet's configuration (index.ts makes it of the bridge), the playground's store */
export type SettingsStore = {
  read(): Promise<Settings>;
  // Whether they can be saved here (else the dialog only shows them)
  readonly canSave: boolean;
  // What changed, by path
  save(values: Readonly<Record<string, unknown>>): Promise<void>;
  // Saved: the page loaded anew, Silverware Tags started with them
  reload(): Promise<void>;
  confirm(question: string): Promise<boolean>;
  flash(message: string, type: "info" | "error"): void;
};

type Values = { protectMeta: boolean; pageFirst: boolean; newTagsForm: NewTagsForm; modules: Record<ModuleName, boolean> };

export class SettingsDialog {
  private readonly dialogs: Dialogs;
  private dialog: Dialog | undefined;
  private initial: Values | undefined;
  private values: Values | undefined;
  private saving = false;
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;

  constructor(
    private readonly doc: Document,
    private readonly store: SettingsStore,
  ) {
    this.dialogs = new Dialogs(doc, { base: BASE, closeIcon: ICONS.close });
  }

  get isOpen(): boolean {
    return this.dialogs.isOpen;
  }

  /** Reads the settings as configured now and shows them */
  async open(): Promise<void> {
    if (this.isOpen) return;
    const settings = await this.store.read();
    const modules = Object.fromEntries(MODULE_NAMES.map((name) => [name, settings.modules.has(name)])) as Record<ModuleName, boolean>;
    this.initial = { protectMeta: settings.protectMeta, pageFirst: settings.pageFirst, newTagsForm: settings.newTagsForm, modules };
    this.values = { protectMeta: settings.protectMeta, pageFirst: settings.pageFirst, newTagsForm: settings.newTagsForm, modules: { ...modules } };
    this.render();
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const e = this.doc.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  private button(className: string, label: string, run: () => void): HTMLButtonElement {
    const button = this.el("button", className, label);
    button.type = "button";
    button.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
    return button;
  }

  private render(): void {
    const { doc } = this;
    const values = this.values!;

    const general = this.el("div");
    const card = this.el("div", `${BASE}-card`);
    const protect = switchControl(doc, BASE, values.protectMeta, (on) => {
      values.protectMeta = on;
      this.update();
    });
    const protectRow = settingRow(
      doc,
      BASE,
      "Hide and protect meta pages",
      "SilverBullet's own pages (a page tagged meta or a tag under it, as libraries, templates and its API are) are left out: their tags show nowhere, and no change touches them (a rename of a tag they use too renames it everywhere else). Off: they show, their tags apart (Meta), and changes reach them.",
      protect,
    );
    protectRow.dataset.swgSetting = PATHS.protectMeta;
    const first = switchControl(doc, BASE, values.pageFirst, (on) => {
      values.pageFirst = on;
      this.update();
    });
    const firstRow = settingRow(doc, BASE, "The page open's tags first in the Tags panel", "On: the tags of the page you are on come first in the panel (their # marked either way). Off: by name, folders first, as SilverBullet's own tree.", first);
    firstRow.dataset.swgSetting = PATHS.pageFirst;
    const form = this.el("select");
    for (const value of NEW_TAGS_FORMS) form.append(new Option(NEW_TAGS_FORM_LABELS[value], value, false, value === values.newTagsForm));
    form.addEventListener("change", () => {
      values.newTagsForm = form.value as NewTagsForm;
      this.update();
    });
    const formRow = settingRow(doc, BASE, "How new tags are written", "Where a page has no tags yet: on one line in brackets (tags: [a, b]), as - lines, or as a string (tags: a, b; a tag with a space in it makes it [ ]). A page that has tags keeps their form.", form);
    formRow.dataset.swgSetting = PATHS.newTagsForm;
    card.append(protectRow, firstRow, formRow);
    general.append(card);

    const modules = this.el("div");
    const moduleCard = this.el("div", `${BASE}-card`);
    for (const name of MODULE_NAMES) {
      const toggle = switchControl(doc, BASE, values.modules[name], (on) => {
        values.modules[name] = on;
        this.update();
      });
      toggle.querySelector("input")!.dataset.swgModule = name;
      moduleCard.append(settingRow(doc, BASE, MODULE_LABELS[name], MODULE_DESCRIPTIONS[name], toggle));
    }
    modules.append(moduleCard);

    const { bar, panels } = tabs(doc, BASE, "swg", [
      { id: "general", title: "General", panel: general },
      { id: "modules", title: "Modules", panel: modules },
    ]);
    const content = doc.createDocumentFragment();
    content.append(...panels);

    const footer = doc.createDocumentFragment();
    this.note = this.el("div", `${BASE}-note`);
    const cancel = this.button(`${BASE}-cancel`, "Cancel", () => {
      if (!this.saving) this.close();
    });
    this.saveButton = this.button(`${BASE}-save`, "Save", () => void this.save());
    footer.append(this.note, cancel, this.saveButton);

    this.dialog = this.dialogs.open({
      title: "Silverware Tags settings",
      subtitle: "For the whole space: SilverBullet's configuration",
      bar,
      content,
      footer,
      dismiss: () => this.dismiss(),
    });
    this.update();
  }

  close(): void {
    this.dialog?.close();
    this.dialog = undefined;
  }

  /** Esc, × or a press beside it: whether it closes, after asking where changes would be lost */
  private async dismiss(): Promise<boolean> {
    if (this.saving) return false;
    if (!Object.keys(this.changed()).length) return true;
    return this.store.confirm("Close the Silverware Tags settings without saving your changes?");
  }

  private changed(): Record<string, unknown> {
    const { initial, values } = this;
    if (!initial || !values) return {};
    const changed: Record<string, unknown> = {};
    if (values.protectMeta !== initial.protectMeta) changed[PATHS.protectMeta] = values.protectMeta;
    if (values.pageFirst !== initial.pageFirst) changed[PATHS.pageFirst] = values.pageFirst;
    if (values.newTagsForm !== initial.newTagsForm) changed[PATHS.newTagsForm] = values.newTagsForm;
    for (const name of MODULE_NAMES) if (values.modules[name] !== initial.modules[name]) changed[PATHS.module(name)] = values.modules[name];
    return changed;
  }

  private update(): void {
    const changed = this.changed();
    if (this.saveButton) {
      this.saveButton.textContent = this.saving ? "Saving…" : "Save and reload";
      this.saveButton.disabled = this.saving || !this.store.canSave || !Object.keys(changed).length;
      this.saveButton.title = this.store.canSave ? "" : "Settings cannot be saved here";
    }
    if (this.note) this.note.textContent = !this.store.canSave ? "Settings cannot be saved here." : Object.keys(changed).length ? "They apply once the page reloads." : "";
  }

  /** Saves what changed, closes and reloads */
  private async save(): Promise<void> {
    const changed = this.changed();
    if (this.saving || !this.store.canSave || !Object.keys(changed).length) return;
    this.saving = true;
    this.update();
    try {
      await this.store.save(changed);
    } catch (e) {
      this.saving = false;
      this.store.flash(`Silverware Tags: the settings could not be saved (${String(e)})`, "error");
      this.update();
      return;
    }
    this.saving = false;
    this.close();
    await this.store.reload();
  }
}
