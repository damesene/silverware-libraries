// A menu Silverware Layout opens from an element of its own (a medium's "…", a link's icon, a grid's cell's "…"): its
// sections of items, a separator between; placed under what opened it, over the page. The shared menu
// (shared/menu.ts), its classes by Silverware Layout's base. What opens it takes the press as its own: what it is in
// (a link SilverBullet follows as a touch on it ends, an editor moving its cursor) does not get it.
import { el } from "../../../shared/elements.ts";
import { focusMenu, type MenuEntry, menuItem, menuSeparator, onMenuClose, renderMenu } from "../../../shared/menu.ts";

const LOOK = { base: "swl" } as const;

/** One item: its label, what it does; checked (a choice shown as on), disabled (why, as text) */
export type PopupItem = { readonly label: string; readonly run: () => void; readonly checked?: boolean; readonly disabled?: string };

export type PopupMenu = { readonly title: string; readonly sections: readonly (readonly PopupItem[])[] };

/** An element that opens a menu as it is pressed, the menu made then; closed by a press beside it, Esc, or a second press; all of it gone as `signal` aborts */
export function opensMenu(doc: Document, trigger: HTMLElement, menu: () => PopupMenu, signal?: AbortSignal): void {
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  let holder: HTMLElement | undefined;
  const close = () => {
    holder?.remove();
    holder = undefined;
    trigger.setAttribute("aria-expanded", "false");
  };
  const outside = (event: Event) => {
    if (holder && !holder.contains(event.target as Node) && !trigger.contains(event.target as Node)) close();
  };
  // (Held back as it comes: what the trigger is in, a link, would follow it or move the editor's cursor)
  const hold = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const toggle = () => {
    if (holder) return close();
    const shown = menu();
    const entries: MenuEntry[] = [];
    for (const section of shown.sections.filter((one) => one.length)) {
      if (entries.length) entries.push(menuSeparator());
      for (const item of section) {
        entries.push(menuItem({ label: item.label, ...(item.checked === undefined ? {} : { checked: item.checked }), ...(item.disabled ? { disabled: item.disabled } : {}), run: () => (close(), item.run()) }));
      }
    }
    const rendered = renderMenu(doc, LOOK, shown.title, entries);
    onMenuClose(rendered, LOOK, close);
    // (The box is the plugin's own, `.swl-menu`: the shared look's rules are of the menu in it)
    holder = el(doc, "div", { class: "swl-asset-menu-holder swl-menu" }, rendered);
    const box = trigger.getBoundingClientRect();
    holder.style.top = `${box.bottom + 4}px`;
    holder.style.left = `${Math.max(8, Math.min(box.right - 220, (doc.defaultView?.innerWidth ?? Infinity) - 228))}px`;
    doc.body.append(holder);
    trigger.setAttribute("aria-expanded", "true");
    focusMenu(rendered, LOOK);
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
  doc.addEventListener("pointerdown", outside, { capture: true, ...(signal ? { signal } : {}) });
  signal?.addEventListener("abort", close);
}
