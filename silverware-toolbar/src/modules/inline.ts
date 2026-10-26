// The inline module: an action for each inline format offered (one with a
// label: bold, italic, …, a link), a toggle (formats/inline.ts). Built-in and
// custom formats alike, as defined when the actions are asked for.
import type { Action, ToolbarModule } from "../core/action.ts";
import { canFormat, type Format, formatsIn, isOn, toggle } from "../formats/index.ts";

function formatAction(format: Format): Action {
  return {
    id: format.id,
    label: format.label!,
    icon: format.icon,
    group: format.group ?? "Format",
    keywords: format.keywords,
    active: (context) => isOn(context, format),
    enabled: (context) => canFormat(context, format),
    run: (context) => toggle(context, format),
  };
}

export function inlineModule(): ToolbarModule {
  return { actions: () => formatsIn("inline").filter((f) => f.label).map(formatAction) };
}
