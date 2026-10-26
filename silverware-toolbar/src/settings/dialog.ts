// The settings dialog: the command "Silverware Toolbar: Settings" and the last
// item of the popup of every action. Tabs General (the key), Favorites (the
// toolbar's rows: items dragged within a row or into another, Alt+arrows with
// the keyboard; an action shown as its icon or with its label; removed; added
// from a search of every action, or a separator), Modules (each one's switch).
// It reads the configuration when it opens and writes nothing until Save; a
// module or the key changed: Save and reload (modules are created and the
// command defined when the toolbar starts). The shared dialog, tabs and
// controls (shared/), in the table's settings' look (classes `swb-settings-*`).
import { settingRow, switchControl } from "../../../shared/controls.ts";
import { type Dialog, Dialogs } from "../../../shared/dialog.ts";
import { tabs } from "../../../shared/tabs.ts";
import { type Bridge, DEFAULT_SHORTCUT, MODULE_DESCRIPTIONS, MODULE_LABELS, MODULE_NAMES, type ModuleName, PATHS, type Placement, PLACEMENT_LABELS, PLACEMENTS, readSettings, readShortcut, type Show, SHOW_LABELS, SHOWS } from "../bridge.ts";
import type { Action } from "../core/action.ts";
import type { FavoriteItem, Favorites } from "../core/favorites.ts";
import { type Entry, findEntries } from "../core/search.ts";
import { ICONS } from "../icons.ts";
import { addItem, type At, moveItem, removeItem, sameRows, savedRows, stepOf, toggleShow } from "./favorites.ts";

const BASE = "swb-settings";

// SilverBullet's command turning its keyboard bar on or off on this device (plugs/editor/editor.plug.yaml)
const KEYBOARD_BAR_COMMAND = "Editor: Toggle Keyboard Bar";

export type SettingsContext = {
  readonly doc: Document;
  readonly bridge: Bridge;
  // Every action offered now (the modules turned on, the custom ones)
  readonly actions: () => readonly Action[];
  // Whether the settings can be saved here (else the dialog only shows them)
  readonly canSave: boolean;
  // Saves settings by path (undefined removes one)
  save(values: Readonly<Record<string, unknown>>): Promise<void>;
  // Saved, nothing to reload for: the toolbar takes the settings now
  saved(): void;
};

type Values = { shortcut: string; placement: Placement; show: Show; favorites: Favorites; modules: Record<ModuleName, boolean> };

export class SettingsDialog {
  private readonly dialogs: Dialogs;
  private dialog: Dialog | undefined;
  private initial: Values | undefined;
  private values: Values | undefined;
  private saving = false;
  private favoritesPanel: HTMLElement | undefined;
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;
  // The row whose search of actions to add is open
  private adding: number | undefined;
  // SilverBullet's keyboard bar on, on a touch screen: the docked toolbar goes over it, its turning off offered
  private keyboardBar = false;
  // An item dragged by the pointer: where it is, where it would go
  private drag: { readonly from: At; readonly pointer: number; to: At | undefined; moved: boolean } | undefined;

  constructor(private readonly context: SettingsContext) {
    this.dialogs = new Dialogs(context.doc, { base: BASE, closeIcon: ICONS.close });
  }

  get isOpen(): boolean {
    return this.dialogs.isOpen;
  }

  /** Reads the settings as configured now and shows them */
  async open(): Promise<void> {
    if (this.isOpen) return;
    const { bridge } = this.context;
    const settings = await readSettings(bridge);
    const modules = Object.fromEntries(MODULE_NAMES.map((name) => [name, settings.modules.has(name)])) as Record<ModuleName, boolean>;
    this.initial = { shortcut: await readShortcut(bridge), placement: settings.placement, show: settings.show, favorites: settings.favorites, modules };
    this.keyboardBar = await this.keyboardBarOn();
    this.values = { ...this.initial, favorites: settings.favorites.map((row) => [...row]), modules: { ...modules } };
    this.render();
  }

  close(): void {
    this.dialog?.close();
    this.dialog = undefined;
  }

