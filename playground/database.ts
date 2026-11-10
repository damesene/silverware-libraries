// The database playground: Silverware Database's core (its sources) over the
// memory store, without SilverBullet. Each database is shown in a place of
// its own, as a code block would show it, with the playground's views
// (database-views.ts) until the built-in ones come (step 5). Kept for the
// visit: a reload starts from the sample.
import { DatabaseCore } from "../silverware-database/src/core/core.ts";
import { Modules } from "../silverware-database/src/core/module.ts";
import { BUILT_IN_MODULES } from "../silverware-database/src/modules/builtin.ts";
import { DatabasePlace } from "../silverware-database/src/core/place.ts";
import { openDeleteDatabase } from "../silverware-database/src/core/deletedatabase.ts";
import { documentsHost, type DocumentsSource } from "../silverware-database/src/core/documents.ts";
import { mentionsHost } from "../silverware-database/src/core/mentions.ts";
import { ViewRegistry } from "../silverware-database/src/core/views.ts";
import { TypeRegistry } from "../silverware-database/src/domain/types/registry.ts";
import { MemoryStore } from "../silverware-database/src/store/memory.ts";
import { MemoryViewState } from "../silverware-database/src/store/viewstate.ts";

import stylePage from "../silverware-database/silverware-database-style.md";
// Silverware Icons beside it, as a space with both installed: its API given, its style applied
import iconsStylePage from "../silverware-icons/silverware-icons-style.md";
import { api as icons } from "../silverware-icons/src/index.ts";
import { flash, setUpTheme } from "./common.ts";
import { SAMPLE_DATABASES } from "./database-sample.ts";
import { BUILT_IN_VIEWS } from "../silverware-database/src/views/builtin/index.ts";
import { DEBUG_VIEWS } from "./database-views.ts";

/** A place's state kept in the browser (as SilverBullet keeps it in the block's text): the view picked, its filter and sort, after a reload */
class StoredViewState extends MemoryViewState {
  constructor(private readonly storageKey: string) {
    let kept: Record<string, unknown> = {};
    try {
      kept = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, unknown>;
    } catch {
      // (Not kept, or not readable: the defaults)
    }
    super(kept);
  }

  override async set(values: Readonly<Record<string, unknown>>): Promise<void> {
    await super.set(values);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(Object.fromEntries(this.keys().map((key) => [key, this.get(key)]))));
    } catch {
      // (The browser keeps nothing: kept for this visit only)
    }
  }
}

setUpTheme();

// The library's style page applied as SilverBullet applies its space-style block
const style = document.createElement("style");
style.textContent = [stylePage, iconsStylePage].map((page) => /```space-style\r?\n([\s\S]*?)```/.exec(page)?.[1] ?? "").join("\n");
document.head.append(style);

const ui = {
  icons,
  notify: (message: string, options?: { readonly type?: "info" | "error" }) => flash(message, options?.type ?? "info"),
  ask: (message: string) => confirm(message),
};
// The views' settings, as SilverBullet's config would give them
const settings = { get: (_path: string, fallback: unknown) => fallback };

let store: MemoryStore;
// The pages a reference may name: the playground has no space of its own
const PAGES: DocumentsSource = { list: () => ["Projects/Alpha", "Projects/Beta", "People/Ada", "People/Linus", "Notes/Weekly"], open: (name) => flash(`Open ${name}`), folderSeparator: "/" };
// The editor as the playground has one: a page opened and a person's mentions said, not shown
const EDITOR = { open: (ref: string) => flash(`Open ${ref}`), openMention: (name: string) => flash(`Where @${name} is mentioned`) };

let places: DatabasePlace[] = [];

function start(): void {
  for (const place of places) place.destroy();
  store = new MemoryStore(SAMPLE_DATABASES);
  const types = new TypeRegistry();
  // (The playground's items stand for pages, as SilverBullet's)
  const core = new DatabaseCore(store, types, ui, { one: "page", many: "pages" });
  // The built-in views, and the playground's own after them (the raw data a view gets)
  const views = new ViewRegistry([...BUILT_IN_VIEWS, ...DEBUG_VIEWS.filter((view) => view.name === "raw")]);
  const modules = new Modules(
    BUILT_IN_MODULES,
    {
      document,
      icons,
      core,
      types,
      ui,
      database: (id) => store.database(id),
      items: async (id) => (await store.items(id)).value,
      itemBodies: store.capabilities.itemBody,
      body: (id, item) => store.body(id, item.key),
      openDocument: async (item) => flash(`Open ${store.documentOf(item.key) ?? item.name}`),
      ...documentsHost(PAGES, core.noun, ui),
      ...mentionsHost(EDITOR, ui),
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
    // (The place shows the database's name itself)
    const section = document.createElement("section");
    const element = document.createElement("div");
    element.className = "swd-place";
    section.append(element);
    main.append(section);
    const place = new DatabasePlace({ element, database: database.id, state: new StoredViewState(`silverware-playground.database.state.${database.id}`), store, core, types, views, settings, ui, editor: EDITOR, documents: PAGES, moduleMenu: (where, menu) => modules.placeMenu(where, menu), moduleTools: (where) => modules.placeTools(where), placeDrawn: (where) => modules.placeDrawn(where), openItem: (item, database, from) => modules.openItem(item, database, from), deleteDatabase: (id, name) => openDeleteDatabase({ document, core, noun: core.noun, notify: (message) => flash(message), written: () => places.forEach((one) => void one.render()) }, id, name) });
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
