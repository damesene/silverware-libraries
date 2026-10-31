// Fields for tags: one tag typed (`tagField`, a rename's new name) and tags as
// chips (`chipsField`: × takes one off, Enter or a comma adds what is typed,
// Backspace in an empty field takes the last off). Both offer the tags of the
// space that start with, or hold, what is typed (↑ ↓ to pick, Enter or a
// click to take it, Tab the one picked or the first, Esc to close the list:
// the dialog stays).
import { el } from "./elements.ts";
import { ICONS } from "./icons.ts";
import { cleanName, hashtagOf, nameProblem } from "../tags/names.ts";

// At most this many offered
const OFFERED = 8;

/** The names offered for what is typed: those starting with it first, then those holding it (ignoring case), `except` left out */
export function suggestions(names: readonly string[], typed: string, except: ReadonlySet<string> = new Set()): string[] {
  const q = cleanName(typed).toLowerCase();
  if (!q) return [];
  const pool = names.filter((name) => !except.has(name));
  const starts = pool.filter((name) => name.toLowerCase().startsWith(q));
  const holds = pool.filter((name) => !name.toLowerCase().startsWith(q) && name.toLowerCase().includes(q));
  return [...starts.sort(), ...holds.sort()].slice(0, OFFERED);
}

type Suggest = (typed: string) => readonly string[];

/** A list of names under a field, kept by what is typed; `take` given the name picked */
function withSuggestions(doc: Document, input: HTMLInputElement, suggest: Suggest, take: (name: string) => void): HTMLElement {
  const list = el(doc, "ul", { class: "swg-suggest", attrs: { role: "listbox" } });
  list.hidden = true;
  let offered: readonly string[] = [];
  let at = -1;
  const show = () => {
    offered = input.value.trim() ? suggest(input.value) : [];
    // Nothing picked until an arrow picks one: Enter takes what is typed, Tab the first offered
    at = -1;
    list.replaceChildren(
      ...offered.map((name, i) =>
        el(doc, "li", {
          class: "swg-suggest-item",
          text: hashtagOf(name),
          attrs: { role: "option", "aria-selected": String(i === at), "data-swg-name": name },
          // A press keeps the field's focus (a click then takes the name)
          on: { mousedown: (e) => e.preventDefault(), click: () => pick(i) },
        }),
      ),
    );
    list.hidden = !offered.length;
  };
  const mark = () => list.querySelectorAll("li").forEach((li, i) => li.setAttribute("aria-selected", String(i === at)));
  const pick = (i: number) => {
    const name = offered[i];
    if (name === undefined) return;
    take(name);
    list.hidden = true;
    offered = [];
  };
  input.addEventListener("input", show);
  input.addEventListener("blur", () => (list.hidden = true));
  input.addEventListener("keydown", (e) => {
    if (list.hidden || !offered.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      at = (at + (e.key === "ArrowDown" ? 1 : -1) + offered.length) % offered.length;
      mark();
    } else if ((e.key === "Enter" && at >= 0) || e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      pick(Math.max(at, 0));
    } else if (e.key === "Escape") {
      // The list closed, the dialog stays
      e.preventDefault();
      e.stopPropagation();
      list.hidden = true;
    }
  });
  return list;
}

export type TagField = { readonly element: HTMLElement; readonly input: HTMLInputElement; value(): string };

/** One tag typed, the space's offered */
export function tagField(doc: Document, options: { readonly value?: string; readonly placeholder?: string; readonly suggest: Suggest; readonly changed?: () => void }): TagField {
  const input = el(doc, "input", { class: "swg-field", attrs: { type: "text", placeholder: options.placeholder, spellcheck: "false", autocomplete: "off" } });
  input.value = options.value ?? "";
  const list = withSuggestions(doc, input, options.suggest, (name) => {
    input.value = name;
    options.changed?.();
  });
  input.addEventListener("input", () => options.changed?.());
  const element = el(doc, "div", "swg-field-wrap", input, list);
  return { element, input, value: () => cleanName(input.value) };
}

export type ChipsField = {
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  // The tags chosen, what is still typed added first where it is a name
  values(): string[];
};

/** Tags as chips, the space's offered as one is typed */
export function chipsField(doc: Document, options: { readonly values?: readonly string[]; readonly placeholder?: string; readonly suggest: Suggest; readonly changed?: () => void; readonly kind?: string }): ChipsField {
  const values: string[] = [...(options.values ?? [])];
  const chips = el(doc, "span", "swg-chips-list");
  const input = el(doc, "input", { class: "swg-chips-input", attrs: { type: "text", placeholder: options.placeholder, spellcheck: "false", autocomplete: "off" } });
  const render = () => {
    chips.replaceChildren(
      ...values.map((name, i) =>
        el(
          doc,
          "span",
          { class: "swg-chip", attrs: { "data-swg-chip": name } },
          el(doc, "span", { class: "swg-chip-name", text: hashtagOf(name) }),
          el(doc, "button", {
            class: "swg-chip-remove",
            html: ICONS.close,
            title: `Remove ${hashtagOf(name)}`,
            attrs: { "aria-label": `Remove ${hashtagOf(name)}` },
            run: () => {
              values.splice(i, 1);
              render();
              options.changed?.();
              input.focus();
            },
          }),
        ),
      ),
    );
  };
  const add = (typed: string): boolean => {
    const name = cleanName(typed);
    if (!name) return true;
    if (nameProblem(name)) {
      input.setAttribute("aria-invalid", "true");
      input.title = nameProblem(name)!;
      return false;
    }
    input.removeAttribute("aria-invalid");
    input.title = "";
    if (!values.includes(name)) values.push(name);
    input.value = "";
    render();
    options.changed?.();
    return true;
  };
  const list = withSuggestions(doc, input, (typed) => options.suggest(typed).filter((name) => !values.includes(name)), (name) => add(name));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      if (!input.value.trim()) return;
      e.preventDefault();
      // (Enter in a dialog would go on to its own button)
      e.stopPropagation();
      add(input.value);
    } else if (e.key === "Backspace" && !input.value && values.length) {
      values.pop();
      render();
      options.changed?.();
    }
  });
  input.addEventListener("blur", () => {
    if (input.value.trim()) add(input.value);
  });
  render();
  const element = el(doc, "div", { class: "swg-chips", attrs: { "data-swg-kind": options.kind }, on: { mousedown: (e) => e.target === e.currentTarget && (e.preventDefault(), input.focus()) } }, chips, el(doc, "span", "swg-field-wrap swg-chips-field", input, list));
  return {
    element,
    input,
    values: () => {
      if (input.value.trim()) add(input.value);
      return [...values];
    },
  };
}
