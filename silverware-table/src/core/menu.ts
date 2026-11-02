// Silverware Table's menus: shared/menu.ts in its look (classes swt-…, its
// icons), floating over the page. The core's: modules give their entries
// (src/menu.ts) and get it through TableHost.floatingMenu.
import { focusMenu as focusShared, keepFocus, type MenuLook, onMenuClose, renderMenu, startNaming as startShared } from "../../../shared/menu.ts";
import { ICONS } from "../icons.ts";
import type { MenuBack, MenuEntry, MenuNaming } from "../menu.ts";

const LOOK: MenuLook = { base: "swt", renameIcon: ICONS.rename };

/** The menu's title as a field, its name to type (the pencil pressed) */
export function startNaming(menu: HTMLElement): void {
  startShared(menu, LOOK);
}

/**
 * A menu floating over the page (Silverware Table's controls, not SilverBullet's
 * content), to put into the page and focus (focusMenu) once placed: a press in
 * it keeps the focus where it is, its × closes it with `close`
 */
export function floatingMenu(
  doc: Document,
  title: string,
  entries: readonly MenuEntry[],
  options: { readonly back?: MenuBack; readonly naming?: MenuNaming; readonly close: () => void },
): HTMLElement {
  const menu = renderMenu(doc, LOOK, title, entries, options.back, options.naming);
  menu.classList.add("swt-floating", "swt-menu", "swt-visible");
  keepFocus(menu);
  onMenuClose(menu, LOOK, options.close);
  return menu;
}

/** Focuses the menu itself, or a list to pick from at its choice (shared/menu.ts) */
export function focusMenu(menu: HTMLElement): void {
  focusShared(menu, LOOK);
}
