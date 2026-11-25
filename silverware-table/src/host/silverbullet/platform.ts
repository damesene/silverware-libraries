// The table's platform made of what the init page's Lua hands over (the
// Bridge: SilverBullet's editor, space, config and markdown API): the one
// place that knows what SilverBullet's API is called and what it answers
// (docs/silverware-table-store-plan.md, step 1). The core asks the platform
// (core/platform.ts). Each member calls the bridge as it is used, so a
// member the bridge has is what the platform offers.
import { saveConfigPage, withConfigSettings } from "../../../../shared/configpage.ts";
import type { Settings, Space } from "../../../../shared/platform.ts";
import { type Bridge, listOf } from "../../bridge.ts";
import type { TablePlatform } from "../../core/platform.ts";

/** The platform over the bridge; `doc` the page's, whose browser asks where SilverBullet's dialog is not handed over */
export function tablePlatform(bridge: Bridge, doc: Document): TablePlatform {
  return {
    editor: {
      documentName: () => bridge.getCurrentPage(),
      text: () => bridge.getText(),
      replace: async (from, to, insert) => void (await bridge.replaceRange(from, to, insert)),
      moveCursor: async (at, center) => void (await bridge.moveCursor(at, center)),
      ...(bridge.getCursor ? { cursor: () => bridge.getCursor!() } : {}),
      ...(bridge.setSelection ? { select: async (from: number, to: number) => void (await bridge.setSelection!(from, to)) } : {}),
      ...(bridge.undo ? { undo: async () => void (await bridge.undo!()) } : {}),
      ...(bridge.redo ? { redo: async () => void (await bridge.redo!()) } : {}),
      ...(bridge.navigate ? { open: async (ref: string) => void (await bridge.navigate!(ref)) } : {}),
    },
    ...(bridge.readPage ? { space: spaceOf(bridge) } : {}),
    ui: {
      // (A notification's type and timeout; SilverBullet's defaults for what is not given)
      notify: (message, options) => void bridge.flash(message, options?.type ?? "info", options?.timeout === undefined ? undefined : { timeout: options.timeout }),
      // SilverBullet's dialog, else the browser's
      ask: async (message, options) => (bridge.confirm ? Boolean(await bridge.confirm(message, options?.destructive ? { destructive: true } : undefined)) : doc.defaultView!.confirm(message)),
      ...(bridge.reloadUI ? { reload: async () => void (await bridge.reloadUI!()) } : {}),
    },
    settings: settingsOf(bridge),
    renderer: {
      ...(bridge.markdownToHtml ? { markdownToHtml: (markdown: string) => bridge.markdownToHtml!(markdown) } : {}),
      ...(bridge.evalExpression ? { evaluate: (expression: string) => bridge.evalExpression!(expression) } : {}),
    },
    ...(bridge.layout === undefined ? {} : { layout: bridge.layout }),
  };
}

/** Other pages, where the bridge reads them: written where it writes them too, listed where it lists them */
function spaceOf(bridge: Bridge): Space {
  return {
    read: (name) => bridge.readPage!(name),
    write: async (name, text) => {
      if (!bridge.writePage) throw new Error("pages are not written here");
      await bridge.writePage(name, text);
    },
    // (A Lua table may come as an object with its items under 1, 2, …)
    list: async () => (bridge.listPages ? listOf(await bridge.listPages()).filter((page): page is string => typeof page === "string") : []),
    folderSeparator: "/",
    noun: { one: "page", many: "pages" },
  };
}

/** Settings read by path; saved into the configuration page's managed block (shared/configpage.ts), or the bridge's own store */
function settingsOf(bridge: Bridge): Settings {
  const { saveSettings, saveConfigPage: saveConfig, readPage } = bridge;
  const save = saveSettings
    ? async (values: Readonly<Record<string, unknown>>) => void (await saveSettings(values))
    : saveConfig && readPage
      ? (values: Readonly<Record<string, unknown>>) =>
          saveConfigPage({ readPage: (name) => readPage(name), saveConfigPage: (text) => saveConfig(text) }, (text) => withConfigSettings(text, values))
      : undefined;
  return {
    // Without getConfig every setting keeps its default
    get: (path, fallback) => (bridge.getConfig ? bridge.getConfig(path, fallback) : fallback),
    ...(save ? { save } : {}),
  };
}
