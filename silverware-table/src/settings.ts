// The settings dialog: Silverware Table's settings (bridge.ts SETTINGS) and modules
// (FEATURE_NAMES, each with what it does and its own settings) for every
// table, from the table's ⋯ menu or the "Silverware Table: Settings" command. It
// reads them from SilverBullet's configuration when it opens (one source: what
// Ctrl-, shows, too) and changes nothing until Save: then they are written
// where SilverBullet keeps them (the CONFIG page's managed block,
// configpage.ts) and the configuration is loaded again. Modules are created
// when Silverware Table starts, so turning one on or off saves and reloads the page.
import { settingRow, switchControl } from "../../shared/controls.ts";
import { type Dialog, Dialogs } from "../../shared/dialog.ts";
import { tabs } from "../../shared/tabs.ts";
import { type Bridge, FEATURE_NAMES, type FeatureName, MODULE_CATEGORIES, MODULE_CATEGORY, MODULE_DESCRIPTIONS, MODULE_LABELS, type ModuleCategory, moduleOnByDefault, settingChoices, SETTINGS } from "./bridge.ts";
import { UI_CLASS } from "./dom.ts";
import { ICONS } from "./icons.ts";

// The classes' base of the dialog and its controls (shared/dialog.ts, tabs.ts, controls.ts)
const BASE = "swt-settings";

type Key = keyof typeof SETTINGS;

export type SettingsContext = {
  readonly doc: Document;
  readonly bridge: Bridge;
  // Whether the settings can be saved here (else the dialog only shows them)
  readonly canSave: boolean;
  // Saves settings by path
  save(values: Readonly<Record<string, unknown>>): Promise<void>;
  // Saved (no module changed): the tables take the settings now
  saved(): void;
};

// The settings that are not a module's, by tab and group
const TABS: readonly { readonly id: string; readonly title: string; readonly groups: readonly { readonly title: string; readonly keys: readonly Key[] }[] }[] = [
  {
    id: "general",
    title: "General",
    groups: [
      { title: "Tables", keys: ["metadata", "autoFormat", "maxHeight", "toolbarNames"] },
      { title: "Cell editor", keys: ["enterKey", "selectOnClick", "ctrlEnterAddsRow"] },
      { title: "Cells with Lua expressions", keys: ["expressionsDelay"] },
    ],
  },
];

/** The modules' tabs after General: one per kind the modules declare (MODULE_CATEGORY), in the kinds' order, each module in FEATURE_NAMES' order */
export function moduleTabs(): { id: ModuleCategory; title: string; modules: FeatureName[] }[] {
  return (Object.keys(MODULE_CATEGORIES) as ModuleCategory[])
    .map((id) => ({ id, title: MODULE_CATEGORIES[id], modules: FEATURE_NAMES.filter((name) => MODULE_CATEGORY[name] === id) }))
    .filter((tab) => tab.modules.length > 0);
}

const moduleOf = (key: Key): FeatureName | undefined =>
  /^silverware\.table\.modules\.([^.]+)\./.exec(SETTINGS[key].path)?.[1] as FeatureName | undefined;
const enabledPath = (name: FeatureName) => `silverware.table.modules.${name}.enabled`;

/** Every setting the dialog shows: those of its tabs, and the modules' (a test checks none is left out) */
export function dialogKeys(): Key[] {
  return [...TABS.flatMap((tab) => tab.groups.flatMap((group) => group.keys)), ...(Object.keys(SETTINGS) as Key[]).filter((key) => moduleOf(key))];
}

export class SettingsDialog {
  private readonly initial = new Map<string, unknown>();
  private readonly values = new Map<string, unknown>();
  // Number fields whose text is no valid value: Save waits for them
  private readonly invalid = new Set<string>();
  private readonly dialogs: Dialogs;
  private dialog: Dialog | undefined;
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;
  private readonly moduleSettings = new Map<FeatureName, HTMLElement>();
  private saving = false;

  constructor(private readonly context: SettingsContext) {
    this.dialogs = new Dialogs(context.doc, { base: BASE, backdropClass: UI_CLASS, closeIcon: ICONS.clear });
  }

