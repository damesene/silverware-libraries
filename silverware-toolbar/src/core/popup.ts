// The popup of every action, under the toolbar: a search field focused as it
// opens (what is typed finds actions: core/search.ts), the actions by their
// groups, one of them current. An action offering choices (Turn into) is one
// item that opens them in the popup's place, a back arrow over them, as the
// table's column menu opens its types; searching finds the choices too, under
// its label. The keys are its own: ↑ ↓ (and Tab, Shift+Tab) go along the
// actions, PageUp / PageDown by five, Enter runs the current one (or opens its
// choices, as → does), Esc closes it (in the choices: back, as ← on an empty
// field and Backspace there do); a click runs one. Actions not offered for the
// selection show dimmed and are skipped.
import { ICONS } from "../icons.ts";
import type { Action } from "./action.ts";
import { type Box, placeByToolbar, roomAbove } from "./place.ts";
import { type Entry, entriesOf, findEntries } from "./search.ts";

export type PopupOptions = {
  // The modules' actions, in their order
  readonly actions: readonly Action[];
  // An action's state for the selection
  readonly state: (action: Action) => { readonly active: boolean; readonly enabled: boolean };
  // The toolbar's place, the popup under it (undefined: none on screen, the popup at the top of the view)
  readonly rect: Box | undefined;
  readonly viewTop: number;
  // Over the toolbar, not under it (docked at the bottom: the keyboard under it)
  readonly above?: boolean;
  // Opened at this action's choices (Turn into from a docked toolbar)
  readonly choices?: Action;
  readonly run: (action: Action) => void;
  // Icons beside the search field (the settings): run as an action is, found by the search too where they are among `actions`
  readonly tools?: readonly Action[];
  // Closed without running (Esc, a press elsewhere)
  readonly closed: () => void;
  // Presses that do not close it (on the toolbar: its … closes it, its actions run)
  readonly keeps?: (node: Node) => boolean;
};

// How many actions PageUp / PageDown go by
const PAGE = 5;

export class Popup {
  readonly element: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly tools: HTMLElement;
  private options: PopupOptions | undefined;
  // The actions found and shown, in order, and the current one's index among them
  private found: Entry[] = [];
  private current = -1;
  // The action whose choices are shown (Turn into), else the actions
  private level: Action | undefined;

