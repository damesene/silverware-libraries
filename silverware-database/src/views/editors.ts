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
import { suggestionList } from "../../../shared/suggest.ts";
import { floatPanel } from "./float.ts";
import { readLink, writeLink } from "../domain/types/link.ts";
import { folderSearch, foundBy, pathOf } from "../domain/folders.ts";
import { linkedDocument, type Reference, readReferences, validateReferenceTarget, writeReference } from "../domain/types/reference.ts";
import { readMoment } from "../domain/types/moment.ts";
import type { Item, Property, Value } from "../model/database.ts";
import type { ViewHost } from "../core/view.ts";
import { VIEW_ICONS } from "./icons.ts";

/** What an editor needs of its host: a view's, or a module's made of the same parts (the peek's) */
export type EditorHost = Pick<ViewHost, "document" | "database" | "type" | "text" | "update" | "rename" | "notify" | "documents" | "validateDocumentName" | "openByName" | "openMention" | "noun" | "folderSeparator">;

/** The built-in property every item has: its name */
export const NAME = "name";

/** Options of a select or multi-select, as its params have them */
function optionsOf(property: Property): readonly string[] {
  const options = property.params.options;
  return Array.isArray(options) ? options.filter((one): one is string => typeof one === "string") : [];
}

/** What a value given by an editor is written as: an empty one taken off (the property empty) */
const written = (value: Value): Value | undefined => (value === null || value === "" || (Array.isArray(value) && !value.length) ? undefined : value);

// The browser's field of each kind of editor a type says (`PropertyType.editor`) its values are edited in
const FIELD_OF: Readonly<Record<string, string>> = { date: "date", time: "time", "datetime-local": "datetime-local" };

/**
 * A value as the browser's field of a date or a date and time takes it: a
 * date's its day (a time it keeps not shown), a date and time's its day and
 * time (a day alone at midnight, which is written only if the field is
 * changed); else as kept
 */
function fieldValue(field: string, kept: string): string {
  const moment = readMoment(kept);
  if (!moment) return kept;
  if (field === "date") return moment.day;
  return field === "datetime-local" ? `${moment.day}T${moment.time ?? "00:00"}` : kept;
}

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

/** The options offered for what is typed: all with nothing typed, else those starting with it first, then those holding it (ignoring case) */
function offered(options: readonly string[], typed: string): readonly string[] {
  const q = typed.trim().toLowerCase();
  if (!q) return options;
  return [...options.filter((one) => one.toLowerCase().startsWith(q)), ...options.filter((one) => !one.toLowerCase().startsWith(q) && one.toLowerCase().includes(q))];
}

/**
 * A cell's value edited in place (not where an editor is open in it already): `cell`'s content made the editor of its
 * property's type, given back (as `show` draws it) once saved (Enter, the
 * field left, a choice picked; `show` given the item with the value written)
 * or put aside (Esc). A checkbox has no editor: a click on it is its change,
 * drawn by the views. The name is the item's rename.
 */
