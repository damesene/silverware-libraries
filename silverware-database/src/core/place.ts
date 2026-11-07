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
import type { Database, Item, Property } from "../model/database.ts";
import type { DatabaseCore } from "./core.ts";
import { drawGrouped } from "./groups.ts";
import { ICONS } from "./icons.ts";
import type { PlaceContext } from "./module.ts";
import { popover } from "./popover.ts";
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
  /** What the modules on add to the place's tools (core/module.ts), asked as the place is drawn */
  readonly moduleTools?: (place: PlaceContext) => readonly Node[];
  /** The block's own text shown to edit (Edit source in ⋯, last), where the place is a block of a document */
  readonly editSource?: () => void;
  /** An item opened by a module's own way (the peek, core/module.ts): whether one took it; else it opens where the store says */
  readonly openItem?: (item: Item, database: string) => boolean;
};

/** The settings' path of a view's setting */
export const viewSettingPath = (view: string, key: string) => `silverware.database.views.${view}.${key}`;

// The database and its items as last read
type Data = { readonly database: Database; readonly items: readonly Item[] };

// A view drawn: its own host, made for it (its name and settings fixed in it), the data it was last given, what it gave back, whether it has gone
type Drawn = { readonly view: ViewDefinition; data: Data; instance: ViewInstance | void; ended: boolean; syncTools?: () => void; stopTools?: () => void; host?: ViewHost; grouped?: string };

/** The property a view is drawn once per group by (Group by picked, of a type it is grouped by, else the first where it always is; none where the view draws its own groups) */
function groupingOf(view: ViewDefinition, host: ViewHost): Property | undefined {
  const groupBy = view.groupBy;
  if (groupBy === false || groupBy?.draws) return undefined;
  const eligible = host.database.properties.filter((one) => !groupBy?.types || groupBy.types.includes(host.type(one).name));
  return eligible.find((one) => one.key === host.listing.group) ?? (groupBy?.required ? eligible[0] : undefined);
}

/** What decides how a view is drawn grouped: the property and its type (changed, the view drawn anew) */
const groupingKey = (view: ViewDefinition, host: ViewHost) => {
  const property = groupingOf(view, host);
  return property ? `${property.key}\u0000${property.type}` : "";
};

// Where each database's view is scrolled, kept as it scrolls: each box the user scrolled (the place's body, any box the
// view draws: a wide table's, a board's) by its place among the elements under the body, a path of child indexes. A view
// drawn anew (a change), or a new place of the same block (the editor drew it anew after a write), has them put back.
const scrolled = new Map<string, Map<string, readonly [number, number]>>();

export class DatabasePlace {
  private drawn: Drawn | undefined;
  private body: HTMLElement | undefined;
  // Drawings one after another: a change while one is drawn waits for it, and changes meanwhile are one refresh
  private drawing: Promise<void> = Promise.resolve();
  private pending: Promise<void> | undefined;
  private readonly stopListening: () => void;
  private gone = false;
  // An undo from this place being written, how far (`of` 0: not told yet), and its Undo shown so as the tools are drawn
  private undoing: { readonly done: number; readonly of: number } | undefined;
  private undoShown: (() => void) | undefined;
  // The view's scroll being put back: its boxes' scroll events then are not the user's
  private puttingBack = false;

  /** The id of the database the place shows */
  get database(): string {
    return this.options.database;
  }

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
      // (Grouped otherwise now: by another property, its type changed, or none: drawn anew)
      if (drawn.host && groupingKey(drawn.view, drawn.host) !== drawn.grouped) return this.draw();
      try {
        drawn.syncTools?.();
        drawn.instance.update();
        this.putScroll();
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
    // The database's name and how many items show, the views' tabs and the tools in one bar under it
    const count = el(doc, "span", { class: "swd-place-count", text: String(data.items.length) });
    element.append(el(doc, "div", "swd-place-head", el(doc, "span", { class: "swd-place-name", text: data.database.name }), count));
    const bar = el(doc, "nav", { class: "swd-place-bar", attrs: { "aria-label": `${data.database.name}: views and tools` } }, this.switcher(doc, on, view?.name));
    element.append(bar);
    this.body = el(doc, "div", "swd-place-body");
    element.append(this.body);
    // (A scroll does not bubble: caught on its way down)
    this.body.addEventListener("scroll", (event) => this.keepScroll(event.target), { capture: true, passive: true });
    if (!view) return this.note(typeof named === "string" ? `No view "${named}" is on here: pick one above` : "No view is on: turn one on in the settings");
    const settings = await this.settingsOf(view);
    if (this.gone) return;
    const drawn: Drawn = { view, data, instance: undefined, ended: false };
    this.drawn = drawn;
    const host = this.host(drawn, settings);
    drawn.host = host;
    const tools = this.tools(doc, host, count, view);
    drawn.syncTools = tools.sync;
    drawn.stopTools = tools.stop;
    bar.append(tools.bar);
    this.body.before(tools.panel);
    try {
      const grouping = groupingOf(view, host);
      drawn.grouped = groupingKey(view, host);
      drawn.instance = grouping ? drawGrouped(view, host, this.body, grouping) : view.render(host, this.body);
    } catch (error) {
      this.note(`The view "${view.label}" failed: ${message(error)}`);
    }
    this.putScroll();
  }

