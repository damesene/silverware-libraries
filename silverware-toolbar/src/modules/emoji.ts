// The emoji module: an action (`actions.emoji`) opening Silverware Icons' picker (shared/icons.ts `Icons.pick`), its
// emoji alone, in its panel (core/panel.ts); one picked is written at the cursor (the selection replaced). The emoji
// are not the popup's actions (too many among the formats): only the picker finds them. Without Silverware Icons the
// panel says it is needed (its stand-in).
import { type Icons, iconsOf } from "../../../shared/icons.ts";
import type { Change, Context, ModuleHost, ToolbarModule } from "../core/action.ts";
import { cursor } from "../core/cursor.ts";
import { ICONS } from "../icons.ts";

export function emojiModule(host: ModuleHost = {}): ToolbarModule {
  const icons: Icons = host.icons ?? iconsOf(undefined);
  return {
    actions: () => [
      {
        id: "actions.emoji",
        label: "Emoji",
        icon: ICONS.emoji,
        group: "Insert",
        keywords: ["smiley", "emoticon", "symbol", "icon"],
        panel: (panel) => {
          return icons.pick(panel.element, {
            sets: ["emoji"],
            picked: (emoji) => panel.write((context) => emojiChange(emoji, context)),
            searchIcon: ICONS.search,
            shown: () => panel.place(),
          });
        },
      },
    ],
  };
}

/** An emoji written over the selection, the cursor after it */
export function emojiChange(emoji: string, context: Context): Change {
  return { from: context.from, to: context.to, insert: emoji + cursor() };
}
