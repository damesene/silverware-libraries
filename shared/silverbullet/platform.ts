// SilverBullet's editor and space as the page writer writes through them (the page open through the editor: one
// replaceRange, one undo step), made of what a plugin's init page hands over; and the URL SilverBullet serves a file
// of its space at. A plugin's SilverBullet binding (its host/silverbullet/, its index.ts) uses it, nothing else.
import type { Platform } from "../platform.ts";

/** What of SilverBullet's API the platform is made of, as an init page hands it over (`editor.*`, `space.*`) */
export type SilverBulletPageApi = {
  readonly getCurrentPage: () => unknown;
  readonly getText: () => unknown;
  readonly replaceRange: (from: number, to: number, text: string) => unknown;
  readonly readPage: (name: string) => unknown;
  readonly writePage: (name: string, text: string) => unknown;
  // Every page (space.listPages: page objects with their name, or names)
  readonly listPages: () => unknown;
};

export function silverBulletPlatform(api: SilverBulletPageApi): Pick<Platform, "editor" | "space"> {
  return {
    editor: {
      documentName: async () => String(await api.getCurrentPage()),
      text: async () => String(await api.getText()),
      replace: async (from, to, insert) => {
        await api.replaceRange(from, to, insert);
      },
    },
    space: {
      read: async (page) => String(await api.readPage(page)),
      write: async (page, text) => {
        await api.writePage(page, text);
      },
      list: async () => pageNamesOf(await api.listPages()),
    },
  };
}

/** The URL SilverBullet serves a file of its space at (its files under `.fs/`, as its own media elements load them) */
export function documentUrl(path: string): string {
  return `.fs/${path.replace(/^\//, "").split("/").map(encodeURIComponent).join("/")}`;
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
