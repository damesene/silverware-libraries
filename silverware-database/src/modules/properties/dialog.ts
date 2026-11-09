// The properties' dialog: a database's schema as a list, as Notion shows it, a
// property a row (its grip, its type's icon, its name, its type), dragged to its
// place (or Alt+↑ ↓ on its grip); a press on a row opens it: its name, icon,
// type, a select's options (a list: each its grip, its color, its name, ×; one
// added), required, its name in views, locked and its key under Advanced,
// Remove. Every change is the dialog's draft (a property changed marked in the
// list) until Save at its foot, which hands the draft to the core as one edit
// (`editSchema`): one transaction, shown first where it changes items or the
// views of it (how many items, which values are kept as they are), written
// whole, undone as one. Cancel, Esc or × ask first where the draft holds
// changes. The values outside the database have a screen of their own.
import { typeOf } from "../../domain/listing.ts";
import { systemKind, systemProperties } from "../../domain/system.ts";
import { switchControl } from "../../../../shared/controls.ts";
import { Dialogs } from "../../../../shared/dialog.ts";
import { reorder } from "../../../../shared/drag.ts";
import { el } from "../../../../shared/elements.ts";
import type { ItemConflict, LooseProperty, Proposal, PropertyEdit, Refused, Result, SchemaEdit } from "../../core/core.ts";
import { labelOfKey } from "../../domain/loose.ts";
import type { ModuleHost } from "../../core/module.ts";
import { colorsOf, OPTION_COLORS, type OptionColor } from "../../domain/types/options.ts";
import type { PropertyType } from "../../domain/types/type.ts";
import type { Database, Property } from "../../model/database.ts";
import { ownIcon, propertyIcon } from "../../views/icons.ts";
import { emojiChoice, type Popovers, popovers } from "../../views/popover.ts";
import { optionPill, pill } from "../../views/values.ts";

// A system property's choice among the new property's types: `system:<kind>`
const SYSTEM_PREFIX = "system:";

/** The types offered for a property of the user's (not those only the system's properties have) */
const offered = (all: readonly PropertyType[]) => all.filter((one) => one.offered !== false);

// The settings dialog's look: the same rows, cards and switches
const BASE = "swd-settings";
const CLOSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';

const isRefused = (result: Result | Proposal | Refused): result is Refused => "problem" in result;

// A grip: six dots, what a row is dragged by
const GRIP = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><circle cx="6" cy="4" r="1.1"/><circle cx="10" cy="4" r="1.1"/><circle cx="6" cy="8" r="1.1"/><circle cx="10" cy="8" r="1.1"/><circle cx="6" cy="12" r="1.1"/><circle cx="10" cy="12" r="1.1"/></svg>';
const BACK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m10 4-4 4 4 4"/></svg>';
const CHEVRON = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 4 4-4 4"/></svg>';
const LOCK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';

/** An option as it is edited: the text it was saved with (none: added now), the text it has, its color (none: its place's) */
type OptionDraft = { readonly was: string | undefined; text: string; color: OptionColor | undefined };

/**
 * A property as the draft has it: `id` its key as saved (a new one's `new:<n>`),
 * `saved` as it is saved (none: added now), `property` as edited (a new one's
 * key empty: made from its name on Save, unless given), a select's `options`
 * as edited, `removed` where it goes on Save (its values taken off too or not)
 */
type Entry = {
  readonly id: string;
  readonly saved: Property | undefined;
  property: Property;
  options: OptionDraft[] | undefined;
  removed?: { values: boolean };
};

