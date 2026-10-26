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
import { type FavoriteItem, type Favorites, isKindItem, isSeparator, type KindItem } from "../core/favorites.ts";
import type { ItemKind, ItemSlot } from "../core/items.ts";
import { type Entry, findEntries } from "../core/search.ts";
import { ICONS } from "../icons.ts";
import { reorder } from "./drag.ts";
import { addItem, type At, moveItem, moveRow, removeItem, sameRows, savedRows, setSlot, stepOf, toggleShow } from "./favorites.ts";

const BASE = "swb-settings";

// SilverBullet's command turning its keyboard bar on or off on this device (plugs/editor/editor.plug.yaml)
const KEYBOARD_BAR_COMMAND = "Editor: Toggle Keyboard Bar";

export type SettingsContext = {
  readonly doc: Document;
  readonly bridge: Bridge;
  // Every action offered now (the modules turned on, the custom ones)
  readonly actions: () => readonly Action[];
  // The kinds of favourites the modules turned on give (core/items.ts)
  readonly kinds: () => readonly ItemKind[];
  // Whether the settings can be saved here (else the dialog only shows them)
  readonly canSave: boolean;
  // Saves settings by path (undefined removes one)
  save(values: Readonly<Record<string, unknown>>): Promise<void>;
  // Saved, nothing to reload for: the toolbar takes the settings now
  saved(): void;
};

type Picking = { readonly row: number } | { readonly at: At; readonly key: string };

type Values = { shortcut: string; placement: Placement; show: Show; wordAtCaret: boolean; favorites: Favorites; modules: Record<ModuleName, boolean> };

