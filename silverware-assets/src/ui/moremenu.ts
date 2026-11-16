// An asset's "…" button (docs/silverware-assets.md, *Views*; its menu: docs/silverware-assets-menu.md): on its frame, at
// its top right, opening the asset's menu (the shared popup menu, shared/popupmenu.ts). What changes the page first (how
// the file is shown there: a row of a link, a card, a preview, the file in full), then the ways of opening it, then what
// is done with the file itself (a copy, a download), its deletion last, apart: a separator between. Rename… (its title,
// its file's name) is with the page's row: it changes the page.
import { el } from "../../../shared/elements.ts";
import { TRASH } from "../../../shared/glyphs.ts";
import { opensMenu, type PopupMenu } from "../../../shared/popupmenu.ts";

// The popup menu's classes: Silverware Assets'
const POPUP = { base: "swa" } as const;

type Item = { readonly label: string; readonly run: () => void; readonly danger?: boolean; readonly icon?: string };

/** One way of showing the file in the page: its icon and name, whether it is the one shown, why not where it cannot be */
export type ShowAs = { readonly view: string; readonly title: string; readonly icon: string; readonly active: boolean; readonly disabled?: string; readonly run: () => void };

export type MoreMenu = {
  readonly title: string;
  // How it is shown in the page: one row, the one shown active (none: no row)
  readonly showAs?: readonly ShowAs[];
  // What else changes it in the page, under that row (Rename…)
  readonly page?: readonly Item[];
  // The ways of opening it (a new tab, a side panel, enlarged)
  readonly open?: readonly Item[];
  // What is done with the file itself: a copy, a download, its preview made again
  readonly file?: readonly Item[];
  // What cannot be undone (its file deleted), last, apart, in the danger colour
  readonly destructive?: readonly Item[];
};

/** An asset's menu as the shared popup menu shows it: its row of how it is shown, then each section, a separator between */
export const popupOf = (menu: MoreMenu): PopupMenu => ({
  title: menu.title,
  sections: [
    [
      ...(menu.showAs?.length
        ? [{ kind: "segmented" as const, label: "Show as", options: menu.showAs.map(({ icon, title, active, disabled, run }) => ({ icon, title, active, ...(disabled ? { disabled } : {}), run })) }]
        : []),
      ...(menu.page ?? []),
    ],
    menu.open ?? [],
    menu.file ?? [],
    // (In the danger colour, the trash before it)
    (menu.destructive ?? []).map((item) => ({ ...item, danger: true, icon: item.icon ?? TRASH })),
  ],
});

/** The "…" button on an asset's frame, its menu made as it is pressed; gone as `signal` aborts */
export function addMoreButton(doc: Document, frame: HTMLElement, menu: () => MoreMenu, signal: AbortSignal): HTMLButtonElement {
  const button = el(doc, "button", { class: "swa-more", title: "Show as…", text: "…" });
  opensMenu(doc, POPUP, button, () => popupOf(menu()), signal);
  signal.addEventListener("abort", () => button.remove());
  frame.append(button);
  return button;
}
