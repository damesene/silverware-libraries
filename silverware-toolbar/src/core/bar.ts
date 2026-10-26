// The toolbar by the selection: the favourites in rows, one under another,
// each action its icon, or its icon and label; one that offers choices
// (Turn into) shows the choice on and a chevron, and opens their list under
// it; separators between; … for the popup of every action at the end of the
// last row. Pressing it keeps the editor's selection and focus (its mousedown
// is prevented), so an action works on what is selected. Docked (a phone: the
// system's menu of a selection is where it would be by it), it is one row
// across the bottom of the window, over the on-screen keyboard: the rows one
// after another, a separator between them, scrolled sideways, … at its end
// always in view; a list of choices opens over it.
import { ICONS } from "../icons.ts";
import type { Action } from "./action.ts";
import { type Box, placeBy } from "./place.ts";

/** An item as the toolbar shows it now: an action (with its label: `labeled`), or a separator */
export type Shown =
  | { readonly action: Action; readonly active: boolean; readonly enabled: boolean; readonly labeled: boolean }
  | { readonly separator: true };

export type BarHandlers = {
  readonly run: (action: Action) => void;
  readonly more: () => void;
  // A choice's state now (for the list a button opens)
  readonly state: (action: Action) => { readonly active: boolean; readonly enabled: boolean };
};

export class Bar {
  readonly element: HTMLElement;
  // The list of a button's choices, open under it
  private menu: { readonly element: HTMLElement; readonly button: HTMLButtonElement; readonly action: string } | undefined;
  private at: { rect: Box; viewTop: number } | undefined;
  // Docked at the bottom: the line it stands on (the keyboard's top, or SilverBullet's bar's)
  private dockedAt: number | undefined;

  constructor(
    private readonly doc: Document,
    private readonly handlers: BarHandlers,
  ) {
    this.element = doc.createElement("div");
    this.element.className = "swb-floating swb-bar";
    this.element.setAttribute("role", "toolbar");
    this.element.setAttribute("aria-label", "Format the selection");
    // A press here keeps the editor's selection and focus
    this.element.addEventListener("mousedown", (e) => e.preventDefault());
  }

  get shown(): boolean {
    return this.element.classList.contains("swb-visible");
  }

  owns(node: Node): boolean {
    return this.element.contains(node) || !!this.menu?.element.contains(node);
  }

  get docked(): boolean {
    return this.dockedAt !== undefined;
  }

  /** Its rows of items, … ending the last one */
  show(rows: readonly (readonly Shown[])[], rect: Box, viewTop: number): void {
    this.closeMenu();
    this.dockedAt = undefined;
    this.element.classList.remove("swb-docked");
    const doc = this.doc;
    const more = this.more();
    const all = rows.length ? rows : [[]];
    const elements = all.map((items, i) => {
      const row = doc.createElement("div");
      row.className = "swb-row";
      row.append(...items.map((item) => ("separator" in item ? this.divider() : this.item(item))));
      if (i === all.length - 1) row.append(...(items.length ? [this.divider()] : []), more);
      return row;
    });
    this.element.replaceChildren(...elements);
    if (!this.element.isConnected) doc.body.append(this.element);
    this.element.classList.add("swb-visible");
    this.place(rect, viewTop);
  }

  /** Docked: one row across the bottom of the window standing on `bottom`, the rows one after another, … at its end */
  dock(rows: readonly (readonly Shown[])[], bottom: number): void {
    this.closeMenu();
    const items = this.doc.createElement("div");
    items.className = "swb-row swb-dock-items";
    rows.forEach((row, i) => {
      if (i > 0 && row.length) items.append(this.divider());
      items.append(...row.map((item) => ("separator" in item ? this.divider() : this.item(item))));
    });
    this.element.replaceChildren(items, this.more());
    this.element.classList.add("swb-docked");
    if (!this.element.isConnected) this.doc.body.append(this.element);
    this.element.classList.add("swb-visible");
    this.placeDocked(bottom);
  }

  /** Docked, placed again on the line it stands on (the keyboard came or went) */
  placeDocked(bottom: number): void {
    this.dockedAt = bottom;
    this.element.style.left = "0px";
    this.element.style.top = `${Math.round(bottom - this.element.offsetHeight)}px`;
    if (this.menu) this.placeMenu();
  }

  private more(): HTMLButtonElement {
    const more = this.button();
    more.innerHTML = ICONS.more;
    this.name(more, "Every action (search)");
    more.classList.add("swb-more");
    more.addEventListener("click", () => this.handlers.more());
    return more;
  }

