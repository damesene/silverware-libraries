// Silverware Layout's own actions (docs/silverware-layout-assets.md, *Actions*), registered as anyone's. The first
// version has one: the asset's URL in a new tab of the browser.
import type { AssetAction } from "../../../../shared/assets.ts";

export const openTab: AssetAction = {
  name: "open-tab",
  fits: (asset) => "url" in asset,
  run: (context) => {
    if ("url" in context.asset) context.open(context.asset.url);
  },
};

export const BUILTIN_ACTIONS: readonly AssetAction[] = [openTab];
