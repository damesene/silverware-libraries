// Silverware Database in SilverBullet: what the library's pages call. The init
// page hands over SilverBullet's API (`init`), draws each `silverware-database`
// block through `render`, tells the index's changes (`indexChanged`) and runs
// the commands; the API page defines the user's own views and types
// (`defineViews`, `defineTypes`), before `init`, as Space Lua loads.
import { iconsOf } from "../../shared/icons.ts";
import { type ConflictHost, openConflict } from "./core/conflictdialog.ts";
import type { ItemConflict } from "./core/core.ts";
import type { Item } from "./model/database.ts";
import { type CodeBlock, codeBlocksOf, sameBody } from "../../shared/pages/blocks.ts";
import { pageChanges } from "../../shared/pages/changes.ts";
import { pageWriter, type PageWriter } from "../../shared/pages/writer.ts";
import type { Platform } from "../../shared/platform.ts";
import { DatabaseCore } from "./core/core.ts";
import { Modules } from "./core/module.ts";
import { documentsHost, platformDocuments } from "./core/documents.ts";
import { mentionsHost } from "./core/mentions.ts";
import { DatabasePlace } from "./core/place.ts";
import { openDeleteDatabase } from "./core/deletedatabase.ts";
import { SettingsDialog } from "./core/settings.ts";
import type { ViewDefinition } from "./core/view.ts";
import { validateView, ViewRegistry } from "./core/views.ts";
import { guardedType, TYPE_HELPERS, validateType } from "./domain/types/custom.ts";
import { VIEW_HELPERS } from "./views/helpers.ts";
import { TypeRegistry } from "./domain/types/registry.ts";
import type { PropertyType } from "./domain/types/type.ts";
import { BLOCK_LANGUAGE, BlockState, readBlock } from "./host/silverbullet/block.ts";
import { blockPlaces } from "./host/silverbullet/places.ts";
import { type Bridge, editorArea, editorLook, silverBulletPlatform, watchEditorArea } from "./host/silverbullet/platform.ts";
import { PagesStore } from "./store/pages/store.ts";
import { BUILT_IN_MODULES } from "./modules/builtin.ts";
import { BUILT_IN_VIEWS } from "./views/builtin/index.ts";

export type { Bridge } from "./host/silverbullet/platform.ts";

// The registries, defined into as Space Lua loads (before `init`: the API page has priority 50)
const views = new ViewRegistry(BUILT_IN_VIEWS);
const types = new TypeRegistry();
// The user's views by name (one defined again: the last), in the order first defined
let customViews = new Map<string, ViewDefinition>();
let customTypes = new Map<string, PropertyType>();
// A failure of a custom type told once per page load (a view asks a type for every value it shows)
const typeFailures = new Set<string>();

// A block drawn: its place while its element is in the page (or comes back to it), the time it went out
// A block shown: `body` the text SilverBullet rendered its element for (never changed: SilverBullet may bring the element
// back for that text, its own cache of widgets, verified 2026-11-07), `current` the block's text as this element last
// wrote it, `wrote` set once it wrote and then went out of the page (an element that comes back after that is drawn
// anew from `body`, else it would write from a text the block no longer has)
type Shown = { readonly page: string; readonly body: string; current: string; place: DatabasePlace | undefined; outSince: number | undefined; wrote?: { out: boolean } };

// How long a place whose element went out of the page (CodeMirror keeps blocks out of view out of the DOM) is kept
const KEPT_OUT_MS = 60_000;

// A place that wrote its block, by its page and the text it wrote: the place SilverBullet draws for that text takes over what
// it had open (a filter being typed, ⋯ at Group: core/place.ts `PlaceKept`), once, while it is recent
const handovers = new Map<string, { readonly from: DatabasePlace; readonly until: number }>();
const HANDOVER_MS = 10_000;

