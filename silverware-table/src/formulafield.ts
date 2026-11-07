// A formula's field, for any dialog of a module (conditional formatting's
// formula conditions, a view's formula): the names offered as a name is typed
// (functions, the page's names, the table's columns), the syntax of the
// function the caret is in with its argument marked, why the formula does
// not read. It knows nothing of formulas: the module gives it its helpers,
// through the formulas module's offer (`complete`, `help`, `problem`).
import { el, type ElementChild } from "../../shared/elements.ts";

/** A choice offered while a formula is typed: what the list shows, what it puts in place of from..to */
export type FormulaOffer = { readonly label: string; readonly insert: string; readonly kind: string };

/** What the field asks while a formula is typed (the formulas module's, through the module showing it) */
export type FormulaHelpers = {
  // The choices for the name typed before the caret, and where that name is
  readonly complete: (formula: string, caret: number) => { readonly from: number; readonly to: number; readonly choices: readonly FormulaOffer[] } | undefined;
  // The function the caret is in: its syntax, the argument at the caret
  readonly help: (formula: string, caret: number) => { readonly syntax: string; readonly description: string; readonly argument?: { readonly from: number; readonly to: number } } | undefined;
  // Why it does not read; undefined: it does
  readonly validate: (formula: string) => string | undefined;
};

/** Where the field is and what it says while empty */
export type FormulaFieldOptions = {
  // Its name for a screen reader
  readonly label: string;
  // Its `data-focus`: the dialog's way of keeping the focus where it was as it is made anew
  readonly focus: string;
  readonly placeholder?: string;
};

/**
 * The field: the functions and the table's columns offered as a name is typed (↑ ↓ to pick, Enter or
 * Tab to put it in, Esc to close the list, a click), the syntax of the function the caret is in (the argument at
 * the caret marked), why it does not read
 */
export function formulaField(doc: Document, helpers: FormulaHelpers, value: string, changed: (v: string) => void, options: FormulaFieldOptions): HTMLElement {
  const e = <K extends keyof HTMLElementTagNameMap>(tag: K, props?: Parameters<typeof el>[2], ...children: ElementChild[]) => el(doc, tag, props, ...children);
  const { focus, label } = options;
  const input = e("input", { class: "swt-formulafield-text", attrs: { type: "text", "aria-label": label, "data-focus": focus, ...(options.placeholder ? { placeholder: options.placeholder } : {}), spellcheck: "false", autocomplete: "off" } });
  input.value = value;
  const list = e("div", { class: "swt-formulafield-choices", attrs: { role: "listbox" } });
  const help = e("div", "swt-formulafield-help");
  const problem = e("span", "swt-formulafield-problem");
  let offered: ReturnType<FormulaHelpers["complete"]>;
  let active = 0;
  // The list closed for the name it was closed at (Esc), until another is typed
  let closedAt: string | undefined;
  const caret = () => input.selectionStart ?? input.value.length;
  const put = (i: number) => {
    const choice = offered?.choices[i];
    if (!offered || !choice) return;
    input.value = input.value.slice(0, offered.from) + choice.insert + input.value.slice(offered.to);
    const at = offered.from + choice.insert.length;
    input.setSelectionRange(at, at);
    input.focus();
    update(true);
  };
  const showList = () => {
    list.replaceChildren(
      ...(offered?.choices ?? []).map((choice, i) =>
        e(
          "div",
          {
            class: `swt-formulafield-choice${i === active ? " swt-formulafield-choice-active" : ""}`,
            attrs: { role: "option", "aria-selected": String(i === active) },
            // A press keeps the field's focus; the choice is put in
            on: { mousedown: (ev: Event) => ev.preventDefault(), click: () => put(i) },
          },
          e("span", { class: "swt-formulafield-choice-name", text: choice.label }),
          e("span", { class: "swt-formulafield-choice-kind", text: choice.kind }),
        ),
      ),
    );
    list.hidden = !offered;
    if (!offered) return;
    // Over the dialog, under the field (the dialog's body scrolls and would cut a list in it)
    const box = input.getBoundingClientRect();
    list.style.left = `${box.left}px`;
    list.style.top = `${box.bottom + 2}px`;
    list.style.minWidth = `${Math.max(box.width / 2, 200)}px`;
    list.querySelector<HTMLElement>(".swt-formulafield-choice-active")?.scrollIntoView?.({ block: "nearest" });
  };
  // The list stays under the field as the dialog's body scrolls: closed (it opens again as a name is typed)
  const closeOnScroll = () => {
    if (!offered) return;
    offered = undefined;
    list.hidden = true;
  };
  input.addEventListener("focus", () => input.closest(".swt-dialog-body")?.addEventListener("scroll", closeOnScroll, { passive: true }));
  const showHelp = (at = caret()) => {
    const h = helpers.help(input.value, at);
    if (!h) {
      help.replaceChildren();
      return;
    }
    const syntax = e("code", "swt-formulafield-syntax");
    if (h.argument) {
      syntax.append(h.syntax.slice(0, h.argument.from), e("b", { text: h.syntax.slice(h.argument.from, h.argument.to) }), h.syntax.slice(h.argument.to));
    } else syntax.textContent = h.syntax;
    help.replaceChildren(syntax, ...(h.description ? [e("span", { class: "swt-formulafield-description", text: h.description })] : []));
  };
  // `typing`: the text changed (else only the caret moved: the list closes, it opens as a name is typed)
  const update = (typing: boolean) => {
    const at = caret();
    const made = typing && input.selectionStart === input.selectionEnd ? helpers.complete(input.value, at) : undefined;
    const key = made ? `${made.from}:${input.value.slice(made.from, at)}` : undefined;
    if (typing && key !== closedAt) closedAt = undefined;
    offered = made && key !== closedAt ? made : undefined;
    active = 0;
    showList();
    showHelp();
    problem.textContent = input.value.trim() === "" ? "" : (helpers.validate(input.value) ?? "");
    if (typing) changed(input.value);
  };
  input.addEventListener("input", () => update(true));
  // The caret moved (a click, an arrow, Home, End): the list closes, the help follows the caret; a key that typed
  // was the input's (its keyup leaves the list as typing made it)
  const MOVES = new Set(["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"]);
  input.addEventListener("keyup", (ev) => (MOVES.has(ev.key) ? update(false) : showHelp()));
  // (Not on focus: a press focuses the field before it puts the caret where it pressed, so the help would show for
  // the formula's start first and then for where the press was, the dialog jumping between them)
  input.addEventListener("click", () => update(false));
  input.addEventListener("blur", () => {
    offered = undefined;
    showList();
  });
  input.addEventListener("keydown", (ev) => {
    if (!offered) return;
    const count = offered.choices.length;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      active = (active + (ev.key === "ArrowDown" ? 1 : count - 1)) % count;
      showList();
    } else if (ev.key === "Enter" || ev.key === "Tab") put(active);
    else if (ev.key === "Escape") {
      // The list closes; the dialog stays
      closedAt = `${offered.from}:${input.value.slice(offered.from, caret())}`;
      offered = undefined;
      showList();
    } else return;
    ev.preventDefault();
    ev.stopPropagation();
  });
  list.hidden = true;
  problem.textContent = value.trim() === "" ? "" : (helpers.validate(value) ?? "");
  // The help from the start, as for the caret at the formula's end: a press into the field changes it, not the dialog's height from nothing
  showHelp(value.length);
  // The list under the field itself, not under the help after it
  return e("span", "swt-formulafield", e("span", "swt-formulafield-input", input, list), problem, help);
}