  private divider(): HTMLElement {
    const divider = this.doc.createElement("span");
    divider.className = "swb-divider";
    return divider;
  }

  /**
   * An action's button: its icon, its label too when `labeled`; one offering
   * choices shows the choice on for the selection (none: `mixed`, else its own
   * icon and label) and a chevron, and opens their list
   */
  private item({ action, active, enabled, labeled }: Extract<Shown, { action: Action }>): HTMLButtonElement {
    const button = this.button();
    button.dataset.swbAction = action.id;
    button.disabled = !enabled;
    const on = action.choices && enabled ? action.choices.find((choice) => this.handlers.state(choice).active) : undefined;
    const label = action.choices ? (on?.label ?? (enabled ? (action.mixed ?? action.label) : action.label)) : action.label;
    button.innerHTML = (on?.icon ?? action.icon) + (labeled ? '<span class="swb-label"></span>' : "") + (action.choices ? ICONS.chevronDown : "");
    if (labeled) {
      button.classList.add("swb-labeled");
      button.querySelector(".swb-label")!.textContent = label;
    }
    if (action.choices) {
      button.classList.add("swb-choices");
      this.name(button, label === action.label ? `${action.label}…` : `${action.label}: ${label}`);
      button.setAttribute("aria-haspopup", "menu");
      button.addEventListener("click", () => this.toggleMenu(button, action));
    } else {
      this.name(button, action.label);
      button.setAttribute("aria-pressed", String(active));
      button.addEventListener("click", () => this.handlers.run(action));
    }
    return button;
  }

  private button(): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = "swb-button";
    return button;
  }

  private name(button: HTMLButtonElement, label: string): void {
    button.title = label;
    button.setAttribute("aria-label", label);
  }

  /** Where it is on screen (the popup goes under it) */
  rect(): Box {
    return this.element.getBoundingClientRect();
  }

  /** Placed again by the selection (the page scrolled) */
  place(rect: Box, viewTop: number): void {
    if (this.docked) return;
    this.at = { rect, viewTop };
    const win = this.doc.defaultView!;
    const size = { width: this.element.offsetWidth, height: this.element.offsetHeight };
    const { left, top } = placeBy(rect, size, { width: win.innerWidth, height: win.innerHeight, top: viewTop });
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    if (this.menu) this.placeMenu();
  }

  hide(): void {
    this.closeMenu();
    this.element.classList.remove("swb-visible");
    this.at = undefined;
    this.dockedAt = undefined;
  }

  remove(): void {
    this.hide();
    this.element.remove();
  }

  /** The list of an action's choices under its button (Turn into), each with its state now */
  private toggleMenu(button: HTMLButtonElement, action: Action): void {
    const open = this.menu?.action === action.id;
    this.closeMenu();
    if (open || !action.choices) return;
    const menu = this.doc.createElement("div");
    menu.className = "swb-floating swb-menu swb-visible";
    menu.setAttribute("role", "menu");
    menu.addEventListener("mousedown", (e) => e.preventDefault());
    for (const choice of action.choices) {
      const { active, enabled } = this.handlers.state(choice);
      const item = this.doc.createElement("button");
      item.type = "button";
      item.className = "swb-menu-item";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", String(active));
      item.dataset.swbAction = choice.id;
      item.disabled = !enabled;
      item.innerHTML = `<span class="swb-icon">${choice.icon}</span><span class="swb-label"></span><span class="swb-check">${active ? ICONS.check : ""}</span>`;
      item.querySelector(".swb-label")!.textContent = choice.label;
      item.addEventListener("click", () => {
        this.closeMenu();
        this.handlers.run(choice);
      });
      menu.append(item);
    }
    this.menu = { element: menu, button, action: action.id };
    this.doc.body.append(menu);
    button.setAttribute("aria-expanded", "true");
    this.placeMenu();
  }

  private placeMenu(): void {
    if (!this.menu || (!this.at && !this.docked)) return;
    const { element: menu, button } = this.menu;
    const rect = button.getBoundingClientRect();
    const win = this.doc.defaultView!;
    const left = Math.max(8, Math.min(rect.left, win.innerWidth - menu.offsetWidth - 8));
    // Under the button, or over it where the window ends (docked: always over it, the keyboard under it)
    const below = !this.docked && rect.bottom + 4 + menu.offsetHeight <= win.innerHeight - 8;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(below ? rect.bottom + 4 : rect.top - 4 - menu.offsetHeight)}px`;
  }

  closeMenu(): void {
    if (!this.menu) return;
    this.menu.button.removeAttribute("aria-expanded");
    this.menu.element.remove();
    this.menu = undefined;
  }
}
