// SilverBullet's editor and space as the page writer writes through them (the page open through the editor: one
// replaceRange, one undo step), made of what the init page hands over (bridge.ts)
import type { Platform } from "../../../../shared/platform.ts";
import type { Bridge } from "../../bridge.ts";

export function silverBulletPlatform(bridge: Bridge): Pick<Platform, "editor" | "space"> {
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
      list: async () => pageNamesOf(await bridge.listPages()),
    },
  };
}

/** Every page's name, as Space Lua hands the list over (a list or a table of 1, 2, …; a page a name or an object with one) */
function pageNamesOf(pages: unknown): string[] {
  const list = Array.isArray(pages) ? pages : pages && typeof pages === "object" ? Object.values(pages) : [];
  return list.flatMap((page): string[] => {
    if (typeof page === "string") return [page];
    const name = (page as { name?: unknown } | null)?.name;
    return typeof name === "string" ? [name] : [];
  });
}