export function editValue(host: EditorHost, cell: HTMLElement, item: Item, key: string, show: (written?: Item) => void): void {
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
    // Shown with the value written until the place is drawn anew with it (or with why it was not): a view that holds its
    // drawing while another of its cells is edited (the field left by a press on it) shows it at once
    show(key === NAME ? { ...item, name: typeof value === "string" ? value : "" } : { ...item, values: withValue(item.values, key, value) });
    const result = key === NAME ? await host.rename(item, typeof value === "string" ? value : "") : await host.update(item, key, value);
    // Not written (why said to the user, or nothing to do): shown as it was again, where the cell is not edited anew meanwhile
    if ("problem" in result && !editing.has(cell)) show();
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

  // One option, or a value typed besides them (a person's with Anyone): a field offering the options as they show
  if (type?.editor === "select" && property && type.takesTyped?.(property.params)) {
    const input = el(doc, "input", { class: "swd-editor swd-editor-typed", attrs: { type: "text", autocomplete: "off", "aria-label": property.label } });
    input.value = kept;
    // Its options offered under it, all of them with nothing typed (a value cleared offers them again), as kept: a person's
    // ada, its @ only how it shows; one taken saved at once
    const list = suggestionList(doc, input, {
      base: "swd",
      whenEmpty: true,
      suggest: (typed) => offered(optionsOf(property), typed),
      take: (name) => {
        input.value = name;
        commit();
      },
    });
    const was = input.value;
    const commit = () => {
      // (Once: Enter saves, and the field left as it goes does not save or say anything again)
      if (ended) return;
      if (input.value.trim() === was.trim()) return end();
      const parsed = type.parse(input.value, property.params, now);
      if ("problem" in parsed) {
        host.notify(`${property.label} of ${item.name}: ${parsed.problem}: not written`);
        return end();
      }
      void save(written(parsed.value));
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (event) => {
      // (Not where the list took it: an option picked by the arrows taken)
      if (event.key === "Enter" && !event.defaultPrevented) {
        event.preventDefault();
        commit();
      }
    });
    escape(input);
    cell.replaceChildren(el(doc, "div", "swd-suggest-field", input, list));
    floatPanel(list, input, "under");
    editing.set(cell, input);
    input.focus();
    input.select();
    return;
  }

  if (type?.editor === "select" && property) {
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
    // Its list open at once (a press, a key on the value: the browser lets a page open it within one); where it cannot, the
    // field focused, its list a press or Alt+↓ away
    try {
      (select as HTMLSelectElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // (Not within a user's press or key, or not supported for a list: left closed)
    }
    return;
  }

  if (type?.editor === "multi-select" && property) {
    // A box per option, the values kept that are none of them too: saved as the panel is left (Enter, a press elsewhere)
    const was = Array.isArray(now) ? now.map(String) : now === undefined || now === null || now === "" ? [] : [String(now)];
    const options = [...optionsOf(property), ...was.filter((one) => !optionsOf(property).includes(one))];
    const panel = el(doc, "div", { class: "swd-editor swd-editor-choices", attrs: { tabindex: "-1", role: "group", "aria-label": property.label } });
    const choice = (option: string, checked: boolean) => {
      const box = el(doc, "input", { attrs: { type: "checkbox", value: option } });
      box.checked = checked;
      return { box, label: el(doc, "label", "swd-editor-choice", box, option) };
    };
    const boxes = options.map((option) => {
      const made = choice(option, was.includes(option));
      panel.append(made.label);
      return made.box;
    });
    // A value typed besides the options, where the type takes one (a person's with Anyone): a field under the boxes, Enter
    // in it adding what it reads as (ticked, a box of its own where none is), the field empty again for another
    const adder = type.takesTyped?.(property.params) ? el(doc, "input", { class: "swd-editor-add", attrs: { type: "text", placeholder: "Add…", "aria-label": `Add to ${property.label}` } }) : undefined;
    const add = (): string | undefined => {
      if (!adder || adder.value.trim() === "") return undefined;
      const parsed = type.parse(adder.value, property.params);
      if ("problem" in parsed) return parsed.problem;
      for (const one of Array.isArray(parsed.value) ? parsed.value : parsed.value === null ? [] : [String(parsed.value)]) {
        const there = boxes.find((box) => box.value === one);
        if (there) there.checked = true;
        else {
          const made = choice(one, true);
          adder.before(made.label);
          boxes.push(made.box);
        }
      }
      adder.value = "";
      return undefined;
    };
    if (adder) {
      panel.append(adder);
      adder.addEventListener("input", () => adder.setCustomValidity(""));
      adder.addEventListener("keydown", (event) => {
        // (Enter with nothing typed saves, as anywhere in the panel)
        if (event.key !== "Enter" || adder.value.trim() === "") return;
        event.preventDefault();
        event.stopPropagation();
        const problem = add();
        if (problem) {
          adder.setCustomValidity(problem);
          adder.reportValidity();
        }
      });
    }
    const commit = () => {
      // (What is typed and not added yet, added: the panel left with it in the field)
      add();
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
    floatPanel(panel, cell, "over");
    editing.set(cell, panel);
    (boxes[0] ?? adder ?? panel).focus({ preventScroll: true });
    // (Whole in view: in a box that scrolls, the peek's properties, it may open past its edge)
    panel.scrollIntoView?.({ block: "nearest" });
    return;
  }

  // References: picked from the space's documents; a value the type does not take, or in another form than a list of links
  // (a type of the user's), edited as text below, kept as it is
  const references = type?.editor === "documents" && property && (kept === "" || type.validate(now ?? null, property.params) === undefined) ? (kept === "" ? [] : readReferences(now)) : undefined;
  if (references && property && type) {
    return documentsEditor(cell, property.label, host, references, host.documents(), escape, (picked) => {
      // (The same documents in the same order: nothing written; a reference kept keeps how it was written, its text too)
      const targets = references.map((one) => one.target);
      if (picked.length === targets.length && picked.every((one, at) => one === targets[at])) return end();
      // (Read by the type, as any editor's text: the links picked, each kept one as written, the new ones links)
      const asKept = new Map(references.map((one) => [one.target, one.written]));
      const parsed = type.parse(picked.map((one) => asKept.get(one) ?? writeReference(one)).join(", "), property.params, now);
      if ("problem" in parsed) {
        host.notify(`${property.label} of ${item.name}: ${parsed.problem}: not written`);
        return end();
      }
      void save(written(parsed.value));
    });
  }

  if (type?.editor === "link" && property) {
    // (Read by the type as typed: an address it takes, `www.` an https one; one it does not, said so, nothing written)
    return linkEditor(cell, kept, escape, end, (typed, leaving) => {
      if (typed === "") return void save(undefined);
      const parsed = type.parse(typed, property.params, now);
      if ("problem" in parsed) {
        // (Left: not written, said so; Enter: kept open on what was typed, why said there)
        if (!leaving) return parsed.problem;
        host.notify(`${property.label} of ${item.name}: ${parsed.problem}: not written`);
        return void end();
      }
      void save(written(parsed.value));
      return undefined;
    });
  }

  // A field of text, read by the type as typed; the browser's own field of a date, a time, both, where the type says its
  // values are edited in one and the value kept reads as the type (else a field of text, the value kept as it is)
  const input = el(doc, "input", "swd-editor");
  const field = type?.editor ? FIELD_OF[type.editor] : undefined;
  const reads = kept === "" || (!!property && !!type && type.validate(kept, property.params) === undefined);
  input.type = field && reads ? field : "text";
  input.value = input.type === "text" ? (key === NAME || !property || typeof now !== "number" ? kept : host.text(item, key)) : fieldValue(input.type, kept);
  const shown = input.value;
  const commit = (leaving: boolean) => {
    // A date or a time the field cannot read (one left half typed, a day no month has): the browser says empty, which is no clearing
    if (input.validity?.badInput) {
      host.notify(`${property?.label ?? "The value"} of ${item.name}: not read as ${type?.label.toLowerCase() ?? "its type"}: not written`);
      return end();
    }
    // Nothing typed: nothing written (a value of another kind kept as it is)
    if (input.value === shown) return end();
    if (key === NAME || !type || !property) return void save(input.value);
    const parsed = type.parse(input.value, property.params, now);
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
 * A link's editor: its address and its text (none: the address shown) in two
 * fields, written together as the link the type keeps (domain/types/link.ts)
 * once Enter is pressed or the editor is left; Esc puts it aside. What the
 * type makes of it is its `parse`'s, as for any field.
 */
function linkEditor(cell: HTMLElement, kept: string, escape: (field: HTMLElement) => void, end: () => void, take: (typed: string, leaving: boolean) => string | undefined): void {
  const doc = cell.ownerDocument;
  const link = kept ? readLink(kept) : undefined;
  const address = el(doc, "input", { class: "swd-editor swd-link-address", attrs: { type: "text", placeholder: "https://…", "aria-label": "Address" } });
  const text = el(doc, "input", { class: "swd-editor swd-link-text", attrs: { type: "text", placeholder: "Text shown (the address where none)", "aria-label": "Text shown" } });
  address.value = link?.url ?? kept;
  text.value = link?.text ?? "";
  const panel = el(doc, "div", { class: "swd-editor swd-editor-choices swd-editor-link", attrs: { role: "group", "aria-label": "Link" } }, address, text);
  const [urlWas, textWas] = [address.value, text.value];
  let done = false;
  const commit = (leaving: boolean) => {
    if (done) return;
    // Neither field changed: nothing written (a link kept as it was, its form as written)
    if (address.value === urlWas && text.value === textWas) {
      done = true;
      return end();
    }
    // (No address: the link taken off, whatever its text)
    const problem = take(address.value.trim() ? writeLink(address.value, text.value) : "", leaving);
    if (problem === undefined) return void (done = true);
    address.setCustomValidity(problem);
    address.reportValidity();
    address.title = problem;
  };
  for (const field of [address, text]) {
    field.addEventListener("input", () => address.setCustomValidity(""));
    field.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      commit(false);
    });
    escape(field);
  }
  // (Esc: what is typed put aside, the editor closed)
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") done = true;
  }, true);
  panel.addEventListener("focusout", (event) => {
    if (!panel.contains(event.relatedTarget as Node | null)) commit(true);
  });
  cell.replaceChildren(panel);
  floatPanel(panel, cell, "over");
  editing.set(cell, panel);
  address.focus();
  address.select();
}