type App = {
  readonly platform: Platform;
  readonly store: PagesStore;
  readonly core: DatabaseCore;
  readonly writer: PageWriter;
  readonly modules: Modules;
  readonly shown: Map<HTMLElement, Shown>;
  // The page a database made by a command goes beside (its root `<page>/db-<id>`)
  home: string;
};

let app: App | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
// The page watched (elements back after writing, presses beside a block): stopped as Silverware Database starts again
let watching: (() => void) | undefined;
// The page's elements watched only while an element that wrote may come back (`backAfterWriting`)
const observer = new MutationObserver(backAfterWriting);
let observing = false;
// When a press beside a block was taken at its mousedown: its mouseup and click taken too, within PRESS_MS, no other
let pressTaken = 0;
const PRESS_MS = 1500;
let indexChanged: ((change: { readonly document: string; readonly deleted: boolean }) => void) | undefined;
let pageOpened: (() => Promise<void>) | undefined;
let indexSettled: (() => void) | undefined;

const COMMANDS: Readonly<Record<string, () => Promise<void>>> = {
  "Silverware Database: New database": newDatabase,
  // A database's block at the cursor: a database picked, or a new one (also the slash command /database)
  "Silverware Database: Insert database": insertDatabase,
  // The last change of any database put back (a view's Undo puts back its own database's)
  "Silverware Database: Undo": async () => {
    await app!.core.undo();
    for (const shown of app!.shown.values()) void shown.place?.refresh();
  },
  // A database picked and deleted, asked first (as its ⋯ menu's Delete database…)
  "Silverware Database: Delete database": async () => {
    const { core, platform, store } = app!;
    const all = await store.databases();
    if (!all.length) return void platform.ui.notify("Silverware Database: there is no database to delete", { type: "error" });
    if (!platform.ui.pick) return void platform.ui.notify("Silverware Database: no picker here: delete a database from its menu (⋯)", { type: "error" });
    const picked = await platform.ui.pick("The database to delete", all.map((one) => ({ name: one.name, description: one.id, id: one.id })));
    if (picked) deleteDatabase(core, picked.id, picked.name);
  },
  "Silverware Database: Settings": async () => {
    const { platform } = app!;
    const { modules } = app!;
    await new SettingsDialog(document, { views, modules: modules.all, settings: platform.settings, ui: platform.ui, saved: () => void modules.start().then(redrawAll) }).open();
  },
};

export function init(bridge: Bridge): void {
  // Space Lua loaded again: the places of before let go (their listeners with them), one tidying; the blocks shown are
  // taken over and drawn anew below (SilverBullet may keep their elements)
  const before = app?.shown ?? new Map<HTMLElement, Shown>();
  app?.modules.stop();
  for (const shown of before.values()) {
    shown.place?.destroy();
    shown.place = undefined;
  }
  if (timer !== undefined) clearInterval(timer);
  watching?.();
  const pressed = ["mousedown", "mouseup", "click"] as const;
  for (const type of pressed) document.addEventListener(type, pressBeside, true);
  watching = () => {
    observer.disconnect();
    observing = false;
    for (const type of pressed) document.removeEventListener(type, pressBeside, true);
  };
  bridgeCalls = bridge;
  kept ??= keptParts();
  const { platform, store, writer, core, ui, own } = kept;
  const modules = new Modules(
    BUILT_IN_MODULES,
    {
      document,
      icons: iconsOf(platform.ui.icons),
      core,
      types,
      ui,
      database: (id) => store.database(id),
      items: async (id) => (await store.items(id)).value,
      itemBodies: store.capabilities.itemBody,
      body: (id, item) => store.body(id, item.key),
      openDocument: async (item) => {
        const name = store.documentOf(item.key);
        if (!name || !platform.editor.open) return;
        try {
          await platform.editor.open(name);
        } catch (error) {
          platform.ui.notify(`"${item.name}" could not be opened: ${error instanceof Error ? error.message : String(error)}`, { type: "error" });
        }
      },
      ...(platform.editor.href
        ? {
            documentHref: (item: Item) => {
              const name = store.documentOf(item.key);
              return name === undefined ? undefined : platform.editor.href!(name);
            },
          }
        : {}),
      showConflict: (conflict, done) =>
        openConflict(
          conflictHost(platform, () => {
            redrawAll();
            done();
          }),
          conflict,
        ),
      ...documentsHost(platformDocuments(platform), core.noun, platform.ui),
      ...mentionsHost(platform.editor, platform.ui),
      editorArea: () => editorArea(document),
      onEditorAreaChanged: (listener) => watchEditorArea(document, listener),
      editorLook: () => editorLook(document),
      onChanged: (listener) => store.onChanged((change) => listener(change.database)),
      onDocumentOpened: (listener) => platform.editor.onOpened?.(listener) ?? (() => {}),
      refreshPlaces: (database) => {
        if (database === undefined) return redrawAll();
        for (const shown of app?.shown.values() ?? []) if (shown.place?.database === database) void shown.place.refresh();
      },
    },
    platform.settings,
  );
  app = Object.assign(own, { platform, store, core, writer, modules, shown: before });
  for (const [element, shown] of before) if (element.isConnected) start(element, shown);
  // The modules on started (their settings read), the places drawn with what they add
  void modules.start().then(redrawAll);
  timer = setInterval(tidy, 5000);
}

