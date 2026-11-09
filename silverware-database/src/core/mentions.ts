// Where a person is mentioned, shown as the platform shows a mention pressed
// (SilverBullet: its Mention Inbox on that name): what a person's value
// pressed does (`PropertyType.mentions`), for the views' host and the
// modules' alike. A host without it gives none: the value then not pressed.
import type { Editor, UserInterface } from "../../../shared/platform.ts";

/** What a host offers of mentions (`ViewHost`, `ModuleHost`) */
export type MentionsHost = {
  /** Where a person is mentioned shown (a failure said to the user); none where the platform shows none */
  readonly openMention?: (name: string) => Promise<void>;
};

/** A host's mentions from the platform's editor, a failure said */
export function mentionsHost(editor: Pick<Editor, "openMention"> | undefined, ui: Pick<UserInterface, "notify">): MentionsHost {
  const open = editor?.openMention;
  if (!open) return {};
  return {
    openMention: async (name) => {
      try {
        await open.call(editor, name);
      } catch (error) {
        ui.notify(`Where @${name} is mentioned could not be shown: ${error instanceof Error ? error.message : String(error)}`, { type: "error" });
      }
    },
  };
}
