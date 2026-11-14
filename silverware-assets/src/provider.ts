// An embedded medium placed by Silverware Layout, as a widget (shared/layout.ts): the frame the host draws it in,
// decorated (not a card, which stands at the left, as a line's text). Its entries are Layout's to give meaning to
// (docs/silverware-layout-align.md): its width, dragged by Layout's handle (an original's; a preview's size is the
// settings'), kept as SilverBullet's own size in the embed (`|300`); where it stands (`align`), kept in its metadata
// (`{ align: right }`), its kinds Preview and Original, each at the left unless the user sets otherwise in Layout.
// Pixels only: SilverBullet's `%` is of the medium's box, Silverware Layout's of the editor's pane, so a width in % is
// left to SilverBullet, and one Layout gives in % or `full` is written as the pixels it shows. Drawn outside the editor
// (a grid's cell) its room is that box: its quarters its snaps, no wider.
import type { LayoutChanges, LayoutEntries, LayoutProvider } from "../../shared/layout.ts";
import type { AssetDecorator } from "./decorate.ts";

const isPreview = (element: Element) => element.getAttribute("data-swa-view") === "preview";

export function assetProvider(assets: AssetDecorator): LayoutProvider {
  return {
    name: "silverware-assets",
    // (Not a card, which has no size and stands at the left)
    selector: '[data-swa-asset]:not([data-swa-view="icon"])',
    read: (element): LayoutEntries => {
      const size = assets.sizeOf(element as HTMLElement);
      const align: Record<string, string> = size?.align ? { align: size.align } : {};
      // (A preview's size is the settings' for its type: no width of Layout's, its embed's size none of its)
      if (isPreview(element)) return align;
      const width = size?.width;
      return { ...(width && /^\d+(\.\d+)?$/.test(width) ? { width } : {}), ...align };
    },
    write: async (element, changes: LayoutChanges) => {
      if (changes.align !== undefined) {
        const problem = await assets.writeAlign(element as HTMLElement, changes.align ?? undefined);
        if (problem) return problem;
      }
      const width = changes.width;
      if (width === undefined) return undefined;
      if (width === null) return assets.writeWidth(element as HTMLElement, undefined);
      const pixels = /^\d+(\.\d+)?$/.test(width) ? width : String(Math.round(element.getBoundingClientRect().width));
      return assets.writeWidth(element as HTMLElement, pixels);
    },
    kinds: [
      { id: "preview", name: "File: preview", align: "left" },
      { id: "original", name: "File: original", align: "left" },
    ],
    kindOf: (element) => (isPreview(element) ? "preview" : "original"),
    // (A preview placed alone, never widened: the user's choice 2026-11-14)
    resizable: (element) => !isPreview(element),
    // (Without a width, SilverBullet's own size or the file's: the text's width snapped to kept as its pixels)
    unsized: "own",
    // Drawn outside the editor (a grid's cell): that box its room, as the one drawing it told
    room: (element) => assets.roomOf(element as HTMLElement),
  };
}