// What is kept as Space Lua loads again (a setting saved, a space-lua block edited): the platform, the store, the writer and
// the core, so a change stays undoable while the window is open, and what a deletion removed, which only the writer's
// reports hold, is not lost with them. The platform calls the bridge handed over last.
type Kept = Pick<App, "platform" | "store" | "writer" | "core"> & { readonly ui: Ui; readonly own: { home: string } };
type Ui = { readonly notify: Platform["ui"]["notify"]; readonly ask: (message: string) => Promise<boolean> };
let kept: Kept | undefined;

function keptParts(): Kept {
  // Each call goes to the bridge of the last load (what it has is the same each load: one init page made it)
  const latest = new Proxy({} as Bridge, { get: (_, member) => bridgeCalls![member as keyof Bridge] });
  const made = silverBulletPlatform(latest);
  indexChanged = made.indexChanged;
  pageOpened = made.pageOpened;
  indexSettled = made.indexSettled;
  const platform = made.platform;
  const own = { home: "" };
  const store = new PagesStore(platform, { rootPage: (id) => (own.home ? `${own.home}/db-${id}` : `db-${id}`) });
  const ui: Ui = { notify: platform.ui.notify, ask: async (message: string) => (await platform.ui.ask?.(message)) ?? false };
  // A key changed is followed into the places of every page (their blocks), as the views say what of their state names one
  const writer = pageWriter(platform);
  // A write left as it rests on what changed since it was shown: said until closed, its Show conflict the dialog of it
  const conflict = (one: ItemConflict) =>
    platform.ui.notify(one.problem, {
      type: "error",
      timeout: 0,
      actions: [{ name: "Show conflict", run: () => openConflict(conflictHost(platform, redrawAll), one) }],
    });
  const core = new DatabaseCore(store, types, { ...ui, conflict }, platform.space.noun, { store: blockPlaces(platform.space, writer), propertyMeta: (view) => views.named(view)?.propertyMeta ?? [] });
  return { platform, store, writer, core, ui, own };
}

/** A block drawn: its element, its place made where it names a database */
export function render(body: string, page: string): HTMLElement {
  const element = document.createElement("div");
  element.className = "swd-place";
  if (!app) {
    element.append(note("Silverware Database is not started (its init page did not run)"));
    return element;
  }
  const shown: Shown = { page, body, current: body, place: undefined, outSince: undefined };
  app.shown.set(element, shown);
  start(element, shown);
  return element;
}

/** An index's change, from the init page's listeners (`page:index`, `page:deleted`) */
export function pageIndexed(name: string, deleted: boolean): void {
  indexChanged?.({ document: name, deleted });
}

/** SilverBullet's index queue emptied, no page half indexed (the init page's `mq:emptyQueue:indexQueue`) */
export function indexQueueEmptied(): void {
  indexSettled?.();
}

