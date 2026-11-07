// What the built-in views edit a value with, by its property's type: the
// browser's own controls for now (a date field, a list to pick from, a list of
// boxes for several), so they work with keys, a screen reader and a phone; one
// place to make them look otherwise later.
//
// Nothing is written that the user did not change: a value is written only
// where the field differs from what it showed as it opened (a value of
// another kind than its type's, a date the date field cannot hold, kept as it
// is by a click in and out). A value typed is read by its type (`parse`): one
// that does not read is said so and not written. An empty value takes the key
// off the item.
import { el } from "../../../shared/elements.ts";
import type { Item, Property, Value } from "../model/database.ts";
import type { ViewHost } from "../core/view.ts";

/** What an editor needs of its host: a view's, or a module's made of the same parts (the peek's) */
export type EditorHost = Pick<ViewHost, "document" | "database" | "type" | "text" | "update" | "rename" | "notify">;

/** The built-in property every item has: its name */
export const NAME = "name";

/** Options of a select or multi-select, as its params have them */
function optionsOf(property: Property): readonly string[] {
  const options = property.params.options;
  return Array.isArray(options) ? options.filter((one): one is string => typeof one === "string") : [];
}

/** What a value given by an editor is written as: an empty one taken off (the property empty) */
const written = (value: Value): Value | undefined => (value === null || value === "" || (Array.isArray(value) && !value.length) ? undefined : value);

// A date as the browser's date field holds it
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A list to pick from (a select) that acts as the mouse picks, not as arrow
 * keys go through it (on Windows a closed select changes with each arrow):
 * picked by the keys, Enter takes it, leaving it takes it where `onLeave`
 */
export function pickFrom(select: HTMLSelectElement, take: () => void, options: { readonly onLeave: boolean }): void {
  let byKeys = false;
  const initial = select.value;
  select.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      take();
    } else if (event.key.startsWith("Arrow") || event.key.length === 1 || ["Home", "End", "PageUp", "PageDown"].includes(event.key)) byKeys = true;
  });
  select.addEventListener("change", () => {
    if (!byKeys) take();
  });
  select.addEventListener("blur", () => {
    if (options.onLeave) {
      if (byKeys) take();
      return;
    }
    // Left without Enter: what the keys went to is taken back, so the list shows what is, and the next pick is the mouse's again
    byKeys = false;
    select.value = initial;
  });
}

// The cells an editor is open in, with it: one at a time each, while that editor is still in its cell (a view drawing
// the cell otherwise meanwhile leaves it editable again)
const editing = new WeakMap<HTMLElement, Element>();

/**
 * A cell's value edited in place (not where an editor is open in it already): `cell`'s content made the editor of its
 * property's type, given back (as `show` draws it) once saved (Enter, the
 * field left, a choice picked) or put aside (Esc). A checkbox has no editor:
 * a click on it is its change, drawn by the views. The name is the item's
 * rename.
 */
