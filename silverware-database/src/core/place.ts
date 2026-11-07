// A place where a database is shown (in SilverBullet a code block): the view
// its state names drawn into its element, a switcher of the views on above
// it, the view told as the database changes (the store's `onChanged`, the
// core's writes), the view's own data (its meta) kept in the place's state
// under its name. What makes a place and when it goes is the binding's
// (docs/silverware-database.md, *The core*).
import { el, pressed } from "../../../shared/elements.ts";
import type { Editor, Settings, UserInterface } from "../../../shared/platform.ts";
import { type Filter, listItems, type SortKey, textOf, typeOf, validateCondition } from "../domain/listing.ts";
import type { TypeRegistry } from "../domain/types/registry.ts";
import type { Database, Item } from "../model/database.ts";
import type { DatabaseCore } from "./core.ts";
import type { DatabaseStore, ViewStateStore } from "./store.ts";
import type { ViewDefinition, ViewHost, ViewInstance } from "./view.ts";
import type { ViewRegistry } from "./views.ts";

/** The place's own key in its state: the view shown (the views' keys are `<view>.<key>`) */
export const VIEW_KEY = "view";

export type PlaceOptions = {
  readonly element: HTMLElement;
  readonly database: string;
  readonly state: ViewStateStore;
  readonly store: DatabaseStore;
  readonly core: DatabaseCore;
  readonly types: TypeRegistry;
  readonly views: ViewRegistry;
  readonly settings: Pick<Settings, "get">;
  readonly ui: Pick<UserInterface, "notify">;
  readonly editor?: Pick<Editor, "open">;
};

/** The settings' path of a view's setting */
export const viewSettingPath = (view: string, key: string) => `silverware.database.views.${view}.${key}`;

// The database and its items as last read
type Data = { readonly database: Database; readonly items: readonly Item[] };

// A view drawn: its own host, made for it (its name and settings fixed in it), the data it was last given, what it gave back, whether it has gone
type Drawn = { readonly view: ViewDefinition; data: Data; instance: ViewInstance | void; ended: boolean };

export class DatabasePlace {
  private drawn: Drawn | undefined;
  private body: HTMLElement | undefined;
  // Drawings one after another: a change while one is drawn waits for it, and changes meanwhile are one refresh
  private drawing: Promise<void> = Promise.resolve();
  private pending: Promise<void> | undefined;
  private readonly stopListening: () => void;
  private gone = false;

  constructor(private readonly options: PlaceOptions) {
    this.stopListening = options.store.onChanged((change) => {
      if (change.database === options.database) void this.refresh();
    });
  }

  /** The place drawn whole: the switcher and the view its state names */
  render(): Promise<void> {
    return this.queue(() => this.draw());
  }

