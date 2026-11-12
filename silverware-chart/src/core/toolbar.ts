// The toolbar of the chart hovered and its ⋯ menu, as Silverware Table's
// look them (floating elements in the page's body, its colors): the bar above
// the chart's top right corner (where SilverBullet's own controls of a block,
// left out by the style page's CSS, would be), the menu under the ⋯ button, a submenu in its place with a back arrow. What the
// menu holds is given as data (MenuView) by the core, which knows what each
// item does; this file only shows and runs them.

import { el } from "../../../shared/elements.ts";
import { overWindowOf } from "../../../shared/overwindow.ts";
import { focusMenu, type MenuEntry, type MenuLook, onMenuClose, renderMenu } from "../../../shared/menu.ts";
import { IterableWeakSet } from "./weakset.ts";

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

/** What a menu shows: a title and items (or items read as it opens) */
export type MenuView = {
  readonly title: string;
  readonly items?: readonly MenuItem[];
  // Its items read as it opens (the page's tables), in place of `items`
  readonly load?: () => Promise<readonly MenuItem[]>;
  // What it says where it has no items
  readonly empty?: string;
  // Items laid out as tiles, icons over labels (a gallery)
  readonly tiles?: boolean;
};

const MORE_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';
const BACK_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
// Its menus in the chart's look (shared/menu.ts, classes swc-…)
const LOOK: MenuLook = { base: "swc", closeIcon: CLOSE_ICON };

// The bar's gap above the chart, and how long it stays once the pointer has left the chart and the bar
const GAP = 4;
const LEAVE_MS = 300;

