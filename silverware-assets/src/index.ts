// Silverware Assets in SilverBullet: the files a page embeds and links decorated (decorate.ts) over SilverBullet's
// page (host/silverbullet/assets.ts), the types of file and actions registered (core/registry.ts: the built-in ones,
// others through `api`, shared/assets.ts). Silverware Layout, where it is installed, is used through its API alone
// (handed over by the init page): a medium's width by its handle (a provider registered, shared/layout.ts), what its
// grids draw outside the editor (shared/rendered.ts).
import { saveConfigPage, withConfigSettings } from "../../shared/configpage.ts";
import { layoutOf } from "../../shared/layout.ts";
import type { Assets } from "../../shared/assets.ts";
import { applyLayers } from "../../shared/layers.ts";
import { pageWriter } from "../../shared/pages/writer.ts";
import { renderedOf } from "../../shared/rendered.ts";
import { type SyntaxModeWatcher, watchSyntaxMode } from "../../shared/syntaxmode.ts";
import { type Bridge, missingBridgeFunctions } from "./bridge.ts";
import { registerBuiltins } from "./builtin/index.ts";
import { AssetRegistry } from "./core/registry.ts";
import { type ListedFile, movedPreviews, orphanedPreviews } from "./core/stored.ts";
import { AssetDecorator, type AssetHost } from "./decorate.ts";
import { bytesOf, factsOf, silverBulletAssetHost } from "./host/silverbullet/assets.ts";
import { pageNamesOf, silverBulletPlatform } from "../../shared/silverbullet/platform.ts";
import { ASSETS_PATH, type AssetSettings, readAssetSettings, readSyntaxModeSettings, storedAssetPaths, SYNTAX_PATHS, type SyntaxModeSettings, validatePreviewFolder } from "./model/settings.ts";
import { SILVERBULLET_SYNTAX_PAGE, SYNTAX_OPTION } from "./host/silverbullet/syntaxmode.ts";
import { assetProvider } from "./provider.ts";
import { mediaTabs } from "./ui/mediatab.ts";
import { markdownTab, SettingsWindow } from "./ui/settingswindow.ts";
import { Dialogs } from "../../shared/dialog.ts";
import { type EditingSurface, editorsOf } from "../../shared/editor.ts";
import { folderOf } from "./core/insert.ts";
import { insertChosen, type InsertTarget, uploadBy, watchInserts } from "./host/silverbullet/insert.ts";
import { DIALOG_LOOK } from "./ui/dialoglook.ts";
import { type InsertChoice, type InsertFile, openInsertDialog } from "./ui/insertdialog.ts";
import { showUploadProgress } from "./ui/uploadprogress.ts";

const SETTINGS = "Silverware Assets: Settings";
const CLEAN_UP = "Silverware Assets: Clean up previews";
// Silverware Assets' own block of CONFIG: its tables, which the Configuration Manager's block would lose (shared/configpage.ts)
const OWN_MARKER = "-- managed-by: silverware-assets";

// The bridge handed over last (a problem told through it)
let current: Bridge | undefined;

/** A problem said to the user, the console's before a start */
function problem(message: string): void {
  if (current) void current.flash(message, "error");
  else console.error(message);
}

// The types of file and the actions, one registry per window: the module is imported once, so `api` is the same object
// as Space Lua loads again, and a type registered again (its plugin's init page run again) replaces its own
const registry = new AssetRegistry(problem);
registerBuiltins(registry);

// The files drawn again as another plugin registers a type or an action (its init page may run after the page's files
// were drawn: a PDF's preview drawn as the browser's viewer before Silverware Assets PDF registered its own), once for a burst
// of them
const REDRAW_MS = 50;
let redraw: ReturnType<typeof setTimeout> | undefined;
registry.onChange(() => {
  clearTimeout(redraw);
  redraw = setTimeout(() => void decorator?.redecorateAll(), REDRAW_MS);
});


/** Silverware Assets' API, as its API page hands it to other plugins (`silverware.assets.api`): types of file and actions (shared/assets.ts) */
export const api: Assets = {
  ...registry.api(),
  // (What is drawn in another plugin's field as the page draws it: a database's peek. Asked of the decorator as each is
  // drawn, none until the files are decorated: a field opened before draws them once they are)
  fieldDrawing: (page) => ({
    embed: (markdown) => decorator?.fieldDrawing(page).embed?.(markdown),
    linkIcon: (markdown) => decorator?.fieldDrawing(page).linkIcon?.(markdown),
    linkAfter: (markdown) => decorator?.fieldDrawing(page).linkAfter?.(markdown),
  }),
};

