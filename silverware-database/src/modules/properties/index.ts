// The properties module: a database's schema changed from where it is shown
// (Properties in every place's menu, its slot `data`), in its dialog.
import type { ModuleDefinition } from "../../core/module.ts";
import { svg } from "../../views/icons.ts";
import { PropertiesDialog } from "./dialog.ts";

// Its entry's icon: a list of properties
const PROPERTIES_ICON = svg('<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.75" cy="4" r=".75"/><circle cx="2.75" cy="8" r=".75"/><circle cx="2.75" cy="12" r=".75"/>');

/**
 * What the properties module offers the others (`host.offered<PropertiesOffer>("properties")`): its dialog opened
 * at a property (its details shown) or at the field adding one; the peek's way to edit the schema where an item is
 */
export type PropertiesOffer = {
  /** Its dialog opened; told once it is closed (the caller then puts the focus back on what opened it) */
  open(database: string, at?: { readonly property?: string; readonly add?: boolean }): Promise<void>;
};

export const PROPERTIES_MODULE: ModuleDefinition = {
  name: "properties",
  label: "Properties",
  description: "A Properties button beside every database: add properties, change their label, key, type, a select's options, read only and order, remove them. A change of the items' values is shown first.",
  start(host) {
    // One dialog a database: Properties pressed again while it is open opens no second one
    const dialogs = new Map<string, PropertiesDialog>();
    const dialogOf = (id: string) => dialogs.get(id) ?? dialogs.set(id, new PropertiesDialog(host, id, () => host.refreshPlaces())).get(id)!;
    host.offer({ open: (database, at) => dialogOf(database).open(at) } satisfies PropertiesOffer);
    return {
      // A place drawn anew (a change made elsewhere, an Undo): its open dialog follows
      placeDrawn: (place) => void dialogs.get(place.database.id)?.follow(),
      placeMenu: (place, menu) => [menu.slot.data([menu.item({ label: "Properties", icon: PROPERTIES_ICON, hint: "The database's properties", run: () => void dialogOf(place.database.id).open() })])],
      stop: () => {
        for (const dialog of dialogs.values()) dialog.close();
        dialogs.clear();
      },
    };
  },
};
