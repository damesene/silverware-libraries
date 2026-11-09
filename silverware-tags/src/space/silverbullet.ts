// The Space and the Notifier made of SilverBullet's API, as the init page
// hands it over (bridge.ts). The page open in the editor is read through the
// editor; the page writer writes it through the editor too (one replaceRange:
// an undo step there), never its file, which SilverBullet would take for a
// change made elsewhere and answer with a sync conflict.
import { type Bridge, listOf } from "../bridge.ts";
import type { Notifier, Space, TagRecord, WritingPlatform } from "./space.ts";

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
    tagRecords: async () =>
      listOf(await bridge.queryTags()).flatMap((record): TagRecord[] => {
        const { name, page, parent } = (record ?? {}) as { name?: unknown; page?: unknown; parent?: unknown };
        return typeof name === "string" && typeof page === "string" ? [{ name, page, parent: typeof parent === "string" ? parent : "page" }] : [];
      }),
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
