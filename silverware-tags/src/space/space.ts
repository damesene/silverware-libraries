// What Silverware Tags needs of a space, apart from how it is reached: the
// pages, which tags the index has where, a page's text read. Nothing here
// writes: pages are written by the page writer (shared/pages/writer.ts)
// alone, which the core (the controller) gets apart, over the platform's
// editor and space (`WritingPlatform`), so no module can reach them. The core
// and the modules know only this; silverbullet.ts makes it of SilverBullet's
// API (the bridge), memory.ts of a map of pages (the tests, the playground).
import type { Platform } from "../../../shared/platform.ts";

/** What the page writer writes through: the platform's editor (the page open in it) and space */
export type WritingPlatform = Pick<Platform, "editor" | "space">;

/** A tag where the index has it: on a page, in a context (SilverBullet's `parent`: page, item, task, table, …) */
export type TagRecord = { readonly name: string; readonly page: string; readonly parent: string };

export interface Space {
  /** Every page's name */
  pageNames(): Promise<readonly string[]>;
  /** The index's tags, one per tag, page and context */
  tagRecords(): Promise<readonly TagRecord[]>;
  /** A page's text as it is now (the editor's, for the page open in it) */
  read(page: string): Promise<string>;
  /** The page open in the editor */
  currentPage(): Promise<string | undefined>;
  /** Opens a page */
  navigate(page: string): Promise<void>;
  /** Waits until the index has caught up with what was written */
  settled(): Promise<void>;
}

/** What tells the user: SilverBullet's notifications, a question asked */
export interface Notifier {
  flash(message: string, type?: "info" | "error", actions?: readonly { readonly name: string; readonly run: () => void }[]): void;
}
