// The core's action switching the toolbar a way of working shows (`actions.switchToolbar`): with a parameter
// `toolbar` (a favourite's `args`) it switches to that one at once; without, it offers every toolbar to pick from,
// the one shown on. Made by the controller from its toolbars (and run by it), and by the settings dialog from the
// toolbars it edits (to offer and name them, nothing run), so both offer the same.
import { ICONS } from "../icons.ts";
import type { Action } from "./action.ts";
import { SWITCH_ID, type Toolbar } from "./toolbars.ts";

/** The switch of toolbars over these toolbars; `current`: the one on (none: none checked); `switchTo` run with a toolbar's name */
export function switchToolbarAction(toolbars: readonly Toolbar[], current: Toolbar | undefined, switchTo: (name: string) => void): Action {
  return {
    id: SWITCH_ID,
    label: "Toolbar",
    icon: ICONS.toolbars,
    group: "Silverware Toolbar",
    keywords: ["switch", "toolbars", "change", "favorites"],
    params: [{ key: "toolbar", label: "Toolbar", refersTo: "toolbar", choices: () => toolbars.map((toolbar) => ({ value: toolbar.name, label: toolbar.name })) }],
    describe: (args) => args.toolbar,
    // With a toolbar given (`withArgs`, which drops the choices) it runs: that one; without, the bar, the popup and
    // their search offer its choices, as for any action that has them, and never run it
    active: (_context, args) => !!args.toolbar && args.toolbar === current?.name,
    perform: (_context, _editor, args) => {
      if (args.toolbar) switchTo(args.toolbar);
    },
    choices: toolbars.map((toolbar) => ({
      id: `${SWITCH_ID}.${toolbar.name}`,
      label: toolbar.name,
      icon: ICONS.toolbars,
      group: "Toolbar",
      keywords: ["switch", "toolbar"],
      active: () => toolbar === current,
      perform: () => switchTo(toolbar.name),
    })),
  };
}
