// A place's menu (⋯ in its bar): the shared menu (shared/menu.ts, drawn in
// Silverware Database's look, `swd-menu-…`) of entries put in by what they do
// (shared/menuslots.ts): the core's (Group by, Edit source), the modules'
// (Properties) and the view's own, each given this menu's builder as it opens
// and giving back groups, in its slots or in sections of their own. Where each
// shows is this menu's. Opened and closed as any tool's menu (`toolMenu`, the
// sort's too).
import { el } from "../../../shared/elements.ts";
import { focusMenu, keepFocus, type MenuBack, type MenuEntry, type MenuLook, type MenuNaming, namingThatCloses, onMenuClose, renderMenu, wrapRuns } from "../../../shared/menu.ts";
import { customSections, type MenuBuilder, type MenuGroup, menuBuilder, slotEntries } from "../../../shared/menuslots.ts";
import { liftOut } from "../views/float.ts";
import { ICONS } from "./icons.ts";

/**
 * The slots of a place's menu, by what their entries do:
 * `view`, how the view shows its items (Group by; a view's own options);
 * `data`, the database's schema and data (Properties);
 * `source`, the place itself, its block (Edit source);
 * `remove`, what takes the database away (Delete database…), last.
 * Shown in this order, sections of their own (`custom`) primary first, secondary before the source
 */
export const PLACE_MENU_SLOTS = ["view", "data", "source", "remove"] as const;
export type PlaceMenuSlot = (typeof PLACE_MENU_SLOTS)[number];
/** Entries in a slot of a place's menu, or in a section of their own */
export type PlaceMenuGroup = MenuGroup<PlaceMenuSlot>;
/** What a place's menu gives those adding entries to it: its slots, entries as values, submenus */
export type PlaceMenuBuilder = MenuBuilder<PlaceMenuSlot>;

const LOOK: MenuLook = { base: "swd", closeIcon: ICONS.close, renameIcon: ICONS.rename };

export type PlaceMenu = {
  /** The tool's box: its button and, while open, the menu */
  readonly box: HTMLElement;
  close(): void;
  /** Opened at a submenu, by the labels of the items leading to it (its value after a colon left out): the menu shown, undefined where one is missing */
  openAt(labels: readonly string[]): HTMLElement | undefined;
};

/** The menu's entries from the groups given, in its order, a separator between the parts */
function assembled(groups: readonly PlaceMenuGroup[]): MenuEntry[] {
  const parts = [...customSections(groups, "primary"), slotEntries(groups, "view"), slotEntries(groups, "data"), ...customSections(groups, "secondary"), slotEntries(groups, "source"), slotEntries(groups, "remove")].filter((part) => part.length > 0);
  return parts.flatMap((part, at) => (at ? [{ kind: "separator" } as const, ...part] : part));
}

/**
 * What a definition of the user's gave as its groups, those that are groups
 * (a slot of this menu or a section of its own, a list of entries, an item
 * with something to run), or why none are
 */
export function checkedGroups(made: unknown): PlaceMenuGroup[] | string {
  if (!Array.isArray(made)) return "its menu gave no list of groups (menu.slot.view([…]))";
  const kinds = new Set(["item", "separator", "segmented", "actions", "tiles", "element"]);
  for (const group of made as unknown[]) {
    const one = group as { slot?: unknown; entries?: unknown; custom?: { name?: unknown } };
    const slot = typeof one?.slot === "string" && ((PLACE_MENU_SLOTS as readonly string[]).includes(one.slot) || (one.slot === "custom" && typeof one.custom?.name === "string"));
    if (!slot || !Array.isArray(one.entries)) return "its menu gave something that is no group (menu.slot.view([…]))";
    for (const entry of one.entries as unknown[]) {
      const kind = (entry as { kind?: unknown })?.kind;
      if (typeof kind !== "string" || !kinds.has(kind)) return "its menu gave something that is no entry (menu.item({ label, run }))";
      if (kind === "item" && (typeof (entry as { label?: unknown }).label !== "string" || typeof (entry as { run?: unknown }).run !== "function")) return "an item of its menu has no label or nothing to run";
    }
  }
  return made as PlaceMenuGroup[];
}

/**
 * A tool of the place's bar opening a menu of the shared menu's (its entries
 * made as it opens: `entries`, given what shows other entries in the menu's
 * place). It lies in the tool's own box, so it moves with the bar; Esc, its ×,
 * a press or the focus elsewhere close it, as does an entry chosen, unless it
 * showed others in the menu's place (a submenu, a way back); the focus then
 * back on the tool where nothing else took it. The sort's and ⋯ alike.
 */
