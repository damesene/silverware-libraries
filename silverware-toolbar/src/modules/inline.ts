// The inline module: an action for each inline format offered (one with a
// label: bold, italic, …, a link), a toggle (formats/inline.ts). Built-in and
// custom formats alike, as defined when the actions are asked for. With the
// setting wordAtCaret a caret touching a word works on the word (formats/word.ts),
// where it is not in the format already.
import type { Action, Context, ModuleHost, ToolbarModule } from "../core/action.ts";
import { asWord, canFormat, type Format, formatsIn, isOn, keptCaret, toggle } from "../formats/index.ts";

function formatAction(format: Format, word: boolean): Action {
  // The word, where the caret is not in the format already (in a link, the link the caret is in: it may hold spaces)
  const on = (context: Context) => (word && !isOn(context, format) ? asWord(context) : context);
  return {
    id: format.id,
    label: format.label!,
    icon: format.icon,
    group: format.group ?? "Format",
    keywords: format.keywords,
    active: (context) => isOn(on(context), format),
    enabled: (context) => canFormat(on(context), format),
    edit: (context) => {
      const target = on(context);
      return target === context ? toggle(context, format) : keptCaret(context, toggle(target, format));
    },
  };
}

export function inlineModule(host: ModuleHost = {}): ToolbarModule {
  return { actions: () => formatsIn("inline").filter((f) => f.label).map((format) => formatAction(format, !!host.wordAtCaret)) };
}
