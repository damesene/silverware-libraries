// What Silverware Table asks of the platform it runs on, apart from which one
// it is (docs/silverware-table-store-plan.md, step 1): the parts of the shared
// platform it uses (shared/platform.ts), and what only a table needs, its
// markdown rendered. The binding of each host makes it (in SilverBullet of
// what the init page hands over: host/silverbullet/platform.ts; in tests of
// memory). The core and the adapter use it; modules never see it, they get
// host functions in model terms (core/feature.ts, ModelHost).
import type { Awaitable, Editor, Settings, Space, UserInterface } from "../../../shared/platform.ts";

export type TablePlatform = {
  /** The open document: its text read and edited, the cursor, the editor's undo */
  readonly editor: Editor;
  /** Other documents read and written (formulas referring to another page's tables, lazy saving into a page left); none: none read */
  readonly space?: Space;
  readonly ui: UserInterface;
  readonly settings: Settings;
  readonly renderer: Renderer;
  /** Silverware Layout's API where it is installed (shared/layout.ts `layoutOf` reads it) */
  readonly layout?: unknown;
};

/** A table's markdown rendered as the host renders its tables' cells (the sheet draws tables itself) */
export interface Renderer {
  /** Markdown to HTML, `${…}` evaluated in it; none: no table is drawn by Silverware Table */
  markdownToHtml?(markdown: string): Awaitable<string>;
  /** A `${…}` expression's value, once the index is up to date; none: cells are not evaluated again */
  evaluate?(expression: string): Awaitable<unknown>;
}
