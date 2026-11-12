// Silverware Layout in SilverBullet: the API the widget plugins register their providers with (shared/layout.ts), their
// widgets laid out and the handle of their width (widgetlayout.ts), the page's text width (its own, the default
// setting's, none in a narrow pane) set as pages open and change, and the Page layout dialog. Its init page hands over
// SilverBullet's API (bridge.ts) and calls `pageLoaded`, `pageOpened` and `pageEdited`.
import { saveConfigPage, withConfigSettings } from "../../shared/configpage.ts";
import { type PageWriter, pageWriter } from "../../shared/pages/writer.ts";
import { type Bridge, missingBridgeFunctions } from "./bridge.ts";
import { Registry } from "./core/registry.ts";
import { textWidthShown } from "./core/textwidth.ts";
import { markNarrow, paneWidth, showTextWidth, watchPaneWidth } from "./host/silverbullet/dom.ts";
import { pageLayoutOf, writePageWidth } from "./host/silverbullet/page.ts";
import { silverBulletPlatform } from "./host/silverbullet/platform.ts";
import { DEFAULT_MIN_PANE_WIDTH, DEFAULT_PRESETS, PATHS, readSettings, type Settings } from "./model/settings.ts";
import { cssWidth, readWidth, type Width } from "./model/width.ts";
import { PageDialog } from "./ui/pagedialog.ts";
import { layOutWidgets, type WidgetLayout } from "./widgetlayout.ts";

const PAGE_LAYOUT = "Silverware Layout: Page layout";
// How long the page is still before its frontmatter is read again after an edit
const EDITED_MS = 300;

type App = {
  readonly bridge: Bridge;
  readonly writer: PageWriter;
  settings: Settings;
  // The page open and its own text width, as last read
  page: string;
  pageWidth: Width | undefined;
};

let app: App | undefined;
// Each reading of the page numbered: one answered after a later one is dropped (a page opened while another was read)
let reading = 0;
let editedTimer: ReturnType<typeof setTimeout> | undefined;
let stopWatching: (() => void) | undefined;
let dialog: PageDialog | undefined;
// Made once per window (its observer and its handle live as long), asking the settings of the last load
let widgetLayout: WidgetLayout | undefined;

// One registry per window: the module is imported once, so `api` is the same object as Space Lua loads again, and a
// provider registered again (its plugin's init page run again) replaces its own
const registry = new Registry((message) => (app ? void app.bridge.flash(message, "error") : console.error(message)));

/** Silverware Layout's API, as its API page hands it to the widget plugins (`silverware.layout.api`) */
export const api = registry.api();

/** Started by the init page (again as Space Lua loads again): SilverBullet's API handed over, the settings read */
export async function init(bridge: Bridge): Promise<void> {
  const missing = missingBridgeFunctions(bridge);
  if (missing.length) {
    console.error(`Silverware Layout: the init page did not hand over ${missing.join(", ")}`);
    return;
  }
  app = { bridge, writer: pageWriter(silverBulletPlatform(bridge)), settings: await settingsOf(bridge), page: "", pageWidth: undefined };
  stopWatching?.();
  // (Not while the dialog shows a width it is setting)
  stopWatching = watchPaneWidth(document, () => {
    if (!dialog?.isOpen) show();
  });
  widgetLayout ??= layOutWidgets(document, registry, {
    presets: () => app?.settings.presets ?? DEFAULT_PRESETS,
    enabled: () => !!app && paneWidth(document) >= app.settings.minPaneWidth,
    problem: (message) => void app?.bridge.flash(message, "error"),
  });
  widgetLayout.widgets.layOutAll();
  await pageOpened();
}

/** The settings as configured (none read: the defaults) */
async function settingsOf(bridge: Bridge): Promise<Settings> {
  if (!bridge.getConfig) return { textWidth: undefined, minPaneWidth: DEFAULT_MIN_PANE_WIDTH, presets: DEFAULT_PRESETS };
  const values = new Map<string, unknown>();
  for (const path of Object.values(PATHS)) values.set(path, await bridge.getConfig(path, undefined));
  return readSettings((path) => values.get(path));
}