/** Another page opened in the editor (the init page's `editor:pageLoaded`) */
export function pageLoaded(): void {
  void pageOpened?.();
}

export function commandNames(): string[] {
  return Object.keys(COMMANDS);
}

/** The slash commands, each running a command: the init page defines them (`slashCommand.define`) */
export function slashCommands(): { name: string; description: string; command: string }[] {
  return [{ name: "database", description: "Show a database here, or make a new one", command: "Silverware Database: Insert database" }];
}

export async function runCommand(name: string): Promise<void> {
  await COMMANDS[name]?.();
}

/** Space Lua loads (again): the definitions of its scripts replace those of before */
export function resetDefinitions(): void {
  customViews = new Map();
  customTypes = new Map();
  typeFailures.clear();
  views.define([]);
  types.define([]);
}

/** The user's views (a JS module's: a list, or a function giving one); what cannot be a view said, the others defined */
export function defineViews(definitions: unknown): string | undefined {
  const list = listOf(definitions, VIEW_HELPERS);
  if (typeof list === "string") return list;
  // Only the views that can be one kept, by name: a mistake (a view defined twice in this call) said once, not with later ones
  const problems: string[] = [];
  const named = new Set<string>();
  for (const one of list as ViewDefinition[]) {
    const problem = validateView(one) ?? (named.has(one.name) ? `the view "${one.name}" is defined twice: the last kept` : undefined);
    if (problem) problems.push(problem);
    if (validateView(one)) continue;
    named.add(one.name);
    customViews.set(one.name, one);
  }
  views.define([...customViews.values()]);
  redrawAll();
  return problems.length ? `Silverware Database: ${problems.join("; ")}` : undefined;
}

/** The user's property types (a JS module's: a list, or a function giving one) */
export function defineTypes(definitions: unknown): string | undefined {
  const list = listOf(definitions, TYPE_HELPERS);
  if (typeof list === "string") return list;
  const problems: string[] = [];
  const named = new Set<string>();
  for (const one of list as PropertyType[]) {
    const wrong = validateType(one);
    if (wrong) {
      problems.push(wrong);
      continue;
    }
    if (named.has(one.name)) problems.push(`the type "${one.name}" is defined twice: the last kept`);
    named.add(one.name);
    // (Guarded: a method that throws or answers wrong breaks nothing, told once per method)
    customTypes.set(one.name, guardedType(one, tellTypeFailure));
  }
  types.define([...customTypes.values()]);
  redrawAll();
  return problems.length ? `Silverware Database: ${problems.join("; ")}` : undefined;
}

function tellTypeFailure(problem: string): void {
  if (typeFailures.has(problem)) return;
  typeFailures.add(problem);
  app?.platform.ui.notify(`Silverware Database: ${problem}`, { type: "error" });
}

/** A module's definitions as a list: the list itself, or what a function of it gives, given HELPERS */
function listOf(definitions: unknown, helpers: unknown): readonly unknown[] | string {
  let made: unknown;
  try {
    made = typeof definitions === "function" ? (definitions as (helpers: unknown) => unknown)(helpers) : definitions;
  } catch (error) {
    return `Silverware Database: the definitions' function failed: ${error instanceof Error ? error.message : String(error)}`;
  }
  return Array.isArray(made) ? made : "Silverware Database: definitions are a list, or a function giving one";
}