  /** Esc, × or a press beside it: whether it closes, after asking where changes would be lost */
  private async dismiss(): Promise<boolean> {
    if (this.saving) return false;
    if (!Object.keys(this.changed()).length) return true;
    const question = "Close the Silverware Toolbar settings without saving your changes?";
    const { bridge, doc } = this.context;
    return bridge.confirm ? await bridge.confirm(question) : doc.defaultView!.confirm(question);
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const e = this.context.doc.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  private button(className: string, label: string, run: () => void, html?: string): HTMLButtonElement {
    const button = this.el("button", className);
    button.type = "button";
    if (html) {
      button.innerHTML = html;
      button.title = label;
      button.setAttribute("aria-label", label);
    } else button.textContent = label;
    button.addEventListener("click", (e) => {
      e.preventDefault();
      run();
    });
    return button;
  }

  private render(): void {
    const { doc } = this.context;
    const values = this.values!;

    const general = this.el("div");
    const card = this.el("div", `${BASE}-card`);
    const key = this.el("input", `${BASE}-key`);
    key.type = "text";
    key.value = values.shortcut;
    key.spellcheck = false;
    key.placeholder = DEFAULT_SHORTCUT;
    key.addEventListener("input", () => {
      values.shortcut = key.value.trim();
      this.update();
    });
    const keyRow = settingRow(doc, BASE, "Key for every action", "As SilverBullet writes keys (Ctrl-Shift-q, Alt-k); with nothing selected it shows the toolbar at the cursor. Applies after a reload.", key);
    keyRow.dataset.swbSetting = PATHS.shortcut;
    const placement = this.el("select");
    for (const value of PLACEMENTS) placement.append(new Option(PLACEMENT_LABELS[value], value, false, value === values.placement));
    placement.addEventListener("change", () => {
      values.placement = placement.value as Placement;
      this.update();
    });
    const placementRow = settingRow(doc, BASE, "Where the toolbar shows", "On a phone the system's menu of a selection (Cut, Copy, Paste) is where the toolbar would show by it: docked at the bottom, it is one row over the keyboard.", placement);
    placementRow.dataset.swbSetting = PATHS.placement;
    const show = this.el("select");
    for (const value of SHOWS) show.append(new Option(SHOW_LABELS[value], value, false, value === values.show));
    show.addEventListener("change", () => {
      values.show = show.value as Show;
      this.update();
    });
    const showRow = settingRow(doc, BASE, "When the toolbar shows", "Always: while you write, with nothing selected too (docked at the bottom, or by the cursor), its buttons the formats around the cursor.", show);
    showRow.dataset.swbSetting = PATHS.show;
    card.append(keyRow, placementRow, showRow);
    general.append(card);
    if (this.keyboardBar) general.append(this.keyboardBarNote());

    this.favoritesPanel = this.el("div");
    this.drawFavorites();

    const modules = this.el("div");
    const moduleCard = this.el("div", `${BASE}-card`);
    for (const name of MODULE_NAMES) {
      const toggle = switchControl(doc, BASE, values.modules[name], (on) => {
        values.modules[name] = on;
        this.update();
      });
      toggle.querySelector("input")!.dataset.swbModule = name;
      moduleCard.append(settingRow(doc, BASE, MODULE_LABELS[name], MODULE_DESCRIPTIONS[name], toggle));
    }
    modules.append(moduleCard);

    const { bar, panels } = tabs(doc, BASE, "swb", [
      { id: "general", title: "General", panel: general },
      { id: "favorites", title: "Favorites", panel: this.favoritesPanel },
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
      title: "Silverware Toolbar settings",
      subtitle: "For every page in the space: SilverBullet's configuration",
      bar,
      content,
      footer,
      dismiss: () => this.dismiss(),
    });
    this.update();
  }

  /** Whether SilverBullet's keyboard bar is on, on a touch screen (its UI option; a release without it: off) */
  private async keyboardBarOn(): Promise<boolean> {
    const { bridge, doc } = this.context;
    if (!bridge.getUiOption || !doc.defaultView?.matchMedia?.("(pointer: coarse)").matches) return false;
    try {
      return (await bridge.getUiOption("keyboardBar")) === true;
    } catch {
      return false;
    }
  }

  /** SilverBullet's keyboard bar is on: one bar over the keyboard is enough, its turning off offered (on this device, at once: its own command) */
  private keyboardBarNote(): HTMLElement {
    const { bridge, doc } = this.context;
    const card = this.el("div", `${BASE}-card ${BASE}-advice`);
    const hint = "It shows over the keyboard too: the docked toolbar goes over it. Turned off here, on this device, at once (SilverBullet's command Editor: Toggle Keyboard Bar turns it on again).";
    const control = bridge.invokeCommand
      ? this.button(`${BASE}-advice-button`, "Turn it off", () => {
          void (async () => {
            try {
              await bridge.invokeCommand!(KEYBOARD_BAR_COMMAND);
              this.keyboardBar = false;
              card.remove();
            } catch (e) {
              void bridge.flash(`Silverware Toolbar: SilverBullet's keyboard bar could not be turned off (${String(e)})`, "error");
            }
          })();
        })
      : this.el("span");
    card.append(settingRow(doc, BASE, "SilverBullet's keyboard bar is on", hint, control));
    return card;
  }

  // ---- Favorites -------------------------------------------------------------

  /** Every action and every list's choice, by id (the popup's search finds them the same way) */
  private known(): Map<string, Action> {
    const known = new Map<string, Action>();
    for (const action of this.context.actions()) {
      known.set(action.id, action);
      for (const choice of action.choices ?? []) known.set(choice.id, choice);
    }
    return known;
  }

  /** The Favorites tab drawn anew from the values; `focus`: the element to focus after it (a selector) */
  private drawFavorites(focus?: string): void {
    const panel = this.favoritesPanel;
    const values = this.values;
    if (!panel || !values) return;
    const known = this.known();
    const parts: HTMLElement[] = [this.el("p", `${BASE}-intro`, "The toolbar's rows, one under another. Drag an item within its row or into another (Alt+arrows with the keyboard); a row left empty is left out.")];
    values.favorites.forEach((row, r) => {
      const block = this.el("div", `${BASE}-favrow`);
      block.dataset.swbRow = String(r);
      block.append(this.el("div", `${BASE}-favhead`, `Row ${r + 1}`));
      const items = this.el("div", `${BASE}-items`);
      items.setAttribute("role", "list");
      items.dataset.swbItems = String(r);
      row.forEach((item, i) => items.append(this.itemElement(item, { row: r, index: i }, known)));
      if (!row.length) items.append(this.el("span", `${BASE}-empty`, "Empty"));
      block.append(items, this.button(`${BASE}-add`, "Add", () => this.openAdding(r)));
      if (this.adding === r) block.append(this.picker(r));
      parts.push(block);
    });
    parts.push(
      this.button(`${BASE}-add-row`, "Add row", () => {
        values.favorites = [...values.favorites, []];
        this.adding = values.favorites.length - 1;
        this.changedFavorites(`[data-swb-row="${this.adding}"] .${BASE}-pick-field`);
      }),
    );
    panel.replaceChildren(...parts);
    if (focus) panel.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  }

  private itemElement(item: FavoriteItem, at: At, known: Map<string, Action>): HTMLElement {
    const element = this.el("div", `${BASE}-item`);
    element.setAttribute("role", "listitem");
    element.tabIndex = 0;
    element.dataset.swbItem = `${at.row}:${at.index}`;
    const icon = this.el("span", `${BASE}-item-icon`);
    const name = this.el("span", `${BASE}-item-name`);
    if (item.type === "separator") {
      element.classList.add(`${BASE}-separator`);
      name.textContent = "Separator";
      element.append(icon, name);
    } else {
      const action = known.get(item.id);
      icon.innerHTML = action?.icon ?? "";
      name.textContent = action?.label ?? item.id;
      element.append(icon, name);
      if (!action) {
        element.classList.add(`${BASE}-unknown`);
        element.title = `No action has the id ${item.id} (its module is off, or it is not defined): the toolbar leaves it out`;
      }
      const labeled = item.show === "label";
      const show = this.button(`${BASE}-show`, labeled ? "Shown with its label: show its icon only" : "Shown as its icon: show its label too", () => this.edit(toggleShow(this.values!.favorites, at), `[data-swb-item="${at.row}:${at.index}"] .${BASE}-show`), labeled ? ICONS.label : ICONS.iconOnly);
      show.setAttribute("aria-pressed", String(labeled));
      element.append(show);
    }
    element.setAttribute("aria-label", `${name.textContent}, row ${at.row + 1}, item ${at.index + 1}`);
    element.append(this.button(`${BASE}-remove`, `Remove ${name.textContent}`, () => this.edit(removeItem(this.values!.favorites, at), `[data-swb-row="${at.row}"] .${BASE}-add`), ICONS.close));
    element.addEventListener("keydown", (e) => {
      if (e.target !== element) return;
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const to = stepOf(this.values!.favorites, at, e.key);
        if (to) this.edit(moveItem(this.values!.favorites, at, to), `[data-swb-item="${to.row}:${to.index}"]`);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        this.edit(removeItem(this.values!.favorites, at), `[data-swb-row="${at.row}"] .${BASE}-add`);
      }
    });
    element.addEventListener("pointerdown", (e) => this.dragStart(e, at, element));
    return element;
  }

