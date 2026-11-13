// An embedded medium's width laid out by Silverware Layout's handle, as a widget's (shared/layout.ts): the frame the
// host draws it in, decorated (not a card: a card has no size), its width kept as SilverBullet's own size in the
// embed (`|300`), where it stays as it changes the user's setting (`anchor`: at the text's start by default).
// Pixels only: SilverBullet's `%` is of the medium's box, Silverware Layout's of the editor's pane, so a width in % is
// left to SilverBullet, and one Layout gives in % or `full` is written as the pixels it shows.
import type { LayoutChanges, LayoutEntries, LayoutProvider } from "../../../shared/layout.ts";
import type { AssetDecorator } from "./decorate.ts";

export function assetProvider(assets: AssetDecorator): LayoutProvider {
  return {
    name: "silverware-layout-assets",
    // (Not in markdown rendered outside the editor, a grid's cell: its snaps to the cell's shares come later)
    selector: '[data-swl-asset]:not([data-swl-asset-view="icon"], [data-swl-rendered] *)',
    read: (element): LayoutEntries => {
      const width = assets.sizeOf(element as HTMLElement)?.width;
      return width && /^\d+(\.\d+)?$/.test(width) ? { width } : {};
    },
    write: async (element, changes: LayoutChanges) => {
      const width = changes.width;
      if (width === undefined) return undefined;
      if (width === null) return assets.writeWidth(element as HTMLElement, undefined);
      const pixels = /^\d+(\.\d+)?$/.test(width) ? width : String(Math.round(element.getBoundingClientRect().width));
      return assets.writeWidth(element as HTMLElement, pixels);
    },
    anchor: (element) => assets.sizeOf(element as HTMLElement)?.anchor ?? "start",
  };
}
