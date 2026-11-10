// Fields for tags: one tag typed (`tagField`, a rename's new name) and tags as
// chips (`chipsField`: × takes one off, Enter or a comma adds what is typed,
// Backspace in an empty field takes the last off). Both offer the tags of the
// space that start with, or hold, what is typed (↑ ↓ to pick, Enter or a
// click to take it, Tab the one picked or the first, Esc to close the list:
// the dialog stays).
import { el } from "../../../shared/elements.ts";
import { suggestionList } from "../../../shared/suggest.ts";
import { ICONS } from "./icons.ts";
import { hashtagOf } from "../../../shared/markdown/inline.ts";
import { cleanName, validateName } from "../../../shared/pages/tags/names.ts";
import { tagAtCaret } from "../tags/query.ts";

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

/** A list of names under a field, kept by what is typed (shared/suggest.ts), each as a hashtag; `take` given the name picked */
function withSuggestions(doc: Document, input: HTMLInputElement, suggest: Suggest, take: (name: string) => void): HTMLElement {
  return suggestionList(doc, input, { base: "swg", suggest, take, label: hashtagOf });
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

/** A search of pages (tags/query.ts): the `#tag` typed at the caret offered the space's tags, the one taken written in its place */
export function tagSearchField(doc: Document, options: { readonly value?: string; readonly placeholder: string; readonly names: readonly string[]; readonly changed: () => void }): TagField {
  const input = el(doc, "input", { class: "swg-field swg-search", attrs: { type: "search", placeholder: options.placeholder, "aria-label": options.placeholder, spellcheck: "false", autocomplete: "off", "data-swg-focus": "" } });
  input.value = options.value ?? "";
  const caret = () => input.selectionStart ?? input.value.length;
  const list = withSuggestions(
    doc,
    input,
    (value) => {
      const at = tagAtCaret(value, caret());
      return at?.typed.trim() ? suggestions(options.names, at.typed) : [];
    },
    (name) => {
      const at = tagAtCaret(input.value, caret());
      if (!at) return;
      const written = `${at.not ? "-" : ""}${hashtagOf(name)} `;
      input.value = input.value.slice(0, at.from) + written + input.value.slice(at.to).replace(/^ /, "");
      const end = at.from + written.length;
      input.setSelectionRange(end, end);
      options.changed();
    },
  );
  input.addEventListener("input", () => options.changed());
  return { element: el(doc, "div", "swg-field-wrap", input, list), input, value: () => input.value };
}

export type ChipsField = {
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  // The tags chosen, what is still typed added first where it is a name
  values(): string[];
  // The tags chosen as chips, what is typed left as it is
  chosen(): string[];
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
    if (validateName(name)) {
      input.setAttribute("aria-invalid", "true");
      input.title = validateName(name)!;
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
    chosen: () => [...values],
  };
}
