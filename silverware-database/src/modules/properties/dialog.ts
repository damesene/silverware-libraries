// The properties' dialog: a database's schema as a list, as Notion shows it, a
// property a row (its grip, its type's icon, its name, its type), dragged to its
// place (or Alt+↑ ↓ on its grip); a press on a row opens it: its name, type, a
// select's options (a list: each its grip, its color, its name, ×; one added),
// read only, its key, Remove. What changes the schema alone is written at once
// (a name, read only, the order, a color, a property added); what changes items
// too (a key, a type, options, a property removed with its values) is proposed
// first: how many items it changes and which values it keeps as they are,
// applied only as the user says so. Every change goes through the core:
// checked, said where refused, kept for Undo.
import { systemKind, systemProperties } from "../../domain/system.ts";
import { switchControl } from "../../../../shared/controls.ts";
import { Dialogs } from "../../../../shared/dialog.ts";
import { reorder } from "../../../../shared/drag.ts";
import { el } from "../../../../shared/elements.ts";
import type { LooseProperty, Proposal, Refused, Result } from "../../core/core.ts";
import { labelOfKey } from "../../domain/loose.ts";
import type { ModuleHost } from "../../core/module.ts";
import { colorsOf, OPTION_COLORS, type OptionColor } from "../../domain/types/options.ts";
import type { PropertyType } from "../../domain/types/type.ts";
import type { Database, Params, Property } from "../../model/database.ts";
import { typeIcon } from "../../views/icons.ts";
import { optionPill, pill } from "../../views/values.ts";

// The settings dialog's look: the same rows, cards and switches
// A system property's choice among the new property's types: `system:<kind>`
const SYSTEM_PREFIX = "system:";

/** The types offered for a property of the user's (not those only the system's properties have) */
const offered = (all: readonly PropertyType[]) => all.filter((one) => one.offered !== false);

const BASE = "swd-settings";
const CLOSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';

const isRefused = (result: Result | Proposal | Refused): result is Refused => "problem" in result;

// A grip: six dots, what a row is dragged by
const GRIP = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><circle cx="6" cy="4" r="1.1"/><circle cx="10" cy="4" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12" r="1.1"/><circle cx="10" cy="12" r="1.1"/></svg>';
const BACK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m10 4-4 4 4 4"/></svg>';
const CHEVRON = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 4 4-4 4"/></svg>';
const SHOWN = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8s2.25-4.5 6-4.5S14 8 14 8s-2.25 4.5-6 4.5S2 8 2 8z"/><circle cx="8" cy="8" r="1.75"/></svg>';
const HIDDEN = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8s2.25-4.5 6-4.5S14 8 14 8s-2.25 4.5-6 4.5S2 8 2 8z"/><circle cx="8" cy="8" r="1.75"/><path d="M3 13 13 3"/></svg>';
const LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';

/** An option as it is edited: the text it was saved with (none: added now), the text it has */
type OptionDraft = { readonly was: string | undefined; text: string };

/** The options as the drafts have them: trimmed, empty ones and repeats left out */
function optionsTyped(drafts: readonly OptionDraft[]): string[] {
  return [...new Set(drafts.map((one) => one.text.trim()).filter(Boolean))];
}

/** The colors after the options were edited: an option renamed keeps its color, one gone takes its color with it */
function colorsRenamed(colors: Readonly<Record<string, OptionColor>>, drafts: readonly OptionDraft[]): Record<string, OptionColor> {
  // (Maps of no prototype, read by own keys: an option named "constructor" or "__proto__" is an option like any other)
  const renamed: Record<string, OptionColor> = Object.create(null);
  for (const draft of drafts) {
    const color = draft.was === undefined || !Object.hasOwn(colors, draft.was) ? undefined : colors[draft.was];
    if (color && draft.text.trim()) renamed[draft.text.trim()] ??= color;
  }
  return renamed;
}

/** The options renamed, an old name to its new one (an option emptied is taken away, no rename; one added has no old name) */
function optionsRenamed(drafts: readonly OptionDraft[]): Record<string, string> {
  const renames: Record<string, string> = Object.create(null);
  for (const draft of drafts) if (draft.was !== undefined && draft.text.trim() && draft.text.trim() !== draft.was) renames[draft.was] = draft.text.trim();
  return renames;
}

/** A value with its maps' keys in order: params compared whatever order their keys were written in */
function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedKeys((value as Record<string, unknown>)[key])]));
  return value;
}

/** Params with the colors of the options they have (a color of an option gone left out; none: no `colors`) */
function withColors(params: Params, colors: Readonly<Record<string, OptionColor>>): Params {
  const options = Array.isArray(params.options) ? params.options : [];
  const kept = Object.fromEntries(Object.entries(colors).filter(([option]) => options.includes(option)));
  const { colors: _gone, ...rest } = params;
  return Object.keys(kept).length ? { ...rest, colors: kept } : rest;
}

function optionsOf(property: Property): readonly string[] {
  const options = property.params.options;
  return Array.isArray(options) ? options.filter((one): one is string => typeof one === "string") : [];
}

/** A choice the review of a change offers (Remove: its values too or not), the change proposed again as it is switched */
type ReviewChoice = { readonly label: string; readonly hint: string; readonly on: boolean; readonly change: (on: boolean) => void; readonly switched?: boolean };

