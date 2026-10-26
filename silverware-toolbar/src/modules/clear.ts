// The clear module: every format of markers taken off the selection (bold,
// italic, code, …), its text kept (formats/inline.ts clear). Formats of their
// own reads (a link) stay. Where the selection has text (not code, a table's
// rows, rules). With the setting wordAtCaret a caret touching a word clears the word.
import type { Context, ModuleHost, ToolbarModule } from "../core/action.ts";
import { asWord, canClear, clear, keptCaret } from "../formats/index.ts";
import { ICONS } from "../icons.ts";

export function clearModule(host: ModuleHost = {}): ToolbarModule {
  const word = !!host.wordAtCaret;
  const on = (context: Context) => (word ? asWord(context) : context);
  return {
    actions: () => [
      {
        id: "actions.clear",
        label: "Clear formatting",
        icon: ICONS.clear,
        group: "Format",
        keywords: ["remove", "plain", "reset", "vymazat formát"],
        enabled: (context) => canClear(on(context)),
        run: (context) => (word ? keptCaret(context, clear(asWord(context))) : clear(context)),
      },
    ],
  };
}
