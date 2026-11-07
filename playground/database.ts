// The database playground: Silverware Database's core (its sources) over the
// memory store, without SilverBullet. Each database is shown in a place of
// its own, as a code block would show it, with the playground's views
// (database-views.ts) until the built-in ones come (step 5). Kept for the
// visit: a reload starts from the sample.
import { DatabaseCore } from "../silverware-database/src/core/core.ts";
import { DatabasePlace } from "../silverware-database/src/core/place.ts";
import { ViewRegistry } from "../silverware-database/src/core/views.ts";
import { TypeRegistry } from "../silverware-database/src/domain/types/registry.ts";
import { MemoryStore } from "../silverware-database/src/store/memory.ts";
import { MemoryViewState } from "../silverware-database/src/store/viewstate.ts";
import { flash, setUpTheme } from "./common.ts";
import { SAMPLE_DATABASES } from "./database-sample.ts";
import { DEBUG_VIEWS } from "./database-views.ts";

setUpTheme();

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
  const views = new ViewRegistry(DEBUG_VIEWS);
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
    const place = new DatabasePlace({ element, database: database.id, state: new MemoryViewState(), store, core, types, views, settings, ui, editor: { open: (ref) => flash(`Open ${ref}`) } });
    void place.render();
    return place;
  });
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