export class PropertiesDialog {
  private readonly dialogs: Dialogs;
  private body: HTMLElement | undefined;
  private database: Database | undefined;
  // A change of items proposed, shown over the properties until applied or put aside
  private proposal: { readonly proposal: Proposal; readonly what: string; readonly draft?: string; readonly choice?: ReviewChoice } | undefined;
  // The keys the items keep that the schema has none of, shown on their own screen as asked (read then: every item looked
  // through), the type picked for each; undefined: the properties shown
  private loose: { list: readonly LooseProperty[] | undefined; readonly types: Map<string, string> } | undefined;
  // What is typed and not saved yet, kept as the dialog is drawn anew (another change made meanwhile):
  // a select's options by its property's key, the new property's label and type
  private readonly drafts = new Map<string, OptionDraft[]>();
  private adding = { label: "", type: "" };
  // The property open (its details shown), by its key
  private opened: string | undefined;
  // Told as the dialog closes (what opened it waits on `whenClosed`)
  private whenClosed: Promise<void> = Promise.resolve();
  private closedNow: () => void = () => {};
  // The properties whose Advanced is open (by key): kept as the dialog is drawn anew
  private readonly advancedOpen = new Set<string>();
  // A change being written: nothing else offered meanwhile (Apply twice wrote nothing the second time and said so)
  private busy = false;

  constructor(
    private readonly host: ModuleHost,
    private readonly id: string,
    private readonly changed: () => void,
  ) {
    this.dialogs = new Dialogs(host.document, { base: BASE, closeIcon: CLOSE });
  }

  get isOpen(): boolean {
    return this.dialogs.isOpen;
  }

  /** Opened (at a property, its details shown; or at the field adding one); open already: shown there. Resolved as it closes */
  async open(at?: { readonly property?: string; readonly add?: boolean }): Promise<void> {
    if (this.dialogs.isOpen) {
      // (A change being written: its review and progress stay as they are)
      if (this.busy) return this.whenClosed;
      if (at?.property) this.opened = at.property;
      this.draw();
      this.focusAt(at);
      return this.whenClosed;
    }
    const read = await this.host.database(this.id);
    if (!read || this.dialogs.isOpen) return this.whenClosed;
    this.whenClosed = new Promise((resolve) => (this.closedNow = resolve));
    this.database = read.value;
    // (Opened anew: on the properties, not on the screen of the keys outside the schema it was closed on)
    this.loose = undefined;
    this.drafts.clear();
    this.adding = { label: "", type: "" };
    this.opened = at?.property;
    this.body = el(this.host.document, "div", "swd-properties");
    this.dialogs.open({
      title: `${read.value.name}: properties`,
      subtitle: `Each item's values are kept in its ${this.host.noun.one}`,
      content: this.body,
      // (Options edited and not saved, a property's name typed and not added: lost only once the user agrees)
      // (Not while a change is written: it would go on unseen, the page to be kept open meanwhile)
      dismiss: async () => {
        if (this.busy) {
          this.host.ui.notify("Wait until the change is shown or written: closed now, it would go on unseen", { type: "info" });
          return false;
        }
        return (!this.drafts.size && !this.adding.label.trim()) || !!(await this.host.ui.ask?.("Close the properties? The options edited and the property typed and not saved are lost.", { destructive: true }));
      },
      closed: () => this.closedNow(),
    });
    this.draw();
    this.focusAt(at);
    return this.whenClosed;
  }

  /** The focus where the dialog was opened at: a property's name, the field adding one */
  private focusAt(at?: { readonly property?: string; readonly add?: boolean }): void {
    const target = at?.add ? ".swd-property-new-label" : at?.property ? `[data-property="${CSS.escape(at.property)}"] .swd-property-label` : undefined;
    if (target) this.body?.querySelector<HTMLElement>(target)?.focus();
  }

  close(): void {
    this.dialogs.close();
  }

  /** The database as it is now, after a change made elsewhere (another place, an Undo): drawn anew, what is typed kept */
  async follow(): Promise<void> {
    if (!this.dialogs.isOpen || this.busy) return;
    const read = await this.host.database(this.id);
    // (Drawn anew only where it changed: the focus and what is typed stay)
    if (!read || JSON.stringify(read.value) === JSON.stringify(this.database)) return;
    this.database = read.value;
    this.draw();
  }

  /** The database read again after a change, the dialog and the places drawn anew */
  private async reread(): Promise<void> {
    const read = await this.host.database(this.id);
    if (read) this.database = read.value;
    this.changed();
    // (On the screen of the keys outside the schema: those read anew, one added or taken off gone from them)
    if (this.loose) await this.readLoose();
    this.draw();
  }

  /** The keys outside the schema shown, read now */
  private async showLoose(): Promise<void> {
    this.loose = { list: undefined, types: new Map() };
    this.draw();
    await this.readLoose();
    this.draw();
    this.body?.querySelector<HTMLElement>(".swd-loose-back")?.focus();
  }

  private async readLoose(): Promise<void> {
    const loose = this.loose;
    if (!loose) return;
    const read = await this.host.core.looseProperties(this.id);
    if (this.loose === loose) loose.list = Array.isArray(read) ? read : [];
  }