/**
 * A value as a line of a card or a list shows it, beside others with no column
 * to say whose: a checkbox ticked its property's name (unticked: nothing),
 * any other value as its type shows it; none: nothing to show
 */
export function shownValue(host: ViewHost, item: Item, property: Property): string | undefined {
  const value = item.values[property.key];
  if (value === undefined || value === null || value === "") return undefined;
  if (host.type(property).look === "check") return value === true ? `✓ ${property.label}` : undefined;
  return host.text(item, property.key);
}

/** A checkbox's value turned (a click on it): written at once, as Notion's; unticked is false (a checkbox has no empty value) */
export function toggle(host: Pick<EditorHost, "update">, item: Item, key: string): Promise<unknown> {
  return host.update(item, key, item.values[key] !== true);
}

// The documents a search shows at most: more are found by typing more of a name
const SHOWN_DOCUMENTS = 50;

/**
 * References' editor: the documents picked, in their order, then the space's
 * documents a search finds (its words each in a document's name, ignoring
 * case; what it has up to a folder separator the folder they are in), a box
 * each; a name typed that no document has offered too, where a document can
 * have it (a link to a document to make), else why not. Enter in the search
 * ticks the first found and empties it, Enter without one saves, as leaving
 * the editor does; Esc puts it aside. Until the documents are listed nothing
 * typed is offered as new, nor ticked by Enter. Each document its name, its
 * folder under it; where documents are in folders, its folder icon searches
 * in it and its folder pressed beside it (a new one made there).
 */
