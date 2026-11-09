// The full screen module: a place shown over the whole window, as Silverware
// Table's fullScreen module shows a table: an icon among the place's tools
// (Full screen / Exit full screen), Esc ending it too, which the place's own
// core does (it lays itself over the window: core/place.ts). Off: no icon.
import type { ModuleDefinition } from "../../core/module.ts";
import { VIEW_ICONS } from "../../views/icons.ts";

export const FULLSCREEN_MODULE: ModuleDefinition = {
  name: "fullscreen",
  label: "Full screen",
  description: "An icon among a database's tools shows it over the whole window, its views and tools as they are; the same icon or Esc puts it back in its page.",
  start: () => ({
    placeTools: (place) => [
      {
        key: "fullscreen",
        icon: place.overWindow ? VIEW_ICONS.exitFullScreen : VIEW_ICONS.fullScreen,
        label: place.overWindow ? "Exit full screen (Esc)" : "Full screen",
        pressed: place.overWindow,
        run: () => place.setOverWindow(!place.overWindow),
      },
    ],
  }),
};
