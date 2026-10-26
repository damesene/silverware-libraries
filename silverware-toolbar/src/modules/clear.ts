// The clear module: every format of markers taken off the selection (bold,
// italic, code, …), its text kept (formats/inline.ts clear). Formats of their
// own reads (a link) stay. Where the selection has text (not code, a table's
// rows, rules).
import type { ToolbarModule } from "../core/action.ts";
import { canClear, clear } from "../formats/index.ts";
import { ICONS } from "../icons.ts";

export function clearModule(): ToolbarModule {
  return {
    actions: () => [
      {
        id: "actions.clear",
        label: "Clear formatting",
        icon: ICONS.clear,
        group: "Format",
        keywords: ["remove", "plain", "reset", "vymazat formát"],
        enabled: canClear,
        run: clear,
      },
    ],
  };
}