  constructor(private readonly doc: Document) {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
      const e = doc.createElement(tag);
      e.className = className;
      return e;
    };
    this.element = el("div", "swb-floating swb-popup");
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-label", "Every action");
    const search = el("label", "swb-search");
    search.innerHTML = ICONS.search;
    this.input = el("input", "swb-search-field");
    this.input.type = "text";
    this.input.placeholder = "Search actions";
    this.input.setAttribute("role", "combobox");
    this.input.setAttribute("aria-label", "Search actions");
    this.input.setAttribute("aria-autocomplete", "list");
    this.input.setAttribute("aria-controls", "swb-popup-list");
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.tools = el("span", "swb-popup-tools");
    // A press there keeps the search field's focus
    this.tools.addEventListener("mousedown", (e) => e.preventDefault());
    search.append(this.input, this.tools);
    this.list = el("div", "swb-list");
    this.list.id = "swb-popup-list";
    this.list.setAttribute("role", "listbox");
    this.element.append(search, this.list);
    this.input.addEventListener("input", () => this.update());
    this.input.addEventListener("keydown", (e) => this.onKey(e));
    // A press on an action keeps the search field's focus
    this.list.addEventListener("mousedown", (e) => e.preventDefault());
  }

  get isOpen(): boolean {
    return !!this.options;
  }

  owns(node: Node): boolean {
    return this.element.contains(node);
  }

  open(options: PopupOptions): void {
    this.options = options;
    this.level = options.choices?.choices ? options.choices : undefined;
    this.input.value = "";
    this.tools.replaceChildren(
      ...(options.tools ?? []).map((action) => {
        const button = this.doc.createElement("button");
        button.type = "button";
        button.className = "swb-popup-tool";
        button.dataset.swbAction = action.id;
        button.innerHTML = action.icon;
        button.title = action.label;
        button.setAttribute("aria-label", action.label);
        button.addEventListener("click", (e) => {
          e.preventDefault();
          this.close(true);
          options.run(action);
        });
        return button;
      }),
    );
    if (!this.element.isConnected) this.doc.body.append(this.element);
    this.element.classList.add("swb-visible");
    this.update();
    this.place(options.rect, options.viewTop, options.above);
    this.doc.defaultView!.addEventListener("mousedown", this.onPress, true);
    this.input.focus({ preventScroll: true });
  }

  place(rect: Box | undefined, viewTop: number, above = false): void {
    // Over the toolbar: the list as tall as the room above it leaves
    if (above && rect) this.list.style.maxHeight = `${Math.max(120, roomAbove(rect, viewTop) - (this.element.offsetHeight - this.list.offsetHeight))}px`;
    else this.list.style.removeProperty("max-height");
    placeByToolbar(this.element, rect, viewTop, above);
  }

  /** Closed; `ran`: an action was run (its handler goes on), else the owner is told */
  close(ran = false): void {
    const options = this.options;
    if (!options) return;
    this.options = undefined;
    this.doc.defaultView!.removeEventListener("mousedown", this.onPress, true);
    this.element.classList.remove("swb-visible");
    if (!ran) options.closed();
  }

  remove(): void {
    this.close();
    this.element.remove();
  }

  private onPress = (e: MouseEvent): void => {
    if (!(e.target instanceof Node && (this.owns(e.target) || this.options?.keeps?.(e.target)))) this.close();
  };

  /**
   * The actions found by what is typed, by their groups, the first offered one
   * current: an action's choices when they are open; else, nothing typed, the
   * actions (one offering choices as one item), something typed, every action
   * and choice it finds
   */
  private update(): void {
    const options = this.options;
    if (!options) return;
    const query = this.input.value;
    const level = this.level;
    this.found = level
      ? findEntries(
          (level.choices ?? []).map((action) => ({ action, group: level.label })),
          query,
        )
      : query.trim()
        ? findEntries(entriesOf(options.actions), query)
        : byGroup(options.actions.filter((action) => action.listed !== false).map((action) => ({ action, group: action.group })));
    const doc = this.doc;
    const rows: HTMLElement[] = [];
    if (level) {
      const back = doc.createElement("button");
      back.type = "button";
      back.className = "swb-back";
      back.innerHTML = `${ICONS.back}<span></span>`;
      back.querySelector("span")!.textContent = level.label;
      back.setAttribute("aria-label", `Back from ${level.label}`);
      back.addEventListener("click", () => this.back());
      rows.push(back);
    }
    let group: string | undefined = level?.label;
    this.found.forEach((entry, i) => {
      if (entry.group !== group) {
        group = entry.group;
        const head = doc.createElement("div");
        head.className = "swb-group";
        head.setAttribute("role", "presentation");
        head.textContent = group;
        rows.push(head);
      }
      const { active, enabled } = options.state(entry.action);
      const row = doc.createElement("div");
      row.className = "swb-option";
      row.id = `swb-option-${i}`;
      row.setAttribute("role", "option");
      row.dataset.swbAction = entry.action.id;
      row.dataset.swbIndex = String(i);
      if (!enabled) row.setAttribute("aria-disabled", "true");
      // An action offering choices: an arrow, it opens them
      const end = entry.action.choices ? ICONS.chevron : active ? ICONS.check : "";
      row.innerHTML = `<span class="swb-icon">${entry.action.icon}</span><span class="swb-label"></span><span class="swb-check">${end}</span>`;
      if (entry.action.choices) row.setAttribute("aria-haspopup", "listbox");
      row.querySelector(".swb-label")!.textContent = entry.action.label;
      row.addEventListener("mousemove", () => this.setCurrent(i));
      row.addEventListener("click", () => this.runAt(i));
      rows.push(row);
    });
    if (!rows.length) {
      const none = doc.createElement("div");
      none.className = "swb-none";
      none.textContent = "No action found";
      rows.push(none);
    }
    this.list.replaceChildren(...rows);
    this.current = -1;
    this.input.removeAttribute("aria-activedescendant");
    this.setCurrent(this.next(-1, 1));
  }

  private enabled(i: number): boolean {
    const entry = this.found[i];
    return !!entry && !!this.options?.state(entry.action).enabled;
  }

  /** The next offered action from `i` going `step` (wrapping round), else -1 */
  private next(i: number, step: number): number {
    const n = this.found.length;
    for (let k = 1; k <= n; k++) {
      const j = (((i + step * k) % n) + n) % n;
      if (this.enabled(j)) return j;
    }
    return -1;
  }

  private setCurrent(i: number): void {
    if (i === this.current || (i >= 0 && !this.enabled(i))) return;
    const before = this.list.querySelector(".swb-current");
    before?.classList.remove("swb-current");
    before?.removeAttribute("aria-selected");
    this.current = i;
    const row = i >= 0 ? this.list.querySelector<HTMLElement>(`#swb-option-${i}`) : null;
    row?.classList.add("swb-current");
    row?.setAttribute("aria-selected", "true");
    row?.scrollIntoView?.({ block: "nearest" });
    if (row) this.input.setAttribute("aria-activedescendant", row.id);
    else this.input.removeAttribute("aria-activedescendant");
  }

  /** The current action run, or its choices opened */
  private runAt(i: number): void {
    const entry = this.found[i];
    const options = this.options;
    if (!entry || !options || !this.enabled(i)) return;
    if (entry.action.choices) {
      this.openChoices(entry.action);
      return;
    }
    this.close(true);
    options.run(entry.action);
  }

  /** An action's choices in the popup's place, the search field emptied for them */
  private openChoices(action: Action): void {
    this.level = action;
    this.input.value = "";
    this.update();
  }

  /** Back from the choices to the actions, the one they are of current */
  private back(): void {
    const level = this.level;
    if (!level) return;
    this.level = undefined;
    this.input.value = "";
    this.update();
    this.setCurrent(this.found.findIndex((entry) => entry.action === level));
    this.input.focus({ preventScroll: true });
  }

  private onKey(e: KeyboardEvent): void {
    // Its keys are its own: not the editor's, not SilverBullet's
    e.stopPropagation();
    // Typing through an input method (Enter ends the composition): the field's
    if (e.isComposing) return;
    const by = (step: number) => {
      e.preventDefault();
      this.setCurrent(this.next(this.current, step));
    };
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) by(1);
    else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) by(-1);
    else if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault();
      let i = this.current;
      for (let k = 0; k < PAGE; k++) {
        const j = this.next(i, e.key === "PageDown" ? 1 : -1);
        // Not round past the end
        if (j < 0 || (e.key === "PageDown" ? j < i : j > i)) break;
        i = j;
      }
      this.setCurrent(i);
    } else if (e.key === "Enter") {
      e.preventDefault();
      this.runAt(this.current);
    } else if (e.key === "ArrowRight" && this.found[this.current]?.action.choices && this.input.selectionStart === this.input.value.length) {
      e.preventDefault();
      this.runAt(this.current);
    } else if (this.level && ((e.key === "ArrowLeft" || e.key === "Backspace") && this.input.value === "")) {
      e.preventDefault();
      this.back();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (this.level) this.back();
      else this.close();
    }
  }
}

/** Entries by their groups, each group where it first comes (the modules' order kept within it) */
function byGroup(entries: readonly Entry[]): Entry[] {
  const groups = [...new Set(entries.map((e) => e.group))];
  return groups.flatMap((group) => entries.filter((e) => e.group === group));
}