/** A block's place made and drawn (none where the block names no database) */
function start(element: HTMLElement, shown: Shown): void {
  const { store, core, platform } = app!;
  const id = readBlock(shown.current).get("id");
  if (typeof id !== "string" || !id) {
    element.replaceChildren(note("Name the database this block shows: id: <its id> (the command Silverware Database: New database makes one)"));
    return;
  }
  const state = new BlockState(shown.current, (body, text) => writeBlock(element, shown, body, text));
  // The place that wrote the text this one is drawn for: what it had open handed over, once
  const takeOver = () => {
    const key = JSON.stringify([shown.page, shown.current]);
    const handover = handovers.get(key);
    if (!handover) return undefined;
    handovers.delete(key);
    return handover.until > Date.now() && handover.from !== shown.place ? handover.from.handOver() : undefined;
  };
  // (The place before it for this block over the window: this one so from its first drawing, no frame in the page between)
  const before = handovers.get(JSON.stringify([shown.page, shown.current]));
  const overWindow = !!before && before.until > Date.now() && before.from !== shown.place && before.from.isOverWindow;
  shown.place = new DatabasePlace({ element, database: id, state, store, core, types, views, overWindow, settings: platform.settings, ui: platform.ui, editor: platform.editor, documents: platformDocuments(app!.platform), moduleMenu: (place, menu) => app!.modules.placeMenu(place, menu), moduleTools: (place) => app!.modules.placeTools(place), placeDrawn: (place) => app!.modules.placeDrawn(place), openItem: (item, database, from) => app!.modules.openItem(item, database, from), editSource: () => void editSource(element, shown), deleteDatabase: (one, name) => deleteDatabase(core, one, name), takeOver });
  void shown.place.render();
}

/**
 * A block's text written anew through the page writer, where it is still as
 * read: the one of its page whose element this is, among the blocks alike (a
 * database shown twice the same) by their order in the page
 */
async function writeBlock(element: HTMLElement, shown: Shown, body: string, text: string): Promise<boolean> {
  const { writer, platform } = app!;
  const found = await blockOf(element, shown, body);
  if (!found) return false;
  const { occurrence, of: inText } = found;
  // (The place drawn as the write starts: drawn anew meanwhile, from the text its element was rendered for, it is no longer the one that wrote)
  const place = shown.place;
  // The place drawn anew for the text written takes over from this one: told before the write, as SilverBullet may draw the
  // block anew before the write is done (a place over the window drawn so from its start); taken back where nothing was written
  const key = JSON.stringify([shown.page, text]);
  if (place) handovers.set(key, { from: place, until: Date.now() + HANDOVER_MS });
  const report = await writer.write(pageChanges().page(shown.page, (p) => p.codeBlocks.replace(BLOCK_LANGUAGE, body, text, { occurrence, of: inText })).build());
  for (const left of report.skipped) platform.ui.notify(`Silverware Database: ${left.reason}`, { type: "error" });
  // Written: the block is its new text (SilverBullet draws it anew from it; the blocks alike are counted by it meanwhile)
  const written = report.written.length > 0 && shown.place === place;
  if (!written && handovers.get(key)?.from === place) handovers.delete(key);
  if (written) {
    shown.current = text;
    shown.wrote = { out: false };
    if (!observing) {
      observer.observe(document.body, { childList: true, subtree: true });
      observing = true;
    }
  }
  return report.written.length > 0;
}

/**
 * Which of the page's blocks an element is, those written alike told apart by
 * their order: found only where every one of them is shown (CodeMirror keeps
 * blocks out of view out of the page), else nothing guessed and said why
 */
async function blockOf(element: HTMLElement, shown: Shown, body: string): Promise<{ readonly occurrence: number; readonly of: number; readonly block: CodeBlock } | undefined> {
  const { platform } = app!;
  if (!app!.shown.has(element)) {
    platform.ui.notify("Silverware Database: this block was drawn before Silverware Database started again: reload the page", { type: "error" });
    return undefined;
  }
  const alike = [...app!.shown].filter(([one, other]) => other.page === shown.page && sameBody(other.current) === sameBody(body) && one.isConnected).map(([one]) => one);
  alike.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const occurrence = alike.indexOf(element);
  const inText = codeBlocksOf(String(await platform.editor.text())).filter((block) => block.language === BLOCK_LANGUAGE && sameBody(block.body) === sameBody(body));
  if (occurrence < 0 || alike.length !== inText.length) {
    platform.ui.notify("Silverware Database: this block is written the same as another of the page, which is out of view: scroll so both show, or tell them apart (a line of your own in one)", { type: "error" });
    return undefined;
  }
  return { occurrence, of: inText.length, block: inText[occurrence]! };
}