  /** The key a view's scroll is kept by */
  private scrollKey(): string | undefined {
    return this.drawn ? `${this.options.database}\u0000${this.drawn.view.name}` : undefined;
  }

  /** A box's path under the body: its child indexes, from the body down ("" the body itself) */
  private pathOf(box: Element): string | undefined {
    const at: number[] = [];
    for (let one: Element | null = box; one && one !== this.body; one = one.parentElement) {
      if (!one.parentElement) return undefined;
      at.unshift([...one.parentElement.children].indexOf(one));
    }
    return at.join(".");
  }

  private boxAt(path: string): HTMLElement | undefined {
    let one: Element | undefined = this.body;
    for (const index of path ? path.split(".").map(Number) : []) one = one?.children[index];
    return one instanceof HTMLElement ? one : undefined;
  }

  /** Where a box the user scrolled is, kept for the view (a box out of the page is left as kept; not while the view is put back: what it reports then is where it could go, laid out or not) */
  private keepScroll(box: EventTarget | null): void {
    const key = this.scrollKey();
    if (this.puttingBack || !key || !this.body?.isConnected || !(box instanceof HTMLElement) || !this.body.contains(box)) return;
    const path = this.pathOf(box);
    if (path === undefined) return;
    const kept = scrolled.get(key) ?? new Map<string, readonly [number, number]>();
    kept.set(path, [box.scrollLeft, box.scrollTop]);
    scrolled.set(key, kept);
  }