// The files decorated, one per window (its observers live as long), its host the bridge handed over last
let decorator: AssetDecorator | undefined;
// What follows SilverBullet's markdown shown as written, one per window (its settings read as it checks the mode)
let syntaxWatcher: SyntaxModeWatcher<SyntaxModeSettings> | undefined;

/** The settings of the markdown shown as written, as SilverBullet's configuration has them */
async function readSyntaxSettings(bridge: Bridge): Promise<SyntaxModeSettings> {
  if (!bridge.getConfig) return { hideAssets: true };
  const hides = await bridge.getConfig(SYNTAX_PATHS.hides, true);
  return readSyntaxModeSettings((path) => (path === SYNTAX_PATHS.hides ? hides : undefined));
}

// What files inserted decide in the event (host/silverbullet/insert.ts): the settings and the page as last read (each
// time the files are decorated, as a page opens, as the settings are saved)
let lastSettings: AssetSettings | undefined;
let lastPage: string | undefined;
// Files pasted, dropped and uploaded taken, one watch per window
let inserting: AbortController | undefined;
let insertDialogs: Dialogs | undefined;
// The largest file SilverBullet's space takes by default (MiB: its `maximumDocumentSize`, `plug-api/constants.ts`)
const MAX_DOCUMENT_MIB = 10;
/** The files chosen written and put in, their upload told meanwhile in a panel at the window's bottom right */
function uploadChosen(bridge: Bridge, drawing: AssetDecorator, settings: AssetSettings, target: InsertTarget, chosen: readonly InsertChoice[]): void {
  // (Those of the web linked are not uploaded: no row of theirs, no panel where all are)
  const uploaded = chosen.flatMap((one, index) => (one.url ? [] : [index]));
  const progress = uploaded.length
    ? showUploadProgress(
        document,
        uploaded.map((index) => {
          const one = chosen[index]!;
          return { name: one.path.slice(one.path.lastIndexOf("/") + 1), icon: drawing.insertTypeOf(one.file, one.path, settings).icon };
        }),
      )
    : undefined;
  void insertChosen(bridge, target, chosen, (index, state) => progress?.state(uploaded.indexOf(index), state))
    .then(() => progress?.finish())
    .catch((error: unknown) => {
      progress?.finish();
      void bridge.flash(`Silverware Assets: not inserted: ${error instanceof Error ? error.message : String(error)}`, "error");
    });
}

/** The insert dialog opened for these files (none: an upload, picked in it), the files chosen written and put in */
async function openInsert(files: readonly InsertFile[], target: InsertTarget): Promise<void> {
  const bridge = current;
  const drawing = decorator;
  if (!bridge || !drawing) return;
  const settings = heldOr(readAssetSettings(bridge.getConfig ? await bridge.getConfig(ASSETS_PATH, undefined) : undefined).settings);
  const mib = Number(bridge.getConfig ? await bridge.getConfig("maximumDocumentSize", MAX_DOCUMENT_MIB) : MAX_DOCUMENT_MIB) || MAX_DOCUMENT_MIB;
  const page = target.kind === "page" ? target.page : (lastPage ?? "");
  insertDialogs ??= new Dialogs(document, DIALOG_LOOK);
  openInsertDialog(
    document,
    insertDialogs,
    files,
    {
      folder: folderOf(page),
      maxBytes: mib * 1024 * 1024,
      now: () => new Date(),
      existing: async () => new Set(bridge.listFiles ? pageNamesOf(await bridge.listFiles()).map((path) => path.toLowerCase()) : []),
      typeOf: (file, path) => drawing.insertTypeOf(file, path, settings),
      drawSample: (container, file, path, view, signal) => drawing.drawSample(container, file, path, view, signal),
      touch: !!window.matchMedia?.("(pointer: coarse)").matches,
      companion: target.kind === "surface",
    },
    (chosen) => {
      // (A field of another plugin's given its focus back at once, as the dialog closes: else it is taken for left, a
      // grid's cell written and closed before the files are put in)
      if (target.kind === "surface") target.surface.focus();
      if (chosen?.length) uploadChosen(bridge, drawing, settings, target, chosen);
    },
  );
}

