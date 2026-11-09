// The settings dialog (the command "Silverware Database: Settings"): tabs
// Views and Modules, each view and module with its switch (`enabled`) and,
// under it while it is on, the settings it declares, built-in and the user's
// alike. It reads the settings as it opens and writes nothing until Save;
// saved, the modules are started anew and the places drawn anew (a view reads
// its settings as it is drawn: no reload). The shared dialog, tabs and controls (shared/), in
// the look of the other plugins' settings (classes `swd-settings-*`).
import { settingRow, switchControl } from "../../../shared/controls.ts";
import { type Dialog, Dialogs } from "../../../shared/dialog.ts";
import type { Settings, UserInterface } from "../../../shared/platform.ts";
import { tabs } from "../../../shared/tabs.ts";
import { type ModuleDefinition, moduleSettingPath } from "./module.ts";
import { viewSettingPath } from "./place.ts";
import type { ViewSetting } from "./view.ts";
import type { ViewRegistry } from "./views.ts";

const BASE = "swd-settings";
const CLOSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';

export type SettingsDialogOptions = {
  readonly views: ViewRegistry;
  readonly modules?: readonly ModuleDefinition[];
  readonly settings: Settings;
  readonly ui: Pick<UserInterface, "notify" | "ask">;
  /** The settings saved: what is shown drawn anew with them */
  readonly saved: () => void;
};

// A view or a module as the dialog shows it: its switch, its settings, where they are kept
type Switchable = {
  readonly name: string;
  readonly label: string;
  readonly hint: string;
  readonly settings: readonly ViewSetting[];
  readonly path: (key: string) => string;
  readonly kind: "view" | "module";
};

export class SettingsDialog {
  private readonly dialogs: Dialogs;
  private dialog: Dialog | undefined;
  // The values by path as read, and as changed in the dialog
  private initial = new Map<string, unknown>();
  private values = new Map<string, unknown>();
  private saving = false;
  // Opening (its settings read): a second command meanwhile opens no second dialog
  private opening = false;
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;

  constructor(
    private readonly doc: Document,
    private readonly options: SettingsDialogOptions,
  ) {
    this.dialogs = new Dialogs(doc, { base: BASE, closeIcon: CLOSE });
  }

  get isOpen(): boolean {
    return this.dialogs.isOpen;
  }

  /** Reads the settings as configured now and shows them */
  async open(): Promise<void> {
    if (this.isOpen || this.opening) return;
    this.opening = true;
    try {
      await this.read();
    } finally {
      this.opening = false;
    }
    this.render();
  }

  /** The views and the modules, each as the dialog shows it */
  private switchables(): { readonly views: Switchable[]; readonly modules: Switchable[] } {
    return {
      views: this.options.views.all().map((view) => ({ name: view.name, label: view.label, hint: `The view ${view.name}: offered in the switcher above every database`, settings: view.settings ?? [], path: (key) => viewSettingPath(view.name, key), kind: "view" })),
      modules: (this.options.modules ?? []).map((module) => ({ name: module.name, label: module.label, hint: module.description, settings: module.settings ?? [], path: (key) => moduleSettingPath(module.name, key), kind: "module" })),
    };
  }

  private async read(): Promise<void> {
    const { settings } = this.options;
    const { views, modules } = this.switchables();
    this.initial = new Map();
    for (const one of [...views, ...modules]) {
      this.initial.set(one.path("enabled"), (await settings.get(one.path("enabled"), true)) !== false);
      for (const setting of one.settings) this.initial.set(one.path(setting.key), await settings.get(one.path(setting.key), setting.default));
    }
    this.values = new Map(this.initial);
  }

  close(): void {
    this.dialog?.close();
    this.dialog = undefined;
  }

  private render(): void {
    const { doc } = this;
    const { views, modules } = this.switchables();
    const panelOf = (list: readonly Switchable[], none: string) => {
      const panel = doc.createElement("div");
      if (!list.length) {
        const empty = doc.createElement("p");
        empty.className = `${BASE}-hint`;
        empty.textContent = none;
        panel.append(empty);
        return panel;
      }
      const card = doc.createElement("div");
      card.className = `${BASE}-card`;
      for (const one of list) card.append(...this.rows(one));
      panel.append(card);
      return panel;
    };
    const { bar, panels } = tabs(doc, BASE, "swd", [
      { id: "views", title: "Views", panel: panelOf(views, "No view is defined yet.") },
      { id: "modules", title: "Modules", panel: panelOf(modules, "No module is defined.") },
    ]);
    const content = doc.createDocumentFragment();
    content.append(...panels);
    const footer = doc.createDocumentFragment();
    this.note = doc.createElement("div");
    this.note.className = `${BASE}-note`;
    const cancel = this.button(`${BASE}-cancel`, "Cancel", () => {
      if (!this.saving) this.close();
    });
    this.saveButton = this.button(`${BASE}-save`, "Save", () => void this.save());
    footer.append(this.note, cancel, this.saveButton);
    this.dialog = this.dialogs.open({ title: "Silverware Database settings", subtitle: "For the whole space: saved in its configuration", bar, content, footer, dismiss: () => this.dismiss() });
    this.update();
  }

