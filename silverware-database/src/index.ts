// Silverware Database in SilverBullet: what the library's pages call. The init
// page hands over SilverBullet's API (`init`), draws each `silverware-database`
// block through `render`, tells the index's changes (`indexChanged`) and runs
// the commands; the API page defines the user's own views and types
// (`defineViews`, `defineTypes`), before `init`, as Space Lua loads.
import { codeBlocksOf, sameBody } from "../../shared/pages/blocks.ts";
import { pageChanges } from "../../shared/pages/changes.ts";
import { pageWriter, type PageWriter } from "../../shared/pages/writer.ts";
import type { Platform } from "../../shared/platform.ts";
import { DatabaseCore } from "./core/core.ts";
import { DatabasePlace } from "./core/place.ts";
import { SettingsDialog } from "./core/settings.ts";
import type { ViewDefinition } from "./core/view.ts";
import { validateView, ViewRegistry } from "./core/views.ts";
import { TypeRegistry } from "./domain/types/registry.ts";
import type { PropertyType } from "./domain/types/type.ts";
import { BLOCK_LANGUAGE, BlockState, readBlock } from "./host/silverbullet/block.ts";
import { type Bridge, silverBulletPlatform } from "./host/silverbullet/platform.ts";
import { PagesStore } from "./store/pages/store.ts";

export type { Bridge } from "./host/silverbullet/platform.ts";

// The registries, defined into as Space Lua loads (before `init`: the API page has priority 50)
const views = new ViewRegistry();
const types = new TypeRegistry();
// The user's views by name (one defined again: the last), in the order first defined
let customViews = new Map<string, ViewDefinition>();
let customTypes: PropertyType[] = [];

// A block drawn: its place while its element is in the page (or comes back to it), the time it went out
type Shown = { readonly page: string; body: string; place: DatabasePlace | undefined; outSince: number | undefined };

// How long a place whose element went out of the page (CodeMirror keeps blocks out of view out of the DOM) is kept
const KEPT_OUT_MS = 60_000;

type App = {
  readonly platform: Platform;
  readonly store: PagesStore;
  readonly core: DatabaseCore;
  readonly writer: PageWriter;
  readonly shown: Map<HTMLElement, Shown>;
  // The page a database made by a command goes beside (its root `<page>/db-<id>`)
  home: string;
};

let app: App | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let indexChanged: ((change: { readonly document: string; readonly deleted: boolean }) => void) | undefined;

const COMMANDS: Readonly<Record<string, () => Promise<void>>> = {
  "Silverware Database: New database": newDatabase,
  "Silverware Database: Settings": async () => {
    const { platform } = app!;
    await new SettingsDialog(document, { views, settings: platform.settings, ui: platform.ui, saved: redrawAll }).open();
  },
};

export function init(bridge: Bridge): void {
  // Space Lua loaded again: the places of before let go (their listeners with them), one tidying; the blocks shown are
  // taken over and drawn anew below (SilverBullet may keep their elements)
  const before = app?.shown ?? new Map<HTMLElement, Shown>();
  for (const shown of before.values()) {
    shown.place?.destroy();
    shown.place = undefined;
  }
  if (timer !== undefined) clearInterval(timer);
  const made = silverBulletPlatform(bridge);
  indexChanged = made.indexChanged;
  bridgeCalls = bridge;
  const platform = made.platform;
  const own: Partial<App> & { home: string } = { home: "" };
  const store = new PagesStore(platform, { rootPage: (id) => (own.home ? `${own.home}/db-${id}` : `db-${id}`) });
  const ui = { notify: platform.ui.notify, ask: async (message: string) => (await platform.ui.ask?.(message)) ?? false };
  app = Object.assign(own, { platform, store, core: new DatabaseCore(store, types, ui), writer: pageWriter(platform), shown: before }) as App;
  for (const [element, shown] of before) if (element.isConnected) start(element, shown);
  timer = setInterval(tidy, 5000);
}

/** A block drawn: its element, its place made where it names a database */
export function render(body: string, page: string): HTMLElement {
  const element = document.createElement("div");
  element.className = "swd-place";
  if (!app) {
    element.append(note("Silverware Database is not started (its init page did not run)"));
    return element;
  }
  const shown: Shown = { page, body, place: undefined, outSince: undefined };
  app.shown.set(element, shown);
  start(element, shown);
  return element;
}

/** An index's change, from the init page's listeners (`page:index`, `page:deleted`) */
export function pageIndexed(name: string, deleted: boolean): void {
  indexChanged?.({ document: name, deleted });
}

export function commandNames(): string[] {
  return Object.keys(COMMANDS);
}

export async function runCommand(name: string): Promise<void> {
  await COMMANDS[name]?.();
}

/** Space Lua loads (again): the definitions of its scripts replace those of before */
export function resetDefinitions(): void {
  customViews = new Map();
  customTypes = [];
  views.define([]);
  types.define([]);
}