/**
 * *File: Upload*, as the init page replaces it: Silverware Assets' (the insert dialog opened empty, its files picked
 * in it), SilverBullet's own where it is turned off (its plug's function), nothing on a page read-only (SilverBullet
 * lists no upload there; a command of Space Lua it lists still)
 */
export async function upload(): Promise<void> {
  const by = uploadBy(document, lastSettings?.insert.enabled ?? true);
  if (by === "silverbullet") return void (await current?.invokeFunction?.("editor.uploadFileCommand", {}));
  if (by === "assets" && lastPage !== undefined) await openInsert([], { kind: "page", page: lastPage });
}

/**
 * Silverware Toolbar's actions (its public API's definitions, handed over by the init page): Upload file, into the field
 * it is run in (a grid's cell, a database's peek: the toolbar says which), else the page
 */
export function toolbarActions(): unknown[] {
  return [
    {
      name: "assetsUploadFile",
      label: "Upload file",
      icon: "lucide:paperclip",
      group: "Files",
      keywords: ["upload", "file", "image", "photo", "camera", "attach", "insert"],
      perform: async (_context: unknown, editor: { readonly field?: EditingSurface } | undefined) => {
        const field = editor?.field;
        if (field) return void (await openInsert([], { kind: "surface", surface: field }));
        await upload();
      },
    },
  ];
}

/** The page opened, handed over by the init page as it loads (`editor:pageLoaded`): where files inserted go */
export function pageLoaded(page: unknown): void {
  if (typeof page === "string" && page) lastPage = page;
}

