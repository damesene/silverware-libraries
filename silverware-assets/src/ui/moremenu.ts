// An asset's "…" button (docs/silverware-assets.md, *Views*): on its frame, at its top right, opening the
// asset's menu (the shared popup menu, shared/popupmenu.ts): how it is shown (icon, preview, embed: the one it is
// shown as checked, one that cannot be drawn disabled), then what can be done with it.
import { el } from "../../../shared/elements.ts";
import { opensMenu, type PopupMenu } from "../../../shared/popupmenu.ts";

// The popup menu's classes: Silverware Layout's
const POPUP = { base: "swl" } as const;

type Item = { readonly label: string; readonly run: () => void };

export type MoreMenu = {
  readonly title: string;
  readonly views: readonly (Item & { readonly view: string; readonly checked: boolean; readonly disabled?: string })[];
  // What can be done with it (the actions that fit, then a change of its form), each its label and run
  readonly actions?: readonly Item[];
};

/** An asset's menu as Silverware Layout's popup menu shows it: its views, then its actions */
export const popupOf = (menu: MoreMenu): PopupMenu => ({ title: menu.title, sections: [menu.views, menu.actions ?? []] });

/** The "…" button on an asset's frame, its menu made as it is pressed; gone as `signal` aborts */
export function addMoreButton(doc: Document, frame: HTMLElement, menu: () => MoreMenu, signal: AbortSignal): HTMLButtonElement {
  const button = el(doc, "button", { class: "swl-asset-more", title: "Show as…", text: "…" });
  opensMenu(doc, POPUP, button, () => popupOf(menu()), signal);
  signal.addEventListener("abort", () => button.remove());
  frame.append(button);
  return button;
}
