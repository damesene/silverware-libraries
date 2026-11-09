// A list of names offered under a field, kept by what is typed (any plugin's,
// its classes by the caller's base: `<base>-suggest`, `<base>-suggest-item`,
// each item's name in `data-<base>-name`): ↑ ↓ pick one, Enter or a click
// takes the one picked, Tab the one picked or, something typed, the first
// (nothing typed since it was offered, it leaves the field as anywhere); with
// `whenEmpty` every name is offered as the field is focused or emptied (what
// it holds then is no search: a value kept, selected), Esc closes the list
// alone (what the field is in stays). Nothing picked until an arrow picks one,
// so Enter takes what is typed. The caller places it (its CSS: under the field).
import { el } from "./elements.ts";

export type SuggestOptions = {
  /** The base of its classes (`swg`: `swg-suggest`) */
  readonly base: string;
  /** The names offered for what is typed */
  readonly suggest: (typed: string) => readonly string[];
  /** The name taken (picked, clicked, Tab) */
  readonly take: (name: string) => void;
  /** How a name shows in the list (none: as it is) */
  readonly label?: (name: string) => string;
  /** Offered with nothing typed too, and as the field is focused (none: only once something is typed) */
  readonly whenEmpty?: boolean;
};

/** The list under `input`, given back to be put beside it */
export function suggestionList(doc: Document, input: HTMLInputElement, options: SuggestOptions): HTMLElement {
  const { base } = options;
  const list = el(doc, "ul", { class: `${base}-suggest`, attrs: { role: "listbox" } });
  list.hidden = true;
  let offered: readonly string[] = [];
  let at = -1;
  // Whether what the field holds was typed since the list was offered (a search), not what it held as it was focused
  let typed = false;
  const show = (search: string) => {
    typed = search.trim() !== "";
    offered = options.whenEmpty || typed ? options.suggest(search) : [];
    at = -1;
    list.replaceChildren(
      ...offered.map((name, i) =>
        el(doc, "li", {
          class: `${base}-suggest-item`,
          text: options.label ? options.label(name) : name,
          attrs: { role: "option", "aria-selected": String(i === at), [`data-${base}-name`]: name },
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
    list.hidden = true;
    offered = [];
    options.take(name);
  };
  input.addEventListener("input", () => show(input.value));
  if (options.whenEmpty) input.addEventListener("focus", () => show(""));
  input.addEventListener("blur", () => (list.hidden = true));
  input.addEventListener("keydown", (e) => {
    // (Closed by Esc: ↓ offers again, as the field is typed in)
    if (options.whenEmpty && list.hidden && e.key === "ArrowDown") {
      e.preventDefault();
      show("");
      return;
    }
    if (list.hidden || !offered.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      at = (at + (e.key === "ArrowDown" ? 1 : -1) + offered.length) % offered.length;
      mark();
      list.querySelectorAll("li")[at]?.scrollIntoView?.({ block: "nearest" });
    } else if ((e.key === "Enter" && at >= 0) || (e.key === "Tab" && (at >= 0 || typed))) {
      e.preventDefault();
      e.stopPropagation();
      pick(Math.max(at, 0));
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      list.hidden = true;
    }
  });
  // (Shown at once where the field has the focus already as the list is made)
  if (options.whenEmpty && doc.activeElement === input) show("");
  return list;
}