export function editValue(host: EditorHost, cell: HTMLElement, item: Item, key: string, show: () => void): void {
  const doc = host.document;
  // (An editor open in the cell already: a click in it, or the cell's own handler again, opens no second one over what is typed)
  const open = editing.get(cell);
  if (open && cell.contains(open)) return;
  const property = host.database.properties.find((one) => one.key === key);
  if (key !== NAME && (!property || property.readonly)) return;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    editing.delete(cell);
    show();
  };
  const save = async (value: Value | undefined) => {
    if (ended) return;
    ended = true;
    editing.delete(cell);
    // Shown as it was until the place is drawn anew with the value written (or with why it was not)
    show();
    if (key === NAME) await host.rename(item, typeof value === "string" ? value : "");
    else await host.update(item, key, value);
  };
  const escape = (field: HTMLElement) =>
    field.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      end();
    });
  const now = key === NAME ? item.name : item.values[key];
  const kept = now === undefined || now === null ? "" : Array.isArray(now) ? now.join(", ") : String(now);
  const type = property ? host.type(property) : undefined;

  if (type?.name === "select" && property) {
    const select = el(doc, "select", "swd-editor");
    const options = optionsOf(property);
    select.append(new Option("", ""), ...options.map((option) => new Option(option, option)));
    // A value kept that is none of the options (another kind of value too): shown as it is, so leaving it changes nothing
    if (kept && !options.includes(kept)) select.append(new Option(kept, kept));
    select.value = kept;
    const take = () => (select.value === kept ? end() : void save(written(select.value)));
    pickFrom(select, take, { onLeave: true });
    select.addEventListener("blur", () => setTimeout(end));
    escape(select);
    cell.replaceChildren(select);
    editing.set(cell, select);
    select.focus();
    return;
  }

  if (type?.name === "multi-select" && property) {
    // A box per option, the values kept that are none of them too: saved as the panel is left (Enter, a press elsewhere)
    const was = Array.isArray(now) ? now.map(String) : now === undefined || now === null || now === "" ? [] : [String(now)];
    const options = [...optionsOf(property), ...was.filter((one) => !optionsOf(property).includes(one))];
    const panel = el(doc, "div", { class: "swd-editor swd-editor-choices", attrs: { tabindex: "-1", role: "group", "aria-label": property.label } });
    const boxes = options.map((option) => {
      const box = el(doc, "input", { attrs: { type: "checkbox", value: option } });
      box.checked = was.includes(option);
      panel.append(el(doc, "label", "swd-editor-choice", box, option));
      return box;
    });
    const commit = () => {
      const ticked = new Set(boxes.filter((box) => box.checked).map((box) => box.value));
      // The same values: nothing written, whatever their order; else those kept in their order, the new ones after
      const had = new Set(was);
      if (ticked.size === had.size && [...had].every((one) => ticked.has(one))) return end();
      void save(written([...was.filter((one) => ticked.has(one)), ...[...ticked].filter((one) => !was.includes(one))]));
    };
    panel.addEventListener("focusout", (event) => {
      if (!panel.contains(event.relatedTarget as Node | null)) commit();
    });
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      }
    });
    escape(panel);
    cell.replaceChildren(panel);
    editing.set(cell, panel);
    (boxes[0] ?? panel).focus();
    return;
  }

  // A field of text, read by the type as typed; a date in the browser's date field where it holds the date kept
  const input = el(doc, "input", "swd-editor");
  // (A date as the field holds it: of its form and a real day, `2026-02-30` none; else a field of text, the date kept as it is)
  const realDate = kept === "" || (ISO_DATE_RE.test(kept) && !!property && !!type && type.validate(kept, property.params) === undefined);
  input.type = type?.name === "date" && realDate ? "date" : type?.name === "url" ? "url" : "text";
  input.value = key === NAME || !property || typeof now !== "number" ? kept : host.text(item, key);
  const shown = input.value;
  const commit = (leaving: boolean) => {
    // A date the field cannot read (one left half typed, a day no month has): the browser says empty, which is no clearing
    if (input.validity?.badInput) {
      host.notify(`${property?.label ?? "The value"} of ${item.name}: not a date: not written`);
      return end();
    }
    // Nothing typed: nothing written (a value of another kind kept as it is)
    if (input.value === shown) return end();
    if (key === NAME || !type || !property) return void save(input.value);
    const parsed = type.parse(input.value, property.params);
    if ("problem" in parsed) {
      if (leaving) {
        // (The field left: not written, said so, rather than kept open under the user's next press)
        host.notify(`${property.label} of ${item.name}: ${parsed.problem}: not written`);
        return end();
      }
      input.setCustomValidity(parsed.problem);
      input.reportValidity();
      input.title = parsed.problem;
      return;
    }
    void save(written(parsed.value));
  };
  input.addEventListener("input", () => input.setCustomValidity(""));
  input.addEventListener("blur", () => commit(true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(false);
    }
  });
  escape(input);
  cell.replaceChildren(input);
  editing.set(cell, input);
  input.focus();
  input.select();
}

/**
 * A value as a line of a card or a list shows it, beside others with no column
 * to say whose: a checkbox ticked its property's name (unticked: nothing),
 * any other value as its type shows it; none: nothing to show
 */
export function shownValue(host: ViewHost, item: Item, property: Property): string | undefined {
  const value = item.values[property.key];
  if (value === undefined || value === null || value === "") return undefined;
  if (host.type(property).name === "checkbox") return value === true ? `✓ ${property.label}` : undefined;
  return host.text(item, property.key);
}

/** A checkbox's value turned (a click on it): written at once, as Notion's; unticked is false (a checkbox has no empty value) */
export function toggle(host: Pick<EditorHost, "update">, item: Item, key: string): Promise<unknown> {
  return host.update(item, key, item.values[key] !== true);
}
