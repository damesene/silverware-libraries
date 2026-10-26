// The toolbar by the selection: the favourite actions as icons (one that
// offers choices opens their list under it: Turn into), and … for the popup
// of every action. Pressing it keeps the editor's selection and focus (its
// mousedown is prevented), so an action works on what is selected.
import { ICONS } from "../icons.ts";
import type { Action } from "./action.ts";
import { type Box, placeBy } from "./place.ts";

/** An action as the toolbar shows it now */
export type Shown = { readonly action: Action; readonly active: boolean; readonly enabled: boolean };

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

  show(items: readonly Shown[], rect: Box, viewTop: number): void {
    this.closeMenu();
    const doc = this.doc;
    const buttons = items.map(({ action, active, enabled }) => {
      const button = this.button(action.icon, action.choices ? `${action.label}…` : action.label);
      button.dataset.swbAction = action.id;
      button.disabled = !enabled;
      if (action.choices) {
        this.showChoice(button, action, enabled);
        button.setAttribute("aria-haspopup", "menu");
        button.addEventListener("click", () => this.toggleMenu(button, action));
      } else {
        button.setAttribute("aria-pressed", String(active));
        button.addEventListener("click", () => this.handlers.run(action));
      }
      return button;
    });
    const divider = doc.createElement("span");
    divider.className = "swb-divider";
    const more = this.button(ICONS.more, "Every action (search)");
    more.classList.add("swb-more");
    more.addEventListener("click", () => this.handlers.more());
    this.element.replaceChildren(...buttons, ...(buttons.length ? [divider] : []), more);
    if (!this.element.isConnected) doc.body.append(this.element);
    this.element.classList.add("swb-visible");
    this.place(rect, viewTop);
  }

  /** Where it is on screen (the popup goes under it) */
  rect(): Box {
    return this.element.getBoundingClientRect();
  }

  /** Placed again by the selection (the page scrolled) */
  place(rect: Box, viewTop: number): void {
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
  }

  remove(): void {
    this.hide();
    this.element.remove();
  }

  /** A list's button: the choice on for the selection, its icon and label (none: `mixed`, else the list's label), a chevron */
  private showChoice(button: HTMLButtonElement, action: Action, enabled: boolean): void {
    const on = enabled ? action.choices!.find((choice) => this.handlers.state(choice).active) : undefined;
    button.classList.add("swb-choice");
    button.innerHTML = `${on?.icon ?? action.icon}<span class="swb-choice-label"></span>${ICONS.chevronDown}`;
    button.querySelector(".swb-choice-label")!.textContent = on?.label ?? (enabled ? (action.mixed ?? action.label) : action.label);
  }

  private button(icon: string, label: string): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = "swb-button";
    button.innerHTML = icon;
    button.title = label;
    button.setAttribute("aria-label", label);
    return button;
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
    if (!this.menu || !this.at) return;
    const { element: menu, button } = this.menu;
    const rect = button.getBoundingClientRect();
    const win = this.doc.defaultView!;
    const left = Math.max(8, Math.min(rect.left, win.innerWidth - menu.offsetWidth - 8));
    // Under the button, or over it where the window ends
    const below = rect.bottom + 4 + menu.offsetHeight <= win.innerHeight - 8;
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
