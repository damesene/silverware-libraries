// A place where a database is shown (in SilverBullet a code block): the view
// its state names drawn into its element, a switcher of the views on above
// it, the view told as the database changes (the store's `onChanged`, the
// core's writes), the view's own data (its meta) kept in the place's state
// under its name. What makes a place and when it goes is the binding's
// (docs/silverware-database.md, *The core*).
import { type Icons, iconsOf, isReference } from "../../../shared/icons.ts";
import { el } from "../../../shared/elements.ts";
import type { Editor, Settings, UserInterface } from "../../../shared/platform.ts";
import { type Filter, listItems, type SortKey, textOf, typeOf, validateCondition } from "../domain/listing.ts";
import type { TypeRegistry } from "../domain/types/registry.ts";
import type { GroupArrangement } from "../domain/grouping.ts";
import type { Database, Item, Property } from "../model/database.ts";
import { type DatabaseCore, isRefused } from "./core.ts";
import { documentsHost, type DocumentsSource } from "./documents.ts";
import { mentionsHost } from "./mentions.ts";
import { arrangedGroups, focusGroupList, type GroupFocus, groupedBy, groupEntry } from "./groupmenu.ts";
import { appliedToViews, type LookOf, type LookPart, type ToAll } from "./applyall.ts";
import { arrangementEntries, groupEntries, hidesByDefault, propertyEntries, STATE_KEYS } from "./statekeys.ts";
import { focusPropertyList, propertiesEntry, type PropertiesFocus } from "./propertiesmenu.ts";
import { drawGrouped } from "./groups.ts";
import { ICONS } from "./icons.ts";
import { type ColorBy, colorable, itemIcon, itemLook, ownIconElement } from "./look.ts";
import type { OpenedFrom, OpenedView, PlaceContext, PlaceTool } from "./module.ts";
import { PlaceOpener } from "./opener.ts";
import type { MenuEntry, MenuNaming } from "../../../shared/menu.ts";
import { checkedGroups, type PlaceMenu, type PlaceMenuBuilder, type PlaceMenuGroup, placeMenu, toolMenu } from "./placemenu.ts";
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
  readonly ui: Pick<UserInterface, "notify" | "icons">;
  readonly editor?: Pick<Editor, "open" | "openMention">;
  /** The documents references name (core/documents.ts); none: no document offered nor opened */
  readonly documents?: DocumentsSource;
  /** What the modules on put in the place's menu (core/module.ts), asked as it opens */
  readonly moduleMenu?: (place: PlaceContext, menu: PlaceMenuBuilder) => readonly PlaceMenuGroup[];
  /** What the modules on put among the place's tools (core/module.ts), asked as it is drawn */
  readonly moduleTools?: (place: PlaceContext) => readonly PlaceTool[];
  /** Told as the place is drawn (anew: a change made elsewhere, an Undo), so what a module shows for it follows */
  readonly placeDrawn?: (place: PlaceContext) => void;
  /** The block's own text shown to edit (Edit source in ⋯), where the place is a block of a document */
  readonly editSource?: () => void;
  /** The database deleted, asked first (Delete database… in ⋯, last), where the host offers it */
  readonly deleteDatabase?: (id: string, name: string) => void;
  /** An item opened by a module's own way (the peek, core/module.ts): whether one took it; else it opens where the store says. `from`: the view it was opened from, followed live */
  readonly openItem?: (item: Item, database: string, from?: OpenedFrom) => boolean;
  /**
   * What the place drawn before for the same block hands over (`handOver`: the
   * binding knows which place wrote the text this one is drawn for), asked once,
   * as the place is first in the page
   */
  readonly takeOver?: () => PlaceKept | undefined;
  /** Shown over the whole window from its first drawing (the place before it for the same block was: no frame in the page between) */
  readonly overWindow?: boolean;
};

/** The settings' path of a view's setting */
export const viewSettingPath = (view: string, key: string) => `silverware.database.views.${view}.${key}`;

// The database and its items as last read
type Data = { readonly database: Database; readonly items: readonly Item[] };

// A view drawn: its own host, made for it (its name and settings fixed in it), the data it was last given, what it gave back, whether it has gone
type Drawn = {
  readonly view: ViewDefinition;
  data: Data;
  instance: ViewInstance | void;
  ended: boolean;
  syncTools?: () => void;
  stopTools?: () => void;
  keptTools?: () => PlaceKept;
  host?: ViewHost;
  grouped?: string;
  // Conditions of the filter being typed, by key ("" none), shown at once and kept only once the field is left: the view
  // filters by them meanwhile, nothing written (a write draws the block anew in SilverBullet, the field going with it, and
  // keys typed before the next one was focused were lost)
  typed?: Record<string, string>;
};

/** The property a view is drawn once per group by (Group by picked, of a type it is grouped by, else the first where it always is; none where the view draws its own groups) */
function groupingOf(view: ViewDefinition, host: ViewHost): Property | undefined {
  return view.groupBy && view.groupBy.draws ? undefined : groupedBy(view, host);
}