/** The top on screen of the box `element` scrolls in (the nearest ancestor that scrolls up and down), the window's where none */
function scrollTop(element: Element): number {
  const view = element.ownerDocument.defaultView;
  for (let one = element.parentElement; one && view; one = one.parentElement) {
    const overflow = view.getComputedStyle(one).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && one.scrollHeight > one.clientHeight) return Math.max(0, one.getBoundingClientRect().top);
  }
  return 0;
}

export function toolMenu(
  doc: Document,
  button: HTMLButtonElement,
  title: () => string,
  entries: (open: (heading: string, entries: readonly MenuEntry[]) => void) => readonly MenuEntry[],
  // What the menu is about named in its title (a pencil: the database's name), the menu closed once it is saved; not in a submenu
  naming?: () => MenuNaming | undefined,
  // Told as the user closes it (not as the place closes it, drawn anew)
  closed?: () => void,
): PlaceMenu {
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  const holder = el(doc, "div", { class: "swd-menu", attrs: { hidden: "" } });
  const box = el(doc, "span", "swd-tool-box", button, holder);
  let stop: (() => void) | undefined;
  // What the menu shows now: an entry run that leaves it so closes it
  let shown: HTMLElement | undefined;
  // Where the menu is against its tool (as the style page puts it under it), once measured: it is then held there over the
  // window (position fixed), so no box around the place clips it (SilverBullet's widget scrolls and cuts what leaves it)
  // (By the edge the style page aligns it by, the tool's left or right: a submenu of another width keeps that edge)
  let anchor: { readonly right: boolean; readonly x: number; readonly y: number } | undefined;
  // Once measured in its box, taken into the body while it shows (views/float.ts: over the other plugins' controls, out of
  // the page's stacking contexts), put back as it closes; closed where its tool leaves the page meanwhile
  let lifted: (() => void) | undefined;
  const inMenu = (node: Node | null) => !!node && (box.contains(node) || holder.contains(node));
  const view = doc.defaultView;
  const place = () => {
    if (holder.hidden || !view) return;
    const at = button.getBoundingClientRect();
    if (!anchor) {
      const was = holder.getBoundingClientRect();
      const right = Math.abs(was.right - at.right) < Math.abs(was.left - at.left);
      anchor = { right, x: right ? at.right - was.right : was.left - at.left, y: was.top - at.top };
    }
    // (Its look the place's; its font its own)
    lifted ??= liftOut(holder, button, () => close(false, false), box);
    // (Where it was scrolled kept: placed again as the page scrolls, it does not jump back to its top)
    const scrolled = holder.scrollTop;
    // Measured at the window's corner, as wide and tall as its content (where it was, near the window's edge, it was squeezed)
    holder.style.position = "fixed";
    holder.style.right = "auto";
    holder.style.bottom = "auto";
    holder.style.left = "0px";
    holder.style.top = "0px";
    const width = holder.offsetWidth;
    const left = Math.max(8, Math.min(anchor.right ? at.right - anchor.x - width : at.left + anchor.x, view.innerWidth - width - 8));
    // As tall as its content, at most 60% of the window; under the tool, scrolled where it does not fit there; above it where
    // it fits whole there, or there is more room there: never past the top of the box the page scrolls in (what is over it,
    // SilverBullet's bar, would cover it)
    const most = view.innerHeight * 0.6;
    const natural = Math.min(most, holder.scrollHeight + holder.offsetHeight - holder.clientHeight);
    const below = at.top + anchor.y;
    const roomBelow = view.innerHeight - below - 8;
    const roomAbove = at.top - 4 - scrollTop(button) - 8;
    const above = natural > roomBelow && (natural <= roomAbove || roomAbove > roomBelow);
    const height = Math.max(Math.min(80, natural), Math.min(most, above ? roomAbove : roomBelow));
    holder.style.left = `${left}px`;
    holder.style.top = `${above ? at.top - 4 - Math.min(natural, height) : below}px`;
    holder.style.maxHeight = `${height}px`;
    holder.scrollTop = scrolled;
  };
  // (Placed again as anything but the menu itself scrolls, or the window resizes, once a frame)
  let queued = false;
  const follow = (event: Event) => {
    if (event.target instanceof Node && holder.contains(event.target)) return;
    if (queued) return;
    queued = true;
    view?.requestAnimationFrame(() => {
      queued = false;
      // (Its tool gone from the page: closed by liftOut's watch)
      place();
    });
  };
  const close = (refocus = false, byUser = true) => {
    if (holder.hidden) return;
    if (byUser) closed?.();
    holder.hidden = true;
    anchor = undefined;
    lifted?.();
    lifted = undefined;
    box.append(holder);
    for (const property of ["position", "left", "top", "right", "bottom", "max-height"]) holder.style.removeProperty(property);
    holder.replaceChildren();
    shown = undefined;
    button.setAttribute("aria-expanded", "false");
    stop?.();
    stop = undefined;
    if (refocus) button.focus({ preventScroll: true });
  };
  const show = (heading: string, made: readonly MenuEntry[], back?: MenuBack, named?: MenuNaming) => {
    // Run, an entry closes the menu, unless it showed others in its place
    const wrapped = wrapRuns(made, (run) => () => {
      const before = shown;
      run();
      if (shown !== before) return;
      close();
      // (The menu gone with the focus in it: back on the tool, where nothing else took it, a dialog the entry opened)
      if (!doc.activeElement || doc.activeElement === doc.body) button.focus({ preventScroll: true });
    });
    const menu = renderMenu(doc, LOOK, heading, wrapped, back, namingThatCloses(named, () => close(true)));
    keepFocus(menu);
    onMenuClose(menu, LOOK, () => close(true));
    holder.replaceChildren(menu);
    shown = menu;
    // (A submenu from its top, not where its parent was scrolled)
    holder.scrollTop = 0;
    place();
    focusMenu(menu, LOOK);
  };
  const open = () => {
    // A submenu's way back goes to the level it was opened from (Group › Group by: back to Group)
    let level: () => void;
    const top = () => {
      level = top;
      show(title(), entries(opened), undefined, naming?.());
    };
    const opened = (heading: string, others: readonly MenuEntry[]) => {
      const parent = level;
      const self = () => {
        level = self;
        show(heading, others, { icon: ICONS.back, run: parent });
      };
      self();
    };
    holder.hidden = false;
    top();
    button.setAttribute("aria-expanded", "true");
    const beside = (event: Event) => {
      if (!inMenu(event.target as Node)) close();
    };
    doc.addEventListener("pointerdown", beside, true);
    doc.addEventListener("scroll", follow, true);
    view?.addEventListener("resize", follow);
    stop = () => {
      doc.removeEventListener("pointerdown", beside, true);
      doc.removeEventListener("scroll", follow, true);
      view?.removeEventListener("resize", follow);
    };
  };
  button.addEventListener("click", () => (holder.hidden ? open() : close()));
  // (The menu in the body while it shows: what leaves the tool for it, or it for the tool, stays)
  const left = (event: FocusEvent) => {
    if (!inMenu(event.relatedTarget as Node | null) && event.relatedTarget) close();
  };
  box.addEventListener("focusout", left);
  holder.addEventListener("focusout", left);
  // (Caught on its way down: the menu keeps its keys from going on, Esc too)
  const escape = (event: KeyboardEvent) => {
    // (Not in the title's field: Esc there leaves the name as it was, the menu staying)
    if (event.key !== "Escape" || holder.hidden || (event.target instanceof Element && event.target.closest(".swd-menu-name"))) return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  };
  box.addEventListener("keydown", escape, true);
  holder.addEventListener("keydown", escape, true);
  // Tab past the menu's first or last control: the menu closed, the focus back on its tool (in the body the next
  // control would be none, or anything of SilverBullet's, and the menu stayed open). On its way down: the shared menu
  // keeps its keys from going up
  holder.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
      const controls = [...holder.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')].filter((one) => !one.matches(":disabled") && !one.closest("[hidden]"));
      const edge = event.shiftKey ? controls[0] : controls[controls.length - 1];
      if (edge && doc.activeElement !== edge) return;
      event.preventDefault();
      close(true);
    },
    true,
  );
  return {
    box,
    close: () => close(false, false),
    openAt(labels) {
      if (holder.hidden) open();
      for (const label of labels) {
        const item = [...(shown?.querySelectorAll<HTMLElement>(".swd-menu-item") ?? [])].find((one) => one.querySelector(".swd-label")?.textContent?.split(": ")[0] === label);
        if (!item) return undefined;
        item.click();
      }
      return shown;
    },
  };
}

/**
 * A place's ⋯ and its menu, titled `title` (named by `naming`: a pencil after
 * it), its entries asked of `groups` as it opens, in the slots' order
 */
export function placeMenu(doc: Document, title: () => string, groups: (menu: PlaceMenuBuilder) => readonly PlaceMenuGroup[], naming?: () => MenuNaming | undefined, closed?: () => void): PlaceMenu {
  const button = el(doc, "button", { class: "swd-tool swd-more", title: "More", attrs: { "aria-label": "More" } }, el(doc, "span", { class: "swd-tool-icon", html: ICONS.more }));
  return toolMenu(doc, button, title, (open) => assembled(groups(menuBuilder(PLACE_MENU_SLOTS, open))), naming, closed);
}
