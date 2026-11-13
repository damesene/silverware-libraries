// An asset's menu (docs/silverware-layout-assets.md, *Views*): how it is shown (icon, preview, embed: the one it is
// shown as checked, one that cannot be drawn disabled) and what can be done with it (its actions). Opened by the "…"
// button on an embed's frame, or by a link's icon. The shared menu (shared/menu.ts), its classes by Silverware Layout's
// base; placed under what opened it, over the page.
import { el } from "../../../../shared/elements.ts";
import { focusMenu, type MenuEntry, menuItem, menuSeparator, onMenuClose, renderMenu } from "../../../../shared/menu.ts";

const LOOK = { base: "swl" } as const;

type Item = { readonly label: string; readonly run: () => void };

export type MoreMenu = {
  readonly title: string;
  readonly views: readonly (Item & { readonly view: string; readonly checked: boolean; readonly disabled?: string })[];
  // What can be done with it (the click's action first), each its label and run
  readonly actions?: readonly Item[];
};

/** The "…" button on an asset's frame, its menu made as it is pressed; gone as `signal` aborts */
export function addMoreButton(doc: Document, frame: HTMLElement, menu: () => MoreMenu, signal: AbortSignal): HTMLButtonElement {
  const button = el(doc, "button", { class: "swl-asset-more", title: "Show as…", text: "…", attrs: { "aria-haspopup": "menu", "aria-expanded": "false" } });
  opensMenu(doc, button, menu, signal);
  signal.addEventListener("abort", () => button.remove());
  frame.append(button);
  return button;
}

/**
 * An element that opens the asset's menu as it is pressed (a click on it the menu's alone: the press held back from
 * what it is in, a link it would follow), the menu closed by a press beside it, Esc, or a second press
 */
export function opensMenu(doc: Document, trigger: HTMLElement, menu: () => MoreMenu, signal?: AbortSignal): void {
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
  trigger.addEventListener("mousedown", hold, { signal });
  trigger.addEventListener("pointerdown", (event) => event.stopPropagation(), { signal });
  const pressed = (event: Event) => {
    hold(event);
    toggle();
  };
  trigger.addEventListener("click", pressed, { signal });
  // A finger: SilverBullet follows a link as a touch on it ends (2.12.1, its LinkWidget's touchend), before any click:
  // the touch ending on the trigger is the trigger's (held back, the click after it none). One that moved is a scroll,
  // left to what it is in (SilverBullet's link counts it, and follows nothing)
  let moved = false;
  trigger.addEventListener("touchstart", () => void (moved = false), { signal, passive: true });
  trigger.addEventListener("touchmove", () => void (moved = true), { signal, passive: true });
  trigger.addEventListener("touchend", (event) => void (moved || pressed(event)), { signal });
  const toggle = () => {
    if (holder) return close();
    const shown = menu();
    const entries: MenuEntry[] = shown.views.map((one) =>
      menuItem({ label: one.label, checked: one.checked, ...(one.disabled ? { disabled: one.disabled } : {}), run: () => (close(), one.run()) }),
    );
    const actions = shown.actions ?? [];
    if (entries.length && actions.length) entries.push(menuSeparator());
    for (const action of actions) entries.push(menuItem({ label: action.label, run: () => (close(), action.run()) }));
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
  doc.addEventListener("pointerdown", outside, { capture: true, ...(signal ? { signal } : {}) });
  signal?.addEventListener("abort", close);
}
