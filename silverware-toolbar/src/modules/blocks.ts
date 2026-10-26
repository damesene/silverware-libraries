// The blocks module: Turn into, a list of the block formats offered (one with
// a label it can write: a paragraph, a heading, a list, a task, a quote; the
// user's too), the one every line selected has checked (formats/block.ts).
// Each choice is an action of its own too, so it can be a favourite.
import type { Action, ToolbarModule } from "../core/action.ts";
import { blockFormatOf, canTurn, type Format, formatsIn, turnInto } from "../formats/index.ts";
import { ICONS } from "../icons.ts";

function turnAction(format: Format): Action {
  return {
    id: format.id,
    label: format.label!,
    icon: format.icon,
    group: "Turn into",
    keywords: ["turn into", "convert", ...format.keywords],
    active: (context) => blockFormatOf(context) === format,
    enabled: canTurn,
    run: (context) => turnInto(context, format),
  };
}

export function blocksModule(): ToolbarModule {
  return {
    actions: () => [
      {
        id: "actions.turnInto",
        label: "Turn into",
        icon: ICONS.turnInto,
        group: "Turn into",
        keywords: ["convert", "block", "type"],
        mixed: "Multiple types",
        enabled: canTurn,
        choices: formatsIn("block")
          .filter((f) => f.label && (f.writeLine || f.writeLines))
          .map(turnAction),
      },
    ],
  };
}
