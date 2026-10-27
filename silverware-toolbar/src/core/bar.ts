// The toolbar by the selection: the favourites in rows, one under another,
// each action its icon, or its icon and label; one that offers choices
// (Turn into) shows the choice on and a chevron, and opens their list under
// it; separators between. … (the popup of every action) is an item as any
// other; favourites without it get it pinned at the end of the last row. Pressing it keeps the editor's selection and focus (its mousedown
// is prevented), so an action works on what is selected. Docked (a phone: the
// system's menu of a selection is where it would be by it), it is one row
// across the bottom of the window, over the on-screen keyboard: the rows one
// after another, a separator between them, scrolled sideways, … at its end
// always in view; items pinned left or right stay at its ends, out of what
// scrolls; a list of choices opens over it. A label of a fixed width keeps
// it, cut with an ellipsis where longer, so what follows keeps its place.
import { ICONS } from "../icons.ts";
import type { Action } from "./action.ts";
import type { Pin } from "./favorites.ts";
import type { ItemHost, ShownItem } from "./items.ts";
import { type Box, placeBy } from "./place.ts";

/** Where the toolbar docks: at the bottom (standing on `line`) or the top (hanging from it), across `left` and `width` (SilverBullet's editor's, else the window's) */
export type Dock = { readonly edge: "top" | "bottom"; readonly line: number; readonly left: number; readonly width: number };

/** An item as the toolbar shows it now: an action (with its label: `labeled`), a separator, or an item of a kind a module gives */
export type Shown =
  | {
      readonly action: Action;
      readonly active: boolean;
      readonly enabled: boolean;
      readonly labeled: boolean;
      readonly width?: number;
      readonly pin?: Pin;
      // The favourite's own icon (a character, an emoji) and label, in place of the action's
      readonly ownIcon?: string;
      readonly ownLabel?: string;
    }
  | { readonly separator: true }
  | { readonly item: ShownItem };

export type BarHandlers = {
  readonly run: (action: Action) => void;
  // A choice's state now (for the list a button opens)
  readonly state: (action: Action) => { readonly active: boolean; readonly enabled: boolean };
  // Docked (a phone): an action's choices in the popup instead of a list under its button; again: the popup closed
  readonly choices: (action: Action) => void;
};