/** The block's markdown shown to edit: the cursor put at the start of its text (SilverBullet shows a block with the cursor in it as text) */
async function editSource(element: HTMLElement, shown: Shown): Promise<void> {
  const found = await blockOf(element, shown, shown.current);
  if (!found) return;
  if (!bridgeCalls?.moveCursor) return app!.platform.ui.notify("Silverware Database: this SilverBullet cannot put the cursor into the block", { type: "error" });
  await bridgeCalls.moveCursor(found.block.bodyFrom);
}

/**
 * An element that wrote its block, went out of the page and came back
 * (SilverBullet's cache of widgets gives back the element it rendered for a
 * text the block has again): drawn anew from the text it was rendered for,
 * so its next write is from what the block holds. Checked on each change of
 * the page's elements, only while such an element is out.
 */
function backAfterWriting(): void {
  let waiting = false;
  for (const [element, shown] of app?.shown ?? []) {
    if (!shown.wrote) continue;
    waiting = true;
    if (!element.isConnected) shown.wrote.out = true;
    else if (shown.wrote.out) {
      shown.wrote = undefined;
      shown.place?.destroy();
      shown.place = undefined;
      shown.current = shown.body;
      start(element, shown);
    }
  }
  if (!waiting) {
    observer.disconnect();
    observing = false;
  }
}

/**
 * A press beside a block, on its lines (left or right of the widget, its
 * margins, the closing fence hidden under it): SilverBullet's editor would put its cursor there and show the
 * block's markdown, as in 2.12.1 only the widget's own element keeps presses
 * from it. Taken here, its mouseup and click too (SilverBullet's main takes a
 * click without its mousedown for one on a widget, which shows the markdown
 * too), as Silverware Table takes a press beside a table; Alt still shows the
 * markdown, Shift still extends a selection there.
 */
/** Whether a line of the editor is a database block's: the one holding its widget, or its closing fence SilverBullet hides under it (after the block's other lines, hidden too) */
function blockLine(line: Element): boolean {
  if (line.querySelector(".swd-widget")) return true;
  if (!line.classList.contains("sb-fenced-code-hide")) return false;
  let before = line.previousElementSibling;
  while (before?.classList.contains("sb-line-table-outside")) before = before.previousElementSibling;
  return !!before?.querySelector(".swd-widget");
}

/**
 * The editor's line at a height, for a press in the editor on none of its
 * lines: left or right of them (the content's padding, the scroller's room
 * beside it), which CodeMirror puts on the line beside it
 */
function lineAt(target: Element, y: number): Element | undefined {
  const content = target.closest(".cm-editor")?.querySelector(".cm-content");
  if (!content) return undefined;
  for (const line of content.children) {
    if (!line.classList.contains("cm-line")) continue;
    const box = line.getBoundingClientRect();
    if (y >= box.top && y < box.bottom) return line;
  }
  return undefined;
}

