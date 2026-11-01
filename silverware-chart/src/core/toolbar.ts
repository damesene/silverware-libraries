// The toolbar of the chart hovered and its ⋯ menu, as Silverware Table's
// look them (floating elements in the page's body, its colors): the bar above
// the chart's top left corner (SilverBullet's own widget menu is at its top
// right), the menu under the ⋯ button, a submenu in its place with a back
// arrow. What the menu holds is given as data (MenuView) by the core, which
// knows what each item does; this file only shows and runs them.

/** An item of a menu: an action, or a submenu opened in the menu's place */
export type MenuItem = {
  readonly label: string;
  // A line icon (an SVG)
  readonly icon?: string;
  // Marked as the one on (the chart's type)
  readonly checked?: boolean;
  // Shown, not offered: why, as its tooltip
  readonly disabled?: string;
  readonly run?: () => unknown;
  readonly open?: () => MenuView;
};

/** What a menu shows: a title, items, or an element of its own (a form) */
export type MenuView = {
  readonly title: string;
  readonly items?: readonly MenuItem[];
  // Items laid out as tiles, icons over labels (a gallery)
  readonly tiles?: boolean;
  readonly element?: (menu: { close(): void; open(view: MenuView): void }) => HTMLElement;
};

const MORE_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';
const BACK_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

// The bar's gap above the chart, and how long it stays once the pointer has left the chart and the bar
const GAP = 4;
const LEAVE_MS = 300;

export class ChartToolbar {
  private readonly bar: HTMLElement;
  private readonly menu: HTMLElement;
  private box: HTMLElement | undefined;
  private views: MenuView[] = [];
  private hiding: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly doc: Document,
    // The menu of the chart in a box (made as it opens: the chart as it is then)
    private readonly menuOf: (box: HTMLElement) => MenuView | undefined,
  ) {
    this.bar = doc.createElement("div");
    this.bar.className = "swc-floating swc-bar";
    const more = doc.createElement("button");
    more.type = "button";
    more.className = "swc-bar-more";
    more.title = "Chart menu";
    more.setAttribute("aria-label", "Chart menu");
    more.innerHTML = MORE_ICON;
    more.addEventListener("click", (e) => {
      e.preventDefault();
      if (this.menu.classList.contains("swc-visible")) this.close();
      else this.open();
    });
    this.bar.append(more);
    this.menu = doc.createElement("div");
    this.menu.className = "swc-floating swc-menu";
    this.menu.setAttribute("role", "menu");
    for (const element of [this.bar, this.menu]) {
      element.addEventListener("mouseenter", () => clearTimeout(this.hiding));
      element.addEventListener("mouseleave", () => this.leaveSoon());
      // A press on them is not a press in the page (SilverBullet would move its cursor)
      element.addEventListener("mousedown", (e) => e.stopPropagation());
    }
    doc.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.menu.classList.contains("swc-visible")) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    }, true);
    // (The page scrolled: the bar and the menu go with the chart)
    doc.addEventListener("scroll", () => this.place(), true);
    doc.addEventListener("pointerdown", (e) => {
      const target = e.target as Node;
      if (this.menu.classList.contains("swc-visible") && !this.menu.contains(target) && !this.bar.contains(target)) this.close();
    }, true);
  }

  /** A chart's box: its toolbar shown while the pointer is over it */
  watch(box: HTMLElement): void {
    box.addEventListener("mouseenter", () => this.show(box));
    box.addEventListener("mouseleave", () => this.leaveSoon());
  }

  private show(box: HTMLElement): void {
    clearTimeout(this.hiding);
    if (this.box !== box) this.close();
    this.box = box;
    if (!this.bar.isConnected) this.doc.body.append(this.bar, this.menu);
    this.bar.classList.add("swc-visible");
    this.place();
  }

  private leaveSoon(): void {
    clearTimeout(this.hiding);
    this.hiding = setTimeout(() => {
      // Kept while its menu is open: the pointer goes there through what lies between
      if (this.menu.classList.contains("swc-visible")) return;
      this.bar.classList.remove("swc-visible");
      this.box = undefined;
    }, LEAVE_MS);
  }

  /** The bar above the chart's top left corner (inside it where there is no room above), the menu under the bar */
  private place(): void {
    const box = this.box;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const height = this.bar.offsetHeight || 26;
    const top = rect.top - height - GAP >= 0 ? rect.top - height - GAP : rect.top + GAP;
    this.bar.style.left = `${Math.max(0, rect.left)}px`;
    this.bar.style.top = `${top}px`;
    const bar = this.bar.getBoundingClientRect();
    this.menu.style.left = `${Math.max(0, bar.left)}px`;
    this.menu.style.top = `${bar.bottom + GAP}px`;
  }

  private open(): void {
    const view = this.box && this.menuOf(this.box);
    if (!view) return;
    this.views = [view];
    this.render();
    this.menu.classList.add("swc-visible");
    this.place();
  }

  /** The menu closed (its chart's bar stays while the pointer is there) */
  close(): void {
    this.menu.classList.remove("swc-visible");
    this.menu.replaceChildren();
    this.views = [];
  }

  /** Every chart's toolbar gone (the page changed) */
  hide(): void {
    this.close();
    this.bar.classList.remove("swc-visible");
    this.box = undefined;
  }

  private render(): void {
    const view = this.views.at(-1);
    if (!view) return;
    const doc = this.doc;
    const title = doc.createElement("div");
    title.className = "swc-menu-title";
    const back = doc.createElement("button");
    back.type = "button";
    back.className = "swc-menu-back";
    back.title = "Back";
    back.setAttribute("aria-label", "Back");
    back.innerHTML = BACK_ICON;
    back.hidden = this.views.length < 2;
    back.addEventListener("click", () => {
      this.views.pop();
      this.render();
    });
    const text = doc.createElement("span");
    text.className = "swc-menu-title-text";
    text.textContent = view.title;
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "swc-menu-close";
    close.title = "Close";
    close.setAttribute("aria-label", "Close");
    close.innerHTML = CLOSE_ICON;
    close.addEventListener("click", () => this.close());
    title.append(back, text, close);
    const body = doc.createElement("div");
    body.className = view.tiles ? "swc-menu-tiles" : "swc-menu-items";
    for (const item of view.items ?? []) body.append(this.itemElement(item, view.tiles ?? false));
    if (view.element)
      body.append(
        view.element({
          close: () => this.close(),
          open: (next) => {
            this.views.push(next);
            this.render();
          },
        }),
      );
    this.menu.replaceChildren(title, body);
    this.place();
  }

  private itemElement(item: MenuItem, tile: boolean): HTMLElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.className = tile ? "swc-menu-tile" : "swc-menu-item";
    button.setAttribute("role", "menuitem");
    if (item.checked) button.setAttribute("aria-checked", "true");
    if (item.disabled) {
      button.setAttribute("aria-disabled", "true");
      button.title = item.disabled;
    }
    if (item.icon) {
      const icon = button.appendChild(this.doc.createElement("span"));
      icon.className = "swc-icon";
      icon.innerHTML = item.icon;
    }
    const label = button.appendChild(this.doc.createElement("span"));
    label.className = "swc-label";
    label.textContent = item.label;
    if (item.open) button.classList.add("swc-menu-sub");
    button.addEventListener("click", (e) => {
      e.preventDefault();
      if (item.disabled) return;
      if (item.open) {
        this.views.push(item.open());
        this.render();
        return;
      }
      this.close();
      void item.run?.();
    });
    return button;
  }
}