  private edit(favorites: Favorites, focus?: string): void {
    this.values!.favorites = favorites;
    this.changedFavorites(focus);
  }

  private changedFavorites(focus?: string): void {
    this.drawFavorites(focus);
    this.update();
  }

  private openAdding(row: number): void {
    this.adding = this.adding === row ? undefined : row;
    this.drawFavorites(this.adding === row ? `[data-swb-row="${row}"] .${BASE}-pick-field` : `[data-swb-row="${row}"] .${BASE}-add`);
  }

  /** The search of what to add to a row: a separator, and every action and choice, found by words typed */
  private picker(row: number): HTMLElement {
    const picker = this.el("div", `${BASE}-picker`);
    const field = this.el("input", `${BASE}-pick-field`);
    field.type = "text";
    field.placeholder = "Search actions";
    field.setAttribute("aria-label", "Search actions to add");
    field.spellcheck = false;
    field.autocomplete = "off";
    const list = this.el("div", `${BASE}-pick-list`);
    list.setAttribute("role", "listbox");
    const entries: Entry[] = [];
    for (const action of this.context.actions()) {
      if (!action.choices) entries.push({ action, group: action.group });
      else entries.push({ action, group: action.group }, ...action.choices.map((choice) => ({ action: choice, group: action.label })));
    }
    const add = (item: FavoriteItem) => {
      this.adding = undefined;
      this.edit(addItem(this.values!.favorites, row, item), `[data-swb-row="${row}"] .${BASE}-add`);
    };
    let shown: (() => void)[] = [];
    const draw = () => {
      const found = findEntries(entries, field.value);
      const separator = !field.value.trim() || "separator".startsWith(field.value.trim().toLowerCase());
      shown = [...(separator ? [() => add({ type: "separator" })] : []), ...found.map((entry) => () => add({ id: entry.action.id }))];
      const options = [
        ...(separator ? [this.option(`${BASE}-pick-separator`, "", "Separator", "", () => add({ type: "separator" }))] : []),
        ...found.map((entry) => this.option("", entry.action.icon, entry.action.label, entry.group, () => add({ id: entry.action.id }))),
      ];
      list.replaceChildren(...(options.length ? options : [this.el("div", `${BASE}-pick-none`, "No action found")]));
    };
    field.addEventListener("input", draw);
    field.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        // The search's, not the dialog's
        e.stopPropagation();
        e.preventDefault();
        this.openAdding(row);
      } else if (e.key === "Enter") {
        e.preventDefault();
        shown[0]?.();
      }
    });
    draw();
    picker.append(field, list);
    return picker;
  }

  private option(className: string, icon: string, label: string, group: string, run: () => void): HTMLElement {
    const option = this.button(`${BASE}-pick${className ? ` ${className}` : ""}`, label, run);
    option.setAttribute("role", "option");
    option.innerHTML = `<span class="${BASE}-item-icon">${icon}</span><span class="${BASE}-pick-label"></span><span class="${BASE}-pick-group"></span>`;
    option.querySelector(`.${BASE}-pick-label`)!.textContent = label;
    option.querySelector(`.${BASE}-pick-group`)!.textContent = group;
    return option;
  }

  // ---- Dragging an item --------------------------------------------------------

  private dragStart(e: PointerEvent, from: At, element: HTMLElement): void {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest("button"))) return;
    this.drag = { from, pointer: e.pointerId, to: undefined, moved: false };
    element.setPointerCapture?.(e.pointerId);
    const move = (m: PointerEvent) => this.dragMove(m, element);
    const end = (u: PointerEvent) => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
      this.dragEnd(u.type === "pointerup");
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
  }

  /** Where the item would go: before or after the item under the pointer (by its middle), else at the end of the row under it */
  private dragMove(e: PointerEvent, element: HTMLElement): void {
    const drag = this.drag;
    const panel = this.favoritesPanel;
    if (!drag || !panel) return;
    drag.moved = true;
    element.classList.add(`${BASE}-dragged`);
    panel.querySelectorAll(`.${BASE}-drop-before, .${BASE}-drop-after, .${BASE}-drop-end`).forEach((d) => d.classList.remove(`${BASE}-drop-before`, `${BASE}-drop-after`, `${BASE}-drop-end`));
    const under = this.context.doc.elementsFromPoint?.(e.clientX, e.clientY) ?? [];
    const item = under.map((u) => u.closest<HTMLElement>(`.${BASE}-item`)).find((u) => u && u !== element);
    const row = under.map((u) => u.closest<HTMLElement>(`.${BASE}-favrow`)).find(Boolean);
    drag.to = undefined;
    if (item) {
      const [r, i] = item.dataset.swbItem!.split(":").map(Number) as [number, number];
      const box = item.getBoundingClientRect();
      const after = e.clientX > box.left + box.width / 2;
      item.classList.add(after ? `${BASE}-drop-after` : `${BASE}-drop-before`);
      let index = i + (after ? 1 : 0);
      // Its place counted without it, in its own row
      if (r === drag.from.row && index > drag.from.index) index--;
      drag.to = { row: r, index };
    } else if (row) {
      const r = Number(row.dataset.swbRow);
      row.querySelector(`.${BASE}-items`)?.classList.add(`${BASE}-drop-end`);
      drag.to = { row: r, index: this.values!.favorites[r]!.length - (r === drag.from.row ? 1 : 0) };
    }
  }

  private dragEnd(dropped: boolean): void {
    const drag = this.drag;
    this.drag = undefined;
    if (!drag) return;
    const to = drag.to;
    if (dropped && drag.moved && to && (to.row !== drag.from.row || to.index !== drag.from.index)) {
      this.edit(moveItem(this.values!.favorites, drag.from, to), `[data-swb-item="${to.row}:${to.index}"]`);
    } else this.drawFavorites(drag.moved ? undefined : `[data-swb-item="${drag.from.row}:${drag.from.index}"]`);
  }

  // ---- Saving ------------------------------------------------------------------

  /** What changed, by path, each value as it is to be written */
  private changed(): Record<string, unknown> {
    const initial = this.initial;
    const values = this.values;
    if (!initial || !values) return {};
    const changed: Record<string, unknown> = {};
    if (values.shortcut !== initial.shortcut) changed[PATHS.shortcut] = values.shortcut;
    if (values.placement !== initial.placement) changed[PATHS.placement] = values.placement;
    if (values.show !== initial.show) changed[PATHS.show] = values.show;
    const favorites = savedRows(values.favorites);
    if (!sameRows(favorites, initial.favorites)) changed[PATHS.favorites] = favorites;
    for (const name of MODULE_NAMES) if (values.modules[name] !== initial.modules[name]) changed[PATHS.module(name)] = values.modules[name];
    return changed;
  }

  /** Whether saving needs the page loaded anew: a module turned on or off, the key (the command's) */
  private reloads(changed: Readonly<Record<string, unknown>>): boolean {
    return Object.keys(changed).some((path) => path !== PATHS.favorites && path !== PATHS.placement && path !== PATHS.show);
  }

  private update(): void {
    const changed = this.changed();
    const reload = this.reloads(changed);
    const invalid = !this.values?.shortcut;
    const save = this.saveButton;
    if (save) {
      save.textContent = this.saving ? "Saving…" : reload ? "Save and reload" : "Save";
      save.disabled = this.saving || !this.context.canSave || !Object.keys(changed).length || invalid;
      save.title = this.context.canSave ? "" : "Settings cannot be saved here";
    }
    if (this.note) {
      this.note.textContent = !this.context.canSave
        ? "Settings cannot be saved here."
        : invalid
          ? "The key is empty."
          : reload
            ? "Modules and the key apply once the page reloads."
            : "";
    }
  }

  /** Saves what changed, then closes; reloads where modules or the key changed */
  private async save(): Promise<void> {
    const changed = this.changed();
    if (this.saving || !this.context.canSave || !Object.keys(changed).length || !this.values?.shortcut) return;
    const reload = this.reloads(changed);
    this.saving = true;
    this.update();
    try {
      await this.context.save(changed);
    } catch (e) {
      this.saving = false;
      void this.context.bridge.flash(`Silverware Toolbar: the settings could not be saved (${String(e)})`, "error");
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