export class ChartToolbar {
  private readonly bar: HTMLElement;
  private readonly menu: HTMLElement;
  private box: HTMLElement | undefined;
  private views: MenuView[] = [];
  // The items of the views read as they opened (held while they are open)
  private readonly loaded = new WeakMap<MenuView, readonly MenuItem[]>();
  private hiding: ReturnType<typeof setTimeout> | undefined;
  // The charts' boxes the pointer is followed over (held weakly: a box gone is let go with its chart)
  private readonly watched = new IterableWeakSet<HTMLElement>();
  private following = false;
  // Placed again every frame while shown: the chart moves without a scroll as the text above it is edited
  private tracking = false;
  // Its listeners on the page, ended by `stop`
  private readonly listening = new AbortController();

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
      element.addEventListener("mouseenter", () => {
        clearTimeout(this.hiding);
        this.hiding = undefined;
      });
      element.addEventListener("mouseleave", () => this.leaveSoon());
      // A press on them is not a press in the page (SilverBullet would move its cursor)
      element.addEventListener("mousedown", (e) => e.stopPropagation());
    }
    const { signal } = this.listening;
    doc.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.menu.classList.contains("swc-visible")) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    }, { capture: true, signal });
    // (The page scrolled: the bar and the menu go with the chart)
    doc.addEventListener("scroll", () => this.place(), { capture: true, signal });
    doc.addEventListener("pointerdown", (e) => {
      const target = e.target as Node;
      if (this.menu.classList.contains("swc-visible") && !this.menu.contains(target) && !this.bar.contains(target)) this.close();
    }, { capture: true, signal });
  }

  /** Gone from the page: its listeners ended, its elements out (the controller started anew) */
  stop(): void {
    this.listening.abort();
    clearTimeout(this.hiding);
    // (Not shown: its frames' placing ends)
    this.bar.classList.remove("swc-visible");
    this.bar.remove();
    this.menu.remove();
  }

  /** A chart's box: its toolbar shown while the pointer is over it or the band above it, where the toolbar is */
  watch(box: HTMLElement): void {
    this.watched.add(box);
    if (this.following) return;
    this.following = true;
    let queued = false;
    let x = 0;
    let y = 0;
    // (Once a frame: the boxes are measured, so not on every move)
    this.doc.addEventListener(
      "mousemove",
      (e) => {
        x = e.clientX;
        y = e.clientY;
        if (queued) return;
        queued = true;
        this.doc.defaultView?.requestAnimationFrame(() => {
          queued = false;
          this.pointerAt(x, y);
        });
      },
      { passive: true, signal: this.listening.signal },
    );
  }

  /** The pointer moved: the chart under it (or under the band above it) shows its toolbar, else the toolbar goes */
  private pointerAt(x: number, y: number): void {
    const band = (this.bar.offsetHeight || 26) + 2 * GAP;
    // What another plugin shows over the window there (a table in full screen, a database's peek): a chart under it
    // shows no toolbar (shared/overwindow.ts)
    const covering = overWindowOf(this.doc.elementFromPoint?.(x, y) ?? null);
    let over: HTMLElement | undefined;
    for (const box of this.watched) {
      if (!box.isConnected || (covering && !covering.contains(box))) {
        // Kept while it may come back (CodeMirror puts a widget's element back), measured only while in the page
        continue;
      }
      const rect = box.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top - band && y <= rect.bottom) {
        over = box;
        break;
      }
    }
    if (over) this.show(over);
    else if (this.box && !this.hiding) this.leaveSoon();
  }

  private show(box: HTMLElement): void {
    clearTimeout(this.hiding);
    this.hiding = undefined;
    if (this.box !== box) this.close();
    this.box = box;
    if (!this.bar.isConnected) this.doc.body.append(this.bar, this.menu);
    this.bar.classList.add("swc-visible");
    this.place();
    this.track();
  }

  private leaveSoon(): void {
    clearTimeout(this.hiding);
    this.hiding = setTimeout(() => {
      this.hiding = undefined;
      // Kept while its menu is open: the pointer goes there through what lies between
      if (this.menu.classList.contains("swc-visible")) return;
      this.bar.classList.remove("swc-visible");
      this.box = undefined;
    }, LEAVE_MS);
  }

  /** Placed once a frame while shown (one measure of the chart), so it stays on it as the page above it changes */
  private track(): void {
    if (this.tracking) return;
    this.tracking = true;
    const frame = () => {
      if (!this.bar.classList.contains("swc-visible")) {
        this.tracking = false;
        return;
      }
      // Its chart drawn anew (its block written): no toolbar until the pointer moves over the new one
      if (!this.box?.isConnected) {
        this.tracking = false;
        this.hide();
        return;
      }
      this.place();
      this.doc.defaultView?.requestAnimationFrame(frame);
    };
    this.doc.defaultView?.requestAnimationFrame(frame);
  }

  /** The bar above the chart's top right corner (inside the chart where there is no room above), the menu under it, their right edges at one */
  private place(): void {
    const box = this.box;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const height = this.bar.offsetHeight || 26;
    const top = rect.top - height - GAP >= 0 ? rect.top - height - GAP : rect.top + GAP;
    const right = rect.right;
    const width = this.doc.documentElement.clientWidth;
    this.bar.style.left = "auto";
    this.bar.style.right = `${Math.max(0, width - right)}px`;
    this.bar.style.top = `${top}px`;
    const bar = this.bar.getBoundingClientRect();
    this.menu.style.left = "auto";
    this.menu.style.right = `${Math.max(0, width - bar.right)}px`;
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
    const run = (item: MenuItem) => () => {
      if (item.open) {
        this.views.push(item.open());
        this.render();
        return;
      }
      this.close();
      void item.run?.();
    };
    const items = view.items ?? [];
    // Read as the view opens (the page's tables): a line meanwhile, the items once read
    const loading = view.load && !this.loaded.has(view);
    if (loading) {
      void view.load!().then((read) => {
        this.loaded.set(view, read);
        if (this.views.at(-1) === view) this.render();
      });
    }
    const shown = this.loaded.get(view) ?? items;
    const line = (text: string): MenuEntry => ({ kind: "element", element: el(doc, "div", { class: "swc-menu-line", text }) });
    const entries: MenuEntry[] = loading
      ? [line("Reading the page…")]
      : !shown.length && view.empty
        ? [line(view.empty)]
        : view.tiles
          ? [{ kind: "tiles", options: shown.map((item) => ({ label: item.label, icon: item.icon ?? "", ...(item.checked !== undefined ? { checked: item.checked } : {}), ...(item.disabled ? { disabled: item.disabled } : {}), run: run(item) })) }]
          : shown.map((item) => ({
              kind: "item",
              label: item.label,
              ...(item.icon ? { icon: item.icon } : {}),
              ...(item.checked !== undefined ? { checked: item.checked } : {}),
              ...(item.disabled ? { disabled: item.disabled } : {}),
              ...(item.open ? { submenu: true } : {}),
              run: run(item),
            }));
    const back = this.views.length > 1 ? { icon: BACK_ICON, run: () => (this.views.pop(), this.render()) } : undefined;
    const menu = renderMenu(doc, LOOK, view.title, entries, back);
    onMenuClose(menu, LOOK, () => this.close());
    this.menu.replaceChildren(menu);
    this.place();
    focusMenu(menu, LOOK);
  }
}
