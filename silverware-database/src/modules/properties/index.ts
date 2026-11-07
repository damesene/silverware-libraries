// The properties module: a database's schema changed from where it is shown
// (a Properties button beside every place's tools), in its dialog.
import { el } from "../../../../shared/elements.ts";
import type { ModuleDefinition } from "../../core/module.ts";
import { PropertiesDialog } from "./dialog.ts";

export const PROPERTIES_MODULE: ModuleDefinition = {
  name: "properties",
  label: "Properties",
  description: "A Properties button beside every database: add properties, change their label, key, type, a select's options, read only and order, remove them. A change of the items' values is shown first.",
  start(host) {
    // One dialog a database: Properties pressed again while it is open opens no second one
    const dialogs = new Map<string, PropertiesDialog>();
    const dialogOf = (id: string) => dialogs.get(id) ?? dialogs.set(id, new PropertiesDialog(host, id, () => host.refreshPlaces())).get(id)!;
    return {
      placeTools: (place) => {
        // A place drawn anew (a change made elsewhere, an Undo): its open dialog follows
        void dialogs.get(place.database.id)?.follow();
        return [
          el(place.document, "button", {
            class: "swd-tool swd-properties-button",
            text: "Properties",
            title: "The database's properties",
            run: () => void dialogOf(place.database.id).open(),
          }),
        ];
      },
      stop: () => {
        for (const dialog of dialogs.values()) dialog.close();
        dialogs.clear();
      },
    };
  },
};
