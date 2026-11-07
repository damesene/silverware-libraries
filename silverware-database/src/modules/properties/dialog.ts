// The properties' dialog: a database's schema, each property's label, key,
// type, options (a select's, one a line) and read only, its place in the
// order, removed; a property added. What changes the schema alone is written
// at once (a label, read only, the order, a property added); what changes
// items too (a key, a type, options, a property removed with its values) is
// proposed first: how many items it changes and which values it keeps as they
// are, applied only as the user says so. Every change goes through the
// core: checked, said where refused, kept for Undo.
import { settingRow, switchControl } from "../../../../shared/controls.ts";
import { Dialogs } from "../../../../shared/dialog.ts";
import { el } from "../../../../shared/elements.ts";
import type { Proposal, Refused, Result } from "../../core/core.ts";
import type { ModuleHost } from "../../core/module.ts";
import type { Database, Params, Property } from "../../model/database.ts";

// The settings dialog's look: the same rows, cards and switches
const BASE = "swd-settings";
const CLOSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>';

const isRefused = (result: Result | Proposal | Refused): result is Refused => "problem" in result;

/** A select's options as typed, one a line (empty lines and repeats left out) */
function optionsTyped(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

function optionsOf(property: Property): readonly string[] {
  const options = property.params.options;
  return Array.isArray(options) ? options.filter((one): one is string => typeof one === "string") : [];
}

export class PropertiesDialog {
  private readonly dialogs: Dialogs;
  private body: HTMLElement | undefined;
  private database: Database | undefined;
  // A change of items proposed, shown over the properties until applied or put aside
  private proposal: { readonly proposal: Proposal; readonly what: string } | undefined;
  // What is typed and not saved yet, kept as the dialog is drawn anew (another change made meanwhile):
  // a select's options by its property's key, the new property's label and type
  private readonly drafts = new Map<string, string>();
  private adding = { label: "", type: "" };
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

  async open(): Promise<void> {
    if (this.dialogs.isOpen) return;
    const read = await this.host.database(this.id);
    if (!read || this.dialogs.isOpen) return;
    this.database = read.value;
    this.drafts.clear();
    this.adding = { label: "", type: "" };
    this.body = el(this.host.document, "div", "swd-properties");
    this.dialogs.open({ title: `${read.value.name}: properties`, subtitle: "Each item's values are kept in its page", content: this.body });
    this.draw();
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
    this.draw();
  }

  private async run(write: () => Promise<Result | Proposal | Refused>, what: string): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      const result = await write();
      if (isRefused(result)) {
        this.draw();
        return false;
      }
      // A change of items: shown first, applied as the user says
      if ("plan" in result) {
        this.proposal = { proposal: result, what };
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
    if (this.proposal) {
      this.body.replaceChildren(this.review(this.proposal.proposal, this.proposal.what));
      this.body.querySelector<HTMLElement>(".swd-property-apply")?.focus();
      return;
    }
    // A card a property, so each one's rows read as one
    const cards = database.properties.map((property, at) => el(doc, "div", `${BASE}-card swd-property-card`, ...this.property(property, at, database.properties.length)));
    this.body.replaceChildren(...(cards.length ? cards : [el(doc, "p", { class: `${BASE}-hint`, text: "No property yet: an item has its name alone." })]), this.adder());
  }

  /** A property's rows: its label, type, read only, order and removal; its key; a select's options */
  private property(property: Property, at: number, count: number): HTMLElement[] {
    const { document: doc, core, types } = this.host;
    const label = el(doc, "input", { class: "swd-property-label", attrs: { "aria-label": `Label of ${property.label}`, value: property.label, "data-key": property.key } });
    const rename = () => {
      if (label.value.trim() && label.value.trim() !== property.label) void this.run(() => core.renameProperty(this.id, property.key, label.value), "");
    };
    label.addEventListener("change", rename);
    const type = el(doc, "select", { class: "swd-property-type", attrs: { "aria-label": `Type of ${property.label}` } }, ...types.all().map((one) => new Option(one.label, one.name, false, one.name === property.type)));
    // (A type not defined now kept as it is)
    if (!types.named(property.type)) type.append(new Option(property.type, property.type, false, true));
    type.addEventListener("change", () => void this.run(() => core.retypeProperty(this.id, property.key, type.value), `Change the type of ${property.label}`));
    const locked = switchControl(doc, BASE, property.readonly, (on) => void this.run(() => core.setPropertyReadonly(this.id, property.key, on), ""));
    locked.querySelector("input")?.setAttribute("aria-label", `${property.label} read only`);
    const lockedRow = el(doc, "label", { class: "swd-property-locked", title: "Read only: no view offers to change it" }, locked, "Read only");
    const up = el(doc, "button", { class: "swd-property-up", text: "↑", attrs: { "aria-label": `Move ${property.label} up`, ...(at === 0 ? { disabled: "" } : {}) }, run: () => void this.run(() => core.moveProperty(this.id, property.key, at - 1), "") });
    const down = el(doc, "button", { class: "swd-property-down", text: "↓", attrs: { "aria-label": `Move ${property.label} down`, ...(at === count - 1 ? { disabled: "" } : {}) }, run: () => void this.run(() => core.moveProperty(this.id, property.key, at + 1), "") });
    const remove = el(doc, "button", { class: "swd-property-remove", text: "Remove", attrs: { "aria-label": `Remove ${property.label}` }, run: () => void this.removing(property) });
    const head = el(doc, "div", { class: `${BASE}-row swd-property`, attrs: { "data-property": property.key } }, label, type, lockedRow, up, down, remove);
    const key = el(doc, "input", { class: "swd-property-key", attrs: { "aria-label": `Key of ${property.label}`, value: property.key } });
    key.addEventListener("change", () => {
      if (key.value.trim() && key.value.trim() !== property.key) void this.run(() => core.rekeyProperty(this.id, property.key, key.value.trim()), `Change the key of ${property.label} to ${key.value.trim()}`);
    });
    const rows = [head, settingRow(doc, BASE, "Key", "How pages and queries name it", key)];
    const named = types.named(property.type)?.name;
    if (named === "select" || named === "multi-select") {
      const options = el(doc, "textarea", { class: "swd-property-options", attrs: { rows: "3", "aria-label": `Options of ${property.label}` } });
      options.value = this.drafts.get(property.key) ?? optionsOf(property).join("\n");
      options.addEventListener("input", () => void this.drafts.set(property.key, options.value));
      const save = el(doc, "button", {
        class: "swd-property-options-save",
        text: "Save options",
        run: async () => {
          const params: Params = { ...property.params, options: optionsTyped(options.value) };
          if (await this.run(() => core.retypeProperty(this.id, property.key, property.type, params), `Change the options of ${property.label}`)) this.drafts.delete(property.key);
        },
      });
      rows.push(el(doc, "div", `${BASE}-row`, settingRowLabel(doc, "Options", "One a line, in their order"), options, save));
    }
    return rows;
  }

  /** A property removed: its values kept in the items (shown again if it comes back), or taken off them too, as the user picks */
  private async removing(property: Property): Promise<void> {
    const { core, ui } = this.host;
    const values = (await ui.ask?.(`Take ${property.label}'s values off the items too? (No: removed from the database, its values kept in the pages. Either way the change is shown before it is written.)`, { destructive: true })) ?? false;
    await this.run(() => core.removeProperty(this.id, property.key, { values }), `Remove ${property.label}${values ? " and its values" : ""}`);
  }

  /** A property added: its label and type (kept as typed while the dialog is drawn anew) */
  private adder(): HTMLElement {
    const { document: doc, core, types } = this.host;
    const label = el(doc, "input", { class: "swd-property-new-label", attrs: { placeholder: "New property", "aria-label": "New property's label" } });
    label.value = this.adding.label;
    label.addEventListener("input", () => void (this.adding.label = label.value));
    const type = el(doc, "select", { class: "swd-property-new-type", attrs: { "aria-label": "New property's type" } }, ...types.all().map((one) => new Option(one.label, one.name, false, one.name === this.adding.type)));
    type.addEventListener("change", () => void (this.adding.type = type.value));
    const add = el(doc, "button", {
      class: "swd-property-add",
      text: "Add",
      run: async () => {
        if (!label.value.trim()) return label.focus();
        const wanted = { label: label.value, type: type.value };
        this.adding = { ...wanted };
        if (await this.run(() => core.addProperty(this.id, wanted), "")) {
          this.adding = { label: "", type: "" };
          this.draw();
        }
      },
    });
    label.addEventListener("keydown", (event) => {
      if (event.key === "Enter") add.click();
    });
    return el(doc, "div", `${BASE}-card swd-property-adder`, el(doc, "div", `${BASE}-row`, label, type, add));
  }

  /** A change of items shown before it is applied: how many items, the values kept as they are */
  private review(proposal: Proposal, what: string): HTMLElement {
    const { document: doc, core } = this.host;
    const items = proposal.plan.planned.filter((one) => "item" in one.target).length;
    const left = proposal.plan.skipped.length;
    const kept = proposal.unreadable?.length ?? 0;
    const lines = [
      `${what}: ${items === 0 ? "no item's value changes" : items === 1 ? "one item changes" : `${items} items change`}.`,
      kept ? `${kept === 1 ? "One value does" : `${kept} values do`} not read as the new type: kept as ${kept === 1 ? "it is" : "they are"}, shown invalid.` : "",
      left ? `${left === 1 ? "One part" : `${left} parts`} cannot be changed and will be left: ${[...new Set(proposal.plan.skipped.map((one) => one.reason))].join("; ")}.` : "",
    ].filter(Boolean);
    const apply = el(doc, "button", {
      class: `${BASE}-save swd-property-apply`,
      text: "Apply",
      run: async () => {
        if (this.busy) return;
        this.busy = true;
        apply.disabled = cancel.disabled = true;
        try {
          await core.apply(proposal);
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
    return el(doc, "div", { class: `${BASE}-card swd-property-review`, attrs: { role: "status", "aria-live": "polite" } }, ...lines.map((line) => el(doc, "p", { text: line })), el(doc, "div", `${BASE}-row`, cancel, apply));
  }
}

/** A row's label of a setting without a control of the shared kinds */
function settingRowLabel(doc: Document, name: string, hint: string): HTMLElement {
  return el(doc, "span", `${BASE}-label`, el(doc, "span", { class: `${BASE}-name`, text: name }), el(doc, "span", { class: `${BASE}-hint`, text: hint }));
}