  /** The data read anew: the view told (`update`), or drawn anew where it has none; asked again before it starts, one refresh */
  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    const pending = this.queue(async () => {
      this.pending = undefined;
      const drawn = this.drawn;
      if (!drawn?.instance?.update) return this.draw();
      const data = await this.read();
      if (this.gone || drawn !== this.drawn) return;
      if (!data) return this.draw();
      drawn.data = data;
      try {
        drawn.instance.update();
      } catch (error) {
        this.note(`The view "${drawn.view.label}" failed: ${message(error)}`);
      }
    });
    this.pending = pending;
    return pending;
  }

  /** The place gone: its view told, nothing listened to any more, nothing drawn after */
  destroy(): void {
    this.gone = true;
    this.stopListening();
    this.endView();
  }

  private queue(work: () => Promise<void>): Promise<void> {
    this.drawing = this.drawing.then(() => (this.gone ? undefined : work())).catch((error: unknown) => this.note(`The database could not be shown: ${message(error)}`));
    return this.drawing;
  }

  private async draw(): Promise<void> {
    const { element, state } = this.options;
    const doc = element.ownerDocument;
    this.endView();
    this.body = undefined;
    const data = await this.read();
    const on = await this.viewsOn();
    if (this.gone) return;
    element.replaceChildren();
    if (!data) return this.note(`No database "${this.options.database}"`);
    const named = state.get(VIEW_KEY);
    const view = typeof named === "string" ? on.find((one) => one.name === named) : on[0];
    element.append(this.switcher(doc, on, view?.name));
    this.body = el(doc, "div", "swd-place-body");
    element.append(this.body);
    if (!view) return this.note(typeof named === "string" ? `No view "${named}" is on here: pick one above` : "No view is on: turn one on in the settings");
    const settings = await this.settingsOf(view);
    if (this.gone) return;
    const drawn: Drawn = { view, data, instance: undefined, ended: false };
    this.drawn = drawn;
    try {
      drawn.instance = view.render(this.host(drawn, settings), this.body);
    } catch (error) {
      this.note(`The view "${view.label}" failed: ${message(error)}`);
    }
  }

  private async read(): Promise<Data | undefined> {
    const { store, database } = this.options;
    const read = await store.database(database);
    return read && { database: read.value, items: (await store.items(database)).value };
  }

  /** The views registered and on (`silverware.database.views.<view>.enabled`) */
  private async viewsOn(): Promise<ViewDefinition[]> {
    const on: ViewDefinition[] = [];
    for (const view of this.options.views.all()) if ((await this.options.settings.get(viewSettingPath(view.name, "enabled"), true)) !== false) on.push(view);
    return on;
  }

  private async settingsOf(view: ViewDefinition): Promise<ReadonlyMap<string, unknown>> {
    const values = new Map<string, unknown>();
    for (const setting of view.settings ?? []) values.set(setting.key, await this.options.settings.get(viewSettingPath(view.name, setting.key), setting.default));
    return values;
  }

  private switcher(doc: Document, views: readonly ViewDefinition[], current: string | undefined): HTMLElement {
    return el(
      doc,
      "nav",
      { class: "swd-place-bar", attrs: { "aria-label": "Views" } },
      ...views.map((view) =>
        el(
          doc,
          "button",
          { class: "swd-switch", title: view.label, attrs: { "aria-pressed": pressed(view.name === current), "data-view": view.name }, run: () => void this.show(view.name) },
          el(doc, "span", { class: "swd-switch-icon", html: view.icon, attrs: { "aria-hidden": "true" } }),
          el(doc, "span", { class: "swd-switch-label", text: view.label }),
        ),
      ),
    );
  }

  /** Another view picked: written into the place's state, drawn */
  private async show(name: string): Promise<void> {
    if (this.drawn && !this.drawn.ended && this.drawn.view.name === name) return;
    await this.options.state.set({ [VIEW_KEY]: name });
    await this.render();
  }

  /**
   * The host made for one view drawn: its name and settings fixed in it, so a
   * view gone (a save it put off, a drag ending after a switch) still writes
   * its own meta, never another's; what it reads of the data is read live, so
   * a view told `update` reads the data as it is now. The core's writes go
   * through whether it is shown or not: an edit is never lost.
   */
  private host(drawn: Drawn, settings: ReadonlyMap<string, unknown>): ViewHost {
    const { core, types, database: id, state, store, editor, ui } = this.options;
    const place = this;
    // The data this view was last given: a view gone reads what it had, never what another drawing found (none, maybe)
    const data = () => drawn.data;
    const prefixed = (key: string) => `${drawn.view.name}.${key}`;
    const listing = () => ({ filter: filterOf(state.get(prefixed("filter"))), sort: sortOf(state.get(prefixed("sort"))) });
    // The items as listed, made once per data read and listing
    let listed: { data: Data; key: string; items: readonly Item[] } | undefined;
    const items = () => {
      const now = listing();
      const key = JSON.stringify(now);
      if (listed?.data !== data() || listed.key !== key) listed = { data: data(), key, items: listItems(data().items, data().database, types, now) };
      return listed.items;
    };
    // Shown anew where this view is still the one shown
    const shownAgain = () => (drawn.ended ? Promise.resolve() : place.refresh());
    // A write through the core shows at once, whether the store tells it or not
    const refreshed = async <T>(result: Promise<T>): Promise<T> => {
      const done = await result;
      await shownAgain();
      return done;
    };
    const setMeta = (values: Readonly<Record<string, unknown>>) => state.set(Object.fromEntries(Object.entries(values).map(([key, value]) => [prefixed(key), value])));
    return {
      document: this.options.element.ownerDocument,
      get database() {
        return data().database;
      },
      get items() {
        return items();
      },
      get total() {
        return data().items.length;
      },
      listing: {
        get filter() {
          return listing().filter;
        },
        get sort() {
          return listing().sort;
        },
        async setFilter(key, condition) {
          const filter: Record<string, string> = { ...listing().filter };
          if (condition?.trim()) filter[key] = condition;
          else delete filter[key];
          // The same filter again writes nothing and draws nothing (a view setting it as it draws would draw itself forever)
          if (JSON.stringify(filter) === JSON.stringify(listing().filter)) return;
          await setMeta({ filter: Object.keys(filter).length ? filter : undefined });
          await shownAgain();
        },
        async setSort(sort) {
          if (JSON.stringify(sort) === JSON.stringify(listing().sort)) return;
          await setMeta({ sort: sort.length ? sort : undefined });
          await shownAgain();
        },
        validateCondition,
      },
      type: (property) => typeOf(types, property),
      text: (item, key) => textOf(item, key, data().database, types),
      update: (item, key, value) => refreshed(core.update(id, item, key, value)),
      create: (draft, where) => refreshed(core.create(id, draft, where)),
      rename: (item, name) => refreshed(core.rename(id, item, name)),
      remove: (items) => refreshed(core.remove(id, items)),
      move: (item, where) => refreshed(core.move(id, item, where)),
      undo: () => refreshed(core.undo(id)),
      open: async (item) => {
        const document = store.documentOf(item.key);
        if (!document || !editor?.open) return;
        try {
          await editor.open(document);
        } catch (error) {
          ui.notify(`"${item.name}" could not be opened: ${message(error)}`, { type: "error" });
        }
      },
      getMeta: (key) => state.get(prefixed(key)),
      setMeta,
      setting: (key) => settings.get(key),
    };
  }

  private endView(): void {
    const drawn = this.drawn;
    this.drawn = undefined;
    if (!drawn) return;
    drawn.ended = true;
    // What it drew stays until the place is drawn anew, taking no presses meanwhile: its writes would go on, unseen
    this.body?.setAttribute("inert", "");
    try {
      drawn.instance?.destroy?.();
    } catch {
      // A view failing as it goes takes nothing else down
    }
  }

  private note(text: string): void {
    const doc = this.options.element.ownerDocument;
    (this.body ?? this.options.element).append(el(doc, "p", { class: "swd-place-note", text }));
  }
}

/** A view's filter as kept: conditions by key (anything else none) */
function filterOf(value: unknown): Filter {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** A view's sort as kept: keys and directions (anything else none) */
function sortOf(value: unknown): readonly SortKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter((one): one is SortKey => !!one && typeof one.key === "string" && (one.direction === "asc" || one.direction === "desc"));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
