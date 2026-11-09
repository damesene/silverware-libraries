// The platform made of what the init page's Lua hands over (SilverBullet's
// editor, space, index, config and UI API): the one place that knows what
// SilverBullet's API is called and what it answers. Everything else asks the
// platform (shared/platform.ts).
import { saveConfigPage, withConfigSettings } from "../../../../shared/configpage.ts";
import type { IndexChange, IndexedObject, Platform } from "../../../../shared/platform.ts";
import { PAGE_KEYS, pageDates, referablePages, tasksOfPages, validatePageName } from "./pages.ts";
import { settledIndex } from "./settledindex.ts";

/** What the init page hands over, each SilverBullet's own function or a few lines of Lua around it */
export type Bridge = {
  getCurrentPage(): Promise<string>;
  getText(): Promise<string>;
  replaceRange(from: number, to: number, text: string): Promise<void>;
  insertAtCursor(text: string): Promise<void>;
  // The cursor put at an offset of the page open (Edit source: a block with the cursor in it shows its markdown)
  moveCursor?(at: number): Promise<void>;
  navigate(ref: string): Promise<void>;
  readPage(name: string): Promise<string>;
  writePage(name: string, text: string): Promise<void>;
  deletePage(name: string): Promise<void>;
  // Every page's name
  listPages(): Promise<readonly string[]>;
  // index.renamePageCommand: links followed; its answer is the same whether it renamed or not
  renamePage(from: string, to: string): Promise<unknown>;
  // index.renamePrefixCommand, without asking
  renamePrefix(from: string, to: string): Promise<unknown>;
  // The index's objects of a tag (`query[[from index.tag(tag)]]`)
  queryTag(tag: string): Promise<readonly IndexedObject[]>;
  // Whether no page is queued or being indexed (`mq.getQueueStats("indexQueue")`): the index is whole then; left out, taken as always
  indexIdle?(): Promise<boolean>;
  flash(message: string, type: "info" | "error", options?: { readonly timeout?: number }): void;
  confirm(message: string): Promise<boolean>;
  prompt(message: string, value?: string): Promise<string | undefined>;
  getConfig(path: string, fallback: unknown): Promise<unknown>;
  // The CONFIG page written as the Configuration Manager writes it (synced, indexed, the configuration loaded again)
  saveConfigPage?(text: string): Promise<void>;
};

/**
 * A list Lua hands over (a query's, the pages'): a list, or none where Lua's
 * table was empty, which comes to JS as an empty object (seen 2026-11-07: a
 * space with no database, its query of `db-root` none)
 */
function listOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// The database's own block of the CONFIG page: the Configuration Manager writes its block anew from the settings its
// schema shows (ui), which views' settings, open-ended, are not, so they would go with its next save (seen in its source,
// plugs/configuration-manager, 2026-11-07)
export const OWN_MARKER = "-- managed-by: silverware-database";

/** The platform over SilverBullet's API, and the events to feed it (`indexChanged`, `indexSettled`, `pageOpened`: from the init page's listeners) */
export function silverBulletPlatform(bridge: Bridge): {
  readonly platform: Platform;
  readonly indexChanged: (change: IndexChange) => void;
  readonly indexSettled: () => void;
  readonly pageOpened: () => Promise<void>;
} {
  const listeners = new Set<(change: IndexChange) => void>();
  // The index read only whole: settledindex.ts
  const index = settledIndex(
    async (tag) => listOf<IndexedObject>(await bridge.queryTag(tag)),
    bridge.indexIdle ? async () => Boolean(await bridge.indexIdle!()) : undefined,
    (change) => listeners.forEach((listener) => listener(change)),
  );
  const openedListeners = new Set<(name: string) => void>();
  const names = async () => listOf<string>(await bridge.listPages());
  // A rename checked by what the space has after it: SilverBullet answers the same whether it renamed or not
  const renamed = async (from: string, to: string, run: () => Promise<unknown>) => {
    await run();
    const now = new Set(await names());
    return now.has(to) && !now.has(from) ? {} : { problem: `"${from}" was not renamed to "${to}" (a name taken, or one a page cannot have)` };
  };
  const platform: Platform = {
    editor: {
      documentName: () => bridge.getCurrentPage(),
      text: () => bridge.getText(),
      replace: (from, to, insert) => bridge.replaceRange(from, to, insert),
      open: (ref) => bridge.navigate(ref),
      onOpened: (listener) => {
        openedListeners.add(listener);
        return () => void openedListeners.delete(listener);
      },
    },
    space: {
      read: (name) => bridge.readPage(name),
      write: (name, text) => bridge.writePage(name, text),
      list: names,
      remove: (name) => bridge.deletePage(name),
      validateName: validatePageName,
      noun: { one: "page", many: "pages" },
      folderSeparator: "/",
      rename: (from, to) => renamed(from, to, () => bridge.renamePage(from, to)),
      renamePrefix: async (from, to) => {
        await bridge.renamePrefix(from, to);
        // (Under it: in its folder, not a page whose name only starts so, `db-tasks2` beside `db-tasks`)
        return (await names()).some((name) => name.startsWith(`${from}/`)) ? { problem: `pages under "${from}" were not all renamed` } : {};
      },
    },
    index: {
      objects: (tag) => index.objects(tag),
      reservedKeys: PAGE_KEYS,
      documentDates: pageDates,
      tasks: async (pages) => tasksOfPages(await index.objects("task"), pages),
      referableDocuments: async () => referablePages(await index.objects("page")),
      onChanged: (listener) => {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    },
    ui: {
      notify: (message, options) => bridge.flash(message, options?.type ?? "info", options?.timeout === undefined ? undefined : { timeout: options.timeout }),
      ask: (message) => bridge.confirm(message),
    },
    settings: {
      get: (path, fallback) => bridge.getConfig(path, fallback),
      // Into CONFIG's managed block, as the other plugins' settings dialogs save (shared/configpage.ts)
      ...(bridge.saveConfigPage
        ? { save: (values) => saveConfigPage({ readPage: (name) => bridge.readPage(name), saveConfigPage: (text) => bridge.saveConfigPage!(text) }, (text) => withConfigSettings(text, values, OWN_MARKER)) }
        : {}),
    },
  };
  return {
    platform,
    indexChanged: (change) => index.changed(change),
    indexSettled: () => void index.settled(),
    pageOpened: async () => {
      // (Its name not read: told without it, as what listens needs to know only that another page is open)
      const name = await Promise.resolve(bridge.getCurrentPage()).then(String, () => "");
      openedListeners.forEach((listener) => listener(name));
    },
  };
}

/** SilverBullet's editor's area on screen (`#sb-editor`: not its sidebars), where a panel beside the page goes */
export function editorArea(doc: Document): DOMRect | undefined {
  return doc.querySelector("#sb-editor")?.getBoundingClientRect();
}

/**
 * How the page's text looks in SilverBullet's editor (its content, `.cm-content`: the theme's font, size, line height,
 * color), for a panel beside the page that is no part of it (it hangs in the document's body, where none of the editor's
 * rules reach: the browser's Times showed): as CSS properties, none where the editor is not there
 */
export function editorLook(doc: Document): Readonly<Record<string, string>> | undefined {
  const content = doc.querySelector(".cm-content");
  const view = doc.defaultView;
  if (!content || !view) return undefined;
  const style = view.getComputedStyle(content);
  return { "font-family": style.fontFamily, "font-size": style.fontSize, "line-height": style.lineHeight, color: style.color };
}