  get isOpen(): boolean {
    return this.dialogs.isOpen;
  }

  /** Whether a node is the dialog's (its keys are not the tables') */
  contains(node: Node): boolean {
    return this.dialogs.contains(node);
  }

  /** Reads the settings as configured now and shows them */
  async open(): Promise<void> {
    if (this.isOpen) return;
    const { bridge } = this.context;
    const read = async (path: string, fallback: unknown) => {
      try {
        return (await bridge.getConfig?.(path, fallback)) ?? fallback;
      } catch {
        return fallback;
      }
    };
    for (const key of Object.keys(SETTINGS) as Key[]) {
      const setting = SETTINGS[key];
      const value = (setting.parse as (v: unknown) => unknown)(await read(setting.path, setting.default)) ?? setting.default;
      this.initial.set(setting.path, value);
    }
    for (const name of FEATURE_NAMES) {
      const value = await read(enabledPath(name), moduleOnByDefault(name));
      this.initial.set(enabledPath(name), typeof value === "boolean" ? value : moduleOnByDefault(name));
    }
    for (const [path, value] of this.initial) this.values.set(path, value);
    this.render();
  }

  close(): void {
    this.dialog?.close();
    this.dialog = undefined;
  }

  /** Esc, × or a press beside it: whether it closes, after asking where changes would be lost */
  private async dismiss(): Promise<boolean> {
    if (this.saving) return false;
    if (this.changed().length === 0) return true;
    const { bridge } = this.context;
    const question = "Close the Silverware Table settings without saving your changes?";
    return bridge.confirm ? await bridge.confirm(question) : this.context.doc.defaultView!.confirm(question);
  }

  // ---- the dialog --------------------------------------------------------------

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const e = this.context.doc.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  private render(): void {
    const { doc } = this.context;
    const el = this.el.bind(this);
    // Tabs: the settings, then the modules by kind
    const list: { id: string; title: string; panel: HTMLElement }[] = [];
    for (const tab of TABS) {
      const panel = el("div");
      for (const group of tab.groups) {
        if (group.title) panel.append(el("h3", `${BASE}-group`, group.title));
        const card = el("div", `${BASE}-card`);
        for (const key of group.keys) card.append(this.row(key));
        panel.append(card);
      }
      list.push({ id: tab.id, title: tab.title, panel });
    }
    for (const tab of moduleTabs()) {
      const panel = el("div");
      const card = el("div", `${BASE}-card`);
      for (const name of tab.modules) card.append(this.moduleRow(name));
      panel.append(card);
      list.push({ id: tab.id, title: tab.title, panel });
    }
    const { bar, panels } = tabs(doc, BASE, "swt", list);
    const content = doc.createDocumentFragment();
    content.append(...panels);

    const footer = doc.createDocumentFragment();
    const note = el("div", `${BASE}-note`);
    this.note = note;
    const cancel = el("button", `${BASE}-cancel`, "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => {
      if (!this.saving) this.close();
    });
    const save = el("button", `${BASE}-save`, "Save");
    save.type = "button";
    save.addEventListener("click", () => void this.save());
    this.saveButton = save;
    footer.append(note, cancel, save);