/** What decides how a view is drawn grouped: the property and its type, its values lists or not (a select's Multiple turned) (changed, the view drawn anew) */
const groupingKey = (view: ViewDefinition, host: ViewHost) => {
  const property = groupingOf(view, host);
  if (!property) return "";
  const type = host.type(property);
  return `${property.key}\u0000${type.name}\u0000${type.lists === true}`;
};

// Where each database's view is scrolled, kept as it scrolls: each box the user scrolled (the place's body, any box the
// view draws: a wide table's, a board's) by its place among the elements under the body, a path of child indexes. A view
// drawn anew (a change), or a new place of the same block (the editor drew it anew after a write), has them put back.
const scrolled = new Map<string, Map<string, readonly [number, number]>>();


/**
 * What a place has open, handed to the place drawn after it for the same
 * block (SilverBullet draws a block anew, a new place, from the text a place
 * wrote into it; the place itself drawn anew keeps it too): the filter's panel
 * open, the field typed in (its text as typed, which the block may not hold
 * yet, and its selection: read from the field as it is handed over), ⋯ open
 * at Group with the focus in its list
 */
export type PlaceKept = {
  readonly filterOpen: boolean;
  // Shown over the whole window: the place drawn after it for the same block (a write of the block) shown so too
  readonly overWindow?: boolean;
  readonly typing?: { readonly key: string; readonly value: string; readonly start: number; readonly end: number };
  readonly group?: GroupFocus;
  readonly properties?: PropertiesFocus;
  // Where items were opened from: the place drawn after it follows it on (an item's peek marking what the view hides)
  readonly opener?: PlaceOpener;
};

/** Color by in ⋯: the properties of options a view may color its items by, None, the one picked checked */
function colorEntry(host: ViewHost, menu: PlaceMenuBuilder, toAll?: ToAll): MenuEntry {
  const eligible = colorable(host.database.properties, (one) => host.type(one));
  const by = eligible.find((one) => one.key === host.look.colorBy);
  const none = eligible.length ? {} : { disabled: "No property of options (a select, a multi-select)" };
  const option = (key: string | undefined, label: string) => menu.item({ label, checked: by?.key === key, run: () => void host.look.setColorBy(key) });
  return menu.submenu({ label: "Color by", icon: ICONS.color, value: { text: by?.label ?? "None" }, ...none }, () => [
    option(undefined, "None"),
    ...eligible.map((property) => option(property.key, property.label)),
    ...(toAll ? [menu.separator(), menu.item({ label: "Apply to all views", hint: "Every other view of this block colored so", ...toAll })] : []),
  ]);
}

export class DatabasePlace {
  private drawn: Drawn | undefined;
  // What draws its items' and properties' own icons (Silverware Icons, or its stand-in), resolved once
  private readonly icons: Icons;
  // The views on as the place was last drawn (its picker's): those Apply to all views gives to
  private on: readonly ViewDefinition[] = [];
  // The view picker's menu: closed as the place is drawn anew (its box goes, an open menu's listeners with it)
  private picker: PlaceMenu | undefined;
  // A module's tool pressed: focused again once the place is drawn anew (it draws its pressed state so)
  private pressedTool: string | undefined;
  // Shown over the whole window (a module asked: full screen), Esc ending it; its listener while so
  private overWindow = false;
  private stopOverWindow: (() => void) | undefined;
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
  // What it had open handed to the place drawn after it for its block: it writes nothing of its tools any more
  private handedOver = false;
  // Whether it asked the place before it for what that had open (once)
  private tookOver = false;
  // Where its items were opened from (made as the first is), told as the place is drawn or its view's state changes
  private opener: PlaceOpener | undefined;

  /** The id of the database the place shows */
  get database(): string {
    return this.options.database;
  }

  constructor(private readonly options: PlaceOptions) {
    this.icons = iconsOf(options.ui.icons);
    this.stopListening = options.store.onChanged((change) => {
      if (change.database === options.database) void this.refresh();
    });
    if (options.overWindow) this.layOverWindow(true);
  }

