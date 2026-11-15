// A menu a plugin opens from an element of its own (a medium's "…", a link's icon, a grid's cell's "…"): its sections
// of items, a separator between; placed under what opened it, over the page. The shared menu (menu.ts), its classes by
// the plugin's base (`<base>-menu-item`…), in a box of the plugin's own (`<base>-popup <base>-menu`: its style page
// places and draws it). What opens it takes the press as its own: what it is in (a link SilverBullet follows as a touch
// on it ends, an editor moving its cursor) does not get it.
import { COMPANION_ATTRIBUTE } from "./editor.ts";
import { el } from "./elements.ts";
import { layerVariable } from "./layers.ts";
import { focusMenu, type MenuEntry, menuItem, menuSegmented, menuSeparator, onMenuClose, renderMenu } from "./menu.ts";
import { overWindowOf } from "./overwindow.ts";

// The room a menu keeps from the window's edges where it is held in it (px)
const POPUP_MARGIN = 8;

/** The plugin's base of classes (`swl`) */
export type PopupLook = { readonly base: string };

/** One item: its label, what it does; checked (a choice shown as on), disabled (why, as text) */
export type PopupItem = { readonly label: string; readonly run: () => void; readonly checked?: boolean; readonly disabled?: string; readonly danger?: boolean; readonly icon?: string };

/** A row of choices side by side (Align: left, centre, right), each its icon (SVG text) and title, the one set active */
export type PopupSegmented = {
  readonly kind: "segmented";
  readonly label: string;
  // (`disabled`: why it cannot be chosen now, its tooltip; `keepsOpen`: the menu not closed by it, its caller shows it
  // anew as what it changed is done)
  readonly options: readonly { readonly icon: string; readonly title: string; readonly active?: boolean; readonly disabled?: string; readonly keepsOpen?: boolean; readonly run: () => void }[];
};

export type PopupMenu = { readonly title: string; readonly sections: readonly (readonly (PopupItem | PopupSegmented)[])[] };

/**
 * A menu shown under an element, over the page (placed by the element's box): closed by a press beside it and the
 * element, Esc, a choice, or the function given back; `closed` told as it closes
 */
