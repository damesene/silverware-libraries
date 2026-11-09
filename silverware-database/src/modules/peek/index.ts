// The peek module: an item a view opens (its name, its ↗) shown in a panel
// beside the document instead of its page (docs/silverware-database.md,
// *peek*); its page still one press away (*Open*). Off: items open their page.
import type { ModuleDefinition } from "../../core/module.ts";
import { PeekPanel } from "./panel.ts";

export const PEEK_MODULE: ModuleDefinition = {
  name: "peek",
  label: "Peek",
  description: "An item opened from a view shows in a panel beside the editor: its name, its properties and its content edited there, the item itself one press away (Open). Off: an item opens where it is kept.",
  settings: [{ key: "width", label: "Width", hint: "The panel's width in pixels, for every database (its left edge dragged sets it too; at most most of the editor's area)", control: "number", default: 600 }],
  start(host) {
    const panel = new PeekPanel(host);
    const stops = [
      host.onChanged(() => void panel.follow()),
      // Another page opened: the panel closed (what is typed written first; a body kept stays, as for any press beside)
      host.onDocumentOpened(() => void panel.close()),
    ];
    return {
      // A place drawn anew (a schema changed, its properties' dialog): the panel follows (a store may tell only of changes made elsewhere)
      placeDrawn: () => void panel.follow(),
      openItem: (item, database) => {
        void panel.show(item, database);
        return true;
      },
      stop: () => {
        for (const stop of stops) stop();
        panel.stop();
      },
    };
  },
};