/**
 * A page opened (editor:pageLoaded): its name and its frontmatter's `_layout.width` as the page's meta has them, read
 * by the init page's Lua and given here, so the width is set at once, before the page is painted (each call of the
 * bridge from here is a promise answered later: reading the text took frames)
 */
export function pageLoaded(page: unknown, width: unknown): void {
  const now = app;
  if (!now) return;
  ++reading;
  now.page = String(page);
  now.pageWidth = readWidth(width);
  show();
  // (The meta is the index's, which may lag behind a write a moment ago: the text read too, a moment later)
  void pageOpened();
}

/** The page open read again from its text (as Silverware Layout starts, after an edit): its own width, the text shown at it */
export async function pageOpened(): Promise<void> {
  const now = app;
  if (!now) return;
  const mine = ++reading;
  const [page, text] = await Promise.all([now.bridge.getCurrentPage(), now.bridge.getText()]);
  if (mine !== reading || now !== app) return;
  now.page = String(page);
  now.pageWidth = pageLayoutOf(String(text)).width;
  show();
}

/** The page edited (editor:pageModified): its width read again once it is still a moment (a width typed in its frontmatter) */
export function pageEdited(): void {
  clearTimeout(editedTimer);
  editedTimer = setTimeout(() => {
    if (!dialog?.isOpen) void pageOpened();
  }, EDITED_MS);
}

/** The text shown at the width that applies now */
function show(): void {
  if (app) showWith(app.pageWidth, app.settings.textWidth);
}

/** The text shown as it would be with these widths (the page's own, the default; none: none) */
function showWith(pageWidth: Width | undefined, fallback: Width | undefined): void {
  if (!app) return;
  // (Widgets laid out where the pane is wide enough: the style page's rule reads it)
  markNarrow(document, paneWidth(document) < app.settings.minPaneWidth);
  showTextWidth(document, textWidthShown({ page: pageWidth, fallback, paneWidth: paneWidth(document), minPaneWidth: app.settings.minPaneWidth }));
}

/** The commands, as the init page defines them */
export function commandNames(): string[] {
  return [PAGE_LAYOUT];
}

export async function runCommand(name: string): Promise<void> {
  if (name === PAGE_LAYOUT) await openPageDialog();
}

/** The Page layout dialog over the page open */
async function openPageDialog(): Promise<void> {
  const now = app;
  if (!now) return;
  await pageOpened();
  const { bridge } = now;
  dialog ??= new PageDialog(document);
  dialog.open({
    page: now.page,
    pageWidth: now.pageWidth,
    defaultWidth: now.settings.textWidth,
    presets: now.settings.presets,
    canSaveDefault: !!bridge.saveConfigPage,
    preview: (pageWidth, fallback) => showWith(pageWidth, fallback),
    restore: () => show(),
    savePage: async (width) => {
      const problem = await writePageWidth(now.writer, now.page, String(await bridge.getText()), width);
      if (!problem) now.pageWidth = width;
      return problem;
    },
    saveDefault: async (width) => {
      // In the Configuration Manager's block of CONFIG (it shows it, Ctrl-,), as the other plugins save theirs
      await saveConfigPage({ readPage: (page) => bridge.readPage(page), saveConfigPage: (text) => bridge.saveConfigPage!(text) }, (text) =>
        withConfigSettings(text, { [PATHS.textWidth]: width ? cssWidth(width) : undefined }),
      );
      now.settings = { ...now.settings, textWidth: width };
      return undefined;
    },
    confirm: async (question) => (bridge.confirm ? !!(await bridge.confirm(question)) : globalThis.confirm(question)),
    flash: (message, type) => void bridge.flash(message, type),
  });
}