export class SettingsDialog {
  private readonly dialogs: Dialogs;
  private dialog: Dialog | undefined;
  private initial: Values | undefined;
  private values: Values | undefined;
  private saving = false;
  private favoritesPanel: HTMLElement | undefined;
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;
  // The search of actions open: to add to a row, or for a slot of a kind's item
  private picking: Picking | undefined;
  // SilverBullet's keyboard bar on, on a touch screen: the docked toolbar goes over it, its turning off offered
  private keyboardBar = false;

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
    this.initial = { shortcut: await readShortcut(bridge), placement: settings.placement, show: settings.show, wordAtCaret: settings.wordAtCaret, favorites: settings.favorites, modules };
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
    const placementRow = settingRow(doc, BASE, "Where the toolbar shows", "Automatic: docked at the bottom, one row over the keyboard, when you select by touch (a phone's own menu of the selection, Cut, Copy, Paste, is by it); else by the selection.", placement);
    placementRow.dataset.swbSetting = PATHS.placement;
    const show = this.el("select");
    for (const value of SHOWS) show.append(new Option(SHOW_LABELS[value], value, false, value === values.show));
    show.addEventListener("change", () => {
      values.show = show.value as Show;
      this.update();
    });
    const showRow = settingRow(doc, BASE, "When the toolbar shows", "Always: while you write, with nothing selected too (docked at the bottom, or by the cursor), its buttons the formats around the cursor. Always on a phone: so where it is docked, else after selecting text.", show);
    showRow.dataset.swbSetting = PATHS.show;
    const word = switchControl(doc, BASE, values.wordAtCaret, (on) => {
      values.wordAtCaret = on;
      this.update();
    });
    const wordRow = settingRow(doc, BASE, "A word at the cursor as if selected", "With nothing selected, Bold (any inline format) and Clear formatting work on the word the cursor is in or touches: what spaces separate, its punctuation with it. The cursor stays where it was.", word);
    wordRow.dataset.swbSetting = PATHS.wordAtCaret;
    card.append(keyRow, placementRow, showRow, wordRow);
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
    const parts: HTMLElement[] = [
      this.el("p", `${BASE}-intro`, "The toolbar's rows, one under another. Drag an item within its row or into another (Alt+arrows with the keyboard), a row by its handle (Alt+↑ ↓ on it); a row left empty is left out."),
    ];
    const rows = this.el("div", `${BASE}-rows`);
    values.favorites.forEach((row, r) => {
      const block = this.el("div", `${BASE}-favrow`);
      block.dataset.swbRow = String(r);
      const head = this.el("div", `${BASE}-favhead`);
      head.append(this.rowGrip(r, block, rows), this.el("span", "", `Row ${r + 1}`));
      block.append(head);
      const items = this.el("div", `${BASE}-items`);
      items.setAttribute("role", "list");
      items.dataset.swbItems = String(r);
      row.forEach((item, i) => items.append(this.itemElement(item, { row: r, index: i }, known)));
      if (!row.length) items.append(this.el("span", `${BASE}-empty`, "Empty"));
      const picking = this.picking;
      const open = !!picking && "row" in picking && picking.row === r;
      const add = this.button(`${BASE}-add`, open ? "Close" : "Add", () => this.openPicking({ row: r }));
      add.setAttribute("aria-expanded", String(open));
      block.append(items, add);
      if (picking && ("row" in picking ? picking.row : picking.at.row) === r) block.append(this.picker(picking));
      rows.append(block);
    });
    parts.push(rows);
    parts.push(
      this.button(`${BASE}-add-row`, "Add row", () => {
        values.favorites = [...values.favorites, []];
        this.picking = { row: values.favorites.length - 1 };
        this.changedFavorites(`[data-swb-row="${values.favorites.length - 1}"] .${BASE}-pick-field`);
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
    if (isSeparator(item)) {
      element.classList.add(`${BASE}-separator`);
      name.textContent = "Separator";
      element.append(icon, name);
    } else {
      if (isKindItem(item)) {
        // A kind's: its slots, each an action picked (the dialog knows nothing of what they are for)
        const kind = this.context.kinds().find((k) => k.type === item.type);
        icon.innerHTML = kind?.icon ?? "";
        name.textContent = kind?.label ?? item.type;
        element.append(icon, name);
        if (!kind) {
          element.classList.add(`${BASE}-unknown`);
          element.title = `No module turned on gives the kind ${item.type}: the toolbar leaves it out`;
        } else element.append(...kind.slots.map((slot) => this.slotButton(item, at, slot, known)));
      } else {
        const action = known.get(item.id);
        icon.innerHTML = action?.icon ?? "";
        name.textContent = action?.label ?? item.id;
        element.append(icon, name);
        if (!action) {
          element.classList.add(`${BASE}-unknown`);
          element.title = `No action has the id ${item.id} (its module is off, or it is not defined): the toolbar leaves it out`;
        }
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
    element.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || (e.target instanceof Element && e.target.closest("button"))) return;
      const panel = this.favoritesPanel!;
      reorder(e, {
        element,
        base: BASE,
        layer: this.dialog?.element,
        flow: "inline",
        containers: () => Array.from(panel.querySelectorAll<HTMLElement>(`.${BASE}-items`)),
        items: (container) => Array.from(container.querySelectorAll<HTMLElement>(`:scope > .${BASE}-item`)),
        done: (to) => {
          if (to && (to.container !== at.row || to.index !== at.index)) this.edit(moveItem(this.values!.favorites, at, { row: to.container, index: to.index }), `[data-swb-item="${to.container}:${to.index}"]`);
          else this.drawFavorites();
        },
      });
    });
    return element;
  }

  /** A row's handle: dragged, the row moves up or down (the others sliding aside); Alt+↑ ↓ on it the same */
  private rowGrip(r: number, block: HTMLElement, rows: HTMLElement): HTMLElement {
    const grip = this.button(`${BASE}-row-grip`, `Move row ${r + 1} (drag, or Alt+↑ ↓)`, () => undefined, ICONS.grip);
    grip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      reorder(e, {
        element: block,
        base: BASE,
        layer: this.dialog?.element,
        flow: "block",
        containers: () => [rows],
        items: (container) => Array.from(container.querySelectorAll<HTMLElement>(`:scope > .${BASE}-favrow`)),
        done: (to) => {
          if (to && to.index !== r) this.edit(moveRow(this.values!.favorites, r, to.index), `[data-swb-row="${to.index}"] .${BASE}-row-grip`);
          else this.drawFavorites();
        },
      });
    });
    grip.addEventListener("keydown", (e) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const to = r + (e.key === "ArrowUp" ? -1 : 1);
      if (to >= 0 && to < this.values!.favorites.length) this.edit(moveRow(this.values!.favorites, r, to), `[data-swb-row="${to}"] .${BASE}-row-grip`);
    });
    return grip;
  }

  private edit(favorites: Favorites, focus?: string): void {
    this.values!.favorites = favorites;
    this.changedFavorites(focus);
  }

  private changedFavorites(focus?: string): void {
    this.drawFavorites(focus);
    this.update();
  }

  /** A slot of a kind's item: the action picked for it (none yet: Choose…); a click opens the search for it */
  private slotButton(item: KindItem, at: At, slot: ItemSlot, known: Map<string, Action>): HTMLButtonElement {
    const id = item[slot.key];
    const action = typeof id === "string" ? known.get(id) : undefined;
    const what = action?.label ?? (typeof id === "string" && id ? id : "Choose…");
    const button = this.button(`${BASE}-slot`, `${slot.label}: ${what}`, () => this.openPicking({ at, key: slot.key }));
    button.innerHTML = `<span class="${BASE}-slot-name"></span><span class="${BASE}-item-icon">${action?.icon ?? ""}</span><span class="${BASE}-slot-action"></span>`;
    button.querySelector(`.${BASE}-slot-name`)!.textContent = slot.label;
    button.querySelector(`.${BASE}-slot-action`)!.textContent = what;
    button.setAttribute("aria-label", `${slot.label}: ${what}`);
    button.dataset.swbSlot = slot.key;
    if (!action) button.classList.add(`${BASE}-unknown`);
    const picking = this.picking;
    button.setAttribute("aria-expanded", String(!!picking && "at" in picking && picking.key === slot.key && picking.at.row === at.row && picking.at.index === at.index));
    return button;
  }

  /** The search opened for a row or a slot (open for it already: closed) */
  private openPicking(target: Picking): void {
    const open = !!this.picking && JSON.stringify(this.picking) === JSON.stringify(target);
    this.picking = open ? undefined : target;
    const row = "row" in target ? target.row : target.at.row;
    const back = "row" in target ? `[data-swb-row="${row}"] .${BASE}-add` : `[data-swb-item="${target.at.row}:${target.at.index}"] [data-swb-slot="${target.key}"]`;
    this.drawFavorites(open ? back : `[data-swb-row="${row}"] .${BASE}-pick-field`);
  }

  /** The kind of the item at a place, where a module turned on gives it */
  private kindOf(at: At): ItemKind | undefined {
    const item = this.values?.favorites[at.row]?.[at.index];
    return item && isKindItem(item) ? this.context.kinds().find((k) => k.type === item.type) : undefined;
  }

  /**
   * The search of what to add to a row (a separator, the modules' kinds of
   * items, every action and choice), or of an action for a kind's slot: found
   * by words typed
   */
  private picker(target: Picking): HTMLElement {
    const forRow = "row" in target;
    const row = forRow ? target.row : target.at.row;
    const slot = forRow ? undefined : this.kindOf(target.at)?.slots.find((s) => s.key === target.key);
    const picker = this.el("div", `${BASE}-picker`);
    const field = this.el("input", `${BASE}-pick-field`);
    field.type = "text";
    field.placeholder = slot ? `Search an action for ${slot.label}` : "Search actions";
    field.setAttribute("aria-label", slot ? `Search an action for ${slot.label}` : "Search actions to add");
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
      this.picking = undefined;
      this.edit(addItem(this.values!.favorites, row, item), `[data-swb-row="${row}"] .${BASE}-add`);
    };
    // A kind's item added: the search goes on for its first slot
    const addKind = (kind: ItemKind) => {
      const favorites = addItem(this.values!.favorites, row, { type: kind.type });
      const at = { row, index: favorites[row]!.length - 1 };
      this.picking = kind.slots[0] ? { at, key: kind.slots[0].key } : undefined;
      this.edit(favorites, this.picking ? `[data-swb-row="${row}"] .${BASE}-pick-field` : `[data-swb-item="${at.row}:${at.index}"]`);
    };
    // An action for the slot: the search goes on for the next slot without one
    const fill = (id: string) => {
      if (forRow) return add({ id });
      const favorites = setSlot(this.values!.favorites, target.at, target.key, id);
      const item = favorites[target.at.row]?.[target.at.index];
      const next = item && isKindItem(item) ? this.context.kinds().find((k) => k.type === item.type)?.slots.find((s) => !item[s.key]) : undefined;
      this.picking = next ? { at: target.at, key: next.key } : undefined;
      this.edit(favorites, next ? `[data-swb-row="${row}"] .${BASE}-pick-field` : `[data-swb-item="${target.at.row}:${target.at.index}"] [data-swb-slot="${target.key}"]`);
    };
    let shown: (() => void)[] = [];
    const draw = () => {
      const found = findEntries(entries, field.value);
      const query = field.value.trim().toLowerCase();
      const separator = forRow && (!query || "separator".startsWith(query));
      const kinds = forRow ? this.context.kinds().filter((kind) => wordsStart(kind.label, query)) : [];
      shown = [...(separator ? [() => add({ type: "separator" })] : []), ...kinds.map((kind) => () => addKind(kind)), ...found.map((entry) => () => fill(entry.action.id))];
      const options = [
        ...(separator ? [this.option(`${BASE}-pick-separator`, "", "Separator", "", () => add({ type: "separator" }))] : []),
        ...kinds.map((kind) => this.option(`${BASE}-pick-kind`, kind.icon, kind.label, "Two actions in one", () => addKind(kind))),
        ...found.map((entry) => this.option("", entry.action.icon, entry.action.label, entry.group, () => fill(entry.action.id))),
      ];
      list.replaceChildren(...(options.length ? options : [this.el("div", `${BASE}-pick-none`, "No action found")]));
    };
    field.addEventListener("input", draw);
    field.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        // The search's, not the dialog's
        e.stopPropagation();
        e.preventDefault();
        this.openPicking(target);
      } else if (e.key === "Enter") {
        e.preventDefault();
        shown[0]?.();
      }
    });
    draw();
    const close = this.button(`${BASE}-pick-close`, "Close the search", () => this.openPicking(target), ICONS.close);
    const top = this.el("div", `${BASE}-pick-top`);
    top.append(field, close);
    picker.append(top, list);
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
    if (values.wordAtCaret !== initial.wordAtCaret) changed[PATHS.wordAtCaret] = values.wordAtCaret;
    const favorites = savedRows(values.favorites);
    if (!sameRows(favorites, initial.favorites)) changed[PATHS.favorites] = favorites;
    for (const name of MODULE_NAMES) if (values.modules[name] !== initial.modules[name]) changed[PATHS.module(name)] = values.modules[name];
    return changed;
  }

  /** Whether saving needs the page loaded anew: a module turned on or off, the key (the command's) */
  private reloads(changed: Readonly<Record<string, unknown>>): boolean {
    return Object.keys(changed).some((path) => path !== PATHS.favorites && path !== PATHS.placement && path !== PATHS.show && path !== PATHS.wordAtCaret);
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

/** Whether each word typed starts a word of a label, ignoring case (nothing typed: yes) */
function wordsStart(label: string, query: string): boolean {
  const words = label.toLowerCase().split(/\s+/);
  return query.split(/\s+/).filter(Boolean).every((typed) => words.some((word) => word.startsWith(typed)));
}