/** The options as the drafts have them: trimmed, empty ones and repeats left out */
function optionsTyped(drafts: readonly OptionDraft[]): string[] {
  return [...new Set(drafts.map((one) => one.text.trim()).filter(Boolean))];
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

function optionsOf(property: Property): readonly string[] {
  const options = property.params.options;
  return Array.isArray(options) ? options.filter((one): one is string => typeof one === "string") : [];
}

/** A property's options as drafts: each as saved, its color its own where it has one */
function optionDrafts(property: Property): OptionDraft[] {
  const colors = colorsOf(property.params);
  return optionsOf(property).map((text) => ({ was: text, text, color: Object.hasOwn(colors, text) ? colors[text] : undefined }));
}

/** The pages a change's views are on, as said: a few by name, how many more */
function placesNamed(pages: readonly string[], noun: { readonly one: string; readonly many: string }): string {
  const shown = pages.slice(0, 3).join(", ");
  const more = pages.length - 3;
  return `${pages.length === 1 ? noun.one : `${pages.length} ${noun.many}`} (${shown}${more > 0 ? ` and ${more} more` : ""})`;
}

export class PropertiesDialog {
  private readonly dialogs: Dialogs;
  private body: HTMLElement | undefined;
  // The foot's Save and what it says (how far a Save is, the draft made of properties changed elsewhere)
  private saveButton: HTMLButtonElement | undefined;
  private note: HTMLElement | undefined;
  // The picker open under a button of a property's details (its icon's): closed as the dialog is drawn anew
  private pickers: Popovers | undefined;
  private database: Database | undefined;
  // The database's revision the draft is made of: Save against another is a conflict
  private revision = "";
  // The draft: every property as edited, in its order (removed ones too, in their places, until Save)
  private entries: Entry[] = [];
  private added = 0;
  // The draft made of properties that changed elsewhere since: Save is refused, said under the list
  private stale = false;
  // What Save left as the properties changed elsewhere since: shown by Show conflict in the foot, written over them by its Write mine
  private conflict: ItemConflict | undefined;
  // A change of items proposed (the draft saved, or values outside the database taken off), shown over the properties until
  // applied or put aside
  private proposal: { readonly proposal: Proposal; readonly what: string; readonly saving: boolean } | undefined;
  // The keys the items keep that the schema has none of, shown on their own screen as asked (read then: every item looked
  // through), the type picked for each; undefined: the properties shown
  private loose: { list: readonly LooseProperty[] | undefined; readonly types: Map<string, string> } | undefined;
  // The new property's label and type as typed, kept as the dialog is drawn anew
  private adding = { label: "", type: "" };
  // The property open (its details shown), by its id
  private opened: string | undefined;
  // Told as the dialog closes (what opened it waits on `whenClosed`)
  private whenClosed: Promise<void> = Promise.resolve();
  private closedNow: () => void = () => {};
  // The properties whose Advanced is open (by id): kept as the dialog is drawn anew
  private readonly advancedOpen = new Set<string>();
  // A change being planned or written: nothing else offered meanwhile (Apply twice wrote nothing the second time and said so)
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
    this.revision = read.revision;
    this.entries = this.entriesOf(read.value);
    this.stale = false;
    this.conflict = undefined;
    this.proposal = undefined;
    // (Opened anew: on the properties, not on the screen of the keys outside the schema it was closed on)
    this.loose = undefined;
    this.adding = { label: "", type: "" };
    this.opened = at?.property;
    const doc = this.host.document;
    this.body = el(doc, "div", "swd-properties");
    this.note = el(doc, "span", { class: `${BASE}-note swd-properties-note`, attrs: { "aria-live": "polite" } });
    const cancel = el(doc, "button", { class: `${BASE}-cancel swd-properties-cancel`, text: "Cancel", run: () => void this.dialog?.dismiss() });
    this.saveButton = el(doc, "button", { class: `${BASE}-save swd-properties-save`, text: "Save", run: () => void this.save() });
    const footer = doc.createDocumentFragment();
    footer.append(this.note, cancel, this.saveButton);
    this.dialog = this.dialogs.open({
      title: `${read.value.name}: properties`,
      subtitle: `Each item's values are kept in its ${this.host.noun.one}; nothing is written until Save`,
      content: this.body,
      footer,
      // (A draft with changes: lost only once the user agrees; not while a change is written: it would go on unseen)
      dismiss: async () => {
        if (this.busy) {
          this.host.ui.notify("Wait until the change is shown or written: closed now, it would go on unseen", { type: "info" });
          return false;
        }
        return !this.dirty() || !!(await this.host.ui.ask?.("Close the properties? What you changed is not saved.", { destructive: true }));
      },
      closed: () => {
        this.pickers?.close();
        this.dialog = undefined;
        this.closedNow();
      },
    });
    this.draw();
    this.focusAt(at);
    return this.whenClosed;
  }

  private dialog: { dismiss(): Promise<void>; close(): void } | undefined;

  /** The draft of a schema as it is: each property as saved */
  private entriesOf(database: Database): Entry[] {
    return database.properties.map((property) => ({ id: property.key, saved: property, property, options: this.hasOptions(property.type) ? optionDrafts(property) : undefined }));
  }

  private hasOptions(type: string): boolean {
    return this.host.types.named(type)?.look === "options";
  }

  /** The focus where the dialog was opened at: a property's name, the field adding one */
  private focusAt(at?: { readonly property?: string; readonly add?: boolean }): void {
    const target = at?.add ? ".swd-property-new-label" : at?.property ? `[data-property="${CSS.escape(at.property)}"] .swd-property-label` : undefined;
    if (target) this.body?.querySelector<HTMLElement>(target)?.focus();
  }

  close(): void {
    this.dialogs.close();
  }

  /**
   * The database as it is now, after a change made elsewhere (another place, an Undo): a draft of no change follows it; one
   * of changes is kept, made of the database as it was (its revision), Save then a conflict
   */
  async follow(): Promise<void> {
    if (!this.dialogs.isOpen || this.busy) return;
    const read = await this.host.database(this.id);
    // (Drawn anew only where it changed: the focus and what is typed stay)
    if (!read || read.revision === this.revision) return;
    if (this.dirty()) {
      this.stale = true;
      return this.drawFoot();
    }
    this.adopt(read.value, read.revision);
    this.draw();
  }

  /** The draft made anew of the database as it is (no change in it) */
  private adopt(database: Database, revision: string): void {
    this.database = database;
    this.revision = revision;
    this.entries = this.entriesOf(database);
    this.stale = false;
    this.conflict = undefined;
  }

  /** A property as the draft has it: its options and their colors in its params */
  private built(entry: Entry): Property {
    const { property, options } = entry;
    if (!options || !this.hasOptions(property.type)) return property;
    const colors: Record<string, OptionColor> = Object.create(null);
    for (const one of options) if (one.color && one.text.trim()) colors[one.text.trim()] ??= one.color;
    const { colors: _gone, options: _was, ...rest } = property.params;
    return { ...property, params: { ...rest, options: optionsTyped(options), ...(Object.keys(colors).length ? { colors: { ...colors } } : {}) } };
  }

  /** Whether a property of the draft differs from it as saved (one added or removed: always) */
  private changedEntry(entry: Entry): boolean {
    if (!entry.saved || entry.removed) return true;
    const built = this.built(entry);
    return JSON.stringify(sortedKeys(built)) !== JSON.stringify(sortedKeys(entry.saved)) || (!!entry.options && Object.keys(optionsRenamed(entry.options)).length > 0);
  }

  /** Whether the draft holds any change: a property changed, added, removed, or the order */
  private dirty(): boolean {
    const saved = this.database?.properties.map((one) => one.key) ?? [];
    return this.entries.some((one) => this.changedEntry(one)) || JSON.stringify(this.entries.map((one) => one.id)) !== JSON.stringify(saved);
  }

  /** The draft as the core's edit of the schema */
  private schemaEdit(): SchemaEdit {
    const properties = this.entries
      .filter((entry) => !entry.removed)
      .map((entry): PropertyEdit => {
        const p = this.built(entry);
        const renames = entry.saved && entry.options && p.type === entry.saved.type ? optionsRenamed(entry.options) : {};
        return {
          ...(entry.saved ? { from: entry.saved.key } : {}),
          label: p.label,
          type: p.type,
          ...(p.key && p.key !== entry.saved?.key ? { key: p.key } : {}),
          params: p.params,
          readonly: p.readonly,
          ...(p.required ? { required: true } : {}),
          ...(p.showName ? { showName: true } : {}),
          ...(p.icon !== undefined ? { icon: p.icon } : {}),
          ...(p.system !== undefined ? { system: p.system } : {}),
          ...(Object.keys(renames).length ? { renames } : {}),
        };
      });
    const removedValues = this.entries.filter((entry) => entry.saved && entry.removed?.values).map((entry) => entry.saved!.key);
    // (A conflict shown in the foot where the host shows one, else offered by the core)
    return { revision: this.revision, properties, ...(removedValues.length ? { removedValues } : {}), label: `Change the properties of ${this.database?.name ?? this.id}`, showsConflict: !!this.host.showConflict };
  }

  /** A change of the draft: drawn anew (the focus kept where it was), the foot told */
  private edited(change: () => void): void {
    change();
    this.draw();
  }

  /**
   * Save: the draft handed to the core as one edit. Nothing to write, or the
   * schema alone: written at once and the dialog closed; what changes items or
   * views: shown first (Apply writes it)
   */
  private async save(): Promise<void> {
    if (this.busy || !this.dirty()) return;
    // Two options of one name: not saved (one would go, and its color with it), both marked, said
    for (const entry of this.entries) {
      if (entry.removed || !entry.options || !this.hasOptions(entry.property.type)) continue;
      const names = entry.options.map((one) => one.text.trim()).filter(Boolean);
      const twice = names.find((one, at) => names.indexOf(one) !== at);
      if (twice === undefined) continue;
      this.opened = entry.id;
      this.draw();
      for (const input of this.body?.querySelectorAll<HTMLInputElement>(`[data-property="${CSS.escape(entry.id)}"] .swd-option-name`) ?? []) input.classList.toggle("swd-invalid", input.value.trim() === twice);
      return this.host.ui.notify(`${entry.property.label}: "${twice}" is two options: give each a name of its own`, { type: "error" });
    }
    this.busy = true;
    this.drawFoot();
    let result: Proposal | Refused;
    try {
      result = await this.host.core.editSchema(this.id, this.schemaEdit(), (done, of) => this.say(`Looking for views of it: ${done.toLocaleString("en-US")} of ${of.toLocaleString("en-US")} ${this.host.noun.many}…`));
    } finally {
      this.busy = false;
    }
    this.say("");
    if (isRefused(result)) {
      // (Nothing to write: closed, as Save of nothing; refused, said: the draft kept, the properties changed meanwhile marked)
      if (result.cause === "unchanged") return this.close();
      // (The properties changed elsewhere since: the conflict offered in the foot, the draft kept)
      if (result.conflict) {
        this.stale = true;
        this.conflict = result.conflict;
      }
      return this.draw();
    }
    const items = result.plan.planned.some((one) => "item" in one.target);
    if (!items && !result.places) return void this.apply(result);
    this.proposal = { proposal: result, what: "Save the properties", saving: true };
    this.draw();
  }

  /** A proposal written; the draft's: the dialog closed once it stands, else shown as the database is now */
  private async apply(proposal: Proposal, progress?: HTMLElement): Promise<void> {
    if (this.busy) return;
    const saving = !this.proposal || this.proposal.saving;
    this.busy = true;
    this.drawFoot();
    let result: Result;
    try {
      result = await this.host.core.apply(proposal, (done, of) => {
        if (!progress) return;
        progress.hidden = false;
        progress.textContent = `Written ${done.toLocaleString("en-US")} of ${of.toLocaleString("en-US")}${proposal.documents?.count ? ` ${this.host.noun.many}` : ""}…`;
      });
    } finally {
      this.busy = false;
      this.proposal = undefined;
    }
    this.changed();
    if (saving && !isRefused(result)) return this.close();
    // (Values outside the database taken off, or the draft not written: the database read again, the draft kept, made of what
    // it was made of)
    const read = await this.host.database(this.id);
    if (read && read.revision !== this.revision) {
      if (this.dirty()) this.stale = true;
      else this.adopt(read.value, read.revision);
    }
    if (this.loose) await this.readLoose();
    this.draw();
  }

  private say(text: string): void {
    if (this.note) this.note.textContent = text;
  }

  private drawFoot(): void {
    if (this.saveButton) this.saveButton.disabled = this.busy || !!this.proposal || !this.dirty();
    if (!this.note || this.busy) return;
    const conflict = this.conflict;
    if (this.stale && conflict && this.host.showConflict) {
      const show = el(this.host.document, "button", { class: "swd-properties-conflict", text: "Show conflict", title: "What writing yours over them would change, each page's lines; Write mine there" });
      show.addEventListener("click", () => this.host.showConflict!(conflict, () => this.conflictDone(conflict)));
      this.note.replaceChildren("The properties were changed elsewhere since: ", show);
      return;
    }
    this.note.textContent = this.stale ? "The properties were changed elsewhere since: Save writes nothing" : this.dirty() ? "Not saved yet" : "";
  }

  /** The conflict's Write mine done: written over them, the draft's work is done (closed); not (changed again since), the draft kept, Save offering the new one */
  private conflictDone(conflict: ItemConflict): void {
    if (this.conflict !== conflict) return;
    this.changed();
    if (conflict.written()) return this.close();
    this.conflict = undefined;
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

  private draw(): void {
    this.pickers?.close();
    this.drawFoot();
    const { document: doc } = this.host;
    const database = this.database;
    if (!this.body || !database) return;
    if (this.proposal) {
      this.body.replaceChildren(this.review(this.proposal.proposal, this.proposal.what));
      this.body.querySelector<HTMLElement>(".swd-property-apply")?.focus();
      return;
    }
    if (this.loose) {
      const focused = this.body.contains(doc.activeElement) ? (doc.activeElement as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key : undefined;
      this.body.replaceChildren(this.looseScreen());
      // (The focus kept in the screen: on its row where it is still there, else on its way back)
      if (!this.body.contains(doc.activeElement)) ((focused ? this.body.querySelector<HTMLElement>(`.swd-loose-row[data-key="${CSS.escape(focused)}"] .swd-loose-add`) : null) ?? this.body.querySelector<HTMLElement>(".swd-loose-back"))?.focus();
      return;
    }
    // (The focus kept on what had it: a row's head or grip, a field, by its class and property)
    const active = doc.activeElement;
    const focused = active instanceof HTMLElement && this.body.contains(active) ? { id: active.closest<HTMLElement>("[data-property]")?.dataset.property, cls: [...active.classList].find((one) => one.startsWith("swd-prop") || one.startsWith("swd-option")) } : undefined;
    const list: HTMLElement = el(doc, "div", { class: "swd-props", attrs: { role: "list", "aria-label": "Properties" } });
    list.append(...this.entries.map((entry, at) => this.property(entry, at, () => list)));
    this.body.replaceChildren(this.entries.length ? list : el(doc, "p", { class: `${BASE}-hint`, text: "No property yet: an item has its name alone." }), this.adder());
    // (What had it gone, a switch drawn anew: its property's head, else the dialog's body, so its keys stay the dialog's)
    if (focused && !this.body.contains(doc.activeElement)) {
      const row = focused.id ? `[data-property="${CSS.escape(focused.id)}"]` : undefined;
      const enabled = (one: HTMLElement | null) => (one && !(one as HTMLButtonElement).disabled ? one : null);
      const again = enabled(row && focused.cls ? this.body.querySelector<HTMLElement>(`${row} .${focused.cls}`) : null) ?? (row ? this.body.querySelector<HTMLElement>(`${row} .swd-prop-head`) : null);
      if (again) again.focus({ preventScroll: true });
      else {
        this.body.tabIndex = -1;
        this.body.focus({ preventScroll: true });
      }
    }
  }

  /** A property's row's head as the draft has it: its icon, name, * where required, a mark where the draft changes it, a lock, its type */
  private fillHead(head: HTMLElement, entry: Entry): void {
    const { document: doc, types } = this.host;
    const property = this.built(entry);
    // (Its type as the views have it: a system property's its kind's)
    const type = typeOf(types, property);
    const kind = systemKind(property.system, this.host.noun);
    const mark = entry.removed ? "Removed" : !entry.saved ? "New" : this.changedEntry(entry) ? "Changed" : undefined;
    head.setAttribute("aria-label", `${property.label}, ${type?.label ?? property.type}${property.required ? ", required" : ""}${property.system ? ", given by the system" : property.readonly ? ", locked in views" : ""}${mark ? `, ${mark.toLowerCase()} (on Save)` : ""}`);
    head.replaceChildren(
      propertyIcon(doc, property, type, "swd-prop-icon"),
      el(doc, "span", { class: "swd-prop-name", text: property.label || "(no name)" }, ...(property.required ? [el(doc, "span", { class: "swd-prop-required", text: "*", title: "Required", attrs: { "aria-hidden": "true" } })] : [])),
      ...(mark ? [el(doc, "span", { class: `swd-prop-mark swd-prop-mark-${mark.toLowerCase()}`, text: mark, title: `${mark}: written on Save` })] : []),
      ...(property.readonly ? [el(doc, "span", { class: "swd-prop-lock", html: LOCK, title: property.system ? "Given by the system" : "Locked in views" })] : []),
      el(doc, "span", { class: "swd-prop-type", text: kind?.label ? `System: ${kind.label}` : (type?.label ?? property.type) }),
    );
  }

  /**
   * A text of the draft typed (a name, an option's, a key): its row's head and the foot told, nothing drawn anew (the field
   * left by a press on another would be drawn anew under that press, the text typed next going to a field no longer there)
   */
  private typed(entry: Entry): void {
    const head = this.body?.querySelector<HTMLElement>(`[data-property="${CSS.escape(entry.id)}"] > .swd-prop-row > .swd-prop-head`);
    if (head) this.fillHead(head, entry);
    this.drawFoot();
  }

  /** A property: its row (grip, type, name, type's name, a mark where the draft changes it; a press opens it), its details where open */
  private property(entry: Entry, at: number, list: () => HTMLElement): HTMLElement {
    const { document: doc } = this.host;
    const property = this.built(entry);
    const open = this.opened === entry.id;
    const grip = el(doc, "button", { class: "swd-prop-grip", html: GRIP, title: "Drag to move (Alt+↑ ↓)", attrs: { "aria-label": `Move ${property.label} (Alt+Up, Alt+Down)` } });
    const head = el(doc, "button", { class: "swd-prop-head", attrs: { "aria-expanded": String(open) } });
    this.fillHead(head, entry);
    head.addEventListener("click", () => {
      this.opened = open ? undefined : entry.id;
      this.draw();
    });
    const chevron = el(doc, "span", { class: "swd-prop-chevron", html: CHEVRON });
    chevron.addEventListener("click", () => head.click());
    const row = el(doc, "div", { class: `swd-prop${open ? " swd-prop-open" : ""}${entry.removed ? " swd-prop-removed" : ""}`, attrs: { role: "listitem", "data-property": entry.id } }, el(doc, "div", "swd-prop-row", grip, head, chevron));
    // Dragged by its grip to its place in the draft; Alt+↑ ↓ the same from the keys
    const moveTo = (index: number) => {
      const to = Math.max(0, Math.min(this.entries.length - 1, index));
      if (to === at) return this.draw();
      this.edited(() => {
        this.entries.splice(at, 1);
        this.entries.splice(to, 0, entry);
      });
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
      moveTo(at + (event.key === "ArrowUp" ? -1 : 1));
    });
    if (open) row.append(entry.removed ? this.removedDetails(entry) : this.details(entry));
    return row;
  }

  /** A property the draft removes: so said, its values taken off the items too by its switch (not a system property's: they are none of the items'), or kept after all */
  private removedDetails(entry: Entry): HTMLElement {
    const { document: doc } = this.host;
    const removed = entry.removed!;
    const values = switchControl(doc, BASE, removed.values, (on) => this.edited(() => (removed.values = on)));
    values.querySelector("input")?.setAttribute("aria-label", `Also take the values of ${entry.property.label} off the items`);
    const keep = el(doc, "button", { class: "swd-property-keep", text: "Keep it", title: "Not removed after all", run: () => this.edited(() => delete entry.removed) });
    return el(
      doc,
      "div",
      "swd-prop-detail",
      el(doc, "p", { class: "swd-prop-system", text: "Removed on Save." }),
      ...(entry.property.system === undefined
        ? [
            el(
              doc,
              "label",
              { class: "swd-prop-field swd-prop-switch-row swd-property-values-off" },
              el(doc, "span", "swd-prop-field-name", "Also take its values off the items", el(doc, "span", { class: `${BASE}-hint`, text: `Off: its values stay in the ${this.host.noun.many} (shown again if it comes back). On: taken off the items holding one; Undo puts them back.` })),
              values,
            ),
          ]
        : []),
      el(doc, "div", "swd-prop-actions", keep),
    );
  }

  /** A property's details: its name, icon, type, a select's options and their colors, required, its name in views, locked and its key, Remove */
  private details(entry: Entry): HTMLElement {
    const { document: doc, types } = this.host;
    const property = this.built(entry);
    // (A flag turned off taken off, as the schema keeps it: a change turned back is no change)
    const set = (change: Partial<Property>) =>
      this.edited(() => {
        const next: Record<string, unknown> = { ...entry.property, ...change };
        for (const flag of ["required", "showName"] as const) if (next[flag] === false) delete next[flag];
        entry.property = next as Property;
      });
    const label = el(doc, "input", { class: "swd-property-label", attrs: { "aria-label": `Name of ${property.label}`, value: property.label, "data-key": entry.id } });
    // (Kept as typed; the list's row named so as the field is left)
    label.addEventListener("input", () => {
      entry.property = { ...entry.property, label: label.value };
      this.typed(entry);
    });
    label.addEventListener("change", () => {
      entry.property = { ...entry.property, label: label.value };
      this.typed(entry);
    });
    const remove = el(doc, "button", {
      class: "swd-property-remove",
      text: "Remove property",
      attrs: { "aria-label": `Remove ${property.label}` },
      // (One added now goes from the draft; one saved is marked, removed on Save)
      run: () =>
        this.edited(() => {
          if (entry.saved) entry.removed = { values: false };
          else this.entries.splice(this.entries.indexOf(entry), 1);
        }),
    });
    const field = (name: string, control: HTMLElement, hint?: string) => el(doc, "label", "swd-prop-field", el(doc, "span", "swd-prop-field-name", name, ...(hint ? [el(doc, "span", { class: `${BASE}-hint`, text: hint })] : [])), control);
    // Its own icon (an emoji) where the views name it, picked under its button (the emoji choice, Remove: its type's again)
    const own = ownIcon(property);
    const setIcon = (icon: string | undefined) => {
      this.pickers?.close();
      this.edited(() => {
        const { icon: _was, ...rest } = entry.property;
        entry.property = icon === undefined ? rest : { ...rest, icon };
      });
      this.body?.querySelector<HTMLElement>(`[data-property="${CSS.escape(entry.id)}"] .swd-property-icon`)?.focus({ preventScroll: true });
    };
    const iconButton: HTMLElement = el(
      doc,
      "button",
      {
        class: "swd-property-icon",
        title: own ? "Change its icon" : "Give it an icon of its own",
        attrs: { "aria-label": `Icon of ${property.label}`, "aria-haspopup": "dialog", "aria-expanded": "false" },
        run: () => (this.pickers ??= popovers(doc)).open(iconButton, this.body!, "Icon", (box) => emojiChoice(doc, box, "Icon", (emoji) => setIcon(emoji), own ? () => setIcon(undefined) : undefined)),
      },
      propertyIcon(doc, property, typeOf(types, property), "swd-property-icon-shown"),
      el(doc, "span", { class: "swd-property-icon-text", text: own ? "Change" : "Its type's: choose an emoji" }),
    );
    // (Not a label: a press on its name would open the picker again as it closes it)
    const iconField = el(doc, "div", "swd-prop-field", el(doc, "span", "swd-prop-field-name", "Icon"), iconButton);
    // Its name shown with its values where they stand alone (a card's line, a list's row), any property's, a system one's too
    const showName = switchControl(doc, BASE, property.showName ?? false, (on) => set({ showName: on }));
    showName.querySelector("input")?.setAttribute("aria-label", `${property.label}: name shown with its values`);
    const nameShown = el(
      doc,
      "label",
      { class: "swd-prop-field swd-prop-switch-row swd-property-show-name", title: `Its name before its value on a card, in a list (${property.label}: …); a table's header names it already` },
      el(doc, "span", "swd-prop-field-name", "Name in views", el(doc, "span", { class: `${BASE}-hint`, text: `Shown as ${property.label}: value, on cards and in lists` })),
      showName,
    );
    // A system property: its name (and shown or hidden, its place, from the list); what it is, its key under Advanced as any
    // property's; no type, setting or value to change
    if (property.system !== undefined) {
      const kind = systemKind(property.system, this.host.noun);
      return el(
        doc,
        "div",
        "swd-prop-detail",
        field("Name", label),
        iconField,
        el(doc, "p", { class: "swd-prop-system", text: kind ? `Given by the system: ${kind.hint}. Read only.` : `Given by the system ("${property.system}", not known to this version): no values.` }),
        ...(typeOf(types, property).look === "check" ? [] : [nameShown]),
        ...(entry.saved ? [this.advanced(entry, [field("Key", el(doc, "input", { class: "swd-property-key", attrs: { "aria-label": `Key of ${property.label}`, value: property.key, readonly: "" } }), "How queries name it")])] : []),
        el(doc, "div", "swd-prop-actions", remove),
      );
    }
    const type = el(doc, "select", { class: "swd-property-type", attrs: { "aria-label": `Type of ${property.label}` } }, ...offered(types.all()).map((one) => new Option(one.label, one.name, false, one.name === property.type)));
    // (A type not defined now, or not offered, kept as it is)
    if (!offered(types.all()).some((one) => one.name === property.type)) type.append(new Option(types.named(property.type)?.label ?? property.type, property.type, false, true));
    type.addEventListener("change", () =>
      this.edited(() => {
        // (Its params kept where the new type takes them, else none, as the core keeps them; its options as edited, where it has some)
        const to = types.named(type.value);
        const params = to?.validateParams?.(property.params) === undefined ? property.params : {};
        entry.property = { ...entry.property, type: type.value, params };
        if (this.hasOptions(type.value)) entry.options ??= optionDrafts(entry.property);
      }),
    );
    const locked = switchControl(doc, BASE, property.readonly, (on) => set({ readonly: on }));
    locked.querySelector("input")?.setAttribute("aria-label", `${property.label} locked in views`);
    const required = switchControl(doc, BASE, property.required ?? false, (on) => set({ required: on }));
    required.querySelector("input")?.setAttribute("aria-label", `${property.label} required`);
    // Its key: one added now gets one made from its name on Save, unless typed
    const key = el(doc, "input", { class: "swd-property-key", attrs: { "aria-label": `Key of ${property.label}`, value: property.key, placeholder: entry.saved ? "" : "Made from its name on Save" } });
    key.addEventListener("change", () => {
      entry.property = { ...entry.property, key: key.value.trim() || (entry.saved?.key ?? "") };
      this.typed(entry);
    });
    return el(
      doc,
      "div",
      "swd-prop-detail",
      field("Name", label),
      iconField,
      field("Type", type),
      // (Options where its values are picked from them: a select's, a type of the user's so)
      ...(this.hasOptions(property.type) ? [this.options(entry)] : []),
      // (Its type's switches: a select's Multiple)
      ...this.switches(entry),
      // (A value turned by a press has no empty one to require)
      ...(typeOf(types, property).editor === "toggle"
        ? []
        : [
            el(
              doc,
              "label",
              { class: "swd-prop-field swd-prop-switch-row swd-property-required", title: "Required: an item without a value shows it missing; a value is never taken off" },
              el(doc, "span", "swd-prop-field-name", "Required", el(doc, "span", { class: `${BASE}-hint`, text: "An item without a value shows it missing" })),
              required,
            ),
          ]),
      // (A box shows its name already: ✓ Done)
      ...(typeOf(types, property).look === "check" ? [] : [nameShown]),
      // What is seldom set, folded away: open while a property is (kept so as it is drawn anew)
      this.advanced(entry, [
        el(
          doc,
          "label",
          { class: "swd-prop-field swd-prop-switch-row swd-property-locked", title: `Locked: no view offers to change it (its ${this.host.noun.one} can still be edited by hand, a script can still write it)` },
          el(doc, "span", "swd-prop-field-name", "Locked in views", el(doc, "span", { class: `${BASE}-hint`, text: "For values a script or another tool keeps" })),
          locked,
        ),
        field("Key", key, `How ${this.host.noun.many} and queries name it`),
      ]),
      el(doc, "div", "swd-prop-actions", remove),
    );
  }

  /** A property's type's switches (a select's Multiple), each a logical param: on, true; off, left out */
  private switches(entry: Entry): HTMLElement[] {
    const { document: doc, types } = this.host;
    const property = this.built(entry);
    return (types.named(property.type)?.settings ?? []).map((setting) => {
      const control = switchControl(doc, BASE, property.params[setting.param] === true, (on) =>
        this.edited(() => {
          const { [setting.param]: _was, ...rest } = entry.property.params;
          entry.property = { ...entry.property, params: on ? { ...rest, [setting.param]: true } : rest };
        }),
      );
      control.querySelector("input")?.setAttribute("aria-label", `${property.label}: ${setting.label}`);
      return el(
        doc,
        "label",
        { class: "swd-prop-field swd-prop-switch-row swd-property-setting", attrs: { "data-param": setting.param } },
        el(doc, "span", "swd-prop-field-name", setting.label, ...(setting.hint ? [el(doc, "span", { class: `${BASE}-hint`, text: setting.hint })] : [])),
        control,
      );
    });
  }

  /**
   * Advanced: what is seldom set (locked in views, the key), folded under its summary; open as long as the dialog is for that
   * property, and from the start where the property is locked (so its switch is seen), not a system property's (locked always)
   */
  private advanced(entry: Entry, fields: readonly HTMLElement[]): HTMLElement {
    const doc = this.host.document;
    const box = el(doc, "details", "swd-prop-advanced", el(doc, "summary", { class: "swd-prop-advanced-summary", text: "Advanced" }), ...fields);
    if (this.advancedOpen.has(entry.id) || (entry.property.readonly && entry.property.system === undefined)) box.open = true;
    box.addEventListener("toggle", () => void (box.open ? this.advancedOpen.add(entry.id) : this.advancedOpen.delete(entry.id)));
    return box;
  }

  /** A select's options as a list: each its grip (dragged to its place, Alt+↑ ↓), its color, its name, ×; one added under them */
  private options(entry: Entry): HTMLElement {
    const { document: doc } = this.host;
    const drafts = (entry.options ??= optionDrafts(entry.property));
    const property = this.built(entry);
    const rows = el(doc, "div", { class: "swd-options", attrs: { role: "list", "aria-label": `Options of ${property.label}` } });
    const palette = el(doc, "div", { class: "swd-option-palette", attrs: { hidden: "" } });
    const drawRows = () => rows.replaceChildren(...drafts.map((draft) => optionRow(draft)));
    const optionRow = (draft: OptionDraft): HTMLElement => {
      const grip = el(doc, "button", { class: "swd-prop-grip swd-option-grip", html: GRIP, title: "Drag to move (Alt+↑ ↓)", attrs: { "aria-label": `Move ${draft.text || "the new option"}` } });
      const text = draft.text.trim();
      // Its color: picked under its row (an option of a name only: one emptied has none to show)
      const color = text
        ? el(doc, "button", { class: "swd-option-color", title: `The color of ${text}`, attrs: { "aria-expanded": "false", "aria-label": `Color of ${text}`, "data-option": text } }, optionPill(doc, this.built(entry), text))
        : el(doc, "span", { class: "swd-option-color swd-option-color-none", title: "Its color can be picked once it has a name" }, pill(doc, " ", undefined));
      const name = el(doc, "input", { class: "swd-option-name", attrs: { "aria-label": "Option", value: draft.text, placeholder: "Option" } });
      name.addEventListener("input", () => {
        draft.text = name.value;
        this.typed(entry);
      });
      // (Its color's button follows its name: the palette picks for the option as typed)
      name.addEventListener("change", () => {
        draft.text = name.value;
        this.typed(entry);
        if (color instanceof HTMLButtonElement && draft.text.trim()) {
          color.dataset.option = draft.text.trim();
          color.title = `The color of ${draft.text.trim()}`;
          color.setAttribute("aria-label", `Color of ${draft.text.trim()}`);
          color.replaceChildren(optionPill(doc, this.built(entry), draft.text.trim()));
        }
      });
      const remove = el(doc, "button", {
        class: "swd-option-remove",
        html: CLOSE,
        title: "Take this option away",
        attrs: { "aria-label": `Take away ${draft.text || "the option"}` },
        run: () => {
          const at = drafts.indexOf(draft);
          this.edited(() => drafts.splice(at, 1));
          const box = this.body?.querySelector(`[data-property="${CSS.escape(entry.id)}"] .swd-options`);
          (box?.children[at]?.querySelector<HTMLElement>(".swd-option-name") ?? box?.parentElement?.querySelector<HTMLElement>(".swd-option-new"))?.focus({ preventScroll: true });
        },
      });
      const row = el(doc, "div", { class: "swd-option", attrs: { role: "listitem" } }, grip, color, name, remove);
      if (color instanceof HTMLButtonElement) color.addEventListener("click", () => this.palette(entry, draft, color, palette, row));
      const move = (to: number) => {
        const from = drafts.indexOf(draft);
        if (to < 0 || to >= drafts.length || to === from) return;
        this.edited(() => {
          drafts.splice(from, 1);
          drafts.splice(to, 0, draft);
        });
        this.body?.querySelector(`[data-property="${CSS.escape(entry.id)}"] .swd-options`)?.children[to]?.querySelector<HTMLElement>(".swd-option-grip")?.focus();
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
      const text = added.value.trim();
      this.edited(() => drafts.push({ was: undefined, text, color: undefined }));
      this.body?.querySelector<HTMLElement>(`[data-property="${CSS.escape(entry.id)}"] .swd-option-new`)?.focus();
    });
    return el(doc, "div", "swd-prop-field swd-prop-options", el(doc, "span", "swd-prop-field-name", "Options"), el(doc, "div", "swd-options-box", rows, palette, added));
  }

  /** An option's colors to pick, under its row (Auto: its place's; Custom…: one of your own) */
  private palette(entry: Entry, draft: OptionDraft, button: HTMLElement, palette: HTMLElement, row: HTMLElement): void {
    const { document: doc } = this.host;
    const option = draft.text.trim();
    const shown = !palette.hidden && palette.dataset.option === option;
    for (const one of palette.parentElement?.querySelectorAll(".swd-option-color[aria-expanded]") ?? []) one.setAttribute("aria-expanded", "false");
    if (shown) return void (palette.hidden = true);
    const pick = (color: OptionColor | undefined) => {
      this.edited(() => (draft.color = color));
      // The focus back on the option's color, the dialog drawn anew (a keyboard's user goes on from there)
      this.body?.querySelector<HTMLElement>(`[data-property="${CSS.escape(entry.id)}"] .swd-option-color[data-option="${CSS.escape(option)}"]`)?.focus({ preventScroll: true });
    };
    const given = draft.color;
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

  /** A property added to the draft: its label and type (kept as typed while the dialog is drawn anew) */
  private adder(): HTMLElement {
    const { document: doc, types } = this.host;
    const label = el(doc, "input", { class: "swd-property-new-label", attrs: { placeholder: "+ Add a property", "aria-label": "New property's name" } });
    label.value = this.adding.label;
    label.addEventListener("input", () => void (this.adding.label = label.value));
    // (A kind once: one the draft has, not removed, offered no more)
    const there = new Set(this.entries.filter((one) => !one.removed).map((one) => one.property.system).filter((one): one is string => one !== undefined));
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
      run: () => {
        const kind = type.value.startsWith(SYSTEM_PREFIX) ? systemKind(type.value.slice(SYSTEM_PREFIX.length), this.host.noun) : undefined;
        if (!label.value.trim() && !kind) return label.focus();
        const property: Property = kind
          ? { key: "", label: label.value.trim() || kind.label, type: kind.type, params: {}, readonly: true, system: kind.kind }
          : { key: "", label: label.value.trim(), type: type.value, params: {}, readonly: false };
        this.adding = { label: "", type: "" };
        this.edited(() => this.entries.push({ id: `new:${++this.added}`, saved: undefined, property, options: this.hasOptions(property.type) ? [] : undefined }));
        this.body?.querySelector<HTMLElement>(".swd-property-new-label")?.focus();
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
   * first), Add (a property of that key in the draft, its values back in the
   * views on Save) and Remove from pages (shown first, as any change of items)
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
    // (Those added to the draft already left out: added on Save)
    const drafted = new Set(this.entries.filter((one) => !one.saved).map((one) => one.property.key));
    const list = loose.list.filter((one) => !drafted.has(one.key));
    if (!list.length) return el(doc, "div", "swd-loose", head, hint, el(doc, "p", { class: "swd-loose-none", text: loose.list.length ? "Every key the items keep is a property of the database, or added to it on Save." : "Every key the items keep is a property of the database." }));
    const rows = list.map((one) => {
      const type = el(doc, "select", { class: "swd-loose-type", attrs: { "aria-label": `Type of ${one.key}` } }, ...offered(types.all()).map((t) => new Option(t.label, t.name, false, t.name === (loose.types.get(one.key) ?? one.type))));
      type.addEventListener("change", () => void loose.types.set(one.key, type.value));
      const add = el(doc, "button", {
        class: "swd-loose-add",
        text: "Add",
        title: `Add ${one.key} as a property: its values shown again once saved`,
        // (A select taking its values as its options, several where they are lists: none refused as it is added)
        run: () =>
          this.edited(() => {
            const guessed = type.value === one.type ? (one.params ?? {}) : {};
            const property: Property = { key: one.key, label: labelOfKey(one.key), type: type.value, params: types.named(type.value)?.look === "options" ? { ...guessed, options: [...one.options] } : guessed, readonly: false };
            this.entries.push({ id: `new:${++this.added}`, saved: undefined, property, options: this.hasOptions(property.type) ? optionDrafts(property) : undefined });
          }),
      });
      const remove = el(doc, "button", {
        class: "swd-loose-remove",
        text: `Remove from ${this.host.noun.many}`,
        title: `Take ${one.key} off the items keeping it (shown first)`,
        run: () => void this.takeOff(() => core.removeLooseProperty(this.id, one.key), `Take "${one.key}" off the items`),
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

  /** Values outside the database taken off the items: the change planned and shown first (no draft's: the schema stays) */
  private async takeOff(plan: () => Promise<Proposal | Refused>, what: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    let result: Proposal | Refused;
    try {
      result = await plan();
    } finally {
      this.busy = false;
    }
    if (isRefused(result)) {
      await this.readLoose();
      return this.draw();
    }
    this.proposal = { proposal: result, what, saving: false };
    this.draw();
  }

  /** A change of items shown before it is written: how many items, the values kept as they are, the views and pages it writes */
  private review(proposal: Proposal, what: string): HTMLElement {
    const { document: doc } = this.host;
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
      kept ? `${kept === 1 ? "One item holds a value" : `${kept} items hold values`} that ${kept === 1 ? "does" : "do"} not read as ${kept === 1 ? "its" : "their"} property is to be (a type changed, an option taken away): kept as ${kept === 1 ? "it is" : "they are"}, shown invalid.` : "",
      left ? `${left === 1 ? "One part" : `${left} parts`} cannot be changed and will be left: ${[...new Set(proposal.plan.skipped.map((one) => one.reason))].join("; ")}.` : "",
      // The views of it that name what changes (a key changed), on the pages they are on
      proposal.places?.documents.length ? `Updates the views of it on ${placesNamed(proposal.places.documents, this.host.noun)}.` : "",
      // (A block in a list item is not written: left as it is, to change by hand)
      proposal.places?.byHand?.length ? `Views of it in a list item are left as they are (change them by hand): ${placesNamed(proposal.places.byHand, this.host.noun)}.` : "",
      // (Said of every change of items, however few: it is seldom made, and stopped halfway it is half written)
      pages ? `Writes ${pages === 1 ? `1 ${this.host.noun.one}` : `${number(pages)} ${this.host.noun.many}`}, one after another: keep this window open until it is done (stopped halfway, the items not written yet keep their old values).` : "",
    ].filter(Boolean);
    // How far the write is, told as it goes (a store of pages writes them one after another)
    const progress = el(doc, "p", { class: "swd-property-progress", attrs: { hidden: "" } });
    const apply = el(doc, "button", {
      class: `${BASE}-save swd-property-apply`,
      text: "Apply",
      run: () => {
        apply.disabled = back.disabled = true;
        void this.apply(proposal, progress);
      },
    });
    const back = el(doc, "button", {
      class: `${BASE}-cancel swd-property-cancel`,
      text: "Back",
      title: "Back to the properties, nothing written",
      run: () => {
        if (this.busy) return;
        this.proposal = undefined;
        this.draw();
      },
    });
    return el(doc, "div", "swd-property-review-box", el(doc, "div", { class: `${BASE}-card swd-property-review`, attrs: { role: "status", "aria-live": "polite" } }, ...lines.map((line) => el(doc, "p", { text: line })), progress, el(doc, "div", `${BASE}-row`, back, apply)));
  }
}