export function showPopup(doc: Document, look: PopupLook, at: HTMLElement, shown: PopupMenu, closed?: () => void): () => void {
  const LOOK = { base: look.base };
  let holder: HTMLElement | undefined;
  // Opened from a field's shadow root (an editor's): the focus given back there as it closes, so the field is not left
  // for nothing (a grid's cell written and closed under what was chosen)
  const inField = at.getRootNode() instanceof (doc.defaultView?.ShadowRoot ?? ShadowRoot);
  const focusedBefore = inField ? deepFocus(doc) : undefined;
  const close = () => {
    if (!holder) return;
    holder.remove();
    holder = undefined;
    if (focusedBefore?.isConnected) focusedBefore.focus({ preventScroll: true });
    doc.removeEventListener("pointerdown", outside, true);
    doc.removeEventListener("keydown", escape, true);
    closed?.();
  };
  const outside = (event: Event) => {
    if (holder && !holder.contains(event.target as Node) && !at.contains(event.target as Node)) close();
  };
  // (Esc wherever the focus is: a press on what opened it may have taken the focus from the menu)
  const escape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  const entries: MenuEntry[] = [];
  for (const section of shown.sections.filter((one) => one.length)) {
    if (entries.length) entries.push(menuSeparator());
    for (const item of section) {
      if ("kind" in item) {
        entries.push(menuSegmented({ label: item.label, options: item.options.map((option) => ({ icon: option.icon, title: option.title, ...(option.active === undefined ? {} : { active: option.active }), ...(option.disabled ? { disabled: option.disabled } : {}), run: option.keepsOpen ? () => option.run() : () => (close(), option.run()) })) }));
        continue;
      }
      entries.push(menuItem({ label: item.label, ...(item.checked === undefined ? {} : { checked: item.checked }), ...(item.disabled ? { disabled: item.disabled } : {}), ...(item.danger ? { danger: true } : {}), ...(item.icon ? { icon: item.icon } : {}), run: () => (close(), item.run()) }));
    }
  }
  const rendered = renderMenu(doc, LOOK, shown.title, entries);
  onMenuClose(rendered, LOOK, close);
  // (The box is the plugin's own, `.swl-menu`: the shared look's rules are of the menu in it)
  holder = el(doc, "div", { class: `${look.base}-popup ${look.base}-menu` }, rendered);
  // Opened from an element in a field's shadow root (a file drawn in another plugin's editor): it acts on that editor, so
  // the focus coming to it is not the field left (shared/editor.ts' companions); opened from what shows over the window
  // (a database's peek), over it, as its own panels are
  if (inField) holder.setAttribute(COMPANION_ATTRIBUTE, "");
  if (overWindowOf(inField ? (at.getRootNode() as ShadowRoot).host : at))
    holder.style.zIndex = `calc(var(${layerVariable("sheetPanel")}) + 1)`;
  const box = at.getBoundingClientRect();
  holder.style.top = `${box.bottom + 4}px`;
  // (Its right edge by what opened it, all of it in the window: as wide as it is drawn, a phone's narrow window too)
  const windowWidth = doc.defaultView?.innerWidth ?? Infinity;
  if (Number.isFinite(windowWidth)) holder.style.maxWidth = `${windowWidth - 2 * POPUP_MARGIN}px`;
  holder.style.left = `${POPUP_MARGIN}px`;
  doc.body.append(holder);
  const width = holder.getBoundingClientRect().width || 220;
  holder.style.left = `${Math.max(POPUP_MARGIN, Math.min(box.right - width, windowWidth - width - POPUP_MARGIN))}px`;
  // Held in the part of the window seen (an on-screen keyboard's room out): over what opened it where it has no room
  // under it and has above it (by the window's bottom its last items were cut off), else as low as it fits, and where it
  // is taller than that part, as tall and scrolled
  const win = doc.defaultView;
  const seenTop = win?.visualViewport?.offsetTop ?? 0;
  const seenHeight = win?.visualViewport?.height ?? win?.innerHeight ?? Infinity;
  const room = seenHeight - 2 * POPUP_MARGIN;
  if (holder.getBoundingClientRect().height > room) {
    holder.style.maxHeight = `${room}px`;
    holder.style.overflowY = "auto";
  }
  const height = holder.getBoundingClientRect().height;
  const bottom = seenTop + seenHeight;
  if (box.bottom + 4 + height > bottom) {
    const above = box.top - 4 - height;
    holder.style.top = `${above >= seenTop ? above : Math.max(seenTop + POPUP_MARGIN, bottom - height - POPUP_MARGIN)}px`;
  }
  // (A press beside it watched while it is open alone: an element drawn anew and thrown away leaves no listener)
  doc.addEventListener("pointerdown", outside, true);
  doc.addEventListener("keydown", escape, true);
  focusMenu(rendered, LOOK);
  return close;
}

/** An element that opens a menu as it is pressed, the menu made then; closed by a press beside it, Esc, or a second press; all of it gone as `signal` aborts */
export function opensMenu(doc: Document, look: PopupLook, trigger: HTMLElement, menu: () => PopupMenu, signal?: AbortSignal): void {
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  let close: (() => void) | undefined;
  // (Held back as it comes: what the trigger is in, a link, would follow it or move the editor's cursor)
  const hold = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const toggle = () => {
    if (close) return close();
    close = showPopup(doc, look, trigger, menu(), () => {
      close = undefined;
      trigger.setAttribute("aria-expanded", "false");
    });
    trigger.setAttribute("aria-expanded", "true");
  };
  const pressed = (event: Event) => {
    hold(event);
    toggle();
  };
  trigger.addEventListener("mousedown", hold, { signal });
  trigger.addEventListener("pointerdown", (event) => event.stopPropagation(), { signal });
  trigger.addEventListener("click", pressed, { signal });
  // A finger: SilverBullet follows a link as a touch on it ends (2.12.1, its LinkWidget's touchend), before any click:
  // the touch ending on the trigger is the trigger's (held back, the click after it none). One that moved is a scroll,
  // left to what it is in (SilverBullet's link counts it, and follows nothing)
  let moved = false;
  trigger.addEventListener("touchstart", () => void (moved = false), { signal, passive: true });
  trigger.addEventListener("touchmove", () => void (moved = true), { signal, passive: true });
  trigger.addEventListener("touchend", (event) => void (moved || pressed(event)), { signal });
  signal?.addEventListener("abort", () => close?.());
}

/** The element with the focus, within shadow roots too (an editor's text in its own root) */
function deepFocus(doc: Document): HTMLElement | undefined {
  let active: Element | null = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active instanceof (doc.defaultView?.HTMLElement ?? HTMLElement) ? active : undefined;
}