  /** Whether it is shown over the whole window (the place drawn after it for the same block shown so from its start) */
  get isOverWindow(): boolean {
    return this.overWindow;
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

  /**
   * What it has open, handed to the place drawn after it for the same block:
   * its tools stopped (a filter typed and not applied yet is the next place's
   * to apply), so it writes nothing of them after
   */
  handOver(): PlaceKept | undefined {
    if (this.handedOver) return undefined;
    const kept = this.drawn?.keptTools?.();
    this.handedOver = true;
    this.drawn?.stopTools?.();
    const opener = this.opener;
    this.opener = undefined;
    if (!kept && !opener && !this.overWindow) return undefined;
    return { filterOpen: false, ...kept, ...(this.overWindow ? { overWindow: true } : {}), ...(opener ? { opener } : {}) };
  }

  /** The place gone: its view told, nothing listened to any more, nothing drawn after */
  destroy(): void {
    // (Its opener keeps the view as it last was, told nothing: SilverBullet lets the place go before the one drawn after it
    // for its block takes the opener over, and an item's peek marked nothing for that moment, then marked it all again)
    const last = this.openedView();
    this.opener?.follow(() => last, { quiet: true });
    this.gone = true;
    this.stopListening();
    this.layOverWindow(false);
    this.endView();
  }

  /** What a module is told of the place: its database, whether it is over the window and the way to put it so */
  private context(doc: Document, database: Database): PlaceContext {
    return { document: doc, database, overWindow: this.overWindow, setOverWindow: (on) => void this.setOverWindow(on) };
  }

  /**
   * The place shown over the whole window (its box laid over it: the style
   * page's `swd-over-window`), or back in its document; drawn anew, so its
   * tools show it. Esc in it ends it, where nothing in it took the key first
   * (a menu, a field's editor: theirs)
   */
  private async setOverWindow(on: boolean): Promise<void> {
    if (on === this.overWindow || this.gone) return;
    this.layOverWindow(on);
    await this.render();
  }

  /**
   * Its element laid over the window or not (the class, and Esc's listener on
   * the document while so: the focus may be on the block's wrapper or the page's
   * body after a press in the place's empty room); Esc a key of the place, or
   * of what holds it, nothing having taken it first (a menu, an editor, a field)
   */
  private layOverWindow(on: boolean): void {
    const { element } = this.options;
    this.overWindow = on;
    element.classList.toggle("swd-over-window", on);
    this.stopOverWindow?.();
    this.stopOverWindow = undefined;
    if (!on) return;
    const doc = element.ownerDocument;
    const escape = (event: KeyboardEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      const ours = !!target && (element.contains(target) || target.contains(element));
      if (event.key !== "Escape" || event.defaultPrevented || !ours) return;
      event.preventDefault();
      void this.setOverWindow(false);
    };
    doc.addEventListener("keydown", escape);
    this.stopOverWindow = () => doc.removeEventListener("keydown", escape);
  }

  private queue(work: () => Promise<void>): Promise<void> {
    this.drawing = this.drawing.then(() => (this.gone ? undefined : work().then(() => this.opener?.changed()))).catch((error: unknown) => this.note(`The database could not be shown: ${message(error)}`));
    return this.drawing;
  }

  private async draw(): Promise<void> {
    const { element, state } = this.options;
    const doc = element.ownerDocument;
    // (Drawn anew itself: what its tools had open shown again)
    const own = this.handedOver ? undefined : this.drawn?.keptTools?.();
    this.endView();
    this.body = undefined;
    const data = await this.read();
    const on = await this.viewsOn();
    if (this.gone) return;
    this.on = on;
    element.replaceChildren();
    if (!data) return this.note(`No database "${this.options.database}"`);
    const named = state.get(VIEW_KEY);
    const view = typeof named === "string" ? on.find((one) => one.name === named) : on[0];
    // One bar: the database's name and how many items show, quietly, then the view shown (its picker), the tools
    // at its end (a note, not a heading: a heading over it is the page's own, written in its markdown)
    const count = el(doc, "span", { class: "swd-place-count", text: String(data.items.length) });
    const head = el(doc, "span", "swd-place-head", el(doc, "span", { class: "swd-place-name", text: data.database.name, title: data.database.name }), count);
    const bar = el(doc, "nav", { class: "swd-place-bar", attrs: { "aria-label": `${data.database.name}: views and tools` } }, head, this.switcher(doc, on, view?.name));
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
    // (A condition being typed shown at once: the view drawn anew by it, nothing written until the field is left)
    const tools = this.tools(doc, host, count, view, (key, condition) => {
      if (drawn.ended) return;
      (drawn.typed ??= {})[key] = condition;
      void this.refresh();
    });
    drawn.syncTools = tools.sync;
    drawn.stopTools = tools.stop;
    drawn.keptTools = tools.kept;
    bar.append(tools.bar);
    this.body.before(tools.panel);
    // (The module's tool pressed has the focus again, drawn anew: the keys go on from there)
    if (this.pressedTool !== undefined) {
      tools.bar.querySelector<HTMLElement>(`.swd-tool[data-tool="${CSS.escape(this.pressedTool)}"]`)?.focus({ preventScroll: true });
      this.pressedTool = undefined;
    }
    if (own) tools.restore(own);
    else if (!this.tookOver && this.options.takeOver) {
      // The place before it for this block: what it had open, once this one is in the page (SilverBullet renders a block twice,
      // one element never put in the page: that one asks nothing)
      this.tookOver = true;
      whenInPage(element, () => {
        if (drawn !== this.drawn || this.gone) return;
        const kept = this.options.takeOver?.();
        if (kept) tools.restore(kept);
        if (kept?.opener) {
          this.opener = kept.opener;
          kept.opener.follow(() => this.openedView());
        }
        if (kept?.overWindow) void this.setOverWindow(true);
      });
    }
    try {
      const grouping = groupingOf(view, host);
      drawn.grouped = groupingKey(view, host);
      drawn.instance = grouping ? drawGrouped(view, host, this.body, grouping) : view.render(host, this.body);
    } catch (error) {
      this.note(`The view "${view.label}" failed: ${message(error)}`);
    }
    this.putScroll();
  }

  /** Where its items are opened from: one for the place, made as the first is */
  private openerOf(): PlaceOpener {
    return (this.opener ??= new PlaceOpener(() => this.openedView()));
  }

  /** The view shown, as an item opened from it sees it (its label, the properties it hides); none where none is drawn */
  private openedView(): OpenedView | undefined {
    const drawn = this.drawn;
    if (this.gone || !drawn?.host || drawn.ended) return undefined;
    return { label: drawn.view.label, hidden: drawn.host.look.hiddenProperties };
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
    // (A box whose scroll its view keeps itself, its own way: marked so)
    if (box.hasAttribute("data-own-scroll")) return;
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

  /**
   * A part of how `view` shows its items (its host's now) given to every other
   * view on in this place (as its picker offers them), as each keeps it and where it takes it
   * (core/applyall.ts), in one write of the block; what was given and what was
   * left said
   */
  private async applyToAll(part: LookPart, view: ViewDefinition, host: ViewHost): Promise<void> {
    const { entries, given, left } = this.givenToAll(part, view, host);
    const what = part === "properties" ? "Visible properties" : part === "group" ? "Grouping" : "Color by";
    const why = left.map((one) => `${one.view.label} (${one.why})`).join(", ");
    if (!given.length) return void this.options.ui.notify(`${what} of ${view.label}: no other view takes it${why ? `: ${why}` : ""}`);
    try {
      await this.options.state.set(entries);
    } catch (error) {
      return void this.options.ui.notify(`${what} of ${view.label} could not be given to the other views: ${message(error)}`, { type: "error" });
    }
    this.options.ui.notify(`${what} of ${view.label} given to ${given.map((one) => one.label).join(", ")}${why ? `; left: ${why}` : ""}`);
  }

  /** What Apply to all views gives of `part` of `view` (its host's now) to the views on in this place, and leaves */
  private givenToAll(part: LookPart, view: ViewDefinition, host: ViewHost): ReturnType<typeof appliedToViews> {
    const look: LookOf = { shown: host.look.shownProperties.map((one) => one.key), colorBy: host.look.colorBy, group: groupedBy(view, host), arrangement: host.listing.groupArrangement };
    return appliedToViews(part, view, look, this.on, host.database.properties, (one) => host.type(one).name);
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

  /**
   * The view shown, a button: its icon, its label and a mark of a list (none
   * shown: Pick a view); pressed, the views on in a menu (the shared one, as
   * Sort and ⋯), the one shown checked, a view picked shown
   */
  private switcher(doc: Document, views: readonly ViewDefinition[], current: string | undefined): HTMLElement {
    const shown = views.find((view) => view.name === current);
    // (None on: nothing to pick, said why)
    const title = shown ? `View: ${shown.label} (pick another)` : views.length ? "Pick a view" : "No view is on: turn one on in the settings";
    const button = el(
      doc,
      "button",
      { class: "swd-view-picker", title, attrs: { "data-view": shown?.name, "aria-disabled": views.length ? undefined : "true" } },
      ...(shown ? [el(doc, "span", { class: "swd-view-picker-icon", html: shown.icon, attrs: { "aria-hidden": "true" } })] : []),
      el(doc, "span", { class: "swd-view-picker-label", text: shown?.label ?? "Pick a view" }),
      el(doc, "span", { class: "swd-view-picker-mark", html: ICONS.dropdown, attrs: { "aria-hidden": "true" } }),
    );
    const menu = toolMenu(doc, button, () => "Views", () =>
      views.map((view): MenuEntry => ({ kind: "item", label: view.label, icon: isReference(view.icon) ? this.icons.markup(view.icon, "swd-own") : view.icon, checked: view.name === current, run: () => void (view.name === current ? undefined : this.show(view.name)) })),
    );
    menu.box.classList.add("swd-view-picker-box");
    if (!views.length) button.disabled = true;
    this.picker = menu;
    return menu.box;
  }

  /**
   * What every view has beside its picker, as icons: the view's filter (a
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

  private tools(
    doc: Document,
    host: ViewHost,
    count: HTMLElement,
    view: ViewDefinition,
    typing: (key: string, condition: string) => void,
  ): { readonly bar: HTMLElement; readonly panel: HTMLElement; readonly sync: () => void; readonly stop: () => void; readonly kept: () => PlaceKept; readonly restore: (kept: PlaceKept) => void } {
    const { listing, database } = host;
    const columns = [{ key: "name", label: "Name" }, ...database.properties.map((one) => ({ key: one.key, label: one.label }))];
    const labelOf = (key: string) => columns.find((one) => one.key === key)?.label ?? key;
    const filters = () => Object.keys(listing.filter).length;
    // A field's condition shown as it is typed (`typing`: the view filters by it, nothing written), where it reads
    const preview = (input: HTMLInputElement): void => {
      const problem = listing.validateCondition(input.value);
      input.classList.toggle("swd-invalid", !!problem);
      input.title = problem ?? "";
      if (!problem) typing(input.dataset.key!, input.value);
    };
    // The field typed in last (the focus in it, or gone with the place drawn anew), and one shown as typed, not kept yet
    // (left as it is by `sync`, which shows the conditions kept)
    let lastField: HTMLInputElement | undefined;
    let held: HTMLInputElement | undefined;
    // A condition being written, and the field to apply after it (one write at a time: each builds on the block as the last left it)
    let writing = false;
    let again: HTMLInputElement | undefined;

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
        // Shown as it is typed; kept (written) once the field is left, by Enter or Esc too: no write, and so no block drawn
        // anew, while it is typed in
        input.addEventListener("input", () => {
          held = input;
          preview(input);
        });
        // (Changed and left: `change`; left with a condition shown as handed over by the place before, which no change of
        // this field's own typed: `blur`. Either a second time writes nothing, kept so already)
        input.addEventListener("change", () => apply(input));
        input.addEventListener("blur", () => apply(input));
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") apply(input);
          // (Esc leaves the field, applied as it is left, and goes no further: not out of full screen)
          if (event.key === "Escape") {
            event.preventDefault();
            input.blur();
          }
        });
        return el(doc, "label", "swd-filter-row", el(doc, "span", { text: column.label }), input);
      }),
    );
    // A field's condition kept (written) where it reads (`setFilter` writes nothing where it is kept so already); not by a
    // place that handed over (the next place keeps what was typed), nor from a field gone with its place
    const apply = (input: HTMLInputElement): void => {
      if (this.handedOver || !input.isConnected) return;
      const key = input.dataset.key!;
      const problem = listing.validateCondition(input.value);
      input.classList.toggle("swd-invalid", !!problem);
      input.title = problem ?? "";
      if (problem) return;
      if (writing) return void (again = input);
      writing = true;
      void listing.setFilter(key, input.value).finally(() => {
        writing = false;
        filterLabel();
        if (held === input && input.value === (listing.filter[key] ?? "")) held = undefined;
        const next = again;
        again = undefined;
        if (next) apply(next);
      });
    };
    const showPanel = (open: boolean) => {
      panel.hidden = !open;
      filterButton.setAttribute("aria-expanded", String(open));
    };
    filterButton.addEventListener("click", () => {
      showPanel(panel.hidden !== false);
      if (!panel.hidden) panel.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    });
    panel.addEventListener("focusin", (event) => {
      if (event.target instanceof HTMLInputElement) lastField = event.target;
    });
    // The focus gone elsewhere by the user (not with the place, drawn anew: no element then): no typing to go on with
    panel.addEventListener("focusout", (event) => {
      const next = event.relatedTarget as Node | null;
      if (next && !panel.contains(next)) lastField = undefined;
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
    // The order by hand, or a property (checked where sorted by), each way: the shared menu, as ⋯ (toolMenu)
    const sort = toolMenu(doc, sortButton, () => "Sort", () => {
      const now = listing.sort[0];
      const choose = (key: string, direction: "asc" | "desc") => void listing.setSort(key ? [{ key, direction }] : []).then(sortLabel);
      const option = (key: string, label: string): MenuEntry => ({ kind: "item", label, checked: (now?.key ?? "") === key, run: () => choose(key, key && now?.key === key ? now.direction : "asc") });
      return [
        option("", "Order by hand"),
        { kind: "separator" },
        ...columns.map((column) => option(column.key, column.label)),
        { kind: "separator" },
        {
          kind: "segmented",
          label: "Direction",
          key: "direction",
          options: (["asc", "desc"] as const).map((direction) => ({
            icon: direction === "asc" ? ICONS.up : ICONS.down,
            title: direction === "asc" ? "Ascending" : "Descending",
            active: now?.direction === direction,
            run: () => now && choose(now.key, direction),
            ...(now ? {} : { disabled: "In the order by hand: pick a property first" }),
          })),
        },
      ];
    });

    // Undo, and how far it is while it writes (many pages: one after another), kept by the place as it is drawn anew meanwhile
    const undoText = el(doc, "span", { class: "swd-tool-text swd-undo-progress" });
    const undo = el(doc, "button", { class: "swd-tool swd-undo", title: "Undo this database's last change", attrs: { "aria-label": "Undo this database's last change" }, run: () => void this.undo(host) }, el(doc, "span", { class: "swd-tool-icon", html: ICONS.undo }), undoText);
    this.undoShown = () => {
      const at = this.undoing;
      undo.setAttribute("aria-busy", String(!!at));
      undoText.hidden = !at?.of;
      undoText.textContent = at?.of ? `${at.done.toLocaleString("en-US")} / ${at.of.toLocaleString("en-US")}` : "";
      undo.title = at ? "Undoing: keep this window open until it is done" : "Undo this database's last change";
    };
    this.undoShown();

    // ⋯: the place's menu (core/placemenu.ts): the core's entries (Group where the view is grouped, Edit source), the
    // modules' (Properties) and the view's own, each in a slot by what it does
    const { editSource } = this.options;
    // ⋯ open at Group, what has the focus in its list as it changed something (handed over: the place drawn after it opens it so)
    let groupFocus: GroupFocus | undefined;
    // (Where the properties' list had the focus as it wrote: put back there in the menu opened again on the place drawn anew)
    let propertiesFocus: PropertiesFocus | undefined;
    const coreGroups = (menu: PlaceMenuBuilder): PlaceMenuGroup[] => {
      const groups: PlaceMenuGroup[] = [];
      // (One list's focus at a time: the menu opened again at the list changed last)
      // A part of how this view shows given to the others of the block (Apply to all views), where there are others
      // (Its menu not opened again as the block is drawn anew by it: what the lists had the focus of let go first)
      const toAll = (part: LookPart): ToAll | undefined => {
        if (this.on.length < 2) return undefined;
        const { given, left } = this.givenToAll(part, view, host);
        const run = () => {
          groupFocus = propertiesFocus = undefined;
          void this.applyToAll(part, view, host);
        };
        return given.length ? { run } : { run, disabled: `No other view takes it: ${left.map((one) => `${one.view.label} (${one.why})`).join(", ")}` };
      };
      const properties = propertiesEntry(view, host, menu, (focus) => {
        propertiesFocus = focus;
        groupFocus = undefined;
      }, toAll("properties"));
      if (properties) groups.push(menu.slot.view([properties]));
      const group = groupEntry(view, host, menu, (focus) => {
        groupFocus = focus;
        propertiesFocus = undefined;
      }, toAll("group"));
      if (group) groups.push(menu.slot.view([group]));
      if (view.colors !== false) groups.push(menu.slot.view([colorEntry(host, menu, toAll("colorBy"))]));
      if (editSource) groups.push(menu.slot.source([menu.item({ label: "Edit source", icon: ICONS.source, hint: "Show the block's text, to edit it as markdown", run: editSource })]));
      const remove = this.options.deleteDatabase;
      if (remove) groups.push(menu.slot.remove([menu.item({ label: "Delete database…", icon: ICONS.remove, hint: "The database, its items and its views, asked first", danger: true, run: () => remove(database.id, database.name) })]));
      return groups;
    };
    // The view's own (the user's too): asked as the menu opens, what it gives checked; failing, said and left out, the others shown
    const viewGroups = (menu: PlaceMenuBuilder): readonly PlaceMenuGroup[] => {
      if (!view.menu) return [];
      let made: unknown;
      try {
        made = view.menu(host, menu);
      } catch (error) {
        this.options.ui.notify(`The view "${view.label}": its menu failed: ${message(error)}`, { type: "error" });
        return [];
      }
      const checked = checkedGroups(made);
      if (typeof checked === "string") {
        this.options.ui.notify(`The view "${view.label}": ${checked}`, { type: "error" });
        return [];
      }
      return checked;
    };
    const moduleGroups = (menu: PlaceMenuBuilder) => this.options.moduleMenu?.(this.context(doc, database), menu) ?? [];
    // The database named in the menu's title: a pencil (its name only, in its record: its id, by which blocks show it, stays)
    const naming = (): MenuNaming => ({
      name: database.name,
      label: "Rename the database",
      save: async (name) => {
        const result = await this.options.core.renameDatabase(database.id, name);
        // (Drawn whole: the name is in the place's head, which a view's update leaves)
        if (!isRefused(result)) await this.render();
        return isRefused(result) && result.cause === "invalid" ? result.problem : undefined;
      },
    });
    // (Always there: the database's name at least)
    const more = placeMenu(doc, () => database.name, (menu) => [...coreGroups(menu), ...moduleGroups(menu), ...viewGroups(menu)], naming, () => (groupFocus = propertiesFocus = undefined));
    this.options.placeDrawn?.(this.context(doc, database));

    // The controls as the view's state has them now (a header's sort, a filter set by the view itself), and how many items show
    const sync = () => {
      sortLabel();
      filterLabel();
      count.textContent = host.items.length === host.total ? String(host.total) : `${host.items.length} of ${host.total}`;
      for (const input of panel.querySelectorAll<HTMLInputElement>("input[data-key]")) {
        if (doc.activeElement === input || held === input) continue;
        input.value = listing.filter[input.dataset.key!] ?? "";
        // (What it shows now is the condition kept, which reads: a mark of one typed before goes)
        input.classList.remove("swd-invalid");
        input.title = "";
      }
    };
    sync();
    // The place drawn anew: what is open closed, its listeners with it
    const stop = () => {
      // (What was typed and not kept yet is the next place's to keep, handed over as typed)
      sort.close();
      more.close();
    };
    // What is open: the field typed in only while the focus is in it, or went with the place (to nothing)
    const kept = (): PlaceKept => {
      const active = doc.activeElement;
      const typing = lastField && (active === lastField || !active || active === doc.body || !lastField.isConnected) ? lastField : undefined;
      return {
        filterOpen: !panel.hidden,
        ...(typing ? { typing: { key: typing.dataset.key!, value: typing.value, start: typing.selectionStart ?? typing.value.length, end: typing.selectionEnd ?? typing.value.length } } : {}),
        ...(groupFocus ? { group: groupFocus } : {}),
        ...(propertiesFocus ? { properties: propertiesFocus } : {}),
      };
    };
    // Shown as handed over: the panel open, the field as typed (the focus and the selection in it; shown as typed where it
    // differs from the condition kept, kept once the field is left), ⋯ open at Group, the focus where it was
    const restore = (from: PlaceKept) => {
      if (from.filterOpen) showPanel(true);
      const typing = from.typing;
      const input = typing && [...panel.querySelectorAll<HTMLInputElement>("input[data-key]")].find((one) => one.dataset.key === typing.key);
      if (typing && input) {
        input.value = typing.value;
        lastField = input;
        if (input.isConnected) {
          input.focus({ preventScroll: true });
          input.setSelectionRange(typing.start, typing.end);
        }
        if (typing.value !== (listing.filter[typing.key] ?? "")) {
          held = input;
          preview(input);
        }
      }
      if (from.group) {
        const shown = more.openAt(["Group"]);
        if (shown) {
          groupFocus = from.group;
          focusGroupList(shown, from.group);
        }
      }
      if (from.properties) {
        const shown = more.openAt(["Visible properties"]);
        if (shown) {
          propertiesFocus = from.properties;
          focusPropertyList(shown, from.properties);
        }
      }
    };
    // The modules' icons, after Undo and before ⋯ (pressed, the place drawn anew: what they show follows)
    const moduleTools = (this.options.moduleTools?.(this.context(doc, database)) ?? []).map((tool) =>
      el(
        doc,
        "button",
        { class: `swd-tool${tool.pressed ? " swd-tool-on" : ""}`, html: tool.icon, title: tool.label, attrs: { "aria-label": tool.label, "aria-pressed": tool.pressed === undefined ? undefined : String(tool.pressed), "data-tool": tool.key }, run: () => {
          this.pressedTool = tool.key;
          tool.run();
        } },
      ),
    );
    return { bar: el(doc, "span", "swd-tools", filterButton, sort.box, undo, ...moduleTools, more.box), panel, sync, stop, kept, restore };
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
    // The filter kept, and as shown: with the conditions being typed over it
    const keptFilter = () => filterOf(state.get(prefixed(STATE_KEYS.filter)));
    const shownFilter = (): Filter => {
      const filter: Record<string, string> = { ...keptFilter() };
      for (const [key, condition] of Object.entries(drawn.typed ?? {})) {
        if (condition.trim()) filter[key] = condition;
        else delete filter[key];
      }
      return filter;
    };
    const listing = () => ({ filter: shownFilter(), sort: sortOf(state.get(prefixed(STATE_KEYS.sort))) });
    const group = () => {
      const kept = state.get(prefixed(STATE_KEYS.groupBy));
      return typeof kept === "string" && kept ? kept : undefined;
    };
    const keys = (value: unknown) => (Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : []);
    const arrangement = (): GroupArrangement => ({ order: keys(state.get(prefixed(STATE_KEYS.groupOrder))), hidden: keys(state.get(prefixed(STATE_KEYS.groupHidden))), hideEmpty: state.get(prefixed(STATE_KEYS.groupHideEmpty)) === true });
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
    // What the view colors its items by (Color by in ⋯): the property kept, where it is still one of options
    const colorKey = () => {
      const kept = state.get(prefixed(STATE_KEYS.colorBy));
      return typeof kept === "string" && kept ? kept : undefined;
    };
    // (Found once per data read and key kept: asked for every item drawn)
    let colored: { data: Data; key: string | undefined; by: ColorBy | undefined } | undefined;
    const colorBy = (): ColorBy | undefined => {
      const key = colorKey();
      if (colored?.data !== data() || colored.key !== key) {
        const property = key === undefined ? undefined : colorable(data().database.properties, (one) => typeOf(types, one)).find((one) => one.key === key);
        colored = { data: data(), key, by: property && { property, type: typeOf(types, property) } };
      }
      return colored.by;
    };
    // The properties the view hides (Properties in ⋯), as kept: keys only
    // (A view hiding its properties by default keeps those it shows: a property added stays hidden there)
    const byDefault = hidesByDefault(drawn.view);
    const keptKey = prefixed(byDefault ? STATE_KEYS.shownProperties : STATE_KEYS.hiddenProperties);
    // What the view shows and hides, worked out once per data read and value kept (read for every item drawn)
    let visible: { data: Data; kept: unknown; hidden: readonly string[]; shown: readonly Property[] } | undefined;
    const visibility = () => {
      const kept = state.get(keptKey);
      if (visible?.data !== data() || visible.kept !== kept) {
        const { properties } = data().database;
        const listed = new Set(keys(kept));
        const hidden = byDefault ? properties.filter((one) => !listed.has(one.key)).map((one) => one.key) : [...listed];
        const off = new Set(hidden);
        visible = { data: data(), kept, hidden, shown: properties.filter((one) => !off.has(one.key)) };
      }
      return visible;
    };
    const hiddenKeys = (): readonly string[] => visibility().hidden;
    const shownProperties = (): readonly Property[] => visibility().shown;
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
      get grouping() {
        const property = groupedBy(drawn.view, this);
        return property && { property, groups: arrangedGroups(this, property).shown };
      },
      listing: {
        get filter() {
          return listing().filter;
        },
        get sort() {
          return listing().sort;
        },
        async setFilter(key, condition) {
          // (Kept, so no longer typed: what was shown of it is what is written)
          const typed = drawn.typed && key in drawn.typed;
          if (typed) delete drawn.typed![key];
          const filter: Record<string, string> = { ...keptFilter() };
          if (condition?.trim()) filter[key] = condition;
          else delete filter[key];
          // The same filter again writes nothing and draws nothing (a view setting it as it draws would draw itself forever)
          if (JSON.stringify(filter) === JSON.stringify(keptFilter())) {
            // (Typed back to what is kept: nothing written, the view as kept)
            if (typed) await shownAgain();
            return;
          }
          await setMeta({ [STATE_KEYS.filter]: Object.keys(filter).length ? filter : undefined });
          await shownAgain();
        },
        async setSort(sort) {
          if (JSON.stringify(sort) === JSON.stringify(listing().sort)) return;
          await setMeta({ [STATE_KEYS.sort]: sort.length ? sort : undefined });
          await shownAgain();
        },
        get group() {
          return group();
        },
        async setGroup(key) {
          if (key === group()) return;
          // (The order and the hiding were of the groups of the property before: its values)
          await setMeta(groupEntries(key));
          await shownAgain();
        },
        get groupArrangement() {
          return arrangement();
        },
        async setGroupArrangement(change) {
          const next = { ...arrangement(), ...change };
          if (JSON.stringify(next) === JSON.stringify(arrangement())) return;
          await setMeta(arrangementEntries(next));
          await shownAgain();
        },
        validateCondition,
      },
      look: {
        icon: (item) => itemIcon(this.options.element.ownerDocument, item, this.icons),
        ownIcon: (value, className) => ownIconElement(this.options.element.ownerDocument, value, this.icons, className),
        item: (item, element) => itemLook(item, element, colorBy()),
        get shownProperties() {
          return shownProperties();
        },
        get hiddenProperties() {
          return hiddenKeys();
        },
        async setHiddenProperties(keys) {
          // (Of keys only, each once, in the order given)
          const next = [...new Set(keys.filter((one) => typeof one === "string"))];
          if (JSON.stringify(next) === JSON.stringify(hiddenKeys())) return;
          // (As the schema has them now, kept as the view keeps them: a key kept of a property gone from it is let go)
          const off = new Set(next);
          const { properties } = data().database;
          await setMeta(propertyEntries(drawn.view, properties.filter((one) => !off.has(one.key)).map((one) => one.key), properties));
          await shownAgain();
        },
        get colorBy() {
          return colorBy()?.property.key;
        },
        async setColorBy(key) {
          if (key === colorKey()) return;
          await setMeta({ [STATE_KEYS.colorBy]: key });
          // (Drawn whole: its head says what the colors are of)
          if (!drawn.ended) await place.render();
        },
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
        if (this.options.openItem?.(item, id, place.openerOf())) return;
        const document = store.documentOf(item.key);
        if (!document || !editor?.open) return;
        try {
          await editor.open(document);
        } catch (error) {
          ui.notify(`"${item.name}" could not be opened: ${message(error)}`, { type: "error" });
        }
      },
      ...documentsHost(this.options.documents, core.noun, ui),
      ...mentionsHost(editor, ui),
      getMeta: (key) => state.get(prefixed(key)),
      setMeta,
      setting: (key) => settings.get(key),
      refresh: shownAgain,
      notify: (text) => ui.notify(text, { type: "error" }),
    };
  }

  private endView(): void {
    this.picker?.close();
    this.picker = undefined;
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

/** `run` once `element` is in the page: at once after this task, else in one of the next frames (a block the editor puts in the page after it is drawn); never where it is not */
function whenInPage(element: HTMLElement, run: () => void, frames = 20): void {
  queueMicrotask(() => {
    if (element.isConnected) return run();
    const view = element.ownerDocument.defaultView;
    if (!view || frames <= 0) return;
    view.requestAnimationFrame(() => whenInPage(element, run, frames - 1));
  });
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
