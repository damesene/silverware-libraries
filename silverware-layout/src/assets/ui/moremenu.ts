// An asset's "…" button and its menu (docs/silverware-layout-assets.md, *Views*): how it is shown (icon, preview,
// embed: the one it is shown as checked, one that cannot be drawn disabled) and what a click on it does. The shared
// menu (shared/menu.ts), its classes by Silverware Layout's base; placed under the button, over the page.
import { el } from "../../../../shared/elements.ts";
import { focusMenu, type MenuEntry, menuItem, menuSeparator, onMenuClose, renderMenu } from "../../../../shared/menu.ts";

const LOOK = { base: "swl" } as const;

export type MoreMenu = {
  readonly title: string;
  readonly views: readonly { readonly view: string; readonly label: string; readonly checked: boolean; readonly disabled?: string; readonly run: () => void }[];
  // The click's action, where one fits: its label and run
  readonly open?: { readonly label: string; readonly run: () => void };
};

/** The "…" button on an asset's frame, its menu made as it is pressed; gone as `signal` aborts */
export function addMoreButton(doc: Document, frame: HTMLElement, menu: () => MoreMenu, signal: AbortSignal): HTMLButtonElement {
  const button = el(doc, "button", { class: "swl-asset-more", title: "Show as…", text: "…", attrs: { "aria-haspopup": "menu", "aria-expanded": "false" } });
  let holder: HTMLElement | undefined;
  const close = () => {
    holder?.remove();
    holder = undefined;
    button.setAttribute("aria-expanded", "false");
  };
  const outside = (event: Event) => {
    if (holder && !holder.contains(event.target as Node) && event.target !== button) close();
  };
  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (holder) return close();
      const shown = menu();
      const entries: MenuEntry[] = shown.views.map((one) =>
        menuItem({ label: one.label, checked: one.checked, ...(one.disabled ? { disabled: one.disabled } : {}), run: () => (close(), one.run()) }),
      );
      if (shown.open) entries.push(menuSeparator(), menuItem({ label: shown.open.label, run: () => (close(), shown.open!.run()) }));
      const rendered = renderMenu(doc, LOOK, shown.title, entries);
      onMenuClose(rendered, LOOK, close);
      // (The box is the plugin's own, `.swl-menu`: the shared look's rules are of the menu in it)
      holder = el(doc, "div", { class: "swl-asset-menu-holder swl-menu" }, rendered);
      const box = button.getBoundingClientRect();
      holder.style.top = `${box.bottom + 4}px`;
      holder.style.left = `${Math.max(8, box.right - 220)}px`;
      doc.body.append(holder);
      button.setAttribute("aria-expanded", "true");
      focusMenu(rendered, LOOK);
    },
    { signal },
  );
  doc.addEventListener("pointerdown", outside, { capture: true, signal });
  signal.addEventListener("abort", () => {
    close();
    button.remove();
  });
  frame.append(button);
  return button;
}