  /** The view's boxes scrolled where they were kept, now and once laid out (a block the editor puts in the page after it is drawn) */
  private putScroll(): void {
    const key = this.scrollKey();
    const kept = key ? scrolled.get(key) : undefined;
    if (!kept) return;
    // (Its own copy: a box scrolled by `put` before it is laid out reports where it could go, kept meanwhile)
    const wanted = [...kept];
    const put = () => {
      if (key !== this.scrollKey()) return;
      for (const [path, [left, top]] of wanted) {
        const box = this.boxAt(path);
        if (!box) continue;
        if (box.scrollLeft !== left) box.scrollLeft = left;
        if (box.scrollTop !== top) box.scrollTop = top;
      }
    };
    const view = this.options.element.ownerDocument.defaultView;
    this.puttingBack = true;
    put();
    view?.requestAnimationFrame(() => {
      put();
      // (The scroll events of what was put back come before the next frame: the user's after it)
      view.requestAnimationFrame(() => (this.puttingBack = false));
    });
    if (!view) this.puttingBack = false;
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

  /** The views' tabs: each its icon and label, the one shown marked; one row, scrolled sideways where it does not fit */
  private switcher(doc: Document, views: readonly ViewDefinition[], current: string | undefined): HTMLElement {
    return el(
      doc,
      "div",
      { class: "swd-tabs", attrs: { role: "group", "aria-label": "Views" } },
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

  /**
   * What every view has beside the tabs, as icons: the view's filter (a
   * condition a property, in a panel under the bar: Silverware Table's filter
   * syntax; how many shown on it), its sort (a menu: a property and its
   * direction, or the order by hand; the property shown on it), Undo of the
   * database's last change, and ⋯ with what the modules add (Properties).
   * Kept in the view's own state (`<view>.filter`, `<view>.sort`), as the
   * host's listing keeps them.
   */
  /** The database's last change undone from this place, how far it is shown on its Undo (one at a time) */
  private async undo(host: ViewHost): Promise<void> {
    if (this.undoing) return;
    this.undoing = { done: 0, of: 0 };
    this.undoShown?.();
    const drawn = this.drawn;
    try {
      await host.undo((done, of) => {
        this.undoing = { done, of };
        this.undoShown?.();
      });
      // (Drawn anew meanwhile: the view the undo was asked from ended, so it showed nothing of it; the one drawn since shows it)
      if (this.drawn !== drawn && !this.gone) await this.refresh();
    } finally {
      this.undoing = undefined;
      this.undoShown?.();
    }
  }

  private tools(doc: Document, host: ViewHost, count: HTMLElement, view: ViewDefinition): { readonly bar: HTMLElement; readonly panel: HTMLElement; readonly sync: () => void; readonly stop: () => void } {
    const { listing, database } = host;
    const columns = [{ key: "name", label: "Name" }, ...database.properties.map((one) => ({ key: one.key, label: one.label }))];
    const labelOf = (key: string) => columns.find((one) => one.key === key)?.label ?? key;
    const filters = () => Object.keys(listing.filter).length;

    const filterButton = el(doc, "button", { class: "swd-tool swd-filter-button", attrs: { "aria-expanded": "false" } });
    const filterLabel = () => {
      const n = filters();
      filterButton.replaceChildren(el(doc, "span", { class: "swd-tool-icon", html: ICONS.filter }), ...(n ? [el(doc, "span", { class: "swd-tool-badge", text: String(n) })] : []));
      filterButton.title = n ? `Filter: ${Object.keys(listing.filter).map(labelOf).join(", ")}` : "Filter";
      filterButton.setAttribute("aria-label", n ? `Filter (${n})` : "Filter");
      filterButton.classList.toggle("swd-tool-on", n > 0);
    };
    filterLabel();
    const panel = el(
      doc,
      "div",
      { class: "swd-filter", attrs: { hidden: "" } },
      ...columns.map((column) => {
        const input = el(doc, "input", { attrs: { type: "text", placeholder: "any", "data-key": column.key, "aria-label": `Filter ${column.label}` } });
        input.value = listing.filter[column.key] ?? "";
        const apply = () => {
          const problem = listing.validateCondition(input.value);
          input.classList.toggle("swd-invalid", !!problem);
          input.title = problem ?? "";
          if (problem || input.value === (listing.filter[column.key] ?? "")) return;
          void listing.setFilter(column.key, input.value).then(filterLabel);
        };
        input.addEventListener("change", apply);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") apply();
        });
        return el(doc, "label", "swd-filter-row", el(doc, "span", { text: column.label }), input);
      }),
    );
    filterButton.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      filterButton.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) panel.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    });

    // The sort: a menu of the order by hand and the properties, each way
    const sortButton = el(doc, "button", { class: "swd-tool swd-sort-button" });
    const sortLabel = () => {
      const now = listing.sort[0];
      sortButton.replaceChildren(el(doc, "span", { class: "swd-tool-icon", html: now ? (now.direction === "desc" ? ICONS.down : ICONS.up) : ICONS.sort }), ...(now ? [el(doc, "span", { class: "swd-tool-text", text: labelOf(now.key) })] : []));
      sortButton.title = now ? `Sorted by ${labelOf(now.key)}, ${now.direction === "desc" ? "descending" : "ascending"}` : "Sort (now in the order by hand)";
      sortButton.setAttribute("aria-label", sortButton.title);
      sortButton.classList.toggle("swd-tool-on", !!now);
    };
    sortLabel();
    const sort = popover(doc, sortButton, "Sort", (menu, close) => {
      const now = listing.sort[0];
      const choose = (key: string, direction: "asc" | "desc") => {
        close();
        void listing.setSort(key ? [{ key, direction }] : []).then(sortLabel);
      };
      const on = (key: string) => (now?.key ?? "") === key;
      const option = (key: string, label: string) =>
        el(
          doc,
          "button",
          { class: "swd-menu-item swd-sort-option", attrs: { "aria-pressed": pressed(on(key)), "data-key": key }, run: () => choose(key, key && now?.key === key ? now.direction : "asc") },
          el(doc, "span", { class: "swd-menu-check", html: on(key) ? ICONS.check : "" }),
          label,
        );
      const way = (direction: "asc" | "desc", label: string) =>
        el(doc, "button", { class: `swd-menu-way swd-sort-${direction}`, text: label, attrs: { "aria-pressed": pressed(now?.direction === direction), ...(now ? {} : { disabled: "" }) }, run: () => now && choose(now.key, direction) });
      menu.replaceChildren(option("", "Order by hand"), el(doc, "div", { class: "swd-menu-line", attrs: { "aria-hidden": "true" } }), ...columns.map((column) => option(column.key, column.label)), el(doc, "div", "swd-menu-ways", way("asc", "Ascending"), way("desc", "Descending")));
    });

    // Undo, and how far it is while it writes (many pages: one after another), kept by the place as it is drawn anew meanwhile
    const undoText = el(doc, "span", { class: "swd-tool-text swd-undo-progress" });
    const undo = el(doc, "button", { class: "swd-tool swd-undo", title: "Undo this database's last change", attrs: { "aria-label": "Undo this database's last change" }, run: () => void this.undo(host) }, el(doc, "span", { class: "swd-tool-icon", html: ICONS.undo }), undoText);
    this.undoShown = () => {
      const at = this.undoing;
      undo.setAttribute("aria-busy", String(!!at));
      undoText.hidden = !at?.of;
      undoText.textContent = at?.of ? `${at.done.toLocaleString("en-US")} / ${at.of.toLocaleString("en-US")}` : "";
      undo.title = at ? "Undoing: keep this page open until it is done" : "Undo this database's last change";
    };
    this.undoShown();

    // ⋯: Group by where the view groups (the properties of the types it groups by, the one it does checked), then what the
    // modules add (Properties) and Edit source, as items of a menu
    const { editSource } = this.options;
    const own = [
      ...(this.options.moduleTools?.({ document: doc, database }) ?? []),
      ...(editSource ? [el(doc, "button", { class: "swd-tool swd-edit-source", text: "Edit source", title: "Show the block's text, to edit it as markdown", run: editSource })] : []),
    ];
    const groupBy = view.groupBy === false ? undefined : (view.groupBy ?? {});
    const grouping = (): HTMLElement[] => {
      if (!groupBy) return [];
      const eligible = database.properties.filter((property) => !groupBy.types || groupBy.types.includes(host.type(property).name));
      const kept = eligible.find((property) => property.key === listing.group);
      const current = kept?.key ?? (groupBy.required ? eligible[0]?.key : undefined);
      const option = (key: string | undefined, label: string) =>
        el(
          doc,
          "button",
          { class: "swd-menu-item swd-group-option", attrs: { "aria-pressed": pressed(current === key), "data-key": key ?? "" }, run: () => void listing.setGroup(key) },
          el(doc, "span", { class: "swd-menu-check", html: current === key ? ICONS.check : "" }),
          label,
        );
      return [
        el(doc, "div", { class: "swd-menu-heading", text: "Group by" }),
        ...(groupBy.required ? [] : [option(undefined, "None")]),
        ...eligible.map((property) => option(property.key, property.label)),
        ...(eligible.length ? [] : [el(doc, "p", { class: "swd-menu-note", text: "No property of a type this view groups by" })]),
        ...(own.length ? [el(doc, "div", { class: "swd-menu-line", attrs: { "aria-hidden": "true" } })] : []),
      ];
    };
    // (A choice closes it, the popover's own; what it opens, a dialog, is the module's)
    const more = own.length || groupBy ? popover(doc, el(doc, "button", { class: "swd-tool swd-more", title: "More", attrs: { "aria-label": "More" } }, el(doc, "span", { class: "swd-tool-icon", html: ICONS.more })), "More", (menu) => menu.replaceChildren(...grouping(), ...own)) : undefined;

    // The controls as the view's state has them now (a header's sort, a filter set by the view itself), and how many items show
    const sync = () => {
      sortLabel();
      filterLabel();
      count.textContent = host.items.length === host.total ? String(host.total) : `${host.items.length} of ${host.total}`;
      for (const input of panel.querySelectorAll<HTMLInputElement>("input[data-key]")) {
        if (doc.activeElement === input) continue;
        input.value = listing.filter[input.dataset.key!] ?? "";
        // (What it shows now is the condition kept, which reads: a mark of one typed before goes)
        input.classList.remove("swd-invalid");
        input.title = "";
      }
    };
    sync();
    // The place drawn anew: what is open closed, its listeners with it
    const stop = () => {
      sort.close();
      more?.close();
    };
    return { bar: el(doc, "span", "swd-tools", filterButton, sort.box, undo, ...(more ? [more.box] : [])), panel, sync, stop };
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
    const group = () => {
      const kept = state.get(prefixed("groupBy"));
      return typeof kept === "string" && kept ? kept : undefined;
    };
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
        get group() {
          return group();
        },
        async setGroup(key) {
          if (key === group()) return;
          await setMeta({ groupBy: key });
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
      undo: (progress) => refreshed(core.undo(id, progress)),
      open: async (item) => {
        if (this.options.openItem?.(item, id)) return;
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
      refresh: shownAgain,
      notify: (text) => ui.notify(text, { type: "error" }),
    };
  }

  private endView(): void {
    const drawn = this.drawn;
    this.drawn = undefined;
    if (!drawn) return;
    drawn.ended = true;
    drawn.stopTools?.();
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
