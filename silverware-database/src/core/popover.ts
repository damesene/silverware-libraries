// A small panel of choices under a tool of the place's bar (the sort's, the ⋯),
// shown and hidden by its button (a disclosure: `aria-expanded`): closed by Esc
// (the focus back on its button), a press or the focus elsewhere, a choice (a
// press on any button in it), and `close` (its place drawn anew). It lies in the
// tool's own box (`.swd-tool-box`, position: relative), so it moves with the bar
// and needs no measuring.
import { el } from "../../../shared/elements.ts";

export type Popover = {
  /** The tool's box: its button and, while open, the menu */
  readonly box: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly menu: HTMLElement;
  close(): void;
};

export function popover(doc: Document, button: HTMLButtonElement, label: string, fill: (menu: HTMLElement, close: () => void) => void): Popover {
  const menu = el(doc, "div", { class: "swd-popover", attrs: { role: "group", "aria-label": label, hidden: "" } });
  const box = el(doc, "span", "swd-tool-box", button, menu);
  button.setAttribute("aria-expanded", "false");
  let stop: (() => void) | undefined;
  const close = () => {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    stop?.();
    stop = undefined;
  };
  const open = () => {
    fill(menu, close);
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const beside = (event: Event) => {
      if (!box.contains(event.target as Node)) close();
    };
    doc.addEventListener("pointerdown", beside, true);
    stop = () => doc.removeEventListener("pointerdown", beside, true);
    menu.querySelector<HTMLElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  };
  button.addEventListener("click", () => (menu.hidden ? open() : close()));
  // A choice closes it, whatever made the button pressed (the place's own, a module's); a choice that reopens it opens it after
  menu.addEventListener("click", (event) => {
    if ((event.target as Element).closest("button")) close();
  });
  box.addEventListener("focusout", (event) => {
    if (!box.contains(event.relatedTarget as Node | null) && event.relatedTarget) close();
  });
  box.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || menu.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close();
    button.focus({ preventScroll: true });
  });
  return { box, button, menu, close };
}