function pressBeside(event: MouseEvent): void {
  if (event.type !== "mousedown") {
    // (Only the mouseup and click of a press taken: a selection dragged onto the line ends as CodeMirror sees it)
    // (A press released outside the window ends with neither: one taken long ago takes nothing more)
    if (!pressTaken || Date.now() - pressTaken > PRESS_MS) return;
    if (event.type === "click") pressTaken = 0;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  pressTaken = 0;
  if (event.altKey || event.shiftKey || event.button !== 0 || !(event.target instanceof Element)) return;
  const widget = event.target.closest(".swd-widget");
  if (widget) {
    // A press on what takes no focus in it (a view's margin, a table's header) moves the focus, where a field or a menu of
    // it had it, to the nearest element that takes it: the editor's content, the caret put at the press, in the block, which
    // shows its markdown. Focusable itself (out of the tab order), the widget takes it: set as the press comes, before the
    // browser moves the focus (SilverBullet makes the widget's element; its class is the init page's)
    if (!widget.hasAttribute("tabindex")) widget.setAttribute("tabindex", "-1");
    return;
  }
  const line = event.target.closest(".cm-line") ?? lineAt(event.target, event.clientY);
  if (!line || !blockLine(line)) return;
  pressTaken = Date.now();
  event.preventDefault();
  event.stopPropagation();
}

/** Places whose element went out of the page a while are let go; one come back is drawn anew */
function tidy(): void {
  if (!app) return;
  const now = Date.now();
  for (const [element, shown] of app.shown) {
    if (element.isConnected) {
      shown.outSince = undefined;
      if (!shown.place) start(element, shown);
      continue;
    }
    shown.outSince ??= now;
    if (now - shown.outSince > KEPT_OUT_MS) {
      shown.place?.destroy();
      shown.place = undefined;
      // (An element let go long ago, never back: CodeMirror made the block anew)
      if (now - shown.outSince > 10 * KEPT_OUT_MS) app.shown.delete(element);
    }
  }
}

/** What a conflict's dialog is given: the page's document, a document opened and its address where the platform has them, `written` told once it is done */
function conflictHost(platform: Platform, written: () => void): ConflictHost {
  return {
    document,
    ...(platform.editor.open ? { open: (name: string) => void platform.editor.open!(name) } : {}),
    ...(platform.editor.href ? { href: platform.editor.href } : {}),
    written,
  };
}

function redrawAll(): void {
  for (const shown of app?.shown.values() ?? []) void shown.place?.render();
}

/** The database's deletion opened (core/deletedatabase.ts): asked, written, the places shown following it once written */
function deleteDatabase(core: DatabaseCore, id: string, name: string): void {
  const { platform } = app!;
  openDeleteDatabase({ document, core, noun: core.noun, notify: (message) => platform.ui.notify(message), written: () => app!.shown.forEach((shown) => void shown.place?.refresh()) }, id, name);
}

/** A database made by the command: its name asked, its root beside the page open, its block at the cursor */
async function newDatabase(): Promise<void> {
  const { core, platform } = app!;
  const name = await bridgePrompt("The new database's name");
  if (!name?.trim()) return;
  app!.home = String(await platform.editor.documentName());
  const result = await core.createDatabase(name, [{ label: "Status", type: "select", params: { options: ["Todo", "Doing", "Done"] } }]);
  if ("problem" in result) return;
  await insertAtCursor(blockText(result.id));
}

/** A database's block as written at the cursor (a line break before it: the cursor may be at the end of a line of text) */
const blockText = (id: string) => `\n\`\`\`${BLOCK_LANGUAGE}\nid: ${id}\n\`\`\`\n`;

/** A database's block at the cursor: one of the space's picked, or New database… first (made as by its command) */
async function insertDatabase(): Promise<void> {
  const { platform, store } = app!;
  if (!platform.ui.pick) return newDatabase();
  const all = await store.databases();
  const picked = await platform.ui.pick("Show a database here", [
    { name: "New database…", description: "Made beside this page, shown here", id: undefined },
    ...all.map((one) => ({ name: one.name, description: one.id, id: one.id })),
  ]);
  if (!picked) return;
  if (picked.id === undefined) return newDatabase();
  await insertAtCursor(blockText(picked.id));
}

// The bridge the init page handed over last (Space Lua loaded again hands over a new one): the platform's calls go to it,
// and its own calls that are no part of the platform (a prompt, text typed at the cursor)
let bridgeCalls: Bridge | undefined;
const bridgePrompt = (message: string) => bridgeCalls?.prompt(message) ?? Promise.resolve(undefined);
const insertAtCursor = (text: string) => bridgeCalls?.insertAtCursor(text) ?? Promise.resolve();

function note(text: string): HTMLElement {
  const p = document.createElement("p");
  p.className = "swd-place-note";
  p.textContent = text;
  return p;
}
