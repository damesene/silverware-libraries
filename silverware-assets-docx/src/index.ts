// Silverware Assets DOCX (docs/silverware-viewers.md): Word documents (.docx) drawn by docx-preview, through Silverware Assets'
// API alone (its init page hands `silverware.assets.api` over): a type of file registered with it. Without Silverware
// Assets nothing is drawn (its stand-in registers nothing).
import { assetsOf } from "../../shared/assets.ts";
import { docxType } from "./type.ts";

/** What the init page hands over */
export type Bridge = { readonly assets?: unknown };

// The API the type is registered with, and what takes it off again: Space Lua loaded again runs the init page again,
// the same API handed over (its module imported once) keeping the type as it is, another's replacing it
let registered: { readonly assets: unknown; readonly off: () => void } | undefined;

/** Started by the init page (again as Space Lua loads again) */
export function init(bridge: Bridge): void {
  if (registered && registered.assets === bridge.assets) return;
  registered?.off();
  registered = { assets: bridge.assets, off: assetsOf(bridge.assets).types.register(docxType(document)) };
}