  private async run(write: () => Promise<Result | Proposal | Refused>, what: string, draft?: string): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      const result = await write();
      if (isRefused(result)) {
        // (Refused, said to the user: the database as it is now, so what is shown is what a next change starts from; on the
        // screen of the keys outside the schema, those too: one gone meanwhile)
        const read = await this.host.database(this.id);
        if (read) this.database = read.value;
        if (this.loose) await this.readLoose();
        this.draw();
        return false;
      }
      // A change of items: shown first, applied as the user says
      if ("plan" in result) {
        this.proposal = { proposal: result, what, ...(draft ? { draft } : {}) };
        this.draw();
        return true;
      }
      await this.reread();
      return true;
    } finally {
      this.busy = false;
    }
  }

  private draw(): void {
    const { document: doc } = this.host;
    const database = this.database;
    if (!this.body || !database) return;
    if (this.loose && !this.proposal) {
      const focused = this.body.contains(doc.activeElement) ? (doc.activeElement as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key : undefined;
      this.body.replaceChildren(this.looseScreen());
      // (The focus kept in the screen: on its row where it is still there, else on its way back)
      if (!this.body.contains(doc.activeElement)) ((focused ? this.body.querySelector<HTMLElement>(`.swd-loose-row[data-key="${CSS.escape(focused)}"] .swd-loose-add`) : null) ?? this.body.querySelector<HTMLElement>(".swd-loose-back"))?.focus();
      return;
    }
    if (this.proposal) {
      this.body.replaceChildren(this.review(this.proposal.proposal, this.proposal.what, this.proposal.choice));
      // (Drawn after its switch was flipped: the focus on the switch, so a key meant for it applies nothing)
      this.body.querySelector<HTMLElement>(this.proposal.choice?.switched ? ".swd-property-choice input" : ".swd-property-apply")?.focus();
      return;
    }
    // (The focus kept on what had it: a row's head or grip, a field, by its class and property)
    const active = doc.activeElement;
    const focused = active instanceof HTMLElement && this.body.contains(active) ? { key: active.closest<HTMLElement>("[data-property]")?.dataset.property, cls: [...active.classList].find((one) => one.startsWith("swd-prop") || one.startsWith("swd-option")) } : undefined;
    const list: HTMLElement = el(doc, "div", { class: "swd-props", attrs: { role: "list", "aria-label": "Properties" } });
    list.append(...database.properties.map((property, at) => this.property(property, at, () => list)));
    this.body.replaceChildren(database.properties.length ? list : el(doc, "p", { class: `${BASE}-hint`, text: "No property yet: an item has its name alone." }), this.adder());
    // (What had it gone, a switch drawn anew: its property's head, else the dialog's body, so its keys stay the dialog's)
    if (focused) {
      const row = focused.key ? `[data-property="${CSS.escape(focused.key)}"]` : undefined;
      const enabled = (one: HTMLElement | null) => (one && !(one as HTMLButtonElement).disabled ? one : null);
      const again = enabled(row && focused.cls ? this.body.querySelector<HTMLElement>(`${row} .${focused.cls}`) : null) ?? (row ? this.body.querySelector<HTMLElement>(`${row} .swd-prop-head`) : null);
      if (again) again.focus({ preventScroll: true });
      else {
        this.body.tabIndex = -1;
        this.body.focus({ preventScroll: true });
      }
    }
  }

  /** A property: its row (grip, type, name, type's name; a press opens it), its details where open */
  private property(property: Property, at: number, list: () => HTMLElement): HTMLElement {
    const { document: doc, core, types } = this.host;
    const type = types.named(property.type);
    const open = this.opened === property.key;
    const grip = el(doc, "button", { class: "swd-prop-grip", html: GRIP, title: "Drag to move (Alt+↑ ↓)", attrs: { "aria-label": `Move ${property.label} (Alt+Up, Alt+Down)` } });
    const head = el(
      doc,
      "button",
      { class: "swd-prop-head", attrs: { "aria-expanded": String(open), "aria-label": `${property.label}, ${type?.label ?? property.type}${property.required ? ", required" : ""}${property.hidden ? ", hidden in views" : ""}${property.system ? ", given by the system" : property.readonly ? ", locked in views" : ""}` } },
      el(doc, "span", { class: "swd-prop-icon", html: typeIcon(type?.name ?? "text") }),
      el(doc, "span", { class: "swd-prop-name", text: property.label }, ...(property.required ? [el(doc, "span", { class: "swd-prop-required", text: "*", title: "Required", attrs: { "aria-hidden": "true" } })] : [])),
      ...(property.readonly ? [el(doc, "span", { class: "swd-prop-lock", html: LOCK, title: property.system ? "Given by the system" : "Locked in views" })] : []),
      el(doc, "span", { class: "swd-prop-type", text: systemKind(property.system, this.host.noun)?.label ? `System: ${systemKind(property.system, this.host.noun)!.label}` : (type?.label ?? property.type) }),
    );
    head.addEventListener("click", () => {
      this.opened = open ? undefined : property.key;
      this.draw();
    });
    // Shown in the views or hidden, from the list itself: an eye, written at once
    const eye = el(doc, "button", {
      class: "swd-prop-eye",
      html: property.hidden ? HIDDEN : SHOWN,
      title: property.hidden ? "Hidden in views: show it" : "Shown in views: hide it (still kept, filtered and sorted by)",
      attrs: { "aria-pressed": String(!property.hidden), "aria-label": `${property.label} shown in views` },
      run: () => void this.run(() => core.setPropertyHidden(this.id, property.key, !property.hidden), ""),
    });
    const chevron = el(doc, "span", { class: "swd-prop-chevron", html: CHEVRON });
    chevron.addEventListener("click", () => head.click());
    const row = el(doc, "div", { class: `swd-prop${open ? " swd-prop-open" : ""}${property.hidden ? " swd-prop-is-hidden" : ""}`, attrs: { role: "listitem", "data-property": property.key } }, el(doc, "div", "swd-prop-row", grip, head, eye, chevron));
    // Dragged by its grip to its place (written as it is let go: the order alone); Alt+↑ ↓ the same from the keys
    const moveTo = (index: number) => {
      if (index !== at) void this.run(() => core.moveProperty(this.id, property.key, index), "");
    };
    grip.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      grip.focus();
      reorder(event, {
        element: row,
        base: "swd-props",
        layer: this.body,
        flow: "block",
        containers: () => [list()],
        items: (container) => [...container.querySelectorAll<HTMLElement>(":scope > .swd-prop")],
        done: (to) => (to ? moveTo(to.index) : this.draw()),
      });
    });
    grip.addEventListener("keydown", (event) => {
      if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
      event.preventDefault();
      moveTo(Math.max(0, at + (event.key === "ArrowUp" ? -1 : 1)));
    });
    if (open) row.append(this.details(property));
    return row;
  }

  /** A property's details: its name, type, a select's options and their colors, read only, its key, Remove */
  private details(property: Property): HTMLElement {
    const { document: doc, core, types } = this.host;
    const label = el(doc, "input", { class: "swd-property-label", attrs: { "aria-label": `Name of ${property.label}`, value: property.label, "data-key": property.key } });
    label.addEventListener("change", () => {
      if (label.value.trim() && label.value.trim() !== property.label) void this.run(() => core.renameProperty(this.id, property.key, label.value), "");
    });
    const remove = el(doc, "button", { class: "swd-property-remove", text: "Remove property", attrs: { "aria-label": `Remove ${property.label}` }, run: () => void this.removing(property) });
    const field = (name: string, control: HTMLElement, hint?: string) => el(doc, "label", "swd-prop-field", el(doc, "span", "swd-prop-field-name", name, ...(hint ? [el(doc, "span", { class: `${BASE}-hint`, text: hint })] : [])), control);
    // A system property: its name (and shown or hidden, its place, from the list); what it is, its key; no type, setting or value to change
    if (property.system !== undefined) {
      const kind = systemKind(property.system, this.host.noun);
      return el(
        doc,
        "div",
        "swd-prop-detail",
        field("Name", label),
        el(doc, "p", { class: "swd-prop-system", text: kind ? `Given by the system: ${kind.hint}. Read only.` : `Given by the system ("${property.system}", not known to this version): no values.` }),
        field("Key", el(doc, "input", { class: "swd-property-key", attrs: { "aria-label": `Key of ${property.label}`, value: property.key, readonly: "" } }), "How queries name it"),
        el(doc, "div", "swd-prop-actions", remove),
      );
    }
    const type = el(doc, "select", { class: "swd-property-type", attrs: { "aria-label": `Type of ${property.label}` } }, ...offered(types.all()).map((one) => new Option(one.label, one.name, false, one.name === property.type)));
    // (A type not defined now, or not offered, kept as it is)
    if (!offered(types.all()).some((one) => one.name === property.type)) type.append(new Option(types.named(property.type)?.label ?? property.type, property.type, false, true));
    type.addEventListener("change", () => void this.run(() => core.retypeProperty(this.id, property.key, type.value), `Change the type of ${property.label}`));
    const locked = switchControl(doc, BASE, property.readonly, (on) => void this.run(() => core.setPropertyReadonly(this.id, property.key, on), ""));
    locked.querySelector("input")?.setAttribute("aria-label", `${property.label} locked in views`);
    const required = switchControl(doc, BASE, property.required ?? false, (on) => void this.run(() => core.setPropertyRequired(this.id, property.key, on), ""));
    required.querySelector("input")?.setAttribute("aria-label", `${property.label} required`);
    const key = el(doc, "input", { class: "swd-property-key", attrs: { "aria-label": `Key of ${property.label}`, value: property.key } });
    key.addEventListener("change", () => {
      if (key.value.trim() && key.value.trim() !== property.key) void this.run(() => core.rekeyProperty(this.id, property.key, key.value.trim()), `Change the key of ${property.label} to ${key.value.trim()}`);
    });
    return el(
      doc,
      "div",
      "swd-prop-detail",
      field("Name", label),
      field("Type", type),
      // (Options where its values are picked from them: a select's, a multi-select's, a type of the user's so)
      ...(types.named(property.type)?.look === "options" ? [this.options(property)] : []),
      // (A value turned by a press has no empty one to require)
      ...(types.named(property.type)?.editor === "toggle"
        ? []
        : [
            el(
              doc,
              "label",
              { class: "swd-prop-field swd-property-required", title: "Required: an item without a value shows it missing; a value is never taken off" },
              el(doc, "span", "swd-prop-field-name", "Required", el(doc, "span", { class: `${BASE}-hint`, text: "An item without a value shows it missing" })),
              required,
            ),
          ]),
      // What is seldom set, folded away: open while a property is (kept so as it is drawn anew)
      this.advanced(property, [
        el(
          doc,
          "label",
          { class: "swd-prop-field swd-property-locked", title: `Locked: no view offers to change it (its ${this.host.noun.one} can still be edited by hand, a script can still write it)` },
          el(doc, "span", "swd-prop-field-name", "Locked in views", el(doc, "span", { class: `${BASE}-hint`, text: "For values a script or another tool keeps" })),
          locked,
        ),
        field("Key", key, `How ${this.host.noun.many} and queries name it`),
      ]),
      el(doc, "div", "swd-prop-actions", remove),
    );
  }

  /** Advanced: what is seldom set (locked in views, the key), folded under its summary; open as long as the dialog is for that property */
  private advanced(property: Property, fields: readonly HTMLElement[]): HTMLElement {
    const doc = this.host.document;
    const box = el(doc, "details", "swd-prop-advanced", el(doc, "summary", { class: "swd-prop-advanced-summary", text: "Advanced" }), ...fields);
    if (this.advancedOpen.has(property.key) || property.readonly) box.open = true;
    box.addEventListener("toggle", () => void (box.open ? this.advancedOpen.add(property.key) : this.advancedOpen.delete(property.key)));
    return box;
  }

  /**
   * A select's options as a list: each its grip (dragged to its place, Alt+↑ ↓), its color (written at once, an
   * option saved only), its name, ×; one added under them. Saved together (Save options): a change of type, shown first
   */
  private options(property: Property): HTMLElement {
    const { document: doc, core } = this.host;
    const saved = optionsOf(property);
    const drafts = this.drafts.get(property.key) ?? saved.map((text) => ({ was: text, text }));
    const changed = () => JSON.stringify(optionsTyped(drafts)) !== JSON.stringify(saved) || drafts.some((one) => one.was !== undefined && one.text.trim() !== one.was);
    const keep = () => {
      if (changed()) this.drafts.set(property.key, drafts);
      else this.drafts.delete(property.key);
      save.disabled = discard.disabled = !changed();
    };
    const rows = el(doc, "div", { class: "swd-options", attrs: { role: "list", "aria-label": `Options of ${property.label}` } });
    const palette = el(doc, "div", { class: "swd-option-palette", attrs: { hidden: "" } });
    const drawRows = () => rows.replaceChildren(...drafts.map((draft) => optionRow(draft)));
    const optionRow = (draft: OptionDraft): HTMLElement => {
      const grip = el(doc, "button", { class: "swd-prop-grip swd-option-grip", html: GRIP, title: "Drag to move (Alt+↑ ↓)", attrs: { "aria-label": `Move ${draft.text || "the new option"}` } });
      // Its color: of an option saved, unchanged (a new or renamed one gets its color once saved)
      const colorable = draft.was !== undefined && draft.was === draft.text.trim();
      const color = colorable
        ? el(doc, "button", { class: "swd-option-color", title: `The color of ${draft.was}`, attrs: { "aria-expanded": "false", "aria-label": `Color of ${draft.was}`, "data-option": draft.was! } }, optionPill(doc, property, draft.was!))
        : el(doc, "span", { class: "swd-option-color swd-option-color-none", title: "Its color can be picked once it is saved" }, pill(doc, " ", undefined));
      const name = el(doc, "input", { class: "swd-option-name", attrs: { "aria-label": "Option", value: draft.text, placeholder: "Option" } });
      name.addEventListener("input", () => {
        draft.text = name.value;
        keep();
      });
      const remove = el(doc, "button", {
        class: "swd-option-remove",
        html: CLOSE,
        title: "Take this option away (once saved)",
        attrs: { "aria-label": `Take away ${draft.text || "the option"}` },
        run: () => {
          const at = drafts.indexOf(draft);
          drafts.splice(at, 1);
          keep();
          drawRows();
          (rows.children[at]?.querySelector<HTMLElement>(".swd-option-name") ?? rows.parentElement?.querySelector<HTMLElement>(".swd-option-new"))?.focus({ preventScroll: true });
        },
      });
      const row = el(doc, "div", { class: "swd-option", attrs: { role: "listitem" } }, grip, color, name, remove);
      if (color instanceof HTMLButtonElement) color.addEventListener("click", () => this.palette(property, draft.was!, color, palette, row));
      const move = (to: number) => {
        const from = drafts.indexOf(draft);
        if (to < 0 || to >= drafts.length || to === from) return;
        drafts.splice(from, 1);
        drafts.splice(to, 0, draft);
        keep();
        drawRows();
        rows.children[to]?.querySelector<HTMLElement>(".swd-option-grip")?.focus();
      };
      grip.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        grip.focus();
        reorder(event, {
          element: row,
          base: "swd-props",
          layer: this.body,
          flow: "block",
          containers: () => [rows],
          items: (container) => [...container.querySelectorAll<HTMLElement>(":scope > .swd-option")],
          done: (to) => (to ? move(to.index) : drawRows()),
        });
      });
      grip.addEventListener("keydown", (event) => {
        if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
        event.preventDefault();
        move(drafts.indexOf(draft) + (event.key === "ArrowUp" ? -1 : 1));
      });
      return row;
    };
    drawRows();
    const added = el(doc, "input", { class: "swd-option-new", attrs: { placeholder: "+ Add option", "aria-label": `Add an option to ${property.label}` } });
    added.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || !added.value.trim()) return;
      event.preventDefault();
      drafts.push({ was: undefined, text: added.value.trim() });
      added.value = "";
      keep();
      drawRows();
    });
    const save = el(doc, "button", {
      class: `${BASE}-save swd-property-options-save`,
      text: "Save options",
      run: async () => {
        // Made of the params as drawn: changed meanwhile (an option added, a color given elsewhere), nothing proposed from
        // them, the dialog drawn as it is now, the options edited kept to save again
        // Two options of one name: not saved (one would go, and its color with it), both marked
        const names = drafts.map((one) => one.text.trim()).filter(Boolean);
        const twice = names.filter((one, at) => names.indexOf(one) !== at);
        for (const input of rows.querySelectorAll<HTMLInputElement>(".swd-option-name")) input.classList.toggle("swd-invalid", twice.includes(input.value.trim()));
        if (twice.length) return this.host.ui.notify(`${property.label}: "${twice[0]}" is two options: give each a name of its own`, { type: "error" });
        const now = (await this.host.database(this.id))?.value.properties.find((one) => one.key === property.key);
        if (!now || JSON.stringify(sortedKeys(now.params)) !== JSON.stringify(sortedKeys(property.params))) {
          this.host.ui.notify(`${property.label}: its settings changed meanwhile: shown as they are now, your options kept to save again`, { type: "error" });
          const read = await this.host.database(this.id);
          if (read) this.database = read.value;
          return this.draw();
        }
        const params: Params = withColors({ ...property.params, options: optionsTyped(drafts) }, colorsRenamed(colorsOf(property.params), drafts));
        // (The options edited kept until their change is written: a review put aside by Cancel, or applied writing nothing, keeps them)
        // The items' values renamed with their options, in the same write (an option emptied is taken away, no rename)
        const renames = optionsRenamed(drafts);
        await this.run(() => core.retypeProperty(this.id, property.key, property.type, params, renames), `Change the options of ${property.label}`, property.key);
      },
    });
    const discard = el(doc, "button", {
      class: `${BASE}-cancel swd-property-options-discard`,
      text: "Discard",
      run: () => {
        this.drafts.delete(property.key);
        this.draw();
      },
    });
    save.disabled = discard.disabled = !changed();
    return el(doc, "div", "swd-prop-field swd-prop-options", el(doc, "span", "swd-prop-field-name", "Options"), el(doc, "div", "swd-options-box", rows, palette, added, el(doc, "div", "swd-options-foot", discard, save)));
  }

  /** An option's colors to pick, under its row (Auto: its place's; Custom…: one of your own), written at once */
  private palette(property: Property, option: string, button: HTMLElement, palette: HTMLElement, row: HTMLElement): void {
    const { document: doc, core } = this.host;
    const shown = !palette.hidden && palette.dataset.option === option;
    for (const one of palette.parentElement?.querySelectorAll(".swd-option-color[aria-expanded]") ?? []) one.setAttribute("aria-expanded", "false");
    if (shown) return void (palette.hidden = true);
    const pick = (color: OptionColor | undefined) => {
      // (No prototype: an option named "__proto__" a key like any other)
      const colors: Record<string, OptionColor> = Object.assign(Object.create(null), colorsOf(property.params));
      if (color) colors[option] = color;
      else delete colors[option];
      // (Against the params drawn: changed meanwhile, the core refuses and the dialog shows them as they are now)
      void this.run(() => core.setPropertyParams(this.id, property.key, withColors(property.params, colors), property.params), "").then(() => {
        // The focus back on the option's color, the dialog drawn anew (a keyboard's user goes on from there)
        this.body?.querySelector<HTMLElement>(`.swd-option-color[data-option="${CSS.escape(option)}"]`)?.focus({ preventScroll: true });
      });
    };
    const own = colorsOf(property.params);
    const given = Object.hasOwn(own, option) ? own[option] : undefined;
    const custom = given?.startsWith("#") ? (given as `#${string}`) : undefined;
    const input = el(doc, "input", { class: "swd-option-own-input", attrs: { type: "color", "aria-label": `${option}: a color of your own`, value: custom ?? "#3a7bd5" } });
    input.addEventListener("change", () => pick(input.value.toLowerCase() as OptionColor));
    palette.dataset.option = option;
    palette.replaceChildren(
      el(doc, "button", { class: "swd-option-swatch swd-option-auto", text: "Auto", title: "The color of its place among the options", attrs: { "aria-pressed": String(!given) }, run: () => pick(undefined) }),
      ...OPTION_COLORS.map((color, at) =>
        el(doc, "button", { class: "swd-option-swatch", title: color, attrs: { "aria-label": `${option}: ${color}`, "aria-pressed": String(given === color), "data-color-name": color }, run: () => pick(color) }, pill(doc, color, at)),
      ),
      el(doc, "label", { class: "swd-option-swatch swd-option-own", title: "A color of your own", attrs: { "aria-pressed": String(!!custom) } }, input, custom ? pill(doc, custom, custom) : el(doc, "span", { text: "Custom…" })),
    );
    row.after(palette);
    palette.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }

  /**
   * A property removed, the change shown first: its values kept in the items
   * (shown again if it comes back) or, the review's switch turned on, taken
   * off them too (the change proposed again so, what it writes shown)
   */
  private async removing(property: Property, values = false, switched = false): Promise<void> {
    const { core } = this.host;
    const done = await this.run(() => core.removeProperty(this.id, property.key, { values }), `Remove ${property.label}${values ? " and its values" : ""}`);
    // (A system property's values are none of the items': nothing to choose)
    if (!done || !this.proposal || property.system !== undefined) return;
    this.proposal = {
      ...this.proposal,
      choice: {
        label: "Also take its values off the items",
        hint: `Off: its values stay in the ${this.host.noun.many} (shown again if it comes back). On: taken off the items holding one; Undo puts them back.`,
        on: values,
        switched,
        // (Its label as it is now: renamed meanwhile, the key the same)
        change: (on) => void this.removing(this.database?.properties.find((one) => one.key === property.key) ?? property, on, true),
      },
    };
    this.draw();
  }

  /** A property added: its label and type (kept as typed while the dialog is drawn anew) */
  private adder(): HTMLElement {
    const { document: doc, core, types } = this.host;
    const label = el(doc, "input", { class: "swd-property-new-label", attrs: { placeholder: "+ Add a property", "aria-label": "New property's name" } });
    label.value = this.adding.label;
    label.addEventListener("input", () => void (this.adding.label = label.value));
    const there = new Set(this.database?.properties.map((one) => one.system).filter((one): one is string => one !== undefined));
    const system = el(
      doc,
      "optgroup",
      { attrs: { label: "System (read only)" } },
      ...systemProperties(this.host.noun).map((one) => {
        const option = new Option(one.label, `${SYSTEM_PREFIX}${one.kind}`, false, `${SYSTEM_PREFIX}${one.kind}` === this.adding.type);
        option.disabled = there.has(one.kind);
        option.title = there.has(one.kind) ? `${one.label} is there already` : one.hint;
        return option;
      }),
    );
    const type = el(doc, "select", { class: "swd-property-new-type", attrs: { "aria-label": "New property's type" } }, ...offered(types.all()).map((one) => new Option(one.label, one.name, false, one.name === this.adding.type)), system);
    // A system property picked: its own name offered, which may be changed
    type.addEventListener("change", () => {
      this.adding.type = type.value;
      const kind = type.value.startsWith(SYSTEM_PREFIX) ? systemKind(type.value.slice(SYSTEM_PREFIX.length), this.host.noun) : undefined;
      if (kind && !label.value.trim()) label.value = this.adding.label = kind.label;
    });
    const add = el(doc, "button", {
      class: "swd-property-add",
      text: "Add",
      run: async () => {
        const kind = type.value.startsWith(SYSTEM_PREFIX) ? systemKind(type.value.slice(SYSTEM_PREFIX.length), this.host.noun) : undefined;
        if (!label.value.trim() && !kind) return label.focus();
        this.adding = { label: label.value, type: type.value };
        const wanted = kind ? { label: label.value, type: kind.type, system: kind.kind } : { label: label.value, type: type.value };
        if (await this.run(() => core.addProperty(this.id, wanted), "")) {
          this.adding = { label: "", type: "" };
          this.draw();
        }
      },
    });
    label.addEventListener("keydown", (event) => {
      if (event.key === "Enter") add.click();
    });
    // The keys the items keep that the schema has none of: on a screen of their own, read only as it is asked for
    const loose = el(doc, "button", { class: "swd-property-loose-open", text: "Values outside the database…", title: `Keys the items keep that no property is (a property removed with its values kept, a key typed in a ${this.host.noun.one}): add them again, or take them off`, run: () => void this.showLoose() });
    return el(doc, "div", "swd-property-adder-box", el(doc, "div", "swd-property-adder", label, type, add), loose);
  }

  /**
   * The keys the items keep that the schema has none of: each with how many
   * items keep it and a few of their values, a type (the one they look like
   * first), Add (a property of that key, its values back in the views) and
   * Remove from pages (shown first, as any change of items)
   */
  private looseScreen(): HTMLElement {
    const { document: doc, core, types } = this.host;
    const loose = this.loose!;
    const back = el(doc, "button", {
      class: "swd-loose-back",
      html: BACK,
      title: "Back to the properties",
      attrs: { "aria-label": "Back to the properties" },
      run: () => {
        this.loose = undefined;
        this.draw();
      },
    });
    const head = el(doc, "div", "swd-loose-head", back, el(doc, "span", { class: "swd-loose-title", text: "Values outside the database" }));
    const hint = el(doc, "p", { class: `${BASE}-hint`, text: `Keys the items keep in their ${this.host.noun.many} that no property of the database is: a property removed with its values kept, a key typed in a ${this.host.noun.one} or another tool's.` });
    if (!loose.list) return el(doc, "div", "swd-loose", head, hint, el(doc, "p", { class: "swd-loose-reading", text: "Reading the items…" }));
    if (!loose.list.length) return el(doc, "div", "swd-loose", head, hint, el(doc, "p", { class: "swd-loose-none", text: "Every key the items keep is a property of the database." }));
    const rows = loose.list.map((one) => {
      const type = el(doc, "select", { class: "swd-loose-type", attrs: { "aria-label": `Type of ${one.key}` } }, ...offered(types.all()).map((t) => new Option(t.label, t.name, false, t.name === (loose.types.get(one.key) ?? one.type))));
      type.addEventListener("change", () => void loose.types.set(one.key, type.value));
      const add = el(doc, "button", {
        class: "swd-loose-add",
        text: "Add",
        title: `Add ${one.key} as a property: its values shown again`,
        // (A select or a multi-select taking its values as its options: none refused as it is added)
        run: () => void this.run(() => core.addProperty(this.id, { label: labelOfKey(one.key), type: type.value, key: one.key, ...(types.named(type.value)?.look === "options" ? { params: { options: [...one.options] } } : {}) }), ""),
      });
      const remove = el(doc, "button", {
        class: "swd-loose-remove",
        text: `Remove from ${this.host.noun.many}`,
        title: `Take ${one.key} off the items keeping it (shown first)`,
        run: () => void this.run(() => core.removeLooseProperty(this.id, one.key), `Take "${one.key}" off the items`),
      });
      return el(
        doc,
        "div",
        { class: "swd-loose-row", attrs: { role: "listitem", "data-key": one.key } },
        el(doc, "span", "swd-loose-key", el(doc, "code", { text: one.key }), el(doc, "span", { class: "swd-loose-count", text: one.items === 1 ? "1 item" : `${one.items} items` })),
        el(doc, "span", { class: "swd-loose-samples", text: one.samples.join(", "), title: one.samples.join(", ") }),
        el(doc, "span", "swd-loose-actions", type, add, remove),
      );
    });
    return el(doc, "div", "swd-loose", head, hint, el(doc, "div", { class: "swd-loose-list", attrs: { role: "list", "aria-label": "Values outside the database" } }, ...rows));
  }

  /** A change of items shown before it is applied: how many items, the values kept as they are */
  private review(proposal: Proposal, what: string, choice?: ReviewChoice): HTMLElement {
    const { document: doc, core } = this.host;
    const items = proposal.plan.planned.filter((one) => "item" in one.target).length;
    const left = proposal.plan.skipped.length;
    const kept = proposal.unreadable?.length ?? 0;
    const count = (n: number) => (n === 1 ? "1 item" : `${n} items`);
    // Each item a page of its own: as many pages written, one after another (the database's own page too)
    const pages = proposal.documents?.count ?? 0;
    const number = (n: number) => n.toLocaleString("en-US");
    const lines = [
      `${what}: ${items === 0 ? "no item's value changes" : items === 1 ? "one item changes" : `${items} items change`}.`,
      // Each option renamed with the items whose values follow it
      ...(proposal.renamed ?? []).filter((one) => one.items > 0).map((one) => `${count(one.items)}: ${one.from} → ${one.to}`),
      kept
        ? proposal.renamed
          ? `${kept === 1 ? "One item holds a value" : `${kept} items hold values`} not among the options: shown invalid, nothing of ${kept === 1 ? "it" : "them"} taken away.`
          : `${kept === 1 ? "One value does" : `${kept} values do`} not read as the new type: kept as ${kept === 1 ? "it is" : "they are"}, shown invalid.`
        : "",
      left ? `${left === 1 ? "One part" : `${left} parts`} cannot be changed and will be left: ${[...new Set(proposal.plan.skipped.map((one) => one.reason))].join("; ")}.` : "",
      pages ? `Writes ${pages === 1 ? `1 ${this.host.noun.one}` : `${number(pages)} ${this.host.noun.many}`}${proposal.documents?.many ? ": it takes a while; keep this window open until it is done (stopped halfway, the items not written yet keep their old values)" : ""}.` : "",
    ].filter(Boolean);
    // What is held still while the change is written (the choice's switch)
    const holding: HTMLInputElement[] = [];
    // How far the write is, told as it goes (a store of pages writes them one after another)
    const progress = el(doc, "p", { class: "swd-property-progress", attrs: { hidden: "" } });
    const apply = el(doc, "button", {
      class: `${BASE}-save swd-property-apply`,
      text: "Apply",
      run: async () => {
        if (this.busy) return;
        this.busy = true;
        apply.disabled = cancel.disabled = true;
        for (const one of holding) one.disabled = true;
        const draft = this.proposal?.draft;
        try {
          const result = await core.apply(proposal, (done, of) => {
            progress.hidden = false;
            progress.textContent = `Written ${number(done)} of ${number(of)}${pages ? ` ${this.host.noun.many}` : ""}…`;
          });
          if (draft && !("problem" in result)) this.drafts.delete(draft);
        } finally {
          this.busy = false;
          this.proposal = undefined;
        }
        await this.reread();
      },
    });
    const cancel = el(doc, "button", {
      class: `${BASE}-cancel swd-property-cancel`,
      text: "Cancel",
      run: () => {
        if (this.busy) return;
        this.proposal = undefined;
        this.draw();
      },
    });
    // A choice of what the change is (the values taken off too, or not): switched, the change proposed again, the switch held
    // still meanwhile (and while the change is written), so what it shows is what Apply writes
    const chosen = choice
      ? switchControl(doc, BASE, choice.on, (on) => {
          if (this.busy) return void (switchBox!.checked = !on);
          switchBox!.disabled = true;
          choice.change(on);
        })
      : undefined;
    const switchBox = chosen?.querySelector("input");
    if (switchBox) {
      switchBox.disabled = this.busy;
      holding.push(switchBox);
    }
    // (Named by its label, the hint said as its description; outside the summary told as it changes)
    const hint = choice && el(doc, "span", { class: `${BASE}-hint`, text: choice.hint, attrs: { id: "swd-property-choice-hint" } });
    if (switchBox && hint) switchBox.setAttribute("aria-describedby", hint.id);
    const choiceRow = choice && chosen && hint ? [el(doc, "label", "swd-prop-field swd-property-choice", el(doc, "span", "swd-prop-field-name", choice.label, hint), chosen)] : [];
    return el(doc, "div", "swd-property-review-box", ...choiceRow, el(doc, "div", { class: `${BASE}-card swd-property-review`, attrs: { role: "status", "aria-live": "polite" } }, ...lines.map((line) => el(doc, "p", { text: line })), progress, el(doc, "div", `${BASE}-row`, cancel, apply)));
  }
}
