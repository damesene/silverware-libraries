// The Space and the Notifier made of SilverBullet's API, as the init page
// hands it over (bridge.ts). The page open in the editor is read through the
// editor; the page writer writes it through the editor too (one replaceRange:
// an undo step there), never its file, which SilverBullet would take for a
// change made elsewhere and answer with a sync conflict.
import { type Bridge, listOf } from "../bridge.ts";
import type { Notifier, Space, TagRecord, WritingPlatform } from "./space.ts";

/**
 * The tags' records as the init page reads them (the index's `tag` objects, and its tables' and headings' tags): a
 * paragraph's hashtag counted on the page (SilverBullet after 2.12.1 says `paragraph` where 2.12.1 said `page`),
 * each record once (after 2.12.1 a heading's tags are `tag` objects too, which the init page reads of headings as well)
 */
export function tagRecordsOf(records: readonly unknown[]): TagRecord[] {
  const seen = new Set<string>();
  return records.flatMap((record): TagRecord[] => {
    const { name, page, parent } = (record ?? {}) as { name?: unknown; page?: unknown; parent?: unknown };
    if (typeof name !== "string" || typeof page !== "string") return [];
    const context = typeof parent !== "string" || parent === "paragraph" ? "page" : parent;
    const key = JSON.stringify([name, page, context]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name, page, parent: context }];
  });
}

// SilverBullet's navigator (the panel's view): its root, its filter field (the keys of a view's keymap reach the row
// picked while that has the focus)
const NAV_ROOT = ".sb-nav-root";
const NAV_INPUT = ".sb-nav-input";
// The navigator a press was last in
let pressedIn: Element | undefined;
let watching = false;

/** Presses followed, so a click in the panel that opened nothing can give its navigator the focus back */
export function watchNavigatorPresses(doc: Document): void {
  if (watching) return;
  watching = true;
  doc.addEventListener("mousedown", (event) => (pressedIn = (event.target instanceof Element && event.target.closest(NAV_ROOT)) || undefined), true);
}

/**
 * The focus given back to the navigator a press was in, where nothing has it (the page's body): SilverBullet after
 * 2.12.1 lets a press on a row that can be dragged take it from the filter field, and gives it back only where the
 * click opens nothing of the view's own, which a click on a tag of the panel (it opens nothing) is not taken for:
 * F2 on the row picked reached nothing
 */
export function refocusNavigator(doc: Document): void {
  const input = pressedIn?.isConnected ? pressedIn.querySelector<HTMLInputElement>(NAV_INPUT) : null;
  if (input && (doc.activeElement === doc.body || !doc.activeElement)) input.focus();
}

export function silverBulletSpace(bridge: Bridge): Space {
  const current = async () => {
    try {
      return (await bridge.getCurrentPage()) || undefined;
    } catch {
      return undefined;
    }
  };
  const read = async (page: string) => ((await current()) === page ? String(await bridge.getText()) : String(await bridge.readPage(page)));
  return {
    pageNames: () => pageNamesOf(bridge),
    tagRecords: async () => tagRecordsOf(listOf(await bridge.queryTags())),
    read,
    currentPage: current,
    navigate: async (page) => {
      await bridge.navigate(page);
    },
    settled: async () => {
      try {
        await bridge.awaitIndex?.();
      } catch {
        // (A release without the queue: what the index has is read as it is)
      }
    },
  };
}

export function silverBulletNotifier(bridge: Bridge): Notifier {
  return {
    flash: (message, type = "info", actions) => {
      void bridge.flash(message, type, actions?.length ? { actions: actions.map(({ name, run }) => ({ name, run })) } : undefined);
    },
  };
}

/** SilverBullet's editor and space as the page writer writes through them (the page open through the editor, one replaceRange) */
export function silverBulletPlatform(bridge: Bridge): WritingPlatform {
  return {
    editor: {
      documentName: async () => String(await bridge.getCurrentPage()),
      text: async () => String(await bridge.getText()),
      replace: async (from, to, insert) => {
        await bridge.replaceRange(from, to, insert);
      },
    },
    space: {
      read: async (page) => String(await bridge.readPage(page)),
      write: async (page, text) => {
        await bridge.writePage(page, text);
      },
      list: () => pageNamesOf(bridge),
    },
  };
}

/** Every page's name, as Space Lua hands the list over (a table of 1, 2, …; a page a name or an object with one) */
async function pageNamesOf(bridge: Bridge): Promise<string[]> {
  return listOf(await bridge.listPages()).flatMap((page): string[] => {
    if (typeof page === "string") return [page];
    const name = (page as { name?: unknown } | null)?.name;
    return typeof name === "string" ? [name] : [];
  });
}
