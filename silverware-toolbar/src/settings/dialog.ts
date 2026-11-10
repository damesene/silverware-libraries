// The settings dialog: the command "Silverware Toolbar: Settings" and the last
// item of the popup of every action. Tabs General (the key, the word at the
// cursor), Toolbars (core/toolbars.ts: one edited at a time, named, used for
// Click, Touch, both or neither, where and when it shows, made, duplicated,
// deleted; its rows: items dragged within a row or into another, Alt+arrows
// with the keyboard, a docked one's pinned items in boxes at its rows' ends;
// an action shown as its icon or with its label; removed; added from a search
// of every action, or a separator), Modules (each one's switch).
// It reads the configuration when it opens and writes nothing until Save; a
// module or the key changed: Save and reload (modules are created and the
// command defined when the toolbar starts). The shared dialog, tabs and
// controls (shared/), in the table's settings' look (classes `swb-settings-*`).
import { settingRow, switchControl } from "../../../shared/controls.ts";
import { type Dialog, Dialogs } from "../../../shared/dialog.ts";
import { tabs } from "../../../shared/tabs.ts";
import { type Bridge, DEFAULT_SHORTCUT, MODULE_DESCRIPTIONS, MODULE_LABELS, MODULE_NAMES, type ModuleName, PATHS, readSettings, readShortcut } from "../bridge.ts";
import type { Action } from "../core/action.ts";
import { type FavoriteItem, type Favorites, hasAction, pinOf, isActionItem, isKindItem, isSeparator, type KindItem, MAX_ICON, MAX_WIDTH, MIN_WIDTH, type Pin, type Show as ItemShow, slotItemOf, slotOf, widthOf } from "../core/favorites.ts";
import type { ItemField, ItemKind, ItemSlot } from "../core/items.ts";
import { defaultToolbars, docks, freeToolbarName, type Input, inputOf, MAX_TOOLBARS, type Placement, PLACEMENTS, type ShowWhen, SHOWS, type Toolbar, toolbarFor, useToolbarFor, validateToolbarName } from "../core/toolbars.ts";
import { type Entry, findEntries } from "../core/search.ts";
import { ICONS } from "../icons.ts";
import { SETTINGS_VERSION } from "../migrations/index.ts";
import { reorder } from "../../../shared/drag.ts";
import { addItem, type At, moveItem, moveRow, pinOrdered, placeItem, removeItem, unpinnedOutOfOrder, removeRow, sameRows, savedRows, setLook, setOwn, setPin, setSlot, setSlotField, setSlotOwn, stepOf } from "./favorites.ts";

// A zone of a docked toolbar's row: its items pinned left, the others, those pinned right
type Zone = "left" | "middle" | "right";

const BASE = "swb-settings";

// What the dialog calls the values of a toolbar
const PLACEMENT_LABELS: Readonly<Record<Placement, string>> = { selection: "By the selection", bottom: "Docked at the bottom", top: "Docked at the top" };
const SHOW_LABELS: Readonly<Record<ShowWhen, string>> = { always: "Always", writing: "While writing", selection: "After selecting text" };
const INPUT_LABELS: Readonly<Record<Input, string>> = { click: "Click", touch: "Touch" };

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

type Values = {
  shortcut: string;
  wordAtCaret: boolean;
  // The toolbars, each way of working used by one (core/toolbars.ts)
  toolbars: readonly Toolbar[];
  modules: Record<ModuleName, boolean>;
};