/** Started by the init page (again as Space Lua loads again): SilverBullet's API handed over, Silverware Layout's where it is installed */
export function init(bridge: Bridge): void {
  // The layers its style page lays its elements in (shared/layers.ts)
  applyLayers(document);
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Assets: the init page did not hand over ${missing.join(", ")}`);
    return;
  }
  current = bridge;
  const layout = layoutOf(bridge.layout);
  const rendered = renderedOf((bridge.layout as { readonly rendered?: unknown } | undefined)?.rendered);
  const writer = pageWriter(silverBulletPlatform(bridge));
  const raw = silverBulletAssetHost(bridge, writer, document, rendered);
  const host: AssetHost = {
    ...raw,
    settings: async () => (lastSettings = heldOr(readAssetSettings(await raw.settings()).settings)),
    pageName: async () => (lastPage = await raw.pageName()),
    // (Read whenever the settings are: what files inserted decide in the event by)
  };
  const fresh = !decorator;
  if (decorator) decorator.useHost(host);
  else decorator = new AssetDecorator(document, host, registry);
  // A medium's width laid out by Silverware Layout's handle, as a widget's (registered again: the one of its name
  // replaced), laid out again as a frame is decorated
  layout.register(assetProvider(decorator));
  decorator.onDecorated = () => layout.layOutAgain?.();
  if (fresh) decorator.start();
  // Files and links to them drawn in the fields of Silverware Layout's grids as in the page (shared/rendered.ts `drawInFields`)
  const drawing = decorator;
  rendered.drawInFields?.((page) => drawing.fieldDrawing(page));
  // Files pasted, dropped and uploaded: Silverware Assets' dialog (docs/silverware-assets-insert.md), as the settings say
  if (!inserting) {
    inserting = new AbortController();
    void Promise.resolve(bridge.getCurrentPage()).then((page) => (lastPage = String(page))).catch(() => undefined);
    void host.settings().catch(() => undefined);
    watchInserts(
      document,
      {
        enabled: () => lastSettings?.insert.enabled ?? true,
        surfaceOf: (node) => editorsOf(current?.editor).surfaceOf(node),
        page: () => lastPage,
        open: (files, target) => void openInsert(files, target).catch((error: unknown) => problem(`Silverware Assets: ${error instanceof Error ? error.message : String(error)}`)),
      },
      inserting.signal,
    );
  }
  // The markdown shown as written (SilverBullet's mode): the files hidden then, as the
  // settings say (read as the mode is asked, again as the settings window saves them)
  syntaxWatcher ??= watchSyntaxMode<SyntaxModeSettings>(document, {
    page: SILVERBULLET_SYNTAX_PAGE,
    shown: () => current?.getUiOption?.(SYNTAX_OPTION),
    read: () => (current ? readSyntaxSettings(current) : { hideAssets: true }),
    same: (a, b) => a.hideAssets === b.hideAssets,
    marks: (settings) => ({ "data-swa-syntax-shown": settings.hideAssets }),
    initial: { hideAssets: true },
  });
}

// The settings just saved, held until SilverBullet's configuration gives them (it loads it again a moment after a
// save: read before, it is the one before), a while at most: the files drawn meanwhile by them (a preview into the new
// folder, not the old)
const SAVED_HELD_MS = 10_000;
let held: { readonly settings: AssetSettings; readonly until: number } | undefined;
function heldOr(read: AssetSettings): AssetSettings {
  if (held && (Date.now() > held.until || JSON.stringify(read) === JSON.stringify(held.settings))) held = undefined;
  return held ? held.settings : read;
}

/** The commands, as the init page defines them */
export function commandNames(): string[] {
  return [SETTINGS, CLEAN_UP];
}

export async function runCommand(name: string): Promise<void> {
  if (name === SETTINGS) await openSettings();
  if (name === CLEAN_UP) await cleanUpPreviews().catch((error: unknown) => current?.flash(`Silverware Assets: previews not cleaned up: ${error instanceof Error ? error.message : String(error)}`, "error"));
}

/** Files moved one by one (each read, written where it goes, taken out of where it was); those moved, and how many not */
async function moveFiles(bridge: Bridge, moves: readonly { readonly from: string; readonly to: string }[]): Promise<{ readonly moved: { readonly from: string; readonly to: string }[]; readonly failed: number }> {
  const moved: { readonly from: string; readonly to: string }[] = [];
  let failed = 0;
  for (const move of moves) {
    try {
      // (Nothing read as bytes: not written as an empty file, the original kept)
      const data = bytesOf(await bridge.readDocument!(move.from));
      if (!data) throw new Error(`${move.from} could not be read`);
      await bridge.writeDocument!(move.to, data);
      try {
        await bridge.deleteDocument!(move.from);
      } catch (error) {
        // (The original not taken away: its copy is, so the file is in one place, the old)
        await Promise.resolve(bridge.deleteDocument!(move.to)).catch(() => undefined);
        throw error;
      }
      moved.push(move);
    } catch {
      failed++;
    }
  }
  return { moved, failed };
}

/**
 * The previews' folder renamed (the settings saved): its previews (only theirs: the folder may hold the user's files
 * too) moved under the new folder, then the setting saved by `save`. One that cannot be moved, or the setting not
 * saved: those moved put back, the folder not changed, why said (as text: the settings window says it). Nothing kept,
 * or no way to list the space's files: the setting saved alone
 */
async function movePreviewFolder(bridge: Bridge, from: string, to: string, save: () => Promise<void>): Promise<string | undefined> {
  const canMove = bridge.listFiles && bridge.readDocument && bridge.writeDocument && bridge.deleteDocument;
  const moves = canMove ? movedPreviews(pageNamesOf(await bridge.listFiles!()), from, to) : [];
  const { moved, failed } = await moveFiles(bridge, moves);
  const putBack = () => moveFiles(bridge, moved.map((one) => ({ from: one.to, to: one.from })));
  // (Those that could not be put back said: left in the new folder, which nothing reads then)
  const leftIn = async () => {
    const back = await putBack();
    return back.failed ? ` (${back.failed} left in ${to})` : "";
  };
  if (failed) return `${failed} preview${failed === 1 ? "" : "s"} could not be moved to ${to}: the folder is not changed${await leftIn()}`;
  try {
    await save();
  } catch (error) {
    const left = await leftIn();
    throw new Error(`${error instanceof Error ? error.message : String(error)}${left}`);
  }
  // (Previews made meanwhile, into the old folder as they were drawn: moved after them)
  if (canMove) await moveFiles(bridge, movedPreviews(pageNamesOf(await bridge.listFiles!()), from, to));
  if (moved.length) bridge.flash(`Silverware Assets: ${moved.length} preview${moved.length === 1 ? "" : "s"} moved to ${to}`, "info");
  return undefined;
}

/** The previews kept of files gone (deleted, renamed) or of their versions gone (replaced) taken away, said how many (core/stored.ts) */
async function cleanUpPreviews(): Promise<void> {
  const bridge = current;
  if (!bridge?.listFiles || !bridge.deleteDocument) return void bridge?.flash("Silverware Assets: this SilverBullet hands over no way to list and delete files", "error");
  const listed = await bridge.listFiles();
  const metas = Array.isArray(listed) ? listed : listed && typeof listed === "object" ? Object.values(listed) : [];
  const files = metas.flatMap((meta: unknown): ListedFile[] => {
    const name = (meta as { name?: unknown } | null)?.name;
    if (typeof name !== "string") return [];
    const facts = factsOf(meta);
    return [{ name, ...(facts ? { facts } : {}) }];
  });
  const folder = heldOr(readAssetSettings(bridge.getConfig ? await bridge.getConfig(ASSETS_PATH, undefined) : undefined).settings).previewFolder;
  const gone = orphanedPreviews(files, folder);
  let failed = 0;
  // (Each on its own: one that fails, the rest still taken away)
  for (const path of gone) {
    try {
      await bridge.deleteDocument(path);
    } catch {
      failed++;
    }
  }
  const done = gone.length - failed;
  bridge.flash(
    done ? `Silverware Assets: ${done} preview${done === 1 ? "" : "s"} of files gone or changed taken away${failed ? `, ${failed} not` : ""}` : failed ? `Silverware Assets: ${failed} previews could not be taken away` : "Silverware Assets: no preview of a file gone or changed",
    failed ? "error" : "info",
  );
}

// The settings window, made as it is first opened
let settingsWindow: SettingsWindow | undefined;

/** The settings window: the settings as configured, the types and actions registered; saved into CONFIG */
async function openSettings(): Promise<void> {
  const bridge = current;
  const shown = decorator;
  if (!bridge || !shown) return;
  const save = (values: Readonly<Record<string, unknown>>, marker?: string) =>
    saveConfigPage({ configPage: bridge.configPage, readPage: (page) => bridge.readPage(page), saveConfigPage: (text) => bridge.saveConfigPage!(text) }, (text) => withConfigSettings(text, values, marker));
  const [settings, syntax] = await Promise.all([readAssetSettings(bridge.getConfig ? await bridge.getConfig(ASSETS_PATH, undefined) : undefined).settings, readSyntaxSettings(bridge)]);
  const input = {
    settings,
    types: registry.types.all.map(({ name, label, icon, document, storesPreview }) => ({ name, label: label ?? name, icon, document: !!document, storesPreview: !!storesPreview })),
    // (Those of a gesture: a menu's own, a copy, no click's)
    actions: registry.actions.all.filter((action) => action.gesture !== false).map(({ name, label }) => ({ name, ...(label ? { label } : {}) })),
    // (The command's own clean-up, from the Files tab's Saved previews)
    cleanUp: async (): Promise<void> => void (await cleanUpPreviews().catch((error: unknown) => current?.flash(`Silverware Assets: previews not cleaned up: ${error instanceof Error ? error.message : String(error)}`, "error"))),
  };
  settingsWindow ??= new SettingsWindow(document);
  settingsWindow.open(
    [
      ...mediaTabs(document, input, async (saved) => {
        // The previews' folder changed: checked, what it holds moved there first (the setting saved after, so the
        // previews are found where it says)
        const problem = validatePreviewFolder(saved.previewFolder);
        if (problem) return problem;
        const write = async () => {
          await save(storedAssetPaths(saved), OWN_MARKER);
          held = { settings: saved, until: Date.now() + SAVED_HELD_MS };
          // (Files inserted decide by them at once: a page with no file asks the settings of no one)
          lastSettings = saved;
        };
        if (saved.previewFolder === settings.previewFolder) await write();
        else {
          const notMoved = await movePreviewFolder(bridge, settings.previewFolder, saved.previewFolder, write);
          if (notMoved) return notMoved;
        }
        await shown.redecorateAll();
        return undefined;
      }),
      markdownTab(document, syntax, async (saved) => {
        await save({ [SYNTAX_PATHS.hides]: saved.hideAssets ? undefined : false });
        syntaxWatcher?.settingsChanged(saved);
        return undefined;
      }),
    ],
    { canSave: !!bridge.saveConfigPage, confirm: async (question) => (bridge.confirm ? !!(await bridge.confirm(question)) : globalThis.confirm(question)) },
  );
}
