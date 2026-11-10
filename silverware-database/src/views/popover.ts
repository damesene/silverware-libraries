// A picker opened under its button, in a box the caller names (the peek's top,
// a property's details): one at a time, closed by Esc (the place around it
// staying open), a press beside it, or what is picked, its button focused
// again; and the icons' choice drawn in one (Silverware Icons' picker, its
// icons and emoji; a title, Remove), as an item's icon and a property's are picked.
import { el } from "../../../shared/elements.ts";
import type { Icons } from "../../../shared/icons.ts";

export type Popovers = {
  /**
   * The picker of `button`, filled by `fill` (what it gives back: told as it closes), in `holder` (positioned) under the
   * button, within its width; the same button again closes it
   */
  open(button: HTMLElement, holder: HTMLElement, label: string, fill: (box: HTMLElement) => (() => void) | void): void;
  /** The picker open closed (`refocus`: its button focused again) */
  close(refocus?: boolean): void;
};

export function popovers(doc: Document): Popovers {
  let shown: { readonly box: HTMLElement; readonly button: HTMLElement; readonly stop: () => void } | undefined;
  const close = (refocus = false) => {
    if (!shown) return;
    const { box, button, stop } = shown;
    shown = undefined;
    stop();
    box.remove();
    button.setAttribute("aria-expanded", "false");
    if (refocus && button.isConnected) button.focus({ preventScroll: true });
  };
  return {
    close,
    open(button, holder, label, fill) {
      const was = shown?.button;
      close();
      if (was === button) return;
      const box = el(doc, "div", { class: "swd-pop", attrs: { role: "dialog", "aria-label": label } });
      holder.append(box);
      const ended = fill(box);
      const at = button.getBoundingClientRect();
      const within = holder.getBoundingClientRect();
      box.style.top = `${at.bottom - within.top + holder.scrollTop + 4}px`;
      box.style.left = `${Math.max(0, Math.min(at.left - within.left, holder.clientWidth - box.offsetWidth))}px`;
      // Esc closes the picker alone (the panel or dialog around it never told); a press beside it closes it
      const key = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        close(true);
      };
      const beside = (event: PointerEvent) => {
        if (event.target instanceof Node && !box.contains(event.target) && !button.contains(event.target)) close();
      };
      box.addEventListener("keydown", key);
      doc.addEventListener("pointerdown", beside, true);
      shown = {
        box,
        button,
        stop: () => {
          ended?.();
          doc.removeEventListener("pointerdown", beside, true);
        },
      };
      button.setAttribute("aria-expanded", "true");
    },
  };
}

/** The icons' choice in a picker's box: its title, Remove where there is one to take off (`remove`), Silverware Icons' picker (its stand-in saying it is needed) */
export function iconChoice(doc: Document, icons: Icons, box: HTMLElement, title: string, pick: (icon: string) => void, remove?: () => void): () => void {
  const head = el(doc, "div", "swd-pop-head", el(doc, "span", { class: "swd-pop-title", text: title }));
  if (remove) head.append(el(doc, "button", { class: "swd-pop-remove", text: "Remove", run: remove }));
  const picker = el(doc, "div", "swd-pop-icons");
  box.append(head, picker);
  return icons.pick(picker, { picked: pick });
}