function documentsEditor(
  cell: HTMLElement,
  label: string,
  host: Pick<EditorHost, "noun" | "folderSeparator" | "validateDocumentName">,
  references: readonly Reference[],
  documents: Promise<readonly string[]>,
  escape: (field: HTMLElement) => void,
  take: (picked: readonly string[]) => void,
): void {
  const doc = cell.ownerDocument;
  const { noun, folderSeparator: separator } = host;
  const picked = references.map((one) => one.target);
  let known: readonly string[] | undefined;
  let failed: string | undefined;
  const search = el(doc, "input", { class: "swd-editor-search", attrs: { type: "text", placeholder: `Find a ${noun.one}…`, "aria-label": `Find a ${noun.one} for ${label}` } });
  const list = el(doc, "div", { class: "swd-editor-list", attrs: { role: "group", "aria-label": label } });
  const note = el(doc, "div", { class: "swd-editor-note", attrs: { role: "status" } });
  const panel = el(doc, "div", { class: "swd-editor swd-editor-choices swd-editor-documents", attrs: { tabindex: "-1" } }, search, list, note);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    take(picked);
  };
  // What a search offers: the documents it finds, then the name typed where it is new and a document can have it; else why not
  const offered = (): { readonly found: readonly string[]; readonly fresh?: string; readonly problem?: string } => {
    if (!known) return { found: [] };
    const read = folderSearch(search.value, separator);
    const found = known.filter((name) => !picked.includes(name) && foundBy(name, read)).slice(0, SHOWN_DOCUMENTS);
    const typed = search.value.trim();
    // (A folder typed, `Projects/`, is no name yet: its documents found, a name still to type after it)
    if (!typed || (separator && typed.endsWith(separator)) || known.includes(typed) || picked.includes(typed)) return { found };
    const problem = validateReferenceTarget(typed) ?? host.validateDocumentName(typed);
    return problem ? { found, problem } : { found, fresh: typed };
  };
  // A button putting a folder in the search in place of what was typed (`Projects/`): the documents in it found, a name typed
  // after it a new one there. Pressed, it takes no focus (the search keeps it: the editor is not left); a pointer's way, the
  // keys type the path
  const searchIn = (folder: string, props: { readonly class: string; readonly html?: string; readonly text?: string }) =>
    el(doc, "button", {
      ...props,
      attrs: { title: `Find in ${folder}${separator} (a new ${noun.one} there: type its name after it)`, "aria-label": `Find in ${folder}${separator}`, tabindex: "-1" },
      on: { mousedown: (event) => event.preventDefault() },
      run: () => {
        search.value = `${folder}${separator}`;
        search.focus({ preventScroll: true });
        search.setSelectionRange(search.value.length, search.value.length);
        draw();
      },
    });
  // A document's row: its box and its name (the label ticking it), its folder icon after it, its folder under it
  const row = (name: string, ticked: boolean, isNew = false) => {
    const input = el(doc, "input", { attrs: { type: "checkbox", value: name, "aria-label": isNew ? `New: ${name}` : name } });
    input.checked = ticked;
    input.addEventListener("change", () => {
      if (input.checked && !picked.includes(name)) picked.push(name);
      if (!input.checked && picked.includes(name)) picked.splice(picked.indexOf(name), 1);
    });
    // (A link to a heading of a document, `People/Ada#Bio`: the folder its document's, the heading shown with its name)
    const document = linkedDocument(name);
    const { folder } = pathOf(document, separator);
    const leaf = folder === undefined ? name : name.slice(folder.length + separator!.length);
    return el(
      doc,
      "div",
      { class: `swd-editor-choice${isNew ? " swd-editor-new" : ""}`, attrs: { title: name } },
      el(doc, "label", "swd-editor-pick", input, el(doc, "span", { class: "swd-editor-document-name", text: `${isNew ? "New: " : ""}${leaf}` })),
      ...(isNew || !separator ? [] : [searchIn(document, { class: "swd-editor-document-into", html: VIEW_ICONS.folder })]),
      ...(folder === undefined ? [] : [isNew ? el(doc, "span", { class: "swd-editor-document-folder", text: folder }) : searchIn(folder, { class: "swd-editor-document-folder", text: folder })]),
    );
  };
  const draw = () => {
    // (The box that had the focus has it again, drawn anew; one gone leaves it to the search)
    const focused = doc.activeElement instanceof HTMLInputElement && list.contains(doc.activeElement) ? doc.activeElement.value : undefined;
    const { found, fresh, problem } = offered();
    list.replaceChildren(...picked.map((name) => row(name, true)), ...found.map((name) => row(name, false)), ...(fresh ? [row(fresh, false, true)] : []));
    note.textContent = failed ?? (!known ? `Listing the ${noun.many}…` : (problem ?? ""));
    note.hidden = note.textContent === "";
    if (focused === undefined) return;
    const again = [...list.querySelectorAll<HTMLInputElement>("input")].find((one) => one.value === focused);
    (again ?? search).focus({ preventScroll: true });
  };
  search.addEventListener("input", draw);
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!search.value.trim()) return finish();
    const { found, fresh } = offered();
    const first = found[0] ?? fresh;
    if (!first) return;
    picked.push(first);
    search.value = "";
    draw();
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target !== search) {
      event.preventDefault();
      finish();
    }
  });
  panel.addEventListener("focusout", (event) => {
    if (!panel.contains(event.relatedTarget as Node | null)) finish();
  });
  escape(panel);
  draw();
  cell.replaceChildren(panel);
  floatPanel(panel, cell, "over");
  editing.set(cell, panel);
  search.focus({ preventScroll: true });
  panel.scrollIntoView?.({ block: "nearest" });
  // (The space's documents as they come: what was typed meanwhile searched among them; not listed, said, the names typed still taken)
  void documents.then(
    (names) => {
      known = names;
      if (!done) draw();
    },
    (error: unknown) => {
      known = [];
      failed = `The ${noun.many} could not be listed: ${error instanceof Error ? error.message : String(error)}`;
      if (!done) draw();
    },
  );
}

/** An item's values with one written (none: taken off, as a value cleared is) */
function withValue(values: Item["values"], key: string, value: Value | undefined): Item["values"] {
  if (value !== undefined) return { ...values, [key]: value };
  const { [key]: _gone, ...rest } = values;
  return rest;
}
