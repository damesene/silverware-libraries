// The platform made of what the init page's Lua hands over (SilverBullet's
// editor, space, index, config and UI API): the one place that knows what
// SilverBullet's API is called and what it answers. Everything else asks the
// platform (shared/platform.ts).
import { saveConfigPage, withConfigSettings } from "../../../../shared/configpage.ts";
import type { Choice, IndexChange, IndexedObject, Platform } from "../../../../shared/platform.ts";
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
  // `actions`: buttons on the notification (its Lua makes each a Lua function calling `run`, as SilverBullet's takes)
  flash(message: string, type: "info" | "error", options?: { readonly timeout?: number; readonly actions?: readonly { readonly name: string; readonly run: () => unknown }[] }): void;
  confirm(message: string): Promise<boolean>;
  prompt(message: string, value?: string): Promise<string | undefined>;
  // SilverBullet's filter box (editor.filterBox): the option picked, nothing where none was
  filterBox?(label: string, options: readonly { readonly name: string; readonly description?: string; readonly index: number }[]): Promise<unknown>;
  getConfig(path: string, fallback: unknown): Promise<unknown>;
  // The CONFIG page written as the Configuration Manager writes it (synced, indexed, the configuration loaded again)
  // `set`: written and indexed, the configuration not loaded again (which starts the plugin anew), these values set in it
  // as it is (config.set, by path), so SilverBullet's config and the plugin read them alike
  saveConfigPage?(text: string, set?: Readonly<Record<string, unknown>>): Promise<void>;
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
      // (As SilverBullet's own links: relative to its <base>, so it is right under a prefix too; encodePageURI in its
      // plug-api/lib/ref.ts, the name's folders kept)
      href: (name) => encodeURIComponent(name).replace(/%2F/g, "/"),
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
      // (Its timeout and buttons where given, nothing else: SilverBullet's defaults for what is not)
      notify: (message, options) => {
        const more = { ...(options?.timeout === undefined ? {} : { timeout: options.timeout }), ...(options?.actions?.length ? { actions: options.actions } : {}) };
        bridge.flash(message, options?.type ?? "info", Object.keys(more).length ? more : undefined);
      },
      ask: (message) => bridge.confirm(message),
      // The filter box gives back the option picked, found by the index it was given
      ...(bridge.filterBox
        ? {
            pick: async <T extends Choice>(label: string, choices: readonly T[]) => {
              const options = choices.map((choice, index) => ({ name: choice.name, ...(choice.description ? { description: choice.description } : {}), index }));
              const picked = (await bridge.filterBox!(label, options)) as { index?: unknown } | undefined;
              return typeof picked?.index === "number" ? choices[picked.index] : undefined;
            },
          }
        : {}),
    },
    settings: {
      get: (path, fallback) => bridge.getConfig(path, fallback),
      // Into CONFIG's managed block, as the other plugins' settings dialogs save (shared/configpage.ts)
      ...(bridge.saveConfigPage
        ? {
            // (Not loaded again: the values set in SilverBullet's configuration as it is, as CONFIG has them now)
            save: (values, options) =>
              saveConfigPage({ readPage: (name) => bridge.readPage(name), saveConfigPage: (text) => bridge.saveConfigPage!(text, options?.reload === false ? values : undefined) }, (text) => withConfigSettings(text, values, OWN_MARKER)),
          }
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
  const editor = doc.querySelector<HTMLElement>("#sb-editor");
  const view = doc.defaultView;
  if (!editor || !view) return undefined;
  // Its content box, inside its padding and borders: what pads it is kept for something of the editor's own, as Silverware
  // Toolbar docked at its top or bottom pads it by its height (the editor border-box), which a panel over the whole box
  // lay under (seen 2026-11-09). The element looked up as asked: SilverBullet keeps it for the session
  const box = editor.getBoundingClientRect();
  const style = view.getComputedStyle(editor);
  const side = (name: "Top" | "Right" | "Bottom" | "Left") => (parseFloat(style.getPropertyValue(`padding-${name.toLowerCase()}`)) || 0) + (parseFloat(style.getPropertyValue(`border-${name.toLowerCase()}-width`)) || 0);
  const [top, right, bottom, left] = [side("Top"), side("Right"), side("Bottom"), side("Left")];
  return new DOMRect(box.left + left, box.top + top, Math.max(0, box.width - left - right), Math.max(0, box.height - top - bottom));
}

/**
 * `listener` told as the editor's content box may have changed: its size (a sidebar narrows it), and what pads it changed
 * without its size (a toolbar docked at its top moved to its bottom: the variables on html it pads it by, or its own
 * style); its end given back
 */
export function watchEditorArea(doc: Document, listener: () => void): () => void {
  const editor = doc.querySelector("#sb-editor");
  const view = doc.defaultView;
  if (!editor || !view) return () => {};
  // (Once a frame however often they change: html's style is written often, by a toolbar following the keyboard too)
  let pending = false;
  const tell = () => {
    if (pending) return;
    pending = true;
    view.requestAnimationFrame(() => {
      pending = false;
      listener();
    });
  };
  const resized = view.ResizeObserver ? new view.ResizeObserver(tell) : undefined;
  resized?.observe(editor);
  const styled = new view.MutationObserver(tell);
  for (const one of [doc.documentElement, editor]) styled.observe(one, { attributes: true, attributeFilter: ["style", "class"] });
  return () => {
    resized?.disconnect();
    styled.disconnect();
  };
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
