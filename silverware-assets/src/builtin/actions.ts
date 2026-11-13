// Silverware Layout's own actions (docs/silverware-assets.md, *Actions*), registered as anyone's: the asset's
// URL in a new tab of the browser; the asset in a side panel, or enlarged over the page (./panels.ts).
import type { AssetAction } from "../../../shared/assets.ts";
import { peek, popover } from "./panels.ts";

export const openTab: AssetAction = {
  name: "open-tab",
  label: "Open in a new tab",
  fits: (asset) => "url" in asset,
  run: (context) => {
    if ("url" in context.asset) context.open(context.asset.url);
  },
};

export const BUILTIN_ACTIONS: readonly AssetAction[] = [openTab, peek, popover];
