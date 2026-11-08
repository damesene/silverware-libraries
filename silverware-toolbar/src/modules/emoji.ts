// The emoji module: an action (`actions.emoji`) opening the emoji picker
// (shared/emoji.ts) in its panel (core/panel.ts); one picked is written at
// the cursor (the selection replaced). The emoji are not the popup's actions
// (too many among the formats): only the picker finds them. Their data is a
// file beside the bundle (silverware-toolbar-emoji.js, scripts/emoji.mjs),
// imported the first time the picker opens: with the module off it is never
// loaded.
import { type EmojiData, emojiLoader, emojiPicker } from "../../../shared/emoji.ts";
import type { Change, Context, ToolbarModule } from "../core/action.ts";
import { cursor } from "../core/cursor.ts";
import { ICONS } from "../icons.ts";

export type { Emoji, EmojiData } from "../../../shared/emoji.ts";

// Those used last, kept per browser (not a setting)
const RECENT_KEY = "silverware.toolbar.recentEmoji";

/** The data beside the bundle, as SilverBullet installs the library's files (a page of the playground: beside its bundle too) */
const loadBeside = emojiLoader(new URL("./silverware-toolbar-emoji.js", import.meta.url));

export function emojiModule(load: () => Promise<EmojiData> = loadBeside): ToolbarModule {
  return {
    actions: () => [
      {
        id: "actions.emoji",
        label: "Emoji",
        icon: ICONS.emoji,
        group: "Insert",
        keywords: ["smiley", "emoticon", "symbol", "icon"],
        panel: (panel) => {
          panel.element.classList.add("swb-emoji-panel");
          // (The toolbar's own look of a search field, a group's title and the current one)
          return emojiPicker({
            doc: panel.doc,
            element: panel.element,
            base: "swb",
            load,
            pick: (emoji) => panel.write((context) => emojiChange(emoji, context)),
            recentKey: RECENT_KEY,
            searchIcon: ICONS.search,
            classes: { search: "swb-search", field: "swb-search-field", group: "swb-group", none: "swb-none", current: "swb-current" },
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