    // The dialog takes the focus (no control marked), Tab goes on from there
    this.dialog = this.dialogs.open({
      title: "Silverware Table settings",
      subtitle: "For every table in the space: SilverBullet's configuration",
      bar,
      content,
      footer,
      dismiss: () => this.dismiss(),
    });
    this.update();
  }

  /** A setting's row: its name left, its control right (a switch, a choice, a number) */
  private row(key: Key): HTMLElement {
    const setting = SETTINGS[key];
    const row = settingRow(this.context.doc, BASE, setting.label, (setting as { hint?: string }).hint, this.control(key));
    row.dataset.swtSetting = setting.path;
    return row;
  }

  /** A setting's control: a switch, a choice or a number */
  private control(key: Key): HTMLElement {
    const setting = SETTINGS[key];
    const value = this.values.get(setting.path);
    if (typeof setting.default === "boolean") return switchControl(this.context.doc, BASE, value === true, (on) => this.change(setting.path, on));
    const choices = settingChoices(key, this.context.doc, value);
    if (choices.length) {
      const select = this.el("select");
      for (const choice of choices) select.append(new Option(choice.label, choice.value, false, choice.value === value));
      select.addEventListener("change", () => this.change(setting.path, select.value));
      return select;
    }
    const input = this.el("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = String(value);
    input.addEventListener("input", () => {
      const parsed = (setting.parse as (v: unknown) => unknown)(input.value.trim() === "" ? undefined : Number(input.value));
      input.classList.toggle(`${BASE}-invalid`, parsed === undefined);
      if (parsed === undefined) this.invalid.add(setting.path);
      else {
        this.invalid.delete(setting.path);
        this.values.set(setting.path, parsed);
      }
      this.update();
    });
    return input;
  }

  /** A module's row: its name and what it does, its switch; its own settings under it while it is on */
  private moduleRow(name: FeatureName): HTMLElement {
    const block = this.el("div", `${BASE}-module`);
    const toggle = switchControl(this.context.doc, BASE, this.values.get(enabledPath(name)) === true, (on) => this.change(enabledPath(name), on));
    toggle.querySelector("input")!.dataset.swtModule = name;
    block.append(settingRow(this.context.doc, BASE, MODULE_LABELS[name], MODULE_DESCRIPTIONS[name], toggle));
    const keys = (Object.keys(SETTINGS) as Key[]).filter((key) => moduleOf(key) === name);
    if (keys.length > 0) {
      const own = this.el("div", `${BASE}-module-settings`);
      for (const key of keys) own.append(this.row(key));
      block.append(own);
      this.moduleSettings.set(name, own);
    }
    return block;
  }

  private change(path: string, value: unknown): void {
    this.values.set(path, value);
    this.update();
  }

  /** What Save does and whether it can, the note, the modules' settings */
  private update(): void {
    const changed = this.changed();
    const modules = this.modulesChanged();
    const save = this.saveButton;
    if (save) {
      save.textContent = this.saving ? "Saving…" : modules ? "Save and reload" : "Save";
      save.disabled = this.saving || !this.context.canSave || changed.length === 0 || this.invalid.size > 0;
      save.title = this.context.canSave ? "" : "Settings cannot be saved here";
    }
    if (this.note) {
      this.note.textContent = !this.context.canSave
        ? "Settings cannot be saved here."
        : this.invalid.size > 0
          ? "A number is not valid."
          : modules
            ? "Modules apply once the page reloads."
            : "";
    }
    // A module's own settings show while it is on
    for (const [name, own] of this.moduleSettings) own.hidden = this.values.get(enabledPath(name)) !== true;
    for (const input of Array.from(this.dialog?.element.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select") ?? [])) {
      input.disabled = this.saving;
    }
  }

  private changed(): string[] {
    return Array.from(this.values).filter(([path, value]) => this.initial.get(path) !== value).map(([path]) => path);
  }

  private modulesChanged(): boolean {
    return FEATURE_NAMES.some((name) => this.values.get(enabledPath(name)) !== this.initial.get(enabledPath(name)));
  }

  /**
   * Saves what changed, then closes; reloads for modules. Each value is written
   * as it is, its default too: the value shown may come from elsewhere (a part
   * set in one go, another block), which the managed block, coming last, overrides.
   */
  private async save(): Promise<void> {
    const changed = this.changed();
    if (this.saving || !this.context.canSave || changed.length === 0 || this.invalid.size > 0) return;
    const values: Record<string, unknown> = {};
    for (const path of changed) values[path] = this.values.get(path);
    const reload = this.modulesChanged();
    this.saving = true;
    this.update();
    try {
      await this.context.save(values);
    } catch (e) {
      this.saving = false;
      void this.context.bridge.flash(`Silverware Table: the settings could not be saved (${String(e)})`, "error");
      this.update();
      return;
    }
    this.saving = false;
    this.close();
    if (reload) {
      if (this.context.bridge.reloadUI) await this.context.bridge.reloadUI();
      else this.context.doc.defaultView?.location.reload();
      return;
    }
    this.context.saved();
  }
}