export class SettingsDialog {
  private readonly dialogs: Dialogs;
  private dialog: Dialog | undefined;
  private initial: Values | undefined;
  // What the migrations changed as the settings were read (where the toolbar could not write it back): written with the version
  private migrated: Readonly<Record<string, unknown>> = {};
  private values: Values | undefined;
  private saving = false;
  private toolbarsPanel: HTMLElement | undefined;
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;
  // The search of actions open: to add to a row, or for a slot of a kind's item
  private picking: Picking | undefined;
  // The item whose look is being set (a panel under its row): its icon or label, the label's width
  private adjusting: (At & { readonly key?: string }) | undefined;
  // The toolbar edited, by its index: the one this device uses first
  private toolbarIndex = 0;
  // A name typed for the toolbar edited that cannot be its (said under its field; Save waits for one that can)
  private naming: { readonly toolbar: number; readonly text: string; readonly problem: string } | undefined;
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
    this.migrated = settings.migrated;
    this.initial = { shortcut: await readShortcut(bridge), wordAtCaret: settings.wordAtCaret, toolbars: settings.toolbars, modules };
    // The toolbar this device shows first
    this.toolbarIndex = Math.max(0, settings.toolbars.indexOf(toolbarFor(settings.toolbars, inputOf(this.context.doc.defaultView))));
    this.naming = undefined;
    this.keyboardBar = await this.keyboardBarOn();
    this.values = { ...this.initial, toolbars: settings.toolbars.map((toolbar) => ({ ...toolbar, rows: toolbar.rows.map((row) => [...row]) })), modules: { ...modules } };
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
    return this.ask("Close the Silverware Toolbar settings without saving your changes?");
  }

  /** A question answered yes or no: SilverBullet's confirm, else the browser's */
  private async ask(question: string): Promise<boolean> {
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
    const word = switchControl(doc, BASE, values.wordAtCaret, (on) => {
      values.wordAtCaret = on;
      this.update();
    });
    const wordRow = settingRow(doc, BASE, "A word at the cursor as if selected", "With nothing selected, Bold (any inline format) and Clear formatting work on the word the cursor is in or touches: what spaces separate, without the punctuation at its ends (a period, a comma, quotes). The cursor stays where it was.", word);
    wordRow.dataset.swbSetting = PATHS.wordAtCaret;
    card.append(keyRow, wordRow);
    // SilverBullet's keyboard bar on: said first, as it decides how the docked toolbar looks
    if (this.keyboardBar) general.append(this.keyboardBarNote());
    general.append(card);

    this.toolbarsPanel = this.el("div");
    this.drawToolbars();

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
      { id: "toolbars", title: "Toolbars", panel: this.toolbarsPanel },
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

  /** The toolbar edited */
  private get edited(): Toolbar {
    const toolbars = this.values!.toolbars;
    return toolbars[Math.min(this.toolbarIndex, toolbars.length - 1)]!;
  }

  /** Whether the toolbar edited docks: its rows lines, its pinned items at their ends (by the selection, pins only order a row) */
  private get docked(): boolean {
    return docks(this.edited.placement);
  }

  /** The rows of the toolbar edited, each in the order its pins say (as it shows them): its pinned items at its ends */
  private get rows(): Favorites {
    return pinOrdered(this.edited.rows);
  }

  /**
   * The toolbars changed, the tab drawn anew; `rowsKept`: the rows edited are
   * the same (renamed, its use, where or when changed), so an item's panel
   * or a search open stays
   */
  private setToolbars(toolbars: readonly Toolbar[], focus?: string, rowsKept = false): void {
    this.values!.toolbars = toolbars;
    if (!rowsKept) {
      this.picking = undefined;
      this.adjusting = undefined;
    }
    this.changedToolbars(focus);
  }

  /**
   * The toolbars: one tab each (its name and, small, what shows it; the one
   * edited checked), New toolbar, Reset to defaults (every toolbar, asked
   * first); under them the one edited's card
   */
  private toolbarBar(): HTMLElement {
    const values = this.values!;
    const bar = this.el("div", `${BASE}-toolbars-bar`);
    const top = this.el("div", `${BASE}-toolbars-top`);
    const tabs = this.el("div", `${BASE}-toolbar-tabs`);
    tabs.setAttribute("role", "radiogroup");
    tabs.setAttribute("aria-label", "Toolbars");
    values.toolbars.forEach((toolbar, i) => {
      const button = this.button(`${BASE}-toolbar-tab`, toolbar.name, () => {
        this.toolbarIndex = i;
        this.naming = undefined;
        this.picking = undefined;
        this.adjusting = undefined;
        this.drawToolbars(`.${BASE}-toolbar[data-swb-toolbar="${i}"]`);
      });
      button.dataset.swbToolbar = String(i);
      // What it is used for, small after its name (none: kept to switch to)
      const uses = toolbar.useFor.map((input) => (INPUT_LABELS[input])).join(" · ");
      button.replaceChildren(this.el("span", `${BASE}-toolbar-tab-name`, toolbar.name), ...(uses ? [this.el("span", `${BASE}-toolbar-tab-for`, uses)] : []));
      button.setAttribute("aria-label", uses ? `${toolbar.name}, used for ${uses.replace(" · ", " and ")}` : `${toolbar.name}, not used`);
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(i === this.toolbarIndex));
      tabs.append(button);
    });
    const add = this.button(`${BASE}-toolbar-new`, "+ New toolbar", () => {
      const toolbars = [...values.toolbars, { name: freeToolbarName(values.toolbars, "Toolbar"), useFor: [], placement: "selection" as const, show: "selection" as const, rows: [[]] }];
      this.toolbarIndex = toolbars.length - 1;
      this.setToolbars(toolbars, `.${BASE}-toolbar-name`);
    });
    add.disabled = values.toolbars.length >= MAX_TOOLBARS;
    if (add.disabled) add.title = `${MAX_TOOLBARS} toolbars at most`;
    const reset = this.button(`${BASE}-reset`, "Reset to defaults", () => {
      void (async () => {
        if (!(await this.ask("Put the default toolbars back (Float and Docked), in place of every toolbar?"))) return;
        const toolbars = defaultToolbars(values.modules.gestures);
        this.toolbarIndex = toolbars.indexOf(toolbarFor(toolbars, inputOf(this.context.doc.defaultView)));
        this.naming = undefined;
        this.setToolbars(toolbars.map((toolbar) => ({ ...toolbar, rows: toolbar.rows.map((row) => [...row]) })), `.${BASE}-reset`);
      })();
    });
    const actions = this.el("div", `${BASE}-toolbars-actions`);
    actions.append(reset);
    const toolbars = this.el("div", `${BASE}-toolbar-tabs-line`);
    toolbars.append(tabs, add);
    top.append(toolbars, actions);
    bar.append(top, this.toolbarCard());
    return bar;
  }

  /**
   * The toolbar edited: its name (a field: renamed), what it is used for
   * (Click, Touch: given here, the toolbar showing it before no longer does),
   * where and when it shows, Duplicate, Delete (not the last; one in use asked
   * first, what it was used for going to the first left)
   */
  private toolbarCard(): HTMLElement {
    const values = this.values!;
    const index = Math.min(this.toolbarIndex, values.toolbars.length - 1);
    const toolbar = values.toolbars[index]!;
    const line = this.el("div", `${BASE}-toolbar-line`);
    const naming = this.naming?.toolbar === index ? this.naming : undefined;
    const name = this.el("input", `${BASE}-toolbar-name`);
    name.type = "text";
    name.value = naming?.text ?? toolbar.name;
    name.spellcheck = false;
    name.setAttribute("aria-label", "The toolbar's name");
    const problem = this.el("span", `${BASE}-toolbar-problem`, naming?.problem ?? "");
    problem.setAttribute("role", "status");
    const rename = () => {
      const wrong = validateToolbarName(name.value, values.toolbars, index);
      if (wrong) {
        this.naming = { toolbar: index, text: name.value, problem: wrong };
        problem.textContent = wrong;
        return;
      }
      this.naming = undefined;
      problem.textContent = "";
      if (name.value.trim() === toolbar.name) return;
      this.setToolbars(values.toolbars.map((one, i) => (i === index ? { ...one, name: name.value.trim() } : one)), `.${BASE}-toolbar-name`, true);
    };
    name.addEventListener("change", rename);
    name.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      rename();
    });
    const label = this.el("label", `${BASE}-toolbar-label`);
    label.append(this.el("span", `${BASE}-look-name`, "Name"), name);
    // What it is used for: picked here (the toolbar using it before no longer is); used already: told how to change it
    const uses = this.el("div", `${BASE}-look-shows ${BASE}-toolbar-uses`);
    uses.setAttribute("aria-label", "Used for");
    for (const input of ["click", "touch"] as const) {
      const text = INPUT_LABELS[input];
      const on = toolbar.useFor.includes(input);
      const button = this.button(`${BASE}-look-show ${BASE}-toolbar-use`, text, () => {
        if (!on) this.setToolbars(useToolbarFor(values.toolbars, index, input), `.${BASE}-toolbar-use[data-swb-use="${input}"]`, true);
      });
      button.dataset.swbUse = input;
      button.setAttribute("aria-pressed", String(on));
      button.title = on ? `${text} shows this toolbar: pick another for ${text} to change it` : `Show this toolbar for ${text} (in place of ${toolbarFor(values.toolbars, input).name})`;
      uses.append(button);
    }
    const use = this.el("div", `${BASE}-toolbar-use-line`);
    use.append(this.el("span", `${BASE}-look-name`, "Used for"), uses);
    const duplicate = this.button(`${BASE}-toolbar-duplicate`, "Duplicate", () => {
      const toolbars = [...values.toolbars, { ...toolbar, name: freeToolbarName(values.toolbars, `${toolbar.name} copy`), useFor: [], rows: toolbar.rows.map((row) => [...row]) }];
      this.toolbarIndex = toolbars.length - 1;
      this.setToolbars(toolbars, `.${BASE}-toolbar-name`);
    });
    duplicate.disabled = values.toolbars.length >= MAX_TOOLBARS;
    const remove = this.button(`${BASE}-toolbar-delete`, "Delete", () => {
      void (async () => {
        const used = toolbar.useFor.map((input) => (INPUT_LABELS[input])).join(" and ");
        const question = used ? `Delete the toolbar ${toolbar.name}? ${used} then show ${values.toolbars.find((_, i) => i !== index)!.name}.` : `Delete the toolbar ${toolbar.name}?`;
        if (!(await this.ask(question))) return;
        let toolbars = values.toolbars.filter((_, i) => i !== index);
        for (const input of toolbar.useFor) toolbars = useToolbarFor(toolbars, 0, input);
        this.toolbarIndex = Math.max(0, index - 1);
        this.naming = undefined;
        this.setToolbars(toolbars, `.${BASE}-toolbar[data-swb-toolbar="${this.toolbarIndex}"]`);
      })();
    });
    remove.disabled = values.toolbars.length <= 1;
    if (remove.disabled) remove.title = "One toolbar at least";
    const buttons = this.el("div", `${BASE}-toolbar-buttons`);
    buttons.append(duplicate, remove);
    const head = this.el("div", `${BASE}-toolbar-head`);
    head.append(label, buttons);
    // Where and when it shows (docked: its rows lines, its pinned items at their ends)
    const choice = <T extends string>(key: "placement" | "show", text: string, options: readonly T[], labels: Readonly<Record<T, string>>, value: T) => {
      const select = this.el("select", `${BASE}-toolbar-${key}`);
      for (const option of options) select.append(new Option(labels[option], option, false, option === value));
      select.addEventListener("change", () => {
        // (Docked or not: its rows drawn otherwise, its pinned items in boxes or not; an item's panel open stays)
        this.setToolbars(values.toolbars.map((one, i) => (i === index ? { ...one, [key]: select.value } : one)), `.${BASE}-toolbar-${key}`, true);
      });
      const field = this.el("label", `${BASE}-toolbar-choice`);
      field.append(this.el("span", `${BASE}-look-name`, text), select);
      return field;
    };
    const shows = this.el("div", `${BASE}-toolbar-choices`);
    shows.append(choice("placement", "Where", PLACEMENTS, PLACEMENT_LABELS, toolbar.placement), choice("show", "When", SHOWS, SHOW_LABELS, toolbar.show));
    line.append(head, problem, use, shows);
    return line;
  }

  /** The Toolbars tab drawn anew from the values; `focus`: the element to focus after it (a selector) */
  private drawToolbars(focus?: string): void {
    const panel = this.toolbarsPanel;
    const values = this.values;
    if (!panel || !values) return;
    const known = this.known();
    const parts: HTMLElement[] = [
      this.toolbarBar(),
      // … is a toolbar's: one without it anywhere gets it at its end
      ...(hasAction(this.rows, "actions.more", this.context.kinds())
        ? []
        : [this.moreWarning()]),
      this.el("p", `${BASE}-intro`, "Click an item to change how it shows. Drag items and rows to reorder them (by finger, hold an item a moment first)."),
    ];
    const rows = this.el("div", `${BASE}-rows`);
    this.rows.forEach((row, r) => {
      const block = this.el("div", `${BASE}-favrow`);
      block.dataset.swbRow = String(r);
      const head = this.el("div", `${BASE}-favhead`);
      head.append(
        this.rowGrip(r, block, rows),
        this.el("span", "", `Row ${r + 1}`),
        // The row gone, its items with it
        this.button(`${BASE}-row-remove`, `Remove row ${r + 1}`, () => {
          this.picking = undefined;
          this.edit(removeRow(this.rows, r), `.${BASE}-add-row`);
        }, ICONS.close),
      );
      block.append(head);
      const picking = this.picking;
      const open = !!picking && "row" in picking && picking.row === r;
      const add = this.button(`${BASE}-add`, open ? "Close" : "Add", () => this.openPicking({ row: r }));
      add.setAttribute("aria-expanded", String(open));
      // Docked: its pinned items in boxes at its ends; by the selection one list (a pinned item marked)
      block.append(this.docked ? this.zones(row, r, known) : this.itemList(row, r, undefined, known), add);
      this.placeDetail(block, r);
      // The search for the row (Add): under its Add
      if (picking && "row" in picking && picking.row === r) block.append(this.picker(picking));
      rows.append(block);
    });
    parts.push(rows);
    parts.push(
        this.button(`${BASE}-add-row`, "Add row", () => {
          const rows = [...this.rows, []];
          this.picking = { row: rows.length - 1 };
          this.edit(rows, `[data-swb-row="${rows.length - 1}"] .${BASE}-pick-field`);
        }),
      );
    panel.replaceChildren(...parts);
    this.pointDetail();
    const focused = focus ? panel.querySelector<HTMLElement>(focus) : null;
    focused?.focus({ preventScroll: true });
    // A search opened: in view with its list, above an on-screen keyboard already there; an item's panel in view
    (focused?.closest<HTMLElement>("[data-sw-reveal]") ?? focused?.closest<HTMLElement>(`.${BASE}-detail`))?.scrollIntoView?.({ block: "nearest" });
  }

  /** The open item's panel's arrow at the middle of the item (or of its slot) it is for, once laid out */
  private pointDetail(): void {
    const detail = this.toolbarsPanel?.querySelector<HTMLElement>(`.${BASE}-detail`);
    const adjusting = this.adjusting;
    const picking = this.picking;
    const at = adjusting ?? (picking && "at" in picking ? picking.at : undefined);
    const key = adjusting ? adjusting.key : picking && "at" in picking ? picking.key : undefined;
    if (!detail || !at) return;
    const item = this.toolbarsPanel!.querySelector<HTMLElement>(`[data-swb-item="${at.row}:${at.index}"]`);
    const target = (key && item?.querySelector<HTMLElement>(`[data-swb-slot="${key}"]`)) || item;
    if (!target) return;
    const box = detail.getBoundingClientRect();
    const of = target.getBoundingClientRect();
    // (Not laid out: jsdom, a hidden tab; the CSS's default)
    if (!box.width) return;
    const x = Math.max(14, Math.min(box.width - 14, of.left + of.width / 2 - box.left));
    detail.style.setProperty("--swb-pointer-x", `${Math.round(x)}px`);
  }

  /**
   * An item's panel (its look, a slot's) and the search for its slot, where
   * the row's item is: under its line in its list (the panel a line of its
   * own there, the items after it below it), or for an item pinned, under the
   * row's two boxes of pinned items, as they are narrow
   */
  private placeDetail(block: HTMLElement, r: number): void {
    const adjusting = this.adjusting;
    const picking = this.picking;
    const slotPicking = picking && "at" in picking && picking.at.row === r ? picking : undefined;
    if (adjusting?.row !== r && !slotPicking) return;
    const at = adjusting?.row === r ? adjusting : slotPicking!.at;
    const key = adjusting?.row === r ? adjusting.key : slotPicking!.key;
    const item = block.querySelector<HTMLElement>(`[data-swb-item="${at.row}:${at.index}"]`);
    const detail = this.el("div", `${BASE}-detail`);
    // Said whose it is: the item's icon and name (a slot's: its name after the item's), as the item shows them
    const head = this.el("div", `${BASE}-detail-head`);
    const icon = this.el("span", `${BASE}-item-icon`);
    icon.innerHTML = item?.querySelector(`.${BASE}-item-icon`)?.innerHTML ?? "";
    const slot = key ? item?.querySelector<HTMLElement>(`[data-swb-slot="${key}"] .${BASE}-slot-name`)?.textContent : undefined;
    const name = item?.querySelector(`.${BASE}-item-name`)?.textContent ?? "";
    head.append(icon, this.el("span", `${BASE}-detail-name`, slot ? `${name} · ${slot}` : name));
    detail.append(head);
    if (adjusting?.row === r) detail.append(this.lookPanel(adjusting));
    if (slotPicking) detail.append(this.picker(slotPicking));
    const pinned = item?.closest<HTMLElement>(`.${BASE}-pins`);
    if (pinned) pinned.after(detail);
    else if (item) item.after(detail);
    else block.append(detail);
  }

  /**
   * … missing from the toolbar edited: said so (it shows at the toolbar's end), and a button putting it there in the
   * last row (docked: pinned right, at its line's end)
   */
  private moreWarning(): HTMLElement {
    const warning = this.el("p", `${BASE}-warning`, "Every action (…) is required: this toolbar does not have it, so it is added at its end. Add it anywhere (a gesture button's swipe too) to put it there.");
    const add = this.button(`${BASE}-warning-add`, "Add it at the end", () => {
      const rows = this.rows.length ? this.rows : [[]];
      const row = rows.length - 1;
      const item: FavoriteItem = this.docked ? { id: "actions.more", pin: "right" } : { id: "actions.more" };
      this.edit(addItem(rows, row, item), `[data-swb-row="${row}"] .${BASE}-add`);
    });
    warning.append(" ", add);
    return warning;
  }

  /**
   * A row's items as a list (`zone`: a docked toolbar's, those of one zone of
   * it: pinned left, the others, pinned right), each at its index in the row
   */
  private itemList(row: readonly FavoriteItem[], r: number, zone: Zone | undefined, known: Map<string, Action>): HTMLElement {
    const items = this.el("div", `${BASE}-items`);
    items.setAttribute("role", "list");
    items.dataset.swbItems = String(r);
    if (zone) {
      items.dataset.swbZone = zone;
      items.classList.add(`${BASE}-zone-${zone}`);
    }
    const pin = zone === "middle" ? undefined : zone;
    row.forEach((item, i) => {
      if (!zone || pinOf(item) === pin) items.append(this.itemElement(item, { row: r, index: i }, known));
    });
    // (A pinned box empty: its name over it says what it is)
    if (!items.childElementCount && (!zone || zone === "middle")) items.append(this.el("span", `${BASE}-empty`, "Empty"));
    if (zone && zone !== "middle") {
      items.setAttribute("aria-label", zone === "left" ? `Row ${r + 1}, pinned left` : `Row ${r + 1}, pinned right`);
      items.title = `At the ${zone} end of this row's line where the toolbar is docked, out of what scrolls`;
    }
    return items;
  }

  /**
   * A docked toolbar's row: on top its two boxes of items pinned left and right, side
   * by side as the ends of its docked line (shown empty too, named, to drag
   * an item into), under them its other items
   */
  private zones(row: readonly FavoriteItem[], r: number, known: Map<string, Action>): HTMLElement {
    const zones = this.el("div", `${BASE}-zones`);
    const pins = this.el("div", `${BASE}-pins`);
    for (const zone of ["left", "right"] as const) {
      const box = this.el("div", `${BASE}-pin-box ${BASE}-pin-box-${zone}`);
      box.append(this.el("span", `${BASE}-pin-name`, zone === "left" ? "Pinned left" : "Pinned right"), this.itemList(row, r, zone, known));
      pins.append(box);
    }
    zones.append(pins, this.itemList(row, r, "middle", known));
    return zones;
  }

  private itemElement(item: FavoriteItem, at: At, known: Map<string, Action>): HTMLElement {
    const element = this.el("div", `${BASE}-item`);
    element.setAttribute("role", "listitem");
    element.tabIndex = 0;
    element.dataset.swbItem = `${at.row}:${at.index}`;
    const icon = this.el("span", `${BASE}-item-icon`);
    const name = this.el("span", `${BASE}-item-name`);
    if (isSeparator(item)) {
      // As the toolbar shows it: a line (its name for a screen reader and in its tooltip)
      element.classList.add(`${BASE}-separator`, `${BASE}-iconly`);
      name.textContent = "Separator";
      element.title = "Separator";
      element.append(icon, name);
    } else {
      if (isKindItem(item)) {
        // A kind's, as the toolbar shows it: its first slot's action (a gesture button's Click), the others' small in
        // its corners (its swipes); a kind without slots its own icon and label (a snippet's). Its slots and fields
        // are set in its panel (the dialog knows nothing of what they are for)
        const kind = this.context.kinds().find((k) => k.type === item.type);
        element.classList.add(`${BASE}-kind`);
        const looks = kind ? kind.slots.map((slot) => this.slotLook(item, slot, known)) : [];
        const main = looks[0];
        const ownIcon = kind?.ownLook && typeof item.icon === "string" && item.icon ? item.icon : undefined;
        const ownLabel = kind?.ownLook && typeof item.label === "string" && item.label ? item.label : undefined;
        if (main?.glyph) icon.textContent = main.glyph;
        else if (main) icon.innerHTML = main.icon;
        else if (ownIcon) icon.textContent = ownIcon;
        else icon.innerHTML = kind?.icon ?? "";
        name.textContent = main?.label ?? ownLabel ?? kind?.label ?? item.type;
        const face = this.el("span", `${BASE}-item-face`);
        face.append(icon);
        looks.slice(1).forEach((look, i) => {
          if (!look) return;
          const hint = this.el("span", `${BASE}-item-hint ${BASE}-item-hint-${i + 1}`);
          if (look.glyph) hint.textContent = look.glyph;
          else hint.innerHTML = look.icon;
          hint.setAttribute("aria-hidden", "true");
          face.append(hint);
        });
        element.append(face, name);
        // What it holds, said: its kind, then each slot's action
        const held = kind ? kind.slots.flatMap((slot, i) => (looks[i] ? [`${slot.label}: ${looks[i]!.label}`] : [])) : [];
        element.title = held.length ? `${kind!.label} (${held.join(", ")})` : (kind?.label ?? item.type);
        if (item.show !== "label") element.classList.add(`${BASE}-iconly`);
        const problem = kind && this.itemProblem(item, kind);
        if (!kind) {
          element.classList.add(`${BASE}-unknown`);
          element.title = `No module turned on gives the kind ${item.type}: the toolbar leaves it out`;
        } else if (problem) {
          element.classList.add(`${BASE}-unknown`);
          element.title = `${problem}: the toolbar leaves it out`;
        }
      } else {
        const action = known.get(item.id);
        // Its own icon and label, as the toolbar shows them
        if (item.icon) icon.textContent = item.icon;
        else icon.innerHTML = action?.icon ?? "";
        name.textContent = item.label ?? action?.label ?? item.id;
        element.append(icon, name);
        // As it shows in the toolbar: its icon alone (its name for a screen reader and in its tooltip), or its label too
        if (item.show !== "label") {
          element.classList.add(`${BASE}-iconly`);
          element.title = name.textContent;
        }
        if (!action) {
          element.classList.add(`${BASE}-unknown`);
          element.title = `No action has the id ${item.id} (its module is off, or it is not defined): the toolbar leaves it out`;
        }
      }
      // A label's fixed width, as in the toolbar (an ellipsis where longer)
      if (item.show === "label" && item.width) {
        element.classList.add(`${BASE}-fixed`);
        element.style.setProperty("--swb-width", `${item.width}ch`);
        if (!element.title) element.title = name.textContent ?? "";
      }
      // Its look set in a panel under its row: a click, Enter
      element.setAttribute("aria-expanded", String(this.adjusting?.row === at.row && this.adjusting.index === at.index));
    }
    // Pinned, by the selection: a pin by its name (what it does where docked)
    const pin = isSeparator(item) ? undefined : item.pin;
    if (pin && !this.docked) {
      const mark = this.el("span", `${BASE}-item-pin`);
      mark.innerHTML = ICONS.pin;
      mark.title = `Pinned ${pin} when docked`;
      name.after(mark);
    }
    element.setAttribute("aria-label", `${name.textContent}${pin ? `, pinned ${pin}` : ""}, row ${at.row + 1}, item ${at.index + 1}`);
    element.append(this.button(`${BASE}-remove`, `Remove ${name.textContent}`, () => this.removeAt(at), ICONS.close));
    element.addEventListener("keydown", (e) => {
      if (e.target !== element) return;
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const moved = this.step(at, e.key);
        if (!moved) return;
        // Its panel open: with it where it went (its pin changed, it is another object)
        const adjusting = this.adjusting;
        const open = adjusting?.row === at.row && adjusting.index === at.index;
        if (open) this.adjusting = { ...moved.at, ...(adjusting.key ? { key: adjusting.key } : {}) };
        this.edit(moved.rows, `[data-swb-item="${moved.at.row}:${moved.at.index}"]`, !open);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        this.removeAt(at);
      } else if (e.key === "Enter" && !isSeparator(item)) {
        e.preventDefault();
        this.toggleLook(at);
      }
    });
    element.addEventListener("pointerdown", (e) => {
      // (Not from its controls: its buttons, a field typed in)
      if (e.button !== 0 || (e.target instanceof Element && e.target.closest("button, input, textarea"))) return;
      const panel = this.toolbarsPanel!;
      reorder(e, {
        element,
        base: BASE,
        layer: this.dialog?.element,
        flow: "inline",
        // A finger takes it once held: moved before, it scrolls the tab
        hold: true,
        containers: () => Array.from(panel.querySelectorAll<HTMLElement>(`.${BASE}-items`)),
        items: (container) => Array.from(container.querySelectorAll<HTMLElement>(`:scope > .${BASE}-item`)),
        done: (to) => {
          // The list let go in: its row, and a docked toolbar's its zone (pinned left, the others, pinned right)
          const list = to ? panel.querySelectorAll<HTMLElement>(`.${BASE}-items`)[to.container] : undefined;
          const row = Number(list?.dataset.swbItems);
          const zone = list?.dataset.swbZone as Zone | undefined;
          if (!to || !list || !Number.isInteger(row)) return this.drawToolbars();
          // (By the selection: the order as made, a pin that would undo it gone)
          const moved = zone ? placeItem(this.rows, at, { row, zone: zone === "middle" ? undefined : zone, index: to.index }) : { rows: unpinnedOutOfOrder(moveItem(this.rows, at, { row, index: to.index })), at: { row, index: to.index } };
          if (sameRows(moved.rows, this.rows)) return this.drawToolbars();
          this.adjusting = undefined;
          this.edit(moved.rows, `[data-swb-item="${moved.at.row}:${moved.at.index}"]`);
        },
        // A click (a tap): its look's panel opened or closed (a separator has none)
        ...(isSeparator(item) ? {} : { clicked: () => this.toggleLook(at) }),
      });
    });
    return element;
  }

  /**
   * Where Alt+arrows move an item, and the rows then: ← → within its row (a
   * docked toolbar's: within its zone, pinned or not), ↑ ↓ into the row above or below (the
   * same zone, at the same place in it); undefined: nowhere
   */
  private step(at: At, key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown"): { readonly rows: Favorites; readonly at: At } | undefined {
    const rows = this.rows;
    if (!this.docked) {
      const to = stepOf(rows, at, key);
      return to && { rows: unpinnedOutOfOrder(moveItem(rows, at, to)), at: to };
    }
    const row = rows[at.row];
    const item = row?.[at.index];
    if (!row || !item) return undefined;
    const pin = pinOf(item);
    const zone = row.filter((other) => pinOf(other) === pin);
    const place = zone.indexOf(item);
    if (key === "ArrowLeft" || key === "ArrowRight") {
      const index = place + (key === "ArrowLeft" ? -1 : 1);
      return index >= 0 && index < zone.length ? placeItem(rows, at, { row: at.row, zone: pin, index }) : undefined;
    }
    const other = at.row + (key === "ArrowUp" ? -1 : 1);
    return rows[other] ? placeItem(rows, at, { row: other, zone: pin, index: place }) : undefined;
  }

  /** An item's look's panel opened, or closed where open (one at a time) */
  private toggleLook(at: At): void {
    const open = this.adjusting?.row === at.row && this.adjusting.index === at.index && !this.adjusting.key;
    this.adjusting = open ? undefined : at;
    this.picking = undefined;
    this.drawToolbars(open ? `[data-swb-item="${at.row}:${at.index}"]` : `[data-swb-look] .${BASE}-look-show[aria-checked="true"]`);
  }

  /** A slot's panel opened (its action, its own icon and label), or closed where open */
  private toggleSlot(at: At, key: string): void {
    // (Closed: back to its item's panel, where the slots are)
    const open = this.adjusting?.row === at.row && this.adjusting.index === at.index && this.adjusting.key === key;
    this.adjusting = open ? { row: at.row, index: at.index } : { ...at, key };
    this.picking = undefined;
    this.drawToolbars(open ? `[data-swb-look] [data-swb-slot="${key}"]` : `[data-swb-look] .${BASE}-look-change`);
  }

  /**
   * An item's look, under its row, each setting on a line of its own: shown as
   * its icon or with its label; with its label, that label's width in
   * characters (empty: as wide as it is; kept within MIN_WIDTH and MAX_WIDTH);
   * an action's own icon and label. For a slot of a kind's item: its panel.
   */
  private lookPanel(at: At & { readonly key?: string }): HTMLElement {
    if (at.key) return this.slotPanel(at, at.key);
    const panel = this.el("div", `${BASE}-look`);
    panel.dataset.swbLook = `${at.row}:${at.index}`;
    const item = this.rows[at.row]?.[at.index];
    if (!item || isSeparator(item)) return panel;
    const labeled = item.show === "label";
    const width = labeled ? item.width : undefined;
    const set = (show: ItemShow, w: number | undefined, focus: string) => this.edit(setLook(this.rows, at, show, w), `[data-swb-look] ${focus}`);
    const shows = this.el("div", `${BASE}-look-shows`);
    shows.setAttribute("role", "radiogroup");
    shows.setAttribute("aria-label", "Shows as");
    for (const [show, label, icon] of [["icon", "Icon", ICONS.iconOnly], ["label", "Label", ICONS.label]] as const) {
      const button = this.button(`${BASE}-look-show`, label, () => set(show, width, `[data-swb-show="${show}"]`));
      button.innerHTML = `${icon}<span></span>`;
      button.querySelector("span")!.textContent = label;
      button.dataset.swbShow = show;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String((show === "label") === labeled));
      shows.append(button);
    }
    // Each setting a line of its own, named as its property in the configuration (show, width), the names one under another
    const show = this.el("div", `${BASE}-look-line`);
    show.append(this.el("span", `${BASE}-look-name`, "Show"), shows);
    panel.append(show);
    if (labeled) {
      const field = this.el("input", `${BASE}-look-width`);
      field.type = "number";
      field.min = String(MIN_WIDTH);
      field.max = String(MAX_WIDTH);
      field.step = "1";
      field.placeholder = "auto";
      field.value = width ? String(width) : "";
      field.setAttribute("aria-label", `The label's width in characters, ${MIN_WIDTH} to ${MAX_WIDTH} (empty: as wide as it is)`);
      field.addEventListener("change", () => set("label", field.value.trim() === "" ? undefined : widthOf(Number(field.value)), `.${BASE}-look-width`));
      const label = this.el("label", `${BASE}-look-line`);
      label.append(this.el("span", `${BASE}-look-name`, "Width"), field, this.el("span", `${BASE}-look-unit`, "characters"));
      panel.append(label);
    }
    // Pinned at an end of its row's line where docked (the keyboard's way to what dragging into a zone does)
    panel.append(this.pinLine(at, item.pin));
    // A kind's slots (each its action, its own panel opened by a click) and fields, a line each
    const kind = isKindItem(item) ? this.context.kinds().find((k) => k.type === item.type) : undefined;
    if (kind && isKindItem(item) && (kind.slots.length || kind.fields?.length)) {
      const slots = this.el("div", `${BASE}-slots`);
      slots.append(...kind.slots.map((slot) => this.slotButton(item, at, slot, this.known())), ...(kind.fields ?? []).map((field) => this.fieldInput(item, field, (value) => setSlot(this.rows, at, field.key, value), () => this.refreshProblems(at))));
      panel.append(slots);
    }
    // An action's own icon and label (its label whatever it shows: its tooltip too), or a kind's whose items have their own
    if (isActionItem(item) || kind?.ownLook) {
      const placeholder = isActionItem(item) ? (this.known().get(item.id)?.label ?? item.id) : "Its name";
      const own = (key: "icon" | "label") => (typeof item[key] === "string" ? (item[key] as string) : undefined);
      const set = (key: "icon" | "label") => (value: string | undefined) => setOwn(this.rows, at, key, value);
      panel.append(this.ownLine("icon", "Icon", own("icon"), "★", set("icon")), this.ownLine("label", "Label", own("label"), placeholder, set("label")));
    }
    return this.closing(panel, () => this.toggleLook(at));
  }

  /** Where an item is pinned in its row: None, Left, Right (by the selection, for when the toolbar docks) */
  private pinLine(at: At, pin: Pin | undefined): HTMLElement {
    const pins = this.el("div", `${BASE}-look-shows`);
    pins.setAttribute("role", "radiogroup");
    pins.setAttribute("aria-label", "Pinned");
    for (const [value, label] of [[undefined, "None"], ["left", "Left"], ["right", "Right"]] as const) {
      const button = this.button(`${BASE}-look-show ${BASE}-look-pin`, label, () => {
        const moved = setPin(this.rows, at, value);
        // Its panel follows it (made anew where it goes)
        this.adjusting = moved.at;
        this.edit(moved.rows, `[data-swb-look] [data-swb-pin="${value ?? "none"}"]`, false);
      });
      button.dataset.swbPin = value ?? "none";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(value === pin));
      pins.append(button);
    }
    const line = this.el("div", `${BASE}-look-line`);
    line.title = "At an end of this row's line where the toolbar is docked, out of what scrolls";
    line.append(this.el("span", `${BASE}-look-name`, "Pin"), pins, ...(this.docked ? [] : [this.el("span", `${BASE}-look-unit`, "applies when docked")]));
    return line;
  }

  /**
   * A slot of a kind's item (a gesture button's Click, Swipe up): its action,
   * Change… opening the search for another (another's: its own look gone), and
   * where it has one, its own icon and label, as an action's item has them
   */
  private slotPanel(at: At, key: string): HTMLElement {
    const panel = this.el("div", `${BASE}-look`);
    panel.dataset.swbLook = `${at.row}:${at.index}:${key}`;
    const item = this.rows[at.row]?.[at.index];
    const slot = item && isKindItem(item) ? this.context.kinds().find((k) => k.type === item.type)?.slots.find((s) => s.key === key) : undefined;
    if (!item || !isKindItem(item) || !slot) return panel;
    const inner = slotItemOf(item[key]);
    if (inner) return this.closing(this.slotItemPanel(panel, at, key, inner), () => this.toggleSlot(at, key));
    const ref = slotOf(item[key]);
    const action = ref ? this.known().get(ref.id) : undefined;
    const line = this.el("div", `${BASE}-look-line`);
    const current = this.el("span", `${BASE}-look-action`);
    current.innerHTML = `<span class="${BASE}-item-icon">${action?.icon ?? ""}</span><span></span>`;
    current.lastElementChild!.textContent = action?.label ?? ref?.id ?? "None";
    const picking = this.picking;
    const open = !!picking && "at" in picking && picking.key === key && picking.at.row === at.row && picking.at.index === at.index;
    const change = this.button(`${BASE}-look-change`, open ? "Close" : "Change…", () => this.openPicking({ at, key }));
    change.setAttribute("aria-expanded", String(open));
    line.append(this.el("span", `${BASE}-look-name`, "Action"), current, change);
    panel.append(line);
    if (ref) {
      const set = (field: "icon" | "label") => (value: string | undefined) => setSlotOwn(this.rows, at, key, field, value);
      panel.append(this.ownLine("icon", "Icon", ref.icon, "★", set("icon")), this.ownLine("label", "Label", ref.label, action?.label ?? ref.id, set("label")));
    }
    return this.closing(panel, () => this.toggleSlot(at, key));
  }

  /**
   * A slot holding an item of a kind that is one action (a snippet): the kind
   * and Change…, its own icon and label where its kind has them, its fields
   */
  private slotItemPanel(panel: HTMLElement, at: At, key: string, inner: KindItem): HTMLElement {
    const kind = this.context.kinds().find((k) => k.type === inner.type);
    const line = this.el("div", `${BASE}-look-line`);
    const current = this.el("span", `${BASE}-look-action`);
    current.innerHTML = `<span class="${BASE}-item-icon">${kind?.icon ?? ""}</span><span></span>`;
    current.lastElementChild!.textContent = kind?.label ?? inner.type;
    const picking = this.picking;
    const open = !!picking && "at" in picking && picking.key === key && picking.at.row === at.row && picking.at.index === at.index;
    const change = this.button(`${BASE}-look-change`, open ? "Close" : "Change…", () => this.openPicking({ at, key }));
    change.setAttribute("aria-expanded", String(open));
    line.append(this.el("span", `${BASE}-look-name`, "Action"), current, change);
    panel.append(line);
    if (!kind) return panel;
    const set = (field: string) => (value: string | undefined) => setSlotField(this.rows, at, key, field, value);
    if (kind.ownLook) {
      const own = (field: "icon" | "label") => (typeof inner[field] === "string" && inner[field] ? (inner[field] as string) : undefined);
      panel.append(this.ownLine("icon", "Icon", own("icon"), "★", set("icon")), this.ownLine("label", "Label", own("label"), "Its name", set("label")));
    }
    panel.append(...(kind.fields ?? []).map((field) => this.fieldInput(inner, field, set(field.key), () => this.refreshProblems(at))));
    return panel;
  }

  /** What is wrong with the item a slot holds, where the toolbar leaves it out: its kind not given, no action, or the kind's `check` (a snippet without its text) */
  private slotItemProblem(inner: KindItem): string | undefined {
    const kind = this.context.kinds().find((k) => k.type === inner.type);
    return !kind ? `No module turned on gives the kind ${inner.type}` : !kind.action ? `${kind.label} is no action` : kind.check?.(inner);
  }

  /** What is wrong with a kind's item, where the toolbar leaves it out: its kind's `check`, or a slot it needs holding an item with something wrong */
  private itemProblem(item: KindItem, kind: ItemKind): string | undefined {
    const own = kind.check?.(item);
    if (own) return own;
    for (const slot of kind.slots) {
      const inner = slot.optional ? undefined : slotItemOf(item[slot.key]);
      const problem = inner && this.slotItemProblem(inner);
      if (problem) return `${slot.label}: ${problem}`;
    }
    return undefined;
  }

  /** A slot's button or an item marked for what is wrong with it, or no longer */
  private markProblem(element: HTMLElement, problem: string | undefined, dimmed: boolean): void {
    if (dimmed) element.classList.toggle(`${BASE}-unknown`, !!problem);
    if (problem) element.title = `${problem}: the toolbar leaves it out`;
    else if (element.title.endsWith(": the toolbar leaves it out")) element.removeAttribute("title");
  }

  /** A kind's item's warnings drawn again as a field of it (or of the item a slot holds) is typed in, the tab not drawn anew */
  private refreshProblems(at: At): void {
    const item = this.rows[at.row]?.[at.index];
    const kind = item && isKindItem(item) ? this.context.kinds().find((k) => k.type === item.type) : undefined;
    const element = this.toolbarsPanel?.querySelector<HTMLElement>(`[data-swb-item="${at.row}:${at.index}"]`);
    if (!item || !isKindItem(item) || !kind || !element) return;
    this.markProblem(element, this.itemProblem(item, kind), true);
    // (Its slots' buttons: in its panel)
    const panel = this.toolbarsPanel?.querySelector<HTMLElement>(`[data-swb-look="${at.row}:${at.index}"]`);
    for (const slot of kind.slots) {
      const inner = slotItemOf(item[slot.key]);
      const button = panel?.querySelector<HTMLElement>(`[data-swb-slot="${slot.key}"]`);
      if (inner && button) this.markProblem(button, this.slotItemProblem(inner), true);
    }
  }

  /** A panel's × and Esc closing it (Esc: the panel's, not the dialog's) */
  private closing(panel: HTMLElement, close: () => void): HTMLElement {
    panel.append(this.button(`${BASE}-look-close`, "Close", close, ICONS.close));
    panel.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      close();
    });
    return panel;
  }

  /**
   * A line of an item's own icon or label: its field, named by a label it is
   * in (empty: the default, the action's or the kind's), and where set, a
   * button putting the default back
   */
  private ownLine(key: "icon" | "label", name: string, value: string | undefined, placeholder: string, set: (value: string | undefined) => Favorites): HTMLElement {
    const line = this.el("div", `${BASE}-look-line`);
    const field = this.el("input", `${BASE}-look-own`);
    field.type = "text";
    field.value = value ?? "";
    field.placeholder = placeholder;
    field.spellcheck = false;
    field.dataset.swbOwn = key;
    field.setAttribute("aria-label", key === "icon" ? `Its own icon: up to ${MAX_ICON} characters, an emoji too (empty: the default)` : "Its own label (empty: the default)");
    if (key === "icon") field.classList.add(`${BASE}-look-own-icon`);
    field.addEventListener("change", () => this.edit(set(field.value), `[data-swb-look] [data-swb-own="${key}"]`));
    // (The reset outside the label: a press on it is no press on the field)
    const label = this.el("label", `${BASE}-look-own-line`);
    label.append(this.el("span", `${BASE}-look-name`, name), field);
    line.append(label);
    if (value) {
      const reset = this.button(`${BASE}-look-reset`, key === "icon" ? "Back to the default icon" : "Back to the default label", () => this.edit(set(undefined), `[data-swb-look] [data-swb-own="${key}"]`), ICONS.reset);
      reset.dataset.swbReset = key;
      line.append(reset);
    }
    return line;
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
        // (Its index among the rows)
        done: (to) => {
          const index = to ? to.index : r;
          if (index !== r) this.edit(moveRow(this.rows, r, index), `[data-swb-row="${index}"] .${BASE}-row-grip`);
          else this.drawToolbars();
        },
      });
    });
    grip.addEventListener("keydown", (e) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      const to = r + (e.key === "ArrowUp" ? -1 : 1);
      if (to >= 0 && to < this.rows.length) this.edit(moveRow(this.rows, r, to), `[data-swb-row="${to}"] .${BASE}-row-grip`);
    });
    return grip;
  }

  /**
   * The rows edited changed; an item's panel open (and the search for one's
   * slot) following its item where the edit moved it (an item added or
   * removed before it, its row moved), gone with it; `follow` false: the
   * caller set where they are after it (an item added, made anew elsewhere)
   */
  private edit(favorites: Favorites, focus?: string, follow = true): void {
    if (!follow) {
      this.store(favorites);
      this.changedToolbars(focus);
      return;
    }
    const before = this.rows;
    const moved = <T extends At>(at: T | undefined): T | undefined => {
      if (!at) return undefined;
      const item = before[at.row]?.[at.index];
      const after = this.rows;
      for (let row = 0; item && row < after.length; row++) {
        const index = after[row]!.indexOf(item);
        if (index >= 0) return { ...at, row, index };
      }
      // Made anew in its place (its look set: another object), else gone
      return after[at.row]?.[at.index] && !isSeparator(after[at.row]![at.index]!) ? at : undefined;
    };
    const adjusting = this.adjusting;
    const picking = this.picking;
    this.store(favorites);
    this.adjusting = moved(adjusting);
    if (picking && "at" in picking) {
      const at = moved(picking.at);
      this.picking = at ? { at, key: picking.key } : undefined;
    }
    this.changedToolbars(focus);
  }

  /** What the tab edits written back into the toolbar edited, each row in the order the docked toolbar shows it */
  private store(favorites: Favorites): void {
    const values = this.values!;
    const index = Math.min(this.toolbarIndex, values.toolbars.length - 1);
    values.toolbars = values.toolbars.map((toolbar, i) => (i === index ? { ...toolbar, rows: pinOrdered(favorites) } : toolbar));
  }

  private changedToolbars(focus?: string): void {
    this.drawToolbars(focus);
    this.update();
  }

  /**
   * How a slot of a kind's item shows (its action with its own icon and label,
   * or the item of a kind it holds: a snippet's character); undefined: none
   */
  private slotLook(item: KindItem, slot: ItemSlot, known: Map<string, Action>): { readonly icon: string; readonly glyph?: string; readonly label: string } | undefined {
    const inner = slotItemOf(item[slot.key]);
    if (inner) {
      const kind = this.context.kinds().find((k) => k.type === inner.type);
      const glyph = typeof inner.icon === "string" && inner.icon ? inner.icon : undefined;
      const label = typeof inner.label === "string" && inner.label ? inner.label : (kind?.label ?? inner.type);
      return { icon: kind?.icon ?? "", ...(glyph ? { glyph } : {}), label };
    }
    const ref = slotOf(item[slot.key]);
    if (!ref) return undefined;
    const action = known.get(ref.id);
    return { icon: action?.icon ?? "", ...(ref.icon ? { glyph: ref.icon } : {}), label: ref.label ?? action?.label ?? ref.id };
  }

  /**
   * A slot of a kind's item: the action picked for it, with its own icon and
   * label where it has them (none yet: Choose…, an optional one None); a click
   * opens its panel (a slot needing one and without it: the search at once)
   */
  private slotButton(item: KindItem, at: At, slot: ItemSlot, known: Map<string, Action>): HTMLButtonElement {
    const inner = slotItemOf(item[slot.key]);
    if (inner) return this.slotItemButton(inner, at, slot);
    const ref = slotOf(item[slot.key]);
    const action = ref ? known.get(ref.id) : undefined;
    const unset = !ref;
    const what = ref?.label ?? action?.label ?? (unset ? (slot.optional ? "None" : "Choose…") : ref.id);
    const button = this.button(`${BASE}-slot`, `${slot.label}: ${what}`, () => (unset && !slot.optional ? this.openPicking({ at, key: slot.key }) : this.toggleSlot(at, slot.key)));
    button.innerHTML = `<span class="${BASE}-slot-name"></span><span class="${BASE}-item-icon">${ref?.icon ? "" : (action?.icon ?? "")}</span><span class="${BASE}-slot-action"></span>`;
    if (ref?.icon) button.querySelector(`.${BASE}-item-icon`)!.textContent = ref.icon;
    button.querySelector(`.${BASE}-slot-name`)!.textContent = slot.label;
    button.querySelector(`.${BASE}-slot-action`)!.textContent = what;
    button.setAttribute("aria-label", `${slot.label}: ${what}`);
    button.dataset.swbSlot = slot.key;
    if (!action && !(unset && slot.optional)) button.classList.add(`${BASE}-unknown`);
    if (unset && slot.optional) button.classList.add(`${BASE}-slot-unset`);
    const adjusting = this.adjusting;
    button.setAttribute("aria-expanded", String(!!adjusting && adjusting.key === slot.key && adjusting.row === at.row && adjusting.index === at.index));
    return button;
  }

  /** A slot holding an item of a kind that is one action (a snippet): its own icon and label where set, else its kind's; a click opens its panel */
  private slotItemButton(inner: KindItem, at: At, slot: ItemSlot): HTMLButtonElement {
    const kind = this.context.kinds().find((k) => k.type === inner.type);
    const own = (field: "icon" | "label") => (kind?.ownLook && typeof inner[field] === "string" && inner[field] ? (inner[field] as string) : undefined);
    const what = own("label") ?? kind?.label ?? inner.type;
    const button = this.button(`${BASE}-slot`, `${slot.label}: ${what}`, () => this.toggleSlot(at, slot.key));
    button.innerHTML = `<span class="${BASE}-slot-name"></span><span class="${BASE}-item-icon"></span><span class="${BASE}-slot-action"></span>`;
    const icon = button.querySelector(`.${BASE}-item-icon`)!;
    const glyph = own("icon");
    if (glyph) icon.textContent = glyph;
    else icon.innerHTML = kind?.icon ?? "";
    button.querySelector(`.${BASE}-slot-name`)!.textContent = slot.label;
    button.querySelector(`.${BASE}-slot-action`)!.textContent = what;
    button.setAttribute("aria-label", `${slot.label}: ${what}`);
    button.dataset.swbSlot = slot.key;
    // A kind no module on gives, or one that is no action, or an item with something wrong (a snippet without its text): left out
    this.markProblem(button, this.slotItemProblem(inner), true);
    const adjusting = this.adjusting;
    button.setAttribute("aria-expanded", String(!!adjusting && adjusting.key === slot.key && adjusting.row === at.row && adjusting.index === at.index));
    return button;
  }

  /** An item removed, its panel (and its slot's search) closed with it */
  private removeAt(at: At): void {
    const same = (other: At | undefined) => other?.row === at.row && other.index === at.index;
    if (same(this.adjusting)) this.adjusting = undefined;
    if (this.picking && "at" in this.picking && same(this.picking.at)) this.picking = undefined;
    this.edit(removeItem(this.rows, at), `[data-swb-row="${at.row}"] .${BASE}-add`);
  }

  /** A field of a kind's item (or of the item a slot holds): its text edited in place (written as typed, the tab not drawn anew: the field keeps the keyboard) */
  private fieldInput(item: KindItem, field: ItemField, set: (value: string | undefined) => Favorites, changed: () => void): HTMLElement {
    const value = item[field.key];
    const input = field.multiline ? this.el("textarea", `${BASE}-field-input`) : this.el("input", `${BASE}-field-input`);
    if (input instanceof HTMLInputElement) input.type = "text";
    else input.rows = 2;
    input.value = typeof value === "string" ? value : "";
    input.placeholder = field.placeholder ?? "";
    input.spellcheck = false;
    input.setAttribute("aria-label", field.label);
    input.addEventListener("input", () => {
      this.setQuietly(set(input.value || undefined));
      changed();
    });
    const label = this.el("label", `${BASE}-field${field.multiline ? ` ${BASE}-field-multiline` : ""}`);
    label.dataset.swbField = field.key;
    label.append(this.el("span", `${BASE}-slot-name`, field.label), input);
    return label;
  }

  /** The rows edited changed, the tab left as it is (a field being typed in) */
  private setQuietly(favorites: Favorites): void {
    this.store(favorites);
    this.update();
  }

  /** The search opened for a row or a slot (open for it already: closed) */
  private openPicking(target: Picking): void {
    const open = !!this.picking && JSON.stringify(this.picking) === JSON.stringify(target);
    this.picking = open ? undefined : target;
    // A slot's search for another item than the one whose panel is open: that panel closed (one item's at a time)
    const adjusting = this.adjusting;
    if (!open && "at" in target && adjusting && (adjusting.row !== target.at.row || adjusting.index !== target.at.index)) this.adjusting = undefined;
    const row = "row" in target ? target.row : target.at.row;
    const back = "row" in target ? `[data-swb-row="${row}"] .${BASE}-add` : `[data-swb-item="${target.at.row}:${target.at.index}"] [data-swb-slot="${target.key}"]`;
    this.drawToolbars(open ? back : `[data-swb-row="${row}"] .${BASE}-pick-field`);
  }

  /** Where Add puts an item in a row: before its items pinned right (not pinned) */
  private addAt(row: number): number {
    const items = this.rows[row] ?? [];
    return items.filter((item) => pinOf(item) !== "right").length;
  }

  /** The kind of the item at a place, where a module turned on gives it */
  private kindOf(at: At): ItemKind | undefined {
    const item = this.rows[at.row]?.[at.index];
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
    // Scrolled into view with its list as its field is focused and the on-screen keyboard comes (shared/dialog.ts)
    picker.dataset.swReveal = "";
    const field = this.el("input", `${BASE}-pick-field`);
    field.type = "text";
    field.placeholder = slot ? `Search an action for ${slot.label}` : "Search actions";
    field.setAttribute("aria-label", slot ? `Search an action for ${slot.label}` : "Search actions to add");
    field.spellcheck = false;
    field.autocomplete = "off";
    const list = this.el("div", `${BASE}-pick-list`);
    list.setAttribute("role", "listbox");
    const entries: Entry[] = [];
    // (An action for a touch screen only: for a toolbar a finger may show, used for Touch or for none yet)
    const touchToo = this.edited.useFor.includes("touch") || !this.edited.useFor.length;
    for (const action of this.context.actions().filter((a) => touchToo || !a.touchOnly)) {
      if (!action.choices) entries.push({ action, group: action.group });
      else entries.push({ action, group: action.group }, ...action.choices.map((choice) => ({ action: choice, group: action.label })));
    }
    const add = (item: FavoriteItem) => {
      this.picking = undefined;
      this.edit(addItem(this.rows, row, item, this.addAt(row)), `[data-swb-row="${row}"] .${BASE}-add`);
    };
    // A kind's item added: the search goes on for its first slot
    const addKind = (kind: ItemKind) => {
      const index = this.addAt(row);
      const favorites = addItem(this.rows, row, { type: kind.type }, index);
      const at = { row, index };
      // (Another item's panel closed: the new one's slot searched under it; no slot, its panel open at its first field)
      this.picking = kind.slots[0] ? { at, key: kind.slots[0].key } : undefined;
      this.adjusting = this.picking ? undefined : at;
      this.edit(favorites, this.picking ? `[data-swb-row="${row}"] .${BASE}-pick-field` : kind.fields?.length ? `[data-swb-look] .${BASE}-field-input` : `[data-swb-item="${at.row}:${at.index}"]`, false);
    };
    // A kind's item for the slot (a snippet): its panel opened at its first field to type in
    const fillKind = (kind: ItemKind) => {
      if (forRow) return;
      // (The kind it holds already, picked again: kept as it is, its text too)
      const item = this.rows[target.at.row]?.[target.at.index];
      const held = item && isKindItem(item) ? slotItemOf(item[target.key]) : undefined;
      const favorites = setSlot(this.rows, target.at, target.key, held?.type === kind.type ? held : { type: kind.type });
      this.picking = undefined;
      this.adjusting = { ...target.at, key: target.key };
      this.edit(favorites, kind.fields?.length ? `[data-swb-look] .${BASE}-field-input` : `[data-swb-look] .${BASE}-look-change`);
    };
    // An action for the slot (an optional one: or none): the search goes on for the next slot after it without one
    const fill = (id: string | undefined) => {
      if (forRow) return id === undefined ? undefined : add({ id });
      const favorites = setSlot(this.rows, target.at, target.key, id);
      const item = favorites[target.at.row]?.[target.at.index];
      const slots = this.kindOf(target.at)?.slots ?? [];
      const after = slots.slice(slots.findIndex((s) => s.key === target.key) + 1);
      const next = item && isKindItem(item) ? after.find((s) => !slotOf(item[s.key]) && !slotItemOf(item[s.key])) : undefined;
      this.picking = next ? { at: target.at, key: next.key } : undefined;
      // Every slot asked: its item's panel, where its slots are
      if (!next) this.adjusting = { row: target.at.row, index: target.at.index };
      this.edit(favorites, next ? `[data-swb-row="${row}"] .${BASE}-pick-field` : `[data-swb-look] [data-swb-slot="${target.key}"]`);
    };
    let shown: (() => void)[] = [];
    const draw = () => {
      const found = findEntries(entries, field.value);
      const query = field.value.trim().toLowerCase();
      // (Added into a row's items not pinned: a separator is not pinned)
      const separator = forRow && (!query || "separator".startsWith(query));
      // (For a slot: the kinds whose item is one action, a snippet)
      const kinds = this.context.kinds().filter((kind) => (forRow || kind.action) && wordsStart(kind.label, query));
      const pickKind = (kind: ItemKind) => (forRow ? addKind(kind) : fillKind(kind));
      // An optional slot may hold no action
      const none = !!slot?.optional && (!query || "none".startsWith(query));
      shown = [...(separator ? [() => add({ type: "separator" })] : []), ...(none ? [() => fill(undefined)] : []), ...kinds.map((kind) => () => pickKind(kind)), ...found.map((entry) => () => fill(entry.action.id))];
      const options = [
        ...(separator ? [this.option(`${BASE}-pick-separator`, "", "Separator", "", () => add({ type: "separator" }))] : []),
        ...(none ? [this.option(`${BASE}-pick-unset`, "", "None", `No action for ${slot!.label}`, () => fill(undefined))] : []),
        ...kinds.map((kind) => this.option(`${BASE}-pick-kind`, kind.icon, kind.label, kind.description, () => pickKind(kind))),
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
    if (values.wordAtCaret !== initial.wordAtCaret) changed[PATHS.wordAtCaret] = values.wordAtCaret;
    const lists = savedToolbars(values.toolbars);
    if (JSON.stringify(lists) !== JSON.stringify(savedToolbars(initial.toolbars))) changed[PATHS.favorites] = lists;
    // With the favourites, the model's version they are written in, so they are never migrated (migrations/index.ts),
    // and what the migrations changed and the toolbar did not write back yet (else the version would mark it done)
    if (PATHS.favorites in changed) {
      for (const [path, value] of Object.entries(this.migrated)) if (!(path in changed)) changed[path] = value;
      changed[PATHS.version] = SETTINGS_VERSION;
    }
    for (const name of MODULE_NAMES) if (values.modules[name] !== initial.modules[name]) changed[PATHS.module(name)] = values.modules[name];
    return changed;
  }

  /** Whether saving needs the page loaded anew: a module turned on or off, the key (the command's) */
  private reloads(changed: Readonly<Record<string, unknown>>): boolean {
    return Object.keys(changed).some((path) => path !== PATHS.favorites && path !== PATHS.wordAtCaret && path !== PATHS.version);
  }

  private update(): void {
    const changed = this.changed();
    const reload = this.reloads(changed);
    // (No key, or a toolbar's name typed that cannot be its)
    const invalid = !this.values?.shortcut || !!this.naming;
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

/** The toolbars as written to the configuration: `{ name, useFor, placement, show, rows }`, `useFor` left out where empty, empty rows left out */
function savedToolbars(lists: readonly Toolbar[]): unknown[] {
  return lists.map((list) => ({ name: list.name, ...(list.useFor.length ? { useFor: [...list.useFor] } : {}), placement: list.placement, show: list.show, rows: savedRows(list.rows) }));
}

/** Whether each word typed starts a word of a label, ignoring case (nothing typed: yes) */
function wordsStart(label: string, query: string): boolean {
  const words = label.toLowerCase().split(/\s+/);
  return query.split(/\s+/).filter(Boolean).every((typed) => words.some((word) => word.startsWith(typed)));
}
