// Silverware Assets DOCX (docs/silverware-viewers.md): Word documents (.docx) drawn by docx-preview, through Silverware Assets'
// API alone (its init page hands `silverware.assets.api` over): a type of file registered with it. Without Silverware
// Assets nothing is drawn (its stand-in registers nothing).
import { assetsOf } from "../../shared/assets.ts";
import { keptKeys } from "../../shared/silverbullet/keptkeys.ts";
import { docxType } from "./type.ts";

/** What the init page hands over */
export type Bridge = {
  readonly assets?: unknown;
  // A notification, and SilverBullet's commands and their shortcuts (`system.listCommands`): one pressed in a reader,
  // where it does nothing, told (either missing: nothing told)
  readonly flash?: (message: string, type?: "info" | "error") => unknown;
  readonly listCommands?: () => unknown;
};

// The API the type is registered with, and what takes it off again: Space Lua loaded again runs the init page again,
// the same API handed over (its module imported once) keeping the type as it is, another's replacing it
let registered: { readonly assets: unknown; readonly off: () => void } | undefined;

/** Started by the init page (again as Space Lua loads again) */
export function init(bridge: Bridge): void {
  if (registered && registered.assets === bridge.assets) return;
  registered?.off();
  // SilverBullet's shortcuts a reader keeps from it, told in its notification (shared/silverbullet/keptkeys.ts)
  const { flash } = bridge;
  const keyKept = keptKeys(bridge.listCommands, flash && ((message) => void flash(message, "info")));
  registered = { assets: bridge.assets, off: assetsOf(bridge.assets).types.register(docxType(document, keyKept)) };
}
