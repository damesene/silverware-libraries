// The place's own icons, 16 × 16, drawn in the text's color (`currentColor`):
// the plugin's markup, never a page's text; made as the views' are.
import { svg } from "../views/icons.ts";

export const ICONS = {
  filter: svg('<path d="M2.5 3.5h11l-4.25 5v4l-2.5 1v-5z"/>'),
  sort: svg('<path d="M5 2.5v11M2.75 11.25 5 13.5l2.25-2.25M11 13.5v-11M8.75 4.75 11 2.5l2.25 2.25"/>'),
  undo: svg('<path d="M5.5 3.5 2.5 6.5l3 3"/><path d="M2.5 6.5h7a3.5 3.5 0 0 1 0 7H7"/>'),
  more: svg('<circle cx="3.5" cy="8" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="12.5" cy="8" r=".9" fill="currentColor"/>'),
  check: svg('<path d="M3 8.5 6.5 12 13 4.5"/>'),
  chevron: svg('<path d="m6 4 4 4-4 4"/>'),
  up: svg('<path d="M8 13V3M4 7l4-4 4 4"/>'),
  down: svg('<path d="M8 3v10M4 9l4 4 4-4"/>'),
} as const;
