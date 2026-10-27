// The keyboard module: on a touch screen, an action hiding the on-screen
// keyboard with the selection kept as it is (`actions.hideKeyboard`), to see
// more of the page while formatting it; the next tap in the text shows the
// keyboard again (the core's editor API: core/keyboard.ts). Only on a touch
// screen (`touchOnly`): the settings offer it for the favourites for touch
// on any device.
import type { ToolbarModule } from "../core/action.ts";
import { ICONS } from "../icons.ts";

export function keyboardModule(): ToolbarModule {
  return {
    actions: () => [
      {
        id: "actions.hideKeyboard",
        label: "Hide the keyboard",
        icon: ICONS.keyboardHide,
        group: "Keyboard",
        keywords: ["close", "dismiss", "klávesnice", "schovat"],
        touchOnly: true,
        perform: (_context, editor) => editor.hideKeyboard(),
      },
    ],
  };
}