/** The user's views (a JS module's: a list, or a function giving one); what cannot be a view said, the others defined */
export function defineViews(definitions: unknown): string | undefined {
  const list = listOf(definitions);
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
  const list = listOf(definitions);
  if (typeof list === "string") return list;
  const problems: string[] = [];
  for (const one of list as PropertyType[]) {
    const problem = validateType(one);
    if (problem) problems.push(problem);
    else customTypes.push(one);
  }
  types.define(customTypes);
  redrawAll();
  return problems.length ? `Silverware Database: ${problems.join("; ")}` : undefined;
}

function validateType(type: PropertyType): string | undefined {
  if (!type || typeof type.name !== "string" || !/^[a-z][a-z0-9-]*$/.test(type.name)) return `"${String(type?.name)}" is no type's name: lower case letters, digits and -`;
  if (typeof type.label !== "string") return `the type "${type.name}" has no label`;
  for (const method of ["validate", "text", "parse"] as const) if (typeof type[method] !== "function") return `the type "${type.name}" has no ${method}`;
  return undefined;
}

/** A module's definitions as a list: the list itself, or what a function of it gives */
function listOf(definitions: unknown): readonly unknown[] | string {
  const made = typeof definitions === "function" ? (definitions as () => unknown)() : definitions;
  return Array.isArray(made) ? made : "Silverware Database: definitions are a list, or a function giving one";
}

/** A block's place made and drawn (none where the block names no database) */
function start(element: HTMLElement, shown: Shown): void {
  const { store, core, platform } = app!;
  const id = readBlock(shown.body).get("id");
  if (typeof id !== "string" || !id) {
    element.replaceChildren(note("Name the database this block shows: id: <its id> (the command Silverware Database: New database makes one)"));
    return;
  }
  const state = new BlockState(shown.body, (body, text) => writeBlock(element, shown, body, text));
  shown.place = new DatabasePlace({ element, database: id, state, store, core, types, views, settings: platform.settings, ui: platform.ui, editor: platform.editor });
  void shown.place.render();
}

/**
 * A block's text written anew through the page writer, where it is still as
 * read: the one of its page whose element this is, among the blocks alike (a
 * database shown twice the same) by their order in the page
 */
async function writeBlock(element: HTMLElement, shown: Shown, body: string, text: string): Promise<boolean> {
  const { writer, platform } = app!;
  const alike = [...app!.shown].filter(([one, other]) => other.page === shown.page && sameBody(other.body) === sameBody(body) && one.isConnected).map(([one]) => one);
  alike.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const occurrence = alike.indexOf(element);
  if (!app!.shown.has(element)) {
    platform.ui.notify("Silverware Database: this block was drawn before Silverware Database started again: reload the page", { type: "error" });
    return false;
  }
  // Which of the blocks alike this is, by their order: told only where every one of the page is shown (CodeMirror keeps
  // blocks out of view out of the page), else nothing guessed
  const inText = codeBlocksOf(String(await platform.editor.text())).filter((block) => block.language === BLOCK_LANGUAGE && sameBody(block.body) === sameBody(body)).length;
  if (occurrence < 0 || alike.length !== inText) {
    platform.ui.notify("Silverware Database: this block is written the same as another of the page, which is out of view: scroll so both show, or tell them apart (a line of your own in one)", { type: "error" });
    return false;
  }
  const report = await writer.write(pageChanges().page(shown.page, (p) => p.codeBlocks.replace(BLOCK_LANGUAGE, body, text, { occurrence, of: inText })).build());
  for (const left of report.skipped) platform.ui.notify(`Silverware Database: ${left.reason}`, { type: "error" });
  // Written: the block is its new text (SilverBullet draws it anew from it; the blocks alike are counted by it meanwhile)
  if (report.written.length) shown.body = text;
  return report.written.length > 0;
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

function redrawAll(): void {
  for (const shown of app?.shown.values() ?? []) void shown.place?.render();
}

/** A database made by the command: its name asked, its root beside the page open, its block at the cursor */
async function newDatabase(): Promise<void> {
  const { core, platform } = app!;
  const name = await bridgePrompt("The new database's name");
  if (!name?.trim()) return;
  app!.home = String(await platform.editor.documentName());
  const result = await core.createDatabase(name, [{ label: "Status", type: "select", params: { options: ["Todo", "Doing", "Done"] } }]);
  if ("problem" in result) return;
  // (A line break before it: the cursor may be at the end of a line of text)
  await insertAtCursor(`\n\`\`\`${BLOCK_LANGUAGE}\nid: ${result.id}\n\`\`\`\n`);
}

// The bridge's own calls that are no part of the platform (a prompt, text typed at the cursor), kept as `init` runs
let bridgeCalls: Pick<Bridge, "prompt" | "insertAtCursor"> | undefined;
const bridgePrompt = (message: string) => bridgeCalls?.prompt(message) ?? Promise.resolve(undefined);
const insertAtCursor = (text: string) => bridgeCalls?.insertAtCursor(text) ?? Promise.resolve();

function note(text: string): HTMLElement {
  const p = document.createElement("p");
  p.className = "swd-place-note";
  p.textContent = text;
  return p;
}
