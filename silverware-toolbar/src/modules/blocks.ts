// The blocks module: Turn into, a list of the block formats offered (one with
// a label it can write: a paragraph, a heading, a list, a task, a quote; the
// user's too) and a code block (formats/codeblock.ts: fences around the lines,
// or taken off), the one every line selected has checked (formats/block.ts).
// Each choice is an action of its own too, so it can be a favourite.
import type { Action, ToolbarModule } from "../core/action.ts";
import { blockFormatOf, canCodeBlock, canTurn, type Format, formatsIn, inCodeBlock, toggleCodeBlock, turnInto } from "../formats/index.ts";
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
    edit: (context) => turnInto(context, format),
  };
}

/** The code block: fences around the lines selected, or taken off the block they are in */
const CODE_BLOCK: Action = {
  id: "formats.codeBlock",
  label: "Code block",
  icon: ICONS.codeBlock,
  group: "Turn into",
  keywords: ["turn into", "fenced", "fence", "pre", "kód"],
  active: inCodeBlock,
  enabled: canCodeBlock,
  edit: toggleCodeBlock,
};

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
        // (In a code block, its lines no format's: Turn into to take its fences off)
        enabled: (context) => canTurn(context) || inCodeBlock(context),
        choices: [
          ...formatsIn("block")
            .filter((f) => f.label && (f.writeLine || f.writeLines))
            .map(turnAction),
          CODE_BLOCK,
        ],
      },
    ],
  };
}
