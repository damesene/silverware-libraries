// The slash module: an action opening SilverBullet's slash commands at the
// cursor (`actions.slashCommands`), as typing "/" does, for a phone's toolbar
// where "/" is a keyboard page away. Written through the editor's API, a "/"
// opens no completion (the editor's completion starts on typing only), so the
// action writes it and starts the completion (`editor.startCompletion`).
// SilverBullet completes a slash command where "/" starts the line or follows
// a character that is no letter, digit, "_" or ":" (its slashCommandRegexp,
// client/plugos/hooks/slash_command.ts of 2.12.1): a space goes before it
// where it would not. Text selected is kept as text, "/" after it, the caret
// after the "/". Where the completion cannot be started (a SilverBullet
// before editor.startCompletion), nothing is written: it says so.
import type { Context, ToolbarModule } from "../core/action.ts";
import { ICONS } from "../icons.ts";

// What "/" may not follow for SilverBullet to complete a slash command after it
const GLUED = /[\w:]$/;

/** What the action writes at the selection's end: "/", a space before it where it would not start a slash command */
export function slashText(context: Context): string {
  return GLUED.test(context.text.slice(0, context.to)) ? " /" : "/";
}

export function slashModule(): ToolbarModule {
  return {
    actions: () => [
      {
        id: "actions.slashCommands",
        label: "Slash commands",
        icon: ICONS.slash,
        group: "Insert",
        keywords: ["/", "insert", "command", "menu", "lomítko"],
        perform: async (context, editor) => {
          if (!editor.completes) throw new Error("this SilverBullet cannot open its completion (editor.startCompletion, 2.12.1)");
          await editor.write(context.to, context.to, slashText(context));
          await editor.startCompletion();
        },
      },
    ],
  };
}
