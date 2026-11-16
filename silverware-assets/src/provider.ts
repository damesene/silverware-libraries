// An embedded medium placed by Silverware Layout, as a widget (shared/layout.ts): the frame the host draws it in,
// decorated (not a card, which stands at the left, as a line's text). Its entries are Layout's to give meaning to
// (docs/silverware-layout-align.md): its width, dragged by Layout's handle (a full file's; a preview's size is the
// settings'), kept as SilverBullet's own size in the embed (`|300`); where it stands (`align`), kept in its metadata
// (`{ align: right }`), its kinds Preview and Full, each at the left unless the user sets otherwise in Layout.
// Its pixels, or a share of the box it is in (`|50%`): Silverware Layout shows a share of a medium (of its own size) as
// SilverBullet does, of that box, and gives one only in a grid's cell, its quarters
// (docs/silverware-layout-room-handles.md), the medium then following the cell; elsewhere its guides as the pixels
// they show. Drawn outside the editor (a grid's cell) its room is that box: its quarters its snaps, no wider.
import type { LayoutChanges, LayoutEntries, LayoutProvider } from "../../shared/layout.ts";
import type { AssetDecorator } from "./decorate.ts";

// A size Silverware Layout keeps: pixels, or a share
const SIZE = /^\d+(\.\d+)?%?$/;

const isPreview = (element: Element) => element.getAttribute("data-swa-view") === "preview";

export function assetProvider(assets: AssetDecorator): LayoutProvider {
  return {
    name: "silverware-assets",
    // (Its sizes grow and shrink with the content's scale: shared/contentscale.ts)
    scales: true,
    // (Not a card, which has no size and stands at the left)
    selector: '[data-swa-type]:not([data-swa-view="card"])',
    read: (element): LayoutEntries => {
      const size = assets.sizeOf(element as HTMLElement);
      const align: Record<string, string> = size?.align ? { align: size.align } : {};
      // (A preview's size is the settings' for its type: no width of Layout's, its embed's size none of its)
      if (isPreview(element)) return align;
      const width = size?.width;
      // (A share only in a room, a grid's cell, where Layout gives one: elsewhere left to SilverBullet as it reads it)
      const taken: Record<string, string> = width && SIZE.test(width) && (!width.endsWith("%") || assets.roomOf(element as HTMLElement)) ? { width } : {};
      return { ...taken, ...align };
    },
    write: async (element, changes: LayoutChanges) => {
      if (changes.align !== undefined) {
        const problem = await assets.writeAlign(element as HTMLElement, changes.align ?? undefined);
        if (problem) return problem;
      }
      const width = changes.width;
      if (width === undefined) return undefined;
      if (width === null) return assets.writeWidth(element as HTMLElement, undefined);
      // (Its pixels, or a share of the cell it is in, as Silverware Layout gives one there: SilverBullet's size reads both,
      // `|300`, `|50%`; anything else, as it is drawn now)
      const size = SIZE.test(width) ? width : String(Math.round(element.getBoundingClientRect().width));
      return assets.writeWidth(element as HTMLElement, size);
    },
    kinds: [
      { id: "preview", name: "File: preview", align: "left" },
      { id: "full", name: "File: full", align: "left" },
    ],
    kindOf: (element) => (isPreview(element) ? "preview" : "full"),
    // (A preview placed alone, never widened: the user's choice 2026-11-14)
    resizable: (element) => !isPreview(element),
    // (Without a width, SilverBullet's own size or the file's: the text's width snapped to kept as its pixels)
    unsized: "own",
    // Drawn outside the editor (a grid's cell): that box its room, as the one drawing it told
    room: (element) => assets.roomOf(element as HTMLElement),
  };
}
