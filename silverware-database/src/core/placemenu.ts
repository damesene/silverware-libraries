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
import { ICONS } from "./icons.ts";

/**
 * The slots of a place's menu, by what their entries do:
 * `view`, how the view shows its items (Group by; a view's own options);
 * `data`, the database's schema and data (Properties);
 * `source`, the place itself, its block (Edit source).
 * Shown in this order, sections of their own (`custom`) primary first, secondary before the source
 */
export const PLACE_MENU_SLOTS = ["view", "data", "source"] as const;
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
  const parts = [...customSections(groups, "primary"), slotEntries(groups, "view"), slotEntries(groups, "data"), ...customSections(groups, "secondary"), slotEntries(groups, "source")].filter((part) => part.length > 0);
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
  const close = (refocus = false, byUser = true) => {
    if (holder.hidden) return;
    if (byUser) closed?.();
    holder.hidden = true;
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
    top();
    holder.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const beside = (event: Event) => {
      if (!box.contains(event.target as Node)) close();
    };
    doc.addEventListener("pointerdown", beside, true);
    stop = () => doc.removeEventListener("pointerdown", beside, true);
  };
  button.addEventListener("click", () => (holder.hidden ? open() : close()));
  box.addEventListener("focusout", (event) => {
    if (!box.contains(event.relatedTarget as Node | null) && event.relatedTarget) close();
  });
  // (Caught on its way down: the menu keeps its keys from going on, Esc too)
  box.addEventListener(
    "keydown",
    (event) => {
      // (Not in the title's field: Esc there leaves the name as it was, the menu staying)
      if (event.key !== "Escape" || holder.hidden || (event.target instanceof Element && event.target.closest(".swd-menu-name"))) return;
      event.preventDefault();
      event.stopPropagation();
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
