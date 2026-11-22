// The database playground: Silverware Database's core (its sources) over the
// memory store, without SilverBullet. Each database is shown in a place of
// its own, as a code block would show it, with the playground's views
// (database-views.ts) until the built-in ones come (step 5). Kept for the
// visit: a reload starts from the sample.
import { applyLayers } from "../shared/layers.ts";
import { DatabaseCore } from "../silverware-database/src/core/core.ts";
import { Modules } from "../silverware-database/src/core/module.ts";
import { BUILT_IN_MODULES } from "../silverware-database/src/modules/builtin.ts";
import { DatabasePlace } from "../silverware-database/src/core/place.ts";
import { openDeleteDatabase } from "../silverware-database/src/core/deletedatabase.ts";
import { documentsHost, type DocumentsSource } from "../silverware-database/src/core/documents.ts";
import { mediaHost, type MediaSource } from "../silverware-database/src/core/media.ts";
import { mentionsHost } from "../silverware-database/src/core/mentions.ts";
import { ViewRegistry } from "../silverware-database/src/core/views.ts";
import { ranksInOrder } from "../silverware-database/src/domain/rank.ts";
import { TypeRegistry } from "../silverware-database/src/domain/types/registry.ts";
import { calculatingStore, type CalculatingStore } from "../silverware-database/src/core/calculating.ts";
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
// Its items with their formulas' values: what the places and the modules read, as in SilverBullet
let calculated: CalculatingStore;
// The pages a reference may name: the playground has no space of its own
const PAGES: DocumentsSource = { list: () => ["Projects/Alpha", "Projects/Beta", "People/Ada", "People/Linus", "Notes/Weekly"], open: (name) => flash(`Open ${name}`), folderSeparator: "/" };
// The files as the playground has them: a few of the space's (images drawn by their address here), one opened said,
// none uploaded nor deleted (the memory store keeps no folder of files)
const MEDIA: MediaSource = {
  // (A picture made of the file's name: the playground serves no files; wide and tall ones, as the cropping is tried on)
  url: (path) => {
    const [width, height] = path.includes("tall") ? [60, 400] : path.includes("wide") ? [800, 60] : [160, 100];
    const hue = [...path].reduce((sum, one) => sum + one.charCodeAt(0), 0) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="hsl(${hue} 60% 55%)"/><text x="50%" y="50%" font-size="14" text-anchor="middle" fill="white">${path.split("/").pop()}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  },
  open: (target) => flash(`Open ${target}`),
  files: () => ["Photos/sunset.png", "Photos/cat.png", "Photos/wide.png", "Photos/tall.png", "Docs/report.pdf", "Docs/plan.docx"],
};
// The editor as the playground has one: a page opened and a person's mentions said, not shown
const EDITOR = { open: (ref: string) => flash(`Open ${ref}`), openMention: (name: string) => flash(`Where @${name} is mentioned`) };

let places: DatabasePlace[] = [];

/** A database of `count` items in their order by hand, numbers, a select and two formulas (one of each item's own values, one of the whole database's) */
function bigDatabase(count: number): (typeof SAMPLE_DATABASES)[number] {
  const ranks = ranksInOrder(count);
  return {
    database: {
      id: "big",
      name: "Big",
      properties: [
        { key: "qty", label: "Qty", type: "number", params: {}, readonly: false },
        { key: "price", label: "Price", type: "number", params: {}, readonly: false },
        { key: "hours", label: "Hours", type: "number", params: {}, readonly: false },
        { key: "status", label: "Status", type: "select", params: { options: ["Todo", "Doing", "Done"] }, readonly: false },
        { key: "total", label: "Total", type: "formula", params: { formula: "=[@qty]*[@price]", resultType: "number" }, readonly: true },
        { key: "share", label: "Share", type: "formula", params: { formula: "=[@hours]/SUM([hours])" }, readonly: true },
      ],
    },
    items: Array.from({ length: count }, (_, i) => ({ name: `Item ${i}`, values: { qty: (i * 7) % 13, price: (i % 5) + 1, hours: (i % 9) + 1, status: ["Todo", "Doing", "Done"][i % 3]! }, rank: ranks[i] })),
  };
}

function start(): void {
  // The layers its style page lays its elements in, as Silverware Database's init sets them
  applyLayers(document);
  for (const place of places) place.destroy();
  // (`?big=20000`: a database of that many items alone, to measure a large one's views by, Load more's and the formulas')
  const big = Number(new URLSearchParams(location.search).get("big") ?? 0);
  const seeds = big > 0 ? [bigDatabase(big)] : SAMPLE_DATABASES;
  store = new MemoryStore(seeds);
  // (Its store for a measuring script: an item changed as by hand elsewhere, `__bench.store().changeOutside(…)`)
  (window as unknown as { __bench: unknown }).__bench = { store: () => store };
  const types = new TypeRegistry();
  calculated = calculatingStore(store, types);
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
      database: (id) => calculated.database(id),
      schema: (id) => store.database(id),
      items: async (id) => (await calculated.items(id)).value,
      itemBodies: store.capabilities.itemBody,
      body: (id, item) => store.body(id, item.key),
      openDocument: async (item) => flash(`Open ${store.documentOf(item.key) ?? item.name}`),
      ...documentsHost(PAGES, core.noun, ui),
      ...mentionsHost(EDITOR, ui),
      media: mediaHost(MEDIA, store, ui, document),
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
  places = seeds.map(({ database }) => {
    // (The place shows the database's name itself)
    const section = document.createElement("section");
    const element = document.createElement("div");
    element.className = "swd-place";
    section.append(element);
    main.append(section);
    const place = new DatabasePlace({ element, database: database.id, state: new StoredViewState(`silverware-playground.database.state.${database.id}`), store: calculated, core, types, views, settings, ui, editor: EDITOR, documents: PAGES, media: MEDIA, moduleMenu: (where, menu) => modules.placeMenu(where, menu), moduleTools: (where) => modules.placeTools(where), placeDrawn: (where) => modules.placeDrawn(where), openItem: (item, database, from) => modules.openItem(item, database, from), deleteDatabase: (id, name) => openDeleteDatabase({ document, core, noun: core.noun, notify: (message) => flash(message), written: () => places.forEach((one) => void one.render()) }, id, name) });
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
