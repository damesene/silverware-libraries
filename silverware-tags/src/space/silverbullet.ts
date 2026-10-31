// The Space and the Notifier made of SilverBullet's API, as the library page
// hands it over (bridge.ts). The page open in the editor is read and written
// through the editor (its text, one replaceRange: an undo step there), never
// by writing its file, which SilverBullet would take for a change made
// elsewhere and answer with a sync conflict.
import { type Bridge, listOf } from "../bridge.ts";
import { minimalEdit, type Notifier, type Space, type TagRecord, type WriteResult } from "./space.ts";

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
    pageNames: async () =>
      listOf(await bridge.listPages()).flatMap((page): string[] => {
        if (typeof page === "string") return [page];
        const name = (page as { name?: unknown } | null)?.name;
        return typeof name === "string" ? [name] : [];
      }),
    tagRecords: async () =>
      listOf(await bridge.queryTags()).flatMap((record): TagRecord[] => {
        const { name, page, parent } = (record ?? {}) as { name?: unknown; page?: unknown; parent?: unknown };
        return typeof name === "string" && typeof page === "string" ? [{ name, page, parent: typeof parent === "string" ? parent : "page" }] : [];
      }),
    read,
    write: async (page, text, before): Promise<WriteResult> => {
      if ((await current()) === page) {
        const now = String(await bridge.getText());
        if (now !== before) return "changed";
        const edit = minimalEdit(now, text);
        if (edit) await bridge.replaceRange(edit.from, edit.to, edit.insert);
        return "written";
      }
      let now: string;
      try {
        now = String(await bridge.readPage(page));
      } catch {
        return "changed";
      }
      if (now !== before) return "changed";
      await bridge.writePage(page, text);
      return "written";
    },
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