export class Bar {
  readonly element: HTMLElement;
  // The list of a button's choices, open under it
  private menu: { readonly element: HTMLElement; readonly button: HTMLButtonElement; readonly action: string } | undefined;
  private at: { rect: Box; viewTop: number } | undefined;
  // Docked: where (at the bottom, the line it stands on: the keyboard's top, or SilverBullet's bar's)
  private dockPlace: Dock | undefined;
  // Docked: its ends shaded where it scrolls further
  private shadeScroll: (() => void) | undefined;
  // Docked: room kept for it at the editor's edge (`keepRoom`)
  private room = false;

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
    return this.dockPlace !== undefined;
  }

  /** Docked: where now */
  get dockedAt(): Dock | undefined {
    return this.dockPlace;
  }

  /** Docked at the top: menus and the popup open under it, not over it */
  get dockedTop(): boolean {
    return this.dockPlace?.edge === "top";
  }

  /** Its rows of items; `more`: … pinned at the end of the last one (favourites without it) */
  show(rows: readonly (readonly Shown[])[], rect: Box, viewTop: number, more?: Extract<Shown, { action: Action }>): void {
    this.closeMenu();
    this.keepRoom(false);
    this.dockPlace = undefined;
    this.element.classList.remove("swb-docked");
    const doc = this.doc;
    const all = rows.length ? rows : [[]];
    const elements = all.map((items, i) => {
      const row = doc.createElement("div");
      row.className = "swb-row";
      row.append(...items.flatMap((item) => this.elementOf(item, false)));
      if (i === all.length - 1 && more) row.append(...(items.length ? [this.divider()] : []), this.pinned(more));
      return row;
    });
    this.element.replaceChildren(...elements);
    if (!this.element.isConnected) doc.body.append(this.element);
    this.element.classList.add("swb-visible");
    this.place(rect, viewTop);
  }

  /**
   * Docked: one row across SilverBullet's editor (else the window) at its
   * bottom or its top, the rows one after another; the items pinned left and
   * right at its ends, out of what scrolls; `more`: … pinned at its end;
   * `room`: room kept for it at the editor's edge, so it covers no text
   */
  dock(rows: readonly (readonly Shown[])[], at: Dock, more: Extract<Shown, { action: Action }> | undefined, room: boolean): void {
    this.closeMenu();
    const pinned = (side: Pin) => rows.flatMap((row) => row.filter((item) => pinOf(item) === side));
    const left = pinned("left");
    const right = pinned("right");
    // The rows without them, a separator then at a row's end or twice left out
    const rest = rows
      .map((row) => {
        const kept = row.filter((item) => !pinOf(item));
        return kept.filter((item, i) => !("separator" in item) || (i > 0 && i < kept.length - 1 && !("separator" in kept[i - 1]!)));
      })
      .filter((row) => row.some((item) => !("separator" in item)));
    const items = this.doc.createElement("div");
    items.className = "swb-row swb-dock-items";
    rest.forEach((row, i) => {
      if (i > 0 && row.length) items.append(this.divider());
      items.append(...row.flatMap((item) => this.elementOf(item, true)));
    });
    // A shade at each end it scrolls further to (none at its ends)
    const scroll = this.doc.createElement("div");
    scroll.className = "swb-dock-scroll";
    const shade = (side: string) => {
      const element = this.doc.createElement("span");
      element.className = `swb-dock-shade swb-dock-shade-${side}`;
      element.setAttribute("aria-hidden", "true");
      return element;
    };
    scroll.append(items, shade("left"), shade("right"));
    this.shadeScroll = () => {
      const more = items.scrollWidth - items.clientWidth - items.scrollLeft;
      scroll.classList.toggle("swb-more-left", items.scrollLeft > 1);
      scroll.classList.toggle("swb-more-right", more > 1);
    };
    items.addEventListener("scroll", this.shadeScroll, { passive: true });
    const end = (side: Pin, elements: readonly HTMLElement[]) => {
      const group = this.doc.createElement("div");
      group.className = `swb-row swb-dock-pinned swb-dock-pinned-${side}`;
      group.append(...elements);
      return group;
    };
    const ofItems = (shown: readonly Shown[]) => shown.flatMap((item) => this.elementOf(item, true));
    this.element.replaceChildren(
      ...(left.length ? [end("left", ofItems(left))] : []),
      scroll,
      ...(right.length || more ? [end("right", [...ofItems(right), ...(more ? [this.pinned(more)] : [])])] : []),
    );
    this.element.classList.add("swb-docked");
    if (!this.element.isConnected) this.doc.body.append(this.element);
    this.element.classList.add("swb-visible");
    this.placeDocked(at);
    this.keepRoom(room);
  }

  /**
   * Room kept for it docked, or none: its height as `--swb-docked-top` or
   * `--swb-docked-bottom` on html, by which the library page's CSS pads
   * SilverBullet's editor, so it covers no text and the editor keeps its
   * cursor clear of it; off, it lies over the editor
   */
  private keepRoom(on: boolean): void {
    this.room = on;
    const style = this.doc.documentElement.style;
    for (const edge of ["top", "bottom"] as const) {
      if (on && this.dockPlace?.edge === edge) style.setProperty(`--swb-docked-${edge}`, `${this.element.offsetHeight}px`);
      else style.removeProperty(`--swb-docked-${edge}`);
    }
  }

  /** Docked, placed again (the keyboard came or went, the editor's box changed) */
  placeDocked(at: Dock): void {
    this.dockPlace = at;
    this.element.classList.toggle("swb-docked-top", at.edge === "top");
    this.element.style.left = `${at.left}px`;
    this.element.style.width = `${at.width}px`;
    if (at.edge === "top") {
      this.element.style.bottom = "auto";
      this.element.style.top = `${at.line}px`;
    } else {
      // Held by its bottom edge: placed by its top, its height and the line rounded apart left a line of the page showing under it
      this.element.style.top = "auto";
      this.element.style.bottom = `${Math.max(0, this.doc.defaultView!.innerHeight - at.line)}px`;
    }
    // (Its edge may have changed: the room with it)
    if (this.room) this.keepRoom(true);
    // (The window resized: what it scrolls to may be more or less)
    this.shadeScroll?.();
    if (this.menu) this.placeMenu();
  }

  /** … pinned at the end (favourites without it): an action's button, held there */
  private pinned(more: Extract<Shown, { action: Action }>): HTMLButtonElement {
    const button = this.item(more);
    button.classList.add("swb-more");
    return button;
  }

  /** An item's element (a kind's that fails to draw: none, logged), its label's width fixed where it has one; `docked`: for the toolbar docked at the bottom */
  private elementOf(shown: Shown, docked: boolean): HTMLElement[] {
    if ("separator" in shown) return [this.divider()];
    let element: HTMLElement;
    try {
      element = "action" in shown ? this.item(shown) : shown.item.kind.render(shown.item, this.itemHost(docked));
    } catch (e) {
      console.error(`Silverware Toolbar: a favourite of the kind ${"item" in shown ? shown.item.kind.type : ""} could not be shown:`, e);
      return [];
    }
    const width = "action" in shown ? shown.width : shown.item.width;
    if (width) {
      element.classList.add("swb-fixed");
      element.style.setProperty("--swb-width", `${width}ch`);
    }
    return [element];
  }

  /** What a kind of item draws its button with */
  private itemHost(docked: boolean): ItemHost {
    return {
      doc: this.doc,
      docked,
      state: (action) => this.handlers.state(action),
      activate: (action, anchor) => (action.choices ? this.toggleMenu(anchor, action) : this.handlers.run(action)),
      content: (action, labeled) => {
        const content = this.doc.createElement("span");
        content.className = "swb-content";
        const { icon, label } = this.look(action, this.handlers.state(action).enabled);
        content.innerHTML = icon + (labeled ? '<span class="swb-label"></span>' : "");
        if (labeled) content.querySelector(".swb-label")!.textContent = label;
        return content;
      },
      button: () => this.button(),
    };
  }

  /** An action's icon and label as shown: one offering choices the choice on for the selection (none: `mixed`, else its own) */
  private look(action: Action, enabled: boolean): { icon: string; label: string } {
    const on = action.choices && enabled ? action.choices.find((choice) => this.handlers.state(choice).active) : undefined;
    const label = action.choices ? (on?.label ?? (enabled ? (action.mixed ?? action.label) : action.label)) : action.label;
    return { icon: on?.icon ?? action.icon, label };
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
  private item({ action, active, enabled, labeled, ownIcon, ownLabel }: Extract<Shown, { action: Action }>): HTMLButtonElement {
    const button = this.button();
    button.dataset.swbAction = action.id;
    button.disabled = !enabled;
    const look = this.look(action, enabled);
    // Its own label in place of the action's (one offering choices: the choice on still shown, its own label its name)
    const label = action.choices ? look.label : (ownLabel ?? look.label);
    button.innerHTML = (ownIcon ? '<span class="swb-own-icon"></span>' : look.icon) + (labeled ? '<span class="swb-label"></span>' : "") + (action.choices ? ICONS.chevronDown : "");
    if (ownIcon) button.querySelector(".swb-own-icon")!.textContent = ownIcon;
    if (labeled) {
      button.classList.add("swb-labeled");
      button.querySelector(".swb-label")!.textContent = label;
    }
    if (action.choices) {
      button.classList.add("swb-choices");
      this.name(button, ownLabel ?? (label === action.label ? `${action.label}…` : `${action.label}: ${label}`));
      button.setAttribute("aria-haspopup", "menu");
      button.addEventListener("click", () => this.toggleMenu(button, action));
    } else {
      this.name(button, label);
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
    this.element.style.removeProperty("bottom");
    this.element.style.removeProperty("width");
    this.element.classList.remove("swb-docked-top");
    const win = this.doc.defaultView!;
    const size = { width: this.element.offsetWidth, height: this.element.offsetHeight };
    // Left of the selection, ending where it starts: what is read beside it stays in view
    const { left, top } = placeBy(rect, size, { width: win.innerWidth, height: win.innerHeight, top: viewTop }, false, true);
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    if (this.menu) this.placeMenu();
  }

  hide(): void {
    this.closeMenu();
    this.keepRoom(false);
    this.element.classList.remove("swb-visible");
    this.at = undefined;
    this.dockPlace = undefined;
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
    // Docked (a phone): in the popup, whose search keeps the on-screen keyboard and hides the system's menu of the
    // selection (a list here taking the keyboard closed it; one without it is under that menu)
    if (this.docked) {
      this.handlers.choices(action);
      return;
    }
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
    // Under the button, or over it where the window ends (docked at the bottom: always over it, the keyboard under it; at the top: always under it)
    const below = this.dockedTop || (!this.docked && rect.bottom + 4 + menu.offsetHeight <= win.innerHeight - 8);
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

/** Where an item is pinned, docked (a separator: nowhere) */
function pinOf(shown: Shown): Pin | undefined {
  if ("separator" in shown) return undefined;
  return "action" in shown ? shown.pin : shown.item.pin;
}
