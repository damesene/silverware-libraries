// The database playground: Silverware Database's core (its sources) over the
// memory store, without SilverBullet. Each database is shown in a place of
// its own, as a code block would show it, with the playground's views
// (database-views.ts) until the built-in ones come (step 5). Kept for the
// visit: a reload starts from the sample.
import { DatabaseCore } from "../silverware-database/src/core/core.ts";
import { Modules } from "../silverware-database/src/core/module.ts";
import { BUILT_IN_MODULES } from "../silverware-database/src/modules/builtin.ts";
import { DatabasePlace } from "../silverware-database/src/core/place.ts";
import { ViewRegistry } from "../silverware-database/src/core/views.ts";
import { TypeRegistry } from "../silverware-database/src/domain/types/registry.ts";
import { MemoryStore } from "../silverware-database/src/store/memory.ts";
import { MemoryViewState } from "../silverware-database/src/store/viewstate.ts";
import stylePage from "../silverware-database/silverware-database-style.md";
import { flash, setUpTheme } from "./common.ts";
import { SAMPLE_DATABASES } from "./database-sample.ts";
import { BUILT_IN_VIEWS } from "../silverware-database/src/views/builtin/index.ts";
import { DEBUG_VIEWS } from "./database-views.ts";

setUpTheme();

// The library's style page applied as SilverBullet applies its space-style block
const style = document.createElement("style");
style.textContent = /```space-style\r?\n([\s\S]*?)```/.exec(stylePage)?.[1] ?? "";
document.head.append(style);

const ui = {
  notify: (message: string, options?: { readonly type?: "info" | "error" }) => flash(message, options?.type ?? "info"),
  ask: (message: string) => confirm(message),
};
// The views' settings, as SilverBullet's config would give them
const settings = { get: (_path: string, fallback: unknown) => fallback };

let store: MemoryStore;
let places: DatabasePlace[] = [];

function start(): void {
  for (const place of places) place.destroy();
  store = new MemoryStore(SAMPLE_DATABASES);
  const types = new TypeRegistry();
  const core = new DatabaseCore(store, types, ui);
  // The built-in views, and the playground's own after them (the raw data a view gets)
  const views = new ViewRegistry([...BUILT_IN_VIEWS, ...DEBUG_VIEWS.filter((view) => view.name === "raw")]);
  const modules = new Modules(
    BUILT_IN_MODULES,
    {
      document,
      core,
      types,
      ui,
      database: (id) => store.database(id),
      items: async (id) => (await store.items(id)).value,
      itemBodies: store.capabilities.itemBody,
      body: (id, item) => store.body(id, item.key),
      openDocument: async (item) => flash(`Open ${store.documentOf(item.key) ?? item.name}`),
      // (The playground's page has no editor apart: the window)
      editorArea: () => undefined,
      onChanged: (listener) => store.onChanged((change) => listener(change.database)),
      // (The playground's page is never left)
      onDocumentOpened: () => () => {},
      refreshPlaces: (database) => places.forEach((place) => void (database === undefined ? place.render() : place.database === database && place.refresh())),
    },
    settings,
  );
  const main = document.getElementById("places")!;
  main.replaceChildren();
  places = SAMPLE_DATABASES.map(({ database }) => {
    const section = document.createElement("section");
    const heading = document.createElement("h2");
    heading.textContent = database.name;
    const element = document.createElement("div");
    element.className = "swd-place";
    section.append(heading, element);
    main.append(section);
    const place = new DatabasePlace({ element, database: database.id, state: new MemoryViewState(), store, core, types, views, settings, ui, editor: { open: (ref) => flash(`Open ${ref}`) }, moduleTools: (where) => modules.placeTools(where), openItem: (item, database) => modules.openItem(item, database) });
    return place;
  });
  void modules.start().then(() => places.forEach((place) => void place.render()));
}

// What a page edited by hand is to the pages store: an item's value changed outside the core, the places told
document.getElementById("outside")!.addEventListener("click", async () => {
  const items = (await store.items("tasks")).value;
  const item = items[Math.floor(Math.random() * items.length)];
  if (!item) return;
  const estimate = Math.floor(Math.random() * 10) + 1;
  store.changeOutside("tasks", item.key, { values: { estimate } });
  flash(`Outside the core: ${item.name}'s estimate set to ${estimate}`);
});
document.getElementById("reset")!.addEventListener("click", start);

start();