  /** A view's or a module's switch, and its own settings under it while it is on */
  private rows(one: Switchable): HTMLElement[] {
    const { doc } = this;
    const enabled = one.path("enabled");
    const own = doc.createElement("div");
    own.className = `${BASE}-module-settings`;
    own.hidden = this.values.get(enabled) === false;
    for (const setting of one.settings) own.append(this.settingRow(one, setting));
    const toggle = switchControl(doc, BASE, this.values.get(enabled) !== false, (on) => {
      this.values.set(enabled, on);
      own.hidden = !on;
      this.update();
    });
    const box = toggle.querySelector("input")!;
    if (one.kind === "view") box.dataset.swdView = one.name;
    else box.dataset.swdModule = one.name;
    const row = settingRow(doc, BASE, one.label, one.hint, toggle);
    return one.settings.length ? [row, own] : [row];
  }

  /** A setting's row of the control its declaration names */
  private settingRow(one: Switchable, setting: ViewSetting): HTMLElement {
    const { doc } = this;
    const path = one.path(setting.key);
    const value = this.values.get(path);
    const set = (next: unknown) => {
      this.values.set(path, next);
      this.update();
    };
    let control: HTMLElement;
    if (setting.control === "switch") control = switchControl(doc, BASE, value === true, set);
    else if (setting.control === "choice") {
      const select = doc.createElement("select");
      const choices = setting.choices ?? [];
      // A value kept that is none of its choices shown as it is (picking a choice is then a change)
      if (!choices.includes(String(value))) {
        const kept = new Option(String(value), String(value), false, true);
        kept.disabled = true;
        select.append(kept);
      }
      for (const choice of choices) select.append(new Option(choice, choice, false, choice === value));
      select.addEventListener("change", () => set(select.value));
      control = select;
    } else {
      const input = doc.createElement("input");
      input.type = setting.control === "number" ? "number" : "text";
      input.value = value === undefined || value === null ? "" : String(value);
      input.addEventListener("input", () => {
        if (setting.control !== "number") return set(input.value);
        // A number that does not read is shown so and not kept
        const number = Number(input.value);
        const valid = input.value.trim() !== "" && Number.isFinite(number);
        input.classList.toggle(`${BASE}-invalid`, !valid);
        if (valid) set(number);
        else this.update();
      });
      control = input;
    }
    control.dataset.swdSetting = path;
    return settingRow(doc, BASE, setting.label, setting.hint, control);
  }

  private button(className: string, label: string, run: () => void): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      run();
    });
    return button;
  }

  /** Esc, the close button or a press beside it: closes, asking first where changes would be lost */
  private async dismiss(): Promise<boolean> {
    if (this.saving) return false;
    if (!Object.keys(this.changed()).length) return true;
    return (await this.options.ui.ask?.("Close the Silverware Database settings without saving your changes?")) ?? false;
  }

  private changed(): Record<string, unknown> {
    const changed: Record<string, unknown> = {};
    for (const [path, value] of this.values) if (JSON.stringify(value) !== JSON.stringify(this.initial.get(path))) changed[path] = value;
    return changed;
  }

  private update(): void {
    const changed = Object.keys(this.changed()).length;
    const canSave = !!this.options.settings.save;
    if (this.saveButton) {
      this.saveButton.textContent = this.saving ? "Saving…" : "Save";
      // (A number that does not read: nothing saved until it does)
      const invalid = !!this.dialog && this.doc.querySelector(`.${BASE} .${BASE}-invalid`) !== null;
      this.saveButton.disabled = this.saving || !canSave || !changed || invalid;
    }
    if (this.note) this.note.textContent = canSave ? "" : "Settings cannot be saved here.";
  }

  /** Saves what changed, closes and draws what is shown anew */
  private async save(): Promise<void> {
    const changed = this.changed();
    if (this.saving || !this.options.settings.save || !Object.keys(changed).length || this.saveButton?.disabled) return;
    this.saving = true;
    this.update();
    try {
      await this.options.settings.save(changed);
    } catch (error) {
      this.saving = false;
      this.options.ui.notify(`Silverware Database: the settings could not be saved (${error instanceof Error ? error.message : String(error)})`, { type: "error" });
      this.update();
      return;
    }
    this.saving = false;
    this.close();
    this.options.saved();
  }
}
